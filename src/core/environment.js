const SAFARI_USER_AGENT_PATTERN =
  /^((?!chrome|android|crios|fxios|edgios).)*safari/i;

/**
 * @typedef {Object} BrowserCapabilities
 * @property {boolean} isSafari
 * @property {string} userAgent
 * @property {(name: string) => boolean} supports
 */

/**
 * @typedef {Object} UserscriptEnvironment
 * @property {Window & typeof globalThis} window
 * @property {BrowserCapabilities} browser
 * @property {() => Location} getLocation
 * @property {() => Document} getDocument
 * @property {() => number} now
 * @property {(key: string, defaultValue?: *) => *} getValue
 * @property {(key: string, value: *) => *} setValue
 * @property {(details: Object) => *} request
 * @property {(details: Object|string) => *} download
 * @property {(caption: string, onClick: Function, options?: Object|string) => *} registerMenuCommand
 * @property {(id: *) => *} unregisterMenuCommand
 * @property {(details: Object|string, title?: string, image?: string, onClick?: Function) => *} notify
 * @property {(url: string, options?: Object|boolean) => *} openInTab
 * @property {(css: string) => *} addStyle
 * @property {(callback: Function, delay?: number, ...args: *[]) => *} setTimeout
 * @property {(handle: *) => void} clearTimeout
 * @property {(callback: Function, delay?: number, ...args: *[]) => *} setInterval
 * @property {(handle: *) => void} clearInterval
 * @property {(callback: FrameRequestCallback) => *} requestAnimationFrame
 * @property {(handle: *) => void} cancelAnimationFrame
 * @property {(callback: IdleRequestCallback, options?: IdleRequestOptions) => *} requestIdleCallback
 * @property {(handle: *) => void} cancelIdleCallback
 * @property {(callback: Function) => void} queueMicrotask
 * @property {*} scriptInfo
 */

/**
 * Bind a callable to the object that supplied it.
 *
 * @param {*} value
 * @param {*} owner
 * @return {Function|null}
 */
function bindCallable(value, owner) {
  return typeof value === "function" ? value.bind(owner) : null;
}

/**
 * @param {string} name
 * @return {Function}
 */
function unavailable(name) {
  return function unavailableCapability() {
    throw new Error(`Userscript capability is unavailable: ${name}`);
  };
}

/**
 * @param {string} userAgent
 * @return {boolean}
 */
export function isSafariUserAgent(userAgent) {
  return SAFARI_USER_AGENT_PATTERN.test(String(userAgent || ""));
}

/**
 * Create the sole adapter that feature code needs for userscript and browser
 * globals. Every dependency can be replaced without installing globals, which
 * keeps unit tests and future controllers deterministic.
 *
 * The factory accepts the short names used by the returned environment
 * (`getValue`, `request`, `setTimeout`, and so on). When omitted, it resolves
 * the legacy `GM_*` functions granted by the published userscript and then the
 * equivalent modern `GM` method where one exists.
 *
 * @param {Object} [overrides]
 * @return {UserscriptEnvironment}
 */
