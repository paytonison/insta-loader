export const CURRENT_ITEM_SOURCE = Object.freeze({
  EXPLICIT_URL: "explicit-url",
  TIMESTAMP: "timestamp",
  PROGRESS: "progress",
  LAYOUT: "layout",
  ROUTE_FALLBACK: "route-fallback",
  UNRESOLVED: "unresolved",
});

/**
 * @typedef {Object} CurrentItemHints
 * @property {string | number | null | undefined} [explicitMediaId]
 * @property {number | null | undefined} [visibleTimestamp]
 * @property {number | null | undefined} [progressIndex]
 * @property {number | null | undefined} [layoutIndex]
 * @property {string | number | null | undefined} [routeMediaId]
 */

/**
 * @typedef {Object} CurrentItemResolution
 * @property {Record<string, any> | null} item
 * @property {string | number | null} mediaId
 * @property {number | null} itemIndex
 * @property {string} source
 */

/**
 * @param {unknown} value
 * @return {string | null}
 */
function normalizeId(value) {
  if (typeof value === "string" && value.length > 0) return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

/**
 * @param {ReadonlyArray<Record<string, any>>} items
 * @param {unknown} mediaId
 * @return {number}
 */
function findItemIndexById(items, mediaId) {
  const normalizedId = normalizeId(mediaId);
  if (normalizedId === null) return -1;

  return items.findIndex((item) =>
    [item?.pk, item?.id].some((candidate) =>
      normalizeId(candidate) === normalizedId
    )
  );
}

/**
 * @param {ReadonlyArray<Record<string, any>>} items
 * @param {number} index
 * @param {string} source
 * @return {CurrentItemResolution | null}
 */
function resolutionAt(items, index, source) {
  if (!Number.isInteger(index) || index < 0 || index >= items.length) {
    return null;
  }

  const item = items[index];
  return {
    item,
    mediaId: item?.pk ?? item?.id ?? null,
    itemIndex: index,
    source,
  };
}

/**
 * Resolve one Story or Highlight item from surface-specific DOM hints.
 *
 * Story callers retain the established identity precedence: an explicit URL
 * ID that matches an API item, the closest timestamp, progress, layout, and
 * finally the route ID even when that ID is absent from the response.
 * Highlight callers use the same resolver with the hints their separate DOM
 * adapter can establish (currently the reverse-progress index).
 *
 * @param {ReadonlyArray<Record<string, any>> | null | undefined} items
 * @param {CurrentItemHints} [hints]
 * @return {CurrentItemResolution}
 */
export function resolveCurrentStoryItem(items, hints = {}) {
  const candidates = Array.isArray(items) ? items : [];
  const explicitIndex = findItemIndexById(candidates, hints.explicitMediaId);
  const explicit = resolutionAt(
    candidates,
    explicitIndex,
    CURRENT_ITEM_SOURCE.EXPLICIT_URL,
  );
  if (explicit) return explicit;

  if (
    candidates.length > 0 &&
    Number.isFinite(hints.visibleTimestamp) &&
    hints.visibleTimestamp !== 0
  ) {
    let bestIndex = 0;
    let minimumDifference = Infinity;

    candidates.forEach((item, index) => {
      const difference = Math.abs(
        (Number(item?.taken_at_timestamp ?? item?.taken_at) || 0) -
          hints.visibleTimestamp,
      );
      if (difference < minimumDifference) {
        minimumDifference = difference;
        bestIndex = index;
      }
    });

    const timestamp = resolutionAt(
      candidates,
      bestIndex,
      CURRENT_ITEM_SOURCE.TIMESTAMP,
    );
    if (timestamp) return timestamp;
  }

  const progress = resolutionAt(
    candidates,
    hints.progressIndex,
    CURRENT_ITEM_SOURCE.PROGRESS,
  );
  if (progress) return progress;

  const layout = resolutionAt(
    candidates,
    hints.layoutIndex,
    CURRENT_ITEM_SOURCE.LAYOUT,
  );
  if (layout) return layout;

  const routeMediaId = normalizeId(hints.routeMediaId);
  if (routeMediaId !== null) {
    const routeIndex = findItemIndexById(candidates, routeMediaId);
    return {
      item: routeIndex >= 0 ? candidates[routeIndex] : null,
      mediaId:
        routeIndex >= 0
          ? candidates[routeIndex]?.pk ??
            candidates[routeIndex]?.id ??
            routeMediaId
          : routeMediaId,
      itemIndex: routeIndex >= 0 ? routeIndex : null,
      source: CURRENT_ITEM_SOURCE.ROUTE_FALLBACK,
    };
  }

  return {
    item: null,
    mediaId: null,
    itemIndex: null,
    source: CURRENT_ITEM_SOURCE.UNRESOLVED,
  };
}
