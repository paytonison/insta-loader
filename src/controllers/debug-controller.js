/**
 * Application-lifetime owner for Debug and Feedback dialogs, including the
 * delegated DOM-tree actions and temporary text-file object URLs they create.
 */
export class DebugController {
  /**
   * @param {Object} options
   * @param {Function} options.$
   * @param {import("../core/environment.js").UserscriptEnvironment} options.environment
   * @param {() => *} options.createDialog
   * @param {(key: string) => string} options.translateHtml
   * @param {() => Array<{time: number, content: *[]}>} options.getLogs
   * @param {(value: *) => boolean} options.isJQuery
   */
  constructor({
    $,
    environment,
    createDialog,
    translateHtml,
    getLogs,
    isJQuery,
  }) {
    if (typeof $ !== "function" || typeof environment?.getDocument !== "function") {
      throw new TypeError("DebugController requires jQuery and an environment.");
    }
    const callbacks = { createDialog, getLogs, isJQuery, translateHtml };
    for (const [name, callback] of Object.entries(callbacks)) {
      if (typeof callback !== "function") {
        throw new TypeError(`DebugController requires ${name}().`);
      }
    }

    this.$ = $;
    this.environment = environment;
    this.document = environment.getDocument();
    this.createDialog = createDialog;
    this.translateHtml = translateHtml;
    this.getLogs = getLogs;
    this.isJQuery = isJQuery;
    this.scope = null;
    this.mounted = false;
    this.objectUrls = new Set();
  }

