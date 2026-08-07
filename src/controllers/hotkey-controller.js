export const HOTKEY_OPTIONS = Object.freeze([
  Object.freeze({ value: "87", label: "Alt+W" }),
  Object.freeze({ value: "90", label: "Alt+Z" }),
  Object.freeze({ value: "88", label: "Alt+X" }),
  Object.freeze({ value: "68", label: "Alt+D" }),
  Object.freeze({ value: "75", label: "Alt+K" }),
  Object.freeze({ value: "67", label: "Alt+C" }),
  Object.freeze({ value: "83", label: "Alt+S" }),
  Object.freeze({ value: "192", label: "Alt+~" }),
  Object.freeze({ value: "49", label: "Alt+1" }),
  Object.freeze({ value: "50", label: "Alt+2" }),
  Object.freeze({ value: "51", label: "Alt+3" }),
  Object.freeze({ value: "52", label: "Alt+4" }),
  Object.freeze({ value: "53", label: "Alt+5" }),
]);

export const HOTKEY_CONFIGS = Object.freeze([
  Object.freeze({
    name: "HOTKEY_SETTINGS",
    key: "HOTKEY_SETTINGS_KEY",
    preferenceName: "settings",
    stateKey: "settingsHotkeyKeyCode",
    storageKey: "G_HOTKEY_SETTINGS_KEYCODE",
    defaultKeyCode: 87,
  }),
  Object.freeze({
    name: "HOTKEY_KEY_SETTINGS",
    key: "HOTKEY_KEY_SETTINGS_KEY",
    preferenceName: "keySettings",
    stateKey: "keySettingsHotkeyKeyCode",
    storageKey: "G_HOTKEY_KEY_SETTINGS_KEYCODE",
    defaultKeyCode: 67,
  }),
  Object.freeze({
    name: "HOTKEY_DEBUG",
    key: "HOTKEY_DEBUG_KEY",
    preferenceName: "debug",
    stateKey: "debugHotkeyKeyCode",
    storageKey: "G_HOTKEY_DEBUG_KEYCODE",
    defaultKeyCode: 90,
  }),
  Object.freeze({
    name: "HOTKEY_DOWNLOAD_STORY",
    key: "HOTKEY_DOWNLOAD_STORY_KEY",
    preferenceName: "downloadStory",
    stateKey: "downloadStoryHotkeyKeyCode",
    storageKey: "G_HOTKEY_DOWNLOAD_STORY_KEYCODE",
    defaultKeyCode: 83,
  }),
]);

/**
 * Application-lifetime owner for global keyboard shortcuts and the Hotkey
 * Settings dialog. Conflict and dispatch comparisons intentionally retain the
 * legacy strict/loose distinction and independent branch ordering.
 */
export class HotkeyController {
  /**
   * @param {Object} options
   * @param {Function} options.$
   * @param {import("../core/environment.js").UserscriptEnvironment} options.environment
   * @param {() => *} options.createDialog
   * @param {(key: string) => string} options.translateHtml
   * @param {{get: (stateKey: string) => *, set: (preferenceName: string, stateKey: string, value: number) => *}} options.model
   * @param {() => *} options.showSettings
   * @param {() => *} options.showDebug
   * @param {() => *} options.reload
   */
  constructor({
    $,
    environment,
    createDialog,
    translateHtml,
    model,
    showSettings,
    showDebug,
    reload,
  }) {
    if (typeof $ !== "function" || typeof environment?.getDocument !== "function") {
      throw new TypeError("HotkeyController requires jQuery and an environment.");
    }
    const callbacks = { createDialog, reload, showDebug, showSettings, translateHtml };
    for (const [name, callback] of Object.entries(callbacks)) {
      if (typeof callback !== "function") {
        throw new TypeError(`HotkeyController requires ${name}().`);
      }
    }
    if (typeof model?.get !== "function" || typeof model?.set !== "function") {
      throw new TypeError("HotkeyController requires a hotkey model.");
    }

    this.$ = $;
    this.environment = environment;
    this.document = environment.getDocument();
    this.createDialog = createDialog;
    this.translateHtml = translateHtml;
    this.model = model;
    this.showSettings = showSettings;
    this.showDebug = showDebug;
    this.reloadApplication = reload;
    this.scope = null;
    this.mounted = false;
  }

  /** @param {{scope: import("../core/disposable-scope.js").DisposableScope}} context */
  mount(context) {
    if (this.mounted) return false;
    if (typeof context?.scope?.child !== "function") {
      throw new TypeError("HotkeyController.mount() requires an application scope.");
    }

    this.mounted = true;
    this.scope = context.scope.child();
    const register = () => {
      if (!this.scope?.disposed) {
        this.scope.listenJQuery(
          this.$(this.environment.window),
          "keydown",
          (event) => this.handleKeydown(event),
        );
      }
    };
    if (this.document.readyState === "loading") {
      this.scope.listen(this.document, "DOMContentLoaded", register, {
        once: true,
      });
    } else {
      register();
    }
    return true;
  }

  /** @return {boolean} */
  refresh() {
    return this.mounted;
  }

  /** @return {*[]} */
  dispose() {
    if (!this.mounted) return [];
    this.mounted = false;
    this.$(".IG_POPUP_DIG_HOTKEYS").stop(true, true).remove();
    const errors = this.scope?.dispose() || [];
    this.scope = null;
    return errors;
  }

