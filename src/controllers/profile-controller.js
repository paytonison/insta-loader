const PROFILE_CONTROL_SELECTOR = ".IG_DWPROFILE";
const PROFILE_HEADER_SELECTOR =
  "header > *[class]:first-child img[alt]";
const PROFILE_IMAGE_SELECTOR =
  "header > *[class]:first-child > *[class]:first-child img[alt]";

/**
 * Route-owned Profile avatar discovery and action controller. Instagram
 * request details and output policy remain injected so this module owns no GM
 * globals and does not depend on rendered media-row attributes.
 */
export class ProfileController {
  /**
   * @param {Object} options
   * @param {Object} options.environment
   * @param {Function} options.$
   * @param {string} options.downloadIcon
   * @param {string} options.downloadIntent
   * @param {(descriptor: *, intent: string, options: Object) => Promise<*>} options.executeMediaDescriptor
   * @param {(userId: string|number) => Promise<*>} options.getHighResolutionProfile
   * @param {() => Location|{pathname: string}} options.getLocation
   * @param {(username: string) => Promise<*>} options.getUserInfo
   * @param {() => string} options.getDownloadTitle
   * @param {(*, Object) => *[]} options.normalizeProfileAvatar
   * @param {(isLoading: boolean) => void} options.setLoading
   * @param {() => number} [options.now]
   * @param {(...messages: *) => void} [options.logger]
   * @param {(error: *, details: Object) => void} [options.onError]
   * @param {number} [options.mountDelay=150]
   * @param {number} [options.discoveryInterval=150]
   */
  constructor({
    environment,
    $,
    downloadIcon,
    downloadIntent,
    executeMediaDescriptor,
    getHighResolutionProfile,
    getLocation,
    getUserInfo,
    getDownloadTitle,
    normalizeProfileAvatar,
    setLoading,
    now = Date.now,
    logger = () => {},
    onError = () => {},
    mountDelay = 150,
    discoveryInterval = 150,
  }) {
    if (typeof environment?.getDocument !== "function") {
      throw new TypeError("ProfileController requires an environment.");
    }
    for (const [name, value] of Object.entries({
      $,
      executeMediaDescriptor,
      getHighResolutionProfile,
      getLocation,
      getUserInfo,
      getDownloadTitle,
      normalizeProfileAvatar,
      setLoading,
      now,
      logger,
      onError,
    })) {
      if (typeof value !== "function") {
        throw new TypeError(`ProfileController requires ${name}().`);
      }
    }
    if (typeof downloadIcon !== "string") {
      throw new TypeError("ProfileController requires a download icon.");
    }
    if (typeof downloadIntent !== "string") {
      throw new TypeError("ProfileController requires a download intent.");
    }

    this.environment = environment;
    this.document = environment.getDocument();
    this.$ = $;
    this.downloadIcon = downloadIcon;
    this.downloadIntent = downloadIntent;
    this.executeMediaDescriptor = executeMediaDescriptor;
    this.getHighResolutionProfile = getHighResolutionProfile;
    this.getLocation = getLocation;
    this.getUserInfo = getUserInfo;
    this.getDownloadTitle = getDownloadTitle;
    this.normalizeProfileAvatar = normalizeProfileAvatar;
    this.setLoading = setLoading;
    this.now = now;
    this.logger = logger;
    this.onError = onError;
    this.mountDelay = mountDelay;
    this.discoveryInterval = discoveryInterval;

    this.scope = null;
    this.actionScope = null;
    this.discoveryScope = null;
    this.mountDelayScope = null;
    this.mounted = false;
    this.disposed = false;
    this.actionGeneration = 0;
    this.actionPending = false;
  }

  /**
   * @param {{scope: import("../core/disposable-scope.js").DisposableScope}} routeContext
   * @return {boolean}
   */
  mount(routeContext) {
    if (this.disposed || this.mounted) return false;
    if (typeof routeContext?.scope?.child !== "function") {
      throw new TypeError(
        "ProfileController.mount() requires a route-owned DisposableScope.",
      );
    }

    this.mounted = true;
    this.scope = routeContext.scope.child();
    this._bindActionListener();
    this.refresh({ type: "mount" });
    return true;
  }

  /**
   * @param {*} _change
   * @return {boolean}
   */
  refresh(_change) {
    if (!this.mounted || this.disposed) return false;
    this._bindActionListener();

    if (!this.hasProfileHeader()) return false;
    if (this._hasControl()) {
      this._stopDiscovery();
      this._stopMountDelay();
      return true;
    }

    this._scheduleDiscovery();
    return true;
  }

  /** @return {boolean} */
  hasProfileHeader() {
    return this.$(PROFILE_HEADER_SELECTOR).length > 0;
  }

