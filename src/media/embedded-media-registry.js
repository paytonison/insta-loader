const DEFAULT_MAX_SCRIPT_CHARACTERS = 2_000_000;
const DEFAULT_MAX_TRAVERSED_NODES = 120_000;
const DEFAULT_MAX_DEPTH = 40;
const DEFAULT_MAX_ENTRIES = 512;

/** @param {unknown} value @return {value is Record<string, any>} */
function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** @param {unknown} value @return {string|null} */
function identity(value) {
  if (typeof value === "string" && value.length > 0) return value;
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return null;
}

/** @param {unknown} value @return {string|null} */
function usernameKey(value) {
  const normalized = identity(value)?.trim().toLowerCase();
  return normalized || null;
}

/** @param {unknown} value @return {string|null} */
function highlightKey(value) {
  const normalized = identity(value)?.trim().replace(/^highlight:/i, "");
  return normalized || null;
}

/** @param {unknown} value @return {Record<string, any>|null} */
function unwrapXigMedia(value) {
  if (!isRecord(value)) return null;
  const item = value.if_not_gated_logged_out ?? value.if_not_gated ?? value;
  return isRecord(item) ? item : null;
}

/** @param {unknown} value @return {boolean} */
function looksLikeStoryItem(value) {
  if (!isRecord(value)) return false;
  return (
    value.id != null ||
    value.pk != null
  ) && (
    value.taken_at != null ||
    value.taken_at_timestamp != null ||
    value.media_type != null ||
    value.is_video != null
  ) && (
    Array.isArray(value.video_versions) ||
    Array.isArray(value.video_resources) ||
    Array.isArray(value?.image_versions2?.candidates) ||
    Array.isArray(value.display_resources) ||
    typeof value.display_url === "string"
  );
}

/** @param {unknown} value @return {value is Record<string, any>} */
function looksLikeStoryReel(value) {
  return isRecord(value) &&
    Array.isArray(value.items) &&
    value.items.some(looksLikeStoryItem);
}

/**
 * Retain only the media records that Instagram already delivered in
 * `script[type="application/json"]`. Traversal and storage are capped so a
 * malformed or unexpectedly large bootstrap payload cannot monopolize the
 * userscript.
 */
export class EmbeddedMediaRegistry {
  constructor(options = {}) {
    this.maxScriptCharacters =
      options.maxScriptCharacters ?? DEFAULT_MAX_SCRIPT_CHARACTERS;
    this.maxTraversedNodes =
      options.maxTraversedNodes ?? DEFAULT_MAX_TRAVERSED_NODES;
    this.maxDepth = options.maxDepth ?? DEFAULT_MAX_DEPTH;
    this.maxEntries = options.maxEntries ?? DEFAULT_MAX_ENTRIES;
    this.scannedScripts = new WeakSet();
    this.reelsByShortcode = new Map();
    this.storyReelsByIdentity = new Map();
  }

  /**
   * @param {Document|Element} root
   * @param {{highlightId?: unknown, username?: unknown, userId?: unknown}} [hints]
   * @return {{parseFailures: number, reelItems: number, scripts: number, storyReels: number, truncatedScripts: number}}
   */
  scan(root, hints = {}) {
    const result = {
      parseFailures: 0,
      reelItems: 0,
      scripts: 0,
      storyReels: 0,
      truncatedScripts: 0,
    };
    if (!root || typeof root.querySelectorAll !== "function") return result;
    const hintedStoryCandidates = new Set();

    const scripts = [];
    if (root.matches?.('script[type="application/json"]')) scripts.push(root);
    root.querySelectorAll('script[type="application/json"]').forEach((script) =>
      scripts.push(script)
    );

    for (const script of scripts) {
      if (this.scannedScripts.has(script)) continue;
      this.scannedScripts.add(script);
      const source = script.textContent || "";
      if (!source.trim()) continue;
      if (source.length > this.maxScriptCharacters) {
        result.truncatedScripts += 1;
        continue;
      }

      let payload;
      try {
        payload = JSON.parse(source);
      } catch (_error) {
        result.parseFailures += 1;
        continue;
      }

      result.scripts += 1;
      const indexed = this.indexPayload(payload);
      result.reelItems += indexed.reelItems;
      result.storyReels += indexed.storyReels;
      result.truncatedScripts += indexed.truncated ? 1 : 0;
      indexed.storyCandidates.forEach((reel) =>
        hintedStoryCandidates.add(reel)
      );
    }

    if (hintedStoryCandidates.size === 1) {
      this.registerStoryHints([...hintedStoryCandidates][0], hints);
    }

    return result;
  }

  /** @param {unknown} shortcode @return {Record<string, any>|null} */
  getReel(shortcode) {
    const key = identity(shortcode);
    return key ? this.reelsByShortcode.get(key) ?? null : null;
  }

  /**
   * @param {{highlightId?: unknown, username?: unknown, userId?: unknown}} identityHints
   * @return {Record<string, any>|null}
   */
  getStory(identityHints = {}) {
    const keys = [
      highlightKey(identityHints.highlightId)
        ? `highlight:${highlightKey(identityHints.highlightId)}`
        : null,
      usernameKey(identityHints.username)
        ? `username:${usernameKey(identityHints.username)}`
        : null,
      identity(identityHints.userId)
        ? `user:${identity(identityHints.userId)}`
        : null,
    ].filter(Boolean);

    for (const key of keys) {
      const reel = this.storyReelsByIdentity.get(key);
      if (reel) {
        return { status: "ok", data: { reels_media: [reel] } };
      }
    }
    return null;
  }

