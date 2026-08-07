/**
 * Application-lifetime owner for the Preferences dialog and its delegated
 * setting, language, volume, and rename-format events.
 */
export class SettingsController {
  /**
   * @param {Object} options
   * @param {Function} options.$
   * @param {import("../core/environment.js").UserscriptEnvironment} options.environment
   * @param {Object<string, boolean>} options.settings
   * @param {Object<string, string>} options.localeManifest
   * @param {Object<string, string[]>} options.parentChildMapping
   * @param {{close: string}} options.icons
   * @param {() => *} options.createDialog
   * @param {(key: string) => string} options.translate
   * @param {(key: string) => string} options.translateHtml
   * @param {Object} options.model
   * @param {() => string} options.model.getLanguage
   * @param {(value: string) => string} options.model.setLanguage
   * @param {(language: string) => boolean} options.model.hasLocale
   * @param {(language: string, dictionary: Object) => void} options.model.setLocale
   * @param {() => void} options.model.clearTranslationCache
   * @param {() => *} options.model.getVideoVolume
   * @param {(value: *) => *} options.model.setVideoVolume
   * @param {() => string} options.model.getRenameFormat
   * @param {(value: string) => string} options.model.setRenameFormat
   * @param {(name: string, value: boolean) => void} options.model.setSetting
   * @param {(language: string) => Promise<Object>} options.loadTranslation
   * @param {() => void} options.repaintTranslations
   * @param {() => void} options.refreshMenus
   * @param {(action: () => *, context: string) => Promise<*>} options.reportAsync
   * @param {(name: string, value: boolean) => void} [options.onSettingChanged]
   * @param {(...messages: *[]) => void} [options.logger]
   */
  constructor({
    $,
    environment,
    settings,
    localeManifest,
    parentChildMapping,
    icons,
    createDialog,
    translate,
    translateHtml,
    model,
    loadTranslation,
    repaintTranslations,
    refreshMenus,
    reportAsync,
    onSettingChanged,
    logger,
  }) {
    if (typeof $ !== "function" || typeof environment?.getDocument !== "function") {
      throw new TypeError("SettingsController requires jQuery and an environment.");
    }
    if (!settings || !localeManifest || !parentChildMapping) {
      throw new TypeError("SettingsController requires settings metadata.");
    }
    const callbacks = {
      createDialog,
      loadTranslation,
      repaintTranslations,
      refreshMenus,
      reportAsync,
      translate,
      translateHtml,
    };
    for (const [name, callback] of Object.entries(callbacks)) {
      if (typeof callback !== "function") {
        throw new TypeError(`SettingsController requires ${name}().`);
      }
    }
    const modelMethods = [
      "clearTranslationCache",
      "getLanguage",
      "getRenameFormat",
      "getVideoVolume",
      "hasLocale",
      "setLanguage",
      "setLocale",
      "setRenameFormat",
      "setSetting",
      "setVideoVolume",
    ];
    for (const name of modelMethods) {
      if (typeof model?.[name] !== "function") {
        throw new TypeError(`SettingsController model requires ${name}().`);
      }
    }

    this.$ = $;
    this.environment = environment;
    this.document = environment.getDocument();
    this.settings = settings;
    this.localeManifest = localeManifest;
    this.parentChildMapping = parentChildMapping;
    this.icons = icons;
    this.createDialog = createDialog;
    this.translate = translate;
    this.translateHtml = translateHtml;
    this.model = model;
    this.loadTranslation = loadTranslation;
    this.repaintTranslations = repaintTranslations;
    this.refreshMenus = refreshMenus;
    this.reportAsync = reportAsync;
    this.onSettingChanged = onSettingChanged || (() => {});
    this.logger = logger || (() => {});
    this.scope = null;
    this.mounted = false;
  }

