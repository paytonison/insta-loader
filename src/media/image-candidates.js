/**
 * Read the `stp` transformation parameter used by Instagram image URLs.
 * Invalid and relative URLs have no transformation value.
 *
 * @param {unknown} value
 * @returns {string | null}
 */
export function getImageTransformation(value) {
  if (typeof value !== "string" || value.length === 0) return null;

  try {
    return new URL(value).searchParams.get("stp");
  } catch (_error) {
    return null;
  }
}

/**
 * Match the image ordering used by the legacy media dialog.
 *
 * When both URLs contain an `stp` value, the less-transformed (shorter) value
 * wins. Otherwise the wider image wins. Equal candidates retain API order.
 *
 * @param {Record<string, any>} left
 * @param {Record<string, any>} right
 * @returns {number}
 */
export function compareImageCandidates(left, right) {
  const leftTransformation = getImageTransformation(left?.url);
  const rightTransformation = getImageTransformation(right?.url);

  if (leftTransformation && rightTransformation) {
    if (leftTransformation.length > rightTransformation.length) return 1;
    if (leftTransformation.length < rightTransformation.length) return -1;
    return 0;
  }

  const leftWidth = Number(left?.width);
  const rightWidth = Number(right?.width);
  const safeLeftWidth = Number.isFinite(leftWidth) ? leftWidth : 0;
  const safeRightWidth = Number.isFinite(rightWidth) ? rightWidth : 0;

  if (safeLeftWidth < safeRightWidth) return 1;
  if (safeLeftWidth > safeRightWidth) return -1;
  return 0;
}

/**
 * Return candidates in legacy preference order without mutating the API data.
 *
 * @param {unknown} candidates
 * @returns {Array<Record<string, any>>}
 */
export function orderImageCandidates(candidates) {
  if (!Array.isArray(candidates)) return [];

  return candidates
    .map((candidate, index) => ({ candidate, index }))
    .sort((left, right) => {
      return (
        compareImageCandidates(left.candidate, right.candidate) ||
        left.index - right.index
      );
    })
    .map(({ candidate }) => candidate);
}

/**
 * @param {unknown} candidates
 * @returns {Record<string, any> | null}
 */
export function selectBestImageCandidate(candidates) {
  return orderImageCandidates(candidates)[0] ?? null;
}
