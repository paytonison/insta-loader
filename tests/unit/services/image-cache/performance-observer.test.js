import { describe, expect, it, vi } from "vitest";

import {
  isCacheableImagePerformanceEntry,
  isCacheableImageResourceUrl,
  registerImageCachePerformanceObserver,
} from "../../../../src/services/image-cache/index.js";

describe("image cache resource filtering", () => {
  it.each([
    "https://cdn.test/image_e35.jpg?ig_cache_key=abc",
    "https://cdn.test/image_e15.jpg?ig_cache_key=abc",
    "https://cdn.test/image.webp?ig_cache_key=abc",
  ])("accepts the current full-size marker filter: %s", (url) => {
    expect(isCacheableImageResourceUrl(url)).toBe(true);
  });

  it.each([
    "https://cdn.test/image.jpg?ig_cache_key=abc",
    "https://cdn.test/image_e35_s1080x1080.jpg?ig_cache_key=abc",
    "https://cdn.test/image_e15_s640x640.jpg?ig_cache_key=abc",
    "https://cdn.test/image_e15_p320x320.jpg?ig_cache_key=abc",
  ])("rejects the current transformed or square-size filter: %s", (url) => {
    expect(isCacheableImageResourceUrl(url)).toBe(false);
  });

  it("requires an image-initiated performance entry", () => {
    const url = "https://cdn.test/image_e35.jpg?ig_cache_key=abc";

    expect(isCacheableImagePerformanceEntry({
      initiatorType: "img",
      name: url,
    })).toBe(true);
    expect(isCacheableImagePerformanceEntry({
      initiatorType: "fetch",
      name: url,
    })).toBe(false);
  });
});

function createObserverClass(options = {}) {
  return class FakePerformanceObserver {
    static supportedEntryTypes = options.supportedEntryTypes ?? ["resource"];

    constructor(callback) {
      this.callback = callback;
      this.observe = options.observe || vi.fn();
      options.onConstruct?.(this);
    }
  };
}

describe("image cache PerformanceObserver registration", () => {
  it("does not register when the API or resource entries are unavailable", () => {
    const cache = {};

    expect(registerImageCachePerformanceObserver({
      PerformanceObserver: undefined,
      cache,
      enabled: () => true,
    })).toBeNull();
    expect(registerImageCachePerformanceObserver({
      PerformanceObserver: createObserverClass({
        supportedEntryTypes: ["mark", "measure"],
      }),
      cache,
      enabled: () => true,
    })).toBeNull();
  });

  it("captures only enabled, eligible, decoded, previously unseen images", () => {
    let observer;
    const PerformanceObserver = createObserverClass({
      onConstruct: (value) => { observer = value; },
    });
    const cache = {
      decodeMediaId: vi.fn((url) => {
        return url.includes("one") ? "media-1" : "media-2";
      }),
      has: vi.fn((mediaId) => mediaId === "media-2"),
      put: vi.fn(),
    };
    let enabled = false;

    const result = registerImageCachePerformanceObserver({
      PerformanceObserver,
      cache,
      enabled: () => enabled,
    });

    expect(result).toBe(observer);
    expect(observer.observe).toHaveBeenCalledWith({
      entryTypes: ["resource"],
    });

    const entries = [
      {
        initiatorType: "img",
        name: "https://cdn.test/one_e35.jpg?ig_cache_key=one",
      },
      {
        initiatorType: "img",
        name: "https://cdn.test/two_e15.jpg?ig_cache_key=two",
      },
      {
        initiatorType: "fetch",
        name: "https://cdn.test/three_e35.jpg?ig_cache_key=three",
      },
      {
        initiatorType: "img",
        name: "https://cdn.test/four_e35_s640x640.jpg?ig_cache_key=four",
      },
    ];
    const list = { getEntries: () => entries };

    observer.callback(list);
    expect(cache.decodeMediaId).not.toHaveBeenCalled();

    enabled = true;
    observer.callback(list);
    expect(cache.decodeMediaId).toHaveBeenCalledTimes(2);
    expect(cache.put).toHaveBeenCalledOnce();
    expect(cache.put).toHaveBeenCalledWith("media-1", entries[0].name);
  });

  it("reports observer startup failure without throwing", () => {
    const failure = new Error("observer blocked");
    const onError = vi.fn();
    const PerformanceObserver = createObserverClass({
      observe: vi.fn(() => { throw failure; }),
    });

    expect(() => registerImageCachePerformanceObserver({
      PerformanceObserver,
      cache: {},
      enabled: () => true,
      onError,
    })).not.toThrow();
    expect(onError).toHaveBeenCalledWith(failure);
  });
});
