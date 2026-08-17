/**
 * @typedef {Object} DashRepresentation
 * @property {string} id
 * @property {string} url
 * @property {string} mimeType
 * @property {string} contentType
 * @property {string} codecs
 * @property {number} bandwidth
 * @property {number} width
 * @property {number} height
 */

const EMPTY_DASH_SELECTION = Object.freeze({ video: null, audio: null });

/**
 * Parse an Instagram Media API MPD and retain the legacy selection order:
 * video height, then bandwidth, then width; audio bandwidth. Non-HTTPS
 * representations are rejected before ranking.
 *
 * @param {unknown} mpdXml
 * @param {{DOMParser?: typeof DOMParser, hasAudio?: boolean, logger?: (...messages: *) => void}} [options]
 * @return {{video: DashRepresentation|null, audio: DashRepresentation|null}}
 */
export function parseDashManifest(mpdXml, options = {}) {
  if (typeof mpdXml !== "string" || mpdXml.trim() === "") {
    return EMPTY_DASH_SELECTION;
  }

  const Parser = options.DOMParser || globalThis.DOMParser;
  if (typeof Parser !== "function") return EMPTY_DASH_SELECTION;

  try {
    const xml = new Parser().parseFromString(mpdXml, "application/xml");
    if (xml.querySelector("parsererror")) return EMPTY_DASH_SELECTION;

    const candidates = Array.from(xml.querySelectorAll("Representation"))
      .map(normalizeRepresentation)
      .filter(Boolean);
    const video = candidates
      .filter(isVideoRepresentation)
      .sort(compareVideoRepresentations)[0] || null;
    const audio = options.hasAudio === false
      ? null
      : candidates
          .filter(isAudioRepresentation)
          .sort(compareAudioRepresentations)[0] || null;

    return { video, audio };
  } catch (error) {
    options.logger?.("[DASH]", "parseDashManifest() error:", error);
    return EMPTY_DASH_SELECTION;
  }
}

/**
 * @param {Element} representation
 * @return {DashRepresentation|null}
 */
function normalizeRepresentation(representation) {
  const base = representation.querySelector("BaseURL")?.textContent?.trim();
  if (!base || !isHttpsUrl(base)) return null;
  const url = normalizeInstagramDashRepresentationUrl(base);

  const adaptationSet = representation.closest("AdaptationSet");
  return {
    id: representation.getAttribute("id") || "",
    url,
    mimeType:
      representation.getAttribute("mimeType") ||
      adaptationSet?.getAttribute("mimeType") ||
      "",
    contentType: adaptationSet?.getAttribute("contentType") || "",
    codecs:
      representation.getAttribute("codecs") ||
      adaptationSet?.getAttribute("codecs") ||
      "",
    bandwidth: positiveInteger(representation.getAttribute("bandwidth")),
    width: positiveInteger(representation.getAttribute("width")),
    height: positiveInteger(representation.getAttribute("height")),
  };
}

/**
 * Instagram sometimes exposes the signed representation URL used for one
 * playback range. The same signature authorizes the complete representation
 * when only `bytestart` and `byteend` are removed. Never rewrite another host
 * or discard signature, expiry, or asset-identity parameters.
 *
 * @param {string} value
 * @return {string}
 */
export function normalizeInstagramDashRepresentationUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch (_error) {
    return value;
  }

  const hostname = url.hostname.toLowerCase();
  const isInstagramCdn =
    hostname === "cdninstagram.com" ||
    hostname.endsWith(".cdninstagram.com") ||
    hostname === "fbcdn.net" ||
    hostname.endsWith(".fbcdn.net");
  if (url.protocol !== "https:" || !isInstagramCdn) return value;

  const start = url.searchParams.get("bytestart");
  const end = url.searchParams.get("byteend");
  if (!/^\d+$/.test(start || "") || !/^\d+$/.test(end || "")) {
    return value;
  }
  if (Number(end) < Number(start)) return value;

  url.searchParams.delete("bytestart");
  url.searchParams.delete("byteend");
  return url.href;
}

/** @param {unknown} value @return {number} */
function positiveInteger(value) {
  return Number.parseInt(String(value || "0"), 10) || 0;
}

/** @param {string} value @return {boolean} */
function isHttpsUrl(value) {
  try {
    return new URL(value).protocol === "https:";
  } catch (_error) {
    return false;
  }
}

