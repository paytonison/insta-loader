import {
  findStoryProgressItems,
  getDomElementHeight,
  getStoryProgressMetadata,
  getVisibleStoryTimestamp,
  isDomElementVisible,
} from "./dom-common.js";

const MEDIA_ID_PATTERN = /^[0-9]{10,}$/;

/**
 * @param {string} pathname
 * @return {string | null}
 */
function getRouteMediaId(pathname) {
  return (
    String(pathname ?? "")
      .split("/")
      .filter((segment) => segment.length > 0 && MEDIA_ID_PATTERN.test(segment))
      .at(-1) ?? null
  );
}

/**
 * @param {Document | Element} root
 * @param {string} pathname
 * @return {string | null}
 */
function getStoryUsername(root, pathname) {
  const username = root
    ?.querySelector?.(
      "body > div section._ac0a header._ac0k ._ac0l a + div a",
    )
    ?.textContent?.trim();
  if (username) return username;

  return (
    String(pathname ?? "")
      .split("/")
      .filter((segment) => segment.length > 0)
      .at(1) ?? null
  );
}

/**
 * Preserve the profile-layout lookup followed by the home-layout lookup. The
 * latter intentionally wins when both layouts report an active item, matching
 * the two consecutive legacy loops.
 *
 * @param {Document | Element} root
 * @param {(element: Element) => boolean} isVisible
 * @return {number | null}
 */
function getStoryLayoutIndex(root, isVisible) {
  let activeIndex = null;

  Array.from(
    root?.querySelectorAll?.(
      "body > div section div.x1ned7t2.x78zum5 > div",
    ) ?? [],
  )
    .filter((element) => isVisible(element.closest("section")))
    .forEach((element, index) => {
      if (
        element.classList.contains("x1lix1fw") &&
        element.children.length > 0
      ) {
        activeIndex = index;
      }
    });

  Array.from(
    root?.querySelectorAll?.("body > div section ._ac0k > ._ac3r > div") ?? [],
  )
    .filter((element) => isVisible(element.closest("section")))
    .forEach((element, index) => {
      if (
        Array.from(element.children).some((child) =>
          child.classList.contains("_ac3q"),
        )
      ) {
        activeIndex = index;
      }
    });

  return activeIndex;
}

/**
 * Read Story-specific DOM state and reduce it to inputs for the shared
 * current-item resolver. The injected predicates let legacy wiring retain
 * jQuery's exact `:visible` and `.height()` behavior.
 *
 * @param {Document | Element} root
 * @param {Object} options
 * @param {string} options.pathname
 * @param {(element: Element) => boolean} [options.isVisible]
 * @param {(element: Element) => number} [options.getHeight]
 * @return {Object}
 */
export function readStoryDomState(
  root,
  {
    pathname,
    isVisible = isDomElementVisible,
    getHeight = getDomElementHeight,
  },
) {
  const username = getStoryUsername(root, pathname);
  const routeMediaId = getRouteMediaId(pathname);
  const progressItems = findStoryProgressItems(root, username, {
    isVisible,
    getHeight,
  });
  const progress = getStoryProgressMetadata(progressItems);
  const visibleVideo = Array.from(
    root?.querySelectorAll?.("body > div section video[playsinline]") ?? [],
  ).find((element) => isVisible(element));

  return {
    surface: "stories",
    username,
    highlightId: null,
    identity: {
      explicitMediaId: routeMediaId,
      visibleTimestamp: getVisibleStoryTimestamp(root, isVisible),
      progressIndex: progress ? progress.current - 1 : null,
      layoutIndex: getStoryLayoutIndex(root, isVisible),
      routeMediaId,
    },
    progress,
    thumbnail: {
      available: Boolean(visibleVideo),
      posterUrl: visibleVideo?.getAttribute("poster") || null,
    },
  };
}
