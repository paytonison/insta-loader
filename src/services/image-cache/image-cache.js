import {
  IMAGE_CACHE_KEY,
  IMAGE_CACHE_MAX_AGE,
  IMAGE_CACHE_MAX_ITEMS,
  IMAGE_CACHE_PERSIST_DELAY,
} from "./constants.js";

/**
 * @typedef {object} ImageCacheDependencies
 * @property {(key: string, defaultValue: object) => object} getValue
 * @property {(key: string, value: object) => *} setValue
 * @property {() => number} now
 * @property {typeof setTimeout} setTimeout
 * @property {typeof clearTimeout} clearTimeout
 * @property {(value: string) => string} decodeBase64
 */

/**
 * @typedef {object} ImageCacheOptions
 * @property {string} [storageKey]
 * @property {number} [maxAge]
 * @property {number} [maxItems]
 * @property {number} [persistDelay]
 */

/**
 * Decode the media ID embedded in Instagram's `ig_cache_key` query value.
 *
 * @param {string} url
 * @param {(value: string) => string} decodeBase64
 * @returns {string | null}
 */
export function decodeImageCacheMediaId(url, decodeBase64) {
  try {
    const parsed = new URL(url);
    const key = parsed.searchParams.get("ig_cache_key");
    if (!key) return null;
    return decodeBase64(key.split(".")[0]);
  } catch (_error) {
    return null;
  }
}

/**
 * Persistent image resource cache retaining the published userscript's exact
 * expiry, capacity, and coalesced-write behavior.
 */
export class ImageCache {
  /**
   * @param {ImageCacheDependencies} dependencies
   * @param {ImageCacheOptions} [options]
   */
  constructor(dependencies, options = {}) {
    if (dependencies === null || typeof dependencies !== "object") {
      throw new TypeError("ImageCache requires injected dependencies.");
    }
    for (const name of [
      "getValue",
      "setValue",
      "now",
      "setTimeout",
      "clearTimeout",
      "decodeBase64",
    ]) {
      if (typeof dependencies[name] !== "function") {
        throw new TypeError(`ImageCache requires ${name}().`);
      }
    }

    this.dependencies = Object.freeze({ ...dependencies });
    this.storageKey = options.storageKey ?? IMAGE_CACHE_KEY;
    this.maxAge = options.maxAge ?? IMAGE_CACHE_MAX_AGE;
    this.maxItems = options.maxItems ?? IMAGE_CACHE_MAX_ITEMS;
    this.persistDelay = options.persistDelay ?? IMAGE_CACHE_PERSIST_DELAY;
    this.entries = dependencies.getValue(this.storageKey, {});
    this._dirty = false;
    this._saveTimer = null;
  }

  /**
   * Decode an Instagram resource URL with this cache's Base64 adapter.
   *
   * @param {string} url
   * @returns {string | null}
   */
  decodeMediaId(url) {
    return decodeImageCacheMediaId(url, this.dependencies.decodeBase64);
  }

  /**
   * Test raw cache membership without applying lazy expiry. Performance
   * capture intentionally uses this behavior to match the legacy guard.
   *
   * @param {string} mediaId
   * @returns {boolean}
   */
  has(mediaId) {
    return Boolean(mediaId && this.entries[mediaId]);
  }

  /**
   * Remove entries strictly older than the twelve-hour boundary and persist
   * the complete object immediately, even when no entry changed.
   *
   * @returns {number}
   */
  purge() {
    const currentTime = this.dependencies.now();
    let removed = 0;

    for (const mediaId in this.entries) {
      if (currentTime - this.entries[mediaId].ts > this.maxAge) {
        delete this.entries[mediaId];
        removed += 1;
      }
    }
    this.dependencies.setValue(this.storageKey, this.entries);
    return removed;
  }

  /**
   * Insert or update one resource. At capacity, the oldest entry is evicted
   * before assignment, including when the incoming ID already exists.
   *
   * @param {string} mediaId
   * @param {string} url
   * @returns {boolean}
   */
  put(mediaId, url) {
    if (!mediaId) return false;

    const keys = Object.keys(this.entries);
    if (keys.length >= this.maxItems) {
      keys.sort((left, right) => {
        return this.entries[left].ts - this.entries[right].ts;
      });
      delete this.entries[keys[0]];
    }

    this._dirty = true;
    this.entries[mediaId] = {
      url,
      ts: this.dependencies.now(),
    };
    this._schedulePersistence();
    return true;
  }

  /**
   * Read an entry and lazily remove it when strictly older than max age. Lazy
   * expiry remains memory-only and does not schedule a storage write.
   *
   * @param {string} mediaId
   * @returns {string | null}
   */
  get(mediaId) {
    if (!mediaId) return null;
    const entry = this.entries[mediaId];
    if (!entry) return null;
    if (this.dependencies.now() - entry.ts > this.maxAge) {
      delete this.entries[mediaId];
      return null;
    }
    return entry.url;
  }

  /**
   * Persist a dirty cache immediately. This is exposed for controlled teardown
   * and tests; ordinary writes continue to use the 500 ms coalescing window.
   *
   * @returns {boolean}
   */
  flush() {
    if (this._saveTimer != null) {
      this.dependencies.clearTimeout(this._saveTimer);
      this._saveTimer = null;
    }
    if (!this._dirty) return false;
    this.dependencies.setValue(this.storageKey, this.entries);
    this._dirty = false;
    return true;
  }

  /** @private */
  _schedulePersistence() {
    if (this._saveTimer != null) return;

    this._saveTimer = this.dependencies.setTimeout(() => {
      if (this._dirty) {
        this.dependencies.setValue(this.storageKey, this.entries);
        this._dirty = false;
      }
      this._saveTimer = null;
    }, this.persistDelay);
  }
}

/**
 * @param {ImageCacheDependencies} dependencies
 * @param {ImageCacheOptions} [options]
 * @returns {ImageCache}
 */
export function createImageCache(dependencies, options) {
  return new ImageCache(dependencies, options);
}
