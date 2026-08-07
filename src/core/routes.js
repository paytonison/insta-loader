export const ROUTE_KIND = Object.freeze({
  IGNORED: "ignored",
  FEED: "feed",
  POST: "post",
  PROFILE: "profile",
  STORY: "story",
  HIGHLIGHT: "highlight",
  REEL: "reel",
  REELS: "reels",
  UNSUPPORTED: "unsupported",
});

const USERNAME_PATTERN = /^[0-9A-Za-z._-]+$/;
const REEL_USERNAME_PATTERN = /^[A-Za-z0-9._]+$/;
const SHORTCODE_PATTERN = /^[A-Za-z0-9_-]{5,64}$/;
const RESERVED_REELS_COLLECTIONS = new Set(["audio", "explore", "saved"]);
const IGNORED_PATH_PATTERN =
  /^\/(explore(\/.*)?|challenge\/?.*|direct\/?.*|qr\/?|accounts\/.*|emails\/.*|language\/?.*?|your_activity\/?.*|settings\/help(\/.*)?)$/i;

/**
 * @typedef {Object} InstagramRoute
 * @property {string} kind
 * @property {string} href
 * @property {string} origin
 * @property {string} hostname
 * @property {string} pathname
 * @property {string} search
 * @property {string} hash
 * @property {string|null} username
 * @property {string|null} shortcode
 * @property {string|null} section
 * @property {boolean} isEmbed
 * @property {boolean} playbackEligible
 * @property {boolean} nativeReelsFeed
 * @property {string|null} ignoredReason
 */

/**
 * @param {string|URL|Location} value
 * @param {string|URL} [baseUrl]
 * @return {URL|null}
 */
function toUrl(value, baseUrl = "https://www.instagram.com/") {
  try {
    if (value && typeof value === "object" && "href" in value) {
      return new URL(String(value.href), baseUrl);
    }
    return new URL(String(value), baseUrl);
  } catch (_error) {
    return null;
  }
}

/**
 * Parse exact Reel route segments while rejecting reserved plural
 * collections. This retains the legacy parser's ability to identify a Reel
 * link inside a feed while `getMaximumReelPlaybackRouteShortcode()` applies
 * the stricter standalone-playback rule.
 *
 * @param {string} value
 * @param {boolean} [directOnly]
 * @param {string|URL} [baseUrl]
 * @return {string|null}
 */
export function parseMaximumReelShortcode(
  value,
  directOnly = false,
  baseUrl = "https://www.instagram.com/",
) {
  const url = toUrl(value, baseUrl);
  const base = toUrl(baseUrl, "https://www.instagram.com/");
  if (!url || !base) return null;

  if (
    url.hostname !== base.hostname &&
    url.hostname !== "instagram.com" &&
    !url.hostname.endsWith(".instagram.com")
  ) {
    return null;
  }

  const segments = url.pathname.split("/").filter(Boolean);
  let route = null;
  let shortcode = null;

  if (
    ["reel", "reels"].includes(segments[0]?.toLowerCase()) &&
    (segments.length === 2 ||
      (directOnly &&
        segments.length === 3 &&
        segments[2].toLowerCase() === "embed"))
  ) {
    route = segments[0].toLowerCase();
    shortcode = segments[1];
  } else if (
    segments.length === 3 &&
    REEL_USERNAME_PATTERN.test(segments[0]) &&
    ["reel", "reels"].includes(segments[1]?.toLowerCase())
  ) {
    route = segments[1].toLowerCase();
    shortcode = segments[2];
  }

  if (!route || !shortcode) return null;
  if (
    route === "reels" &&
    RESERVED_REELS_COLLECTIONS.has(shortcode.toLowerCase())
  ) {
    return null;
  }
  return SHORTCODE_PATTERN.test(shortcode) ? shortcode : null;
}

/**
 * Return a shortcode only for stable singular `/reel/` routes. Plural
 * `/reels/` routes deliberately return null because Instagram recycles their
 * native players.
 *
 * @param {string} value
 * @param {string|URL} [baseUrl]
 * @return {string|null}
 */
export function getMaximumReelPlaybackRouteShortcode(
  value,
  baseUrl = "https://www.instagram.com/",
) {
  const shortcode = parseMaximumReelShortcode(value, true, baseUrl);
  if (!shortcode) return null;

  const url = toUrl(value, baseUrl);
  if (!url) return null;

  const segments = url.pathname.split("/").filter(Boolean);
  const directStandalone =
    segments[0]?.toLowerCase() === "reel" &&
    (segments.length === 2 ||
      (segments.length === 3 && segments[2].toLowerCase() === "embed"));
  const usernameStandalone =
    segments.length === 3 &&
    REEL_USERNAME_PATTERN.test(segments[0]) &&
    segments[1]?.toLowerCase() === "reel";

  return directStandalone || usernameStandalone ? shortcode : null;
}

/**
 * The native-only plural-feed predicate intentionally mirrors the live
 * playback guard, including username-qualified `/reels/` paths.
 *
 * @param {string} value
 * @param {string|URL} [baseUrl]
 * @return {boolean}
 */
export function isMaximumReelFeedRoute(
  value,
  baseUrl = "https://www.instagram.com/",
) {
  const url = toUrl(value, baseUrl);
  if (!url) return false;

  const segments = url.pathname.split("/").filter(Boolean);
  return (
    segments[0]?.toLowerCase() === "reels" ||
    (segments.length >= 2 &&
      REEL_USERNAME_PATTERN.test(segments[0]) &&
      segments[1]?.toLowerCase() === "reels")
  );
}