  /** @return {boolean} */
  show() {
    if (!this.mounted) return false;
    const $ = this.$;
    $(".IG_POPUP_DIG").remove();
    this.createDialog();
    $(".IG_POPUP_DIG").addClass("IG_POPUP_DIG_HOTKEYS");
    $(".IG_POPUP_DIG #post_info").text("Hotkey Settings");

    const $body = $(".IG_POPUP_DIG .IG_POPUP_DIG_BODY");
    $body.append('<div class="hotkey-settings-container"></div>');
    const $container = $body.find(".hotkey-settings-container");
    for (const config of HOTKEY_CONFIGS) {
      $container.append(this.createHotkeySetting(config));
    }
    return true;
  }

  /**
   * @param {(typeof HOTKEY_CONFIGS)[number]} config
   * @return {Object}
   * @private
   */
  createHotkeySetting(config) {
    const $ = this.$;
    const currentKeyCode = this.model.get(config.stateKey);
    const $container = $(`
                <label class="globalSettings hotkey-setting-item" data-hotkey="${config.name}">
                    <span>${this.translateHtml(config.key)}</span>
                    <div class="hotkey-select-wrapper">
                        <select class="hotkey-preset" data-storage="${config.storageKey}" data-state="${config.stateKey}" data-default="${config.defaultKeyCode}">
                            ${HOTKEY_OPTIONS
                              .filter(
                                (option) =>
                                  option.value != config.defaultKeyCode.toString(),
                              )
                              .map(
                                (option) =>
                                  `<option value="${option.value}" ${option.value == currentKeyCode ? "selected" : ""}>${option.label}</option>`,
                              )
                              .join("")}
                            <option value="${config.defaultKeyCode}" ${currentKeyCode == config.defaultKeyCode ? "selected" : ""}>Alt+${String.fromCharCode(config.defaultKeyCode)}</option>
                        </select>
                        <button type="button" class="hotkey-reset" title="${this.translateHtml("HOTKEY_RESET")}">${this.translateHtml("HOTKEY_RESET")}</button>
                    </div>
                    <div class="hotkey-conflict-warning">▲ ${this.translateHtml("HOTKEY_CONFLICT_WARNING")}</div>
                </label>
            `);

    $container.find(".hotkey-reset").on("click", () => {
      const defaultCode = parseInt(
        $container.find(".hotkey-preset").data("default"),
      );
      const stateKey = $container.find(".hotkey-preset").data("state");
      const $preset = $container.find(".hotkey-preset");

      this.model.set(config.preferenceName, stateKey, defaultCode);
      $preset.val(defaultCode);
      $container.find(".hotkey-conflict-warning").hide();
    });

    $container.find(".hotkey-preset").on("change", (event) => {
      const $preset = $(event.currentTarget);
      const stateKey = $preset.data("state");
      const defaultCode = parseInt($preset.data("default"));
      const keyCode = parseInt($preset.val());

      if (this.hasConflict(keyCode, stateKey)) {
        this.model.set(config.preferenceName, stateKey, defaultCode);
        $preset.val(defaultCode);
        $container
          .find(".hotkey-conflict-warning")
          .show()
          .delay(2000)
          .fadeOut(500);
      } else {
        this.model.set(config.preferenceName, stateKey, keyCode);
        $container.find(".hotkey-conflict-warning").hide();
      }
    });

    return $container;
  }

  /** @param {number} keyCode @param {string} excludedStateKey @return {boolean} */
  hasConflict(keyCode, excludedStateKey) {
    return HOTKEY_CONFIGS.some(
      (config) =>
        config.stateKey !== excludedStateKey &&
        this.model.get(config.stateKey) === keyCode,
    );
  }

  /** @param {Object} event @private */
  handleKeydown(event) {
    if (!event.altKey) return;
    const $ = this.$;

    if (event.which == 81) {
      $(".IG_POPUP_DIG").remove();
      event.preventDefault();
    }

    const settingsKeyCode = this.model.get("settingsHotkeyKeyCode") || 87;
    if (event.which == settingsKeyCode) {
      if (
        $(".IG_POPUP_DIG").length > 0 &&
        $(".IG_POPUP_DIG #post_info").text() === "Preference Settings"
      ) {
        $(".IG_POPUP_DIG").remove();
      } else {
        this.showSettings();
      }
      event.preventDefault();
    }

    const keySettingsKeyCode =
      this.model.get("keySettingsHotkeyKeyCode") || 67;
    if (event.which == keySettingsKeyCode) {
      if (
        $(".IG_POPUP_DIG").length > 0 &&
        $(".IG_POPUP_DIG #post_info").text() === "Hotkey Settings"
      ) {
        $(".IG_POPUP_DIG").remove();
      } else {
        this.show();
      }
      event.preventDefault();
    }

    const debugKeyCode = this.model.get("debugHotkeyKeyCode") || 90;
    if (event.which == debugKeyCode) {
      this.showDebug();
      event.preventDefault();
    }

    if (event.which == "82") {
      this.reloadApplication();
      event.preventDefault();
    }

    const downloadStoryKeyCode =
      this.model.get("downloadStoryHotkeyKeyCode") || 83;
    if (event.which == downloadStoryKeyCode) {
      const href = this.environment.getLocation().href;
      if (
        href.match(/^(https:\/\/www\.instagram\.com\/stories\/)/gi) &&
        $(".IG_DWSTORY").length > 0
      ) {
        $(".IG_DWSTORY")?.trigger("click");
      }
      if (
        href.match(
          /^(https:\/\/www\.instagram\.com\/stories\/highlights\/)/gi,
        ) &&
        $(".IG_DWHISTORY").length > 0
      ) {
        $(".IG_DWHISTORY")?.trigger("click");
      }
      event.preventDefault();
    }
  }
}