/** @param {DashRepresentation} candidate @return {boolean} */
function isVideoRepresentation(candidate) {
  return (
    candidate.contentType.includes("video") ||
    candidate.mimeType.startsWith("video")
  );
}

/** @param {DashRepresentation} candidate @return {boolean} */
function isAudioRepresentation(candidate) {
  return (
    candidate.contentType.includes("audio") ||
    candidate.mimeType.startsWith("audio")
  );
}

/**
 * @param {DashRepresentation} left
 * @param {DashRepresentation} right
 * @return {number}
 */
function compareVideoRepresentations(left, right) {
  return (
    right.height - left.height ||
    right.bandwidth - left.bandwidth ||
    right.width - left.width
  );
}

/**
 * @param {DashRepresentation} left
 * @param {DashRepresentation} right
 * @return {number}
 */
function compareAudioRepresentations(left, right) {
  return right.bandwidth - left.bandwidth;
}

/**
 * @typedef {Object} DashExecutionDependencies
 * @property {(url: string) => Promise<ArrayBuffer>} fetchArrayBuffer
 * @property {(video: ArrayBuffer, audio: ArrayBuffer) => Promise<ArrayBuffer>} mux
 * @property {(buffer: ArrayBuffer) => Blob|*} createMp4Blob
 * @property {(sourceUrl: string, blob: Blob|*, metadata: Object) => Promise<*>|*} saveMerged
 * @property {(url: string, metadata: Object) => Promise<*>|*} saveStream
 * @property {(...messages: *) => void} [logger]
 */

/**
 * Execute the legacy DASH download policy with every side effect injected.
 * Video-only manifests are saved directly. Video/audio pairs are fetched and
 * muxed together; any fetch, mux, blob, or merged-save failure falls back to
 * separate MP4 and M4A downloads.
 */
export class DashExecutionCoordinator {
  /** @param {DashExecutionDependencies} dependencies */
  constructor(dependencies) {
    for (const name of [
      "fetchArrayBuffer",
      "mux",
      "createMp4Blob",
      "saveMerged",
      "saveStream",
    ]) {
      if (typeof dependencies?.[name] !== "function") {
        throw new TypeError(`DashExecutionCoordinator requires ${name}().`);
      }
    }

    this.dependencies = Object.freeze({ ...dependencies });
  }

  /**
   * @param {{videoUrl: string, audioUrl?: string|null, metadata: Object}} input
   * @return {Promise<*>}
   */
  async execute(input) {
    const { videoUrl, audioUrl, metadata } = input;
    const dependencies = this.dependencies;
    const logger = dependencies.logger || (() => {});

    logger("[DASH]", "downloadDashStreams()", {
      videoUrl,
      audioUrl: audioUrl || null,
      sourceType: metadata.sourceType,
      shortcode: metadata.shortcode,
    });

    if (!audioUrl) {
      logger(
        "[DASH]",
        "Downloaded DASH video only (no audio rep / has_audio=false).",
      );
      return await dependencies.saveStream(videoUrl, {
        ...metadata,
        filetype: "mp4",
      });
    }

    try {
      logger("[DASH]", "Fetching DASH streams for mux...");
      const [videoBuffer, audioBuffer] = await Promise.all([
        dependencies.fetchArrayBuffer(videoUrl),
        dependencies.fetchArrayBuffer(audioUrl),
      ]);

      logger(
        "[DASH]",
        "Muxing DASH video+audio into one MP4 (mp4box main thread)...",
      );
      const mergedBuffer = await dependencies.mux(videoBuffer, audioBuffer);
      const mergedBlob = dependencies.createMp4Blob(mergedBuffer);
      const result = await dependencies.saveMerged(videoUrl, mergedBlob, {
        ...metadata,
        filetype: "mp4",
      });
      logger("[DASH]", "Merged MP4 download triggered.");
      return result;
    } catch (error) {
      logger(
        "[DASH]",
        "Mux failed -> fallback to separate downloads",
        error?.message || error,
      );
      const videoResult = await dependencies.saveStream(videoUrl, {
        ...metadata,
        filetype: "mp4",
      });
      const audioResult = await dependencies.saveStream(audioUrl, {
        ...metadata,
        filetype: "m4a",
      });
      return videoResult && audioResult;
    }
  }
}
