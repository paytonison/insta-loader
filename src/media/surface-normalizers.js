/** @typedef {import("./types.js").MediaDescriptor} MediaDescriptor */

export const MEDIA_SURFACE = Object.freeze({
  AVATAR: "avatar",
  HIGHLIGHT: "highlights",
  REEL: "reels",
  STORY: "stories",
});

export const STORY_IMAGE_CANDIDATE = Object.freeze({
  DISPLAY_URL: "display-url",
  LAST: "last",
  WIDEST: "widest",
});

export const STORY_VIDEO_CANDIDATE = Object.freeze({
  FIRST: "first",
  LAST: "last",
});

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
 * @param {unknown} value
 * @returns {string | number | null}
 */
function optionalIdentity(value) {
  if (typeof value === "string" && value.length > 0) return value;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return null;
}

/**
 * @param {unknown} value
 * @returns {string | number | null}
 */
function optionalPublishTime(value) {
  return optionalIdentity(value);
}

/**
 * @param {Record<string, any>} resource
 * @returns {string | null}
 */
function getOwner(resource) {
  return optionalString(resource?.owner?.username) ??
    optionalString(resource?.user?.username);
}

/**
 * @param {Object} fields
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
 * @param {string} fields.sourceType
 * @returns {MediaDescriptor | null}
 */
function createSurfaceDescriptor({
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
  sourceType,
}) {
  const normalizedMediaId = optionalIdentity(mediaId);
  const normalizedDirectUrl = optionalString(directUrl);
  if (normalizedMediaId === null || normalizedDirectUrl === null) return null;

  return {
    mediaId: normalizedMediaId,
    directUrl: normalizedDirectUrl,
    thumbnailUrl: optionalString(thumbnailUrl),
    kind,
    extension: kind === "video" ? "mp4" : "jpg",
    owner: optionalString(owner),
    shortcode: optionalString(shortcode),
    publishTime: optionalPublishTime(publishTime),
    carouselIndex,
    rawMediaItem,
    dashManifest: optionalString(dashManifest),
    sourceType,
  };
}

/**
 * @param {unknown} payload
 * @returns {Record<string, any> | null}
 */
function extractProfileUser(payload) {
  if (!isRecord(payload)) return null;

  const user = payload?.data?.user ?? payload.user ?? payload.data ?? payload;
  return isRecord(user) ? user : null;
}

/**
 * @param {unknown} payload
 * @returns {string | null}
 */
function extractHighResolutionProfileUrl(payload) {
  if (typeof payload === "string") return optionalString(payload);

  const user = extractProfileUser(payload);
  return optionalString(user?.hd_profile_pic_url_info?.url) ??
    optionalString(user?.profile_pic_url_hd);
}

/**
 * Normalize the two profile responses used by the avatar downloader. The
 * separately requested high-resolution URL wins; the web-profile HD and
 * ordinary profile URL retain their established fallback order.
 *
 * @param {unknown} payload Web-profile response or extracted user.
 * @param {Object} [options]
 * @param {unknown} [options.highResolutionPayload]
 * @param {string | null} [options.owner]
 * @param {string | number | null} [options.publishTime]
 * @returns {MediaDescriptor[]}
 */
export function normalizeProfileAvatar(
  payload,
  {
    highResolutionPayload = null,
    owner = null,
    publishTime = null,
  } = {},
) {
  const user = extractProfileUser(payload);
  if (!user) return [];

  const directUrl = extractHighResolutionProfileUrl(highResolutionPayload) ??
    optionalString(user?.hd_profile_pic_url_info?.url) ??
    optionalString(user?.profile_pic_url_hd) ??
    optionalString(user?.profile_pic_url);
  const thumbnailUrl = optionalString(user?.profile_pic_url) ?? directUrl;
  const descriptor = createSurfaceDescriptor({
    mediaId: user.pk ?? user.id,
    directUrl,
    thumbnailUrl,
    kind: "image",
    owner: owner ?? user.username,
    shortcode: null,
    publishTime,
    carouselIndex: 1,
    rawMediaItem: user,
    dashManifest: null,
    sourceType: MEDIA_SURFACE.AVATAR,
  });

  return descriptor ? [descriptor] : [];
}