  /**
   * Resolve and execute the current route avatar action.
   *
   * @return {Promise<*>}
   */
  async downloadAvatar() {
    if (!this.mounted || this.disposed) return false;

    const generation = this.actionGeneration;
    this.actionPending = true;
    this.setLoading(true);

    const timestamp = Math.floor(this.now() / 1000);
    const username = this._getRouteUsername();
    const userInfo = await this.getUserInfo(username);
    if (!this._isCurrentAction(generation)) return false;

    let highResolutionPayload = null;
    try {
      highResolutionPayload = await this.getHighResolutionProfile(
        userInfo.user.pk,
      );
    } catch (error) {
      if (!this._isCurrentAction(generation)) return false;
      this.logger(
        "ProfileController",
        "high-resolution fallback",
        error?.message || error,
      );
    }
    if (!this._isCurrentAction(generation)) return false;

    const descriptor = this.normalizeProfileAvatar(userInfo, {
      highResolutionPayload,
      owner: username,
      publishTime: timestamp,
    })[0];
    let result = false;
    if (descriptor) {
      result = await this.executeMediaDescriptor(
        descriptor,
        this.downloadIntent,
        {
          includeIndex: false,
          uid: userInfo.user.id,
          useDash: false,
          useImageCache: false,
          useMediaApi: false,
        },
      );
    } else {
      this.logger("ProfileController", "missing avatar resource");
    }

    if (!this._isCurrentAction(generation)) return false;
    this.actionPending = false;
    this.setLoading(false);
    return result;
  }

  /** @return {*[]} */
  dispose() {
    if (this.disposed) return [];
    this.disposed = true;
    this.mounted = false;
    this.actionGeneration += 1;
    if (this.actionPending) this.setLoading(false);
    this.actionPending = false;

    const errors = this.scope?.dispose() || [];
    this.scope = null;
    this.actionScope = null;
    this.discoveryScope = null;
    this.mountDelayScope = null;
    this.$(PROFILE_CONTROL_SELECTOR).remove();
    return errors;
  }

  /** @private */
  _bindActionListener() {
    if (this.actionScope || !this.document.body) return;
    this.actionScope = this.scope.child();
    this.actionScope.listenJQuery(
      this.$(this.document.body),
      "click",
      PROFILE_CONTROL_SELECTOR,
      (event) => {
        event.stopPropagation();
        this.downloadAvatar().catch((error) => {
          if (this.disposed && error?.name === "AbortError") return;
          this.onError(error, { phase: "avatar-action" });
        });
      },
    );
  }

  /** @private */
  _scheduleDiscovery() {
    if (this.mountDelayScope || this.discoveryScope || this._hasControl()) {
      return;
    }

    const delayScope = this.scope.child();
    this.mountDelayScope = delayScope;
    delayScope.setTimeout(() => {
      delayScope.dispose();
      if (this.mountDelayScope === delayScope) this.mountDelayScope = null;
      if (!this.mounted || this.disposed || this._hasControl()) return;

      const discoveryScope = this.scope.child();
      this.discoveryScope = discoveryScope;
      discoveryScope.setInterval(() => {
        if (this._hasControl()) {
          this._stopDiscovery();
          return;
        }
        this._mountControls();
      }, this.discoveryInterval);
    }, this.mountDelay);
  }

  /** @private */
  _mountControls() {
    const selector = PROFILE_IMAGE_SELECTOR;
    const $draggableElements = this.$(`${selector}[draggable]`)
      .parent()
      .parent();
    const $nonDraggableElements = this.$(`${selector}:not([draggable])`)
      .parent()
      .parent()
      .parent();
    const markup =
      `<div data-ih-locale-title="DW" title="${this.getDownloadTitle()}" ` +
      `class="IG_DWPROFILE">${this.downloadIcon}</div>`;

    $draggableElements.append(markup);
    $draggableElements.css("position", "relative");
    $nonDraggableElements.append(markup);
    $nonDraggableElements.css("position", "relative");
  }

  /** @private */
  _stopDiscovery() {
    this.discoveryScope?.dispose();
    this.discoveryScope = null;
  }

  /** @private */
  _stopMountDelay() {
    this.mountDelayScope?.dispose();
    this.mountDelayScope = null;
  }

  /** @return {boolean} @private */
  _hasControl() {
    return this.$(PROFILE_CONTROL_SELECTOR).length > 0;
  }

  /** @return {string} @private */
  _getRouteUsername() {
    return this.getLocation().pathname
      .replaceAll(/(reels|tagged)\/$/gi, "")
      .split("/")
      .filter((segment) => segment.length > 0)
      .at(-1);
  }

  /** @param {number} generation @return {boolean} @private */
  _isCurrentAction(generation) {
    return (
      this.mounted &&
      !this.disposed &&
      this.actionGeneration === generation
    );
  }
}

export const PROFILE_SELECTORS = Object.freeze({
  control: PROFILE_CONTROL_SELECTOR,
  header: PROFILE_HEADER_SELECTOR,
  image: PROFILE_IMAGE_SELECTOR,
});