  /** @param {{scope: import("../core/disposable-scope.js").DisposableScope}} context */
  mount(context) {
    if (this.mounted) return false;
    if (typeof context?.scope?.child !== "function") {
      throw new TypeError("SettingsController.mount() requires an application scope.");
    }

    this.mounted = true;
    this.scope = context.scope.child();
    const register = () => {
      if (!this.scope?.disposed) this.registerHandlers();
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
    this.$(".IG_POPUP_DIG_SETTINGS").stop(true, true).remove();
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
    $(".IG_POPUP_DIG").addClass("IG_POPUP_DIG_SETTINGS");
    $(".IG_POPUP_DIG #post_info").text("Preference Settings");

    const $body = $(".IG_POPUP_DIG .IG_POPUP_DIG_BODY");
    $body.append(`
      <div class="insta-loader-language-row">
        <div>
          <div>Language</div>
          <div class="insta-loader-language-note">Some text is machine-translated; translation contributions are welcome on GitHub.</div>
        </div>
        <select id="langSelect"></select>
      </div>
    `);

    for (const language in this.localeManifest) {
      $("#langSelect").append(
        `<option value="${language}" ${this.model.getLanguage() === language ? "selected" : ""}>${this.localeManifest[language]}</option>`,
      );
    }

    for (const name in this.settings) {
      $body.append(`
                <label class="globalSettings"
                       title="${this.translateHtml(`${name}_INTRO`)}"
                       data-ih-locale-title="${name}_INTRO">

                    <span data-ih-locale="${name}">${this.translateHtml(name)}</span>
                    <input id="${name}" value="box" type="checkbox"
                           ${this.settings[name] === true ? "checked" : ""}>
                    <div class="chbtn"><div class="rounds"></div></div>
                </label>`);

      if (name === "MODIFY_VIDEO_VOLUME") {
        const controller = this;
        $body
          .find(`input[id="${name}"]`)
          .parent("label")
          .on("contextmenu", function (event) {
            event.preventDefault();
            if (!$(this).find("#tempWrapper").length) {
              $(this)
                .append('<div id="tempWrapper"></div>')
                .children("#tempWrapper")
                .append(
                  `<input value="${controller.model.getVideoVolume()}" type="range" min="0" max="1" step="0.05" />`,
                )
                .append(
                  `<input value="${controller.model.getVideoVolume()}" step="0.05" type="number" />`,
                )
                .append(
                  `<div class="IG_POPUP_DIG_BTN">${controller.icons.close}</div>`,
                );
            }
          });
      }

      if (name === "AUTO_RENAME") {
        const controller = this;
        $body
          .find(`input[id="${name}"]`)
          .parent("label")
          .on("contextmenu", function (event) {
            event.preventDefault();
            if (!$(this).find("#tempWrapper").length) {
              $(this)
                .append('<div id="tempWrapper"></div>')
                .children("#tempWrapper")
                .append(
                  `<input id="date_format" value="${controller.model.getRenameFormat()}" />`,
                )
                .append(
                  `<div class="IG_POPUP_DIG_BTN">${controller.icons.close}</div>`,
                );
            }
          });
      }
    }

    $(".IG_POPUP_DIG .IG_POPUP_DIG_BODY input#CHECK_FOR_UPDATE")
      .closest("label")
      .prependTo(".IG_POPUP_DIG .IG_POPUP_DIG_BODY");
    this.arrangeHierarchy();
    return true;
  }

  /** @private */
  registerHandlers() {
    const $ = this.$;
    const body = $("body");
    const controller = this;

    this.scope.listenJQuery(
      body,
      "change",
      ".IG_POPUP_DIG input",
      function () {
        const name = $(this).attr("id");
        if (name && controller.settings[name] !== undefined) {
          const isChecked = $(this).prop("checked");
          controller.model.setSetting(name, isChecked);
          controller.onSettingChanged(name, isChecked);
          controller.logger("user settings", name, isChecked);
        }
      },
    );

    this.scope.listenJQuery(
      body,
      "click",
      ".IG_POPUP_DIG .globalSettings",
      function (event) {
        if ($(this).find("#tempWrapper").length > 0) {
          event.preventDefault();
        }
      },
    );

    this.scope.listenJQuery(
      body,
      "change",
      ".IG_POPUP_DIG #tempWrapper input:not(#date_format)",
      function () {
        const value = $(this).val();
        if ($(this).attr("type") == "range") {
          $(this).next().val(value);
        } else {
          $(this).prev().val(value);
        }
        if (value >= 0 && value <= 1) {
          controller.model.setVideoVolume(value);
        }
      },
    );

    this.scope.listenJQuery(
      body,
      "input",
      ".IG_POPUP_DIG #tempWrapper input:not(#date_format)",
      function () {
        if ($(this).attr("type") == "range") {
          const value = $(this).val();
          $(this).next().val(value);
        } else {
          const value = $(this).val();
          if (value >= 0 && value <= 1) {
            $(this).prev().val(value);
          } else if (value < 0) {
            $(this).val(0);
          } else {
            $(this).val(1);
          }
        }
      },
    );

    this.scope.listenJQuery(
      body,
      "input",
      ".IG_POPUP_DIG #tempWrapper input#date_format",
      function () {
        controller.model.setRenameFormat($(this).val());
      },
    );

    this.scope.listenJQuery(
      body,
      "change",
      ".IG_POPUP_DIG_BODY #langSelect",
      function () {
        controller.changeLanguage($(this).val());
      },
    );
  }

  /** @param {string} language @private */
  changeLanguage(language) {
    const requestedLanguage = this.model.setLanguage(language);
    this.model.clearTranslationCache();

    if (
      requestedLanguage?.startsWith("en") ||
      this.model.hasLocale(requestedLanguage)
    ) {
      this.repaintTranslations();
      this.refreshMenus();
      return;
    }

    this.reportAsync(
      () =>
        this.loadTranslation(requestedLanguage).then((dictionary) => {
          this.model.setLocale(requestedLanguage, dictionary);
          if (this.model.getLanguage() !== requestedLanguage) return;
          this.model.clearTranslationCache();
          this.repaintTranslations();
          this.refreshMenus();
        }),
      "getTranslationText()",
    );
  }

  /** @private */
  arrangeHierarchy() {
    const $ = this.$;
    for (const [parent, children] of Object.entries(this.parentChildMapping)) {
      let $previous = $(
        `.IG_POPUP_DIG .IG_POPUP_DIG_BODY input#${parent}`,
      ).closest("label");

      for (const child of children) {
        const $childLabel = $(
          `.IG_POPUP_DIG .IG_POPUP_DIG_BODY input#${child}`,
        )
          .closest("label")
          .detach();
        $childLabel.addClass("child");
        $previous.after($childLabel);
        $previous = $childLabel;
      }
    }
  }
}
