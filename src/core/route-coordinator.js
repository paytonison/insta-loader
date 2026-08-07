import { DisposableScope } from "./disposable-scope.js";
import { classifyInstagramRoute } from "./routes.js";

export const ROUTE_POLL_INTERVAL = Object.freeze({
  DEFAULT: 500,
  SAFARI: 750,
});

/**
 * @typedef {Object} FeatureController
 * @property {(routeContext: RouteContext) => (void|Promise<void>)} mount
 * @property {(change: *) => (void|Promise<void>)} refresh
 * @property {() => (void|Promise<void>)} dispose
 */

/**
 * @typedef {Object} RouteContext
 * @property {import("./routes.js").InstagramRoute} route
 * @property {import("./routes.js").InstagramRoute|null} previousRoute
 * @property {DisposableScope} scope
 * @property {Object} environment
 * @property {string} reason
 */

/**
 * @param {{browser?: {isSafari?: boolean}}} environment
 * @return {number}
 */
export function routePollIntervalFor(environment) {
  return environment?.browser?.isSafari
    ? ROUTE_POLL_INTERVAL.SAFARI
    : ROUTE_POLL_INTERVAL.DEFAULT;
}

/**
 * Route-level lifecycle owner. The coordinator deliberately knows nothing
 * about Instagram selectors or feature behavior; it classifies the current
 * location, disposes the prior route as one unit, and mounts injected feature
 * controllers for the new route.
 */
export class RouteCoordinator {
  /**
   * @param {Object} options
   * @param {Object} options.environment
   * @param {(route: *, context: RouteContext) => (FeatureController|FeatureController[]|null|undefined)} options.controllerFactory
   * @param {(value: *, options?: Object) => *} [options.classify]
   * @param {() => Object} [options.getClassificationOptions]
   * @param {() => boolean} [options.isReady]
   * @param {(error: *, context: Object) => void} [options.onError]
   * @param {number} [options.pollInterval]
   * @param {boolean} [options.refreshOnUnchanged=false]
   */
  constructor(options) {
    if (!options?.environment) {
      throw new TypeError("RouteCoordinator requires an environment.");
    }
    if (typeof options.controllerFactory !== "function") {
      throw new TypeError("RouteCoordinator requires a controllerFactory().");
    }

    this.environment = options.environment;
    this.controllerFactory = options.controllerFactory;
    this.classify = options.classify || classifyInstagramRoute;
    this.getClassificationOptions =
      options.getClassificationOptions || (() => ({}));
    this.isReady = options.isReady || (() => this._documentIsReady());
    this.onError = options.onError || (() => {});
    this.pollInterval =
      Number.isFinite(options.pollInterval) && options.pollInterval > 0
        ? Math.floor(options.pollInterval)
        : routePollIntervalFor(this.environment);
    this.refreshOnUnchanged = options.refreshOnUnchanged === true;

    this._running = false;
    this._pollHandle = null;
    this._routeScope = null;
    this._route = null;
    this._controllers = [];
  }

  /** @return {boolean} */
  get running() {
    return this._running;
  }

  /** @return {*|null} */
  get currentRoute() {
    return this._route;
  }

  /**
   * Begin the compatibility polling fallback and immediately inspect the
   * current route. Calling start more than once never creates another timer.
   *
   * @param {string} [reason]
   * @return {void}
   */
  start(reason = "start") {
    if (this._running) return;
    this._running = true;
    this.check(reason, true);
    this._pollHandle = this.environment.setInterval(
      () => this.check("poll"),
      this.pollInterval,
    );
  }

  /**
   * Stop polling. Active route work remains mounted until `dispose()` or
   * `reload()` so callers can temporarily suspend navigation detection.
   *
   * @return {void}
   */
  stop() {
    if (!this._running) return;
    this._running = false;
    if (this._pollHandle != null) {
      this.environment.clearInterval(this._pollHandle);
      this._pollHandle = null;
    }
  }

