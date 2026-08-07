import { DisposableScope } from "../core/disposable-scope.js";

/**
 * @typedef {Object} FeatureController
 * @property {(routeContext: FeatureControllerContext) => (boolean|Promise<boolean>)} mount
 * @property {(change: *, context?: FeatureControllerContext|null) => *} refresh
 * @property {() => *} dispose
 */

/**
 * @typedef {Object} FeatureControllerContext
 * @property {*} route
 * @property {*|null} previousRoute
 * @property {DisposableScope} scope
 * @property {Object} environment
 * @property {string} reason
 * @property {InjectedFeatureController} controller
 * @property {string} featureName
 */

/**
 * @typedef {Object} FeatureControllerAdapter
 * @property {(context: FeatureControllerContext) => *} [mount]
 * @property {(change: *, context: FeatureControllerContext) => *} [refresh]
 * @property {(context: FeatureControllerContext) => *} [dispose]
 */

/**
 * Small lifecycle owner for behavior that remains injected from a feature
 * module. It prevents duplicate mounts and gives each feature a private scope
 * while keeping selector and business behavior outside the infrastructure.
 */
export class InjectedFeatureController {
  /**
   * @param {Object} options
   * @param {string} options.name
   * @param {Object} options.environment
   * @param {FeatureControllerAdapter|((context: FeatureControllerContext) => *)} [options.adapter]
   * @param {(error: *, details: Object) => void} [options.onError]
   */
  constructor(options) {
    if (!options?.environment) {
      throw new TypeError("InjectedFeatureController requires an environment.");
    }
    if (!options.name || typeof options.name !== "string") {
      throw new TypeError("InjectedFeatureController requires a feature name.");
    }

    this.name = options.name;
    this.environment = options.environment;
    this.adapter = normalizeAdapter(options.adapter);
    this.onError = options.onError || (() => {});
    this._context = null;
    this._disposed = false;
    this._mounted = false;
    this._mountGeneration = 0;
    this._scope = null;
  }

  /** @return {boolean} */
  get mounted() {
    return this._mounted;
  }

  /** @return {boolean} */
  get disposed() {
    return this._disposed;
  }

  /** @return {DisposableScope|null} */
  get scope() {
    return this._scope;
  }

  /**
   * Mount once. A returned cleanup function, disposable, or abortable is
   * automatically adopted by the controller scope.
   *
   * @param {Object} routeContext
   * @return {boolean|Promise<boolean>}
   */
  mount(routeContext) {
    if (this._disposed || this._mounted) return false;
    if (!routeContext || typeof routeContext !== "object") {
      throw new TypeError("FeatureController.mount() requires route context.");
    }

    const generation = ++this._mountGeneration;
    const scope = new DisposableScope(this.environment, {
      onError: (error) =>
        this.onError(error, {
          featureName: this.name,
          phase: "cleanup",
        }),
    });
    const context = Object.freeze({
      ...routeContext,
      controller: this,
      environment: this.environment,
      featureName: this.name,
      scope,
    });

    this._context = context;
    this._mounted = true;
    this._scope = scope;

    let result;
    try {
      result = this.adapter.mount?.(context);
    } catch (error) {
      this.dispose();
      throw error;
    }

    if (isPromiseLike(result)) {
      return Promise.resolve(result)
        .then((resource) => {
          adoptMountResource(scope, resource);
          return true;
        })
        .catch((error) => {
          if (this._mountGeneration === generation) this.dispose();
          throw error;
        });
    }

    adoptMountResource(scope, result);
    return true;
  }

  /**
   * @param {*} change
   * @return {*}
   */
  refresh(change) {
    if (!this._mounted || this._disposed) return false;
    if (typeof this.adapter.refresh !== "function") return true;
    return this.adapter.refresh(change, this._context);
  }

  /**
   * Dispose exactly once and always release scoped resources even if the
   * adapter's explicit teardown reports an error.
   *
   * @return {*[]}
   */
  dispose() {
    if (this._disposed) return [];

    this._disposed = true;
    this._mounted = false;
    this._mountGeneration += 1;
    const context = this._context;
    const scope = this._scope;
    this._context = null;
    this._scope = null;

    let disposeError = null;
    try {
      this.adapter.dispose?.(context);
    } catch (error) {
      disposeError = error;
    }

    const errors = scope?.dispose() || [];
    if (disposeError) {
      this.onError(disposeError, {
        featureName: this.name,
        phase: "dispose",
      });
      errors.unshift(disposeError);
    }
    return errors;
  }
}

/**
 * @param {ConstructorParameters<typeof InjectedFeatureController>[0]} options
 * @return {InjectedFeatureController}
 */
export function createInjectedFeatureController(options) {
  return new InjectedFeatureController(options);
}

/**
 * @param {*} adapter
 * @return {FeatureControllerAdapter}
 */
function normalizeAdapter(adapter) {
  if (adapter == null) return {};
  if (typeof adapter === "function") return { mount: adapter };
  if (typeof adapter !== "object") {
    throw new TypeError("A feature adapter must be an object or mount function.");
  }
  for (const method of ["mount", "refresh", "dispose"]) {
    if (adapter[method] != null && typeof adapter[method] !== "function") {
      throw new TypeError(`Feature adapter ${method} must be a function.`);
    }
  }
  return adapter;
}

/**
 * @param {DisposableScope} scope
 * @param {*} resource
 * @return {void}
 */
function adoptMountResource(scope, resource) {
  if (typeof resource === "function") {
    scope.defer(resource);
  } else if (typeof resource?.dispose === "function") {
    scope.use(resource);
  } else if (typeof resource?.abort === "function") {
    scope.trackAbortable(resource);
  }
}

/** @param {*} value @return {boolean} */
function isPromiseLike(value) {
  return value != null && typeof value.then === "function";
}
