import {
  findStoryProgressItems,
  getDomElementHeight,
  getStoryProgressMetadata,
  isDomElementVisible,
} from "./dom-common.js";

/**
 * @param {Document | Element} root
 * @param {(element: Element) => boolean} isVisible
 * @return {string | null}
 */
function getHighlightUsername(root, isVisible) {
  const anchor = Array.from(
    root?.querySelectorAll?.('body > div section a[href^="/"]') ?? [],
  ).find((element) => {
    const section = element.closest("section");
    const segments = (element.getAttribute("href") || "")
      .split("/")
      .filter((segment) => segment.length > 0);
    return section && isVisible(section) && segments.length === 1;
  });

  return (
    anchor
      ?.getAttribute("href")
      ?.split("/")
      .filter((segment) => segment.length > 0)
      .at(0) ?? null
  );
}

/**
 * @param {Document | Element} root
 * @param {(element: Element) => boolean} isVisible
 * @return {number}
 */
function getHighlightTrailingProgressCount(root, isVisible) {
  const sectionLayoutCount = root?.querySelectorAll?.(
    "body > div section._ac0a header._ac0k > ._ac3r ._ac3n ._ac3p[style]",
  )?.length;
  if (sectionLayoutCount) return sectionLayoutCount;

  const visibleLayoutCount = Array.from(
    root?.querySelectorAll?.(
      "body > div section > div > div:not([class]) > div > div div.x1ned7t2.x78zum5 div.x1caxmr6",
    ) ?? [],
  ).filter((element) => isVisible(element.closest("section"))).length;
  if (visibleLayoutCount) return visibleLayoutCount;

  const matches = new Set();
  Array.from(
    root?.querySelectorAll?.(
      "body > div div:not([hidden]) section > div div[style]:not([class]) > div",
    ) ?? [],
  )
    .filter((element) => isVisible(element.closest("section")))
    .forEach((element) => {
      element
        .querySelectorAll("div div.x1ned7t2.x78zum5 div.x1caxmr6")
        .forEach((match) => matches.add(match));
    });

  return matches.size;
}

/**
 * Read Highlight-specific DOM state. Highlight identity retains its existing
 * reverse-progress mapping (`itemCount - styledProgressCount`) while exposing
 * the same shared resolver and action-context shape as ordinary Stories.
 *
 * @param {Document | Element} root
 * @param {Object} options
 * @param {string} options.pathname
 * @param {string} [options.href]
 * @param {number} options.itemCount
 * @param {(element: Element) => boolean} [options.isVisible]
 * @param {(element: Element) => number} [options.getHeight]
 * @return {Object}
 */
export function readHighlightDomState(
  root,
  {
    pathname,
    href,
    itemCount,
    isVisible = isDomElementVisible,
    getHeight = getDomElementHeight,
  },
) {
  const username = getHighlightUsername(root, isVisible);
  const highlightRoute = href ?? pathname;
  const highlightId =
    String(highlightRoute ?? "").replace(/\/$/, "").split("/").at(-1) ||
    null;
  const trailingProgressCount = getHighlightTrailingProgressCount(
    root,
    isVisible,
  );
  const progressItems = findStoryProgressItems(root, username, {
    isVisible,
    getHeight,
  });
  const progress = getStoryProgressMetadata(progressItems);
  const visibleVideo = root?.querySelector?.(
    "body > div section video.xh8yej3",
  );

  return {
    surface: "highlights",
    username,
    highlightId,
    identity: {
      explicitMediaId: null,
      visibleTimestamp: null,
      progressIndex:
        Number.isInteger(itemCount) && trailingProgressCount > 0
          ? itemCount - trailingProgressCount
          : null,
      layoutIndex: null,
      routeMediaId: null,
    },
    progress,
    thumbnail: {
      available: Boolean(visibleVideo),
      posterUrl: visibleVideo?.getAttribute("poster") || null,
    },
  };
}