export function createUserscriptEnvironment(overrides = {}) {
  const root = overrides.globalObject || globalThis;
  const windowObject = overrides.window || root.window || root;
  const gm = overrides.gm || root.GM || {};

  const getValue =
    bindCallable(overrides.getValue, overrides) ||
    bindCallable(root.GM_getValue, root) ||
    bindCallable(gm.getValue, gm) ||
    unavailable("storage.getValue");
  const setValue =
    bindCallable(overrides.setValue, overrides) ||
    bindCallable(root.GM_setValue, root) ||
    bindCallable(gm.setValue, gm) ||
    unavailable("storage.setValue");
  const request =
    bindCallable(overrides.request, overrides) ||
    bindCallable(overrides.xmlHttpRequest, overrides) ||
    bindCallable(root.GM_xmlhttpRequest, root) ||
    bindCallable(gm.xmlHttpRequest, gm) ||
    unavailable("request");
  const downloadImpl =
    bindCallable(overrides.download, overrides) ||
    bindCallable(root.GM_download, root) ||
    bindCallable(gm.download, gm);
  const download = downloadImpl || unavailable("download");
  const registerMenuCommand =
    bindCallable(overrides.registerMenuCommand, overrides) ||
    bindCallable(root.GM_registerMenuCommand, root) ||
    bindCallable(gm.registerMenuCommand, gm) ||
    unavailable("menu.register");
  const unregisterMenuCommand =
    bindCallable(overrides.unregisterMenuCommand, overrides) ||
    bindCallable(root.GM_unregisterMenuCommand, root) ||
    bindCallable(gm.unregisterMenuCommand, gm) ||
    unavailable("menu.unregister");
  const notify =
    bindCallable(overrides.notify, overrides) ||
    bindCallable(overrides.notification, overrides) ||
    bindCallable(root.GM_notification, root) ||
    bindCallable(gm.notification, gm) ||
    unavailable("notification");
  const openInTab =
    bindCallable(overrides.openInTab, overrides) ||
    bindCallable(root.GM_openInTab, root) ||
    bindCallable(gm.openInTab, gm) ||
    unavailable("tab.open");
  const addStyle =
    bindCallable(overrides.addStyle, overrides) ||
    bindCallable(root.GM_addStyle, root) ||
    bindCallable(gm.addStyle, gm) ||
    unavailable("style.add");
  const setTimeoutImpl =
    bindCallable(overrides.setTimeout, overrides) ||
    bindCallable(windowObject.setTimeout, windowObject) ||
    unavailable("timer.setTimeout");
  const clearTimeoutImpl =
    bindCallable(overrides.clearTimeout, overrides) ||
    bindCallable(windowObject.clearTimeout, windowObject) ||
    unavailable("timer.clearTimeout");
  const setIntervalImpl =
    bindCallable(overrides.setInterval, overrides) ||
    bindCallable(windowObject.setInterval, windowObject) ||
    unavailable("timer.setInterval");
  const clearIntervalImpl =
    bindCallable(overrides.clearInterval, overrides) ||
    bindCallable(windowObject.clearInterval, windowObject) ||
    unavailable("timer.clearInterval");

  const nativeRequestAnimationFrame =
    bindCallable(overrides.requestAnimationFrame, overrides) ||
    bindCallable(windowObject.requestAnimationFrame, windowObject);
  const nativeCancelAnimationFrame =
    bindCallable(overrides.cancelAnimationFrame, overrides) ||
    bindCallable(windowObject.cancelAnimationFrame, windowObject);
  const nativeRequestIdleCallback =
    bindCallable(overrides.requestIdleCallback, overrides) ||
    bindCallable(windowObject.requestIdleCallback, windowObject);
  const nativeCancelIdleCallback =
    bindCallable(overrides.cancelIdleCallback, overrides) ||
    bindCallable(windowObject.cancelIdleCallback, windowObject);

  const requestAnimationFrame =
    nativeRequestAnimationFrame ||
    ((callback) => setTimeoutImpl(() => callback(now()), 16));
  const cancelAnimationFrame =
    nativeCancelAnimationFrame || ((handle) => clearTimeoutImpl(handle));
  const requestIdleCallback =
    nativeRequestIdleCallback ||
    ((callback) =>
      setTimeoutImpl(
        () => callback({ didTimeout: false, timeRemaining: () => 0 }),
        1,
      ));
  const cancelIdleCallback =
    nativeCancelIdleCallback || ((handle) => clearTimeoutImpl(handle));
  const queueMicrotaskImpl =
    bindCallable(overrides.queueMicrotask, overrides) ||
    bindCallable(windowObject.queueMicrotask, windowObject) ||
    ((callback) => Promise.resolve().then(callback));
  const now =
    bindCallable(overrides.now, overrides) ||
    bindCallable(root.Date?.now, root.Date) ||
    Date.now;

  const userAgent = String(
    overrides.userAgent ?? windowObject.navigator?.userAgent ?? "",
  );
  const capabilities = Object.freeze({
    isSafari: isSafariUserAgent(userAgent),
    userAgent,
    supports(name) {
      switch (name) {
        case "requestAnimationFrame":
          return nativeRequestAnimationFrame != null;
        case "requestIdleCallback":
          return nativeRequestIdleCallback != null;
        case "requestVideoFrameCallback":
          return (
            typeof windowObject.HTMLVideoElement?.prototype
              ?.requestVideoFrameCallback === "function"
          );
        case "MutationObserver":
        case "IntersectionObserver":
        case "PerformanceObserver":
          return typeof windowObject[name] === "function";
        case "GM_download":
          return downloadImpl != null;
        default:
          return typeof windowObject[name] === "function";
      }
    },
  });

  const environment = {
    window: windowObject,
    browser: capabilities,
    getLocation: () => windowObject.location,
    getDocument: () => windowObject.document,
    now,
    getValue,
    setValue,
    request,
    download,
    registerMenuCommand,
    unregisterMenuCommand,
    notify,
    openInTab,
    addStyle,
    setTimeout: setTimeoutImpl,
    clearTimeout: clearTimeoutImpl,
    setInterval: setIntervalImpl,
    clearInterval: clearIntervalImpl,
    requestAnimationFrame,
    cancelAnimationFrame,
    requestIdleCallback,
    cancelIdleCallback,
    queueMicrotask: queueMicrotaskImpl,
    scriptInfo: overrides.scriptInfo ?? root.GM_info ?? gm.info ?? null,
  };

  return Object.freeze(environment);
}
