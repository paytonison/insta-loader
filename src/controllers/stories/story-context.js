import { resolveCurrentStoryItem } from "./current-item.js";
import {
  extractStoryReel,
  isStoryVideoItem,
  normalizeStorySurfaceMedia,
  selectLargestStoryDisplayResource,
} from "../../media/surface-normalizers.js";

/** @typedef {import("../../media/types.js").MediaDescriptor} MediaDescriptor */

export const STORY_SURFACE = Object.freeze({
  STORY: "stories",
  HIGHLIGHT: "highlights",
});

export const STORY_INTENT = Object.freeze({
  DOWNLOAD: "download",
  PREVIEW: "preview",
  THUMBNAIL: "thumbnail",
});

/**
 * @param {unknown} payload
 * @return {Record<string, any> | null}
 */
export function getStoryReel(payload) {
  return extractStoryReel(payload);
}

/**
 * @param {unknown} payload
 * @return {Record<string, any>[]}
 */
export function getStoryItems(payload) {
  const items = getStoryReel(payload)?.items;
  return Array.isArray(items) ? items : [];
}

/**
 * @param {unknown} payload
 * @return {string | null}
 */
export function getStoryOwner(payload) {
  const reel = getStoryReel(payload);
  return reel?.user?.username || reel?.owner?.username || null;
}

/**
 * Preserve the two distinct response-cache owners used by the legacy runtime:
 * username for ordinary Stories and highlight ID for Highlights.
 *
 * @param {string} surface
 * @param {{username?: string | null, highlightId?: string | null}} identity
 * @return {string | null}
 */
export function getStorySurfaceCacheKey(surface, identity) {
  if (surface === STORY_SURFACE.STORY) return identity?.username || null;
  if (surface === STORY_SURFACE.HIGHLIGHT) {
    return identity?.highlightId || null;
  }
  throw new TypeError(`Unknown Story surface: ${surface}`);
}

/**
 * @param {{mediaId?: string | number | null} | null | undefined} current
 * @return {string | number | null}
 */
export function getStoryImageCacheKey(current) {
  return current?.mediaId ?? null;
}

/**
 * Convert raw settings and transient rate-limit state into explicit policy
 * inputs for the shared media action layer.
 *
 * @param {Object} settings
 * @param {{tempFetchRateLimit?: boolean}} runtimeState
 * @param {Object} options
 * @param {string} options.intent
 * @param {Record<string, any> | null} [options.item]
 * @return {Object}
 */
export function getStoryMediaApiPolicyInputs(
  settings,
  runtimeState,
  { intent, item = null },
) {
  const forceResourceViaMedia = Boolean(settings?.FORCE_RESOURCE_VIA_MEDIA);
  const rateLimited = Boolean(runtimeState?.tempFetchRateLimit);
  const requestMediaApi = forceResourceViaMedia && !rateLimited;
  const captureImageViaMediaCache = Boolean(
    settings?.CAPTURE_IMAGE_VIA_MEDIA_CACHE,
  );
  const useImageCache =
    captureImageViaMediaCache &&
    (intent === STORY_INTENT.THUMBNAIL ||
      (item != null && !isStoryVideoItem(item)));
  const preferDashManifest = Boolean(settings?.PREFER_DASH_MANIFEST);

  return {
    forceResourceViaMedia,
    rateLimited,
    requestMediaApi,
    captureImageViaMediaCache,
    useImageCache,
    fallbackToLegacyOnMediaApiFailure: Boolean(
      settings?.FALLBACK_TO_BLOB_FETCH_IF_MEDIA_API_THROTTLED,
    ),
    preferDashManifest,
    requestDash:
      requestMediaApi &&
      preferDashManifest &&
      intent !== STORY_INTENT.THUMBNAIL &&
      isStoryVideoItem(item),
    renamePublishDate: Boolean(settings?.RENAME_PUBLISH_DATE),
  };
}

/**
 * @param {Record<string, any> | null | undefined} item
 * @param {{available?: boolean, posterUrl?: string | null} | null | undefined} domMetadata
 * @return {Object}
 */
export function getStoryThumbnailMetadata(item, domMetadata) {
  const displayResources = Array.isArray(item?.display_resources)
    ? item.display_resources
    : item?.image_versions2?.candidates;
  const largestDisplay = selectLargestStoryDisplayResource(displayResources);
  const displayUrl = item?.display_url ||
    largestDisplay?.src ||
    largestDisplay?.url ||
    null;

  return {
    mediaId: item?.pk ?? item?.id ?? null,
    displayUrl,
    posterUrl: domMetadata?.posterUrl || null,
    available: Boolean(domMetadata?.available || displayUrl),
  };
}

/**
 * Build the shared identity/cache/policy seam without performing requests or
 * output actions. Story and Highlight DOM adapters remain separate; both feed
 * this function the same normalized state.
 *
 * @param {Object} options
 * @param {string} options.surface
 * @param {unknown} options.payload
 * @param {Object} options.domState
 * @param {Object} options.settings
 * @param {{tempFetchRateLimit?: boolean}} options.runtimeState
 * @param {string} options.intent
 * @return {Object}
 */
export function createStoryActionContext({
  surface,
  payload,
  domState,
  settings,
  runtimeState,
  intent,
}) {
  const items = getStoryItems(payload);
  const current = resolveCurrentStoryItem(items, domState?.identity);
  const owner = getStoryOwner(payload) || domState?.username || null;

  return {
    surface,
    intent,
    owner,
    current,
    responseCacheKey: getStorySurfaceCacheKey(surface, {
      username: domState?.username || owner,
      highlightId: domState?.highlightId,
    }),
    imageCacheKey: getStoryImageCacheKey(current),
    mediaApiPolicy: getStoryMediaApiPolicyInputs(settings, runtimeState, {
      intent,
      item: current.item,
    }),
    progress: domState?.progress ?? null,
    thumbnail: getStoryThumbnailMetadata(
      current.item,
      domState?.thumbnail,
    ),
  };
}

/**
 * Build one-based descriptor arrays for both Story and Highlight batch paths.
 * Display resources are ranked on a copy so fixture/API records are not
 * mutated, while retaining the legacy largest-width selection and first video
 * resource choice.
 *
 * @param {unknown} payload
 * @param {Object} options
 * @param {string} options.surface
 * @param {boolean} [options.renamePublishDate=false]
 * @param {number} options.nowSeconds
 * @return {MediaDescriptor[]}
 */
export function buildStoryBatchDescriptors(
  payload,
  {
    surface,
    renamePublishDate = false,
    nowSeconds,
  },
) {
  return normalizeStorySurfaceMedia(payload, {
    surface,
    renamePublishDate,
    nowSeconds,
  });
}
