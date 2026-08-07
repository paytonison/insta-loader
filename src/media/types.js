/**
 * @typedef {"image" | "video"} MediaKind
 */

/**
 * @typedef {"jpg" | "mp4"} MediaExtension
 */

/**
 * @typedef {"download" | "preview" | "thumbnail"} MediaIntent
 */

/**
 * Normalized media data used by rendering and media actions.
 *
 * `carouselIndex` is one-based because the existing DOM contract exposes the
 * same value through `data-globalIndex`.
 *
 * @typedef {object} MediaDescriptor
 * @property {string | number} mediaId
 * @property {string} directUrl
 * @property {string | null} thumbnailUrl
 * @property {MediaKind} kind
 * @property {MediaExtension} extension
 * @property {string | null} owner
 * @property {string | null} shortcode
 * @property {string | number | null} publishTime
 * @property {number} carouselIndex
 * @property {Record<string, any>} rawMediaItem
 * @property {string | null} dashManifest
 * @property {"data-ih-locale" | "data-ih-locale-title"} [labelTranslationAttribute]
 * @property {string} [sourceType]
 */

/**
 * @typedef {object} MaximumProgressiveCandidate
 * @property {number} area
 * @property {number} bandwidth
 * @property {number} height
 * @property {number} index
 * @property {number} shortSide
 * @property {string} url
 * @property {number} width
 */

export {};