  /**
   * @param {string} [reason]
   * @param {boolean} [force]
   * @return {*|null}
   */
  check(reason = "check", force = false) {
    if (!this.isReady()) return this._route;

    const location = this.environment.getLocation();
    const nextRoute = this.classify(
      location?.href || location,
      this.getClassificationOptions(),
    );
    if (
      !force &&
      this._routeScope != null &&
      sameRoute(this._route, nextRoute)
    ) {
      if (this.refreshOnUnchanged) {
        this.refresh({ reason, route: nextRoute, type: "route-poll" });
      }
      return this._route;
    }

    this._transition(nextRoute, reason);
    return nextRoute;
  }

  /**
   * Send a DOM or feature-specific change to the currently mounted
   * controllers without remounting the route.
   *
   * @param {*} change
   * @return {void}
   */
  refresh(change) {
    for (const controller of [...this._controllers]) {
      try {
        const result = controller.refresh(change);
        Promise.resolve(result).catch((error) =>
          this.onError(error, {
            phase: "refresh",
            route: this._route,
            controller,
          }),
        );
      } catch (error) {
        this.onError(error, {
          phase: "refresh",
          route: this._route,
          controller,
        });
      }
    }
  }

  /**
   * Dispose every route-owned resource and mount the current location again.
   *
   * @param {string} [reason]
   * @return {*|null}
   */
  reload(reason = "reload") {
    this._disposeRoute();
    return this.check(reason, true);
  }

  /**
   * Stop polling and dispose the active route exactly once.
   *
   * @return {void}
   */
  dispose() {
    this.stop();
    this._disposeRoute();
    this._route = null;
  }

  /**
   * @param {*} nextRoute
   * @param {string} reason
   * @return {void}
   * @private
   */
  _transition(nextRoute, reason) {
    const previousRoute = this._route;
    this._disposeRoute();

    this._route = nextRoute;
    const scope = new DisposableScope(this.environment, {
      onError: (error) =>
        this.onError(error, { phase: "cleanup", route: nextRoute }),
    });
    this._routeScope = scope;
    const context = {
      route: nextRoute,
      previousRoute,
      scope,
      environment: this.environment,
      reason,
    };

    let created;
    try {
      created = this.controllerFactory(nextRoute, context);
    } catch (error) {
      this.onError(error, { phase: "create", route: nextRoute });
      return;
    }

    const controllers = Array.isArray(created)
      ? created.filter(Boolean)
      : created
        ? [created]
        : [];
    for (const controller of controllers) {
      if (!isFeatureController(controller)) {
        this.onError(
          new TypeError(
            "A feature controller must expose mount(), refresh(), and dispose().",
          ),
          { phase: "create", route: nextRoute, controller },
        );
        continue;
      }

      this._controllers.push(controller);
      scope.defer(() => {
        try {
          const result = controller.dispose();
          Promise.resolve(result).catch((error) =>
            this.onError(error, {
              phase: "dispose",
              route: nextRoute,
              controller,
            }),
          );
        } catch (error) {
          this.onError(error, {
            phase: "dispose",
            route: nextRoute,
            controller,
          });
        }
      });
      try {
        const result = controller.mount(context);
        Promise.resolve(result).catch((error) =>
          this.onError(error, {
            phase: "mount",
            route: nextRoute,
            controller,
          }),
        );
      } catch (error) {
        this.onError(error, {
          phase: "mount",
          route: nextRoute,
          controller,
        });
      }
    }
  }

  /**
   * @return {void}
   * @private
   */
  _disposeRoute() {
    this._routeScope?.dispose();
    this._routeScope = null;
    this._controllers = [];
  }

  /**
   * @return {boolean}
   * @private
   */
  _documentIsReady() {
    if (typeof this.environment.getDocument !== "function") return true;
    const document = this.environment.getDocument();
    return !document || Boolean(document.body);
  }
}

/**
 * @param {*} value
 * @return {value is FeatureController}
 */
export function isFeatureController(value) {
  return (
    typeof value?.mount === "function" &&
    typeof value?.refresh === "function" &&
    typeof value?.dispose === "function"
  );
}

/**
 * @param {*} left
 * @param {*} right
 * @return {boolean}
 */
function sameRoute(left, right) {
  return (
    left != null &&
    right != null &&
    left.href === right.href &&
    left.kind === right.kind &&
    left.ignoredReason === right.ignoredReason
  );
}