  /** @param {{scope: import("../core/disposable-scope.js").DisposableScope}} context */
  mount(context) {
    if (this.mounted) return false;
    if (typeof context?.scope?.child !== "function") {
      throw new TypeError("DebugController.mount() requires an application scope.");
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
    if (!this.mounted && this.objectUrls.size === 0) return [];
    this.mounted = false;
    this.$(".IG_POPUP_DIG_DEBUG, .IG_POPUP_DIG_FEEDBACK")
      .stop(true, true)
      .remove();
    const errors = this.scope?.dispose() || [];
    this.scope = null;

    const urlApi = this.environment.window.URL;
    for (const url of this.objectUrls) {
      try {
        urlApi?.revokeObjectURL?.(url);
      } catch (error) {
        errors.push(error);
      }
    }
    this.objectUrls.clear();
    return errors;
  }

  /** @return {boolean} */
  showDebug() {
    if (!this.mounted) return false;
    const $ = this.$;
    $(".IG_POPUP_DIG").remove();
    this.createDialog();
    $(".IG_POPUP_DIG").addClass("IG_POPUP_DIG_DEBUG");
    $(".IG_POPUP_DIG #post_info").text("IG Debug DOM Tree");

    $(".IG_POPUP_DIG .IG_POPUP_DIG_BODY").append(
      "<textarea readonly></textarea>",
    );
    $(".IG_POPUP_DIG .IG_POPUP_DIG_BODY").append(
      '<div class="insta-loader-dialog-actions"></div>',
    );
    $(".IG_POPUP_DIG .insta-loader-dialog-actions").append(
      `<button type="button" class="IG_DISPLAY_DOM_TREE"><a>${this.translateHtml("SHOW_DOM_TREE")}</a></button>`,
    );
    $(".IG_POPUP_DIG .insta-loader-dialog-actions").append(
      `<button type="button" class="IG_SELECT_DOM_TREE"><a>${this.translateHtml("SELECT_AND_COPY")}</a></button>`,
    );
    $(".IG_POPUP_DIG .insta-loader-dialog-actions").append(
      `<button type="button" class="IG_DOWNLOAD_DOM_TREE"><a>${this.translateHtml("DOWNLOAD_DOM_TREE")}</a></button>`,
    );
    $(".IG_POPUP_DIG .insta-loader-dialog-actions").append(
      `<button type="button" class="IG_REPORT_GITHUB"><a href="https://github.com/paytonison/insta-loader/issues" target="_blank">${this.translateHtml("REPORT_GITHUB")}</a></button>`,
    );
    $(".IG_POPUP_DIG .insta-loader-dialog-actions").append(
      `<button type="button" class="IG_REPORT_DISCORD"><a href="https://discord.gg/q3KT4hdq8x" target="_blank">${this.translateHtml("REPORT_DISCORD")}</a></button>`,
    );
    return true;
  }

  /** @return {boolean} */
  showFeedback() {
    if (!this.mounted) return false;
    const $ = this.$;
    $(".IG_POPUP_DIG").remove();
    this.createDialog();
    $(".IG_POPUP_DIG").addClass("IG_POPUP_DIG_FEEDBACK");
    $(".IG_POPUP_DIG #post_info").text("Feedback Options");

    $(".IG_POPUP_DIG .IG_POPUP_DIG_BODY").append(
      '<div class="insta-loader-dialog-actions"></div>',
    );
    $(".IG_POPUP_DIG .insta-loader-dialog-actions").append(
      `<button type="button" class="IG_REPORT_FORK"><a href="https://github.com/paytonison/insta-loader/issues" target="_blank">${this.translateHtml("REPORT_FORK")}</a></button>`,
    );
    $(".IG_POPUP_DIG .insta-loader-dialog-actions").append(
      `<button type="button" class="IG_REPORT_GITHUB"><a href="https://github.com/paytonison/insta-loader/issues" target="_blank">${this.translateHtml("REPORT_GITHUB")}</a></button>`,
    );
    $(".IG_POPUP_DIG .insta-loader-dialog-actions").append(
      `<button type="button" class="IG_REPORT_DISCORD"><a href="https://discord.gg/q3KT4hdq8x" target="_blank">${this.translateHtml("REPORT_DISCORD")}</a></button>`,
    );
    return true;
  }

  /** @private */
  registerHandlers() {
    const body = this.$("body");
    this.scope.listenJQuery(
      body,
      "click",
      ".IG_POPUP_DIG .IG_POPUP_DIG_BODY .IG_DISPLAY_DOM_TREE",
      () => this.setDomTreeContent(),
    );
    this.scope.listenJQuery(
      body,
      "click",
      ".IG_POPUP_DIG .IG_POPUP_DIG_BODY .IG_SELECT_DOM_TREE",
      () => {
        this.$(".IG_POPUP_DIG .IG_POPUP_DIG_BODY textarea").select();
        this.document.execCommand("copy");
      },
    );
    this.scope.listenJQuery(
      body,
      "click",
      ".IG_POPUP_DIG .IG_POPUP_DIG_BODY .IG_DOWNLOAD_DOM_TREE",
      () => this.downloadDomTree(),
    );
  }

  /** @private */
  setDomTreeContent() {
    const $ = this.$;
    const mount = $('div[id^="mount"]')[0];
    let logText = "";
    const controller = this;
    for (const log of this.getLogs()) {
      const jsonData = JSON.stringify(
        log.content,
        function (_key, value) {
          if (
            Array.isArray(this) &&
            typeof value === "object" &&
            controller.isJQuery(value)
          ) {
            return controller.convertDom(value);
          }
          return value;
        },
        "\t",
      );
      logText += `${new Date(log.time).toISOString()}: ${jsonData}\n`;
    }

    $(".IG_POPUP_DIG .IG_POPUP_DIG_BODY textarea").text(
      "Logger:\n" +
        logText +
        "\n-----\n\nLocation: " +
        this.environment.getLocation().pathname +
        "\nDOM Tree with div#mount:\n" +
        mount.innerHTML,
    );
  }

  /** @private */
  downloadDomTree() {
    const $ = this.$;
    const $textarea = $(".IG_POPUP_DIG .IG_POPUP_DIG_BODY textarea");
    if ($textarea.text().length === 0) this.setDomTreeContent();

    const text = $textarea.text();
    const anchor = this.document.createElement("a");
    const BlobConstructor = this.environment.window.Blob;
    const file = new BlobConstructor([text], { type: "text/plain" });
    const url = this.environment.window.URL.createObjectURL(file);
    this.objectUrls.add(url);
    anchor.href = url;
    anchor.download = `DOMTree-${new Date().getTime()}.txt`;
    this.document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  }

  /** @param {Object} domElements @return {Object[]} @private */
  convertDom(domElements) {
    const converted = [];
    for (const element of domElements) {
      converted.push({
        tagName: element.tagName,
        id: element.id,
        className: element.className,
      });
    }
    return converted;
  }
}
