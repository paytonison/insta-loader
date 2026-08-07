import { afterEach, describe, expect, it, vi } from "vitest";

import {
  IMAGE_CACHE_KEY,
  IMAGE_CACHE_MAX_AGE,
  IMAGE_CACHE_MAX_ITEMS,
  IMAGE_CACHE_PERSIST_DELAY,
  ImageCache,
  decodeImageCacheMediaId,
} from "../../../../src/services/image-cache/index.js";

function createCache(initialEntries = {}, overrides = {}) {
  let currentTime = overrides.currentTime ?? 0;
  const getValue = vi.fn(() => initialEntries);
  const setValue = vi.fn();
  const dependencies = {
    getValue,
    setValue,
    now: vi.fn(() => currentTime),
    setTimeout: globalThis.setTimeout,
    clearTimeout: globalThis.clearTimeout,
    decodeBase64: (value) => atob(value),
    ...overrides.dependencies,
  };
  const cache = new ImageCache(dependencies, overrides.options);

  return {
    cache,
    dependencies,
    getValue,
    setValue,
    setCurrentTime(value) {
      currentTime = value;
    },
  };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("ImageCache media ID decoding", () => {
  it("decodes the portion before the ig_cache_key suffix", () => {
    const mediaId = "300000000000000999";
    const encoded = btoa(mediaId);
    const url =
      `https://scontent.example.test/image_e35.jpg?ig_cache_key=${encoded}.3-ccb7`;

    expect(decodeImageCacheMediaId(url, atob)).toBe(mediaId);
  });

  it("returns null for missing, malformed, or undecodable values", () => {
    expect(decodeImageCacheMediaId("not a URL", atob)).toBeNull();
    expect(decodeImageCacheMediaId(
      "https://scontent.example.test/image_e35.jpg",
      atob,
    )).toBeNull();
    expect(decodeImageCacheMediaId(
      "https://scontent.example.test/image_e35.jpg?ig_cache_key=%25%25%25",
      atob,
    )).toBeNull();
  });
});

describe("ImageCache expiry and storage", () => {
  it("loads the exact storage key and retains the stored object identity", () => {
    const initialEntries = {
      "media-1": { url: "https://cdn.test/one.jpg", ts: 1 },
    };
    const { cache, getValue } = createCache(initialEntries);

    expect(IMAGE_CACHE_KEY).toBe("URLS_OF_IMAGES_TEMPORARILY_STORED");
    expect(getValue).toHaveBeenCalledWith(
      "URLS_OF_IMAGES_TEMPORARILY_STORED",
      {},
    );
    expect(cache.entries).toBe(initialEntries);
  });

  it("keeps an entry at exactly 12 hours and lazily deletes it one millisecond later", () => {
    const entries = {
      boundary: { url: "https://cdn.test/boundary.jpg", ts: 0 },
    };
    const { cache, setValue, setCurrentTime } = createCache(entries);

    setCurrentTime(IMAGE_CACHE_MAX_AGE);
    expect(cache.get("boundary")).toBe(
      "https://cdn.test/boundary.jpg",
    );

    setCurrentTime(IMAGE_CACHE_MAX_AGE + 1);
    expect(cache.get("boundary")).toBeNull();
    expect(entries).not.toHaveProperty("boundary");
    expect(setValue).not.toHaveBeenCalled();
  });

  it("purges only strictly expired entries and always persists immediately", () => {
    const entries = {
      expired: { url: "https://cdn.test/expired.jpg", ts: 0 },
      boundary: { url: "https://cdn.test/boundary.jpg", ts: 1 },
    };
    const { cache, setValue } = createCache(entries, {
      currentTime: IMAGE_CACHE_MAX_AGE + 1,
    });

    expect(cache.purge()).toBe(1);
    expect(entries).toEqual({
      boundary: { url: "https://cdn.test/boundary.jpg", ts: 1 },
    });
    expect(setValue).toHaveBeenCalledOnce();
    expect(setValue).toHaveBeenCalledWith(IMAGE_CACHE_KEY, entries);
  });

  it("evicts the oldest entry before inserting item 301", () => {
    const entries = Object.fromEntries(
      Array.from({ length: IMAGE_CACHE_MAX_ITEMS }, (_value, index) => [
        `media-${index}`,
        { url: `https://cdn.test/${index}.jpg`, ts: index },
      ]),
    );
    const { cache } = createCache(entries, { currentTime: 10_000 });

    expect(cache.put("media-new", "https://cdn.test/new.jpg")).toBe(true);
    expect(Object.keys(entries)).toHaveLength(IMAGE_CACHE_MAX_ITEMS);
    expect(entries).not.toHaveProperty("media-0");
    expect(entries["media-new"]).toEqual({
      url: "https://cdn.test/new.jpg",
      ts: 10_000,
    });
  });

  it("preserves eviction-before-assignment when updating at capacity", () => {
    const entries = Object.fromEntries(
      Array.from({ length: IMAGE_CACHE_MAX_ITEMS }, (_value, index) => [
        `media-${index}`,
        { url: `https://cdn.test/${index}.jpg`, ts: index },
      ]),
    );
    const { cache } = createCache(entries, { currentTime: 20_000 });

    cache.put("media-299", "https://cdn.test/updated.jpg");

    expect(Object.keys(entries)).toHaveLength(IMAGE_CACHE_MAX_ITEMS - 1);
    expect(entries).not.toHaveProperty("media-0");
    expect(entries["media-299"]).toEqual({
      url: "https://cdn.test/updated.jpg",
      ts: 20_000,
    });
  });

  it("coalesces writes into one persistence call after 500ms", async () => {
    vi.useFakeTimers();
    const entries = {};
    const { cache, setValue, setCurrentTime } = createCache(entries);

    cache.put("media-1", "https://cdn.test/one.jpg");
    await vi.advanceTimersByTimeAsync(250);
    setCurrentTime(250);
    cache.put("media-2", "https://cdn.test/two.jpg");
    await vi.advanceTimersByTimeAsync(IMAGE_CACHE_PERSIST_DELAY - 251);
    expect(setValue).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    expect(setValue).toHaveBeenCalledOnce();
    expect(setValue).toHaveBeenCalledWith(IMAGE_CACHE_KEY, entries);
    expect(entries).toEqual({
      "media-1": { url: "https://cdn.test/one.jpg", ts: 0 },
      "media-2": { url: "https://cdn.test/two.jpg", ts: 250 },
    });
  });

  it("ignores empty IDs without scheduling persistence", async () => {
    vi.useFakeTimers();
    const { cache, setValue } = createCache({});

    expect(cache.put("", "https://cdn.test/image.jpg")).toBe(false);
    await vi.runAllTimersAsync();
    expect(setValue).not.toHaveBeenCalled();
  });
});