/**
 * Classify an Instagram location without reading the DOM. DOM-only blockers
 * used by the legacy timer (the splash screen and followers/following modal)
 * are supplied explicitly so the classifier stays deterministic.
 *
 * @param {string|URL|Location} value
 * @param {{baseUrl?: string|URL, splashVisible?: boolean, followersDialogOpen?: boolean}} [options]
 * @return {InstagramRoute}
 */
export function classifyInstagramRoute(value, options = {}) {
  const url = toUrl(value, options.baseUrl);
  if (!url) {
    return createRoute(null, ROUTE_KIND.IGNORED, {
      ignoredReason: "invalid-url",
      href: String(value || ""),
    });
  }

  const pathname = url.pathname;
  const segments = pathname.split("/").filter(Boolean);
  const nativeReelsFeed = isMaximumReelFeedRoute(url.href, url.origin);

  if (options.splashVisible) {
    return createRoute(url, ROUTE_KIND.IGNORED, {
      ignoredReason: "splash-screen",
      nativeReelsFeed,
    });
  }
  if (!url.hostname.startsWith("www.")) {
    return createRoute(url, ROUTE_KIND.IGNORED, {
      ignoredReason: "unsupported-host",
      nativeReelsFeed,
    });
  }
  if (
    IGNORED_PATH_PATTERN.test(pathname) ||
    pathname.startsWith("/auth_platform/codeentry/") ||
    pathname.startsWith("/challenge/") ||
    pathname.startsWith("/consent/") ||
    pathname.startsWith("/accounts/")
  ) {
    return createRoute(url, ROUTE_KIND.IGNORED, {
      ignoredReason: "ignored-path",
      nativeReelsFeed,
    });
  }
  if (
    options.followersDialogOpen &&
    (pathname.endsWith("/followers/") || pathname.endsWith("/following/"))
  ) {
    return createRoute(url, ROUTE_KIND.IGNORED, {
      ignoredReason: "relationship-dialog",
      nativeReelsFeed,
    });
  }

  if (pathname === "/") {
    return createRoute(url, ROUTE_KIND.FEED);
  }
  if (pathname.startsWith("/stories/highlights/")) {
    return createRoute(url, ROUTE_KIND.HIGHLIGHT, {
      shortcode: segments[2] || null,
    });
  }
  if (pathname.startsWith("/stories/")) {
    return createRoute(url, ROUTE_KIND.STORY, {
      username: segments[1] || null,
      shortcode: segments[2] || null,
    });
  }

  const isDirectPost = segments[0]?.toLowerCase() === "p";
  const isUsernamePost =
    segments.length >= 3 &&
    USERNAME_PATTERN.test(segments[0]) &&
    segments[1]?.toLowerCase() === "p";
  if (isDirectPost || isUsernamePost) {
    const shortcode = isDirectPost ? segments[1] : segments[2];
    const embedSegment = isDirectPost ? segments[2] : segments[3];
    return createRoute(url, ROUTE_KIND.POST, {
      username: isUsernamePost ? segments[0] : null,
      shortcode: shortcode || null,
      isEmbed: embedSegment?.toLowerCase() === "embed",
      nativeReelsFeed,
    });
  }

  const reelShortcode = getMaximumReelPlaybackRouteShortcode(url.href, url.origin);
  if (reelShortcode) {
    const username =
      segments[1]?.toLowerCase() === "reel" ? segments[0] : null;
    return createRoute(url, ROUTE_KIND.REEL, {
      username,
      shortcode: reelShortcode,
      isEmbed: segments.at(-1)?.toLowerCase() === "embed",
      playbackEligible: true,
      nativeReelsFeed,
    });
  }

  if (segments[0]?.toLowerCase() === "reels") {
    return createRoute(url, ROUTE_KIND.REELS, {
      shortcode: parseMaximumReelShortcode(url.href, false, url.origin),
      section: segments[1]?.toLowerCase() || null,
      nativeReelsFeed: true,
    });
  }

  const profileMatch = pathname.match(
    /^\/([0-9A-Za-z._-]+)\/?(tagged|reels|saved)?\/?$/i,
  );
  if (profileMatch) {
    return createRoute(url, ROUTE_KIND.PROFILE, {
      username: profileMatch[1],
      section: profileMatch[2]?.toLowerCase() || null,
      nativeReelsFeed,
    });
  }

  if (nativeReelsFeed) {
    return createRoute(url, ROUTE_KIND.UNSUPPORTED, {
      username: segments[0] || null,
      shortcode: parseMaximumReelShortcode(url.href, false, url.origin),
      section: segments[2]?.toLowerCase() || null,
      nativeReelsFeed: true,
    });
  }

  return createRoute(url, ROUTE_KIND.UNSUPPORTED);
}

/**
 * @param {URL|null} url
 * @param {string} kind
 * @param {Partial<InstagramRoute> & {href?: string}} [values]
 * @return {InstagramRoute}
 */
function createRoute(url, kind, values = {}) {
  return Object.freeze({
    kind,
    href: values.href ?? url?.href ?? "",
    origin: url?.origin || "",
    hostname: url?.hostname || "",
    pathname: url?.pathname || "",
    search: url?.search || "",
    hash: url?.hash || "",
    username: values.username ?? null,
    shortcode: values.shortcode ?? null,
    section: values.section ?? null,
    isEmbed: values.isEmbed ?? false,
    playbackEligible: values.playbackEligible ?? false,
    nativeReelsFeed: values.nativeReelsFeed ?? false,
    ignoredReason: values.ignoredReason ?? null,
  });
}
