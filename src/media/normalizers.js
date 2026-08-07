import { selectBestImageCandidate } from "./image-candidates.js";

/** @typedef {import("./types.js").MediaDescriptor} MediaDescriptor */

/**
 * @param {unknown} value
 * @returns {value is Record<string, any>}
 */
function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/**
 * @param {unknown} value
 * @returns {string | null}
 */
function optionalString(value) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

/**
 * Preserve the existing owner fallback without mutating `user` into `owner`.
 *
 * @param {Record<string, any>} resource
 * @returns {string | null}
 */
export function getMediaOwner(resource) {
  return optionalString(resource?.owner?.username) ??
    optionalString(resource?.user?.username);
}

/**
 * @param {Record<string, any>} item
 * @returns {Array<Record<string, any>>}
 */
function getApiImageCandidates(item) {
  return Array.isArray(item?.image_versions2?.candidates)
    ? item.image_versions2.candidates
    : [];
}

/**
 * @param {Record<string, any>} item
 * @returns {Array<Record<string, any>>}
 */
function getLegacyDisplayResources(item) {
  return Array.isArray(item?.display_resources) ? item.display_resources : [];
}

/**
 * @param {Record<string, any>} item
 * @returns {string | null}
 */
function getLegacyDirectImageUrl(item) {
  const resources = getLegacyDisplayResources(item);
  return optionalString(resources.at(-1)?.src) ?? optionalString(item?.display_url);
}

/**
 * The old dialog uses display resource index 1 for its thumbnail. Keep that
 * choice when present and only fall back when a fixture/API response is sparse.
 *
 * @param {Record<string, any>} item
 * @returns {string | null}
 */
function getLegacyThumbnailUrl(item) {
  const resources = getLegacyDisplayResources(item);
  return optionalString(resources[1]?.src) ??
    optionalString(resources[0]?.src) ??
    optionalString(item?.display_url);
}

/**
 * @param {object} fields
 * @param {unknown} fields.mediaId
 * @param {unknown} fields.directUrl
 * @param {unknown} fields.thumbnailUrl
 * @param {"image" | "video"} fields.kind
 * @param {unknown} fields.owner
 * @param {unknown} fields.shortcode
 * @param {unknown} fields.publishTime
 * @param {number} fields.carouselIndex
 * @param {Record<string, any>} fields.rawMediaItem
 * @param {unknown} fields.dashManifest
 * @param {"data-ih-locale" | "data-ih-locale-title"} [fields.labelTranslationAttribute]
 * @returns {MediaDescriptor | null}
 */
function createMediaDescriptor({
  mediaId,
  directUrl,
  thumbnailUrl,
  kind,
  owner,
  shortcode,
  publishTime,
  carouselIndex,
  rawMediaItem,
  dashManifest,
  labelTranslationAttribute = "data-ih-locale",
}) {
  const normalizedDirectUrl = optionalString(directUrl);
  if (mediaId == null || normalizedDirectUrl === null) return null;

  return {
    mediaId,
    directUrl: normalizedDirectUrl,
    thumbnailUrl: optionalString(thumbnailUrl),
    kind,
    extension: kind === "video" ? "mp4" : "jpg",
    owner: optionalString(owner),
    shortcode: optionalString(shortcode),
    publishTime:
      typeof publishTime === "string" || typeof publishTime === "number"
        ? publishTime
        : null,
    carouselIndex,
    rawMediaItem,
    dashManifest: optionalString(dashManifest),
    labelTranslationAttribute,
  };
}

/**
 * Unwrap the legacy query-hash GraphQL response without mutating its resource.
 *
 * @param {unknown} payload
 * @returns {Record<string, any> | null}
 */
export function extractLegacyResource(payload) {
  if (!isRecord(payload)) return null;

  const root = isRecord(payload.data) ? payload.data : payload;
  const resource = isRecord(root.shortcode_media) ? root.shortcode_media : root;
  return isRecord(resource) ? resource : null;
}

/**
 * Normalize GraphImage, GraphVideo, and GraphSidecar query-hash resources.
 * Sidecar children inherit the parent owner, shortcode, and publish time, as
 * they do in the existing media dialog.
 *
 * @param {unknown} payload
 * @returns {MediaDescriptor[]}
 */
