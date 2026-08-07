/**
 * @typedef {Object} Abortable
 * @property {() => *} abort
 */

/**
 * Owns the timers, listeners, observers, child scopes, and requests created by
 * one controller. Disposal is idempotent and always continues through every
 * cleanup even when one resource reports an error.
 */
export class DisposableScope {
  /**
   * @param {Object} environment
   * @param {{onError?: (error: *) => void}} [options]
   */
  constructor(environment, options = {}) {
    if (!environment) {
      throw new TypeError("DisposableScope requires an environment.");
    }

    this.environment = environment;
    this.onError = options.onError || null;
    this._records = [];
    this._disposed = false;
  }

  /** @return {boolean} */
  get disposed() {
    return this._disposed;
  }

  /**
   * Register a cleanup and return an idempotent function that releases it
   * early. Registering after disposal runs the cleanup immediately.
   *
   * @param {() => *} cleanup
   * @return {() => void}
   */
  defer(cleanup) {
    if (typeof cleanup !== "function") {
      throw new TypeError("A cleanup must be a function.");
    }

    const record = { active: true, cleanup };
    if (this._disposed) {
      this._run(record);
    } else {
      this._records.push(record);
    }

    return () => this._run(record);
  }

  /**
   * Register a resource with either an explicit disposer or its `dispose`
   * method, then return the original resource.
   *
   * @template T
   * @param {T} resource
   * @param {(resource: T) => *} [disposer]
   * @return {T}
   */
  use(resource, disposer) {
    const cleanup =
      disposer ||
      ((value) => {
        if (typeof value?.dispose !== "function") {
          throw new TypeError("The resource does not expose dispose().");
        }
        return value.dispose();
      });
    this.defer(() => cleanup(resource));
    return resource;
  }

  /**
   * @param {Function} callback
   * @param {number} delay
   * @param {...*} args
   * @return {*}
   */
  setTimeout(callback, delay, ...args) {
    if (this._disposed) return null;

    let release = null;
    const handle = this.environment.setTimeout(() => {
      release?.();
      callback(...args);
    }, delay);
    release = this.defer(() => this.environment.clearTimeout(handle));
    return handle;
  }

  /**
   * @param {Function} callback
   * @param {number} delay
   * @param {...*} args
   * @return {*}
   */
  setInterval(callback, delay, ...args) {
    if (this._disposed) return null;

    const handle = this.environment.setInterval(callback, delay, ...args);
    this.defer(() => this.environment.clearInterval(handle));
    return handle;
  }

  /**
   * @param {FrameRequestCallback} callback
   * @return {*}
   */
  requestAnimationFrame(callback) {
    if (this._disposed) return null;

    let release = null;
    const handle = this.environment.requestAnimationFrame((timestamp) => {
      release?.();
      callback(timestamp);
    });
    release = this.defer(() =>
      this.environment.cancelAnimationFrame(handle),
    );
    return handle;
  }

  /**
   * @param {IdleRequestCallback} callback
   * @param {IdleRequestOptions} [options]
   * @return {*}
   */
  requestIdleCallback(callback, options) {
    if (this._disposed) return null;

    let release = null;
    const handle = this.environment.requestIdleCallback((deadline) => {
      release?.();
      callback(deadline);
    }, options);
    release = this.defer(() => this.environment.cancelIdleCallback(handle));
    return handle;
  }

  /**
   * @param {EventTarget} target
   * @param {string} type
   * @param {EventListenerOrEventListenerObject} listener
   * @param {boolean|AddEventListenerOptions} [options]
   * @return {() => void}
   */
  listen(target, type, listener, options) {
    if (this._disposed) return () => {};
    if (typeof target?.addEventListener !== "function") {
      throw new TypeError("The event target does not support addEventListener().");
    }

    target.addEventListener(type, listener, options);
    return this.defer(() =>
      target.removeEventListener(type, listener, options),
    );
  }

  /**
   * Register a jQuery listener without making the scope depend on jQuery
   * itself. The same target, event string, selector, and handler are passed to
   * `off` during disposal.
   *
   * @param {Object} target
   * @param {string} events
   * @param {string|Function} selectorOrHandler
   * @param {Function} [handler]
   * @return {() => void}
   */
  listenJQuery(target, events, selectorOrHandler, handler) {
    if (this._disposed) return () => {};
    if (typeof target?.on !== "function" || typeof target?.off !== "function") {
      throw new TypeError("The jQuery target must expose on() and off().");
    }

    if (typeof selectorOrHandler === "function") {
      target.on(events, selectorOrHandler);
      return this.defer(() => target.off(events, selectorOrHandler));
    }

    if (typeof handler !== "function") {
      throw new TypeError("A delegated jQuery listener requires a handler.");
    }
    target.on(events, selectorOrHandler, handler);
    return this.defer(() => target.off(events, selectorOrHandler, handler));
  }

  /**
   * Begin observing a target and own the observer's complete teardown.
   *
   * @template T
   * @param {T & {observe: Function, disconnect: Function}} observer
   * @param {*} target
   * @param {Object} [options]
   * @return {T}
   */
  observe(observer, target, options) {
    if (this._disposed) return observer;
    observer.observe(target, options);
    this.defer(() => observer.disconnect());
    return observer;
  }

  /**
   * Own an abortable GM request, AbortController, or cancelable request record.
   *
   * @template {Abortable} T
   * @param {T} abortable
   * @return {T}
   */
  trackAbortable(abortable) {
    if (typeof abortable?.abort !== "function") {
      throw new TypeError("The tracked resource must expose abort().");
    }
    this.defer(() => abortable.abort());
    return abortable;
  }

  /**
   * @return {DisposableScope}
   */
  child() {
    return this.use(
      new DisposableScope(this.environment, { onError: this.onError }),
    );
  }

  /**
   * Dispose owned resources in reverse creation order.
   *
   * @return {*[]}
   */
  dispose() {
    if (this._disposed) return [];

    this._disposed = true;
    const errors = [];
    for (let index = this._records.length - 1; index >= 0; index -= 1) {
      const error = this._run(this._records[index]);
      if (error !== undefined) errors.push(error);
    }
    this._records.length = 0;
    return errors;
  }

  /**
   * @param {{active: boolean, cleanup: () => *}} record
   * @return {*}
   * @private
   */
  _run(record) {
    if (!record.active) return undefined;
    record.active = false;
    try {
      record.cleanup();
      return undefined;
    } catch (error) {
      this.onError?.(error);
      return error;
    }
  }
}