/**
 * @param {unknown} payload
 * @returns {Record<string, any> | null}
 */
export function extractStoryReel(payload) {
  if (!isRecord(payload)) return null;

  const reelsMedia = payload?.data?.reels_media ?? payload.reels_media;
  if (Array.isArray(reelsMedia) && isRecord(reelsMedia[0])) {
    return reelsMedia[0];
  }

  const roots = [payload, payload.data, payload?.data?.data].filter(isRecord);
  for (const root of roots) {
    const connection = root.xdt_api__v1__feed__reels_media__connection;
    const node = connection?.edges?.[0]?.node;
    if (isRecord(node) && Array.isArray(node.items)) return node;
  }

  return Array.isArray(payload.items) ? payload : null;
}

/**
 * Instagram's current XDT Story records use `media_type` and
 * `video_versions`; the legacy GraphQL records use `is_video` and
 * `video_resources`. Keep the compatibility rule in one place.
 *
 * @param {unknown} item
 * @returns {boolean}
 */
export function isStoryVideoItem(item) {
  if (!isRecord(item)) return false;
  return (
    item.is_video === true ||
    Number(item.media_type) === 2 ||
    (Array.isArray(item.video_resources) && item.video_resources.length > 0) ||
    (Array.isArray(item.video_versions) && item.video_versions.length > 0)
  );
}

/**
 * @param {ReadonlyArray<Record<string, any>> | null | undefined} resources
 * @returns {Record<string, any> | null}
 */
export function selectLargestStoryDisplayResource(resources) {
  if (!Array.isArray(resources) || resources.length === 0) return null;

  return [...resources].sort((left, right) => {
    const leftWidth = Number(left?.config_width ?? left?.width) || 0;
    const rightWidth = Number(right?.config_width ?? right?.width) || 0;
    if (leftWidth < rightWidth) return 1;
    if (leftWidth > rightWidth) return -1;
    return 0;
  })[0];
}

/** @param {Record<string, any> | null | undefined} resource */
function getStoryResourceUrl(resource) {
  return optionalString(resource?.src) ?? optionalString(resource?.url);
}

/**
 * @param {Record<string, any>} item
 * @param {"display-url" | "last" | "widest"} preference
 * @returns {string | null}
 */
function selectStoryImageUrl(item, preference) {
  const legacyResources = Array.isArray(item.display_resources)
    ? item.display_resources
    : [];
  const currentResources = Array.isArray(item?.image_versions2?.candidates)
    ? item.image_versions2.candidates
    : [];
  const allResources = legacyResources.length
    ? legacyResources
    : currentResources;

  switch (preference) {
    case STORY_IMAGE_CANDIDATE.DISPLAY_URL:
      return optionalString(item.display_url) ??
        getStoryResourceUrl(currentResources[0]) ??
        getStoryResourceUrl(selectLargestStoryDisplayResource(allResources));
    case STORY_IMAGE_CANDIDATE.LAST:
      return legacyResources.length
        ? getStoryResourceUrl(legacyResources.at(-1))
        : getStoryResourceUrl(
            selectLargestStoryDisplayResource(currentResources),
          );
    case STORY_IMAGE_CANDIDATE.WIDEST:
      return getStoryResourceUrl(
        selectLargestStoryDisplayResource(allResources),
      );
    default:
      throw new TypeError(`Unknown Story image candidate: ${preference}`);
  }
}

/**
 * @param {Record<string, any>} item
 * @param {"first" | "last"} preference
 * @returns {string | null}
 */
function selectStoryVideoUrl(item, preference) {
  const legacyResources = Array.isArray(item.video_resources)
    ? item.video_resources
    : [];
  const currentResources = Array.isArray(item.video_versions)
    ? item.video_versions
    : [];

  switch (preference) {
    case STORY_VIDEO_CANDIDATE.FIRST:
      return getStoryResourceUrl(legacyResources[0]) ??
        getStoryResourceUrl(currentResources[0]);
    case STORY_VIDEO_CANDIDATE.LAST:
      return getStoryResourceUrl(legacyResources.at(-1)) ??
        getStoryResourceUrl(currentResources[0]);
    default:
      throw new TypeError(`Unknown Story video candidate: ${preference}`);
  }
}

