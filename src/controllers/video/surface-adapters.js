export const VIDEO_SURFACE = Object.freeze({
  POST: "post",
  REEL: "reel",
  STORY: "story",
  HIGHLIGHT: "highlight",
});

const CONTROLLER_OVERLAY_SELECTOR =
  'div[aria-label][data-visualcompletion="ignore"]';
const UNMUTED_ICON_SELECTOR = 'svg > path[d^="M16.636"]';
const MUTE_ICON_SELECTOR = [
  'svg > path[d^="M16.636 7.028a1.5"]',
  'svg > path[d^="M1.5 13.3c-.8"]',
].join(", ");
const STORY_MUTE_ICON_SELECTOR = [
  'svg > path[d^="M1.5 13.3c-.8 0-1.5.7-1.5 1.5v18.4c0"]',
  'svg > path[d^="M16.636 7.028a1.5 1.5"]',
].join(", ");

/**
 * @typedef {Object} VideoControllerLayout
 * @property {Element|null} overlay
 * @property {Element[]} layers Elements sent behind the video while controls are visible.
 * @property {Element[]} hidden Elements hidden while controls are visible.
 * @property {Element[]} draggableLinks Links made non-draggable while controls are visible.
 * @property {boolean} restoreDraggableOnHide
 */

/**
 * @typedef {Object} VideoControllerActivation
 * @property {EventTarget} target
 * @property {HTMLVideoElement} video
 */

/**
 * DOM-only contract consumed by VideoBehaviorService. Feature controllers can
 * replace these locators without changing listener or persistence behavior.
 *
 * @typedef {Object} VideoSurfaceAdapter
 * @property {string} surface
 * @property {boolean} supportsFullscreen
 * @property {boolean} supportsLooping
 * @property {boolean} setVolumeOnPlayback
 * @property {"absolute"|"relative"} controllerPosition
 * @property {(root: Element) => HTMLVideoElement[]} findVideos
 * @property {(root: Element, videos: HTMLVideoElement[]) => VideoControllerActivation[]} findControllerActivations
 * @property {(root: Element, selected: HTMLVideoElement, videos: HTMLVideoElement[]) => HTMLVideoElement[]} findControllerVideos
 * @property {(root: Element, video: HTMLVideoElement, event: Event) => VideoControllerLayout} locateControllerLayout
 * @property {(root: Element, video: HTMLVideoElement) => Element[]} findMuteControls
 * @property {(control: Element) => boolean} isMuteControlMuted
 * @property {(root: Element, video: HTMLVideoElement) => {button: Element|null, reveal: Element[]}} findLoopAction
 * @property {(root: Element, video: HTMLVideoElement) => Element|null} findNavigationGuard
 * @property {((details: Object) => void)|null} onControllerVisibilityChange
 */

/**
 * @param {Iterable<*>} values
 * @return {Element[]}
 */
function uniqueElements(values) {
  const elements = [];
  const seen = new Set();

  for (const value of values) {
    if (value?.nodeType !== 1 || seen.has(value)) continue;
    seen.add(value);
    elements.push(value);
  }

  return elements;
}

/**
 * @param {Element|null|undefined} root
 * @param {string} selector
 * @return {Element[]}
 */
function queryElements(root, selector) {
  return root ? Array.from(root.querySelectorAll(selector)) : [];
}

/**
 * @param {Element|null|undefined} root
 * @return {HTMLVideoElement[]}
 */
function findVideos(root) {
  return /** @type {HTMLVideoElement[]} */ (queryElements(root, "video"));
}

/**
 * @param {Element} control
 * @return {boolean}
 */
export function isInstagramMuteControlMuted(control) {
  return control.querySelector(UNMUTED_ICON_SELECTOR) == null;
}

/**
 * @param {Element[]} wrappers
 * @param {string} iconSelector
 * @return {Element[]}
 */
function findSizedMuteControls(wrappers, iconSelector) {
  const controls = uniqueElements(
    wrappers.flatMap((wrapper) =>
      queryElements(wrapper, 'button[type="button"], div[role="button"]'),
    ),
  );

  return controls.filter((control) => {
    const rect = control.getBoundingClientRect();
    const style = control.ownerDocument.defaultView?.getComputedStyle(control);
    const contentWidth = Number.parseFloat(style?.width);
    const contentHeight = Number.parseFloat(style?.height);
    return (
      (Number.isFinite(contentWidth) ? contentWidth : rect.width) <= 64 &&
      (Number.isFinite(contentHeight) ? contentHeight : rect.height) <= 64 &&
      control.querySelector(iconSelector) != null
    );
  });
}

