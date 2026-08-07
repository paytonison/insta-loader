/**
 * Preserve the image-resource filters used by the existing PerformanceObserver.
 *
 * @param {unknown} url
 * @returns {boolean}
 */
export function isCacheableImageResourceUrl(url) {
  if (typeof url !== "string") return false;

  return (
    (url.includes("_e35") ||
      url.includes("_e15") ||
      url.includes(".webp?")) &&
    !url.includes("_e35_s") &&
    !/_[sp](\d+)x\1(?!\d)/.test(url)
  );
}

/**
 * @param {unknown} entry
 * @returns {boolean}
 */
export function isCacheableImagePerformanceEntry(entry) {
  return (
    entry?.initiatorType === "img" &&
    isCacheableImageResourceUrl(entry.name)
  );
}

/**
 * Register resource observation around an ImageCache-compatible service.
 *
 * @param {object} options
 * @param {Function | undefined} options.PerformanceObserver
 * @param {{decodeMediaId: (url: string) => string | null, has: (id: string) => boolean, put: (id: string, url: string) => *}} options.cache
 * @param {() => boolean} options.enabled
 * @param {(error: *) => *} [options.onError]
 * @returns {* | null}
 */
export function registerImageCachePerformanceObserver({
  PerformanceObserver,
  cache,
  enabled,
  onError,
}) {
  if (typeof PerformanceObserver !== "function") return null;
  if (
    Array.isArray(PerformanceObserver.supportedEntryTypes) &&
    !PerformanceObserver.supportedEntryTypes.includes("resource")
  ) {
    return null;
  }

  const observer = new PerformanceObserver((list) => {
    if (!enabled()) return;

    list.getEntries().forEach((entry) => {
      if (!isCacheableImagePerformanceEntry(entry)) return;

      const mediaId = cache.decodeMediaId(entry.name);
      if (mediaId && !cache.has(mediaId)) {
        cache.put(mediaId, entry.name);
      }
    });
  });

  try {
    observer.observe({ entryTypes: ["resource"] });
  } catch (error) {
    onError?.(error);
  }
  return observer;
}