export function normalizeLegacyMedia(payload) {
  const resource = extractLegacyResource(payload);
  if (!resource) return [];

  const owner = getMediaOwner(resource);
  const shortcode = optionalString(resource.shortcode);
  const publishTime = resource.taken_at_timestamp;

  if (resource.__typename === "GraphVideo") {
    const descriptor = createMediaDescriptor({
      mediaId: resource.id,
      directUrl: resource.video_url,
      thumbnailUrl: getLegacyThumbnailUrl(resource),
      kind: "video",
      owner,
      shortcode,
      publishTime,
      carouselIndex: 1,
      rawMediaItem: resource,
      dashManifest: resource.video_dash_manifest,
    });
    return descriptor ? [descriptor] : [];
  }

  if (resource.__typename === "GraphImage") {
    const descriptor = createMediaDescriptor({
      mediaId: resource.id,
      directUrl: getLegacyDirectImageUrl(resource),
      thumbnailUrl: getLegacyThumbnailUrl(resource),
      kind: "image",
      owner,
      shortcode,
      publishTime,
      carouselIndex: 1,
      rawMediaItem: resource,
      dashManifest: null,
    });
    return descriptor ? [descriptor] : [];
  }

  if (resource.__typename !== "GraphSidecar") return [];

  const edges = Array.isArray(resource.edge_sidecar_to_children?.edges)
    ? resource.edge_sidecar_to_children.edges
    : [];

  return edges.flatMap((edge, index) => {
    const item = isRecord(edge?.node) ? edge.node : null;
    if (!item) return [];

    if (item.__typename === "GraphVideo") {
      const descriptor = createMediaDescriptor({
        mediaId: item.id,
        directUrl: item.video_url,
        thumbnailUrl: getLegacyThumbnailUrl(item),
        kind: "video",
        owner,
        shortcode,
        publishTime,
        carouselIndex: index + 1,
        rawMediaItem: item,
        dashManifest: item.video_dash_manifest,
        labelTranslationAttribute: "data-ih-locale-title",
      });
      return descriptor ? [descriptor] : [];
    }

    if (item.__typename === "GraphImage") {
      const descriptor = createMediaDescriptor({
        mediaId: item.id,
        directUrl: getLegacyDirectImageUrl(item),
        thumbnailUrl: getLegacyThumbnailUrl(item),
        kind: "image",
        owner,
        shortcode,
        publishTime,
        carouselIndex: index + 1,
        rawMediaItem: item,
        dashManifest: null,
      });
      return descriptor ? [descriptor] : [];
    }

    return [];
  });
}

/**
 * Unwrap query-ID, Media API, and already-extracted item response shapes.
 *
 * @param {unknown} payload
 * @returns {Record<string, any> | null}
 */
export function extractApiResource(payload) {
  if (!isRecord(payload)) return null;

  const root = isRecord(payload.data) ? payload.data : payload;
  const xdtItem = root.xdt_api__v1__media__shortcode__web_info?.items?.[0];
  const resource =
    (isRecord(xdtItem) && xdtItem) ||
    (isRecord(root.shortcode_media) && root.shortcode_media) ||
    (isRecord(root.items?.[0]) && root.items[0]) ||
    root;
  return isRecord(resource) ? resource : null;
}

/**
 * @param {Record<string, any>} item
 * @param {object} context
 * @param {string | null} context.owner
 * @param {string | null} context.shortcode
 * @param {number} context.carouselIndex
 * @returns {MediaDescriptor | null}
 */
function normalizeApiItem(item, { owner, shortcode, carouselIndex }) {
  const imageCandidates = getApiImageCandidates(item);

  // This intentionally mirrors `video_versions == null` in the legacy code.
  if (item.video_versions == null) {
    const image = selectBestImageCandidate(imageCandidates);
    return createMediaDescriptor({
      mediaId: item.pk ?? item.id,
      directUrl: image?.url,
      thumbnailUrl: image?.url,
      kind: "image",
      owner,
      shortcode,
      publishTime: item.taken_at,
      carouselIndex,
      rawMediaItem: item,
      dashManifest: null,
    });
  }

  const firstVideo = Array.isArray(item.video_versions)
    ? item.video_versions[0]
    : null;
  return createMediaDescriptor({
    mediaId: item.pk ?? item.id,
    directUrl: firstVideo?.url,
    thumbnailUrl: imageCandidates[0]?.url,
    kind: "video",
    owner,
    shortcode,
    publishTime: item.taken_at,
    carouselIndex,
    rawMediaItem: item,
    dashManifest: item.video_dash_manifest,
  });
}

/**
 * Normalize query-ID and Media API image, video, and carousel resources.
 * Carousel children inherit the parent owner and code while retaining their
 * own media ID and publication time.
 *
 * @param {unknown} payload
 * @returns {MediaDescriptor[]}
 */
export function normalizeApiMedia(payload) {
  const resource = extractApiResource(payload);
  if (!resource) return [];

  const owner = getMediaOwner(resource);
  const shortcode = optionalString(resource.code) ??
    optionalString(resource.shortcode);

  if (Array.isArray(resource.carousel_media)) {
    return resource.carousel_media.flatMap((item, index) => {
      if (!isRecord(item)) return [];
      const descriptor = normalizeApiItem(item, {
        owner,
        shortcode,
        carouselIndex: index + 1,
      });
      return descriptor ? [descriptor] : [];
    });
  }

  const descriptor = normalizeApiItem(resource, {
    owner,
    shortcode,
    carouselIndex: 1,
  });
  return descriptor ? [descriptor] : [];
}

/**
 * Normalize the `{ type, data }` result currently returned by `getBlobMedia`.
 * Any non-query-hash result follows the query-ID/API path, matching the
 * existing dialog branch.
 *
 * @param {unknown} response
 * @returns {MediaDescriptor[]}
 */
export function normalizeMediaResponse(response) {
  if (!isRecord(response)) return [];
  return response.type === "query_hash"
    ? normalizeLegacyMedia(response.data)
    : normalizeApiMedia(response.data ?? response);
}

export const normalizeQueryHashMedia = normalizeLegacyMedia;
export const normalizeQueryIdMedia = normalizeApiMedia;
