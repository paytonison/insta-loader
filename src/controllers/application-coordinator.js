import { DisposableScope } from "../core/disposable-scope.js";
import {
  RouteCoordinator,
  isFeatureController,
} from "../core/route-coordinator.js";
import {
  createGlobalServiceController,
  createGlobalSettingsController,
  createRouteControllerFactory,
} from "./route-adapters.js";

/**
 * Application-lifetime owner for global services and the route coordinator.
 * A manual reload recycles this complete ownership tree so application- and
 * route-owned resources are both disposed before fresh controllers mount.
 */
export class ApplicationCoordinator {
  /**
   * @param {Object} options
   * @param {Object} options.environment
   * @param {RouteCoordinator} options.routeCoordinator
   * @param {() => (*|*[])} [options.globalControllerFactory]
   * @param {(error: *, details: Object) => void} [options.onError]
   */
  constructor(options) {
    if (!options?.environment) {
      throw new TypeError("ApplicationCoordinator requires an environment.");
    }
    if (!(options.routeCoordinator instanceof RouteCoordinator)) {
      throw new TypeError("ApplicationCoordinator requires a RouteCoordinator.");
    }

    this.environment = options.environment;
    this.routeCoordinator = options.routeCoordinator;
    this.globalControllerFactory =
      options.globalControllerFactory || (() => []);
    this.onError = options.onError || (() => {});
    this._globalControllers = [];
    this._running = false;
    this._scope = null;
  }

  /** @return {boolean} */
  get running() {
    return this._running;
  }

  /** @return {*|null} */
  get currentRoute() {
    return this.routeCoordinator.currentRoute;
  }

  /**
   * @param {string} [reason]
   * @return {boolean}
   */
  start(reason = "start") {
    if (this._running) return false;

    const scope = new DisposableScope(this.environment, {
      onError: (error) =>
        this.onError(error, { phase: "application-cleanup" }),
    });
    this._scope = scope;
    this._running = true;

    try {
      this._mountGlobalControllers(
        scope,
        reason === "start" ? "application-start" : reason,
      );
      scope.defer(() => this.routeCoordinator.dispose());
      this.routeCoordinator.start(reason);
      return true;
    } catch (error) {
      this._running = false;
      scope.dispose();
      this._scope = null;
      this._globalControllers = [];
      throw error;
    }
  }

  /**
   * Refresh application and active-route services without creating another
   * polling timer or controller instance.
   *
   * @param {*} change
   * @return {void}
   */
  refresh(change) {
    if (!this._running) return;
    this._refreshGlobalControllers(change);
    this.routeCoordinator.refresh(change);
  }

  /**
   * Dispose and remount the complete application ownership tree. This closes
   * application-owned requests, schedulers, listeners, and observers as well
   * as route-owned work before mounting one fresh controller set.
   *
   * @param {string} [reason]
   * @return {*|null}
   */
  reload(reason = "reload") {
    if (!this._running) {
      this.start(reason);
      return this.currentRoute;
    }

    this.dispose();
    this.start(reason);
    return this.currentRoute;
  }

  /**
   * @return {void}
   */
  dispose() {
    if (!this._running) return;
    this._running = false;
    this._scope?.dispose();
    this._scope = null;
    this._globalControllers = [];
  }

  /**
   * @param {DisposableScope} scope
   * @param {string} reason
   * @return {void}
   * @private
   */
  _mountGlobalControllers(scope, reason) {
    const created = this.globalControllerFactory();
    const controllers = Array.isArray(created)
      ? created.filter(Boolean)
      : created
        ? [created]
        : [];
    const context = {
      environment: this.environment,
      previousRoute: null,
      reason,
      route: null,
      scope,
    };

    for (const controller of controllers) {
      if (!isFeatureController(controller)) {
        this.onError(
          new TypeError(
            "A global controller must expose mount(), refresh(), and dispose().",
          ),
          { controller, phase: "global-create" },
        );
        continue;
      }

      this._globalControllers.push(controller);
      scope.defer(() => this._disposeController(controller));
      try {
        const result = controller.mount(context);
        Promise.resolve(result).catch((error) =>
          this.onError(error, { controller, phase: "global-mount" }),
        );
      } catch (error) {
        this.onError(error, { controller, phase: "global-mount" });
      }
    }
  }

  /**
   * @param {*} change
   * @return {void}
   * @private
   */
  _refreshGlobalControllers(change) {
    for (const controller of [...this._globalControllers]) {
      try {
        const result = controller.refresh(change);
        Promise.resolve(result).catch((error) =>
          this.onError(error, { controller, phase: "global-refresh" }),
        );
      } catch (error) {
        this.onError(error, { controller, phase: "global-refresh" });
      }
    }
  }

  /**
   * @param {*} controller
   * @return {void}
   * @private
   */
  _disposeController(controller) {
    try {
      const result = controller.dispose();
      Promise.resolve(result).catch((error) =>
        this.onError(error, { controller, phase: "global-dispose" }),
      );
    } catch (error) {
      this.onError(error, { controller, phase: "global-dispose" });
    }
  }
}

/**
 * Compose the standard route adapters and application-lifetime settings
 * services around the core RouteCoordinator.
 *
 * @param {Object} options
 * @param {Object} options.environment
 * @param {Object} [options.routeAdapters]
 * @param {*} [options.settingsAdapter]
 * @param {{name: string, adapter: *}[]} [options.globalServiceAdapters]
 * @param {() => (*|*[])} [options.globalControllerFactory]
 * @param {RouteCoordinator} [options.routeCoordinator]
 * @param {Function} [options.routeControllerFactory]
 * @param {(error: *, details: Object) => void} [options.onError]
 * @param {Function} [options.classify]
 * @param {Function} [options.getClassificationOptions]
 * @param {Function} [options.isReady]
 * @param {number} [options.pollInterval]
 * @return {ApplicationCoordinator}
 */
export function createApplicationCoordinator(options) {
  if (!options?.environment) {
    throw new TypeError("Application coordinator factory requires an environment.");
  }

  const routeControllerFactory =
    options.routeControllerFactory ||
    createRouteControllerFactory({
      adapters: options.routeAdapters,
      environment: options.environment,
      onError: options.onError,
    });
  const routeCoordinator =
    options.routeCoordinator ||
    new RouteCoordinator({
      classify: options.classify,
      controllerFactory: routeControllerFactory,
      environment: options.environment,
      getClassificationOptions: options.getClassificationOptions,
      isReady: options.isReady,
      onError: options.onError,
      pollInterval: options.pollInterval,
    });

  return new ApplicationCoordinator({
    environment: options.environment,
    onError: options.onError,
    routeCoordinator,
    globalControllerFactory: () => {
      const controllers = [];
      if (options.settingsAdapter) {
        controllers.push(
          createGlobalSettingsController({
            adapter: options.settingsAdapter,
            environment: options.environment,
            onError: options.onError,
          }),
        );
      }
      for (const service of options.globalServiceAdapters || []) {
        controllers.push(
          createGlobalServiceController(service.name, {
            adapter: service.adapter,
            environment: options.environment,
            onError: options.onError,
          }),
        );
      }

      const additional = options.globalControllerFactory?.();
      if (Array.isArray(additional)) controllers.push(...additional);
      else if (additional) controllers.push(additional);
      return controllers;
    },
  });
}
