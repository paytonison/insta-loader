export const UPDATE_CHECK_REMOTE_SCRIPT_URL =
  "https://raw.githubusercontent.com/paytonison/insta-loader/main/insta-loader.user.js";

export const UPDATE_NOTIFICATION_IMAGE_URL =
  "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a5/Instagram_icon.png/64px-Instagram_icon.png";

export const UPDATE_VERSION_PATTERN =
  /\/\/\s+@version\s+([0-9.\-a-zA-Z]+)/i;

/**
 * @typedef {Object} UpdateCheckEnvironment
 * @property {() => number} now
 * @property {(details: Object) => *} notify
 * @property {(url: string, options?: Object|boolean) => *} openInTab
 * @property {(callback: Function, delay?: number) => *} setTimeout
 * @property {{script: {version: string, downloadURL: string}}} scriptInfo
 * @property {{console?: {error?: (...args: *[]) => void}}} [window]
 */

/**
 * @typedef {Object} UpdateCheckScope
 * @property {boolean} disposed
 * @property {(cleanup: () => *) => (() => void)} defer
 * @property {(abortable: {abort: () => *}) => *} trackAbortable
 * @property {(callback: Function, delay: number) => *} setTimeout
 */

/**
 * Application-lifetime update checking with the published timestamp,
 * version-comparison, notification, and fail-open behavior kept intact.
 */
export class UpdateCheckService {
  /**
   * @param {Object} dependencies
   * @param {UpdateCheckEnvironment} dependencies.environment
   * @param {{getCheckTimestamp: () => *, setCheckTimestamp: (value?: *) => *}} dependencies.preferencesStore
   * @param {(options: {url: string}) => Promise<string> & {abort?: () => *}} dependencies.requestText
   * @param {(key: string) => string} dependencies.translator
   * @param {(...messages: *[]) => void} dependencies.logger
   * @param {() => (UpdateCheckScope|null)} [dependencies.getApplicationScope]
   */
  constructor({
    environment,
    preferencesStore,
    requestText,
    translator,
    logger,
    getApplicationScope,
  }) {
    if (
      typeof environment?.now !== "function" ||
      typeof environment?.notify !== "function" ||
      typeof environment?.openInTab !== "function" ||
      typeof environment?.setTimeout !== "function"
    ) {
      throw new TypeError(
        "UpdateCheckService requires a complete userscript environment.",
      );
    }
    if (
      typeof preferencesStore?.getCheckTimestamp !== "function" ||
      typeof preferencesStore?.setCheckTimestamp !== "function"
    ) {
      throw new TypeError(
        "UpdateCheckService requires update timestamp preferences.",
      );
    }
    if (
      typeof requestText !== "function" ||
      typeof translator !== "function" ||
      typeof logger !== "function"
    ) {
      throw new TypeError(
        "UpdateCheckService requires request, translation, and logging functions.",
      );
    }
    if (
      getApplicationScope != null &&
      typeof getApplicationScope !== "function"
    ) {
      throw new TypeError(
        "UpdateCheckService getApplicationScope must be a function.",
      );
    }

    this.environment = environment;
    this.preferencesStore = preferencesStore;
    this.requestText = requestText;
    this.translator = translator;
    this.logger = logger;
    this.getApplicationScope = getApplicationScope || null;
    this.scope = null;
    this.releaseScope = null;
    this.pendingRequests = new Set();
  }

  /**
   * Attach future requests and notification timers to the current application
   * scope. Rebinding aborts work still owned by the previous application.
   *
   * @param {UpdateCheckScope} scope
   * @return {void}
   */
  mount(scope) {
    if (
      !scope ||
      typeof scope.defer !== "function" ||
      typeof scope.trackAbortable !== "function" ||
      typeof scope.setTimeout !== "function"
    ) {
      throw new TypeError(
        "UpdateCheckService.mount() requires a disposable application scope.",
      );
    }
    if (scope.disposed) {
      throw new Error("UpdateCheckService cannot mount a disposed scope.");
    }
    if (this.scope === scope) return;

    this.releaseScope?.();
    this.scope = scope;
    this.releaseScope = scope.defer(() => {
      if (this.scope !== scope) return;
      this.scope = null;
      this.releaseScope = null;
      this.abortPendingRequests();
    });
  }