/**
 * Normalize a Story or Highlight response using the existing batch-download
 * candidate policy: widest display resource and first video resource. Item
 * positions stay one-based even if a malformed item is omitted.
 *
 * @param {unknown} payload
 * @param {Object} options
 * @param {"stories" | "highlights"} options.surface
 * @param {boolean} [options.renamePublishDate=false]
 * @param {number} options.nowSeconds
 * @param {"display-url" | "last" | "widest"} [options.imageCandidate="widest"]
 * @param {"first" | "last"} [options.videoCandidate="first"]
 * @returns {MediaDescriptor[]}
 */
export function normalizeStorySurfaceMedia(
  payload,
  {
    surface,
    renamePublishDate = false,
    nowSeconds,
    imageCandidate = STORY_IMAGE_CANDIDATE.WIDEST,
    videoCandidate = STORY_VIDEO_CANDIDATE.FIRST,
  },
) {
  if (
    surface !== MEDIA_SURFACE.STORY &&
    surface !== MEDIA_SURFACE.HIGHLIGHT
  ) {
    throw new TypeError(`Unknown Story surface: ${surface}`);
  }
  if (!Number.isFinite(nowSeconds)) {
    throw new TypeError("nowSeconds must be a finite number.");
  }

  const reel = extractStoryReel(payload);
  if (!reel) return [];

  const items = Array.isArray(reel.items) ? reel.items : [];
  const owner = optionalString(reel?.user?.username) ??
    optionalString(reel?.owner?.username);

  return items.flatMap((item, index) => {
    if (!isRecord(item)) return [];

    const isVideo = isStoryVideoItem(item);
    const imageUrl = selectStoryImageUrl(item, imageCandidate);
    const descriptor = createSurfaceDescriptor({
      mediaId: item.pk ?? item.id,
      directUrl: isVideo
        ? selectStoryVideoUrl(item, videoCandidate)
        : imageUrl,
      thumbnailUrl: imageUrl,
      kind: isVideo ? "video" : "image",
      owner: owner ?? getOwner(item),
      shortcode: item.code ?? item.id ?? item.pk,
      publishTime: renamePublishDate
        ? item.taken_at_timestamp ?? item.taken_at ?? nowSeconds
        : nowSeconds,
      carouselIndex: index + 1,
      rawMediaItem: item,
      dashManifest: item.video_dash_manifest,
      sourceType: surface,
    });

    return descriptor ? [descriptor] : [];
  });
}

/**
 * @param {unknown} payload
 * @param {Omit<Parameters<typeof normalizeStorySurfaceMedia>[1], "surface">} options
 * @returns {MediaDescriptor[]}
 */
export function normalizeStoryMedia(payload, options) {
  return normalizeStorySurfaceMedia(payload, {
    imageCandidate: STORY_IMAGE_CANDIDATE.WIDEST,
    videoCandidate: STORY_VIDEO_CANDIDATE.FIRST,
    ...options,
    surface: MEDIA_SURFACE.STORY,
  });
}

/**
 * Highlight's direct legacy fallback consumes the last image and video
 * resources, unlike the shared batch renderer's widest/first policy. Keep
 * that distinction explicit so either consumer can migrate without drift.
 *
 * @param {unknown} payload
 * @param {Omit<Parameters<typeof normalizeStorySurfaceMedia>[1], "surface">} options
 * @returns {MediaDescriptor[]}
 */
export function normalizeHighlightMedia(payload, options) {
  return normalizeStorySurfaceMedia(payload, {
    imageCandidate: STORY_IMAGE_CANDIDATE.LAST,
    videoCandidate: STORY_VIDEO_CANDIDATE.LAST,
    ...options,
    surface: MEDIA_SURFACE.HIGHLIGHT,
  });
}

/**
 * @param {unknown} response
 * @returns {"query_hash" | "query_id"}
 */
