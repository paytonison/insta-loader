/**
 * @typedef {Object} ProgressMetadata
 * @property {number} current
 * @property {number} total
 */

/**
 * @param {Element} element
 * @return {boolean}
 */
export function isDomElementVisible(element) {
  if (!element || element.closest?.("[hidden]")) return false;

  for (let current = element; current; current = current.parentElement) {
    const style = current.style;
    if (
      style?.display === "none" ||
      style?.visibility === "hidden" ||
      style?.opacity === "0"
    ) {
      return false;
    }
  }

  return true;
}

/**
 * @param {Element} element
 * @return {number}
 */
export function getDomElementHeight(element) {
  const styledHeight = Number.parseFloat(element?.style?.height);
  if (Number.isFinite(styledHeight)) return styledHeight;
  return element?.getBoundingClientRect?.().height ?? 0;
}

/**
 * @param {Element} element
 * @return {boolean}
 */
function isUnstyledDiv(element) {
  return (
    element?.tagName === "DIV" &&
    !element.hasAttribute("class") &&
    !element.hasAttribute("style")
  );
}

/**
 * Reproduce the shared Story/Highlight progress-bar lookup while allowing the
 * legacy integration to inject jQuery's visibility and height semantics.
 *
 * @param {Document | Element} root
 * @param {string | null | undefined} username
 * @param {Object} [options]
 * @param {(element: Element) => boolean} [options.isVisible]
 * @param {(element: Element) => number} [options.getHeight]
 * @return {Element[]}
 */
export function findStoryProgressItems(
  root,
  username,
  {
    isVisible = isDomElementVisible,
    getHeight = getDomElementHeight,
  } = {},
) {
  if (!root?.querySelectorAll || typeof username !== "string" || !username) {
    return [];
  }

  const normalizedUsername = username.toLowerCase();
  const anchors = Array.from(
    root.querySelectorAll(`body > div section a[href^="/${username}"]`),
  ).filter((anchor) => {
    const section = anchor.closest("section");
    return section && isVisible(section);
  });

  const findHeader = (starts) => {
    for (const start of starts) {
      for (let parent = start.parentElement; parent; parent = parent.parentElement) {
        if (
          isUnstyledDiv(parent) &&
          parent.textContent?.trim().toLowerCase() !== normalizedUsername &&
          parent.children.length > 1
        ) {
          return parent;
        }
      }
    }
    return null;
  };

  const usernameSpans = anchors.flatMap((anchor) =>
    Array.from(anchor.querySelectorAll("span")).filter(
      (span) =>
        span.children.length === 0 &&
        span.querySelector("svg") === null &&
        span.textContent?.trim().toLowerCase() === normalizedUsername,
    ),
  );
  let header = findHeader(usernameSpans);

  if (!header) {
    header = findHeader(
      anchors.filter((anchor) => anchor.querySelector("img") !== null),
    );
  }
  if (!header) return [];

  const progressRoot = Array.from(header.children).find(
    (child) => getHeight(child) < 10,
  );
  return progressRoot ? Array.from(progressRoot.children) : [];
}

/**
 * @param {ReadonlyArray<Element> | null | undefined} items
 * @return {ProgressMetadata | null}
 */
export function getStoryProgressMetadata(items) {
  if (!Array.isArray(items) || items.length === 0) return null;

  let current = 0;
  items.forEach((item, index) => {
    if (item.children.length > 0) current = index + 1;
  });

  return current === 0 ? null : { current, total: items.length };
}

/**
 * @param {Document | Element} root
 * @param {(element: Element) => boolean} [isVisible]
 * @return {number | null}
 */
export function getVisibleStoryTimestamp(
  root,
  isVisible = isDomElementVisible,
) {
  const time = Array.from(
    root?.querySelectorAll?.("body > div section time[datetime]") ?? [],
  ).find(
    (element) =>
      isVisible(element) &&
      element.closest('a[href^="/stories/highlights/"]') === null &&
      element.closest('[role="button"]') === null,
  );
  if (!time) return null;

  const timestamp = Math.floor(
    new Date(time.getAttribute("datetime")).getTime() / 1000,
  );
  return Number.isFinite(timestamp) && timestamp !== 0 ? timestamp : null;
}