  /**
   * Check the stored cadence and begin a remote check only when strictly due.
   * The timestamp is written before the request starts, as in the published
   * userscript.
   *
   * @param {*} intervalSeconds
   * @param {boolean} enabled
   * @return {void}
   */
  checkIfDue(intervalSeconds, enabled) {
    if (!enabled) return;

    const checkTimestamp = this.preferencesStore.getCheckTimestamp();
    const nowTime = this.environment.now();

    if (nowTime > parseInt(checkTimestamp) + intervalSeconds * 1000) {
      this.preferencesStore.setCheckTimestamp(this.environment.now());
      this.notifyIfUpdateAvailable();
    }
  }

  /**
   * Fetch the published userscript and display the unchanged update notice
   * when its metadata version differs from the installed version.
   *
   * @return {Promise<void>}
   */
  notifyIfUpdateAvailable() {
    this.resolveApplicationScope();
    const currentVersion = this.environment.scriptInfo.script.version;
    let request;
    try {
      request = this.requestText({
        url: UPDATE_CHECK_REMOTE_SCRIPT_URL,
      });
    } catch (error) {
      this.logRequestFailure(error);
      return Promise.resolve();
    }

    this.pendingRequests.add(request);
    if (this.scope && typeof request?.abort === "function") {
      this.scope.trackAbortable(request);
    }

    return Promise.resolve(request)
      .then((remoteScript) => {
        const match = remoteScript.match(UPDATE_VERSION_PATTERN);

        if (match && match[1]) {
          const remoteVersion = match[1];
          this.logger(
            "Current version: ",
            currentVersion,
            "|",
            "Remote version: ",
            remoteVersion,
          );

          if (remoteVersion !== currentVersion) {
            this.environment.notify({
              text: this.translator("NOTICE_UPDATE_CONTENT"),
              title: this.translator("NOTICE_UPDATE_TITLE"),
              tag: "insta_loader_notice",
              highlight: true,
              timeout: 5000,
              zombieTimeout: 5000,
              image: UPDATE_NOTIFICATION_IMAGE_URL,
              onclick: (event) => {
                event?.preventDefault();
                const tab = this.environment.openInTab(
                  this.environment.scriptInfo.script.downloadURL,
                );
                this.schedule(() => {
                  tab.close();
                }, 250);
              },
            });
          } else {
            this.logger("there is no new update");
          }
        } else {
          this.environment.window?.console?.error?.(
            "Could not find version in the remote script.",
          );
        }
      })
      .catch((error) => {
        this.logRequestFailure(error);
      })
      .finally(() => {
        this.pendingRequests.delete(request);
      });
  }

  /**
   * Cancel every in-flight update request. Safe to call repeatedly.
   *
   * @return {void}
   */
  dispose() {
    this.releaseScope?.();
    this.releaseScope = null;
    this.scope = null;
    this.abortPendingRequests();
  }

  /** @param {Function} callback @param {number} delay @return {*} */
  schedule(callback, delay) {
    this.resolveApplicationScope();
    if (this.scope && !this.scope.disposed) {
      return this.scope.setTimeout(callback, delay);
    }
    return this.environment.setTimeout(callback, delay);
  }

  /** @return {UpdateCheckScope|null} */
  resolveApplicationScope() {
    const currentScope = this.getApplicationScope?.() || null;
    if (
      currentScope &&
      !currentScope.disposed &&
      currentScope !== this.scope
    ) {
      this.mount(currentScope);
    }
    return this.scope;
  }

  /** @return {void} */
  abortPendingRequests() {
    for (const request of this.pendingRequests) {
      try {
        request?.abort?.();
      } catch (_error) {
        // Request disposal is best-effort and remains fail-open.
      }
    }
    this.pendingRequests.clear();
  }

  /** @param {*} error @return {void} */
  logRequestFailure(error) {
    if (error?.category !== "abort") {
      this.logger("callNotification()", "reject", error);
    }
  }
}