  clear() {
    this.scannedScripts = new WeakSet();
    this.reelsByShortcode.clear();
    this.storyReelsByIdentity.clear();
  }

  /**
   * @param {unknown} payload
   * @return {{reelItems: number, storyCandidates: Set<Record<string, any>>, storyReels: number, truncated: boolean}}
   */
  indexPayload(payload) {
    const stack = [{ depth: 0, value: payload }];
    const visited = new WeakSet();
    const storyCandidates = new Set();
    let traversed = 0;
    let reelItems = 0;

    while (stack.length > 0 && traversed < this.maxTraversedNodes) {
      const { depth, value } = stack.pop();
      if (value === null || typeof value !== "object") continue;
      if (visited.has(value)) continue;
      visited.add(value);
      traversed += 1;

      if (isRecord(value)) {
        const xigItem = unwrapXigMedia(value.xig_polaris_media);
        if (xigItem && this.registerReel(xigItem)) reelItems += 1;

        const xdtItems =
          value.xdt_api__v1__media__shortcode__web_info?.items;
        if (Array.isArray(xdtItems)) {
          for (const item of xdtItems) {
            if (this.registerReel(item)) reelItems += 1;
          }
        }

        const connection =
          value.xdt_api__v1__feed__reels_media__connection;
        if (isRecord(connection) && Array.isArray(connection.edges)) {
          for (const edge of connection.edges) {
            if (looksLikeStoryReel(edge?.node)) {
              storyCandidates.add(edge.node);
            }
          }
        }

        if (Array.isArray(value.reels_media)) {
          for (const reel of value.reels_media) {
            if (looksLikeStoryReel(reel)) storyCandidates.add(reel);
          }
        }
      }

      if (depth >= this.maxDepth) continue;
      const children = Array.isArray(value)
        ? value
        : Object.values(value);
      for (let index = children.length - 1; index >= 0; index -= 1) {
        const child = children[index];
        if (child !== null && typeof child === "object") {
          stack.push({ depth: depth + 1, value: child });
        }
      }
    }

    for (const reel of storyCandidates) this.registerStoryReel(reel);
    return {
      reelItems,
      storyCandidates,
      storyReels: storyCandidates.size,
      truncated: stack.length > 0,
    };
  }

  /** @param {unknown} item @return {boolean} */
  registerReel(item) {
    if (!isRecord(item)) return false;
    const shortcode = identity(item.code ?? item.shortcode);
    if (!shortcode) return false;
    this.setBounded(this.reelsByShortcode, shortcode, item);
    return true;
  }

  /** @param {Record<string, any>} reel */
  registerStoryReel(reel) {
    const rawId = identity(reel.id ?? reel.pk);
    if (rawId?.toLowerCase().startsWith("highlight:")) {
      const normalizedHighlightId = highlightKey(rawId);
      if (normalizedHighlightId) {
        this.setBounded(
          this.storyReelsByIdentity,
          `highlight:${normalizedHighlightId}`,
          reel,
        );
      }
    }
    if (rawId) {
      this.setBounded(
        this.storyReelsByIdentity,
        `user:${rawId}`,
        reel,
      );
    }

    const owners = [
      reel.user,
      reel.owner,
      reel.items?.[0]?.user,
      reel.items?.[0]?.owner,
    ].filter(isRecord);
    for (const owner of owners) {
      const username = usernameKey(owner.username);
      const userId = identity(owner.pk ?? owner.id);
      if (username) {
        this.setBounded(
          this.storyReelsByIdentity,
          `username:${username}`,
          reel,
        );
      }
      if (userId) {
        this.setBounded(
          this.storyReelsByIdentity,
          `user:${userId}`,
          reel,
        );
      }
    }
  }

  /**
   * @param {Record<string, any>} reel
   * @param {{highlightId?: unknown, username?: unknown, userId?: unknown}} hints
   */
  registerStoryHints(reel, hints) {
    const normalizedHighlightId = highlightKey(hints.highlightId);
    const normalizedUsername = usernameKey(hints.username);
    const normalizedUserId = identity(hints.userId);
    if (normalizedHighlightId) {
      this.setBounded(
        this.storyReelsByIdentity,
        `highlight:${normalizedHighlightId}`,
        reel,
      );
    }
    if (normalizedUsername) {
      this.setBounded(
        this.storyReelsByIdentity,
        `username:${normalizedUsername}`,
        reel,
      );
    }
    if (normalizedUserId) {
      this.setBounded(
        this.storyReelsByIdentity,
        `user:${normalizedUserId}`,
        reel,
      );
    }
  }

  /** @param {Map<any, any>} map @param {any} key @param {any} value */
  setBounded(map, key, value) {
    if (map.has(key)) map.delete(key);
    map.set(key, value);
    while (map.size > this.maxEntries) {
      map.delete(map.keys().next().value);
    }
  }
}
