import { ROUTE_KIND } from "../core/routes.js";
import { InjectedFeatureController } from "./feature-controller.js";

export const FEATURE_CONTROLLER_NAME = Object.freeze({
  POSTS: "posts",
  STORIES: "stories",
  HIGHLIGHTS: "highlights",
  SINGULAR_REEL_CONTROLS: "singular-reel-controls",
  REELS_CONTROLS: "reels-controls",
  PROFILES: "profiles",
  SETTINGS: "settings",
});

/**
 * @param {Object} options
 * @return {InjectedFeatureController}
 */
export function createPostController(options) {
  return createNamedController(FEATURE_CONTROLLER_NAME.POSTS, options);
}

/**
 * @param {Object} options
 * @return {InjectedFeatureController}
 */
export function createStoryController(options) {
  return createNamedController(FEATURE_CONTROLLER_NAME.STORIES, options);
}

/**
 * @param {Object} options
 * @return {InjectedFeatureController}
 */
export function createHighlightController(options) {
  return createNamedController(FEATURE_CONTROLLER_NAME.HIGHLIGHTS, options);
}

/**
 * This adapter owns only singular-Reel controls. Maximum-quality playback is
 * a separate application service and plural `/reels/` players stay native.
 *
 * @param {Object} options
 * @return {InjectedFeatureController}
 */
export function createSingularReelControlsController(options) {
  return createNamedController(
    FEATURE_CONTROLLER_NAME.SINGULAR_REEL_CONTROLS,
    options,
  );
}

/**
 * Plural Reels controls remain UI-only. This controller may mount download
 * and scroll controls, but maximum-quality playback ownership is deliberately
 * excluded from `/reels/` routes.
 *
 * @param {Object} options
 * @return {InjectedFeatureController}
 */
export function createReelsControlsController(options) {
  return createNamedController(
    FEATURE_CONTROLLER_NAME.REELS_CONTROLS,
    options,
  );
}

/**
 * @param {Object} options
 * @return {InjectedFeatureController}
 */
export function createProfileController(options) {
  return createNamedController(FEATURE_CONTROLLER_NAME.PROFILES, options);
}

/**
 * @param {Object} options
 * @return {InjectedFeatureController}
 */
export function createGlobalSettingsController(options) {
  return createNamedController(FEATURE_CONTROLLER_NAME.SETTINGS, options);
}

/**
 * Create another application-lifetime injected service without coupling the
 * coordinator to that service's implementation.
 *
 * @param {string} name
 * @param {Object} options
 * @return {InjectedFeatureController}
 */
export function createGlobalServiceController(name, options) {
  return createNamedController(name, options);
}

/**
 * Build fresh route-owned controller instances. The feed and direct post
 * routes share the posts adapter; singular Reel controls are never created for
 * plural Reels routes.
 *
 * @param {Object} options
 * @param {Object} options.environment
 * @param {Object} [options.adapters]
 * @param {(error: *, details: Object) => void} [options.onError]
 * @return {(route: *) => InjectedFeatureController[]}
 */
export function createRouteControllerFactory(options) {
  if (!options?.environment) {
    throw new TypeError("Route controller factory requires an environment.");
  }

  const adapters = options.adapters || {};
  const controllerOptions = (adapter) => ({
    adapter,
    environment: options.environment,
    onError: options.onError,
  });

  return function routeControllerFactory(route) {
    switch (route?.kind) {
      case ROUTE_KIND.FEED:
      case ROUTE_KIND.POST:
        return adapters.posts
          ? [createPostController(controllerOptions(adapters.posts))]
          : [];
      case ROUTE_KIND.STORY:
        return adapters.stories
          ? [createStoryController(controllerOptions(adapters.stories))]
          : [];
      case ROUTE_KIND.HIGHLIGHT:
        return adapters.highlights
          ? [createHighlightController(controllerOptions(adapters.highlights))]
          : [];
      case ROUTE_KIND.REEL:
        return adapters.reelControls
          ? [
              createSingularReelControlsController(
                controllerOptions(adapters.reelControls),
              ),
            ]
          : [];
      case ROUTE_KIND.REELS:
        return adapters.reelsControls
          ? [
              createReelsControlsController(
                controllerOptions(adapters.reelsControls),
              ),
            ]
          : [];
      case ROUTE_KIND.PROFILE:
        return adapters.profiles
          ? [createProfileController(controllerOptions(adapters.profiles))]
          : [];
      default:
        return [];
    }
  };
}

/**
 * @param {string} name
 * @param {Object} options
 * @return {InjectedFeatureController}
 */
function createNamedController(name, options) {
  if (!options || typeof options !== "object") {
    throw new TypeError(`${name} controller requires options.`);
  }
  return new InjectedFeatureController({
    adapter: options.adapter,
    environment: options.environment,
    name,
    onError: options.onError,
  });
}
