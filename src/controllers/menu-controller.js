/**
 * Application-lifetime owner for the seven Tampermonkey menu commands.
 * Labels are resolved on every refresh so locale changes can replace the
 * complete command set without leaving stale registrations behind.
 */
export class MenuController {
  /**
   * @param {Object} options
   * @param {import("../core/environment.js").UserscriptEnvironment} options.environment
   * @param {(key: string) => string} options.translate
   * @param {() => *} options.showSettings
   * @param {() => *} options.showHotkeySettings
   * @param {() => *} options.showDebug
   * @param {() => *} options.showFeedback
   * @param {() => *} options.checkForUpdate
   * @param {() => *} options.reload
   * @param {(...messages: *[]) => void} [options.logger]
   */
  constructor({
    environment,
    translate,
    showSettings,
    showHotkeySettings,
    showDebug,
    showFeedback,
    checkForUpdate,
    reload,
    logger,
  }) {
    if (
      typeof environment?.registerMenuCommand !== "function" ||
      typeof environment?.unregisterMenuCommand !== "function" ||
      typeof environment?.openInTab !== "function"
    ) {
      throw new TypeError("MenuController requires a userscript environment.");
    }

    const callbacks = {
      checkForUpdate,
      reload,
      showDebug,
      showFeedback,
      showHotkeySettings,
      showSettings,
      translate,
    };
    for (const [name, callback] of Object.entries(callbacks)) {
      if (typeof callback !== "function") {
        throw new TypeError(`MenuController requires ${name}().`);
      }
    }

    this.environment = environment;
    this.translate = translate;
    this.showSettings = showSettings;
    this.showHotkeySettings = showHotkeySettings;
    this.showDebug = showDebug;
    this.showFeedback = showFeedback;
    this.checkForUpdate = checkForUpdate;
    this.reloadApplication = reload;
    this.logger = logger || (() => {});
    this.registeredIds = [];
    this.mounted = false;
  }

  /** @return {boolean} */
  mount() {
    if (this.mounted) return false;
    this.mounted = true;
    this.refresh();
    return true;
  }

  /** @return {boolean} */
  refresh() {
    if (!this.mounted) return false;
    this.unregisterAll();

    this.register("SETTING", "w", this.showSettings);
    this.register("HOTKEY_KEY_SETTINGS_KEY", "q", this.showHotkeySettings);
    this.register("DONATE", "d", () =>
      this.environment.openInTab("https://ko-fi.com/paytonison", {
        active: true,
      }),
    );
    this.register("DEBUG", "z", this.showDebug);
    this.register("FEEDBACK", "f", this.showFeedback);
    this.register("CHECK_FOR_UPDATE", "c", this.checkForUpdate);
    this.register("RELOAD_SCRIPT", "r", this.reloadApplication);
    return true;
  }

  /** @return {*[]} */
  dispose() {
    if (!this.mounted && this.registeredIds.length === 0) return [];
    this.mounted = false;
    const errors = this.unregisterAll();
    return errors;
  }

  /**
   * @param {string} translationKey
   * @param {string} accessKey
   * @param {Function} callback
   * @private
   */
  register(translationKey, accessKey, callback) {
    const id = this.environment.registerMenuCommand(
      this.translate(translationKey),
      callback,
      { accessKey },
    );
    this.registeredIds.push(id);
  }

  /** @return {*[]} @private */
  unregisterAll() {
    const errors = [];
    const registeredIds = this.registeredIds.splice(0);
    for (const id of registeredIds) {
      try {
        this.logger("GM_unregisterMenuCommand", id);
        this.environment.unregisterMenuCommand(id);
      } catch (error) {
        errors.push(error);
      }
    }
    return errors;
  }
}
