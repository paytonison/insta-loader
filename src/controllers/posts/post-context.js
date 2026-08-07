/**
 * @typedef {"main" | "action"} PostVisibleIndexSource
 */

/**
 * @typedef {Object} PostContext
 * @property {string | undefined} shortcode
 * @property {string | undefined} owner
 * @property {number} visibleIndex
 * @property {Element | null} actionHost
 */

/**
 * Return the third ancestor used by the legacy injected-action handlers.
 *
 * @param {Element | null | undefined} actionElement
 * @return {Element | null}
 */
function findActionHost(actionElement) {
  let host = actionElement?.nodeType === 1 ? actionElement : null;

  for (let depth = 0; depth < 3 && host; depth += 1) {
    host = host.parentElement;
  }

  return host;
}

/**
 * Read the shortcode segment from an Instagram post href.
 *
 * @param {Element | null | undefined} anchor
 * @return {string | undefined}
 */
function getShortcodeFromAnchor(anchor) {
  const href = anchor?.getAttribute?.("href");
  return typeof href === "string"
    ? href.split("/").at(2) || undefined
    : undefined;
}

/**
 * Reproduce the existing direct-child traversal used as the final shortcode
 * fallback for injected post actions.
 *
 * @param {Element | null} actionHost
 * @return {string | undefined}
 */
function getShortcodeFromActionHost(actionHost) {
  if (!actionHost) return undefined;

  const lastHostChild = Array.from(actionHost.children).filter(
    (child) => child.tagName === "DIV" && child === actionHost.lastElementChild,
  );
  const middleChildren = lastHostChild.flatMap((child) =>
    Array.from(child.children).filter((grandchild) => grandchild.tagName === "DIV"),
  );
  const terminalChildren = middleChildren.flatMap((child) =>
    Array.from(child.children).filter(
      (grandchild) =>
        grandchild.tagName === "DIV" && grandchild === child.lastElementChild,
    ),
  );
  const anchors = terminalChildren.flatMap((child) =>
    Array.from(child.querySelectorAll('a[href^="/p/"]')),
  );

  return getShortcodeFromAnchor(anchors.at(-1));
}

/**
 * Resolve the post identity and index needed by an injected post action while
 * retaining the legacy fallback order: route segment, first post link in the
 * post root, then the action-host traversal.
 *
 * @param {Object} options
 * @param {Element} options.mainElement
 * @param {Element} options.actionElement
 * @param {string} options.pathname
 * @param {(host: Element | null) => number} options.resolveVisibleIndex
 * @param {PostVisibleIndexSource} [options.visibleIndexSource="main"]
 * @return {PostContext}
 */
export function resolvePostContext({
  mainElement,
  actionElement,
  pathname,
  resolveVisibleIndex,
  visibleIndexSource = "main",
}) {
  const actionHost = findActionHost(actionElement);
  const routeShortcode = String(pathname ?? "")
    .replace(/\/$/, "")
    .split("/")
    .at(-1);
  const mainShortcode = getShortcodeFromAnchor(
    mainElement?.querySelector?.('a[href^="/p/"]'),
  );
  const shortcode =
    routeShortcode ||
    mainShortcode ||
    getShortcodeFromActionHost(actionHost);

  return {
    shortcode: shortcode || undefined,
    owner: mainElement?.getAttribute?.("data-username") ?? undefined,
    get visibleIndex() {
      const visibleIndexHost =
        visibleIndexSource === "action"
          ? findActionHost(actionElement)
          : mainElement;
      return resolveVisibleIndex(visibleIndexHost);
    },
    actionHost,
  };
}