function getReelResponseType(response) {
  if (isRecord(response) && response.type === "query_hash") {
    return "query_hash";
  }
  if (isRecord(response) && response.type === "query_id") {
    return "query_id";
  }

  const payload = isRecord(response?.data) ? response.data : response;
  if (
    isRecord(payload?.shortcode_media) ||
    payload?.__typename === "GraphVideo" ||
    payload?.__typename === "GraphImage"
  ) {
    return "query_hash";
  }
  return "query_id";
}

/**
 * @param {unknown} response
 * @param {"query_hash" | "query_id"} responseType
 * @returns {Record<string, any>[]}
 */
function extractReelItems(response, responseType) {
  if (!isRecord(response)) return [];

  const envelope = isRecord(response.data) ? response.data : response;
  const payload = isRecord(envelope.data) ? envelope.data : envelope;

  if (responseType === "query_hash") {
    const resource = isRecord(payload.shortcode_media)
      ? payload.shortcode_media
      : payload;
    return isRecord(resource) ? [resource] : [];
  }

  const xigMedia = payload.xig_polaris_media ?? envelope.xig_polaris_media;
  if (isRecord(xigMedia)) {
    const resource = xigMedia.if_not_gated_logged_out ??
      xigMedia.if_not_gated ??
      xigMedia;
    return isRecord(resource) ? [resource] : [];
  }

  const xdtItems = payload?.xdt_api__v1__media__shortcode__web_info?.items;
  if (Array.isArray(xdtItems)) return xdtItems.filter(isRecord);
  if (Array.isArray(payload.items)) return payload.items.filter(isRecord);
  return isRecord(payload) ? [payload] : [];
}

/**
 * Normalize Reel download metadata without using the maximum-quality playback
 * ranking policy. The first API video version and first API image candidate
 * remain authoritative; legacy query-hash images retain the last display
 * resource. Passing `isVideo: false` deliberately produces the poster image
 * used by the existing Reel thumbnail action.
 *
 * @param {unknown} response
 * @param {Object} [options]
 * @param {boolean | null} [options.isVideo=null]
 * @param {string | null} [options.shortcode=null]
 * @returns {MediaDescriptor[]}
 */
export function normalizeReelMedia(
  response,
  { isVideo = null, shortcode = null } = {},
) {
  const responseType = getReelResponseType(response);
  const items = extractReelItems(response, responseType);

  return items.flatMap((item, index) => {
    const imageCandidates = Array.isArray(item?.image_versions2?.candidates)
      ? item.image_versions2.candidates
      : [];
    const displayResources = Array.isArray(item.display_resources)
      ? item.display_resources
      : [];
    const thumbnailUrl = responseType === "query_hash"
      ? optionalString(displayResources.at(-1)?.src)
      : optionalString(imageCandidates[0]?.url) ??
        optionalString(displayResources.at(-1)?.src);
    const resourceIsVideo = responseType === "query_hash"
      ? item.is_video === true
      : Number(item.media_type) === 2 ||
        (Array.isArray(item.video_versions) && item.video_versions.length > 0) ||
        optionalString(item.video_url) !== null;
    const useVideo = typeof isVideo === "boolean"
      ? isVideo && resourceIsVideo
      : resourceIsVideo;
    const directUrl = useVideo
      ? responseType === "query_hash"
        ? item.video_url
        : item?.video_versions?.[0]?.url ?? item.video_url
      : thumbnailUrl;
    const descriptor = createSurfaceDescriptor({
      mediaId: item.pk ?? item.id,
      directUrl,
      thumbnailUrl,
      kind: useVideo ? "video" : "image",
      owner: getOwner(item),
      shortcode: shortcode ?? item.code ?? item.shortcode,
      publishTime: responseType === "query_hash"
        ? item.taken_at_timestamp
        : item.taken_at ?? item.taken_at_timestamp,
      carouselIndex: index + 1,
      rawMediaItem: item,
      dashManifest: item.video_dash_manifest,
      sourceType: MEDIA_SURFACE.REEL,
    });

    return descriptor ? [descriptor] : [];
  });
}