/**
 * @param {Element} root
 * @param {HTMLVideoElement} video
 * @return {Element|null}
 */
function findPostControllerTarget(root, video) {
  return (
    video.parentElement?.querySelector("video + div > div") ||
    root.querySelector("video + div > div")
  );
}

/**
 * @param {Event} event
 * @return {Element|null}
 */
function findControllerOverlay(event) {
  const target = event.target;
  return typeof target?.parentElement?.closest === "function"
    ? target.parentElement.closest(CONTROLLER_OVERLAY_SELECTOR)
    : null;
}

/**
 * @param {Element} root
 * @param {HTMLVideoElement} video
 * @return {Element[]}
 */
function findPostOrReelMuteControls(root, video) {
  const localWrapper = findPostControllerTarget(root, video);
  return findSizedMuteControls(
    uniqueElements([localWrapper, root]),
    MUTE_ICON_SELECTOR,
  );
}

/**
 * @param {Element} root
 * @param {HTMLVideoElement[]} videos
 * @param {(root: Element, video: HTMLVideoElement) => Element|null} findTarget
 * @return {VideoControllerActivation[]}
 */
function findRootAndVideoActivations(root, videos, findTarget) {
  if (videos.length === 0) return [];

  const activations = [{ target: root, video: videos[0] }];
  for (const video of videos) {
    const target = findTarget(root, video);
    if (target) activations.push({ target, video });
  }
  return activations;
}

/**
 * @param {{onControllerVisibilityChange?: (details: Object) => void}} [options]
 * @return {VideoSurfaceAdapter}
 */
export function createPostVideoSurfaceAdapter(options = {}) {
  return {
    surface: VIDEO_SURFACE.POST,
    supportsFullscreen: true,
    supportsLooping: true,
    setVolumeOnPlayback: true,
    controllerPosition: "absolute",
    findVideos,
    findControllerActivations(root, videos) {
      return findRootAndVideoActivations(
        root,
        videos,
        findPostControllerTarget,
      );
    },
    findControllerVideos(_root, _selected, videos) {
      return videos;
    },
    locateControllerLayout(root, video, event) {
      return {
        overlay: findControllerOverlay(event),
        layers: uniqueElements([findPostControllerTarget(root, video)]),
        hidden: [],
        draggableLinks: uniqueElements([
          root.querySelector('a[href^="/reels/"]'),
        ]),
        restoreDraggableOnHide: true,
      };
    },
    findMuteControls: findPostOrReelMuteControls,
    isMuteControlMuted: isInstagramMuteControlMuted,
    findLoopAction() {
      return { button: null, reveal: [] };
    },
    findNavigationGuard(_root, video) {
      return video.closest('a[href^="/reels/"]');
    },
    onControllerVisibilityChange:
      options.onControllerVisibilityChange || null,
  };
}

/**
 * @param {Element} root
 * @param {HTMLVideoElement} video
 * @return {Element|null}
 */
function findReelControllerTarget(root, video) {
  const candidates = queryElements(
    video.parentElement || root,
    'video + div div[role="button"]',
  );

  return (
    candidates.find((candidate) => {
      const style = candidate.ownerDocument.defaultView?.getComputedStyle(
        candidate,
      );
      return (
        candidate.parentElement?.matches('div[role="presentation"]') &&
        style?.cursor === "pointer" &&
        candidate.hasAttribute("style")
      );
    }) || null
  );
}

/**
 * @param {{supportsLooping?: boolean, onControllerVisibilityChange?: (details: Object) => void}} [options]
 * @return {VideoSurfaceAdapter}
 */
