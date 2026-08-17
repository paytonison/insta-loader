/** @typedef {import("./types.js").MaximumProgressiveCandidate} MaximumProgressiveCandidate */

/**
 * Match the maximum-Reel positive numeric conversion.
 *
 * @param {unknown} value
 * @returns {number}
 */
export function toPositiveFiniteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

/**
 * @param {MaximumProgressiveCandidate} left
 * @param {MaximumProgressiveCandidate} right
 * @returns {number}
 */
export function compareMaximumProgressiveCandidates(left, right) {
  return (
    right.shortSide - left.shortSide ||
    right.area - left.area ||
    right.bandwidth - left.bandwidth ||
    left.index - right.index
  );
}

/**
 * @param {MaximumProgressiveCandidate[]} candidates
 * @returns {MaximumProgressiveCandidate[]}
 */
export function rankMaximumProgressiveCandidates(candidates) {
  return Array.isArray(candidates)
    ? [...candidates].sort(compareMaximumProgressiveCandidates)
    : [];
}

/**
 * Unwrap the response shapes accepted by maximum-quality Reel playback.
 *
 * @param {unknown} data
 * @returns {Record<string, any> | null}
 */
export function extractMaximumProgressiveItem(data) {
  if (data === null || typeof data !== "object" || Array.isArray(data)) {
    return null;
  }

  const xigMedia = data.xig_polaris_media;
  const item =
    xigMedia?.if_not_gated_logged_out ||
    xigMedia?.if_not_gated ||
    xigMedia ||
    data.xdt_api__v1__media__shortcode__web_info?.items?.[0] ||
    data.shortcode_media ||
    data.items?.[0] ||
    data;
  return item !== null && typeof item === "object" && !Array.isArray(item)
    ? item
    : null;
}

/**
 * Normalize and rank complete HTTPS progressive representations. A non-empty
 * `video_versions` list takes precedence over the single `video_url` fallback,
 * including when individual versions later prove invalid.
 *
 * @param {unknown} data
 * @returns {MaximumProgressiveCandidate[]}
 */
export function normalizeMaximumProgressiveCandidates(data) {
  const item = extractMaximumProgressiveItem(data);
  if (!item) return [];

  const versions = Array.isArray(item.video_versions)
    ? item.video_versions
    : [];
  const rawCandidates = versions.length
    ? versions
    : item.video_url
      ? [{
          url: item.video_url,
          width: item.original_width,
          height: item.original_height,
        }]
      : [];
  const seen = new Set();

  const candidates = rawCandidates.flatMap((candidate, index) => {
    const url = candidate?.url || candidate?.video_url || candidate?.src;
    let parsed;

    try {
      parsed = new URL(url);
    } catch (_error) {
      return [];
    }

    if (parsed.protocol !== "https:" || seen.has(parsed.href)) return [];
    seen.add(parsed.href);

    const width = toPositiveFiniteNumber(
      candidate.width ?? candidate.config_width ?? item.original_width,
    );
    const height = toPositiveFiniteNumber(
      candidate.height ?? candidate.config_height ?? item.original_height,
    );
    const bandwidth = toPositiveFiniteNumber(
      candidate.bandwidth ?? candidate.bitrate ?? candidate.video_bandwidth,
    );

    return [{
      area: width * height,
      bandwidth,
      height,
      index,
      shortSide: Math.min(width, height),
      url: parsed.href,
      width,
    }];
  });

  return rankMaximumProgressiveCandidates(candidates);
}

// Keep the legacy symbol available as a narrow migration seam.
export const normalizeMaximumReelCandidates =
  normalizeMaximumProgressiveCandidates;