export function createReelVideoSurfaceAdapter(options = {}) {
  return {
    surface: VIDEO_SURFACE.REEL,
    supportsFullscreen: true,
    supportsLooping: options.supportsLooping !== false,
    setVolumeOnPlayback: true,
    controllerPosition: "relative",
    findVideos,
    findControllerActivations(root, videos) {
      return findRootAndVideoActivations(
        root,
        videos,
        findReelControllerTarget,
      );
    },
    findControllerVideos(_root, _selected, videos) {
      return videos;
    },
    locateControllerLayout(root, video, event) {
      return {
        overlay: findControllerOverlay(event),
        layers: uniqueElements([findReelControllerTarget(root, video)]),
        hidden: [],
        draggableLinks: uniqueElements([
          root.querySelector('a[href^="/reels/"]'),
        ]),
        restoreDraggableOnHide: false,
      };
    },
    findMuteControls: findPostOrReelMuteControls,
    isMuteControlMuted: isInstagramMuteControlMuted,
    findLoopAction(_root, video) {
      const playPath = video.nextElementSibling?.querySelector(
        'div[role="presentation"] > div svg > path[d^="M5.888"]',
      );
      return {
        button:
          playPath?.closest(
            'button[role="button"], div[role="button"]',
          ) || null,
        reveal: queryElements(video.parentElement, ".xpgaw4o"),
      };
    },
    findNavigationGuard() {
      return null;
    },
    onControllerVisibilityChange:
      options.onControllerVisibilityChange || null,
  };
}

/**
 * @param {HTMLVideoElement} video
 * @return {Element|null}
 */
function findStoryVideoParent(video) {
  let parent = video.parentElement;
  while (parent) {
    if (
      parent.tagName === "DIV" &&
      !parent.hasAttribute("class") &&
      !parent.hasAttribute("style")
    ) {
      return parent;
    }
    parent = parent.parentElement;
  }
  return null;
}

/**
 * @param {HTMLVideoElement} video
 * @return {{videoParent: Element|null, bottomBar: Element|null, readMore: Element[], layers: Element[]}}
 */
function findStoryLayoutParts(video) {
  const videoParent = findStoryVideoParent(video);
  return {
    videoParent,
    bottomBar: videoParent?.nextElementSibling || null,
    readMore: queryElements(videoParent, 'div[class][role="button"]'),
    layers: queryElements(video.parentElement, "video + div"),
  };
}

/**
 * @param {Event} event
 * @return {Element|null}
 */
function findStoryOverlay(event) {
  const target = event.target;
  if (target?.nodeType !== 1) return null;
  return (
    target.parentElement?.querySelector(CONTROLLER_OVERLAY_SELECTOR) || target
  );
}

/**
 * @param {Element} root
 * @param {HTMLVideoElement} video
 * @return {Element[]}
 */
function findStoryMuteControls(_root, video) {
  const videoParent = findStoryVideoParent(video);
  const path = videoParent?.parentElement?.querySelector(
    STORY_MUTE_ICON_SELECTOR,
  );
  const control = path?.closest('[role="button"]') || null;
  return uniqueElements([control]);
}

/**
 * @param {{surface?: "story"|"highlight", onControllerVisibilityChange?: (details: Object) => void}} [options]
 * @return {VideoSurfaceAdapter}
 */
export function createStoryVideoSurfaceAdapter(options = {}) {
  const surface =
    options.surface === VIDEO_SURFACE.HIGHLIGHT
      ? VIDEO_SURFACE.HIGHLIGHT
      : VIDEO_SURFACE.STORY;

  return {
    surface,
    supportsFullscreen: false,
    supportsLooping: false,
    setVolumeOnPlayback: true,
    controllerPosition: "absolute",
    findVideos,
    findControllerActivations(_root, videos) {
      return videos.flatMap((video) => {
        const parts = findStoryLayoutParts(video);
        return uniqueElements([
          ...parts.layers,
          ...parts.readMore,
          parts.bottomBar,
          parts.videoParent,
        ]).map((target) => ({ target, video }));
      });
    },
    findControllerVideos(_root, selected) {
      return [selected];
    },
    locateControllerLayout(_root, video, event) {
      const parts = findStoryLayoutParts(video);
      return {
        overlay: findStoryOverlay(event),
        layers: parts.layers,
        hidden: uniqueElements([...parts.readMore, parts.bottomBar]),
        draggableLinks: [],
        restoreDraggableOnHide: false,
      };
    },
    findMuteControls: findStoryMuteControls,
    isMuteControlMuted: isInstagramMuteControlMuted,
    findLoopAction() {
      return { button: null, reveal: [] };
    },
    findNavigationGuard() {
      return null;
    },
    onControllerVisibilityChange:
      options.onControllerVisibilityChange || null,
  };
}
