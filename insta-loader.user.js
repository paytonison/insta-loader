// ==UserScript==
// @name               insta-loader
// @name:ar            insta-loader
// @name:de            insta-loader
// @name:es            insta-loader
// @name:fr            insta-loader
// @name:id            insta-loader
// @name:it            insta-loader
// @name:ja            insta-loader
// @name:ko            insta-loader
// @name:pt-BR         insta-loader
// @name:ro            insta-loader
// @name:ru            insta-loader
// @name:th            insta-loader
// @name:tr            insta-loader
// @name:vi            insta-loader
// @name:zh-CN         insta-loader
// @name:zh-TW         insta-loader
// @namespace          https://github.com/paytonison/insta-loader/
// @version            v1.3.3
// @description        Download photos and videos from Instagram posts in one click, including Stories, Reels, and profile pictures.
// @description:ar     نزّل صورًا ومقاطع فيديو من منشورات Instagram بنقرة واحدة، بما في ذلك القصص وReels وصور الملف الشخصي.
// @description:de     Lade Fotos und Videos aus Instagram-Beiträgen mit einem Klick herunter, einschließlich Stories, Reels und Profilbildern.
// @description:es     Descarga fotos y videos de publicaciones de Instagram con un clic, incluyendo Stories, Reels y fotos de perfil.
// @description:fr     Téléchargez en un clic les photos et vidéos des publications Instagram, y compris les Stories, les Reels et les photos de profil.
// @description:id     Unduh foto dan video dari postingan Instagram dalam satu klik, termasuk Stories, Reels, dan foto profil.
// @description:it     Scarica foto e video dai post di Instagram con un solo clic, incluse Storie, Reels e foto del profilo.
// @description:ja     Instagramの投稿の写真や動画をワンクリックでダウンロード。ストーリー、リール、プロフィール写真にも対応。
// @description:ko     한 번의 클릭으로 Instagram 게시물의 사진과 동영상을 다운로드하고, 스토리, 릴스, 프로필 사진도 지원합니다.
// @description:pt-BR  Baixe fotos e vídeos de publicações do Instagram com um clique, incluindo Stories, Reels e fotos de perfil.
// @description:ro     Descarcă cu un singur clic fotografii și videoclipuri din postările Instagram, inclusiv storyuri, reels și fotografii de profil.
// @description:ru     Скачивайте фото и видео из публикаций Instagram в один клик, включая Stories, Reels и фото профиля.
// @description:th     ดาวน์โหลดรูปภาพและวิดีโอจากโพสต์ Instagram ได้ในคลิกเดียว รวมถึง Stories, Reels และรูปโปรไฟล์.
// @description:tr     Instagram gönderilerindeki fotoğraf ve videoları tek tıkla indirin; Hikayeler, Reels ve profil fotoğrafları da dahildir.
// @description:vi     Tải xuống ảnh và video từ bài viết trên Instagram chỉ với một cú nhấp, bao gồm Stories, Reels và ảnh đại diện.
// @description:zh-CN  一键下载 Instagram 帖子中的照片和视频，还包括快拍、Reels 和头像。
// @description:zh-TW  一鍵下載 Instagram 貼文中的照片、影片，還包含限時動態、Reels 與大頭貼。
// @author             paytonison; based on SN-Koarashi (5026)
// @match              https://*.instagram.com/*
// @grant              GM_addStyle
// @grant              GM_download
// @grant              GM_getValue
// @grant              GM_info
// @grant              GM_notification
// @grant              GM_openInTab
// @grant              GM_registerMenuCommand
// @grant              GM_setValue
// @grant              GM_unregisterMenuCommand
// @grant              GM_xmlhttpRequest
// @connect            cdn.jsdelivr.net
// @connect            *.cdninstagram.com
// @connect            *.fbcdn.net
// @connect            i.instagram.com
// @connect            raw.githubusercontent.com
// @connect            scontent.cdninstagram.com
// @connect            www.instagram.com
// @require            https://cdn.jsdelivr.net/npm/mediabunny@1.34.5/dist/bundles/mediabunny.min.cjs#sha256-wUFR+x2bDvpqgMAVGy2CvGvULyjTGvGy4UUAm8rae5U=
// @require            https://code.jquery.com/jquery-3.7.1.min.js#sha256-/JqT3SQfawRcv/BIHPThkBvs0OEvtFFmqPF/lYI/Cxo=
// @supportURL         https://github.com/paytonison/insta-loader/
// @icon               https://www.google.com/s2/favicons?domain=www.instagram.com&sz=32
// @compatible         chrome >= 100
// @compatible         edge >= 100
// @compatible         firefox >= 100
// @compatible         safari >= 15.4
// @license            GPL-3.0-only
// @run-at             document-start
// @downloadURL        https://raw.githubusercontent.com/paytonison/insta-loader/main/insta-loader.user.js
// @updateURL          https://raw.githubusercontent.com/paytonison/insta-loader/main/insta-loader.user.js
// ==/UserScript==

(() => {
  var __defProp = Object.defineProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };

  // src/core/environment.js
  var SAFARI_USER_AGENT_PATTERN = /^((?!chrome|android|crios|fxios|edgios).)*safari/i;
  function bindCallable(value, owner) {
    return typeof value === "function" ? value.bind(owner) : null;
  }
  function unavailable(name) {
    return function unavailableCapability() {
      throw new Error(`Userscript capability is unavailable: ${name}`);
    };
  }
  function isSafariUserAgent(userAgent) {
    return SAFARI_USER_AGENT_PATTERN.test(String(userAgent || ""));
  }
  function createUserscriptEnvironment(overrides = {}) {
    const root = overrides.globalObject || globalThis;
    const windowObject = overrides.window || root.window || root;
    const gm = overrides.gm || root.GM || {};
    const getValue = bindCallable(overrides.getValue, overrides) || bindCallable(root.GM_getValue, root) || bindCallable(gm.getValue, gm) || unavailable("storage.getValue");
    const setValue = bindCallable(overrides.setValue, overrides) || bindCallable(root.GM_setValue, root) || bindCallable(gm.setValue, gm) || unavailable("storage.setValue");
    const request = bindCallable(overrides.request, overrides) || bindCallable(overrides.xmlHttpRequest, overrides) || bindCallable(root.GM_xmlhttpRequest, root) || bindCallable(gm.xmlHttpRequest, gm) || unavailable("request");
    const downloadImpl = bindCallable(overrides.download, overrides) || bindCallable(root.GM_download, root) || bindCallable(gm.download, gm);
    const download = downloadImpl || unavailable("download");
    const registerMenuCommand = bindCallable(overrides.registerMenuCommand, overrides) || bindCallable(root.GM_registerMenuCommand, root) || bindCallable(gm.registerMenuCommand, gm) || unavailable("menu.register");
    const unregisterMenuCommand = bindCallable(overrides.unregisterMenuCommand, overrides) || bindCallable(root.GM_unregisterMenuCommand, root) || bindCallable(gm.unregisterMenuCommand, gm) || unavailable("menu.unregister");
    const notify = bindCallable(overrides.notify, overrides) || bindCallable(overrides.notification, overrides) || bindCallable(root.GM_notification, root) || bindCallable(gm.notification, gm) || unavailable("notification");
    const openInTab = bindCallable(overrides.openInTab, overrides) || bindCallable(root.GM_openInTab, root) || bindCallable(gm.openInTab, gm) || unavailable("tab.open");
    const addStyle = bindCallable(overrides.addStyle, overrides) || bindCallable(root.GM_addStyle, root) || bindCallable(gm.addStyle, gm) || unavailable("style.add");
    const setTimeoutImpl = bindCallable(overrides.setTimeout, overrides) || bindCallable(windowObject.setTimeout, windowObject) || unavailable("timer.setTimeout");
    const clearTimeoutImpl = bindCallable(overrides.clearTimeout, overrides) || bindCallable(windowObject.clearTimeout, windowObject) || unavailable("timer.clearTimeout");
    const setIntervalImpl = bindCallable(overrides.setInterval, overrides) || bindCallable(windowObject.setInterval, windowObject) || unavailable("timer.setInterval");
    const clearIntervalImpl = bindCallable(overrides.clearInterval, overrides) || bindCallable(windowObject.clearInterval, windowObject) || unavailable("timer.clearInterval");
    const nativeRequestAnimationFrame = bindCallable(overrides.requestAnimationFrame, overrides) || bindCallable(windowObject.requestAnimationFrame, windowObject);
    const nativeCancelAnimationFrame = bindCallable(overrides.cancelAnimationFrame, overrides) || bindCallable(windowObject.cancelAnimationFrame, windowObject);
    const nativeRequestIdleCallback = bindCallable(overrides.requestIdleCallback, overrides) || bindCallable(windowObject.requestIdleCallback, windowObject);
    const nativeCancelIdleCallback = bindCallable(overrides.cancelIdleCallback, overrides) || bindCallable(windowObject.cancelIdleCallback, windowObject);
    const requestAnimationFrame = nativeRequestAnimationFrame || ((callback) => setTimeoutImpl(() => callback(now()), 16));
    const cancelAnimationFrame = nativeCancelAnimationFrame || ((handle) => clearTimeoutImpl(handle));
    const requestIdleCallback = nativeRequestIdleCallback || ((callback) => setTimeoutImpl(
      () => callback({ didTimeout: false, timeRemaining: () => 0 }),
      1
    ));
    const cancelIdleCallback = nativeCancelIdleCallback || ((handle) => clearTimeoutImpl(handle));
    const queueMicrotaskImpl = bindCallable(overrides.queueMicrotask, overrides) || bindCallable(windowObject.queueMicrotask, windowObject) || ((callback) => Promise.resolve().then(callback));
    const now = bindCallable(overrides.now, overrides) || bindCallable(root.Date?.now, root.Date) || Date.now;
    const userAgent = String(
      overrides.userAgent ?? windowObject.navigator?.userAgent ?? ""
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
            return typeof windowObject.HTMLVideoElement?.prototype?.requestVideoFrameCallback === "function";
          case "MutationObserver":
          case "IntersectionObserver":
          case "PerformanceObserver":
            return typeof windowObject[name] === "function";
          case "GM_download":
            return downloadImpl != null;
          default:
            return typeof windowObject[name] === "function";
        }
      }
    });
    const environment2 = {
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
      scriptInfo: overrides.scriptInfo ?? root.GM_info ?? gm.info ?? null
    };
    return Object.freeze(environment2);
  }

  // src/core/disposable-scope.js
  var DisposableScope = class _DisposableScope {
    /**
     * @param {Object} environment
     * @param {{onError?: (error: *) => void}} [options]
     */
    constructor(environment2, options = {}) {
      if (!environment2) {
        throw new TypeError("DisposableScope requires an environment.");
      }
      this.environment = environment2;
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
      const cleanup = disposer || ((value) => {
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
      release = this.defer(
        () => this.environment.cancelAnimationFrame(handle)
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
      if (this._disposed) return () => {
      };
      if (typeof target?.addEventListener !== "function") {
        throw new TypeError("The event target does not support addEventListener().");
      }
      target.addEventListener(type, listener, options);
      return this.defer(
        () => target.removeEventListener(type, listener, options)
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
      if (this._disposed) return () => {
      };
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
        new _DisposableScope(this.environment, { onError: this.onError })
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
        if (error !== void 0) errors.push(error);
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
      if (!record.active) return void 0;
      record.active = false;
      try {
        record.cleanup();
        return void 0;
      } catch (error) {
        this.onError?.(error);
        return error;
      }
    }
  };

  // src/core/routes.js
  var ROUTE_KIND = Object.freeze({
    IGNORED: "ignored",
    FEED: "feed",
    POST: "post",
    PROFILE: "profile",
    STORY: "story",
    HIGHLIGHT: "highlight",
    REEL: "reel",
    REELS: "reels",
    UNSUPPORTED: "unsupported"
  });
  var USERNAME_PATTERN = /^[0-9A-Za-z._-]+$/;
  var REEL_USERNAME_PATTERN = /^[A-Za-z0-9._]+$/;
  var SHORTCODE_PATTERN = /^[A-Za-z0-9_-]{5,64}$/;
  var RESERVED_REELS_COLLECTIONS = /* @__PURE__ */ new Set(["audio", "explore", "saved"]);
  var IGNORED_PATH_PATTERN = /^\/(explore(\/.*)?|challenge\/?.*|direct\/?.*|qr\/?|accounts\/.*|emails\/.*|language\/?.*?|your_activity\/?.*|settings\/help(\/.*)?)$/i;
  function toUrl(value, baseUrl = "https://www.instagram.com/") {
    try {
      if (value && typeof value === "object" && "href" in value) {
        return new URL(String(value.href), baseUrl);
      }
      return new URL(String(value), baseUrl);
    } catch (_error) {
      return null;
    }
  }
  function parseMaximumReelShortcode(value, directOnly = false, baseUrl = "https://www.instagram.com/") {
    const url = toUrl(value, baseUrl);
    const base = toUrl(baseUrl, "https://www.instagram.com/");
    if (!url || !base) return null;
    if (url.hostname !== base.hostname && url.hostname !== "instagram.com" && !url.hostname.endsWith(".instagram.com")) {
      return null;
    }
    const segments = url.pathname.split("/").filter(Boolean);
    let route = null;
    let shortcode = null;
    if (["reel", "reels"].includes(segments[0]?.toLowerCase()) && (segments.length === 2 || directOnly && segments.length === 3 && segments[2].toLowerCase() === "embed")) {
      route = segments[0].toLowerCase();
      shortcode = segments[1];
    } else if (segments.length === 3 && REEL_USERNAME_PATTERN.test(segments[0]) && ["reel", "reels"].includes(segments[1]?.toLowerCase())) {
      route = segments[1].toLowerCase();
      shortcode = segments[2];
    }
    if (!route || !shortcode) return null;
    if (route === "reels" && RESERVED_REELS_COLLECTIONS.has(shortcode.toLowerCase())) {
      return null;
    }
    return SHORTCODE_PATTERN.test(shortcode) ? shortcode : null;
  }
  function getMaximumReelPlaybackRouteShortcode(value, baseUrl = "https://www.instagram.com/") {
    const shortcode = parseMaximumReelShortcode(value, true, baseUrl);
    if (!shortcode) return null;
    const url = toUrl(value, baseUrl);
    if (!url) return null;
    const segments = url.pathname.split("/").filter(Boolean);
    const directStandalone = segments[0]?.toLowerCase() === "reel" && (segments.length === 2 || segments.length === 3 && segments[2].toLowerCase() === "embed");
    const usernameStandalone = segments.length === 3 && REEL_USERNAME_PATTERN.test(segments[0]) && segments[1]?.toLowerCase() === "reel";
    return directStandalone || usernameStandalone ? shortcode : null;
  }
  function isMaximumReelFeedRoute(value, baseUrl = "https://www.instagram.com/") {
    const url = toUrl(value, baseUrl);
    if (!url) return false;
    const segments = url.pathname.split("/").filter(Boolean);
    return segments[0]?.toLowerCase() === "reels" || segments.length >= 2 && REEL_USERNAME_PATTERN.test(segments[0]) && segments[1]?.toLowerCase() === "reels";
  }
  function classifyInstagramRoute(value, options = {}) {
    const url = toUrl(value, options.baseUrl);
    if (!url) {
      return createRoute(null, ROUTE_KIND.IGNORED, {
        ignoredReason: "invalid-url",
        href: String(value || "")
      });
    }
    const pathname = url.pathname;
    const segments = pathname.split("/").filter(Boolean);
    const nativeReelsFeed = isMaximumReelFeedRoute(url.href, url.origin);
    if (options.splashVisible) {
      return createRoute(url, ROUTE_KIND.IGNORED, {
        ignoredReason: "splash-screen",
        nativeReelsFeed
      });
    }
    if (!url.hostname.startsWith("www.")) {
      return createRoute(url, ROUTE_KIND.IGNORED, {
        ignoredReason: "unsupported-host",
        nativeReelsFeed
      });
    }
    if (IGNORED_PATH_PATTERN.test(pathname) || pathname.startsWith("/auth_platform/codeentry/") || pathname.startsWith("/challenge/") || pathname.startsWith("/consent/") || pathname.startsWith("/accounts/")) {
      return createRoute(url, ROUTE_KIND.IGNORED, {
        ignoredReason: "ignored-path",
        nativeReelsFeed
      });
    }
    if (options.followersDialogOpen && (pathname.endsWith("/followers/") || pathname.endsWith("/following/"))) {
      return createRoute(url, ROUTE_KIND.IGNORED, {
        ignoredReason: "relationship-dialog",
        nativeReelsFeed
      });
    }
    if (pathname === "/") {
      return createRoute(url, ROUTE_KIND.FEED);
    }
    if (pathname.startsWith("/stories/highlights/")) {
      return createRoute(url, ROUTE_KIND.HIGHLIGHT, {
        shortcode: segments[2] || null
      });
    }
    if (pathname.startsWith("/stories/")) {
      return createRoute(url, ROUTE_KIND.STORY, {
        username: segments[1] || null,
        shortcode: segments[2] || null
      });
    }
    const isDirectPost = segments[0]?.toLowerCase() === "p";
    const isUsernamePost = segments.length >= 3 && USERNAME_PATTERN.test(segments[0]) && segments[1]?.toLowerCase() === "p";
    if (isDirectPost || isUsernamePost) {
      const shortcode = isDirectPost ? segments[1] : segments[2];
      const embedSegment = isDirectPost ? segments[2] : segments[3];
      return createRoute(url, ROUTE_KIND.POST, {
        username: isUsernamePost ? segments[0] : null,
        shortcode: shortcode || null,
        isEmbed: embedSegment?.toLowerCase() === "embed",
        nativeReelsFeed
      });
    }
    const reelShortcode = getMaximumReelPlaybackRouteShortcode(url.href, url.origin);
    if (reelShortcode) {
      const username = segments[1]?.toLowerCase() === "reel" ? segments[0] : null;
      return createRoute(url, ROUTE_KIND.REEL, {
        username,
        shortcode: reelShortcode,
        isEmbed: segments.at(-1)?.toLowerCase() === "embed",
        playbackEligible: true,
        nativeReelsFeed
      });
    }
    if (segments[0]?.toLowerCase() === "reels") {
      return createRoute(url, ROUTE_KIND.REELS, {
        shortcode: parseMaximumReelShortcode(url.href, false, url.origin),
        section: segments[1]?.toLowerCase() || null,
        nativeReelsFeed: true
      });
    }
    const profileMatch = pathname.match(
      /^\/([0-9A-Za-z._-]+)\/?(tagged|reels|saved)?\/?$/i
    );
    if (profileMatch) {
      return createRoute(url, ROUTE_KIND.PROFILE, {
        username: profileMatch[1],
        section: profileMatch[2]?.toLowerCase() || null,
        nativeReelsFeed
      });
    }
    if (nativeReelsFeed) {
      return createRoute(url, ROUTE_KIND.UNSUPPORTED, {
        username: segments[0] || null,
        shortcode: parseMaximumReelShortcode(url.href, false, url.origin),
        section: segments[2]?.toLowerCase() || null,
        nativeReelsFeed: true
      });
    }
    return createRoute(url, ROUTE_KIND.UNSUPPORTED);
  }
  function createRoute(url, kind, values = {}) {
    return Object.freeze({
      kind,
      href: values.href ?? url?.href ?? "",
      origin: url?.origin || "",
      hostname: url?.hostname || "",
      pathname: url?.pathname || "",
      search: url?.search || "",
      hash: url?.hash || "",
      username: values.username ?? null,
      shortcode: values.shortcode ?? null,
      section: values.section ?? null,
      isEmbed: values.isEmbed ?? false,
      playbackEligible: values.playbackEligible ?? false,
      nativeReelsFeed: values.nativeReelsFeed ?? false,
      ignoredReason: values.ignoredReason ?? null
    });
  }

  // src/core/route-coordinator.js
  var ROUTE_POLL_INTERVAL = Object.freeze({
    DEFAULT: 500,
    SAFARI: 750
  });
  function routePollIntervalFor(environment2) {
    return environment2?.browser?.isSafari ? ROUTE_POLL_INTERVAL.SAFARI : ROUTE_POLL_INTERVAL.DEFAULT;
  }
  var RouteCoordinator = class {
    /**
     * @param {Object} options
     * @param {Object} options.environment
     * @param {(route: *, context: RouteContext) => (FeatureController|FeatureController[]|null|undefined)} options.controllerFactory
     * @param {(value: *, options?: Object) => *} [options.classify]
     * @param {() => Object} [options.getClassificationOptions]
     * @param {() => boolean} [options.isReady]
     * @param {(error: *, context: Object) => void} [options.onError]
     * @param {number} [options.pollInterval]
     * @param {boolean} [options.refreshOnUnchanged=false]
     */
    constructor(options) {
      if (!options?.environment) {
        throw new TypeError("RouteCoordinator requires an environment.");
      }
      if (typeof options.controllerFactory !== "function") {
        throw new TypeError("RouteCoordinator requires a controllerFactory().");
      }
      this.environment = options.environment;
      this.controllerFactory = options.controllerFactory;
      this.classify = options.classify || classifyInstagramRoute;
      this.getClassificationOptions = options.getClassificationOptions || (() => ({}));
      this.isReady = options.isReady || (() => this._documentIsReady());
      this.onError = options.onError || (() => {
      });
      this.pollInterval = Number.isFinite(options.pollInterval) && options.pollInterval > 0 ? Math.floor(options.pollInterval) : routePollIntervalFor(this.environment);
      this.refreshOnUnchanged = options.refreshOnUnchanged === true;
      this._running = false;
      this._pollHandle = null;
      this._routeScope = null;
      this._route = null;
      this._controllers = [];
    }
    /** @return {boolean} */
    get running() {
      return this._running;
    }
    /** @return {*|null} */
    get currentRoute() {
      return this._route;
    }
    /**
     * Begin the compatibility polling fallback and immediately inspect the
     * current route. Calling start more than once never creates another timer.
     *
     * @param {string} [reason]
     * @return {void}
     */
    start(reason = "start") {
      if (this._running) return;
      this._running = true;
      this.check(reason, true);
      this._pollHandle = this.environment.setInterval(
        () => this.check("poll"),
        this.pollInterval
      );
    }
    /**
     * Stop polling. Active route work remains mounted until `dispose()` or
     * `reload()` so callers can temporarily suspend navigation detection.
     *
     * @return {void}
     */
    stop() {
      if (!this._running) return;
      this._running = false;
      if (this._pollHandle != null) {
        this.environment.clearInterval(this._pollHandle);
        this._pollHandle = null;
      }
    }
    /**
     * @param {string} [reason]
     * @param {boolean} [force]
     * @return {*|null}
     */
    check(reason = "check", force = false) {
      if (!this.isReady()) return this._route;
      const location2 = this.environment.getLocation();
      const nextRoute = this.classify(
        location2?.href || location2,
        this.getClassificationOptions()
      );
      if (!force && this._routeScope != null && sameRoute(this._route, nextRoute)) {
        if (this.refreshOnUnchanged) {
          this.refresh({ reason, route: nextRoute, type: "route-poll" });
        }
        return this._route;
      }
      this._transition(nextRoute, reason);
      return nextRoute;
    }
    /**
     * Send a DOM or feature-specific change to the currently mounted
     * controllers without remounting the route.
     *
     * @param {*} change
     * @return {void}
     */
    refresh(change) {
      for (const controller of [...this._controllers]) {
        try {
          const result = controller.refresh(change);
          Promise.resolve(result).catch(
            (error) => this.onError(error, {
              phase: "refresh",
              route: this._route,
              controller
            })
          );
        } catch (error) {
          this.onError(error, {
            phase: "refresh",
            route: this._route,
            controller
          });
        }
      }
    }
    /**
     * Dispose every route-owned resource and mount the current location again.
     *
     * @param {string} [reason]
     * @return {*|null}
     */
    reload(reason = "reload") {
      this._disposeRoute();
      return this.check(reason, true);
    }
    /**
     * Stop polling and dispose the active route exactly once.
     *
     * @return {void}
     */
    dispose() {
      this.stop();
      this._disposeRoute();
      this._route = null;
    }
    /**
     * @param {*} nextRoute
     * @param {string} reason
     * @return {void}
     * @private
     */
    _transition(nextRoute, reason) {
      const previousRoute = this._route;
      this._disposeRoute();
      this._route = nextRoute;
      const scope = new DisposableScope(this.environment, {
        onError: (error) => this.onError(error, { phase: "cleanup", route: nextRoute })
      });
      this._routeScope = scope;
      const context = {
        route: nextRoute,
        previousRoute,
        scope,
        environment: this.environment,
        reason
      };
      let created;
      try {
        created = this.controllerFactory(nextRoute, context);
      } catch (error) {
        this.onError(error, { phase: "create", route: nextRoute });
        return;
      }
      const controllers = Array.isArray(created) ? created.filter(Boolean) : created ? [created] : [];
      for (const controller of controllers) {
        if (!isFeatureController(controller)) {
          this.onError(
            new TypeError(
              "A feature controller must expose mount(), refresh(), and dispose()."
            ),
            { phase: "create", route: nextRoute, controller }
          );
          continue;
        }
        this._controllers.push(controller);
        scope.defer(() => {
          try {
            const result = controller.dispose();
            Promise.resolve(result).catch(
              (error) => this.onError(error, {
                phase: "dispose",
                route: nextRoute,
                controller
              })
            );
          } catch (error) {
            this.onError(error, {
              phase: "dispose",
              route: nextRoute,
              controller
            });
          }
        });
        try {
          const result = controller.mount(context);
          Promise.resolve(result).catch(
            (error) => this.onError(error, {
              phase: "mount",
              route: nextRoute,
              controller
            })
          );
        } catch (error) {
          this.onError(error, {
            phase: "mount",
            route: nextRoute,
            controller
          });
        }
      }
    }
    /**
     * @return {void}
     * @private
     */
    _disposeRoute() {
      this._routeScope?.dispose();
      this._routeScope = null;
      this._controllers = [];
    }
    /**
     * @return {boolean}
     * @private
     */
    _documentIsReady() {
      if (typeof this.environment.getDocument !== "function") return true;
      const document2 = this.environment.getDocument();
      return !document2 || Boolean(document2.body);
    }
  };
  function isFeatureController(value) {
    return typeof value?.mount === "function" && typeof value?.refresh === "function" && typeof value?.dispose === "function";
  }
  function sameRoute(left, right) {
    return left != null && right != null && left.href === right.href && left.kind === right.kind && left.ignoredReason === right.ignoredReason;
  }

  // src/core/settings-store.js
  var USER_SETTING_DEFAULTS = Object.freeze({
    AUTO_RENAME: true,
    CAPTURE_IMAGE_VIA_MEDIA_CACHE: false,
    CHECK_FOR_UPDATE: false,
    DIRECT_DOWNLOAD_ALL: true,
    DIRECT_DOWNLOAD_STORY: true,
    DIRECT_DOWNLOAD_VISIBLE_RESOURCE: true,
    DISABLE_VIDEO_LOOPING: false,
    FALLBACK_TO_BLOB_FETCH_IF_MEDIA_API_THROTTLED: false,
    FORCE_FETCH_ALL_RESOURCES: true,
    FORCE_RESOURCE_VIA_MEDIA: true,
    HTML5_VIDEO_CONTROL: false,
    MAX_REEL_PLAYBACK_QUALITY: true,
    MODIFY_RESOURCE_EXIF: false,
    MODIFY_VIDEO_VOLUME: false,
    NEW_TAB_ALWAYS_FORCE_MEDIA_IN_POST: true,
    PREFER_DASH_MANIFEST: true,
    REDIRECT_CLICK_USER_STORY_PICTURE: false,
    RENAME_PUBLISH_DATE: true,
    SCROLL_BUTTON: false,
    SKIP_VIEW_STORY_CONFIRM: true,
    SKIP_SHARED_WITH_YOU_DIALOG: true
  });
  var USER_SETTING_KEYS = Object.freeze(
    Object.keys(USER_SETTING_DEFAULTS)
  );
  var USER_SETTING_HIERARCHY = Object.freeze({
    AUTO_RENAME: Object.freeze(["RENAME_PUBLISH_DATE"]),
    FORCE_RESOURCE_VIA_MEDIA: Object.freeze([
      "FALLBACK_TO_BLOB_FETCH_IF_MEDIA_API_THROTTLED",
      "NEW_TAB_ALWAYS_FORCE_MEDIA_IN_POST",
      "PREFER_DASH_MANIFEST"
    ])
  });
  var SettingsStore = class {
    /**
     * @param {{getValue: (key: string, defaultValue?: *) => *, setValue: (key: string, value: *) => *}} storage
     * @param {Object<string, boolean>} [defaults]
     */
    constructor(storage, defaults = USER_SETTING_DEFAULTS) {
      if (typeof storage?.getValue !== "function" || typeof storage?.setValue !== "function") {
        throw new TypeError(
          "SettingsStore requires getValue() and setValue() storage methods."
        );
      }
      this.storage = storage;
      this.defaults = Object.freeze({ ...defaults });
      this.keys = Object.freeze(Object.keys(this.defaults));
      this._values = { ...this.defaults };
      this._storedBooleans = /* @__PURE__ */ new Set();
      this._listeners = /* @__PURE__ */ new Set();
      this._loaded = false;
      for (const key of this.keys) {
        if (typeof this.defaults[key] !== "boolean") {
          throw new TypeError(`Setting default ${key} must be boolean.`);
        }
      }
    }
    /** @return {boolean} */
    get loaded() {
      return this._loaded;
    }
    /**
     * Rebuild the in-memory values from source defaults and stored booleans.
     * A missing, null, or non-boolean stored value deliberately has no effect.
     *
     * @return {Object<string, boolean>}
     */
    load() {
      this._values = { ...this.defaults };
      this._storedBooleans.clear();
      for (const key of this.keys) {
        const stored = this.storage.getValue(key);
        if (typeof stored === "boolean") {
          this._values[key] = stored;
          this._storedBooleans.add(key);
        }
      }
      this._loaded = true;
      return this.snapshot();
    }
    /**
     * @param {UserSettingName|string} name
     * @return {boolean}
     */
    get(name) {
      this._assertKnown(name);
      return this._values[name];
    }
    /**
     * Persist one checkbox value immediately and update the live store. Settings
     * dependencies remain visual-only; setting a parent never rewrites a child.
     *
     * @param {UserSettingName|string} name
     * @param {boolean} value
     * @return {*}
     */
    set(name, value) {
      this._assertKnown(name);
      if (typeof value !== "boolean") {
        throw new TypeError(`Setting ${name} must be boolean.`);
      }
      const previousValue = this._values[name];
      const result = this.storage.setValue(name, value);
      this._values[name] = value;
      this._emit({
        name,
        value,
        previousValue,
        source: "user"
      });
      return result;
    }
    /**
     * Whether startup found an actual stored boolean for this setting. This is
     * intentionally distinct from its effective value: the legacy startup only
     * resets the in-memory saved volume when `MODIFY_VIDEO_VOLUME=false` was
     * explicitly stored, not merely because its source default is false.
     *
     * @param {UserSettingName|string} name
     * @return {boolean}
     */
    wasLoadedFromStorage(name) {
      this._assertKnown(name);
      return this._storedBooleans.has(name);
    }
    /**
     * @return {Object<string, boolean>}
     */
    snapshot() {
      return { ...this._values };
    }
    /**
     * @param {(change: SettingChange) => void} listener
     * @return {() => void}
     */
    subscribe(listener) {
      if (typeof listener !== "function") {
        throw new TypeError("A settings listener must be a function.");
      }
      this._listeners.add(listener);
      return () => this._listeners.delete(listener);
    }
    /**
     * @param {string} name
     * @return {void}
     * @private
     */
    _assertKnown(name) {
      if (!Object.prototype.hasOwnProperty.call(this.defaults, name)) {
        throw new RangeError(`Unknown setting: ${name}`);
      }
    }
    /**
     * @param {SettingChange} change
     * @return {void}
     * @private
     */
    _emit(change) {
      for (const listener of this._listeners) listener(change);
    }
  };

  // src/core/preferences-store.js
  var PREFERENCE_STORAGE_KEYS = Object.freeze({
    RENAME_FORMAT: "G_RENAME_FORMAT",
    LANGUAGE: "UI_LANGUAGE",
    HOTKEY_DEBUG_KEYCODE: "G_HOTKEY_DEBUG_KEYCODE",
    HOTKEY_SETTINGS_KEYCODE: "G_HOTKEY_SETTINGS_KEYCODE",
    HOTKEY_KEY_SETTINGS_KEYCODE: "G_HOTKEY_KEY_SETTINGS_KEYCODE",
    HOTKEY_DOWNLOAD_STORY_KEYCODE: "G_HOTKEY_DOWNLOAD_STORY_KEYCODE",
    CHECK_TIMESTAMP: "G_CHECK_TIMESTAMP",
    IMAGE_CACHE: "URLS_OF_IMAGES_TEMPORARILY_STORED"
  });
  var DEFAULT_RENAME_FORMAT = "%USERNAME%-%SOURCE_TYPE%-%SHORTCODE%-%YEAR%%MONTH%%DAY%_%HOUR%%MINUTE%%SECOND%_%ORIGINAL_NAME_FIRST%";
  var HOTKEY_PREFERENCE = Object.freeze({
    DEBUG: "debug",
    SETTINGS: "settings",
    KEY_SETTINGS: "keySettings",
    DOWNLOAD_STORY: "downloadStory"
  });
  var HOTKEY_DEFAULTS = Object.freeze({
    [HOTKEY_PREFERENCE.DEBUG]: 90,
    [HOTKEY_PREFERENCE.SETTINGS]: 87,
    [HOTKEY_PREFERENCE.KEY_SETTINGS]: 67,
    [HOTKEY_PREFERENCE.DOWNLOAD_STORY]: 83
  });
  var HOTKEY_STORAGE_KEYS = Object.freeze({
    [HOTKEY_PREFERENCE.DEBUG]: PREFERENCE_STORAGE_KEYS.HOTKEY_DEBUG_KEYCODE,
    [HOTKEY_PREFERENCE.SETTINGS]: PREFERENCE_STORAGE_KEYS.HOTKEY_SETTINGS_KEYCODE,
    [HOTKEY_PREFERENCE.KEY_SETTINGS]: PREFERENCE_STORAGE_KEYS.HOTKEY_KEY_SETTINGS_KEYCODE,
    [HOTKEY_PREFERENCE.DOWNLOAD_STORY]: PREFERENCE_STORAGE_KEYS.HOTKEY_DOWNLOAD_STORY_KEYCODE
  });
  var PreferencesStore = class {
    /**
     * @param {{getValue: (key: string, defaultValue?: *) => *, setValue: (key: string, value: *) => *}} storage
     * @param {{defaultLanguage?: *, now?: () => number}} [options]
     */
    constructor(storage, options = {}) {
      if (typeof storage?.getValue !== "function" || typeof storage?.setValue !== "function") {
        throw new TypeError(
          "PreferencesStore requires getValue() and setValue() storage methods."
        );
      }
      if (options.now != null && typeof options.now !== "function") {
        throw new TypeError("PreferencesStore now must be a function.");
      }
      this.storage = storage;
      this.defaultLanguage = options.defaultLanguage;
      this.now = options.now || Date.now;
      this._renameFormat = DEFAULT_RENAME_FORMAT;
      this._language = this.defaultLanguage;
      this._hotkeys = { ...HOTKEY_DEFAULTS };
      this._loaded = false;
    }
    /** @return {boolean} */
    get loaded() {
      return this._loaded;
    }
    /**
     * Apply the legacy truthiness precedence used at startup. Empty strings,
     * zero, false, null, and undefined all fall back; other values are retained
     * without coercion.
     *
     * @return {PreferenceSnapshot}
     */
    load() {
      this._renameFormat = this._readTruthy(
        PREFERENCE_STORAGE_KEYS.RENAME_FORMAT,
        DEFAULT_RENAME_FORMAT
      );
      this._language = this._readTruthy(
        PREFERENCE_STORAGE_KEYS.LANGUAGE,
        this.defaultLanguage
      );
      this._hotkeys = {};
      for (const name of Object.values(HOTKEY_PREFERENCE)) {
        this._hotkeys[name] = this._readTruthy(
          HOTKEY_STORAGE_KEYS[name],
          HOTKEY_DEFAULTS[name]
        );
      }
      this._loaded = true;
      return this.snapshot();
    }
    /** @return {*} */
    getRenameFormat() {
      return this._renameFormat;
    }
    /**
     * @param {*} value
     * @return {*}
     */
    setRenameFormat(value) {
      this._renameFormat = value;
      this.storage.setValue(PREFERENCE_STORAGE_KEYS.RENAME_FORMAT, value);
      return value;
    }
    /** @return {*} */
    getLanguage() {
      return this._language;
    }
    /**
     * @param {*} value
     * @return {*}
     */
    setLanguage(value) {
      this._language = value;
      this.storage.setValue(PREFERENCE_STORAGE_KEYS.LANGUAGE, value);
      return value;
    }
    /**
     * @param {HotkeyPreference|string} name
     * @return {*}
     */
    getHotkey(name) {
      this._assertHotkey(name);
      return this._hotkeys[name];
    }
    /**
     * @param {HotkeyPreference|string} name
     * @param {*} value
     * @return {*}
     */
    setHotkey(name, value) {
      this._assertHotkey(name);
      this._hotkeys[name] = value;
      this.storage.setValue(HOTKEY_STORAGE_KEYS[name], value);
      return value;
    }
    /**
     * Read the update timestamp lazily so disabling update checks continues to
     * avoid touching its storage key. Only null and undefined fall back to now;
     * stored zero, false, and empty-string values remain observable.
     *
     * @return {*}
     */
    getCheckTimestamp() {
      return this.storage.getValue(PREFERENCE_STORAGE_KEYS.CHECK_TIMESTAMP) ?? this.now();
    }
    /**
     * @param {*} [value]
     * @return {*}
     */
    setCheckTimestamp(value = this.now()) {
      this.storage.setValue(PREFERENCE_STORAGE_KEYS.CHECK_TIMESTAMP, value);
      return value;
    }
    /**
     * Read the image-cache payload without imposing a shape or cloning it. The
     * image-cache service remains responsible for validation, expiry, and size.
     *
     * @param {*} [defaultValue]
     * @return {*}
     */
    getImageCache(defaultValue = {}) {
      return this.storage.getValue(
        PREFERENCE_STORAGE_KEYS.IMAGE_CACHE,
        defaultValue
      );
    }
    /**
     * @param {*} value
     * @return {*}
     */
    setImageCache(value) {
      return this.storage.setValue(PREFERENCE_STORAGE_KEYS.IMAGE_CACHE, value);
    }
    /**
     * @return {PreferenceSnapshot}
     */
    snapshot() {
      return {
        renameFormat: this._renameFormat,
        language: this._language,
        hotkeys: { ...this._hotkeys }
      };
    }
    /**
     * @param {string} key
     * @param {*} fallback
     * @return {*}
     * @private
     */
    _readTruthy(key, fallback) {
      const stored = this.storage.getValue(key);
      return stored ? stored : fallback;
    }
    /**
     * @param {string} name
     * @return {void}
     * @private
     */
    _assertHotkey(name) {
      if (!Object.prototype.hasOwnProperty.call(HOTKEY_DEFAULTS, name)) {
        throw new RangeError(`Unknown hotkey preference: ${name}`);
      }
    }
  };

  // src/core/request.js
  var REQUEST_ERROR_CATEGORY = Object.freeze({
    NETWORK: "network",
    HTTP: "http",
    LOGIN: "login",
    RATE_LIMIT: "rate-limit",
    PARSE: "parse",
    API: "api",
    TIMEOUT: "timeout",
    ABORT: "abort"
  });
  var REQUEST_ERROR_CATEGORIES = new Set(
    Object.values(REQUEST_ERROR_CATEGORY)
  );
  var LOGIN_REDIRECT_PATTERN = /\/(accounts\/login|challenge|checkpoint)\b/i;
  var RATE_LIMIT_PATTERN = /rate|limit|throttl|please wait|try again later/i;
  var RequestError = class extends Error {
    /**
     * @param {string} category
     * @param {string} message
     * @param {{cause?: *, status?: number|null, url?: string, response?: *, details?: *, retryable?: boolean}} [options]
     */
    constructor(category, message, options = {}) {
      if (!REQUEST_ERROR_CATEGORIES.has(category)) {
        throw new RangeError(`Unknown request error category: ${category}`);
      }
      super(message);
      this.name = "RequestError";
      this.category = category;
      this.code = category;
      this.cause = options.cause;
      this.status = options.status ?? null;
      this.url = options.url || "";
      this.response = options.response;
      this.details = options.details;
      this.rateLimited = category === REQUEST_ERROR_CATEGORY.RATE_LIMIT;
      this.retryable = options.retryable ?? [
        REQUEST_ERROR_CATEGORY.NETWORK,
        REQUEST_ERROR_CATEGORY.RATE_LIMIT,
        REQUEST_ERROR_CATEGORY.TIMEOUT
      ].includes(category);
    }
  };
  function requestJson(environment2, options) {
    if (!options || typeof options.url !== "string" || options.url === "") {
      throw new TypeError("requestJson() requires a non-empty URL.");
    }
    const send = typeof environment2 === "function" ? environment2 : environment2?.request?.bind(environment2);
    if (typeof send !== "function") {
      throw new TypeError("requestJson() requires a request function.");
    }
    let handle = null;
    let settled = false;
    let rejectPromise;
    let removeSignalListener = () => {
    };
    const promise = new Promise((resolve, reject) => {
      rejectPromise = reject;
      const settle = (callback, value) => {
        if (settled) return;
        settled = true;
        removeSignalListener();
        callback(value);
      };
      const rejectWith = (error) => settle(reject, error);
      const abortFromSignal = () => {
        const reason = options.signal?.reason;
        rejectWith(
          new RequestError(
            REQUEST_ERROR_CATEGORY.ABORT,
            typeof reason === "string" ? reason : "The request was cancelled.",
            { cause: reason, url: options.url }
          )
        );
        try {
          handle?.abort?.();
        } catch (_error) {
        }
      };
      if (options.signal?.aborted) {
        abortFromSignal();
        return;
      }
      if (options.signal) {
        options.signal.addEventListener("abort", abortFromSignal, { once: true });
        removeSignalListener = () => options.signal.removeEventListener("abort", abortFromSignal);
      }
      const timeout = Number(options.timeout);
      const details = {
        ...options.requestDetails || {},
        method: options.method || "GET",
        url: options.url,
        headers: options.headers,
        data: options.data,
        timeout: Number.isFinite(timeout) && timeout > 0 ? Math.floor(timeout) : void 0,
        onload(response) {
          try {
            const status = Number(response?.status) || 200;
            if (status === 429) {
              throw new RequestError(
                REQUEST_ERROR_CATEGORY.RATE_LIMIT,
                "The server rate-limited the request.",
                { status, url: options.url, response }
              );
            }
            if (status < 200 || status >= 300) {
              throw new RequestError(
                REQUEST_ERROR_CATEGORY.HTTP,
                `The request returned HTTP ${status}.`,
                { status, url: options.url, response }
              );
            }
            const finalUrl = String(response?.finalUrl || "");
            if (LOGIN_REDIRECT_PATTERN.test(finalUrl)) {
              throw new RequestError(
                REQUEST_ERROR_CATEGORY.LOGIN,
                "The request was redirected to a login or checkpoint page.",
                { status, url: finalUrl || options.url, response }
              );
            }
            const body = response?.response != null && response.response !== "" ? response.response : response?.responseText;
            if (typeof body === "string" && /^\s*</.test(body)) {
              throw new RequestError(
                REQUEST_ERROR_CATEGORY.PARSE,
                "The server returned HTML instead of JSON.",
                { status, url: options.url, response }
              );
            }
            let data;
            try {
              data = typeof body === "string" ? JSON.parse(body) : body;
            } catch (error) {
              throw new RequestError(
                REQUEST_ERROR_CATEGORY.PARSE,
                "The response could not be parsed as JSON.",
                { cause: error, status, url: options.url, response }
              );
            }
            if (options.detectApiErrors !== false) {
              const apiError = findApiError(data, options.url, status, response);
              if (apiError) throw apiError;
            }
            if (options.validate) {
              let valid;
              try {
                valid = options.validate(data, response);
              } catch (error) {
                if (error instanceof RequestError) throw error;
                throw new RequestError(
                  REQUEST_ERROR_CATEGORY.API,
                  error?.message || "The response failed API validation.",
                  { cause: error, status, url: options.url, response }
                );
              }
              if (valid === false) {
                throw new RequestError(
                  REQUEST_ERROR_CATEGORY.API,
                  "The response failed API validation.",
                  { status, url: options.url, response }
                );
              }
            }
            const result = options.transform ? options.transform(data, response) : data;
            settle(resolve, result);
          } catch (error) {
            rejectWith(
              error instanceof RequestError ? error : new RequestError(
                REQUEST_ERROR_CATEGORY.PARSE,
                error?.message || "The JSON response could not be processed.",
                { cause: error, url: options.url, response }
              )
            );
          }
        },
        onerror(error) {
          rejectWith(
            new RequestError(
              REQUEST_ERROR_CATEGORY.NETWORK,
              error?.error || error?.message || "The network request failed.",
              { cause: error, url: options.url }
            )
          );
        },
        ontimeout() {
          rejectWith(
            new RequestError(
              REQUEST_ERROR_CATEGORY.TIMEOUT,
              "The request timed out.",
              { url: options.url }
            )
          );
        },
        onabort() {
          rejectWith(
            new RequestError(
              REQUEST_ERROR_CATEGORY.ABORT,
              "The request was cancelled.",
              { url: options.url }
            )
          );
        }
      };
      try {
        handle = send(details);
        options.onRequest?.(handle);
      } catch (error) {
        rejectWith(
          new RequestError(
            REQUEST_ERROR_CATEGORY.NETWORK,
            error?.message || "The request could not be started.",
            { cause: error, url: options.url }
          )
        );
      }
    });
    const abort = () => {
      if (settled) return;
      settled = true;
      removeSignalListener();
      rejectPromise(
        new RequestError(
          REQUEST_ERROR_CATEGORY.ABORT,
          "The request was cancelled.",
          { url: options.url }
        )
      );
      try {
        handle?.abort?.();
      } catch (_error) {
      }
    };
    return {
      promise,
      abort,
      get handle() {
        return handle;
      },
      then: promise.then.bind(promise),
      catch: promise.catch.bind(promise),
      finally: promise.finally.bind(promise)
    };
  }
  function requestText(environment2, options) {
    if (!options || typeof options.url !== "string" || options.url === "") {
      throw new TypeError("requestText() requires a non-empty URL.");
    }
    const send = typeof environment2 === "function" ? environment2 : environment2?.request?.bind(environment2);
    if (typeof send !== "function") {
      throw new TypeError("requestText() requires a request function.");
    }
    let handle = null;
    let settled = false;
    let rejectPromise;
    let removeSignalListener = () => {
    };
    const promise = new Promise((resolve, reject) => {
      rejectPromise = reject;
      const settle = (callback, value) => {
        if (settled) return;
        settled = true;
        removeSignalListener();
        callback(value);
      };
      const rejectWith = (error) => settle(reject, error);
      const abortFromSignal = () => {
        const reason = options.signal?.reason;
        rejectWith(
          new RequestError(
            REQUEST_ERROR_CATEGORY.ABORT,
            typeof reason === "string" ? reason : "The request was cancelled.",
            { cause: reason, url: options.url }
          )
        );
        try {
          handle?.abort?.();
        } catch (_error) {
        }
      };
      if (options.signal?.aborted) {
        abortFromSignal();
        return;
      }
      if (options.signal) {
        options.signal.addEventListener("abort", abortFromSignal, { once: true });
        removeSignalListener = () => options.signal.removeEventListener("abort", abortFromSignal);
      }
      const timeout = Number(options.timeout);
      const details = {
        ...options.requestDetails || {},
        method: options.method || "GET",
        url: options.url,
        headers: options.headers,
        data: options.data,
        timeout: Number.isFinite(timeout) && timeout > 0 ? Math.floor(timeout) : void 0,
        onload(response) {
          try {
            const status = Number(response?.status) || 200;
            if (status === 429) {
              throw new RequestError(
                REQUEST_ERROR_CATEGORY.RATE_LIMIT,
                "The server rate-limited the request.",
                { status, url: options.url, response }
              );
            }
            if (status < 200 || status >= 300) {
              throw new RequestError(
                REQUEST_ERROR_CATEGORY.HTTP,
                `The request returned HTTP ${status}.`,
                { status, url: options.url, response }
              );
            }
            const finalUrl = String(response?.finalUrl || "");
            if (LOGIN_REDIRECT_PATTERN.test(finalUrl)) {
              throw new RequestError(
                REQUEST_ERROR_CATEGORY.LOGIN,
                "The request was redirected to a login or checkpoint page.",
                { status, url: finalUrl || options.url, response }
              );
            }
            const body = response?.responseText ?? response?.response ?? "";
            const text = typeof body === "string" ? body : String(body ?? "");
            const result = options.transform ? options.transform(text, response) : text;
            settle(resolve, result);
          } catch (error) {
            rejectWith(
              error instanceof RequestError ? error : new RequestError(
                REQUEST_ERROR_CATEGORY.API,
                error?.message || "The text response could not be processed.",
                { cause: error, url: options.url, response }
              )
            );
          }
        },
        onerror(error) {
          rejectWith(
            new RequestError(
              REQUEST_ERROR_CATEGORY.NETWORK,
              error?.error || error?.message || "The network request failed.",
              { cause: error, url: options.url }
            )
          );
        },
        ontimeout() {
          rejectWith(
            new RequestError(
              REQUEST_ERROR_CATEGORY.TIMEOUT,
              "The request timed out.",
              { url: options.url }
            )
          );
        },
        onabort() {
          rejectWith(
            new RequestError(
              REQUEST_ERROR_CATEGORY.ABORT,
              "The request was cancelled.",
              { url: options.url }
            )
          );
        }
      };
      try {
        handle = send(details);
        options.onRequest?.(handle);
      } catch (error) {
        rejectWith(
          new RequestError(
            REQUEST_ERROR_CATEGORY.NETWORK,
            error?.message || "The request could not be started.",
            { cause: error, url: options.url }
          )
        );
      }
    });
    const abort = () => {
      if (settled) return;
      settled = true;
      removeSignalListener();
      rejectPromise(
        new RequestError(
          REQUEST_ERROR_CATEGORY.ABORT,
          "The request was cancelled.",
          { url: options.url }
        )
      );
      try {
        handle?.abort?.();
      } catch (_error) {
      }
    };
    return {
      promise,
      abort,
      get handle() {
        return handle;
      },
      then: promise.then.bind(promise),
      catch: promise.catch.bind(promise),
      finally: promise.finally.bind(promise)
    };
  }
  function findApiError(data, url, status, response) {
    let message = "";
    let details = null;
    if (Array.isArray(data?.errors) && data.errors.length > 0) {
      details = data.errors;
      message = data.errors.map(
        (error) => [error?.message, error?.description, error?.code].filter(Boolean).join(" ")
      ).join(" ");
    } else if (data?.status === "fail") {
      details = data;
      message = [data.message, data.feedback_message].filter(Boolean).join(": ");
    } else {
      return null;
    }
    const rateLimited = RATE_LIMIT_PATTERN.test(message);
    return new RequestError(
      rateLimited ? REQUEST_ERROR_CATEGORY.RATE_LIMIT : REQUEST_ERROR_CATEGORY.API,
      message || "The server rejected the API request.",
      { details, status, url, response }
    );
  }

  // src/localization/index.js
  var localization_exports = {};
  __export(localization_exports, {
    DEFAULT_LOCALE: () => DEFAULT_LOCALE,
    ENGLISH_DICTIONARY: () => ENGLISH_DICTIONARY,
    LOCALE_MANIFEST: () => LOCALE_MANIFEST,
    TRANSLATION_BASE_URL: () => TRANSLATION_BASE_URL,
    UPSTREAM_LOCALE_COMMIT: () => UPSTREAM_LOCALE_COMMIT,
    applyTranslations: () => applyTranslations,
    createTranslator: () => createTranslator,
    getTranslationText: () => getTranslationText,
    getTranslationUrl: () => getTranslationUrl,
    isEnglishLocale: () => isEnglishLocale,
    isSupportedLocale: () => isSupportedLocale,
    isTranslationDictionary: () => isTranslationDictionary,
    loadTranslationDictionary: () => loadTranslationDictionary,
    normalizeTranslationDictionary: () => normalizeTranslationDictionary
  });

  // src/localization/en-US.json
  var en_US_default = {
    NOTICE_UPDATE_TITLE: "New version released.",
    NOTICE_UPDATE_CONTENT: "insta-loader has released a new version, click here to update.",
    CHECK_FOR_UPDATE: "Check for Script Updates",
    RELOAD_SCRIPT: "Reload Script",
    DONATE: "Donate",
    FEEDBACK: "Feedback",
    IMAGE_VIEWER: "Open Image In Viewer",
    NEW_TAB: "Open in New Tab",
    SHOW_DOM_TREE: "Show DOM Tree",
    SELECT_AND_COPY: "Select All and Copy from the Input Box",
    DOWNLOAD_DOM_TREE: "Download DOM Tree as a Text File",
    REPORT_GITHUB: "Report an Issue on GitHub",
    REPORT_DISCORD: "Report an Issue on Discord Support Server",
    REPORT_FORK: "Report an Issue",
    DEBUG: "Debug Window",
    CLOSE: "Close",
    ALL_CHECK: "Select All",
    ITEM_COUNT_SINGULAR: "%COUNT% item",
    ITEM_COUNT_PLURAL: "%COUNT% items",
    ITEM_POSITION: "Item %CURRENT% of %TOTAL%",
    SELECTED_COUNT_SINGULAR: "%COUNT% selected",
    SELECTED_COUNT_PLURAL: "%COUNT% selected",
    BATCH_DOWNLOAD_SELECTED: "Download Selected Resources",
    BATCH_DOWNLOAD_DIRECT: "Download All Resources",
    IMG: "Image",
    VID: "Video",
    DW: "Download",
    DW_ALL: "Download All Resources",
    VIDEO_THUMBNAIL: "Download Video Thumbnail",
    LOAD_BLOB_ONE: "Loading Blob Media...",
    LOAD_BLOB_MULTIPLE: "Loading Blob Media and Others...",
    LOAD_BLOB_RELOAD: "Detecting Blob Media, reloading...",
    NO_CHECK_RESOURCE: "You need to select a resource to download.",
    NO_VID_URL: "Cannot find video URL.",
    SETTING: "Settings",
    AUTO_RENAME: "Automatically Rename Files (Right-Click to Set)",
    RENAME_PUBLISH_DATE: "Set Renamed File Timestamp to Resource Publish Date",
    RENAME_LOCATE_DATE: "Modify Renamed File Timestamp Date Format (Right-Click to Set)",
    DISABLE_VIDEO_LOOPING: "Disable Video Auto-looping",
    HTML5_VIDEO_CONTROL: "Display HTML5 Video Controller",
    MAX_REEL_PLAYBACK_QUALITY: "Play Standalone Reels at Maximum Quality",
    REDIRECT_CLICK_USER_STORY_PICTURE: "Redirect When Clicking on User's Story Picture",
    FORCE_FETCH_ALL_RESOURCES: "Force Fetch All Resources in the Post",
    DIRECT_DOWNLOAD_VISIBLE_RESOURCE: "Directly Download the Visible Resources in the Post",
    DIRECT_DOWNLOAD_ALL: "Directly Download All Resources in the Post",
    DIRECT_DOWNLOAD_STORY: "Directly Download All Resources in the Story/Highlight",
    MODIFY_VIDEO_VOLUME: "Modify Video Volume (Right-Click to Set)",
    MODIFY_RESOURCE_EXIF: "Modify Resource EXIF Properties",
    SCROLL_BUTTON: "Enable Scroll Buttons for Reels Page",
    FORCE_RESOURCE_VIA_MEDIA: "Force Fetch Resource via Media API",
    PREFER_DASH_MANIFEST: "Prefer DASH Manifest (Higher-Quality Video via Media API)",
    FALLBACK_TO_BLOB_FETCH_IF_MEDIA_API_THROTTLED: "Use Alternative Methods to Download When the Media API is Not Accessible",
    NEW_TAB_ALWAYS_FORCE_MEDIA_IN_POST: "Always Use Media API for [Open in New Tab] in Posts",
    SKIP_VIEW_STORY_CONFIRM: "Skip the Confirmation Page for Viewing a Story/Highlight",
    SKIP_SHARED_WITH_YOU_DIALOG: 'Skip "shared this with you" dialog on shared profile links',
    CAPTURE_IMAGE_VIA_MEDIA_CACHE: "Capture Image Resource Using Media Cache",
    AUTO_RENAME_INTRO: [
      "Auto rename file to custom format:",
      "Custom Format List:",
      "%USERNAME% - Username",
      "%SOURCE_TYPE% - Download Source",
      "%SHORTCODE% - Post Shortcode",
      "%YEAR% - Year when downloaded/published",
      "%2-YEAR% - Year (last two digits) when downloaded/published",
      "%MONTH% - Month when downloaded/published",
      "%DAY% - Day when downloaded/published",
      "%HOUR% - Hour when downloaded/published",
      "%MINUTE% - Minute when downloaded/published",
      "%SECOND% - Second when downloaded/published",
      "%ORIGINAL_NAME% - Original name of downloaded file",
      "%ORIGINAL_NAME_FIRST% - Original name of downloaded file (first part of name)",
      "%INDEX% - Resource index",
      "%UID% - User account unique ID",
      "",
      "If set to false, the file name will remain unchanged.",
      "Example: instagram_321565527_679025940443063_4318007696887450953_n.jpg"
    ],
    RENAME_PUBLISH_DATE_INTRO: "Sets the timestamp in the file rename format to the resource publish date (browser time zone).\n\nThis feature only works when [Automatically Rename Files] is set to TRUE.",
    RENAME_LOCATE_DATE_INTRO: "Modify the renamed file timestamp date format to the browser's local time, and format it to your preferred regional date format.\n\nThis feature only works when [Automatically Rename Files] is set to TRUE.",
    DISABLE_VIDEO_LOOPING_INTRO: "Disable video auto-looping in Reels and posts.",
    HTML5_VIDEO_CONTROL_INTRO: "Display the HTML5 video controller in video resource.\n\nThis will hide the custom video volume slider and replace it with the HTML5 controller. The HTML5 controller can be hidden by right-clicking on the video to reveal the original details.",
    MAX_REEL_PLAYBACK_QUALITY_INTRO: "On standalone /reel/ pages, hold the active Reel's poster for up to five seconds while loading the highest-resolution complete progressive MP4 reported by Instagram. The scrolling /reels/ feed stays on Instagram's native player because it recycles video elements. This uses more bandwidth and a private metadata request. Native playback resumes if the request is throttled, fails, times out, or Safari rejects the source. DASH downloads are separate and may provide a higher-resolution saved file.",
    REDIRECT_CLICK_USER_STORY_PICTURE_INTRO: "Redirect to a user's profile page when right-clicking on their avatar in the story area on the homepage.\nIf you use the middle mouse button to click, it will open in a new tab.",
    FORCE_FETCH_ALL_RESOURCES_INTRO: "Force fetching of all resources (photos and videos) in a post via the Instagram API to remove the limit of three resources per post.",
    DIRECT_DOWNLOAD_VISIBLE_RESOURCE_INTRO: "Directly download the current resources available in the post.",
    DIRECT_DOWNLOAD_ALL_INTRO: "When you click the download button, all resources in the post will be forcibly fetched and downloaded.",
    MODIFY_VIDEO_VOLUME_INTRO: "Modify the video playback volume in Reels and posts (right-click to open the volume setting slider).",
    SCROLL_BUTTON_INTRO: "Enable scroll buttons for the lower right corner of the Reels page.",
    FORCE_RESOURCE_VIA_MEDIA_INTRO: "The Media API will try to get the highest quality photo or video possible, but it may take longer to load.",
    PREFER_DASH_MANIFEST_INTRO: "Prefer the DASH manifest for video resources via the Media API. If a DASH manifest is available, it will download the video and audio streams SEPARATELY for the best possible quality.",
    FALLBACK_TO_BLOB_FETCH_IF_MEDIA_API_THROTTLED_INTRO: "When the Media API reaches its rate limit or cannot be used for other reasons, the Forced Fetch API will be used to download resources (the resource quality may be slightly lower).",
    NEW_TAB_ALWAYS_FORCE_MEDIA_IN_POST_INTRO: "The [Open in New Tab] button in posts will always use the Media API to obtain high-resolution resources.",
    CHECK_FOR_UPDATE_INTRO: "Check for updates when the script is triggered (check every 300 seconds).\nUpdate notifications will be sent as desktop notifications through the browser.",
    SKIP_VIEW_STORY_CONFIRM_INTRO: "Automatically skip when confirmation page is shown in story or highlight.",
    SKIP_SHARED_WITH_YOU_DIALOG_INTRO: 'Automatically click "Not now" on the "X shared this with you" dialog when opening any ?igsh= links.',
    MODIFY_RESOURCE_EXIF_INTRO: "Modify the EXIF attribute of the image resource to include metadata such as post link, shooting date, and author.",
    DIRECT_DOWNLOAD_STORY_INTRO: "When you click [Download All Resources], all stories/highlights are downloaded directly, without showing the image selection dialog.",
    CAPTURE_IMAGE_VIA_MEDIA_CACHE_INTRO: "Use a watcher to capture any high-quality image URLs in the DOM tree into the script's storage so that they can be extracted when available and upon user input.",
    HOTKEY_DEBUG_KEY: "Debug Window",
    HOTKEY_SETTINGS_KEY: "Preference Settings",
    HOTKEY_KEY_SETTINGS_KEY: "Hotkey Settings",
    HOTKEY_DOWNLOAD_STORY_KEY: "Download Story",
    HOTKEY_CONFLICT_WARNING: "This hotkey may conflict with other settings.",
    HOTKEY_RESET: "Reset"
  };

  // src/localization/locale-manifest.json
  var locale_manifest_default = {
    ar: "العربية (Arabic)",
    de: "Deutsch (German)",
    "en-US": "English",
    es: "Español (Spanish)",
    fr: "Français (French)",
    id: "Bahasa Indonesia (Indonesian)",
    it: "Italiano (Italian)",
    ja: "日本語 (Japanese)",
    ko: "한국어 (Korean)",
    "pt-BR": "Português (Brazilian Portuguese)",
    ro: "Română (Romanian)",
    ru: "Русский (Russian)",
    th: "ไทย (Thai)",
    tr: "Türkçe (Turkish)",
    vi: "Tiếng Việt (Vietnamese)",
    "zh-CN": "简体中文 (Simplified Chinese)",
    "zh-TW": "繁體中文 (Traditional Chinese)"
  };

  // src/resources/upstream-provenance.json
  var upstream_provenance_default = {
    repository: "https://github.com/SN-Koarashi/ig-helper",
    branch: "master",
    commit: "44650f9dbe9d977481016a678c549489c081b648",
    commitUrl: "https://github.com/SN-Koarashi/ig-helper/commit/44650f9dbe9d977481016a678c549489c081b648",
    verifiedAt: "2026-08-07T04:18:27Z",
    resources: {
      internalCss: {
        sourcePath: "style.css",
        movingUrl: "https://cdn.jsdelivr.net/gh/SN-Koarashi/ig-helper@master/style.css",
        immutableUrl: "https://cdn.jsdelivr.net/gh/SN-Koarashi/ig-helper@44650f9dbe9d977481016a678c549489c081b648/style.css",
        gitBlob: "29694b984f868ac02e1951835483efb387b0fdc1",
        sha256: "5b0e305e9f177d3371e4fd0e367c0345c13f895c0d0198d326cdb3f4ff80b311",
        bytes: 14931
      },
      localeManifest: {
        sourcePath: "locale/manifest.json",
        movingUrl: "https://cdn.jsdelivr.net/gh/SN-Koarashi/ig-helper@master/locale/manifest.json",
        immutableUrl: "https://cdn.jsdelivr.net/gh/SN-Koarashi/ig-helper@44650f9dbe9d977481016a678c549489c081b648/locale/manifest.json",
        gitBlob: "c4f9167df419370397f05725cfe159e44d9850d1",
        sha256: "d4c2fc51da96bc4af2953639a6cb8f90a4dc99e93495321b6a64822e617fa427",
        bytes: 624
      }
    },
    translations: {
      immutableBaseUrl: "https://cdn.jsdelivr.net/gh/SN-Koarashi/ig-helper@44650f9dbe9d977481016a678c549489c081b648/locale/translations",
      englishSource: "Bundled from insta-loader.user.js because the upstream commit has no locale/translations/en-US.json file."
    }
  };

  // src/localization/index.js
  var hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
  var DEFAULT_LOCALE = "en-US";
  var LOCALE_MANIFEST = Object.freeze({ ...locale_manifest_default });
  var UPSTREAM_LOCALE_COMMIT = upstream_provenance_default.commit;
  var TRANSLATION_BASE_URL = upstream_provenance_default.translations.immutableBaseUrl;
  function isPlainRecord(value) {
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
      return false;
    }
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  }
  function normalizeTranslationDictionary(payload) {
    let candidate = payload;
    if (typeof candidate === "string") {
      try {
        candidate = JSON.parse(candidate);
      } catch {
        return null;
      }
    }
    if (!isPlainRecord(candidate)) {
      return null;
    }
    const normalized = /* @__PURE__ */ Object.create(null);
    for (const [key, value] of Object.entries(candidate)) {
      if (key.length === 0) {
        return null;
      }
      if (typeof value === "string") {
        normalized[key] = value;
        continue;
      }
      if (Array.isArray(value) && value.every((line) => typeof line === "string")) {
        normalized[key] = value.join("\n");
        continue;
      }
      return null;
    }
    return Object.freeze(normalized);
  }
  function isTranslationDictionary(payload) {
    return normalizeTranslationDictionary(payload) !== null;
  }
  var normalizedEnglishDictionary = normalizeTranslationDictionary(
    en_US_default
  );
  if (normalizedEnglishDictionary === null) {
    throw new TypeError("The bundled English translation dictionary is invalid.");
  }
  var ENGLISH_DICTIONARY = normalizedEnglishDictionary;
  function isEnglishLocale(locale) {
    return typeof locale === "string" && /^en(?:-|$)/i.test(locale.trim());
  }
  function isSupportedLocale(locale) {
    return typeof locale === "string" && hasOwn(LOCALE_MANIFEST, locale.trim());
  }
  function getTranslationUrl(locale) {
    if (typeof locale !== "string") {
      return null;
    }
    const requestedLocale = locale.trim();
    if (isEnglishLocale(requestedLocale) || !hasOwn(LOCALE_MANIFEST, requestedLocale)) {
      return null;
    }
    return `${TRANSLATION_BASE_URL}/${encodeURIComponent(requestedLocale)}.json`;
  }
  async function loadTranslationDictionary(locale, requestJson2) {
    const url = getTranslationUrl(locale);
    if (url === null) {
      return ENGLISH_DICTIONARY;
    }
    if (typeof requestJson2 !== "function") {
      throw new TypeError("requestJson must be a function.");
    }
    try {
      const dictionary = normalizeTranslationDictionary(await requestJson2(url));
      return dictionary || ENGLISH_DICTIONARY;
    } catch {
      return ENGLISH_DICTIONARY;
    }
  }
  function getTranslationText(dictionary, key) {
    if (typeof key !== "string") {
      return "";
    }
    if (dictionary && hasOwn(dictionary, key)) {
      const translatedValue = dictionary[key];
      if (typeof translatedValue === "string") {
        return translatedValue;
      }
    }
    if (hasOwn(ENGLISH_DICTIONARY, key)) {
      return ENGLISH_DICTIONARY[key];
    }
    return "";
  }
  function createTranslator(dictionary) {
    return (key) => getTranslationText(dictionary, key);
  }
  function applyTranslations(root, translate) {
    if (!root || typeof root.querySelectorAll !== "function") {
      return;
    }
    root.querySelectorAll("[data-ih-locale]").forEach((element) => {
      const key = element.getAttribute("data-ih-locale");
      if (key !== null) {
        element.textContent = translate(key);
      }
    });
    root.querySelectorAll("[data-ih-locale-title]").forEach((element) => {
      const key = element.getAttribute("data-ih-locale-title");
      if (key !== null) {
        element.setAttribute("title", translate(key));
      }
    });
  }

  // src/media/index.js
  var media_exports = {};
  __export(media_exports, {
    DashExecutionCoordinator: () => DashExecutionCoordinator,
    MEDIA_ACTION_STAGE: () => MEDIA_ACTION_STAGE,
    MEDIA_INTENT: () => MEDIA_INTENT,
    MEDIA_SURFACE: () => MEDIA_SURFACE,
    MediaActionError: () => MediaActionError,
    MediaActionService: () => MediaActionService,
    STORY_IMAGE_CANDIDATE: () => STORY_IMAGE_CANDIDATE,
    STORY_VIDEO_CANDIDATE: () => STORY_VIDEO_CANDIDATE,
    compareImageCandidates: () => compareImageCandidates,
    compareMaximumProgressiveCandidates: () => compareMaximumProgressiveCandidates,
    createMediaActionService: () => createMediaActionService,
    extractApiResource: () => extractApiResource,
    extractLegacyResource: () => extractLegacyResource,
    extractMaximumProgressiveItem: () => extractMaximumProgressiveItem,
    extractStoryReel: () => extractStoryReel,
    getImageTransformation: () => getImageTransformation,
    getMediaOwner: () => getMediaOwner,
    normalizeApiMedia: () => normalizeApiMedia,
    normalizeHighlightMedia: () => normalizeHighlightMedia,
    normalizeLegacyMedia: () => normalizeLegacyMedia,
    normalizeMaximumProgressiveCandidates: () => normalizeMaximumProgressiveCandidates,
    normalizeMaximumReelCandidates: () => normalizeMaximumReelCandidates,
    normalizeMediaResponse: () => normalizeMediaResponse,
    normalizeProfileAvatar: () => normalizeProfileAvatar,
    normalizeQueryHashMedia: () => normalizeQueryHashMedia,
    normalizeQueryIdMedia: () => normalizeQueryIdMedia,
    normalizeReelMedia: () => normalizeReelMedia,
    normalizeStoryMedia: () => normalizeStoryMedia,
    normalizeStorySurfaceMedia: () => normalizeStorySurfaceMedia,
    orderImageCandidates: () => orderImageCandidates,
    parseDashManifest: () => parseDashManifest,
    rankMaximumProgressiveCandidates: () => rankMaximumProgressiveCandidates,
    renderMediaRow: () => renderMediaRow,
    selectBestImageCandidate: () => selectBestImageCandidate,
    selectLargestStoryDisplayResource: () => selectLargestStoryDisplayResource,
    toPositiveFiniteNumber: () => toPositiveFiniteNumber,
    validateMediaDescriptor: () => validateMediaDescriptor,
    validateMediaIntent: () => validateMediaIntent
  });

  // src/media/action-service.js
  var MEDIA_INTENT = Object.freeze({
    DOWNLOAD: "download",
    PREVIEW: "preview",
    THUMBNAIL: "thumbnail"
  });
  var MEDIA_ACTION_STAGE = Object.freeze({
    CACHE: "cache",
    MEDIA_API: "media-api",
    DASH: "dash",
    OUTPUT: "output"
  });
  var VALID_INTENTS = new Set(Object.values(MEDIA_INTENT));
  var RESOLUTION_FIELDS = Object.freeze([
    "directUrl",
    "thumbnailUrl",
    "rawMediaItem",
    "dashManifest"
  ]);
  var DEFAULT_POLICY = Object.freeze({
    useImageCache: false,
    useMediaApi: false,
    useDash: false,
    dashBeforeMediaApi: false,
    failOpenOnCacheError: true,
    failOpenOnMediaApiError: false,
    failOpenOnDashError: true
  });
  var MediaActionError = class extends Error {
    /**
     * @param {string} stage
     * @param {string} message
     * @param {{cause?: *}} [options]
     */
    constructor(stage, message, options = {}) {
      super(message);
      this.name = "MediaActionError";
      this.stage = stage;
      this.code = `media-action-${stage}`;
      this.cause = options.cause;
    }
  };
  function validateMediaDescriptor(descriptor) {
    if (descriptor === null || typeof descriptor !== "object" || Array.isArray(descriptor)) {
      throw new TypeError("MediaActionService requires a MediaDescriptor object.");
    }
    if (!(typeof descriptor.mediaId === "string" && descriptor.mediaId.length > 0 || typeof descriptor.mediaId === "number" && Number.isFinite(descriptor.mediaId))) {
      throw new TypeError(
        "MediaDescriptor.mediaId must be a non-empty string or finite number."
      );
    }
    if (typeof descriptor.directUrl !== "string" || descriptor.directUrl.length === 0) {
      throw new TypeError("MediaDescriptor.directUrl must be a non-empty string.");
    }
    if (descriptor.thumbnailUrl != null && (typeof descriptor.thumbnailUrl !== "string" || descriptor.thumbnailUrl.length === 0)) {
      throw new TypeError(
        "MediaDescriptor.thumbnailUrl must be null or a non-empty string."
      );
    }
    if (descriptor.kind !== "image" && descriptor.kind !== "video") {
      throw new TypeError('MediaDescriptor.kind must be "image" or "video".');
    }
    const expectedExtension = descriptor.kind === "video" ? "mp4" : "jpg";
    if (descriptor.extension !== expectedExtension) {
      throw new TypeError(
        `MediaDescriptor.extension must be "${expectedExtension}" for ${descriptor.kind} media.`
      );
    }
    if (!Number.isInteger(descriptor.carouselIndex) || descriptor.carouselIndex < 1) {
      throw new TypeError(
        "MediaDescriptor.carouselIndex must be a positive integer."
      );
    }
    if (descriptor.owner != null && typeof descriptor.owner !== "string") {
      throw new TypeError("MediaDescriptor.owner must be null or a string.");
    }
    if (descriptor.shortcode != null && typeof descriptor.shortcode !== "string") {
      throw new TypeError("MediaDescriptor.shortcode must be null or a string.");
    }
    if (descriptor.publishTime != null && typeof descriptor.publishTime !== "string" && typeof descriptor.publishTime !== "number") {
      throw new TypeError(
        "MediaDescriptor.publishTime must be null, a string, or a number."
      );
    }
    if (descriptor.dashManifest != null && typeof descriptor.dashManifest !== "string") {
      throw new TypeError(
        "MediaDescriptor.dashManifest must be null or a string."
      );
    }
    if (descriptor.rawMediaItem != null && (typeof descriptor.rawMediaItem !== "object" || Array.isArray(descriptor.rawMediaItem))) {
      throw new TypeError(
        "MediaDescriptor.rawMediaItem must be an object when provided."
      );
    }
    return Object.freeze({ ...descriptor });
  }
  function validateMediaIntent(intent) {
    if (!VALID_INTENTS.has(intent)) {
      throw new TypeError(
        'Media intent must be "download", "preview", or "thumbnail".'
      );
    }
  }
  var MediaActionService = class {
    /**
     * @param {MediaActionDependencies} dependencies
     * @param {MediaActionPolicy} [policy]
     */
    constructor(dependencies, policy = {}) {
      if (dependencies === null || typeof dependencies !== "object") {
        throw new TypeError("MediaActionService requires injected dependencies.");
      }
      if (dependencies.outputs === null || typeof dependencies.outputs !== "object") {
        throw new TypeError("MediaActionService requires an outputs object.");
      }
      for (const intent of VALID_INTENTS) {
        if (typeof dependencies.outputs[intent] !== "function") {
          throw new TypeError(`MediaActionService requires outputs.${intent}().`);
        }
      }
      for (const name of [
        "getCachedImage",
        "resolveMedia",
        "resolveDash",
        "onStageError"
      ]) {
        if (dependencies[name] != null && typeof dependencies[name] !== "function") {
          throw new TypeError(
            `MediaActionService dependency ${name} must be a function.`
          );
        }
      }
      const normalizedPolicy = { ...DEFAULT_POLICY, ...policy };
      for (const [name, value] of Object.entries(normalizedPolicy)) {
        if (typeof value !== "boolean" && typeof value !== "function") {
          throw new TypeError(
            `MediaActionService policy ${name} must be a boolean or function.`
          );
        }
      }
      this.dependencies = Object.freeze({ ...dependencies });
      this.policy = Object.freeze(normalizedPolicy);
    }
    /**
     * Resolve and execute one normalized action.
     *
     * Cache hits short-circuit Media API resolution. By default, Media API
     * resolution may enrich a video with raw/DASH data before DASH resolution.
     * Callers that historically own an already-cached DASH item may opt into one
     * DASH attempt before Media API resolution instead. DASH is only eligible for
     * video downloads; previews and thumbnail actions remain on their direct
     * resource paths.
     *
     * @param {MediaDescriptor} descriptor
     * @param {MediaIntent} intent
     * @returns {Promise<*>}
     */
    async execute(descriptor, intent) {
      validateMediaIntent(intent);
      const originalDescriptor = validateMediaDescriptor(descriptor);
      let currentDescriptor = originalDescriptor;
      let source = "descriptor";
      let resolutionPath = Object.freeze([source]);
      let cacheHit = false;
      let dashAppliedBeforeMediaApi = false;
      let dashBeforeMediaApi = false;
      if ((currentDescriptor.kind === "image" || intent === MEDIA_INTENT.THUMBNAIL) && await this._usePolicy(
        "useImageCache",
        this._context(
          currentDescriptor,
          originalDescriptor,
          intent,
          source,
          resolutionPath
        )
      )) {
        const result = await this._resolveStage({
          stage: MEDIA_ACTION_STAGE.CACHE,
          resolverName: "getCachedImage",
          fallbackPolicy: "failOpenOnCacheError",
          descriptor: currentDescriptor,
          originalDescriptor,
          intent,
          source,
          resolutionPath
        });
        if (result.applied) {
          currentDescriptor = result.descriptor;
          source = "cache";
          resolutionPath = Object.freeze([...resolutionPath, source]);
          cacheHit = true;
        }
      }
      if (currentDescriptor.kind === "video" && intent === MEDIA_INTENT.DOWNLOAD) {
        dashBeforeMediaApi = await this._usePolicy(
          "dashBeforeMediaApi",
          this._context(
            currentDescriptor,
            originalDescriptor,
            intent,
            source,
            resolutionPath
          )
        );
      }
      if (dashBeforeMediaApi && await this._usePolicy(
        "useDash",
        this._context(
          currentDescriptor,
          originalDescriptor,
          intent,
          source,
          resolutionPath
        )
      )) {
        const result = await this._resolveStage({
          stage: MEDIA_ACTION_STAGE.DASH,
          resolverName: "resolveDash",
          fallbackPolicy: "failOpenOnDashError",
          descriptor: currentDescriptor,
          originalDescriptor,
          intent,
          source,
          resolutionPath
        });
        if (result.applied) {
          currentDescriptor = result.descriptor;
          source = "dash";
          resolutionPath = Object.freeze([...resolutionPath, source]);
          dashAppliedBeforeMediaApi = true;
        }
      }
      if (!cacheHit && !dashAppliedBeforeMediaApi && await this._usePolicy(
        "useMediaApi",
        this._context(
          currentDescriptor,
          originalDescriptor,
          intent,
          source,
          resolutionPath
        )
      )) {
        const result = await this._resolveStage({
          stage: MEDIA_ACTION_STAGE.MEDIA_API,
          resolverName: "resolveMedia",
          fallbackPolicy: "failOpenOnMediaApiError",
          descriptor: currentDescriptor,
          originalDescriptor,
          intent,
          source,
          resolutionPath
        });
        if (result.applied) {
          currentDescriptor = result.descriptor;
          source = "media-api";
          resolutionPath = Object.freeze([...resolutionPath, source]);
        }
      }
      if (currentDescriptor.kind === "video" && intent === MEDIA_INTENT.DOWNLOAD && !dashBeforeMediaApi && await this._usePolicy(
        "useDash",
        this._context(
          currentDescriptor,
          originalDescriptor,
          intent,
          source,
          resolutionPath
        )
      )) {
        const result = await this._resolveStage({
          stage: MEDIA_ACTION_STAGE.DASH,
          resolverName: "resolveDash",
          fallbackPolicy: "failOpenOnDashError",
          descriptor: currentDescriptor,
          originalDescriptor,
          intent,
          source,
          resolutionPath
        });
        if (result.applied) {
          currentDescriptor = result.descriptor;
          source = "dash";
          resolutionPath = Object.freeze([...resolutionPath, source]);
        }
      }
      const context = this._context(
        currentDescriptor,
        originalDescriptor,
        intent,
        source,
        resolutionPath
      );
      const output = this.dependencies.outputs[intent];
      try {
        const outputContext = Object.freeze({
          ...context,
          url: this._outputUrl(currentDescriptor, intent)
        });
        return await output.call(this.dependencies.outputs, outputContext);
      } catch (error) {
        await this._reportStageError(
          error,
          context,
          MEDIA_ACTION_STAGE.OUTPUT,
          false
        );
        throw error;
      }
    }
    /**
     * @param {string} name
     * @param {MediaActionContext} context
     * @returns {Promise<boolean>}
     * @private
     */
    async _usePolicy(name, context) {
      const decision = this.policy[name];
      return typeof decision === "function" ? Boolean(await decision(context)) : decision;
    }
    /**
     * @param {string} name
     * @param {*} error
     * @param {MediaActionContext} context
     * @param {string} stage
     * @returns {Promise<boolean>}
     * @private
     */
    async _useFallbackPolicy(name, error, context, stage) {
      const decision = this.policy[name];
      const errorContext = Object.freeze({ ...context, stage });
      return typeof decision === "function" ? Boolean(await decision(error, errorContext)) : decision;
    }
    /**
     * @param {object} options
     * @returns {Promise<{applied: boolean, descriptor: Readonly<MediaDescriptor>}>}
     * @private
     */
    async _resolveStage(options) {
      const resolver = this.dependencies[options.resolverName];
      if (typeof resolver !== "function") {
        throw new TypeError(
          `MediaActionService policy enabled ${options.stage} without a ${options.resolverName} dependency.`
        );
      }
      const context = this._context(
        options.descriptor,
        options.originalDescriptor,
        options.intent,
        options.source,
        options.resolutionPath
      );
      try {
        const resolution = await resolver.call(this.dependencies, context);
        if (resolution == null) {
          return { applied: false, descriptor: options.descriptor };
        }
        const resolvedDescriptor = this._applyResolution(
          options.descriptor,
          resolution,
          options.intent,
          options.stage
        );
        return { applied: true, descriptor: resolvedDescriptor };
      } catch (error) {
        const willFallback = await this._useFallbackPolicy(
          options.fallbackPolicy,
          error,
          context,
          options.stage
        );
        await this._reportStageError(
          error,
          context,
          options.stage,
          willFallback
        );
        if (!willFallback) throw error;
        return { applied: false, descriptor: options.descriptor };
      }
    }
    /**
     * @param {Readonly<MediaDescriptor>} descriptor
     * @param {MediaActionResolution} resolution
     * @param {MediaIntent} intent
     * @param {string} stage
     * @returns {Readonly<MediaDescriptor>}
     * @private
     */
    _applyResolution(descriptor, resolution, intent, stage) {
      if (typeof resolution === "string") {
        if (resolution.length === 0) {
          throw new MediaActionError(
            stage,
            `${stage} returned an empty media URL.`
          );
        }
        if (stage === MEDIA_ACTION_STAGE.CACHE) {
          return validateMediaDescriptor({
            ...descriptor,
            directUrl: resolution,
            thumbnailUrl: resolution
          });
        }
        if (intent === MEDIA_INTENT.THUMBNAIL) {
          return validateMediaDescriptor({
            ...descriptor,
            thumbnailUrl: resolution
          });
        }
        return validateMediaDescriptor({
          ...descriptor,
          directUrl: resolution
        });
      }
      if (resolution === null || typeof resolution !== "object" || Array.isArray(resolution)) {
        throw new MediaActionError(
          stage,
          `${stage} must return a URL, descriptor patch, or null.`
        );
      }
      const patch = {};
      for (const field of RESOLUTION_FIELDS) {
        if (Object.prototype.hasOwnProperty.call(resolution, field)) {
          patch[field] = resolution[field];
        }
      }
      if (Object.keys(patch).length === 0) {
        throw new MediaActionError(
          stage,
          `${stage} returned no resource-bearing descriptor fields.`
        );
      }
      return validateMediaDescriptor({ ...descriptor, ...patch });
    }
    /**
     * @param {Readonly<MediaDescriptor>} descriptor
     * @param {Readonly<MediaDescriptor>} originalDescriptor
     * @param {MediaIntent} intent
     * @param {MediaActionSource} source
     * @param {ReadonlyArray<MediaActionSource>} resolutionPath
     * @returns {MediaActionContext}
     * @private
     */
    _context(descriptor, originalDescriptor, intent, source, resolutionPath) {
      return Object.freeze({
        descriptor,
        originalDescriptor,
        intent,
        source,
        resolutionPath
      });
    }
    /**
     * @param {Readonly<MediaDescriptor>} descriptor
     * @param {MediaIntent} intent
     * @returns {string}
     * @private
     */
    _outputUrl(descriptor, intent) {
      if (intent !== MEDIA_INTENT.THUMBNAIL) return descriptor.directUrl;
      if (descriptor.thumbnailUrl) return descriptor.thumbnailUrl;
      if (descriptor.kind === "image") return descriptor.directUrl;
      throw new MediaActionError(
        MEDIA_ACTION_STAGE.OUTPUT,
        "Video thumbnail actions require MediaDescriptor.thumbnailUrl."
      );
    }
    /**
     * @param {*} error
     * @param {MediaActionContext} context
     * @param {string} stage
     * @param {boolean} willFallback
     * @returns {Promise<void>}
     * @private
     */
    async _reportStageError(error, context, stage, willFallback) {
      if (typeof this.dependencies.onStageError !== "function") return;
      try {
        await this.dependencies.onStageError(
          error,
          Object.freeze({
            ...context,
            stage,
            willFallback
          })
        );
      } catch (_reportingError) {
      }
    }
  };
  function createMediaActionService(dependencies, policy) {
    return new MediaActionService(dependencies, policy);
  }

  // src/media/dash.js
  var EMPTY_DASH_SELECTION = Object.freeze({ video: null, audio: null });
  function parseDashManifest(mpdXml, options = {}) {
    if (typeof mpdXml !== "string" || mpdXml.trim() === "") {
      return EMPTY_DASH_SELECTION;
    }
    const Parser = options.DOMParser || globalThis.DOMParser;
    if (typeof Parser !== "function") return EMPTY_DASH_SELECTION;
    try {
      const xml = new Parser().parseFromString(mpdXml, "application/xml");
      if (xml.querySelector("parsererror")) return EMPTY_DASH_SELECTION;
      const candidates = Array.from(xml.querySelectorAll("Representation")).map(normalizeRepresentation).filter(Boolean);
      const video = candidates.filter(isVideoRepresentation).sort(compareVideoRepresentations)[0] || null;
      const audio = options.hasAudio === false ? null : candidates.filter(isAudioRepresentation).sort(compareAudioRepresentations)[0] || null;
      return { video, audio };
    } catch (error) {
      options.logger?.("[DASH]", "parseDashManifest() error:", error);
      return EMPTY_DASH_SELECTION;
    }
  }
  function normalizeRepresentation(representation) {
    const base = representation.querySelector("BaseURL")?.textContent?.trim();
    if (!base || !isHttpsUrl(base)) return null;
    const adaptationSet = representation.closest("AdaptationSet");
    return {
      id: representation.getAttribute("id") || "",
      url: base,
      mimeType: representation.getAttribute("mimeType") || adaptationSet?.getAttribute("mimeType") || "",
      contentType: adaptationSet?.getAttribute("contentType") || "",
      codecs: representation.getAttribute("codecs") || adaptationSet?.getAttribute("codecs") || "",
      bandwidth: positiveInteger(representation.getAttribute("bandwidth")),
      width: positiveInteger(representation.getAttribute("width")),
      height: positiveInteger(representation.getAttribute("height"))
    };
  }
  function positiveInteger(value) {
    return Number.parseInt(String(value || "0"), 10) || 0;
  }
  function isHttpsUrl(value) {
    try {
      return new URL(value).protocol === "https:";
    } catch (_error) {
      return false;
    }
  }
  function isVideoRepresentation(candidate) {
    return candidate.contentType.includes("video") || candidate.mimeType.startsWith("video");
  }
  function isAudioRepresentation(candidate) {
    return candidate.contentType.includes("audio") || candidate.mimeType.startsWith("audio");
  }
  function compareVideoRepresentations(left, right) {
    return right.height - left.height || right.bandwidth - left.bandwidth || right.width - left.width;
  }
  function compareAudioRepresentations(left, right) {
    return right.bandwidth - left.bandwidth;
  }
  var DashExecutionCoordinator = class {
    /** @param {DashExecutionDependencies} dependencies */
    constructor(dependencies) {
      for (const name of [
        "fetchArrayBuffer",
        "mux",
        "createMp4Blob",
        "saveMerged",
        "saveStream"
      ]) {
        if (typeof dependencies?.[name] !== "function") {
          throw new TypeError(`DashExecutionCoordinator requires ${name}().`);
        }
      }
      this.dependencies = Object.freeze({ ...dependencies });
    }
    /**
     * @param {{videoUrl: string, audioUrl?: string|null, metadata: Object}} input
     * @return {Promise<*>}
     */
    async execute(input) {
      const { videoUrl, audioUrl, metadata } = input;
      const dependencies = this.dependencies;
      const logger = dependencies.logger || (() => {
      });
      logger("[DASH]", "downloadDashStreams()", {
        videoUrl,
        audioUrl: audioUrl || null,
        sourceType: metadata.sourceType,
        shortcode: metadata.shortcode
      });
      if (!audioUrl) {
        logger(
          "[DASH]",
          "Downloaded DASH video only (no audio rep / has_audio=false)."
        );
        return await dependencies.saveStream(videoUrl, {
          ...metadata,
          filetype: "mp4"
        });
      }
      try {
        logger("[DASH]", "Fetching DASH streams for mux...");
        const [videoBuffer, audioBuffer] = await Promise.all([
          dependencies.fetchArrayBuffer(videoUrl),
          dependencies.fetchArrayBuffer(audioUrl)
        ]);
        logger(
          "[DASH]",
          "Muxing DASH video+audio into one MP4 (mp4box main thread)..."
        );
        const mergedBuffer = await dependencies.mux(videoBuffer, audioBuffer);
        const mergedBlob = dependencies.createMp4Blob(mergedBuffer);
        const result = await dependencies.saveMerged(videoUrl, mergedBlob, {
          ...metadata,
          filetype: "mp4"
        });
        logger("[DASH]", "Merged MP4 download triggered.");
        return result;
      } catch (error) {
        logger(
          "[DASH]",
          "Mux failed -> fallback to separate downloads",
          error?.message || error
        );
        const videoResult = await dependencies.saveStream(videoUrl, {
          ...metadata,
          filetype: "mp4"
        });
        const audioResult = await dependencies.saveStream(audioUrl, {
          ...metadata,
          filetype: "m4a"
        });
        return videoResult && audioResult;
      }
    }
  };

  // src/media/image-candidates.js
  function getImageTransformation(value) {
    if (typeof value !== "string" || value.length === 0) return null;
    try {
      return new URL(value).searchParams.get("stp");
    } catch (_error) {
      return null;
    }
  }
  function compareImageCandidates(left, right) {
    const leftTransformation = getImageTransformation(left?.url);
    const rightTransformation = getImageTransformation(right?.url);
    if (leftTransformation && rightTransformation) {
      if (leftTransformation.length > rightTransformation.length) return 1;
      if (leftTransformation.length < rightTransformation.length) return -1;
      return 0;
    }
    const leftWidth = Number(left?.width);
    const rightWidth = Number(right?.width);
    const safeLeftWidth = Number.isFinite(leftWidth) ? leftWidth : 0;
    const safeRightWidth = Number.isFinite(rightWidth) ? rightWidth : 0;
    if (safeLeftWidth < safeRightWidth) return 1;
    if (safeLeftWidth > safeRightWidth) return -1;
    return 0;
  }
  function orderImageCandidates(candidates) {
    if (!Array.isArray(candidates)) return [];
    return candidates.map((candidate, index) => ({ candidate, index })).sort((left, right) => {
      return compareImageCandidates(left.candidate, right.candidate) || left.index - right.index;
    }).map(({ candidate }) => candidate);
  }
  function selectBestImageCandidate(candidates) {
    return orderImageCandidates(candidates)[0] ?? null;
  }

  // src/media/normalizers.js
  function isRecord(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
  }
  function optionalString(value) {
    return typeof value === "string" && value.length > 0 ? value : null;
  }
  function getMediaOwner(resource) {
    return optionalString(resource?.owner?.username) ?? optionalString(resource?.user?.username);
  }
  function getApiImageCandidates(item) {
    return Array.isArray(item?.image_versions2?.candidates) ? item.image_versions2.candidates : [];
  }
  function getLegacyDisplayResources(item) {
    return Array.isArray(item?.display_resources) ? item.display_resources : [];
  }
  function getLegacyDirectImageUrl(item) {
    const resources = getLegacyDisplayResources(item);
    return optionalString(resources.at(-1)?.src) ?? optionalString(item?.display_url);
  }
  function getLegacyThumbnailUrl(item) {
    const resources = getLegacyDisplayResources(item);
    return optionalString(resources[1]?.src) ?? optionalString(resources[0]?.src) ?? optionalString(item?.display_url);
  }
  function createMediaDescriptor({
    mediaId,
    directUrl,
    thumbnailUrl,
    kind,
    owner,
    shortcode,
    publishTime,
    carouselIndex,
    rawMediaItem,
    dashManifest,
    labelTranslationAttribute = "data-ih-locale"
  }) {
    const normalizedDirectUrl = optionalString(directUrl);
    if (mediaId == null || normalizedDirectUrl === null) return null;
    return {
      mediaId,
      directUrl: normalizedDirectUrl,
      thumbnailUrl: optionalString(thumbnailUrl),
      kind,
      extension: kind === "video" ? "mp4" : "jpg",
      owner: optionalString(owner),
      shortcode: optionalString(shortcode),
      publishTime: typeof publishTime === "string" || typeof publishTime === "number" ? publishTime : null,
      carouselIndex,
      rawMediaItem,
      dashManifest: optionalString(dashManifest),
      labelTranslationAttribute
    };
  }
  function extractLegacyResource(payload) {
    if (!isRecord(payload)) return null;
    const root = isRecord(payload.data) ? payload.data : payload;
    const resource = isRecord(root.shortcode_media) ? root.shortcode_media : root;
    return isRecord(resource) ? resource : null;
  }
  function normalizeLegacyMedia(payload) {
    const resource = extractLegacyResource(payload);
    if (!resource) return [];
    const owner = getMediaOwner(resource);
    const shortcode = optionalString(resource.shortcode);
    const publishTime = resource.taken_at_timestamp;
    if (resource.__typename === "GraphVideo") {
      const descriptor = createMediaDescriptor({
        mediaId: resource.id,
        directUrl: resource.video_url,
        thumbnailUrl: getLegacyThumbnailUrl(resource),
        kind: "video",
        owner,
        shortcode,
        publishTime,
        carouselIndex: 1,
        rawMediaItem: resource,
        dashManifest: resource.video_dash_manifest
      });
      return descriptor ? [descriptor] : [];
    }
    if (resource.__typename === "GraphImage") {
      const descriptor = createMediaDescriptor({
        mediaId: resource.id,
        directUrl: getLegacyDirectImageUrl(resource),
        thumbnailUrl: getLegacyThumbnailUrl(resource),
        kind: "image",
        owner,
        shortcode,
        publishTime,
        carouselIndex: 1,
        rawMediaItem: resource,
        dashManifest: null
      });
      return descriptor ? [descriptor] : [];
    }
    if (resource.__typename !== "GraphSidecar") return [];
    const edges = Array.isArray(resource.edge_sidecar_to_children?.edges) ? resource.edge_sidecar_to_children.edges : [];
    return edges.flatMap((edge, index) => {
      const item = isRecord(edge?.node) ? edge.node : null;
      if (!item) return [];
      if (item.__typename === "GraphVideo") {
        const descriptor = createMediaDescriptor({
          mediaId: item.id,
          directUrl: item.video_url,
          thumbnailUrl: getLegacyThumbnailUrl(item),
          kind: "video",
          owner,
          shortcode,
          publishTime,
          carouselIndex: index + 1,
          rawMediaItem: item,
          dashManifest: item.video_dash_manifest,
          labelTranslationAttribute: "data-ih-locale-title"
        });
        return descriptor ? [descriptor] : [];
      }
      if (item.__typename === "GraphImage") {
        const descriptor = createMediaDescriptor({
          mediaId: item.id,
          directUrl: getLegacyDirectImageUrl(item),
          thumbnailUrl: getLegacyThumbnailUrl(item),
          kind: "image",
          owner,
          shortcode,
          publishTime,
          carouselIndex: index + 1,
          rawMediaItem: item,
          dashManifest: null
        });
        return descriptor ? [descriptor] : [];
      }
      return [];
    });
  }
  function extractApiResource(payload) {
    if (!isRecord(payload)) return null;
    const root = isRecord(payload.data) ? payload.data : payload;
    const xdtItem = root.xdt_api__v1__media__shortcode__web_info?.items?.[0];
    const resource = isRecord(xdtItem) && xdtItem || isRecord(root.shortcode_media) && root.shortcode_media || isRecord(root.items?.[0]) && root.items[0] || root;
    return isRecord(resource) ? resource : null;
  }
  function normalizeApiItem(item, { owner, shortcode, carouselIndex }) {
    const imageCandidates = getApiImageCandidates(item);
    if (item.video_versions == null) {
      const image = selectBestImageCandidate(imageCandidates);
      return createMediaDescriptor({
        mediaId: item.pk ?? item.id,
        directUrl: image?.url,
        thumbnailUrl: image?.url,
        kind: "image",
        owner,
        shortcode,
        publishTime: item.taken_at,
        carouselIndex,
        rawMediaItem: item,
        dashManifest: null
      });
    }
    const firstVideo = Array.isArray(item.video_versions) ? item.video_versions[0] : null;
    return createMediaDescriptor({
      mediaId: item.pk ?? item.id,
      directUrl: firstVideo?.url,
      thumbnailUrl: imageCandidates[0]?.url,
      kind: "video",
      owner,
      shortcode,
      publishTime: item.taken_at,
      carouselIndex,
      rawMediaItem: item,
      dashManifest: item.video_dash_manifest
    });
  }
  function normalizeApiMedia(payload) {
    const resource = extractApiResource(payload);
    if (!resource) return [];
    const owner = getMediaOwner(resource);
    const shortcode = optionalString(resource.code) ?? optionalString(resource.shortcode);
    if (Array.isArray(resource.carousel_media)) {
      return resource.carousel_media.flatMap((item, index) => {
        if (!isRecord(item)) return [];
        const descriptor2 = normalizeApiItem(item, {
          owner,
          shortcode,
          carouselIndex: index + 1
        });
        return descriptor2 ? [descriptor2] : [];
      });
    }
    const descriptor = normalizeApiItem(resource, {
      owner,
      shortcode,
      carouselIndex: 1
    });
    return descriptor ? [descriptor] : [];
  }
  function normalizeMediaResponse(response) {
    if (!isRecord(response)) return [];
    return response.type === "query_hash" ? normalizeLegacyMedia(response.data) : normalizeApiMedia(response.data ?? response);
  }
  var normalizeQueryHashMedia = normalizeLegacyMedia;
  var normalizeQueryIdMedia = normalizeApiMedia;

  // src/media/progressive-candidates.js
  function toPositiveFiniteNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? number : 0;
  }
  function compareMaximumProgressiveCandidates(left, right) {
    return right.shortSide - left.shortSide || right.area - left.area || right.bandwidth - left.bandwidth || left.index - right.index;
  }
  function rankMaximumProgressiveCandidates(candidates) {
    return Array.isArray(candidates) ? [...candidates].sort(compareMaximumProgressiveCandidates) : [];
  }
  function extractMaximumProgressiveItem(data) {
    if (data === null || typeof data !== "object" || Array.isArray(data)) {
      return null;
    }
    const item = data.xdt_api__v1__media__shortcode__web_info?.items?.[0] || data.shortcode_media || data.items?.[0] || data;
    return item !== null && typeof item === "object" && !Array.isArray(item) ? item : null;
  }
  function normalizeMaximumProgressiveCandidates(data) {
    const item = extractMaximumProgressiveItem(data);
    if (!item) return [];
    const versions = Array.isArray(item.video_versions) ? item.video_versions : [];
    const rawCandidates = versions.length ? versions : item.video_url ? [{
      url: item.video_url,
      width: item.original_width,
      height: item.original_height
    }] : [];
    const seen = /* @__PURE__ */ new Set();
    const candidates = rawCandidates.flatMap((candidate, index) => {
      const url = candidate?.url || candidate?.video_url || candidate?.src;
      let parsed;
      try {
        parsed = new URL(url);
      } catch (_error) {
        return [];
      }
      if (parsed.protocol !== "https:" || seen.has(parsed.href)) return [];
      seen.add(parsed.href);
      const width = toPositiveFiniteNumber(
        candidate.width ?? candidate.config_width ?? item.original_width
      );
      const height = toPositiveFiniteNumber(
        candidate.height ?? candidate.config_height ?? item.original_height
      );
      const bandwidth = toPositiveFiniteNumber(
        candidate.bandwidth ?? candidate.bitrate ?? candidate.video_bandwidth
      );
      return [{
        area: width * height,
        bandwidth,
        height,
        index,
        shortSide: Math.min(width, height),
        url: parsed.href,
        width
      }];
    });
    return rankMaximumProgressiveCandidates(candidates);
  }
  var normalizeMaximumReelCandidates = normalizeMaximumProgressiveCandidates;

  // src/media/render.js
  function renderMediaRow(document2, descriptor, translate, options = {}) {
    if (typeof document2?.createElement !== "function") {
      throw new TypeError("renderMediaRow requires a Document.");
    }
    if (!descriptor || typeof descriptor !== "object") {
      throw new TypeError("renderMediaRow requires a MediaDescriptor.");
    }
    const isVideo = descriptor.kind === "video";
    const sourceType = options.sourceType || (isVideo ? "video" : "photo");
    const localeKey = isVideo ? "VID" : "IMG";
    const thumbnailUrl = descriptor.thumbnailUrl || descriptor.directUrl;
    const anchor = document2.createElement("a");
    anchor.setAttribute("media-id", String(descriptor.mediaId));
    anchor.setAttribute("datetime", String(descriptor.publishTime ?? ""));
    anchor.setAttribute("data-blob", "true");
    anchor.setAttribute("data-needed", "direct");
    anchor.setAttribute("data-path", descriptor.shortcode ?? "");
    anchor.setAttribute("data-name", sourceType);
    anchor.setAttribute("data-type", descriptor.extension);
    anchor.setAttribute("data-username", descriptor.owner ?? "");
    anchor.setAttribute("data-globalIndex", String(descriptor.carouselIndex));
    anchor.setAttribute("href", "javascript:;");
    anchor.setAttribute("data-href", descriptor.directUrl);
    const image = document2.createElement("img");
    image.width = 100;
    image.src = thumbnailUrl;
    anchor.append(image, document2.createElement("br"), "- ");
    const label = document2.createElement("span");
    label.setAttribute(
      options.labelTranslationAttribute || descriptor.labelTranslationAttribute || "data-ih-locale",
      localeKey
    );
    label.textContent = translate(localeKey);
    anchor.append(label, ` ${options.displayIndex ?? descriptor.carouselIndex} -`);
    return anchor;
  }

  // src/media/surface-normalizers.js
  var MEDIA_SURFACE = Object.freeze({
    AVATAR: "avatar",
    HIGHLIGHT: "highlights",
    REEL: "reels",
    STORY: "stories"
  });
  var STORY_IMAGE_CANDIDATE = Object.freeze({
    DISPLAY_URL: "display-url",
    LAST: "last",
    WIDEST: "widest"
  });
  var STORY_VIDEO_CANDIDATE = Object.freeze({
    FIRST: "first",
    LAST: "last"
  });
  function isRecord2(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
  }
  function optionalString2(value) {
    return typeof value === "string" && value.length > 0 ? value : null;
  }
  function optionalIdentity(value) {
    if (typeof value === "string" && value.length > 0) return value;
    if (typeof value === "number" && Number.isFinite(value)) return value;
    return null;
  }
  function optionalPublishTime(value) {
    return optionalIdentity(value);
  }
  function getOwner(resource) {
    return optionalString2(resource?.owner?.username) ?? optionalString2(resource?.user?.username);
  }
  function createSurfaceDescriptor({
    mediaId,
    directUrl,
    thumbnailUrl,
    kind,
    owner,
    shortcode,
    publishTime,
    carouselIndex,
    rawMediaItem,
    dashManifest,
    sourceType
  }) {
    const normalizedMediaId = optionalIdentity(mediaId);
    const normalizedDirectUrl = optionalString2(directUrl);
    if (normalizedMediaId === null || normalizedDirectUrl === null) return null;
    return {
      mediaId: normalizedMediaId,
      directUrl: normalizedDirectUrl,
      thumbnailUrl: optionalString2(thumbnailUrl),
      kind,
      extension: kind === "video" ? "mp4" : "jpg",
      owner: optionalString2(owner),
      shortcode: optionalString2(shortcode),
      publishTime: optionalPublishTime(publishTime),
      carouselIndex,
      rawMediaItem,
      dashManifest: optionalString2(dashManifest),
      sourceType
    };
  }
  function extractProfileUser(payload) {
    if (!isRecord2(payload)) return null;
    const user = payload?.data?.user ?? payload.user ?? payload.data ?? payload;
    return isRecord2(user) ? user : null;
  }
  function extractHighResolutionProfileUrl(payload) {
    if (typeof payload === "string") return optionalString2(payload);
    const user = extractProfileUser(payload);
    return optionalString2(user?.hd_profile_pic_url_info?.url) ?? optionalString2(user?.profile_pic_url_hd);
  }
  function normalizeProfileAvatar(payload, {
    highResolutionPayload = null,
    owner = null,
    publishTime = null
  } = {}) {
    const user = extractProfileUser(payload);
    if (!user) return [];
    const directUrl = extractHighResolutionProfileUrl(highResolutionPayload) ?? optionalString2(user?.hd_profile_pic_url_info?.url) ?? optionalString2(user?.profile_pic_url_hd) ?? optionalString2(user?.profile_pic_url);
    const thumbnailUrl = optionalString2(user?.profile_pic_url) ?? directUrl;
    const descriptor = createSurfaceDescriptor({
      mediaId: user.pk ?? user.id,
      directUrl,
      thumbnailUrl,
      kind: "image",
      owner: owner ?? user.username,
      shortcode: null,
      publishTime,
      carouselIndex: 1,
      rawMediaItem: user,
      dashManifest: null,
      sourceType: MEDIA_SURFACE.AVATAR
    });
    return descriptor ? [descriptor] : [];
  }
  function extractStoryReel(payload) {
    if (!isRecord2(payload)) return null;
    const reelsMedia = payload?.data?.reels_media ?? payload.reels_media;
    if (Array.isArray(reelsMedia) && isRecord2(reelsMedia[0])) {
      return reelsMedia[0];
    }
    return Array.isArray(payload.items) ? payload : null;
  }
  function selectLargestStoryDisplayResource(resources) {
    if (!Array.isArray(resources) || resources.length === 0) return null;
    return [...resources].sort((left, right) => {
      if (left?.config_width < right?.config_width) return 1;
      if (left?.config_width > right?.config_width) return -1;
      return 0;
    })[0];
  }
  function selectStoryImageUrl(item, preference) {
    const resources = Array.isArray(item.display_resources) ? item.display_resources : [];
    switch (preference) {
      case STORY_IMAGE_CANDIDATE.DISPLAY_URL:
        return optionalString2(item.display_url);
      case STORY_IMAGE_CANDIDATE.LAST:
        return optionalString2(resources.at(-1)?.src);
      case STORY_IMAGE_CANDIDATE.WIDEST:
        return optionalString2(
          selectLargestStoryDisplayResource(resources)?.src
        );
      default:
        throw new TypeError(`Unknown Story image candidate: ${preference}`);
    }
  }
  function selectStoryVideoUrl(item, preference) {
    const resources = Array.isArray(item.video_resources) ? item.video_resources : [];
    switch (preference) {
      case STORY_VIDEO_CANDIDATE.FIRST:
        return optionalString2(resources[0]?.src);
      case STORY_VIDEO_CANDIDATE.LAST:
        return optionalString2(resources.at(-1)?.src);
      default:
        throw new TypeError(`Unknown Story video candidate: ${preference}`);
    }
  }
  function normalizeStorySurfaceMedia(payload, {
    surface,
    renamePublishDate = false,
    nowSeconds,
    imageCandidate = STORY_IMAGE_CANDIDATE.WIDEST,
    videoCandidate = STORY_VIDEO_CANDIDATE.FIRST
  }) {
    if (surface !== MEDIA_SURFACE.STORY && surface !== MEDIA_SURFACE.HIGHLIGHT) {
      throw new TypeError(`Unknown Story surface: ${surface}`);
    }
    if (!Number.isFinite(nowSeconds)) {
      throw new TypeError("nowSeconds must be a finite number.");
    }
    const reel = extractStoryReel(payload);
    if (!reel) return [];
    const items = Array.isArray(reel.items) ? reel.items : [];
    const owner = optionalString2(reel?.user?.username) ?? optionalString2(reel?.owner?.username);
    return items.flatMap((item, index) => {
      if (!isRecord2(item)) return [];
      const isVideo = item.is_video === true;
      const imageUrl = selectStoryImageUrl(item, imageCandidate);
      const descriptor = createSurfaceDescriptor({
        mediaId: item.id,
        directUrl: isVideo ? selectStoryVideoUrl(item, videoCandidate) : imageUrl,
        thumbnailUrl: imageUrl,
        kind: isVideo ? "video" : "image",
        owner,
        shortcode: item.id,
        publishTime: renamePublishDate ? item.taken_at_timestamp ?? nowSeconds : nowSeconds,
        carouselIndex: index + 1,
        rawMediaItem: item,
        dashManifest: item.video_dash_manifest,
        sourceType: surface
      });
      return descriptor ? [descriptor] : [];
    });
  }
  function normalizeStoryMedia(payload, options) {
    return normalizeStorySurfaceMedia(payload, {
      imageCandidate: STORY_IMAGE_CANDIDATE.WIDEST,
      videoCandidate: STORY_VIDEO_CANDIDATE.FIRST,
      ...options,
      surface: MEDIA_SURFACE.STORY
    });
  }
  function normalizeHighlightMedia(payload, options) {
    return normalizeStorySurfaceMedia(payload, {
      imageCandidate: STORY_IMAGE_CANDIDATE.LAST,
      videoCandidate: STORY_VIDEO_CANDIDATE.LAST,
      ...options,
      surface: MEDIA_SURFACE.HIGHLIGHT
    });
  }
  function getReelResponseType(response) {
    if (isRecord2(response) && response.type === "query_hash") {
      return "query_hash";
    }
    if (isRecord2(response) && response.type === "query_id") {
      return "query_id";
    }
    const payload = isRecord2(response?.data) ? response.data : response;
    if (isRecord2(payload?.shortcode_media) || payload?.__typename === "GraphVideo" || payload?.__typename === "GraphImage") {
      return "query_hash";
    }
    return "query_id";
  }
  function extractReelItems(response, responseType) {
    if (!isRecord2(response)) return [];
    const envelope = isRecord2(response.data) ? response.data : response;
    const payload = isRecord2(envelope.data) ? envelope.data : envelope;
    if (responseType === "query_hash") {
      const resource = isRecord2(payload.shortcode_media) ? payload.shortcode_media : payload;
      return isRecord2(resource) ? [resource] : [];
    }
    const xdtItems = payload?.xdt_api__v1__media__shortcode__web_info?.items;
    if (Array.isArray(xdtItems)) return xdtItems.filter(isRecord2);
    if (Array.isArray(payload.items)) return payload.items.filter(isRecord2);
    return isRecord2(payload) ? [payload] : [];
  }
  function normalizeReelMedia(response, { isVideo = null, shortcode = null } = {}) {
    const responseType = getReelResponseType(response);
    const items = extractReelItems(response, responseType);
    return items.flatMap((item, index) => {
      const imageCandidates = Array.isArray(item?.image_versions2?.candidates) ? item.image_versions2.candidates : [];
      const displayResources = Array.isArray(item.display_resources) ? item.display_resources : [];
      const thumbnailUrl = responseType === "query_hash" ? optionalString2(displayResources.at(-1)?.src) : optionalString2(imageCandidates[0]?.url);
      const resourceIsVideo = responseType === "query_hash" ? item.is_video === true : item.video_versions != null;
      const useVideo = typeof isVideo === "boolean" ? isVideo && resourceIsVideo : resourceIsVideo;
      const directUrl = useVideo ? responseType === "query_hash" ? item.video_url : item?.video_versions?.[0]?.url : thumbnailUrl;
      const descriptor = createSurfaceDescriptor({
        mediaId: item.pk ?? item.id,
        directUrl,
        thumbnailUrl,
        kind: useVideo ? "video" : "image",
        owner: getOwner(item),
        shortcode: shortcode ?? item.code ?? item.shortcode,
        publishTime: responseType === "query_hash" ? item.taken_at_timestamp : item.taken_at,
        carouselIndex: index + 1,
        rawMediaItem: item,
        dashManifest: item.video_dash_manifest,
        sourceType: MEDIA_SURFACE.REEL
      });
      return descriptor ? [descriptor] : [];
    });
  }

  // src/resources/internal.css
  var internal_default = '[data-ih-locale-title] svg {\n    vertical-align: middle;\n}\n\n.IG_POPUP_DIG {\n    position: fixed;\n    left: 0px;\n    right: 0px;\n    bottom: 0px;\n    top: 0px;\n    z-index: 500;\n}\n\n.IG_POPUP_DIG.hidden {\n    display: none;\n}\n\n.IG_POPUP_DIG button:disabled {\n    opacity: 0.5;\n    cursor: not-allowed;\n    pointer-events: none;\n}\n\n.IG_POPUP_DIG_BG {\n    position: fixed;\n    left: 0px;\n    right: 0px;\n    bottom: 0px;\n    top: 0px;\n    z-index: 502;\n    background: rgba(0, 0, 0, .75);\n}\n\n.IG_POPUP_DIG_MAIN {\n    z-index: 510;\n    padding: 10px 15px;\n    top: 7%;\n    position: absolute;\n    left: 50%;\n    transform: translateX(-50%);\n    width: 500px;\n    background: #fff;\n    background: rgb(var(--ig-secondary-background));\n    color: #000;\n    color: rgb(var(--ig-primary-text));\n    border-radius: 7px;\n}\n\n.IG_POPUP_DIG_BODY {\n    min-height: 100px;\n    max-height: 70vh;\n    overflow-y: auto;\n}\n\n.IG_POPUP_DIG_BODY a {\n    display: block;\n    padding: 5px 0px;\n    color: #111;\n    color: rgb(var(--ig-primary-text));\n    font-size: 1rem;\n    line-height: 1rem;\n    text-align: center;\n    border-radius: 5px;\n}\n\n.IG_DW_MAIN,\n.IG_NEWTAB_MAIN,\n.IG_THUMBNAIL_MAIN,\n.IG_DW_ALL_MAIN,\n.IG_IMAGE_VIEWER {\n    position: relative;\n    top: 0px;\n    padding: 4px;\n    line-height: 0;\n    background: transparent;\n    color: #ffffff;\n    border-radius: 6px;\n    cursor: pointer;\n    display: inline-flex;\n    align-items: center;\n    justify-content: center;\n    width: 26px;\n    height: 26px;\n    box-sizing: border-box;\n    transition: background 0.2s ease;\n}\n\n.IG_DW_MAIN:hover,\n.IG_NEWTAB_MAIN:hover,\n.IG_THUMBNAIL_MAIN:hover,\n.IG_DW_ALL_MAIN:hover,\n.IG_IMAGE_VIEWER:hover {\n    background: rgba(255, 255, 255, 0.25);\n}\n\n.button_wrapper {\n    position: absolute;\n    top: 15px;\n    right: 15px;\n    line-height: 0;\n    display: flex;\n    flex-flow: row-reverse;\n    gap: 8px;\n    z-index: 1;\n    background: rgba(0, 0, 0, 0.35);\n    backdrop-filter: blur(8px);\n    -webkit-backdrop-filter: blur(8px);\n    padding: 6px 8px;\n    border-radius: 12px;\n    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);\n    border: 1px solid rgba(255, 255, 255, 0.1);\n}\n\n/* SVG scaling */\n.button_wrapper svg {\n    width: 18px;\n    height: 18px;\n    display: block;\n}\n\n#_SNLOAD {\n    text-align: center;\n    font-size: 20px;\n}\n\n.IG_REELS,\n.IG_DWSTORY,\n.IG_DWHISTORY,\n.IG_DWSTORY_ALL,\n.IG_DWHISTORY_ALL {\n    position: absolute;\n    right: 40px;\n    top: 15px;\n    padding: 2px;\n    line-height: 0;\n    background: #fff;\n    border-radius: 5px;\n    cursor: pointer;\n    z-index: 5;\n}\n\n.IG_REELS_NEWTAB,\n.IG_DWNEWTAB,\n.IG_DWHINEWTAB {\n    position: absolute;\n    right: 40px;\n    top: 47px;\n    padding: 2px;\n    line-height: 0;\n    background: #fff;\n    border-radius: 5px;\n    cursor: pointer;\n    z-index: 5;\n    color: #000;\n}\n\n.IG_REELS_THUMBNAIL,\n.IG_DWSTORY_THUMBNAIL,\n.IG_DWHISTORY_THUMBNAIL {\n    position: absolute;\n    right: 40px;\n    top: 79px;\n    padding: 2px;\n    line-height: 1;\n    background: #fff;\n    border-radius: 5px;\n    cursor: pointer;\n    z-index: 5;\n}\n\n.IG_DWSTORY_POSITION,\n.IG_DWHISTORY_POSITION {\n    position: absolute;\n    right: -24px;\n    top: 47px;\n    width: 28px;\n    height: 28px;\n    padding: 2px;\n    box-sizing: border-box;\n    display: flex;\n    align-items: center;\n    justify-content: center;\n    background: #fff;\n    border-radius: 5px;\n    color: #000;\n    cursor: default;\n    font-size: 10px;\n    font-weight: 700;\n    line-height: 1;\n    letter-spacing: -0.4px;\n    white-space: nowrap;\n    z-index: 5;\n    user-select: none;\n}\n\n*:not(:has(> section[class]))>.IG_DWSTORY,\n*:not(:has(> section[class]))>.IG_DWHISTORY,\n*:not(:has(> section[class]))>.IG_DWSTORY_THUMBNAIL,\n*:not(:has(> section[class]))>.IG_DWHISTORY_THUMBNAIL,\n*:not(:has(> section[class]))>.IG_DWNEWTAB,\n*:not(:has(> section[class]))>.IG_DWHINEWTAB {\n    right: -40px;\n    color: #000;\n}\n\n*:not(:has(> section[class]))>.IG_DWSTORY_ALL,\n*:not(:has(> section[class]))>.IG_DWHISTORY_ALL,\n*:not(:has(> section[class]))>.IG_DWSTORY_POSITION,\n*:not(:has(> section[class]))>.IG_DWHISTORY_POSITION {\n    right: -70px;\n    color: #000;\n}\n\n.IG_DWSTORY,\n.IG_DWHISTORY,\n.IG_DWSTORY_THUMBNAIL,\n.IG_DWHISTORY_THUMBNAIL,\n.IG_DWNEWTAB,\n.IG_DWHINEWTAB {\n    right: 6px;\n    color: #000;\n}\n\n.IG_DWSTORY_ALL,\n.IG_DWHISTORY_ALL {\n    right: -24px;\n    color: #000;\n}\n\n.IG_DWPROFILE {\n    position: absolute;\n    right: 0px;\n    top: 0px;\n    padding: 2px;\n    line-height: 1;\n    background: #fff;\n    border-radius: 50%;\n    cursor: pointer;\n    border: 1px solid #ccc\n}\n\n.IG_DWPROFILE svg {\n    color: #000;\n}\n\n.globalSettings {\n    position: relative;\n    display: inline-block;\n    color: #000;\n    color: rgb(var(--ig-primary-text));\n    text-decoration: none;\n    text-align: left;\n    width: 100%;\n    min-height: 30px;\n    padding: 5px;\n    padding-right: 60px;\n    line-height: 18px;\n    font-size: 18px;\n    box-sizing: border-box;\n    border-radius: 5px;\n    vertical-align: middle;\n    outline: none;\n    cursor: pointer;\n    -ms-user-select: none;\n    -moz-user-select: none;\n    -webkit-user-select: none;\n    user-select: none;\n    margin: 5px 0px;\n}\n\n.globalSettings:hover {\n    background: #e7e7e7;\n    background: rgb(var(--ig-secondary-button-hover));\n}\n\n.globalSettings:hover>span {\n    cursor: help;\n}\n\n.globalSettings input:not(#date_format) {\n    display: none;\n}\n\n.globalSettings input#date_format {\n    width: calc(100% - 50px);\n    background: rgb(var(--ig-secondary-background));\n    border: 1px solid;\n    position: relative;\n    top: 50%;\n    transform: translateY(-50%);\n}\n\n.globalSettings .chbtn {\n    width: 40px;\n    height: 15px;\n    background: #9c9c9c;\n    display: inline-block;\n    vertical-align: middle;\n    border-radius: 7px;\n    position: absolute;\n    right: 15px;\n    top: 50%;\n    transition: background 0.2s;\n    transform: translateY(-50%);\n}\n\n.globalSettings .chbtn .rounds {\n    width: 20px;\n    height: 20px;\n    background: #777;\n    display: inline-block;\n    vertical-align: middle;\n    border-radius: 50%;\n    position: absolute;\n    left: 0px;\n    top: -3px;\n    transition: left 0.15s, background 0.15s;\n}\n\n.globalSettings input:checked~.chbtn {\n    background: #004c5a;\n}\n\n.globalSettings input:checked~.chbtn .rounds {\n    left: 20px;\n    background: #048aa4;\n}\n\n.checkbox {\n    font-size: 18px;\n    vertical-align: middle;\n    margin: 0px 7px;\n    user-select: none;\n    margin-left: 0px;\n}\n\n.checkbox input {\n    transform: scale(1.5);\n    margin-right: 10px;\n}\n\n.inner_box_wrapper {\n    display: block;\n    position: absolute;\n    left: 0px;\n    top: 0px;\n    width: 50px;\n    height: 100%;\n    border-right: 1px solid;\n    background: #e7e7e7;\n    background: rgb(var(--ig-secondary-button-hover));\n    cursor: pointer;\n    border-radius: 7px 0px 0px 7px;\n}\n\n.inner_box~span {\n    position: relative;\n    height: 100%;\n    width: 100%;\n    display: block;\n    border-radius: 7px 0px 0px 7px;\n}\n\n.inner_box:checked~span {\n    background: rgb(var(--ig-success));\n}\n\n.inner_box~span:after {\n    content: "";\n    position: absolute;\n    display: none;\n    left: 12px;\n    top: 50%;\n    width: 10px;\n    height: 20px;\n    margin-top: -8px;\n    border: solid black;\n    border: solid rgb(var(--ig-primary-text));\n    border-width: 0 3px 3px 0;\n    -webkit-transform: rotate(45deg) translateY(-50%);\n    -ms-transform: rotate(45deg) translateY(-50%);\n    transform: rotate(45deg) translateY(-50%);\n}\n\n.inner_box:checked~span:after {\n    display: block;\n}\n\n.inner_box {\n    position: absolute;\n    top: 10px;\n    left: 50%;\n    transform: scale(2.5) translateY(-50%);\n    cursor: pointer;\n    appearance: none;\n    opacity: 0;\n}\n\n.IG_POPUP_DIG_BODY>div {\n    position: relative;\n    border: 1px solid #000;\n    border: 1px solid rgb(var(--ig-primary-text));\n    margin: 5px 0px;\n    border-radius: 7px;\n}\n\n.IG_POPUP_DIG_BODY>div:hover {\n    background: rgba(var(--ig-hover-overlay));\n}\n\n.IG_POPUP_DIG_TITLE {\n    padding-bottom: 5px;\n}\n\n.IG_POPUP_DIG_TITLE button {\n    font-size: 14px;\n    vertical-align: middle;\n    margin: 0px 7px;\n}\n\nkbd {\n    font-weight: bold;\n    padding: 4px 5px;\n    background: rgb(var(--ig-primary-background));\n    border-radius: 3px;\n    border: 1px solid rgb(var(--ig-primary-text));\n}\n\n.globalSettings #tempWrapper {\n    position: absolute;\n    top: 0px;\n    left: 0px;\n    right: 0px;\n    height: 100%;\n    background: #fff;\n    background: rgb(var(--ig-secondary-background));\n}\n\n.globalSettings #tempWrapper input[type="range"] {\n    display: inline-block;\n    width: 80%;\n    position: relative;\n    top: 50%;\n    transform: translateY(-50%);\n}\n\n.globalSettings #tempWrapper input[type="number"] {\n    display: inline-block;\n    width: 50px;\n    border-radius: 7px;\n    outline: 0px;\n    background: transparent;\n    border: 1px solid;\n    position: relative;\n    top: 50%;\n    transform: translateY(-50%);\n}\n\n.globalSettings.child {\n    margin-left: 15px;\n    width: calc(100% - 15px);\n}\n\n#scrollWrapper {\n    position: fixed;\n    right: 15px;\n    bottom: 15px;\n}\n\n#scrollWrapper .button-up,\n#scrollWrapper .button-down {\n    width: 32px;\n    height: 32px;\n    border-radius: 10px;\n    background-color: rgba(0, 0, 0, 0.25);\n    background-color: rgba(var(--ig-banner-background));\n    cursor: pointer;\n    margin: 5px 0px;\n    border: 1px solid;\n    border-color: rgb(var(--ig-separator));\n}\n\n#scrollWrapper .button-up:hover,\n#scrollWrapper .button-down:hover {\n    width: 32px;\n    height: 32px;\n    border-radius: 10px;\n    background-color: rgba(0, 0, 0, 0.25);\n    background-color: rgba(var(--ig-hover-overlay));\n    cursor: pointer;\n    margin: 5px 0px;\n}\n\n#scrollWrapper .button-up>div,\n#scrollWrapper .button-down>div {\n    position: relative;\n    border: solid #000;\n    border: solid rgb(var(--ig-primary-text));\n    border-width: 0 4px 4px 0;\n    display: inline-block;\n    padding: 4px;\n    left: 9.5px;\n}\n\n#scrollWrapper .button-up>div {\n    transform: rotate(-135deg);\n    -webkit-transform: rotate(-135deg);\n    top: 9px;\n}\n\n#scrollWrapper .button-down>div {\n    transform: rotate(45deg);\n    -webkit-transform: rotate(45deg);\n    top: 6px;\n}\n\n.IG_POPUP_DIG_BODY .newTab {\n    position: absolute;\n    right: 0px;\n    top: 0px;\n    z-index: 3;\n    padding: 7px;\n    cursor: pointer;\n    line-height: 0;\n    border-radius: 5px;\n}\n\n.IG_POPUP_DIG_BODY .videoThumbnail {\n    position: absolute;\n    right: 0px;\n    top: 40px;\n    z-index: 3;\n    padding: 7px;\n    cursor: pointer;\n    line-height: 0;\n    border-radius: 5px;\n}\n\n.IG_POPUP_DIG_BODY .newTab:hover,\n.IG_POPUP_DIG_BODY .videoThumbnail:hover {\n    background: rgb(var(--ig-secondary-button-hover));\n}\n\n.IG_POPUP_DIG_BTN {\n    cursor: pointer;\n    position: absolute;\n    right: 0px;\n    top: 0px;\n    line-height: 0;\n}\n\n#tempWrapper .IG_POPUP_DIG_BTN {\n    right: 5px;\n    transform: translateY(-50%);\n    top: 50%;\n}\n\n#tempWrapper #locatePreview {\n    margin-left: 5px;\n    display: inline-block;\n    text-overflow: ellipsis;\n    overflow: hidden;\n    width: 60%;\n    white-space: nowrap;\n    vertical-align: middle;\n    position: relative;\n    transform: translateY(-50%);\n    top: 50%;\n}\n\n#tempWrapper #locateSelect {\n    transform: translateY(-50%);\n    top: 50%;\n    position: relative;\n    vertical-align: middle;\n}\n\n.volume_slider>div {\n    display: none;\n}\n\ndiv[class]:hover+.volume_slider>div,\n.volume_slider:hover>div {\n    display: block;\n}\n\n.volume_slider {\n    position: absolute;\n    height: 30px;\n    left: 0px;\n    right: 40px;\n}\n\n.volume_slider.bottom {\n    left: 50px;\n    right: 45px;\n    bottom: 15px;\n}\n\n.volume_slider.vertical {\n    top: 80px;\n    right: 25px;\n    transform: rotate(-90deg);\n    transform-origin: right center;\n}\n\n.volume_slider>div {\n    width: calc(100% - 20px);\n    position: absolute;\n    right: 10px;\n    top: 0px;\n    height: 30px;\n    background: rgba(0, 0, 0, 0.25);\n    border-radius: 25px;\n    text-align: center;\n}\n\n.volume_slider input[type="range"] {\n    overflow: hidden;\n    width: 90%;\n    height: inherit;\n    margin: 0 auto;\n    -webkit-appearance: none;\n    appearance: none;\n    background: transparent;\n    cursor: pointer;\n}\n\n.volume_slider input[type="range"]::-webkit-slider-runnable-track {\n    background: rgba(255, 255, 255, 0.35);\n    height: 6px;\n    border-radius: 7px;\n    background: linear-gradient(to right, #fff 0%, #fff var(--ig-track-progress), rgba(255, 255, 255, 0.35) var(--ig-track-progress), rgba(255, 255, 255, 0.35) 100%);\n}\n\n.volume_slider input[type="range"]::-moz-range-track {\n    background: rgba(255, 255, 255, 0.35);\n    height: 6px;\n    border-radius: 7px;\n}\n\n.volume_slider input[type="range"]::-moz-range-progress {\n    background-color: #fff;\n    height: 6px;\n    border-radius: 7px;\n}\n\n.volume_slider input[type="range"]::-webkit-slider-thumb {\n    -webkit-appearance: none;\n    appearance: none;\n    margin-top: -5px;\n    background-color: #fff;\n    height: 16px;\n    width: 16px;\n    border-radius: 50%;\n}\n\n.volume_slider input[type="range"]::-moz-range-thumb {\n    border: none;\n    border-radius: 0;\n    background-color: #fff;\n    height: 16px;\n    width: 16px;\n    border-radius: 50%;\n}\n\n.circle_wrapper {\n    position: fixed;\n    display: flex;\n    right: 15px;\n    bottom: 15px;\n    z-index: 50000;\n    width: fit-content;\n    align-items: center;\n    flex-direction: row;\n    padding: 7px;\n    border-radius: 7px;\n    box-shadow: 0 0 5px #202020;\n    background: rgb(var(--ig-secondary-background));\n}\n\n.circle_wrapper circle {\n    display: inline-block;\n    border: 2px solid rgba(255, 152, 0, 0.9);\n    opacity: .9;\n    border-left: 2px solid rgba(0, 0, 0, 0);\n    border-right: 2px solid rgba(0, 0, 0, 0);\n    border-radius: 50px;\n    width: 24px;\n    height: 24px;\n    margin: 0 5px;\n    animation: spinoffPulse 0.5s infinite linear;\n}\n\n.circle_wrapper span {\n    font-size: 16px;\n    font-family: monospace;\n    color: rgb(var(--ig-primary-text));\n}\n\n@keyframes spinoffPulse {\n    0% {\n        transform: rotate(0deg);\n    }\n\n    100% {\n        transform: rotate(360deg);\n    }\n}\n\n#imageViewer {\n    position: fixed;\n    top: 0;\n    left: 0;\n    right: 0;\n    bottom: 0;\n    background: rgba(0, 0, 0, 0.8);\n    display: none;\n    justify-content: center;\n    align-items: center;\n    z-index: 600001;\n    transform: scale(1);\n    transition: transform 0.15s;\n\n    @starting-style {\n        transform: scale(0);\n    }\n}\n\n#imageViewer>div {\n    position: absolute;\n    top: 0px;\n    left: 0px;\n    right: 0px;\n    height: 35px;\n    background: rgba(0, 0, 0, 0.2);\n    display: flex;\n    justify-content: flex-end;\n    align-items: center;\n    z-index: 2;\n    color: #fff;\n    padding: 0px 15px;\n}\n\n#imageViewer>div>div#iv_close {\n    cursor: pointer;\n}\n\n#imageViewer>section {\n    width: auto;\n    height: auto;\n}\n\n#iv_image {\n    max-width: none;\n    max-height: 80svh;\n    width: auto;\n    height: 100%;\n    user-select: none;\n    cursor: grab;\n}\n\n#iv_close {\n    filter: invert(1);\n}\n';

  // src/resources/index.js
  var INTERNAL_CSS = internal_default.endsWith("\n") ? internal_default.slice(0, -1) : internal_default;
  var UPSTREAM_PROVENANCE = Object.freeze(upstream_provenance_default);

  // src/controllers/posts/post-context.js
  function findActionHost(actionElement) {
    let host = actionElement?.nodeType === 1 ? actionElement : null;
    for (let depth = 0; depth < 3 && host; depth += 1) {
      host = host.parentElement;
    }
    return host;
  }
  function getShortcodeFromAnchor(anchor) {
    const href = anchor?.getAttribute?.("href");
    return typeof href === "string" ? href.split("/").at(2) || void 0 : void 0;
  }
  function getShortcodeFromActionHost(actionHost) {
    if (!actionHost) return void 0;
    const lastHostChild = Array.from(actionHost.children).filter(
      (child) => child.tagName === "DIV" && child === actionHost.lastElementChild
    );
    const middleChildren = lastHostChild.flatMap(
      (child) => Array.from(child.children).filter((grandchild) => grandchild.tagName === "DIV")
    );
    const terminalChildren = middleChildren.flatMap(
      (child) => Array.from(child.children).filter(
        (grandchild) => grandchild.tagName === "DIV" && grandchild === child.lastElementChild
      )
    );
    const anchors = terminalChildren.flatMap(
      (child) => Array.from(child.querySelectorAll('a[href^="/p/"]'))
    );
    return getShortcodeFromAnchor(anchors.at(-1));
  }
  function resolvePostContext({
    mainElement,
    actionElement,
    pathname,
    resolveVisibleIndex,
    visibleIndexSource = "main"
  }) {
    const actionHost = findActionHost(actionElement);
    const routeShortcode = String(pathname ?? "").replace(/\/$/, "").split("/").at(-1);
    const mainShortcode = getShortcodeFromAnchor(
      mainElement?.querySelector?.('a[href^="/p/"]')
    );
    const shortcode = routeShortcode || mainShortcode || getShortcodeFromActionHost(actionHost);
    return {
      shortcode: shortcode || void 0,
      owner: mainElement?.getAttribute?.("data-username") ?? void 0,
      get visibleIndex() {
        const visibleIndexHost = visibleIndexSource === "action" ? findActionHost(actionElement) : mainElement;
        return resolveVisibleIndex(visibleIndexHost);
      },
      actionHost
    };
  }

  // src/controllers/stories/current-item.js
  var CURRENT_ITEM_SOURCE = Object.freeze({
    EXPLICIT_URL: "explicit-url",
    TIMESTAMP: "timestamp",
    PROGRESS: "progress",
    LAYOUT: "layout",
    ROUTE_FALLBACK: "route-fallback",
    UNRESOLVED: "unresolved"
  });
  function normalizeId(value) {
    if (typeof value === "string" && value.length > 0) return value;
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
    return null;
  }
  function findItemIndexById(items, mediaId) {
    const normalizedId = normalizeId(mediaId);
    if (normalizedId === null) return -1;
    return items.findIndex((item) => normalizeId(item?.id) === normalizedId);
  }
  function resolutionAt(items, index, source) {
    if (!Number.isInteger(index) || index < 0 || index >= items.length) {
      return null;
    }
    const item = items[index];
    return {
      item,
      mediaId: item?.id ?? null,
      itemIndex: index,
      source
    };
  }
  function resolveCurrentStoryItem(items, hints = {}) {
    const candidates = Array.isArray(items) ? items : [];
    const explicitIndex = findItemIndexById(candidates, hints.explicitMediaId);
    const explicit = resolutionAt(
      candidates,
      explicitIndex,
      CURRENT_ITEM_SOURCE.EXPLICIT_URL
    );
    if (explicit) return explicit;
    if (candidates.length > 0 && Number.isFinite(hints.visibleTimestamp) && hints.visibleTimestamp !== 0) {
      let bestIndex = 0;
      let minimumDifference = Infinity;
      candidates.forEach((item, index) => {
        const difference = Math.abs(
          (Number(item?.taken_at_timestamp) || 0) - hints.visibleTimestamp
        );
        if (difference < minimumDifference) {
          minimumDifference = difference;
          bestIndex = index;
        }
      });
      const timestamp = resolutionAt(
        candidates,
        bestIndex,
        CURRENT_ITEM_SOURCE.TIMESTAMP
      );
      if (timestamp) return timestamp;
    }
    const progress = resolutionAt(
      candidates,
      hints.progressIndex,
      CURRENT_ITEM_SOURCE.PROGRESS
    );
    if (progress) return progress;
    const layout = resolutionAt(
      candidates,
      hints.layoutIndex,
      CURRENT_ITEM_SOURCE.LAYOUT
    );
    if (layout) return layout;
    const routeMediaId = normalizeId(hints.routeMediaId);
    if (routeMediaId !== null) {
      const routeIndex = findItemIndexById(candidates, routeMediaId);
      return {
        item: routeIndex >= 0 ? candidates[routeIndex] : null,
        mediaId: routeIndex >= 0 ? candidates[routeIndex]?.id ?? routeMediaId : routeMediaId,
        itemIndex: routeIndex >= 0 ? routeIndex : null,
        source: CURRENT_ITEM_SOURCE.ROUTE_FALLBACK
      };
    }
    return {
      item: null,
      mediaId: null,
      itemIndex: null,
      source: CURRENT_ITEM_SOURCE.UNRESOLVED
    };
  }

  // src/controllers/stories/dom-common.js
  function isDomElementVisible(element) {
    if (!element || element.closest?.("[hidden]")) return false;
    for (let current = element; current; current = current.parentElement) {
      const style = current.style;
      if (style?.display === "none" || style?.visibility === "hidden" || style?.opacity === "0") {
        return false;
      }
    }
    return true;
  }
  function getDomElementHeight(element) {
    const styledHeight = Number.parseFloat(element?.style?.height);
    if (Number.isFinite(styledHeight)) return styledHeight;
    return element?.getBoundingClientRect?.().height ?? 0;
  }
  function isUnstyledDiv(element) {
    return element?.tagName === "DIV" && !element.hasAttribute("class") && !element.hasAttribute("style");
  }
  function findStoryProgressItems(root, username, {
    isVisible = isDomElementVisible,
    getHeight = getDomElementHeight
  } = {}) {
    if (!root?.querySelectorAll || typeof username !== "string" || !username) {
      return [];
    }
    const normalizedUsername = username.toLowerCase();
    const anchors = Array.from(
      root.querySelectorAll(`body > div section a[href^="/${username}"]`)
    ).filter((anchor) => {
      const section = anchor.closest("section");
      return section && isVisible(section);
    });
    const findHeader = (starts) => {
      for (const start of starts) {
        for (let parent = start.parentElement; parent; parent = parent.parentElement) {
          if (isUnstyledDiv(parent) && parent.textContent?.trim().toLowerCase() !== normalizedUsername && parent.children.length > 1) {
            return parent;
          }
        }
      }
      return null;
    };
    const usernameSpans = anchors.flatMap(
      (anchor) => Array.from(anchor.querySelectorAll("span")).filter(
        (span) => span.children.length === 0 && span.querySelector("svg") === null && span.textContent?.trim().toLowerCase() === normalizedUsername
      )
    );
    let header = findHeader(usernameSpans);
    if (!header) {
      header = findHeader(
        anchors.filter((anchor) => anchor.querySelector("img") !== null)
      );
    }
    if (!header) return [];
    const progressRoot = Array.from(header.children).find(
      (child) => getHeight(child) < 10
    );
    return progressRoot ? Array.from(progressRoot.children) : [];
  }
  function getStoryProgressMetadata(items) {
    if (!Array.isArray(items) || items.length === 0) return null;
    let current = 0;
    items.forEach((item, index) => {
      if (item.children.length > 0) current = index + 1;
    });
    return current === 0 ? null : { current, total: items.length };
  }
  function getVisibleStoryTimestamp(root, isVisible = isDomElementVisible) {
    const time = Array.from(
      root?.querySelectorAll?.("body > div section time[datetime]") ?? []
    ).find(
      (element) => isVisible(element) && element.closest('a[href^="/stories/highlights/"]') === null && element.closest('[role="button"]') === null
    );
    if (!time) return null;
    const timestamp = Math.floor(
      new Date(time.getAttribute("datetime")).getTime() / 1e3
    );
    return Number.isFinite(timestamp) && timestamp !== 0 ? timestamp : null;
  }

  // src/controllers/stories/highlight-dom-adapter.js
  function getHighlightUsername(root, isVisible) {
    const anchor = Array.from(
      root?.querySelectorAll?.('body > div section a[href^="/"]') ?? []
    ).find((element) => {
      const section = element.closest("section");
      const segments = (element.getAttribute("href") || "").split("/").filter((segment) => segment.length > 0);
      return section && isVisible(section) && segments.length === 1;
    });
    return anchor?.getAttribute("href")?.split("/").filter((segment) => segment.length > 0).at(0) ?? null;
  }
  function getHighlightTrailingProgressCount(root, isVisible) {
    const sectionLayoutCount = root?.querySelectorAll?.(
      "body > div section._ac0a header._ac0k > ._ac3r ._ac3n ._ac3p[style]"
    )?.length;
    if (sectionLayoutCount) return sectionLayoutCount;
    const visibleLayoutCount = Array.from(
      root?.querySelectorAll?.(
        "body > div section > div > div:not([class]) > div > div div.x1ned7t2.x78zum5 div.x1caxmr6"
      ) ?? []
    ).filter((element) => isVisible(element.closest("section"))).length;
    if (visibleLayoutCount) return visibleLayoutCount;
    const matches = /* @__PURE__ */ new Set();
    Array.from(
      root?.querySelectorAll?.(
        "body > div div:not([hidden]) section > div div[style]:not([class]) > div"
      ) ?? []
    ).filter((element) => isVisible(element.closest("section"))).forEach((element) => {
      element.querySelectorAll("div div.x1ned7t2.x78zum5 div.x1caxmr6").forEach((match) => matches.add(match));
    });
    return matches.size;
  }
  function readHighlightDomState(root, {
    pathname,
    href,
    itemCount,
    isVisible = isDomElementVisible,
    getHeight = getDomElementHeight
  }) {
    const username = getHighlightUsername(root, isVisible);
    const highlightRoute = href ?? pathname;
    const highlightId = String(highlightRoute ?? "").replace(/\/$/, "").split("/").at(-1) || null;
    const trailingProgressCount = getHighlightTrailingProgressCount(
      root,
      isVisible
    );
    const progressItems = findStoryProgressItems(root, username, {
      isVisible,
      getHeight
    });
    const progress = getStoryProgressMetadata(progressItems);
    const visibleVideo = root?.querySelector?.(
      "body > div section video.xh8yej3"
    );
    return {
      surface: "highlights",
      username,
      highlightId,
      identity: {
        explicitMediaId: null,
        visibleTimestamp: null,
        progressIndex: Number.isInteger(itemCount) && trailingProgressCount > 0 ? itemCount - trailingProgressCount : null,
        layoutIndex: null,
        routeMediaId: null
      },
      progress,
      thumbnail: {
        available: Boolean(visibleVideo),
        posterUrl: visibleVideo?.getAttribute("poster") || null
      }
    };
  }

  // src/controllers/stories/story-context.js
  var STORY_SURFACE = Object.freeze({
    STORY: "stories",
    HIGHLIGHT: "highlights"
  });
  var STORY_INTENT = Object.freeze({
    DOWNLOAD: "download",
    PREVIEW: "preview",
    THUMBNAIL: "thumbnail"
  });
  function getStoryReel(payload) {
    const reel = payload?.data?.reels_media?.[0];
    return reel && typeof reel === "object" ? reel : null;
  }
  function getStoryItems(payload) {
    const items = getStoryReel(payload)?.items;
    return Array.isArray(items) ? items : [];
  }
  function getStoryOwner(payload) {
    const reel = getStoryReel(payload);
    return reel?.user?.username || reel?.owner?.username || null;
  }
  function getStorySurfaceCacheKey(surface, identity) {
    if (surface === STORY_SURFACE.STORY) return identity?.username || null;
    if (surface === STORY_SURFACE.HIGHLIGHT) {
      return identity?.highlightId || null;
    }
    throw new TypeError(`Unknown Story surface: ${surface}`);
  }
  function getStoryImageCacheKey(current) {
    return current?.mediaId ?? null;
  }
  function getStoryMediaApiPolicyInputs(settings, runtimeState, { intent, item = null }) {
    const forceResourceViaMedia = Boolean(settings?.FORCE_RESOURCE_VIA_MEDIA);
    const rateLimited = Boolean(runtimeState?.tempFetchRateLimit);
    const requestMediaApi = forceResourceViaMedia && !rateLimited;
    const captureImageViaMediaCache = Boolean(
      settings?.CAPTURE_IMAGE_VIA_MEDIA_CACHE
    );
    const useImageCache = captureImageViaMediaCache && (intent === STORY_INTENT.THUMBNAIL || item != null && item?.is_video !== true);
    const preferDashManifest = Boolean(settings?.PREFER_DASH_MANIFEST);
    return {
      forceResourceViaMedia,
      rateLimited,
      requestMediaApi,
      captureImageViaMediaCache,
      useImageCache,
      fallbackToLegacyOnMediaApiFailure: Boolean(
        settings?.FALLBACK_TO_BLOB_FETCH_IF_MEDIA_API_THROTTLED
      ),
      preferDashManifest,
      requestDash: requestMediaApi && preferDashManifest && intent !== STORY_INTENT.THUMBNAIL && item?.is_video === true,
      renamePublishDate: Boolean(settings?.RENAME_PUBLISH_DATE)
    };
  }
  function getStoryThumbnailMetadata(item, domMetadata) {
    const largestDisplay = selectLargestStoryDisplayResource(
      item?.display_resources
    );
    const displayUrl = item?.display_url || largestDisplay?.src || null;
    return {
      mediaId: item?.id ?? null,
      displayUrl,
      posterUrl: domMetadata?.posterUrl || null,
      available: Boolean(domMetadata?.available || displayUrl)
    };
  }
  function createStoryActionContext({
    surface,
    payload,
    domState,
    settings,
    runtimeState,
    intent
  }) {
    const items = getStoryItems(payload);
    const current = resolveCurrentStoryItem(items, domState?.identity);
    const owner = getStoryOwner(payload) || domState?.username || null;
    return {
      surface,
      intent,
      owner,
      current,
      responseCacheKey: getStorySurfaceCacheKey(surface, {
        username: domState?.username || owner,
        highlightId: domState?.highlightId
      }),
      imageCacheKey: getStoryImageCacheKey(current),
      mediaApiPolicy: getStoryMediaApiPolicyInputs(settings, runtimeState, {
        intent,
        item: current.item
      }),
      progress: domState?.progress ?? null,
      thumbnail: getStoryThumbnailMetadata(
        current.item,
        domState?.thumbnail
      )
    };
  }
  function buildStoryBatchDescriptors(payload, {
    surface,
    renamePublishDate = false,
    nowSeconds
  }) {
    return normalizeStorySurfaceMedia(payload, {
      surface,
      renamePublishDate,
      nowSeconds
    });
  }

  // src/controllers/stories/story-dom-adapter.js
  var MEDIA_ID_PATTERN = /^[0-9]{10,}$/;
  function getRouteMediaId(pathname) {
    return String(pathname ?? "").split("/").filter((segment) => segment.length > 0 && MEDIA_ID_PATTERN.test(segment)).at(-1) ?? null;
  }
  function getStoryUsername(root, pathname) {
    const username = root?.querySelector?.(
      "body > div section._ac0a header._ac0k ._ac0l a + div a"
    )?.textContent?.trim();
    if (username) return username;
    return String(pathname ?? "").split("/").filter((segment) => segment.length > 0).at(1) ?? null;
  }
  function getStoryLayoutIndex(root, isVisible) {
    let activeIndex = null;
    Array.from(
      root?.querySelectorAll?.(
        "body > div section div.x1ned7t2.x78zum5 > div"
      ) ?? []
    ).filter((element) => isVisible(element.closest("section"))).forEach((element, index) => {
      if (element.classList.contains("x1lix1fw") && element.children.length > 0) {
        activeIndex = index;
      }
    });
    Array.from(
      root?.querySelectorAll?.("body > div section ._ac0k > ._ac3r > div") ?? []
    ).filter((element) => isVisible(element.closest("section"))).forEach((element, index) => {
      if (Array.from(element.children).some(
        (child) => child.classList.contains("_ac3q")
      )) {
        activeIndex = index;
      }
    });
    return activeIndex;
  }
  function readStoryDomState(root, {
    pathname,
    isVisible = isDomElementVisible,
    getHeight = getDomElementHeight
  }) {
    const username = getStoryUsername(root, pathname);
    const routeMediaId = getRouteMediaId(pathname);
    const progressItems = findStoryProgressItems(root, username, {
      isVisible,
      getHeight
    });
    const progress = getStoryProgressMetadata(progressItems);
    const visibleVideo = Array.from(
      root?.querySelectorAll?.("body > div section video[playsinline]") ?? []
    ).find((element) => isVisible(element));
    return {
      surface: "stories",
      username,
      highlightId: null,
      identity: {
        explicitMediaId: routeMediaId,
        visibleTimestamp: getVisibleStoryTimestamp(root, isVisible),
        progressIndex: progress ? progress.current - 1 : null,
        layoutIndex: getStoryLayoutIndex(root, isVisible),
        routeMediaId
      },
      progress,
      thumbnail: {
        available: Boolean(visibleVideo),
        posterUrl: visibleVideo?.getAttribute("poster") || null
      }
    };
  }

  // src/controllers/maximum-reel-playback-controller.js
  var MaximumReelPlaybackController = class {
    /**
     * @param {MaximumReelPlaybackOptions} options
     */
    constructor(options) {
      if (!options?.environment) {
        throw new TypeError("MaximumReelPlaybackController requires an environment.");
      }
      if (typeof options.isEnabled !== "function") {
        throw new TypeError("MaximumReelPlaybackController requires isEnabled().");
      }
      if (typeof options.requestMetadata !== "function") {
        throw new TypeError(
          "MaximumReelPlaybackController requires requestMetadata()."
        );
      }
      if (typeof options.normalizeCandidates !== "function") {
        throw new TypeError(
          "MaximumReelPlaybackController requires normalizeCandidates()."
        );
      }
      const getLocation = options.getLocation || options.environment.getLocation;
      this.options = options;
      this.environment = options.environment;
      this.state = createMaximumReelPlaybackState(getLocation().href);
      this._scope = null;
      this._engine = null;
      this._mounted = false;
      this._disposed = false;
    }
    /** @return {boolean} */
    get mounted() {
      return this._mounted;
    }
    /** @return {boolean} */
    get disposed() {
      return this._disposed;
    }
    /**
     * @param {*} [_routeContext]
     * @return {void}
     */
    mount(_routeContext) {
      if (this._disposed || this._mounted) return;
      this._scope = new DisposableScope(this.environment, {
        onError: (error) => this.options.logger?.(
          "[Reel Quality] Playback cleanup failed",
          error?.name || "cleanup_failure"
        )
      });
      this._engine = createMaximumReelPlaybackEngine(
        this,
        this._scope,
        this.options
      );
      this._mounted = true;
      this._engine.init();
    }
    /**
     * @param {{settingChanged?: boolean}|*} [change]
     * @return {boolean}
     */
    refresh(change) {
      if (!this._mounted || this._disposed) return false;
      const routeChanged = this._engine.syncRoute();
      if (!this.options.isEnabled()) {
        this._engine.cancel("setting-disabled", true);
        return true;
      }
      if (change?.settingChanged) this._engine.scan();
      return routeChanged;
    }
    /**
     * Idempotently release all active or ready standalone player ownership.
     *
     * @param {string} [reason]
     * @return {Object|null} Opaque delayed-seek handoff for Manual Reload.
     */
    relinquish(reason = "controller-relinquished") {
      return this._engine?.relinquish(reason) || null;
    }
    /**
     * Transfer a Manual Reload native-seek handoff into this fresh controller.
     *
     * @param {Object|null} handoff
     * @return {boolean}
     */
    adoptManualReloadHandoff(handoff) {
      if (!this._mounted || this._disposed) return false;
      return this._engine?.adoptManualReloadHandoff(handoff) || false;
    }
    /**
     * Idempotently cancel requests, waits, overlays, observers, listeners, and
     * schedulers owned by this controller.
     *
     * @return {void}
     */
    dispose() {
      if (this._disposed) return;
      this._disposed = true;
      this._engine?.relinquish("controller-disposed");
      this._engine?.dispose();
      this._scope?.dispose();
      this._engine = null;
      this._scope = null;
      this._mounted = false;
    }
  };
  function createMaximumReelPlaybackState(routeHref) {
    return {
      activeRequest: null,
      activeOperation: null,
      candidateCache: /* @__PURE__ */ new Map(),
      cooldownUntil: 0,
      failedAt: /* @__PURE__ */ new Map(),
      generation: 0,
      hostOwners: /* @__PURE__ */ new WeakMap(),
      intersectionObserver: null,
      mutationObserver: null,
      observedVideos: /* @__PURE__ */ new WeakSet(),
      pendingNativeResume: null,
      rebindHistory: /* @__PURE__ */ new Map(),
      reloadHandoffs: /* @__PURE__ */ new WeakMap(),
      routeHref,
      scanQueued: false,
      videoState: /* @__PURE__ */ new WeakMap()
    };
  }
  function createMaximumReelPlaybackEngine(controller, scope, options) {
    const environment2 = options.environment;
    const window2 = environment2.window;
    const document2 = environment2.getDocument();
    const getLocation = options.getLocation || environment2.getLocation;
    const now = environment2.now;
    const queueMicrotask = (callback) => environment2.queueMicrotask(() => {
      if (!controller.disposed) callback();
    });
    const requestAnimationFrame = (callback) => scope.requestAnimationFrame(callback);
    const cancelAnimationFrame = environment2.cancelAnimationFrame;
    const setTimeout2 = (callback, delay, ...args) => scope.setTimeout(callback, delay, ...args);
    const clearTimeout = environment2.clearTimeout;
    const Node = window2.Node;
    const HTMLVideoElement = window2.HTMLVideoElement;
    const HTMLMediaElement2 = window2.HTMLMediaElement;
    const MutationObserver2 = window2.MutationObserver;
    const IntersectionObserver2 = window2.IntersectionObserver;
    const getComputedStyle = window2.getComputedStyle.bind(window2);
    const logger = options.logger || (() => {
    });
    const isEnabled = options.isEnabled;
    const normalizeCandidates = options.normalizeCandidates;
    const reelQuality = controller.state;
    const REEL_QUALITY_HOLD_TIMEOUT = options.holdTimeout ?? 5e3;
    const REEL_QUALITY_FAILURE_RETRY_DELAY = options.failureRetryDelay ?? 60 * 1e3;
    const REEL_QUALITY_RATE_LIMIT_COOLDOWN = options.rateLimitCooldown ?? 5 * 60 * 1e3;
    const REEL_QUALITY_CACHE_MAX_AGE = options.cacheMaxAge ?? 30 * 60 * 1e3;
    const videoOperations = createVideoOperations(options.videoOperations);
    function getBlobMediaWithQueryID(shortcode, requestOptions = {}) {
      const value = options.requestMetadata(shortcode, {
        timeout: requestOptions.timeout
      });
      const record = value && typeof value === "object" && "promise" in value ? value : { promise: Promise.resolve(value) };
      const abortable = {
        abort: () => record.abort?.(),
        handle: record.handle
      };
      requestOptions.onRequest?.(abortable);
      return Promise.resolve(record.promise);
    }
    function initMaximumReelPlayback() {
      scope.listen(document2, "play", handleMaximumReelPlay, true);
      scope.listen(window2, "popstate", function() {
        queueMicrotask(syncMaximumReelPlaybackRoute);
      });
      scope.listen(document2, "visibilitychange", function() {
        if (document2.visibilityState === "hidden") {
          const operation = reelQuality.activeOperation;
          if (operation?.wantsPlayback) {
            operation.nativeResumeOnce = true;
            reelQuality.pendingNativeResume = operation;
          }
          cancelMaximumReelPlayback("document-hidden", false);
        } else {
          if (!resumeMaximumReelAfterVisibility()) scanForPlayingReels();
        }
      });
      if (typeof IntersectionObserver2 === "function") {
        reelQuality.intersectionObserver = new IntersectionObserver2(
          function(entries) {
            if (isMaximumReelFeedRoute2(getLocation().href)) {
              entries.forEach(function(entry) {
                if (!entry.isIntersecting || entry.intersectionRatio < 0.5) return;
                const previous = reelQuality.videoState.get(entry.target);
                if (previous && (previous.phase === "ready" || previous.candidateBound || reelQuality.activeOperation === previous)) {
                  relinquishMaximumReelPlayback(
                    previous,
                    "managed-player-entered-feed"
                  );
                }
              });
            }
            const operation = reelQuality.activeOperation;
            if (!operation || operation.finished) return;
            const activeEntry = entries.find(
              (entry) => entry.target === operation.video
            );
            if (activeEntry && (!activeEntry.isIntersecting || activeEntry.intersectionRatio < 0.5)) {
              requestAnimationFrame(function() {
                if (reelQuality.activeOperation === operation && (!isActiveReelVideo(operation.video) || getReelShortcodeForVideo(operation.video) !== operation.shortcode)) {
                  cancelMaximumReelPlayback("reel-left-viewport", false);
                }
              });
            }
          },
          { threshold: [0, 0.5, 0.75, 1] }
        );
      }
      reelQuality.mutationObserver = new MutationObserver2(function(mutations) {
        syncMaximumReelPlaybackRoute();
        let removedOperation = null;
        for (const mutation of mutations) {
          mutation.addedNodes.forEach(function(node) {
            observeMaximumReelVideos(node);
          });
          const operation = reelQuality.activeOperation;
          if (!operation || operation.finished) continue;
          mutation.removedNodes.forEach(function(node) {
            if (node === operation.video || node.nodeType === Node.ELEMENT_NODE && node.contains(operation.video)) {
              removedOperation = operation;
            }
          });
        }
        reelQuality.activeOperation?.hold?.sync?.();
        if (removedOperation) {
          queueMicrotask(function() {
            if (reelQuality.activeOperation === removedOperation && !removedOperation.video.isConnected) {
              cancelMaximumReelPlayback("reel-video-removed", false);
            }
          });
        }
      });
      reelQuality.mutationObserver.observe(document2, {
        childList: true,
        subtree: true
      });
      observeMaximumReelVideos(document2);
      requestAnimationFrame(scanForPlayingReels);
      setTimeout2(scanForPlayingReels, 500);
    }
    function syncMaximumReelPlaybackRoute() {
      if (reelQuality.routeHref === getLocation().href) return false;
      reelQuality.routeHref = getLocation().href;
      const operation = reelQuality.activeOperation;
      if (operation && !isMaximumReelPlaybackRouteEligible(
        operation.video,
        operation.shortcode
      )) {
        relinquishMaximumReelPlayback(operation, "playback-route-changed");
      }
      document2.querySelectorAll("video").forEach(function(video) {
        const previous = reelQuality.videoState.get(video);
        if (previous && (previous.phase === "ready" || previous.phase === "fallback" || previous.pendingRestoreTimeCancel || previous.manualReloadRestored) && !isMaximumReelPlaybackRouteEligible(video, previous.shortcode)) {
          relinquishMaximumReelPlayback(previous, "ready-player-route-changed");
        }
        const reloadHandoff = reelQuality.reloadHandoffs.get(video);
        if (reloadHandoff?.status === "pending" && !isMaximumReelPlaybackRouteEligible(video, reloadHandoff.shortcode)) {
          reloadHandoff.cancel("reload-handoff-route-changed");
          reelQuality.reloadHandoffs.delete(video);
        }
      });
      if (getMaximumReelPlaybackRouteShortcode2(getLocation().href)) {
        requestAnimationFrame(scanForPlayingReels);
      }
      return true;
    }
    function observeMaximumReelVideos(root) {
      if (!root || !root.querySelectorAll) return;
      const videos = [];
      if (root.nodeType === Node.ELEMENT_NODE && root.matches("video")) {
        videos.push(root);
      }
      root.querySelectorAll("video").forEach((video) => videos.push(video));
      videos.forEach(function(video) {
        if (reelQuality.observedVideos.has(video)) return;
        reelQuality.observedVideos.add(video);
        reelQuality.intersectionObserver?.observe(video);
        if (!video.paused && !video.ended) {
          queueMaximumReelScan();
        }
      });
    }
    function queueMaximumReelScan() {
      if (reelQuality.scanQueued) return;
      reelQuality.scanQueued = true;
      queueMicrotask(function() {
        reelQuality.scanQueued = false;
        scanForPlayingReels();
      });
    }
    function scanForPlayingReels() {
      const candidates = [];
      document2.querySelectorAll("video").forEach(function(video) {
        observeMaximumReelVideos(video);
        const shortcode = getReelShortcodeForVideo(video);
        if (!video.paused && !video.ended && isActiveReelVideo(video) && shortcode && isMaximumReelPlaybackRouteEligible(video, shortcode)) {
          candidates.push(video);
        }
      });
      candidates.sort(function(a, b) {
        return maximumReelActivityScore(b) - maximumReelActivityScore(a);
      });
      if (candidates[0]) handleMaximumReelPlay({ target: candidates[0] });
    }
    function resumeMaximumReelAfterVisibility() {
      const operation = reelQuality.pendingNativeResume;
      reelQuality.pendingNativeResume = null;
      if (!operation) return false;
      if (operation.video.isConnected && getReelShortcodeForVideo(operation.video) === operation.shortcode && isActiveReelVideo(operation.video)) {
        Promise.resolve(videoOperations.play(operation.video)).then(function() {
          operation.nativeResumeOnce = false;
        }).catch(function(err) {
          operation.nativeResumeOnce = false;
          logger(
            "[Reel Quality] Native playback resume after background was blocked",
            err?.name || "play_rejected"
          );
        });
        return true;
      } else {
        operation.nativeResumeOnce = false;
      }
      return false;
    }
    function handleMaximumReelPlay(event) {
      const video = event?.target;
      if (!isEnabled() || !(video instanceof HTMLVideoElement)) {
        return;
      }
      const previous = reelQuality.videoState.get(video);
      const shortcode = getReelShortcodeForVideo(video);
      if (!shortcode || !isActiveReelVideo(video)) return;
      if (!isMaximumReelPlaybackRouteEligible(video, shortcode)) {
        if (previous && (previous.phase === "ready" || previous.candidateBound || reelQuality.activeOperation === previous)) {
          relinquishMaximumReelPlayback(previous, "managed-player-entered-feed");
        }
        return;
      }
      const currentTime = now();
      if (previous?.nativeResumeOnce && previous.shortcode === shortcode) {
        previous.nativeResumeOnce = false;
        return;
      }
      const reloadHandoff = reelQuality.reloadHandoffs.get(video);
      if (reloadHandoff?.status === "pending" && reloadHandoff.shortcode === shortcode) {
        return;
      }
      if (previous?.phase === "ready" && previous.shortcode === shortcode && maximumReelSourceMatches(video, previous.selectedUrl)) {
        return;
      }
      if (previous?.phase === "resolving" || previous?.phase === "loading") {
        if (previous.shortcode === shortcode && reelQuality.activeOperation === previous) {
          previous.wantsPlayback = true;
          try {
            videoOperations.pause(video);
          } catch (_err) {
          }
          return;
        }
        if (reelQuality.activeOperation === previous) {
          abandonMaximumReelPlayback(previous, "video-reused-for-new-reel");
        }
      }
      if (previous?.phase === "fallback" && previous.shortcode === shortcode && currentTime < previous.retryAt) {
        return;
      }
      if (currentTime < reelQuality.cooldownUntil) {
        logger(
          "[Reel Quality] Native playback; metadata cooldown active",
          Math.ceil((reelQuality.cooldownUntil - currentTime) / 1e3),
          "seconds remaining"
        );
        return;
      }
      const failedAt = reelQuality.failedAt.get(shortcode) || 0;
      if (currentTime - failedAt < REEL_QUALITY_FAILURE_RETRY_DELAY) return;
      if (!registerMaximumReelBinding(shortcode)) {
        reelQuality.failedAt.set(shortcode, currentTime);
        logger(
          "[Reel Quality] Native playback; source rebind limit reached",
          shortcode
        );
        return;
      }
      startMaximumReelPlayback(video, shortcode);
    }
    function startMaximumReelPlayback(video, shortcode) {
      cancelMaximumReelRestoreTime(reelQuality.videoState.get(video));
      const activeOperation = reelQuality.activeOperation;
      if (activeOperation && activeOperation.video !== video) {
        if (activeOperation.shortcode === shortcode) {
          abandonMaximumReelPlayback(
            activeOperation,
            "same-reel-video-replaced",
            { keepRequest: true }
          );
        } else {
          cancelMaximumReelPlayback("active-reel-changed", false);
        }
      }
      const operation = {
        deadline: now() + REEL_QUALITY_HOLD_TIMEOUT,
        candidateBound: false,
        destructive: false,
        finished: false,
        generation: ++reelQuality.generation,
        hold: null,
        manualReloadRestored: false,
        pendingRestoreTimeCancel: null,
        pendingWaitCancel: null,
        phase: "resolving",
        selectedUrl: null,
        shortcode,
        snapshot: snapshotMaximumReelVideo(video),
        startedAt: now(),
        video,
        wantsPlayback: true
      };
      reelQuality.activeOperation = operation;
      reelQuality.videoState.set(video, operation);
      try {
        videoOperations.pause(video);
      } catch (_err) {
      }
      operation.hold = createMaximumReelHold(operation);
      operation.hardTimeout = setTimeout2(function() {
        failMaximumReelPlayback(operation, "hold_timeout", {
          markFailure: true,
          resumeNative: true
        });
      }, maximumReelTimeRemaining(operation));
      logger("[Reel Quality] Resolving progressive sources", shortcode);
      void runMaximumReelPlayback(operation);
    }
    async function runMaximumReelPlayback(operation) {
      try {
        assertMaximumReelOperation(operation);
        let resolution = await resolveMaximumReelCandidates(
          operation,
          false,
          maximumReelTimeRemaining(operation)
        );
        assertMaximumReelOperation(operation);
        let selected = await tryMaximumReelCandidates(
          operation,
          resolution.candidates
        );
        if (!selected && resolution.fromCache && maximumReelTimeRemaining(operation) > 700) {
          reelQuality.candidateCache.delete(operation.shortcode);
          resolution = await resolveMaximumReelCandidates(
            operation,
            true,
            maximumReelTimeRemaining(operation)
          );
          assertMaximumReelOperation(operation);
          selected = await tryMaximumReelCandidates(
            operation,
            resolution.candidates
          );
        }
        if (!selected) {
          throw createMaximumReelError(
            "candidate_failure",
            "No progressive candidate decoded before the hold deadline."
          );
        }
        finishMaximumReelPlayback(operation, selected);
      } catch (err) {
        if (operation.finished) return;
        const reason = err?.code || "metadata_failure";
        if (reason === "source_rebound") {
          resumeMaximumReelCurrentSource(operation, reason);
          return;
        }
        if (reason === "video_reused") {
          abandonMaximumReelPlayback(operation, reason);
          return;
        }
        if (reason === "ineligible_route") {
          relinquishMaximumReelPlayback(operation, reason);
          return;
        }
        if (err?.rateLimited) {
          reelQuality.cooldownUntil = now() + REEL_QUALITY_RATE_LIMIT_COOLDOWN;
        }
        failMaximumReelPlayback(operation, reason, {
          markFailure: reason !== "operation_cancelled" && reason !== "inactive_reel",
          resumeNative: reason !== "inactive_reel"
        });
      }
    }
    async function resolveMaximumReelCandidates(operation, force, timeout) {
      const shortcode = operation.shortcode;
      const currentTime = now();
      const cached = reelQuality.candidateCache.get(shortcode);
      if (!force && cached && currentTime - cached.createdAt < REEL_QUALITY_CACHE_MAX_AGE) {
        logger(
          "[Reel Quality] Using cached progressive metadata",
          shortcode,
          cached.candidates.length,
          "candidates"
        );
        return { candidates: cached.candidates, fromCache: true };
      }
      if (currentTime < reelQuality.cooldownUntil) {
        throw createMaximumReelError(
          "rate_limited",
          "Instagram metadata requests are cooling down.",
          true
        );
      }
      let requestRecord = reelQuality.activeRequest;
      if (requestRecord && (force || requestRecord.shortcode !== shortcode)) {
        abortMaximumReelMetadataRequest();
        requestRecord = null;
      }
      if (!requestRecord) {
        requestRecord = { handle: null, promise: null, shortcode };
        const request = getBlobMediaWithQueryID(shortcode, {
          onRequest: function(handle) {
            requestRecord.handle = handle;
          },
          silent: true,
          timeout: Math.max(1, Math.floor(timeout))
        }).then(function(data) {
          const consumer = reelQuality.activeOperation;
          if (!consumer || consumer.finished || consumer.shortcode !== shortcode) {
            throw createMaximumReelError(
              "operation_cancelled",
              "The metadata response no longer has an active Reel consumer."
            );
          }
          const candidates2 = normalizeMaximumReelCandidates2(data);
          if (!candidates2.length) {
            throw createMaximumReelError(
              "empty_candidates",
              "Instagram returned no complete progressive video source."
            );
          }
          reelQuality.candidateCache.set(shortcode, {
            candidates: candidates2,
            createdAt: now()
          });
          logger(
            "[Reel Quality] Progressive metadata resolved",
            shortcode,
            candidates2.map((candidate) => ({
              bandwidth: candidate.bandwidth,
              height: candidate.height,
              width: candidate.width
            }))
          );
          return candidates2;
        }).finally(function() {
          if (reelQuality.activeRequest === requestRecord) {
            reelQuality.activeRequest = null;
          }
        });
        requestRecord.promise = request;
        reelQuality.activeRequest = requestRecord;
      }
      const candidates = await requestRecord.promise;
      return { candidates, fromCache: false };
    }
    function normalizeMaximumReelCandidates2(data) {
      return normalizeCandidates(data);
    }
    async function tryMaximumReelCandidates(operation, candidates) {
      for (let index = 0; index < candidates.length; index++) {
        assertMaximumReelOperation(operation);
        const remaining = maximumReelTimeRemaining(operation);
        if (remaining <= 0) break;
        const remainingCandidates = candidates.length - index - 1;
        const reserve = Math.min(
          remainingCandidates * 600,
          Math.max(0, remaining - 800)
        );
        const candidateDeadline = Math.min(
          operation.deadline,
          now() + Math.max(1, remaining - reserve)
        );
        const candidate = candidates[index];
        try {
          await loadMaximumReelCandidate(
            operation,
            candidate,
            candidateDeadline
          );
          return candidate;
        } catch (err) {
          assertMaximumReelOperation(operation);
          if (err?.code === "operation_cancelled" || err?.code === "inactive_reel" || err?.code === "source_rebound" || err?.code === "video_reused") {
            throw err;
          }
          logger(
            "[Reel Quality] Progressive candidate rejected",
            {
              height: candidate.height,
              reason: err?.code || "media_error",
              width: candidate.width
            }
          );
        }
      }
      return null;
    }
    async function loadMaximumReelCandidate(operation, candidate, candidateDeadline) {
      const video = operation.video;
      operation.phase = "loading";
      operation.destructive = true;
      operation.candidateBound = false;
      operation.selectedUrl = candidate.url;
      const metadataReady = waitForMaximumReelVideo(
        operation,
        ["loadedmetadata"],
        function() {
          return video.readyState >= HTMLMediaElement2.HAVE_METADATA;
        },
        candidateDeadline,
        "metadata_timeout",
        false
      );
      try {
        videoOperations.pause(video);
        video.autoplay = false;
        video.removeAttribute("autoplay");
        if ("srcObject" in video) videoOperations.clearSourceObject(video);
        operation.snapshot.sourceElements.forEach(function(source) {
          if (source.element.parentElement === video) {
            source.element.removeAttribute("src");
          }
        });
        video.setAttribute("preload", "auto");
        video.setAttribute("playsinline", "");
        video.setAttribute("webkit-playsinline", "");
        videoOperations.setSource(video, candidate.url);
        operation.candidateBound = true;
        videoOperations.load(video);
      } catch (err) {
        operation.pendingWaitCancel?.();
        try {
          await metadataReady;
        } catch (_cancelledError) {
        }
        throw createMaximumReelError(
          "source_bind_failure",
          err?.message || "The progressive source could not be attached."
        );
      }
      await metadataReady;
      assertMaximumReelOperation(operation);
      const targetTime = maximumReelSeekTime(
        operation.snapshot.currentTime,
        video.duration
      );
      if (targetTime > 0) {
        try {
          video.currentTime = targetTime;
        } catch (_err) {
        }
      }
      await waitForMaximumReelVideo(
        operation,
        ["loadeddata", "canplay", "seeked"],
        function() {
          return !video.seeking && video.readyState >= HTMLMediaElement2.HAVE_CURRENT_DATA && video.videoWidth > 0 && video.videoHeight > 0;
        },
        candidateDeadline,
        "frame_timeout",
        true
      );
    }
    function waitForMaximumReelVideo(operation, eventNames, predicate, deadline, timeoutCode, checkImmediately) {
      return new Promise(function(resolve, reject) {
        const video = operation.video;
        let settled = false;
        let timer = null;
        function cleanup() {
          eventNames.forEach((name) => video.removeEventListener(name, onReady));
          video.removeEventListener("error", onError);
          if (timer) clearTimeout(timer);
          if (operation.pendingWaitCancel === onCancel) {
            operation.pendingWaitCancel = null;
          }
        }
        function finish(callback, value) {
          if (settled) return;
          settled = true;
          cleanup();
          callback(value);
        }
        function onReady() {
          try {
            assertMaximumReelOperation(operation);
            if (predicate()) finish(resolve);
          } catch (err) {
            finish(reject, err);
          }
        }
        function onError() {
          finish(
            reject,
            createMaximumReelError(
              "media_error",
              video.error?.message || "Safari rejected the progressive source."
            )
          );
        }
        function onCancel() {
          finish(
            reject,
            createMaximumReelError(
              "operation_cancelled",
              "The active Reel changed during source loading."
            )
          );
        }
        eventNames.forEach((name) => video.addEventListener(name, onReady));
        video.addEventListener("error", onError);
        operation.pendingWaitCancel = onCancel;
        const delay = Math.max(0, deadline - now());
        timer = setTimeout2(function() {
          finish(
            reject,
            createMaximumReelError(
              timeoutCode,
              "The progressive source did not become ready in time."
            )
          );
        }, delay);
        if (checkImmediately) onReady();
      });
    }
    function finishMaximumReelPlayback(operation, candidate) {
      assertMaximumReelOperation(operation);
      if (operation.hardTimeout) clearTimeout(operation.hardTimeout);
      operation.finished = true;
      operation.phase = "ready";
      operation.selectedUrl = candidate.url;
      operation.retryAt = 0;
      restoreMaximumReelSourceElements(operation.snapshot);
      restoreMaximumReelPlaybackProperties(operation.video, operation.snapshot);
      cleanupMaximumReelHold(operation);
      reelQuality.failedAt.delete(operation.shortcode);
      reelQuality.videoState.set(operation.video, operation);
      if (reelQuality.activeOperation === operation) {
        reelQuality.activeOperation = null;
      }
      operation.video.dataset.instaLoaderReelQuality = `${operation.video.videoWidth}x${operation.video.videoHeight}`;
      logger(
        "[Reel Quality] Maximum progressive source ready",
        operation.shortcode,
        {
          decodedHeight: operation.video.videoHeight,
          decodedWidth: operation.video.videoWidth,
          elapsedMs: Math.round(now() - operation.startedAt),
          reportedHeight: candidate.height,
          reportedWidth: candidate.width
        }
      );
      if (operation.wantsPlayback && isEnabled() && operation.video.isConnected && getReelShortcodeForVideo(operation.video) === operation.shortcode && isActiveReelVideo(operation.video)) {
        Promise.resolve(videoOperations.play(operation.video)).catch(function(err) {
          logger(
            "[Reel Quality] Maximum source loaded but autoplay was blocked",
            err?.name || "play_rejected"
          );
        });
      }
    }
    function failMaximumReelPlayback(operation, reason, options2 = {}) {
      if (!operation || operation.finished) return;
      if (operation.hardTimeout) clearTimeout(operation.hardTimeout);
      operation.finished = true;
      operation.pendingWaitCancel?.();
      operation.pendingWaitCancel = null;
      abortMaximumReelMetadataRequest(operation);
      if (options2.markFailure) {
        reelQuality.failedAt.set(operation.shortcode, now());
        reelQuality.candidateCache.delete(operation.shortcode);
      }
      const canResume = options2.resumeNative && operation.wantsPlayback && operation.video.isConnected && getReelShortcodeForVideo(operation.video) === operation.shortcode && isActiveReelVideo(operation.video);
      let restored = true;
      if (operation.destructive) {
        restored = restoreMaximumReelNativeSource(operation);
      } else {
        restoreMaximumReelPlaybackProperties(operation.video, operation.snapshot);
      }
      operation.phase = options2.markFailure ? "fallback" : "native";
      operation.retryAt = options2.markFailure ? now() + REEL_QUALITY_FAILURE_RETRY_DELAY : 0;
      reelQuality.videoState.set(operation.video, operation);
      cleanupMaximumReelHold(operation);
      if (reelQuality.activeOperation === operation) {
        reelQuality.activeOperation = null;
      }
      logger("[Reel Quality] Native playback fallback", operation.shortcode, {
        elapsedMs: Math.round(now() - operation.startedAt),
        reason,
        restored
      });
      if (canResume && restored) {
        Promise.resolve(videoOperations.play(operation.video)).catch(function(err) {
          logger(
            "[Reel Quality] Native playback resume was blocked",
            err?.name || "play_rejected"
          );
        });
      }
    }
    function cancelMaximumReelPlayback(reason, resumeNative = true) {
      const operation = reelQuality.activeOperation;
      if (!operation) return;
      if (reason === "reel-video-removed") {
        abandonMaximumReelPlayback(operation, reason);
        return;
      }
      failMaximumReelPlayback(operation, reason, {
        markFailure: false,
        resumeNative
      });
    }
    function abandonMaximumReelPlayback(operation, reason, options2 = {}) {
      if (!operation || operation.finished) return;
      if (operation.hardTimeout) clearTimeout(operation.hardTimeout);
      operation.finished = true;
      operation.phase = "native";
      operation.pendingWaitCancel?.();
      operation.pendingWaitCancel = null;
      if (!options2.keepRequest) abortMaximumReelMetadataRequest(operation);
      cleanupMaximumReelHold(operation);
      if (reelQuality.activeOperation === operation) {
        reelQuality.activeOperation = null;
      }
      logger("[Reel Quality] Abandoned stale player state", reason);
    }
    function relinquishMaximumReelPlayback(operation, reason) {
      if (!operation) return;
      const nativeFeed = isMaximumReelFeedRoute2(getLocation().href);
      if (reason === "manual-reload" && !nativeFeed && isMaximumReelPlaybackRouteEligible(
        operation.video,
        operation.shortcode
      )) {
        return restoreMaximumReelForManualReload(operation, reason);
      }
      cancelMaximumReelRestoreTime(operation);
      if (operation.relinquished) return;
      operation.relinquished = true;
      operation.finished = true;
      operation.phase = "native";
      if (operation.hardTimeout) clearTimeout(operation.hardTimeout);
      operation.pendingWaitCancel?.();
      operation.pendingWaitCancel = null;
      abortMaximumReelMetadataRequest(operation);
      cleanupMaximumReelHold(operation);
      const video = operation.video;
      const ownsProgressiveSource = operation.candidateBound && operation.selectedUrl && maximumReelSourceMatches(video, operation.selectedUrl);
      let releasedSource = false;
      if (!nativeFeed && ownsProgressiveSource) {
        try {
          videoOperations.pause(video);
          videoOperations.clearSource(video);
          if ("srcObject" in video) videoOperations.clearSourceObject(video);
          operation.snapshot.sourceElements.forEach(function(source) {
            if (source.element.parentElement === video) {
              source.element.removeAttribute("src");
            }
          });
          videoOperations.load(video);
          releasedSource = true;
        } catch (err) {
          logger(
            "[Reel Quality] Managed source release deferred to Instagram",
            err?.name || "source_release_failure"
          );
        }
      } else if (!nativeFeed && operation.destructive) {
        restoreMaximumReelPlaybackProperties(video, operation.snapshot);
      }
      delete video.dataset.instaLoaderReelQuality;
      reelQuality.videoState.delete(video);
      if (reelQuality.activeOperation === operation) {
        reelQuality.activeOperation = null;
      }
      logger("[Reel Quality] Relinquished standalone player", reason, {
        releasedSource
      });
    }
    function restoreMaximumReelForManualReload(operation, reason) {
      if (!operation) return null;
      if (operation.manualReloadRestored) {
        const existingHandoff = operation.manualReloadHandoff;
        if (existingHandoff?.status === "pending") {
          existingHandoff.transferring = true;
          return existingHandoff;
        }
        return null;
      }
      const phaseBeforeReload = operation.phase;
      const shouldResume = operation.wantsPlayback && (phaseBeforeReload === "resolving" || phaseBeforeReload === "loading" || !operation.video.paused);
      operation.manualReloadRestored = true;
      operation.finished = true;
      operation.phase = "native";
      if (operation.hardTimeout) clearTimeout(operation.hardTimeout);
      operation.pendingWaitCancel?.();
      operation.pendingWaitCancel = null;
      abortMaximumReelMetadataRequest(operation);
      cancelMaximumReelRestoreTime(operation);
      cleanupMaximumReelHold(operation);
      const ownsProgressiveSource = operation.candidateBound && operation.selectedUrl && maximumReelSourceMatches(operation.video, operation.selectedUrl);
      let restored = true;
      if (ownsProgressiveSource) {
        restored = restoreMaximumReelNativeSource(operation, {
          transferRestoreTime: true
        });
      } else {
        restoreMaximumReelPlaybackProperties(operation.video, operation.snapshot);
      }
      const canResume = shouldResume && restored && operation.video.isConnected && isMaximumReelPlaybackRouteEligible(
        operation.video,
        operation.shortcode
      );
      operation.nativeResumeOnce = canResume;
      reelQuality.videoState.set(operation.video, operation);
      if (reelQuality.activeOperation === operation) {
        reelQuality.activeOperation = null;
      }
      delete operation.video.dataset.instaLoaderReelQuality;
      logger("[Reel Quality] Restored native player for Reload", reason, {
        restored
      });
      if (canResume) {
        Promise.resolve(videoOperations.play(operation.video)).then(function() {
          operation.nativeResumeOnce = false;
        }).catch(function(err) {
          operation.nativeResumeOnce = false;
          logger(
            "[Reel Quality] Native playback resume after Reload was blocked",
            err?.name || "play_rejected"
          );
        });
      }
      return operation.manualReloadHandoff || null;
    }
    function resumeMaximumReelCurrentSource(operation, reason) {
      if (!operation || operation.finished) return;
      if (operation.hardTimeout) clearTimeout(operation.hardTimeout);
      operation.finished = true;
      operation.phase = "native";
      operation.nativeResumeOnce = true;
      operation.pendingWaitCancel?.();
      operation.pendingWaitCancel = null;
      abortMaximumReelMetadataRequest(operation);
      restoreMaximumReelPlaybackProperties(operation.video, operation.snapshot);
      cleanupMaximumReelHold(operation);
      reelQuality.videoState.set(operation.video, operation);
      if (reelQuality.activeOperation === operation) {
        reelQuality.activeOperation = null;
      }
      const canResume = operation.wantsPlayback && operation.video.isConnected && getReelShortcodeForVideo(operation.video) === operation.shortcode && isActiveReelVideo(operation.video);
      logger("[Reel Quality] Accepted Instagram source replacement", reason);
      if (canResume) {
        Promise.resolve(videoOperations.play(operation.video)).then(function() {
          operation.nativeResumeOnce = false;
        }).catch(function(err) {
          operation.nativeResumeOnce = false;
          logger(
            "[Reel Quality] Replacement source resume was blocked",
            err?.name || "play_rejected"
          );
        });
      } else {
        operation.nativeResumeOnce = false;
      }
    }
    function abortMaximumReelMetadataRequest(operation) {
      const request = reelQuality.activeRequest;
      if (!request || operation && request.shortcode !== operation.shortcode) {
        return;
      }
      reelQuality.activeRequest = null;
      try {
        request.handle?.abort?.();
      } catch (_err) {
      }
    }
    function cancelMaximumReelRestoreTime(operation) {
      if (!operation?.pendingRestoreTimeCancel) return;
      const cancel = operation.pendingRestoreTimeCancel;
      operation.pendingRestoreTimeCancel = null;
      cancel();
    }
    function restoreMaximumReelNativeSource(operation, options2 = {}) {
      const video = operation.video;
      const snapshot = operation.snapshot;
      let hasSource = false;
      cancelMaximumReelRestoreTime(operation);
      try {
        videoOperations.pause(video);
        videoOperations.clearSource(video);
        restoreMaximumReelSourceElements(snapshot);
        if (snapshot.srcObject != null && "srcObject" in video) {
          video.srcObject = snapshot.srcObject;
          hasSource = true;
        } else if (snapshot.srcAttribute != null) {
          videoOperations.setSource(video, snapshot.srcAttribute);
          hasSource = true;
        } else if (snapshot.sourceElements.some(
          (source) => source.parent === video && source.element.parentElement === video && source.src != null
        )) {
          hasSource = true;
        } else if (snapshot.currentSrc && snapshot.currentSrc !== operation.selectedUrl) {
          videoOperations.setSource(video, snapshot.currentSrc);
          hasSource = true;
        }
        restoreMaximumReelPlaybackProperties(video, snapshot);
        if (hasSource) {
          videoOperations.load(video);
          const restoreTime = function() {
            cancelMaximumReelRestoreTime(operation);
            restoreMaximumReelTime(operation);
          };
          if (video.readyState >= HTMLMediaElement2.HAVE_METADATA) {
            restoreTime();
          } else if (options2.transferRestoreTime) {
            operation.manualReloadHandoff = createMaximumReelManualReloadHandoff(operation);
          } else {
            operation.pendingRestoreTimeCancel = scope.listen(
              video,
              "loadedmetadata",
              restoreTime,
              { once: true }
            );
          }
        }
      } catch (err) {
        logger(
          "[Reel Quality] Native source restoration deferred to Instagram",
          err?.name || "restore_failure"
        );
        return false;
      }
      return hasSource;
    }
    function createMaximumReelManualReloadHandoff(operation) {
      const handoffScope = new DisposableScope(environment2, {
        onError: (error) => logger(
          "[Reel Quality] Reload seek cleanup failed",
          error?.name || "cleanup_failure"
        )
      });
      const handoff = {
        cancel: null,
        operation,
        shortcode: operation.shortcode,
        status: "pending",
        transferring: true,
        video: operation.video
      };
      const finish = function() {
        if (handoff.status !== "pending") return;
        handoff.status = "completed";
        handoff.transferring = false;
        handoffScope.dispose();
        reelQuality.reloadHandoffs.delete(handoff.video);
        if (operation.manualReloadHandoff === handoff) {
          operation.manualReloadHandoff = null;
        }
        restoreMaximumReelTime(operation);
      };
      handoff.cancel = function() {
        if (handoff.status !== "pending") return;
        handoff.status = "cancelled";
        handoff.transferring = false;
        handoffScope.dispose();
        reelQuality.reloadHandoffs.delete(handoff.video);
        if (operation.manualReloadHandoff === handoff) {
          operation.manualReloadHandoff = null;
        }
      };
      handoffScope.listen(operation.video, "loadedmetadata", finish, {
        once: true
      });
      reelQuality.reloadHandoffs.set(operation.video, handoff);
      return handoff;
    }
    function restoreMaximumReelTime(operation) {
      const video = operation.video;
      if (!isMaximumReelPlaybackRouteEligible(video, operation.shortcode)) return;
      try {
        video.currentTime = maximumReelSeekTime(
          operation.snapshot.currentTime,
          video.duration
        );
      } catch (_err) {
      }
    }
    function snapshotMaximumReelVideo(video) {
      let srcObject = null;
      try {
        srcObject = "srcObject" in video ? video.srcObject : null;
      } catch (_err) {
      }
      const sourceElements = Array.from(video.children).filter((element) => element.tagName === "SOURCE").map(function(element) {
        return {
          attributes: Array.from(element.attributes).map((attribute) => ({
            name: attribute.name,
            value: attribute.value
          })),
          element,
          parent: video,
          src: element.getAttribute("src")
        };
      });
      return {
        autoplayAttribute: video.getAttribute("autoplay"),
        autoplay: video.autoplay,
        controls: video.controls,
        currentSrc: video.currentSrc,
        currentTime: Number.isFinite(video.currentTime) ? video.currentTime : 0,
        defaultMuted: video.defaultMuted,
        defaultPlaybackRate: video.defaultPlaybackRate,
        loop: video.loop,
        muted: video.muted,
        playbackRate: video.playbackRate,
        playsInlineAttribute: video.getAttribute("playsinline"),
        playsInline: video.playsInline,
        preloadAttribute: video.getAttribute("preload"),
        sourceElements,
        srcAttribute: video.getAttribute("src"),
        srcObject,
        volume: video.volume,
        webkitPlaysInlineAttribute: video.getAttribute("webkit-playsinline")
      };
    }
    function restoreMaximumReelPlaybackProperties(video, snapshot) {
      try {
        restoreMaximumReelAttribute(
          video,
          "autoplay",
          snapshot.autoplayAttribute
        );
        restoreMaximumReelAttribute(
          video,
          "playsinline",
          snapshot.playsInlineAttribute
        );
        restoreMaximumReelAttribute(
          video,
          "webkit-playsinline",
          snapshot.webkitPlaysInlineAttribute
        );
        restoreMaximumReelAttribute(
          video,
          "preload",
          snapshot.preloadAttribute
        );
        video.autoplay = snapshot.autoplay;
        video.controls = snapshot.controls;
        video.defaultMuted = snapshot.defaultMuted;
        video.defaultPlaybackRate = snapshot.defaultPlaybackRate;
        video.loop = snapshot.loop;
        video.muted = snapshot.muted;
        video.playbackRate = snapshot.playbackRate;
        video.playsInline = snapshot.playsInline;
        video.volume = snapshot.volume;
      } catch (err) {
        logger(
          "[Reel Quality] Some playback properties could not be restored",
          err?.name || "property_restore_failure"
        );
      }
    }
    function restoreMaximumReelSourceElements(snapshot) {
      snapshot.sourceElements.forEach(function(source) {
        if (source.element.parentElement !== source.parent) return;
        Array.from(source.element.attributes).forEach((attribute) => {
          source.element.removeAttribute(attribute.name);
        });
        source.attributes.forEach((attribute) => {
          source.element.setAttribute(attribute.name, attribute.value);
        });
      });
    }
    function createMaximumReelHold(operation) {
      const video = operation.video;
      const host = document2.documentElement;
      if (!host) return null;
      const previousOwner = reelQuality.hostOwners.get(host);
      if (previousOwner && previousOwner !== operation) {
        cleanupMaximumReelHold(previousOwner);
      }
      const overlay = document2.createElement("div");
      overlay.className = "insta-loader-reel-quality-hold";
      overlay.setAttribute("aria-hidden", "true");
      const poster = findMaximumReelPoster(video);
      if (poster) {
        const image = document2.createElement("img");
        image.alt = "";
        image.src = poster;
        overlay.appendChild(image);
      }
      const spinner = document2.createElement("div");
      spinner.className = "insta-loader-reel-quality-spinner";
      overlay.appendChild(spinner);
      host.appendChild(overlay);
      let syncFrame = null;
      const render = function() {
        syncFrame = null;
        if (!video.isConnected) return;
        const rect = video.getBoundingClientRect();
        overlay.style.left = `${rect.left}px`;
        overlay.style.top = `${rect.top}px`;
        overlay.style.width = `${rect.width}px`;
        overlay.style.height = `${rect.height}px`;
      };
      const sync = function() {
        if (syncFrame != null) return;
        syncFrame = requestAnimationFrame(render);
      };
      render();
      window2.addEventListener("scroll", sync, true);
      window2.addEventListener("resize", sync);
      reelQuality.hostOwners.set(host, operation);
      return {
        cancelSync: function() {
          if (syncFrame != null) cancelAnimationFrame(syncFrame);
          syncFrame = null;
        },
        host,
        overlay,
        sync
      };
    }
    function cleanupMaximumReelHold(operation) {
      const hold = operation?.hold;
      if (!hold) return;
      const ownsHost = reelQuality.hostOwners.get(hold.host) === operation;
      if (ownsHost) {
        hold.overlay.remove();
        hold.cancelSync();
        window2.removeEventListener("scroll", hold.sync, true);
        window2.removeEventListener("resize", hold.sync);
        reelQuality.hostOwners.delete(hold.host);
      }
      operation.hold = null;
    }
    function findMaximumReelPoster(video) {
      if (video.poster) return video.poster;
      const videoRect = video.getBoundingClientRect();
      let scope2 = video.parentElement;
      let best = null;
      for (let depth = 0; scope2 && depth < 5; depth++, scope2 = scope2.parentElement) {
        scope2.querySelectorAll("img").forEach(function(image) {
          const rect = image.getBoundingClientRect();
          const overlapWidth = Math.max(
            0,
            Math.min(rect.right, videoRect.right) - Math.max(rect.left, videoRect.left)
          );
          const overlapHeight = Math.max(
            0,
            Math.min(rect.bottom, videoRect.bottom) - Math.max(rect.top, videoRect.top)
          );
          const score = overlapWidth * overlapHeight;
          const src = image.currentSrc || image.src;
          if (src && score > (best?.score || 0)) best = { score, src };
        });
        if (best?.score > videoRect.width * videoRect.height * 0.5) break;
      }
      return best?.src || null;
    }
    function getReelShortcodeForVideo(video) {
      const enclosingLink = video.closest(
        'a[href*="/reel/"], a[href*="/reels/"]'
      );
      const enclosingShortcode = parseMaximumReelShortcode2(
        enclosingLink?.href,
        false
      );
      if (enclosingShortcode) return enclosingShortcode;
      const boundary = video.closest(
        'article, div[role="dialog"], [data-pagelet]'
      );
      if (boundary) {
        const shortcodes = [
          ...new Set(
            Array.from(
              boundary.querySelectorAll(
                'a[href*="/reel/"], a[href*="/reels/"]'
              )
            ).map((anchor) => parseMaximumReelShortcode2(anchor.href, false)).filter(Boolean)
          )
        ];
        if (shortcodes.length === 1) return shortcodes[0];
        const routeShortcode = parseMaximumReelShortcode2(getLocation().href, true);
        if (routeShortcode && shortcodes.includes(routeShortcode)) {
          return routeShortcode;
        }
      }
      return parseMaximumReelShortcode2(getLocation().href, true);
    }
    function parseMaximumReelShortcode2(value, directOnly) {
      return parseMaximumReelShortcode(value, directOnly, getLocation().origin);
    }
    function getMaximumReelPlaybackRouteShortcode2(value) {
      return getMaximumReelPlaybackRouteShortcode(value, getLocation().origin);
    }
    function isMaximumReelPlaybackRouteEligible(video, shortcode) {
      const routeShortcode = getMaximumReelPlaybackRouteShortcode2(getLocation().href);
      return Boolean(routeShortcode) && routeShortcode === shortcode && getReelShortcodeForVideo(video) === shortcode;
    }
    function isMaximumReelFeedRoute2(value) {
      return isMaximumReelFeedRoute(value, getLocation().origin);
    }
    function isActiveReelVideo(video) {
      if (!video?.isConnected || document2.visibilityState === "hidden") return false;
      const rect = video.getBoundingClientRect();
      if (rect.width < 32 || rect.height < 32) return false;
      let clipLeft = 0;
      let clipTop = 0;
      let clipRight = window2.innerWidth;
      let clipBottom = window2.innerHeight;
      let element = video;
      while (element && element.nodeType === Node.ELEMENT_NODE) {
        const style = getComputedStyle(element);
        if (element.hidden || element.hasAttribute("inert") || element.getAttribute("aria-hidden") === "true" || style.display === "none" || style.visibility === "hidden" || style.visibility === "collapse" || style.contentVisibility === "hidden" || Number(style.opacity) <= 0.01) {
          return false;
        }
        if (element !== video) {
          const clipsX = /^(auto|scroll|hidden|clip)$/.test(style.overflowX);
          const clipsY = /^(auto|scroll|hidden|clip)$/.test(style.overflowY);
          if (clipsX || clipsY) {
            const ancestorRect = element.getBoundingClientRect();
            if (clipsX) {
              clipLeft = Math.max(clipLeft, ancestorRect.left);
              clipRight = Math.min(clipRight, ancestorRect.right);
            }
            if (clipsY) {
              clipTop = Math.max(clipTop, ancestorRect.top);
              clipBottom = Math.min(clipBottom, ancestorRect.bottom);
            }
          }
        }
        element = element.parentElement;
      }
      const visibleWidth = Math.max(
        0,
        Math.min(rect.right, clipRight) - Math.max(rect.left, clipLeft)
      );
      const visibleHeight = Math.max(
        0,
        Math.min(rect.bottom, clipBottom) - Math.max(rect.top, clipTop)
      );
      return visibleWidth * visibleHeight / (rect.width * rect.height) >= 0.55;
    }
    function assertMaximumReelOperation(operation) {
      if (operation.finished || reelQuality.generation !== operation.generation || reelQuality.activeOperation !== operation || reelQuality.videoState.get(operation.video) !== operation || !isEnabled()) {
        throw createMaximumReelError(
          "operation_cancelled",
          "The Reel quality operation is no longer current."
        );
      }
      if (!isMaximumReelPlaybackRouteEligible(
        operation.video,
        operation.shortcode
      )) {
        throw createMaximumReelError(
          "ineligible_route",
          "Maximum-quality playback is limited to standalone Reel pages."
        );
      }
      if (operation.destructive && operation.candidateBound && operation.selectedUrl && !maximumReelSourceMatches(operation.video, operation.selectedUrl)) {
        throw createMaximumReelError(
          "source_rebound",
          "Instagram replaced the progressive source during the handoff."
        );
      }
      const currentShortcode = getReelShortcodeForVideo(operation.video);
      if (operation.video.isConnected && currentShortcode && currentShortcode !== operation.shortcode) {
        throw createMaximumReelError(
          "video_reused",
          "Instagram reused the player for a different Reel."
        );
      }
      if (!operation.video.isConnected || !isActiveReelVideo(operation.video) || currentShortcode !== operation.shortcode) {
        throw createMaximumReelError(
          "inactive_reel",
          "The original Reel is no longer active."
        );
      }
      if (maximumReelTimeRemaining(operation) <= 0) {
        throw createMaximumReelError(
          "hold_timeout",
          "The Reel quality hold reached its total deadline."
        );
      }
    }
    function maximumReelTimeRemaining(operation) {
      return Math.max(0, operation.deadline - now());
    }
    function maximumReelActivityScore(video) {
      const rect = video.getBoundingClientRect();
      const visibleWidth = Math.max(
        0,
        Math.min(rect.right, window2.innerWidth) - Math.max(rect.left, 0)
      );
      const visibleHeight = Math.max(
        0,
        Math.min(rect.bottom, window2.innerHeight) - Math.max(rect.top, 0)
      );
      const centerDistance = Math.hypot(
        rect.left + rect.width / 2 - window2.innerWidth / 2,
        rect.top + rect.height / 2 - window2.innerHeight / 2
      );
      return visibleWidth * visibleHeight - centerDistance;
    }
    function maximumReelSourceMatches(video, url) {
      if (!url) return false;
      try {
        if ("srcObject" in video && video.srcObject != null) return false;
      } catch (_err) {
        return false;
      }
      const declaredSource = video.getAttribute("src");
      if (declaredSource != null && declaredSource !== url) return false;
      if (video.currentSrc && video.currentSrc !== url && video.readyState > HTMLMediaElement2.HAVE_NOTHING) {
        return false;
      }
      return declaredSource === url || video.currentSrc === url;
    }
    function maximumReelSeekTime(currentTime, duration) {
      if (!Number.isFinite(currentTime) || currentTime <= 0) return 0;
      if (!Number.isFinite(duration) || duration <= 0) return currentTime;
      return Math.min(currentTime, Math.max(0, duration - 0.05));
    }
    function restoreMaximumReelAttribute(element, name, value) {
      if (value == null) element.removeAttribute(name);
      else element.setAttribute(name, value);
    }
    function createMaximumReelError(code, message, rateLimited = false) {
      const error = new Error(message);
      error.code = code;
      error.rateLimited = rateLimited;
      return error;
    }
    function registerMaximumReelBinding(shortcode) {
      const currentTime = now();
      const history = (reelQuality.rebindHistory.get(shortcode) || []).filter((timestamp) => currentTime - timestamp < 15e3);
      if (history.length >= 3) return false;
      history.push(currentTime);
      reelQuality.rebindHistory.set(shortcode, history);
      return true;
    }
    function relinquishController(reason) {
      const operations = /* @__PURE__ */ new Set();
      const reloadHandoffs = /* @__PURE__ */ new Set();
      if (reelQuality.activeOperation) {
        operations.add(reelQuality.activeOperation);
      }
      document2.querySelectorAll("video").forEach((video) => {
        const operation = reelQuality.videoState.get(video);
        if (operation) operations.add(operation);
      });
      operations.forEach((operation) => {
        const handoff = relinquishMaximumReelPlayback(operation, reason);
        if (handoff?.status === "pending") reloadHandoffs.add(handoff);
      });
      document2.querySelectorAll("video").forEach((video) => {
        const handoff = reelQuality.reloadHandoffs.get(video);
        if (handoff?.status !== "pending") {
          reelQuality.reloadHandoffs.delete(video);
          return;
        }
        if (reason === "manual-reload") {
          handoff.transferring = true;
          reloadHandoffs.add(handoff);
        } else if (!(reason === "controller-disposed" && handoff.transferring)) {
          handoff.cancel(reason);
          reelQuality.reloadHandoffs.delete(video);
        }
      });
      abortMaximumReelMetadataRequest();
      if (reloadHandoffs.size === 0) return null;
      const handoffs = [...reloadHandoffs];
      return {
        cancel(cancelReason = "reload-handoff-cancelled") {
          handoffs.forEach((handoff) => handoff.cancel(cancelReason));
        },
        handoffs,
        type: "maximum-reel-manual-reload"
      };
    }
    function adoptManualReloadHandoff(token) {
      if (token?.type !== "maximum-reel-manual-reload" || !Array.isArray(token.handoffs)) {
        return false;
      }
      let adopted = false;
      token.handoffs.forEach((handoff) => {
        if (handoff?.status !== "pending") return;
        if (!handoff.video?.isConnected || !isMaximumReelPlaybackRouteEligible(
          handoff.video,
          handoff.shortcode
        )) {
          handoff.cancel("reload-handoff-ineligible");
          return;
        }
        handoff.transferring = false;
        reelQuality.reloadHandoffs.set(handoff.video, handoff);
        adopted = true;
      });
      return adopted;
    }
    function disposeEngine() {
      reelQuality.mutationObserver?.disconnect();
      reelQuality.intersectionObserver?.disconnect();
      reelQuality.mutationObserver = null;
      reelQuality.intersectionObserver = null;
      abortMaximumReelMetadataRequest();
    }
    return {
      adoptManualReloadHandoff,
      cancel: cancelMaximumReelPlayback,
      dispose: disposeEngine,
      init: initMaximumReelPlayback,
      relinquish: relinquishController,
      scan: scanForPlayingReels,
      syncRoute: syncMaximumReelPlaybackRoute
    };
  }
  function createVideoOperations(overrides = {}) {
    return {
      pause: overrides.pause || ((video) => video.pause()),
      play: overrides.play || ((video) => video.play()),
      load: overrides.load || ((video) => video.load()),
      setSource: overrides.setSource || ((video, source) => video.setAttribute("src", source)),
      clearSource: overrides.clearSource || ((video) => video.removeAttribute("src")),
      clearSourceObject: overrides.clearSourceObject || ((video) => {
        video.srcObject = null;
      })
    };
  }

  // src/controllers/application-dom-lifecycle-service.js
  var ApplicationDomLifecycleService = class {
    /**
     * @param {Object} options
     * @param {import("../core/environment.js").UserscriptEnvironment} options.environment
     * @param {() => (Element|null)} options.findMountRoot
     * @param {(node: Node, root: Element) => void} [options.onAddedNode]
     * @param {(root: Element, change: *) => void} [options.onMountScan]
     * @param {() => (*|null)} [options.registerPerformanceObserver]
     * @param {(error: *, details: Object) => void} [options.onError]
     */
    constructor({
      environment: environment2,
      findMountRoot,
      onAddedNode,
      onMountScan,
      registerPerformanceObserver,
      onError
    }) {
      if (typeof environment2?.getDocument !== "function") {
        throw new TypeError(
          "ApplicationDomLifecycleService requires an environment."
        );
      }
      if (typeof findMountRoot !== "function") {
        throw new TypeError(
          "ApplicationDomLifecycleService requires a mount-root locator."
        );
      }
      this.environment = environment2;
      this.document = environment2.getDocument();
      this.findMountRoot = findMountRoot;
      this.onAddedNode = onAddedNode || (() => {
      });
      this.onMountScan = onMountScan || (() => {
      });
      this.registerPerformanceObserver = registerPerformanceObserver || (() => null);
      this.onError = onError || (() => {
      });
      this.scope = null;
      this.mountRoot = null;
      this.mutationObserver = null;
      this.performanceObserver = null;
      this.observationTarget = null;
      this.mounted = false;
    }
    /**
     * @param {import("../core/disposable-scope.js").DisposableScope} parentScope
     * @return {boolean}
     */
    mount(parentScope) {
      if (this.mounted) return false;
      if (typeof parentScope?.child !== "function") {
        throw new TypeError(
          "ApplicationDomLifecycleService.mount() requires a DisposableScope."
        );
      }
      this.mounted = true;
      this.scope = parentScope.child();
      this.performanceObserver = this.registerPerformanceObserver();
      if (typeof this.performanceObserver?.disconnect === "function") {
        this.scope.defer(() => this.performanceObserver?.disconnect());
      }
      const MutationObserver2 = this.environment.window?.MutationObserver;
      if (typeof MutationObserver2 === "function") {
        this.mutationObserver = new MutationObserver2((records) => {
          this.handleMutations(records);
        });
        this.scope.defer(() => this.mutationObserver?.disconnect());
        this.connectObserver();
      }
      this.scanMount({ reason: "application-start", type: "mount" });
      return true;
    }
    /**
     * Rescan synchronously. In particular, the application reload path calls
     * this after the route coordinator has recreated its private scope, so
     * retained Story DOM does not need another mutation before being rebound.
     *
     * @param {*} change
     * @return {boolean}
     */
    refresh(change) {
      if (!this.mounted) return false;
      this.connectObserver();
      this.scanMount(change || { type: "refresh" });
      return true;
    }
    /** @return {*[]} */
    dispose() {
      if (!this.mounted) return [];
      this.mounted = false;
      const errors = this.scope?.dispose() || [];
      this.scope = null;
      this.mountRoot = null;
      this.mutationObserver = null;
      this.performanceObserver = null;
      this.observationTarget = null;
      return errors;
    }
    /** @private */
    connectObserver() {
      if (!this.mutationObserver) return;
      const mountRoot = this.findMountRoot();
      const target = mountRoot || this.document.documentElement || this.document.body || this.document;
      this.mountRoot = mountRoot;
      if (!target || target === this.observationTarget) return;
      try {
        this.mutationObserver.disconnect();
        this.mutationObserver.observe(target, {
          childList: true,
          subtree: true
        });
        this.observationTarget = target;
      } catch (error) {
        this.observationTarget = null;
        this.onError(error, { phase: "mutation-observe", target });
      }
    }
    /**
     * @param {MutationRecord[]} records
     * @private
     */
    handleMutations(records) {
      if (!this.mounted) return;
      const previousRoot = this.mountRoot;
      this.connectObserver();
      if (!this.mountRoot) return;
      if (this.mountRoot !== previousRoot) {
        this.scanMount({ reason: "mount-root-discovered", type: "mount" });
        return;
      }
      for (const mutation of records || []) {
        if (mutation.type !== "childList") continue;
        for (const node of mutation.addedNodes || []) {
          if (node === this.mountRoot || this.mountRoot.contains?.(node) === true) {
            try {
              this.onAddedNode(node, this.mountRoot);
            } catch (error) {
              this.onError(error, { node, phase: "mutation-callback" });
            }
          }
        }
      }
    }
    /**
     * @param {*} change
     * @private
     */
    scanMount(change) {
      const currentRoot = this.findMountRoot();
      if (!currentRoot) return;
      this.mountRoot = currentRoot;
      try {
        this.onMountScan(currentRoot, change);
      } catch (error) {
        this.onError(error, { change, phase: "mount-scan" });
      }
    }
  };

  // src/controllers/image-viewer-controller.js
  var ImageViewerController = class {
    /**
     * @param {Object} dependencies
     * @param {import("../core/environment.js").UserscriptEnvironment} dependencies.environment
     * @param {Function} dependencies.$ jQuery bound to the userscript window.
     * @param {ImageViewerIcons} dependencies.icons
     */
    constructor({ environment: environment2, $, icons }) {
      if (typeof environment2?.getDocument !== "function") {
        throw new TypeError("ImageViewerController requires an environment.");
      }
      if (typeof $ !== "function") {
        throw new TypeError("ImageViewerController requires jQuery.");
      }
      if (typeof icons?.close !== "string" || typeof icons?.rotate !== "string") {
        throw new TypeError("ImageViewerController requires viewer icons.");
      }
      this.environment = environment2;
      this.document = environment2.getDocument();
      this.$ = $;
      this.icons = icons;
      this.scope = null;
    }
    /** @return {boolean} */
    get opened() {
      return Boolean(this.scope && !this.scope.disposed);
    }
    /**
     * Replace any existing viewer and mount a fresh one in the active route.
     *
     * @param {string} imageUrl
     * @param {import("../core/disposable-scope.js").DisposableScope} routeScope
     * @return {HTMLElement}
     */
    open(imageUrl, routeScope) {
      if (typeof routeScope?.child !== "function" || routeScope.disposed) {
        throw new TypeError(
          "ImageViewerController.open() requires an active route scope."
        );
      }
      this.dispose();
      const $ = this.$;
      const viewerScope = routeScope.child();
      this.scope = viewerScope;
      try {
        $("body").append(
          `<div id="imageViewer">
        <div id="iv_header">
            <div class="iv_title">Image Viewer</div>
            <div class="iv_actions">
                <div id="rotate_left">${this.icons.rotate}</div>
                <div id="rotate_right">${this.icons.rotate}</div>
            </div>
            <div id="iv_close">${this.icons.close}</div>
        </div>
        <section>
            <div id="iv_transform">
                <div id="iv_rotate">
                    <img id="iv_image" src="" />
                </div>
            </div>
        </section>
    </div>`
        );
        const $container = $("#imageViewer");
        const $section = $("#imageViewer > section");
        const $wrapT = $("#iv_transform");
        const $wrapR = $("#iv_rotate");
        const $header = $("#iv_header");
        const $closeIcon = $("#iv_close");
        const $image = $("#iv_image");
        const $rotateLeft = $("#rotate_left");
        const $rotateRight = $("#rotate_right");
        viewerScope.defer(() => {
          $container.remove();
          if (this.scope === viewerScope) this.scope = null;
        });
        $image.attr("src", imageUrl);
        $container.css("display", "flex");
        $wrapT.css("transform-origin", "0 0");
        $wrapT.css("transition", `transform 0.15s ease`);
        $wrapR.css("transform-origin", "center");
        $wrapR.css("transition", `transform 0.15s ease`);
        $wrapT.css("will-change", "transform");
        $wrapR.css("will-change", "transform");
        let rotate = 0;
        let scale = 1;
        let posX = 0;
        let posY = 0;
        let isDragging = false;
        let isMovingPhoto = false;
        let startX;
        let startY;
        let previousPosition = {
          x: 0,
          y: 0
        };
        viewerScope.setInterval(() => {
          const currentPosition = {
            x: posX,
            y: posY
          };
          if (currentPosition.x !== previousPosition.x || currentPosition.y !== previousPosition.y) {
            isMovingPhoto = true;
          } else {
            isMovingPhoto = false;
          }
          previousPosition = currentPosition;
        }, 100);
        const updateImageStyle = () => {
          $wrapT.css(
            "transition",
            isMovingPhoto ? "none" : `transform 0.15s ease`
          );
          $wrapT.css(
            "transform",
            `translate(${posX}px, ${posY}px) scale(${scale})`
          );
          $wrapR.css("transform", `rotate(${rotate}deg)`);
          if (scale == 1) {
            $image.css("cursor", "zoom-in");
          } else {
            $image.css("cursor", "grabbing");
          }
        };
        const makeZoomAction = (event, newScale) => {
          event.preventDefault();
          const prevScale = scale;
          if (newScale == null) {
            const factor = 0.1;
            const delta = event.originalEvent.deltaY < 0 ? 1 : -1;
            scale = Math.min(5, Math.max(1, scale + delta * factor * scale));
          } else {
            scale = newScale;
          }
          const rect = $section[0].getBoundingClientRect();
          const mx = event.clientX - rect.left;
          const my = event.clientY - rect.top;
          const zoomTargetX = (mx - posX) / prevScale;
          const zoomTargetY = (my - posY) / prevScale;
          posX = -zoomTargetX * scale + mx;
          posY = -zoomTargetY * scale + my;
          updateImageStyle();
        };
        viewerScope.listenJQuery($image, "load", () => {
          posX = 0;
          posY = 0;
          updateImageStyle();
        });
        viewerScope.listenJQuery($image, "dragstart drop", (event) => {
          event.preventDefault();
        });
        viewerScope.listenJQuery($image, "click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          if (!isMovingPhoto) {
            if (scale <= 1) {
              makeZoomAction(
                event,
                Math.min(Math.max(1, scale + 1.25), 5)
              );
            } else {
              scale = 1;
              posX = 0;
              posY = 0;
            }
            updateImageStyle();
          }
        });
        viewerScope.listenJQuery($section, "wheel", (event) => {
          event.preventDefault();
          makeZoomAction(event);
        });
        viewerScope.listenJQuery($container, "wheel", (event) => {
          event.preventDefault();
        });
        viewerScope.listenJQuery($image, "mousedown", (event) => {
          if (scale == 1) return;
          isDragging = true;
          startX = event.pageX - posX;
          startY = event.pageY - posY;
          $image.css("cursor", "grabbing");
        });
        viewerScope.listenJQuery($image, "mouseup", () => {
          if (scale == 1) return;
          isDragging = false;
          $image.css("cursor", "grab");
        });
        viewerScope.listenJQuery($rotateLeft, "click", () => {
          rotate -= 90;
          updateImageStyle();
        });
        viewerScope.listenJQuery($rotateRight, "click", () => {
          rotate += 90;
          updateImageStyle();
        });
        viewerScope.listenJQuery(
          $(this.document),
          "mousemove.igHelper",
          (event) => {
            if (!isDragging) return;
            event.preventDefault();
            posX = event.pageX - startX;
            posY = event.pageY - startY;
            updateImageStyle();
          }
        );
        viewerScope.listenJQuery($container, "click", () => {
          this.dispose();
        });
        viewerScope.listenJQuery($closeIcon, "click", () => {
          this.dispose();
        });
        viewerScope.listenJQuery($header, "click", (event) => {
          event.preventDefault();
          event.stopPropagation();
        });
        return $container[0];
      } catch (error) {
        viewerScope.dispose();
        throw error;
      }
    }
    /** @return {*[]} */
    dispose() {
      const scope = this.scope;
      const errors = scope?.dispose() || [];
      if (this.scope === scope) this.scope = null;
      this.$("#imageViewer").remove();
      return errors;
    }
  };

  // src/controllers/debug-controller.js
  var DebugController = class {
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
      environment: environment2,
      createDialog,
      translateHtml,
      getLogs,
      isJQuery
    }) {
      if (typeof $ !== "function" || typeof environment2?.getDocument !== "function") {
        throw new TypeError("DebugController requires jQuery and an environment.");
      }
      const callbacks = { createDialog, getLogs, isJQuery, translateHtml };
      for (const [name, callback] of Object.entries(callbacks)) {
        if (typeof callback !== "function") {
          throw new TypeError(`DebugController requires ${name}().`);
        }
      }
      this.$ = $;
      this.environment = environment2;
      this.document = environment2.getDocument();
      this.createDialog = createDialog;
      this.translateHtml = translateHtml;
      this.getLogs = getLogs;
      this.isJQuery = isJQuery;
      this.scope = null;
      this.mounted = false;
      this.objectUrls = /* @__PURE__ */ new Set();
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
          once: true
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
      this.$(".IG_POPUP_DIG_DEBUG, .IG_POPUP_DIG_FEEDBACK").stop(true, true).remove();
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
        "<textarea readonly></textarea>"
      );
      $(".IG_POPUP_DIG .IG_POPUP_DIG_BODY").append(
        '<div class="insta-loader-dialog-actions"></div>'
      );
      $(".IG_POPUP_DIG .insta-loader-dialog-actions").append(
        `<button type="button" class="IG_DISPLAY_DOM_TREE"><a>${this.translateHtml("SHOW_DOM_TREE")}</a></button>`
      );
      $(".IG_POPUP_DIG .insta-loader-dialog-actions").append(
        `<button type="button" class="IG_SELECT_DOM_TREE"><a>${this.translateHtml("SELECT_AND_COPY")}</a></button>`
      );
      $(".IG_POPUP_DIG .insta-loader-dialog-actions").append(
        `<button type="button" class="IG_DOWNLOAD_DOM_TREE"><a>${this.translateHtml("DOWNLOAD_DOM_TREE")}</a></button>`
      );
      $(".IG_POPUP_DIG .insta-loader-dialog-actions").append(
        `<button type="button" class="IG_REPORT_GITHUB"><a href="https://github.com/paytonison/insta-loader/issues" target="_blank">${this.translateHtml("REPORT_GITHUB")}</a></button>`
      );
      $(".IG_POPUP_DIG .insta-loader-dialog-actions").append(
        `<button type="button" class="IG_REPORT_DISCORD"><a href="https://discord.gg/q3KT4hdq8x" target="_blank">${this.translateHtml("REPORT_DISCORD")}</a></button>`
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
        '<div class="insta-loader-dialog-actions"></div>'
      );
      $(".IG_POPUP_DIG .insta-loader-dialog-actions").append(
        `<button type="button" class="IG_REPORT_FORK"><a href="https://github.com/paytonison/insta-loader/issues" target="_blank">${this.translateHtml("REPORT_FORK")}</a></button>`
      );
      $(".IG_POPUP_DIG .insta-loader-dialog-actions").append(
        `<button type="button" class="IG_REPORT_GITHUB"><a href="https://github.com/paytonison/insta-loader/issues" target="_blank">${this.translateHtml("REPORT_GITHUB")}</a></button>`
      );
      $(".IG_POPUP_DIG .insta-loader-dialog-actions").append(
        `<button type="button" class="IG_REPORT_DISCORD"><a href="https://discord.gg/q3KT4hdq8x" target="_blank">${this.translateHtml("REPORT_DISCORD")}</a></button>`
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
        () => this.setDomTreeContent()
      );
      this.scope.listenJQuery(
        body,
        "click",
        ".IG_POPUP_DIG .IG_POPUP_DIG_BODY .IG_SELECT_DOM_TREE",
        () => {
          this.$(".IG_POPUP_DIG .IG_POPUP_DIG_BODY textarea").select();
          this.document.execCommand("copy");
        }
      );
      this.scope.listenJQuery(
        body,
        "click",
        ".IG_POPUP_DIG .IG_POPUP_DIG_BODY .IG_DOWNLOAD_DOM_TREE",
        () => this.downloadDomTree()
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
          function(_key, value) {
            if (Array.isArray(this) && typeof value === "object" && controller.isJQuery(value)) {
              return controller.convertDom(value);
            }
            return value;
          },
          "	"
        );
        logText += `${new Date(log.time).toISOString()}: ${jsonData}
`;
      }
      $(".IG_POPUP_DIG .IG_POPUP_DIG_BODY textarea").text(
        "Logger:\n" + logText + "\n-----\n\nLocation: " + this.environment.getLocation().pathname + "\nDOM Tree with div#mount:\n" + mount.innerHTML
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
      anchor.download = `DOMTree-${(/* @__PURE__ */ new Date()).getTime()}.txt`;
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
          className: element.className
        });
      }
      return converted;
    }
  };

  // src/controllers/hotkey-controller.js
  var HOTKEY_OPTIONS = Object.freeze([
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
    Object.freeze({ value: "53", label: "Alt+5" })
  ]);
  var HOTKEY_CONFIGS = Object.freeze([
    Object.freeze({
      name: "HOTKEY_SETTINGS",
      key: "HOTKEY_SETTINGS_KEY",
      preferenceName: "settings",
      stateKey: "settingsHotkeyKeyCode",
      storageKey: "G_HOTKEY_SETTINGS_KEYCODE",
      defaultKeyCode: 87
    }),
    Object.freeze({
      name: "HOTKEY_KEY_SETTINGS",
      key: "HOTKEY_KEY_SETTINGS_KEY",
      preferenceName: "keySettings",
      stateKey: "keySettingsHotkeyKeyCode",
      storageKey: "G_HOTKEY_KEY_SETTINGS_KEYCODE",
      defaultKeyCode: 67
    }),
    Object.freeze({
      name: "HOTKEY_DEBUG",
      key: "HOTKEY_DEBUG_KEY",
      preferenceName: "debug",
      stateKey: "debugHotkeyKeyCode",
      storageKey: "G_HOTKEY_DEBUG_KEYCODE",
      defaultKeyCode: 90
    }),
    Object.freeze({
      name: "HOTKEY_DOWNLOAD_STORY",
      key: "HOTKEY_DOWNLOAD_STORY_KEY",
      preferenceName: "downloadStory",
      stateKey: "downloadStoryHotkeyKeyCode",
      storageKey: "G_HOTKEY_DOWNLOAD_STORY_KEYCODE",
      defaultKeyCode: 83
    })
  ]);
  var HotkeyController = class {
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
      environment: environment2,
      createDialog,
      translateHtml,
      model,
      showSettings,
      showDebug,
      reload
    }) {
      if (typeof $ !== "function" || typeof environment2?.getDocument !== "function") {
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
      this.environment = environment2;
      this.document = environment2.getDocument();
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
            (event) => this.handleKeydown(event)
          );
        }
      };
      if (this.document.readyState === "loading") {
        this.scope.listen(this.document, "DOMContentLoaded", register, {
          once: true
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
                            ${HOTKEY_OPTIONS.filter(
        (option) => option.value != config.defaultKeyCode.toString()
      ).map(
        (option) => `<option value="${option.value}" ${option.value == currentKeyCode ? "selected" : ""}>${option.label}</option>`
      ).join("")}
                            <option value="${config.defaultKeyCode}" ${currentKeyCode == config.defaultKeyCode ? "selected" : ""}>Alt+${String.fromCharCode(config.defaultKeyCode)}</option>
                        </select>
                        <button type="button" class="hotkey-reset" title="${this.translateHtml("HOTKEY_RESET")}">${this.translateHtml("HOTKEY_RESET")}</button>
                    </div>
                    <div class="hotkey-conflict-warning">▲ ${this.translateHtml("HOTKEY_CONFLICT_WARNING")}</div>
                </label>
            `);
      $container.find(".hotkey-reset").on("click", () => {
        const defaultCode = parseInt(
          $container.find(".hotkey-preset").data("default")
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
          $container.find(".hotkey-conflict-warning").show().delay(2e3).fadeOut(500);
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
        (config) => config.stateKey !== excludedStateKey && this.model.get(config.stateKey) === keyCode
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
        if ($(".IG_POPUP_DIG").length > 0 && $(".IG_POPUP_DIG #post_info").text() === "Preference Settings") {
          $(".IG_POPUP_DIG").remove();
        } else {
          this.showSettings();
        }
        event.preventDefault();
      }
      const keySettingsKeyCode = this.model.get("keySettingsHotkeyKeyCode") || 67;
      if (event.which == keySettingsKeyCode) {
        if ($(".IG_POPUP_DIG").length > 0 && $(".IG_POPUP_DIG #post_info").text() === "Hotkey Settings") {
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
      const downloadStoryKeyCode = this.model.get("downloadStoryHotkeyKeyCode") || 83;
      if (event.which == downloadStoryKeyCode) {
        const href = this.environment.getLocation().href;
        if (href.match(/^(https:\/\/www\.instagram\.com\/stories\/)/gi) && $(".IG_DWSTORY").length > 0) {
          $(".IG_DWSTORY")?.trigger("click");
        }
        if (href.match(
          /^(https:\/\/www\.instagram\.com\/stories\/highlights\/)/gi
        ) && $(".IG_DWHISTORY").length > 0) {
          $(".IG_DWHISTORY")?.trigger("click");
        }
        event.preventDefault();
      }
    }
  };

  // src/controllers/menu-controller.js
  var MenuController = class {
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
      environment: environment2,
      translate,
      showSettings,
      showHotkeySettings,
      showDebug,
      showFeedback,
      checkForUpdate,
      reload,
      logger
    }) {
      if (typeof environment2?.registerMenuCommand !== "function" || typeof environment2?.unregisterMenuCommand !== "function" || typeof environment2?.openInTab !== "function") {
        throw new TypeError("MenuController requires a userscript environment.");
      }
      const callbacks = {
        checkForUpdate,
        reload,
        showDebug,
        showFeedback,
        showHotkeySettings,
        showSettings,
        translate
      };
      for (const [name, callback] of Object.entries(callbacks)) {
        if (typeof callback !== "function") {
          throw new TypeError(`MenuController requires ${name}().`);
        }
      }
      this.environment = environment2;
      this.translate = translate;
      this.showSettings = showSettings;
      this.showHotkeySettings = showHotkeySettings;
      this.showDebug = showDebug;
      this.showFeedback = showFeedback;
      this.checkForUpdate = checkForUpdate;
      this.reloadApplication = reload;
      this.logger = logger || (() => {
      });
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
      this.register(
        "DONATE",
        "d",
        () => this.environment.openInTab("https://ko-fi.com/paytonison", {
          active: true
        })
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
        { accessKey }
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
  };

  // src/controllers/settings-controller.js
  var SettingsController = class {
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
      environment: environment2,
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
      logger
    }) {
      if (typeof $ !== "function" || typeof environment2?.getDocument !== "function") {
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
        translateHtml
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
        "setVideoVolume"
      ];
      for (const name of modelMethods) {
        if (typeof model?.[name] !== "function") {
          throw new TypeError(`SettingsController model requires ${name}().`);
        }
      }
      this.$ = $;
      this.environment = environment2;
      this.document = environment2.getDocument();
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
      this.onSettingChanged = onSettingChanged || (() => {
      });
      this.logger = logger || (() => {
      });
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
          once: true
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
          `<option value="${language}" ${this.model.getLanguage() === language ? "selected" : ""}>${this.localeManifest[language]}</option>`
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
          $body.find(`input[id="${name}"]`).parent("label").on("contextmenu", function(event) {
            event.preventDefault();
            if (!$(this).find("#tempWrapper").length) {
              $(this).append('<div id="tempWrapper"></div>').children("#tempWrapper").append(
                `<input value="${controller.model.getVideoVolume()}" type="range" min="0" max="1" step="0.05" />`
              ).append(
                `<input value="${controller.model.getVideoVolume()}" step="0.05" type="number" />`
              ).append(
                `<div class="IG_POPUP_DIG_BTN">${controller.icons.close}</div>`
              );
            }
          });
        }
        if (name === "AUTO_RENAME") {
          const controller = this;
          $body.find(`input[id="${name}"]`).parent("label").on("contextmenu", function(event) {
            event.preventDefault();
            if (!$(this).find("#tempWrapper").length) {
              $(this).append('<div id="tempWrapper"></div>').children("#tempWrapper").append(
                `<input id="date_format" value="${controller.model.getRenameFormat()}" />`
              ).append(
                `<div class="IG_POPUP_DIG_BTN">${controller.icons.close}</div>`
              );
            }
          });
        }
      }
      $(".IG_POPUP_DIG .IG_POPUP_DIG_BODY input#CHECK_FOR_UPDATE").closest("label").prependTo(".IG_POPUP_DIG .IG_POPUP_DIG_BODY");
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
        function() {
          const name = $(this).attr("id");
          if (name && controller.settings[name] !== void 0) {
            const isChecked = $(this).prop("checked");
            controller.model.setSetting(name, isChecked);
            controller.onSettingChanged(name, isChecked);
            controller.logger("user settings", name, isChecked);
          }
        }
      );
      this.scope.listenJQuery(
        body,
        "click",
        ".IG_POPUP_DIG .globalSettings",
        function(event) {
          if ($(this).find("#tempWrapper").length > 0) {
            event.preventDefault();
          }
        }
      );
      this.scope.listenJQuery(
        body,
        "change",
        ".IG_POPUP_DIG #tempWrapper input:not(#date_format)",
        function() {
          const value = $(this).val();
          if ($(this).attr("type") == "range") {
            $(this).next().val(value);
          } else {
            $(this).prev().val(value);
          }
          if (value >= 0 && value <= 1) {
            controller.model.setVideoVolume(value);
          }
        }
      );
      this.scope.listenJQuery(
        body,
        "input",
        ".IG_POPUP_DIG #tempWrapper input:not(#date_format)",
        function() {
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
        }
      );
      this.scope.listenJQuery(
        body,
        "input",
        ".IG_POPUP_DIG #tempWrapper input#date_format",
        function() {
          controller.model.setRenameFormat($(this).val());
        }
      );
      this.scope.listenJQuery(
        body,
        "change",
        ".IG_POPUP_DIG_BODY #langSelect",
        function() {
          controller.changeLanguage($(this).val());
        }
      );
    }
    /** @param {string} language @private */
    changeLanguage(language) {
      const requestedLanguage = this.model.setLanguage(language);
      this.model.clearTranslationCache();
      if (requestedLanguage?.startsWith("en") || this.model.hasLocale(requestedLanguage)) {
        this.repaintTranslations();
        this.refreshMenus();
        return;
      }
      this.reportAsync(
        () => this.loadTranslation(requestedLanguage).then((dictionary) => {
          this.model.setLocale(requestedLanguage, dictionary);
          if (this.model.getLanguage() !== requestedLanguage) return;
          this.model.clearTranslationCache();
          this.repaintTranslations();
          this.refreshMenus();
        }),
        "getTranslationText()"
      );
    }
    /** @private */
    arrangeHierarchy() {
      const $ = this.$;
      for (const [parent, children] of Object.entries(this.parentChildMapping)) {
        let $previous = $(
          `.IG_POPUP_DIG .IG_POPUP_DIG_BODY input#${parent}`
        ).closest("label");
        for (const child of children) {
          const $childLabel = $(
            `.IG_POPUP_DIG .IG_POPUP_DIG_BODY input#${child}`
          ).closest("label").detach();
          $childLabel.addClass("child");
          $previous.after($childLabel);
          $previous = $childLabel;
        }
      }
    }
  };

  // src/controllers/profile-controller.js
  var PROFILE_CONTROL_SELECTOR = ".IG_DWPROFILE";
  var PROFILE_HEADER_SELECTOR = "header > *[class]:first-child img[alt]";
  var PROFILE_IMAGE_SELECTOR = "header > *[class]:first-child > *[class]:first-child img[alt]";
  var ProfileController = class {
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
      environment: environment2,
      $,
      downloadIcon,
      downloadIntent,
      executeMediaDescriptor,
      getHighResolutionProfile,
      getLocation,
      getUserInfo,
      getDownloadTitle,
      normalizeProfileAvatar: normalizeProfileAvatar2,
      setLoading,
      now = Date.now,
      logger = () => {
      },
      onError = () => {
      },
      mountDelay = 150,
      discoveryInterval = 150
    }) {
      if (typeof environment2?.getDocument !== "function") {
        throw new TypeError("ProfileController requires an environment.");
      }
      for (const [name, value] of Object.entries({
        $,
        executeMediaDescriptor,
        getHighResolutionProfile,
        getLocation,
        getUserInfo,
        getDownloadTitle,
        normalizeProfileAvatar: normalizeProfileAvatar2,
        setLoading,
        now,
        logger,
        onError
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
      this.environment = environment2;
      this.document = environment2.getDocument();
      this.$ = $;
      this.downloadIcon = downloadIcon;
      this.downloadIntent = downloadIntent;
      this.executeMediaDescriptor = executeMediaDescriptor;
      this.getHighResolutionProfile = getHighResolutionProfile;
      this.getLocation = getLocation;
      this.getUserInfo = getUserInfo;
      this.getDownloadTitle = getDownloadTitle;
      this.normalizeProfileAvatar = normalizeProfileAvatar2;
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
          "ProfileController.mount() requires a route-owned DisposableScope."
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
      const timestamp = Math.floor(this.now() / 1e3);
      const username = this._getRouteUsername();
      const userInfo = await this.getUserInfo(username);
      if (!this._isCurrentAction(generation)) return false;
      let highResolutionPayload = null;
      try {
        highResolutionPayload = await this.getHighResolutionProfile(
          userInfo.user.pk
        );
      } catch (error) {
        if (!this._isCurrentAction(generation)) return false;
        this.logger(
          "ProfileController",
          "high-resolution fallback",
          error?.message || error
        );
      }
      if (!this._isCurrentAction(generation)) return false;
      const descriptor = this.normalizeProfileAvatar(userInfo, {
        highResolutionPayload,
        owner: username,
        publishTime: timestamp
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
            useMediaApi: false
          }
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
        }
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
      const $draggableElements = this.$(`${selector}[draggable]`).parent().parent();
      const $nonDraggableElements = this.$(`${selector}:not([draggable])`).parent().parent().parent();
      const markup = `<div data-ih-locale-title="DW" title="${this.getDownloadTitle()}" class="IG_DWPROFILE">${this.downloadIcon}</div>`;
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
      return this.getLocation().pathname.replaceAll(/(reels|tagged)\/$/gi, "").split("/").filter((segment) => segment.length > 0).at(-1);
    }
    /** @param {number} generation @return {boolean} @private */
    _isCurrentAction(generation) {
      return this.mounted && !this.disposed && this.actionGeneration === generation;
    }
  };
  var PROFILE_SELECTORS = Object.freeze({
    control: PROFILE_CONTROL_SELECTOR,
    header: PROFILE_HEADER_SELECTOR,
    image: PROFILE_IMAGE_SELECTOR
  });

  // src/controllers/feature-controller.js
  var InjectedFeatureController = class {
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
      this.onError = options.onError || (() => {
      });
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
        onError: (error) => this.onError(error, {
          featureName: this.name,
          phase: "cleanup"
        })
      });
      const context = Object.freeze({
        ...routeContext,
        controller: this,
        environment: this.environment,
        featureName: this.name,
        scope
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
        return Promise.resolve(result).then((resource) => {
          adoptMountResource(scope, resource);
          return true;
        }).catch((error) => {
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
          phase: "dispose"
        });
        errors.unshift(disposeError);
      }
      return errors;
    }
  };
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
  function adoptMountResource(scope, resource) {
    if (typeof resource === "function") {
      scope.defer(resource);
    } else if (typeof resource?.dispose === "function") {
      scope.use(resource);
    } else if (typeof resource?.abort === "function") {
      scope.trackAbortable(resource);
    }
  }
  function isPromiseLike(value) {
    return value != null && typeof value.then === "function";
  }

  // src/controllers/route-adapters.js
  var FEATURE_CONTROLLER_NAME = Object.freeze({
    POSTS: "posts",
    STORIES: "stories",
    HIGHLIGHTS: "highlights",
    SINGULAR_REEL_CONTROLS: "singular-reel-controls",
    REELS_CONTROLS: "reels-controls",
    PROFILES: "profiles",
    SETTINGS: "settings"
  });
  function createPostController(options) {
    return createNamedController(FEATURE_CONTROLLER_NAME.POSTS, options);
  }
  function createStoryController(options) {
    return createNamedController(FEATURE_CONTROLLER_NAME.STORIES, options);
  }
  function createHighlightController(options) {
    return createNamedController(FEATURE_CONTROLLER_NAME.HIGHLIGHTS, options);
  }
  function createSingularReelControlsController(options) {
    return createNamedController(
      FEATURE_CONTROLLER_NAME.SINGULAR_REEL_CONTROLS,
      options
    );
  }
  function createReelsControlsController(options) {
    return createNamedController(
      FEATURE_CONTROLLER_NAME.REELS_CONTROLS,
      options
    );
  }
  function createProfileController(options) {
    return createNamedController(FEATURE_CONTROLLER_NAME.PROFILES, options);
  }
  function createGlobalSettingsController(options) {
    return createNamedController(FEATURE_CONTROLLER_NAME.SETTINGS, options);
  }
  function createGlobalServiceController(name, options) {
    return createNamedController(name, options);
  }
  function createRouteControllerFactory(options) {
    if (!options?.environment) {
      throw new TypeError("Route controller factory requires an environment.");
    }
    const adapters = options.adapters || {};
    const controllerOptions = (adapter) => ({
      adapter,
      environment: options.environment,
      onError: options.onError
    });
    return function routeControllerFactory(route) {
      switch (route?.kind) {
        case ROUTE_KIND.FEED:
        case ROUTE_KIND.POST:
          return adapters.posts ? [createPostController(controllerOptions(adapters.posts))] : [];
        case ROUTE_KIND.STORY:
          return adapters.stories ? [createStoryController(controllerOptions(adapters.stories))] : [];
        case ROUTE_KIND.HIGHLIGHT:
          return adapters.highlights ? [createHighlightController(controllerOptions(adapters.highlights))] : [];
        case ROUTE_KIND.REEL:
          return adapters.reelControls ? [
            createSingularReelControlsController(
              controllerOptions(adapters.reelControls)
            )
          ] : [];
        case ROUTE_KIND.REELS:
          return adapters.reelsControls ? [
            createReelsControlsController(
              controllerOptions(adapters.reelsControls)
            )
          ] : [];
        case ROUTE_KIND.PROFILE:
          return adapters.profiles ? [createProfileController(controllerOptions(adapters.profiles))] : [];
        default:
          return [];
      }
    };
  }
  function createNamedController(name, options) {
    if (!options || typeof options !== "object") {
      throw new TypeError(`${name} controller requires options.`);
    }
    return new InjectedFeatureController({
      adapter: options.adapter,
      environment: options.environment,
      name,
      onError: options.onError
    });
  }

  // src/controllers/application-coordinator.js
  var ApplicationCoordinator = class {
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
      this.globalControllerFactory = options.globalControllerFactory || (() => []);
      this.onError = options.onError || (() => {
      });
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
        onError: (error) => this.onError(error, { phase: "application-cleanup" })
      });
      this._scope = scope;
      this._running = true;
      try {
        this._mountGlobalControllers(
          scope,
          reason === "start" ? "application-start" : reason
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
      const controllers = Array.isArray(created) ? created.filter(Boolean) : created ? [created] : [];
      const context = {
        environment: this.environment,
        previousRoute: null,
        reason,
        route: null,
        scope
      };
      for (const controller of controllers) {
        if (!isFeatureController(controller)) {
          this.onError(
            new TypeError(
              "A global controller must expose mount(), refresh(), and dispose()."
            ),
            { controller, phase: "global-create" }
          );
          continue;
        }
        this._globalControllers.push(controller);
        scope.defer(() => this._disposeController(controller));
        try {
          const result = controller.mount(context);
          Promise.resolve(result).catch(
            (error) => this.onError(error, { controller, phase: "global-mount" })
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
          Promise.resolve(result).catch(
            (error) => this.onError(error, { controller, phase: "global-refresh" })
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
        Promise.resolve(result).catch(
          (error) => this.onError(error, { controller, phase: "global-dispose" })
        );
      } catch (error) {
        this.onError(error, { controller, phase: "global-dispose" });
      }
    }
  };
  function createApplicationCoordinator(options) {
    if (!options?.environment) {
      throw new TypeError("Application coordinator factory requires an environment.");
    }
    const routeControllerFactory = options.routeControllerFactory || createRouteControllerFactory({
      adapters: options.routeAdapters,
      environment: options.environment,
      onError: options.onError
    });
    const routeCoordinator = options.routeCoordinator || new RouteCoordinator({
      classify: options.classify,
      controllerFactory: routeControllerFactory,
      environment: options.environment,
      getClassificationOptions: options.getClassificationOptions,
      isReady: options.isReady,
      onError: options.onError,
      pollInterval: options.pollInterval
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
              onError: options.onError
            })
          );
        }
        for (const service of options.globalServiceAdapters || []) {
          controllers.push(
            createGlobalServiceController(service.name, {
              adapter: service.adapter,
              environment: options.environment,
              onError: options.onError
            })
          );
        }
        const additional = options.globalControllerFactory?.();
        if (Array.isArray(additional)) controllers.push(...additional);
        else if (additional) controllers.push(additional);
        return controllers;
      }
    });
  }

  // src/controllers/video/video-behavior-service.js
  var VIDEO_SETTING = Object.freeze({
    DISABLE_LOOPING: "DISABLE_VIDEO_LOOPING",
    HTML5_CONTROLS: "HTML5_VIDEO_CONTROL",
    MODIFY_VOLUME: "MODIFY_VIDEO_VOLUME"
  });
  var VideoBehaviorService = class {
    /**
     * @param {Object} dependencies
     * @param {import("../../core/environment.js").UserscriptEnvironment} dependencies.environment
     * @param {Object} dependencies.settings SettingsStore or the live USER_SETTING object.
     * @param {VideoVolumeState} dependencies.volume
     * @param {DisposableScope} [dependencies.scope]
     * @param {(element: Element) => void} [dependencies.triggerClick]
     * @param {(surface: string, message: string, details?: Object) => void} [dependencies.logger]
     */
    constructor({
      environment: environment2,
      settings,
      volume,
      scope,
      triggerClick,
      logger
    }) {
      if (typeof environment2?.getDocument !== "function") {
        throw new TypeError("VideoBehaviorService requires an environment.");
      }
      if (typeof volume?.get !== "function" || typeof volume?.set !== "function") {
        throw new TypeError("VideoBehaviorService requires mutable volume state.");
      }
      this.environment = environment2;
      this.document = environment2.getDocument();
      this.settings = settings || {};
      this.volume = volume;
      this.triggerClick = triggerClick || ((element) => {
        element.click();
      });
      this.logger = logger || (() => {
      });
      this.scope = scope ? scope.child() : new DisposableScope(environment2, {
        onError: (error) => this.logger("video", "Cleanup failed", { error })
      });
      this.root = null;
      this.adapter = null;
      this.disposed = false;
      this.videoRecords = [];
      this.videoScopes = /* @__PURE__ */ new WeakMap();
      this.elementMutationSnapshots = /* @__PURE__ */ new WeakMap();
      this.boundActivationTargets = /* @__PURE__ */ new WeakSet();
      this.boundNavigationGuards = /* @__PURE__ */ new WeakSet();
      this.controllerLayouts = /* @__PURE__ */ new WeakMap();
      this.muteControls = /* @__PURE__ */ new WeakMap();
      this.hiddenDisplayValues = /* @__PURE__ */ new WeakMap();
    }
    /**
     * @param {Element} root
     * @param {VideoSurfaceAdapter} adapter
     * @return {VideoBehaviorService}
     */
    mount(root, adapter) {
      if (this.disposed) {
        throw new Error("A disposed VideoBehaviorService cannot be remounted.");
      }
      if (root?.nodeType !== 1) {
        throw new TypeError("VideoBehaviorService.mount() requires an element.");
      }
      validateAdapter(adapter);
      if (this.root && (this.root !== root || this.adapter !== adapter)) {
        throw new Error(
          "Create a new VideoBehaviorService for a different surface root."
        );
      }
      this.root = root;
      this.adapter = adapter;
      this.refresh();
      return this;
    }
    /**
     * Attach behavior to new video nodes and release nodes no longer owned by the
     * mounted surface. Repeated refreshes never duplicate listeners.
     *
     * @param {*} [_change]
     * @return {number} Number of currently owned video nodes.
     */
    refresh(_change) {
      if (this.disposed || !this.root || !this.adapter) return 0;
      this.releaseDetachedVideos();
      const videos = this.adapter.findVideos(this.root);
      for (const video of videos) this.ensureVideo(video);
      if (this.isEnabled(VIDEO_SETTING.HTML5_CONTROLS)) {
        this.bindControllerActivations(videos);
        this.bindNavigationGuards(videos);
      }
      return this.videoRecords.length;
    }
    /**
     * @return {*[]}
     */
    dispose() {
      if (this.disposed) return [];
      this.disposed = true;
      const errors = this.scope.dispose();
      this.videoRecords.length = 0;
      this.root = null;
      this.adapter = null;
      return errors;
    }
    /**
     * @param {string} name
     * @return {boolean}
     * @private
     */
    isEnabled(name) {
      if (typeof this.settings.get === "function") {
        return this.settings.get(name) === true;
      }
      return this.settings[name] === true;
    }
    /** @private */
    releaseDetachedVideos() {
      this.videoRecords = this.videoRecords.filter((record) => {
        if (this.root.contains(record.video)) return true;
        record.scope.dispose();
        this.videoScopes.delete(record.video);
        return false;
      });
    }
    /**
     * @param {HTMLVideoElement} video
     * @private
     */
    ensureVideo(video) {
      if (this.videoScopes.has(video)) return;
      const videoScope = this.scope.child();
      const record = {
        initialVolumeApplied: false,
        loopStopped: false,
        scope: videoScope,
        video
      };
      this.videoScopes.set(video, videoScope);
      this.videoRecords.push(record);
      if (this.adapter.supportsFullscreen) {
        videoScope.listen(video, "fullscreenchange", () => {
          if (!video.getAttribute("style")?.includes("object-fit")) return;
          this.setStyle(
            video,
            "objectFit",
            this.document.fullscreenElement === video ? "contain" : "cover",
            videoScope
          );
        });
      }
      if (this.adapter.supportsLooping && this.isEnabled(VIDEO_SETTING.DISABLE_LOOPING)) {
        videoScope.listen(video, "ended", () => this.stopLooping(record));
      }
      if (this.adapter.setVolumeOnPlayback && this.isEnabled(VIDEO_SETTING.MODIFY_VOLUME)) {
        const applyInitialVolume = () => {
          if (record.initialVolumeApplied) return;
          record.initialVolumeApplied = true;
          this.setAttribute(video, "data-modify", "true", videoScope);
          video.volume = this.volume.get();
          this.logger(this.adapter.surface, "Applied saved playback volume");
        };
        videoScope.listen(video, "play", applyInitialVolume);
        videoScope.listen(video, "playing", applyInitialVolume);
        if (!video.paused) applyInitialVolume();
      }
      if (this.isEnabled(VIDEO_SETTING.HTML5_CONTROLS)) {
        this.initializeHtml5Controller(video, videoScope);
      }
    }
    /**
     * @param {{video: HTMLVideoElement, scope: DisposableScope, loopStopped: boolean}} record
     * @private
     */
    stopLooping(record) {
      if (record.loopStopped) return;
      record.loopStopped = true;
      const { video } = record;
      this.setAttribute(video, "data-loop", "true", record.scope);
      const action = this.adapter.findLoopAction(this.root, video);
      if (action.button) {
        action.button.click();
        this.logger(this.adapter.surface, "Stopped looping through native UI");
        return;
      }
      for (const element of action.reveal) {
        this.removeAttribute(element, "style", record.scope);
      }
      video.pause();
      this.logger(this.adapter.surface, "Stopped looping through pause()");
    }
    /**
     * @param {HTMLVideoElement} video
     * @param {DisposableScope} videoScope
     * @private
     */
    initializeHtml5Controller(video, videoScope) {
      if (this.isEnabled(VIDEO_SETTING.MODIFY_VOLUME)) {
        video.volume = this.volume.get();
        videoScope.listen(video, "loadstart", () => {
          video.volume = this.volume.get();
        });
      }
      this.muteControls.set(
        video,
        this.adapter.findMuteControls(this.root, video)
      );
      videoScope.listen(video, "contextmenu", (event) => {
        this.hideHtml5Controller(video, event);
      });
      videoScope.listen(video, "volumechange", () => {
        this.synchronizeMuteAndVolume(video);
      });
      this.setStyle(
        video,
        "position",
        this.adapter.controllerPosition,
        videoScope
      );
      this.setAttribute(video, "data-controls", "true", videoScope);
      this.logger(this.adapter.surface, "Installed HTML5 video controller hooks");
    }
    /**
     * @param {HTMLVideoElement[]} videos
     * @private
     */
    bindControllerActivations(videos) {
      const activations = this.adapter.findControllerActivations(
        this.root,
        videos
      );
      for (const activation of activations) {
        if (this.boundActivationTargets.has(activation.target)) continue;
        const activationScope = this.videoScopes.get(activation.video) || this.scope;
        this.boundActivationTargets.add(activation.target);
        activationScope.defer(() => {
          this.boundActivationTargets.delete(activation.target);
        });
        activationScope.listen(activation.target, "contextmenu", (event) => {
          this.showHtml5Controller(activation.video, event);
        });
      }
    }
    /**
     * @param {HTMLVideoElement[]} videos
     * @private
     */
    bindNavigationGuards(videos) {
      for (const video of videos) {
        const guard = this.adapter.findNavigationGuard(this.root, video);
        if (!guard || this.boundNavigationGuards.has(guard)) continue;
        const guardScope = this.videoScopes.get(video) || this.scope;
        this.boundNavigationGuards.add(guard);
        guardScope.defer(() => {
          this.boundNavigationGuards.delete(guard);
        });
        guardScope.listen(guard, "click", (event) => {
          const guardedVideoHasControls = this.adapter.findVideos(this.root).some(
            (candidate) => guard.contains(candidate) && candidate.hasAttribute("controls")
          );
          if (!guardedVideoHasControls) return;
          event.preventDefault();
          event.stopPropagation();
        });
      }
    }
    /**
     * @param {HTMLVideoElement} requestedVideo
     * @param {Event} event
     * @private
     */
    showHtml5Controller(requestedVideo, event) {
      event.preventDefault();
      event.stopPropagation();
      const videos = this.adapter.findVideos(this.root);
      const selectedVideo = videos.includes(requestedVideo) ? requestedVideo : videos[0];
      if (!selectedVideo) return;
      const layout = this.adapter.locateControllerLayout(
        this.root,
        selectedVideo,
        event
      );
      const controllerVideos = this.adapter.findControllerVideos(
        this.root,
        selectedVideo,
        videos
      );
      for (const video of controllerVideos) {
        const videoScope = this.videoScopes.get(video) || this.scope;
        this.setStyle(video, "zIndex", "2", videoScope);
        this.setAttribute(video, "controls", "", videoScope);
        this.controllerLayouts.set(video, layout);
      }
      const layoutScope = this.videoScopes.get(selectedVideo) || this.scope;
      this.setLayerZIndex(
        [layout.overlay, ...layout.layers],
        "-10",
        layoutScope
      );
      for (const element of layout.hidden) {
        if (!this.hiddenDisplayValues.has(element)) {
          this.hiddenDisplayValues.set(element, element.style.display);
        }
        this.setStyle(element, "display", "none", layoutScope);
      }
      for (const link of layout.draggableLinks) {
        this.setAttribute(link, "draggable", "false", layoutScope);
      }
      this.adapter.onControllerVisibilityChange?.({
        visible: true,
        root: this.root,
        selectedVideo,
        videos: controllerVideos,
        layout,
        surface: this.adapter.surface
      });
    }
    /**
     * @param {HTMLVideoElement} video
     * @param {Event} event
     * @private
     */
    hideHtml5Controller(video, event) {
      event.preventDefault();
      event.stopPropagation();
      const layout = this.controllerLayouts.get(video) || this.adapter.locateControllerLayout(this.root, video, event);
      const videoScope = this.videoScopes.get(video) || this.scope;
      this.setStyle(video, "zIndex", "-1", videoScope);
      this.removeAttribute(video, "controls", videoScope);
      this.setLayerZIndex(
        [layout.overlay, ...layout.layers],
        "1",
        videoScope
      );
      for (const element of layout.hidden) {
        this.setStyle(
          element,
          "display",
          this.hiddenDisplayValues.get(element) || "",
          videoScope
        );
        this.hiddenDisplayValues.delete(element);
      }
      if (layout.restoreDraggableOnHide) {
        for (const link of layout.draggableLinks) {
          this.removeAttribute(link, "draggable", videoScope);
        }
      }
      this.adapter.onControllerVisibilityChange?.({
        visible: false,
        root: this.root,
        selectedVideo: video,
        videos: [video],
        layout,
        surface: this.adapter.surface
      });
    }
    /**
     * @param {HTMLVideoElement} video
     * @private
     */
    synchronizeMuteAndVolume(video) {
      const controls = this.muteControls.get(video) || this.adapter.findMuteControls(this.root, video);
      const interfaceMuted = controls.length > 0 ? this.adapter.isMuteControlMuted(controls[0]) : video.muted;
      if (video.muted !== interfaceMuted) {
        video.volume = this.volume.get();
        const overlay = this.controllerLayouts.get(video)?.overlay;
        const control = controls.length === 1 ? controls[0] : controls.find((candidate) => overlay?.contains(candidate)) || controls[0];
        if (control) this.triggerClick(control);
      }
      if (video.hasAttribute("data-completed")) {
        this.volume.set(video.volume);
      }
      if (video.volume == this.volume.get()) {
        this.setAttribute(
          video,
          "data-completed",
          "true",
          this.videoScopes.get(video) || this.scope
        );
      }
    }
    /**
     * @param {Element} element
     * @param {string} property
     * @param {string} value
     * @param {DisposableScope} scope
     * @private
     */
    setStyle(element, property, value, scope) {
      if (!this.rememberMutation(element, `style:${property}`, scope, () => {
        const originalValue = element.style[property];
        return () => {
          element.style[property] = originalValue;
        };
      })) {
        return;
      }
      element.style[property] = value;
    }
    /**
     * @param {Element} element
     * @param {string} name
     * @param {string} value
     * @param {DisposableScope} scope
     * @private
     */
    setAttribute(element, name, value, scope) {
      if (!this.rememberAttribute(element, name, scope)) return;
      element.setAttribute(name, value);
    }
    /**
     * @param {Element} element
     * @param {string} name
     * @param {DisposableScope} scope
     * @private
     */
    removeAttribute(element, name, scope) {
      if (!this.rememberAttribute(element, name, scope)) return;
      element.removeAttribute(name);
    }
    /**
     * @param {Element} element
     * @param {string} name
     * @param {DisposableScope} scope
     * @return {boolean}
     * @private
     */
    rememberAttribute(element, name, scope) {
      return this.rememberMutation(
        element,
        `attribute:${name}`,
        scope,
        () => {
          const originalValue = element.getAttribute(name);
          return () => {
            if (originalValue == null) element.removeAttribute(name);
            else element.setAttribute(name, originalValue);
          };
        }
      );
    }
    /**
     * @param {Array<Element|null|undefined>} elements
     * @param {string} zIndex
     * @param {DisposableScope} scope
     * @private
     */
    setLayerZIndex(elements, zIndex, scope) {
      const seen = /* @__PURE__ */ new Set();
      for (const element of elements) {
        if (!element || seen.has(element)) continue;
        seen.add(element);
        this.setStyle(element, "zIndex", zIndex, scope);
      }
    }
    /**
     * Snapshot one service-owned DOM mutation and register its restoration with
     * the scope that owns the affected video. Repeated writes share the original
     * value, while an early child-scope disposal permits a recycled element to
     * be tracked again.
     *
     * @param {Element} element
     * @param {string} key
     * @param {DisposableScope} scope
     * @param {() => () => void} createRestore
     * @return {boolean}
     * @private
     */
    rememberMutation(element, key, scope, createRestore) {
      if (scope.disposed) return false;
      let mutations = this.elementMutationSnapshots.get(element);
      if (!mutations) {
        mutations = /* @__PURE__ */ new Set();
        this.elementMutationSnapshots.set(element, mutations);
      }
      if (mutations.has(key)) return true;
      mutations.add(key);
      const restore = createRestore();
      scope.defer(() => {
        restore();
        mutations.delete(key);
      });
      return true;
    }
  };
  function validateAdapter(adapter) {
    const methods = [
      "findVideos",
      "findControllerActivations",
      "findControllerVideos",
      "locateControllerLayout",
      "findMuteControls",
      "isMuteControlMuted",
      "findLoopAction",
      "findNavigationGuard"
    ];
    if (!adapter || methods.some((name) => typeof adapter[name] !== "function")) {
      throw new TypeError("The video surface adapter is incomplete.");
    }
  }

  // src/controllers/video/surface-adapters.js
  var VIDEO_SURFACE = Object.freeze({
    POST: "post",
    REEL: "reel",
    STORY: "story",
    HIGHLIGHT: "highlight"
  });
  var CONTROLLER_OVERLAY_SELECTOR = 'div[aria-label][data-visualcompletion="ignore"]';
  var UNMUTED_ICON_SELECTOR = 'svg > path[d^="M16.636"]';
  var MUTE_ICON_SELECTOR = [
    'svg > path[d^="M16.636 7.028a1.5"]',
    'svg > path[d^="M1.5 13.3c-.8"]'
  ].join(", ");
  var STORY_MUTE_ICON_SELECTOR = [
    'svg > path[d^="M1.5 13.3c-.8 0-1.5.7-1.5 1.5v18.4c0"]',
    'svg > path[d^="M16.636 7.028a1.5 1.5"]'
  ].join(", ");
  function uniqueElements(values) {
    const elements = [];
    const seen = /* @__PURE__ */ new Set();
    for (const value of values) {
      if (value?.nodeType !== 1 || seen.has(value)) continue;
      seen.add(value);
      elements.push(value);
    }
    return elements;
  }
  function queryElements(root, selector) {
    return root ? Array.from(root.querySelectorAll(selector)) : [];
  }
  function findVideos(root) {
    return (
      /** @type {HTMLVideoElement[]} */
      queryElements(root, "video")
    );
  }
  function isInstagramMuteControlMuted(control) {
    return control.querySelector(UNMUTED_ICON_SELECTOR) == null;
  }
  function findSizedMuteControls(wrappers, iconSelector) {
    const controls = uniqueElements(
      wrappers.flatMap(
        (wrapper) => queryElements(wrapper, 'button[type="button"], div[role="button"]')
      )
    );
    return controls.filter((control) => {
      const rect = control.getBoundingClientRect();
      const style = control.ownerDocument.defaultView?.getComputedStyle(control);
      const contentWidth = Number.parseFloat(style?.width);
      const contentHeight = Number.parseFloat(style?.height);
      return (Number.isFinite(contentWidth) ? contentWidth : rect.width) <= 64 && (Number.isFinite(contentHeight) ? contentHeight : rect.height) <= 64 && control.querySelector(iconSelector) != null;
    });
  }
  function findPostControllerTarget(root, video) {
    return video.parentElement?.querySelector("video + div > div") || root.querySelector("video + div > div");
  }
  function findControllerOverlay(event) {
    const target = event.target;
    return typeof target?.parentElement?.closest === "function" ? target.parentElement.closest(CONTROLLER_OVERLAY_SELECTOR) : null;
  }
  function findPostOrReelMuteControls(root, video) {
    const localWrapper = findPostControllerTarget(root, video);
    return findSizedMuteControls(
      uniqueElements([localWrapper, root]),
      MUTE_ICON_SELECTOR
    );
  }
  function findRootAndVideoActivations(root, videos, findTarget) {
    if (videos.length === 0) return [];
    const activations = [{ target: root, video: videos[0] }];
    for (const video of videos) {
      const target = findTarget(root, video);
      if (target) activations.push({ target, video });
    }
    return activations;
  }
  function createPostVideoSurfaceAdapter(options = {}) {
    return {
      surface: VIDEO_SURFACE.POST,
      supportsFullscreen: true,
      supportsLooping: true,
      setVolumeOnPlayback: true,
      controllerPosition: "absolute",
      findVideos,
      findControllerActivations(root, videos) {
        return findRootAndVideoActivations(
          root,
          videos,
          findPostControllerTarget
        );
      },
      findControllerVideos(_root, _selected, videos) {
        return videos;
      },
      locateControllerLayout(root, video, event) {
        return {
          overlay: findControllerOverlay(event),
          layers: uniqueElements([findPostControllerTarget(root, video)]),
          hidden: [],
          draggableLinks: uniqueElements([
            root.querySelector('a[href^="/reels/"]')
          ]),
          restoreDraggableOnHide: true
        };
      },
      findMuteControls: findPostOrReelMuteControls,
      isMuteControlMuted: isInstagramMuteControlMuted,
      findLoopAction() {
        return { button: null, reveal: [] };
      },
      findNavigationGuard(_root, video) {
        return video.closest('a[href^="/reels/"]');
      },
      onControllerVisibilityChange: options.onControllerVisibilityChange || null
    };
  }
  function findReelControllerTarget(root, video) {
    const candidates = queryElements(
      video.parentElement || root,
      'video + div div[role="button"]'
    );
    return candidates.find((candidate) => {
      const style = candidate.ownerDocument.defaultView?.getComputedStyle(
        candidate
      );
      return candidate.parentElement?.matches('div[role="presentation"]') && style?.cursor === "pointer" && candidate.hasAttribute("style");
    }) || null;
  }
  function createReelVideoSurfaceAdapter(options = {}) {
    return {
      surface: VIDEO_SURFACE.REEL,
      supportsFullscreen: true,
      supportsLooping: options.supportsLooping !== false,
      setVolumeOnPlayback: true,
      controllerPosition: "relative",
      findVideos,
      findControllerActivations(root, videos) {
        return findRootAndVideoActivations(
          root,
          videos,
          findReelControllerTarget
        );
      },
      findControllerVideos(_root, _selected, videos) {
        return videos;
      },
      locateControllerLayout(root, video, event) {
        return {
          overlay: findControllerOverlay(event),
          layers: uniqueElements([findReelControllerTarget(root, video)]),
          hidden: [],
          draggableLinks: uniqueElements([
            root.querySelector('a[href^="/reels/"]')
          ]),
          restoreDraggableOnHide: false
        };
      },
      findMuteControls: findPostOrReelMuteControls,
      isMuteControlMuted: isInstagramMuteControlMuted,
      findLoopAction(_root, video) {
        const playPath = video.nextElementSibling?.querySelector(
          'div[role="presentation"] > div svg > path[d^="M5.888"]'
        );
        return {
          button: playPath?.closest(
            'button[role="button"], div[role="button"]'
          ) || null,
          reveal: queryElements(video.parentElement, ".xpgaw4o")
        };
      },
      findNavigationGuard() {
        return null;
      },
      onControllerVisibilityChange: options.onControllerVisibilityChange || null
    };
  }
  function findStoryVideoParent(video) {
    let parent = video.parentElement;
    while (parent) {
      if (parent.tagName === "DIV" && !parent.hasAttribute("class") && !parent.hasAttribute("style")) {
        return parent;
      }
      parent = parent.parentElement;
    }
    return null;
  }
  function findStoryLayoutParts(video) {
    const videoParent = findStoryVideoParent(video);
    return {
      videoParent,
      bottomBar: videoParent?.nextElementSibling || null,
      readMore: queryElements(videoParent, 'div[class][role="button"]'),
      layers: queryElements(video.parentElement, "video + div")
    };
  }
  function findStoryOverlay(event) {
    const target = event.target;
    if (target?.nodeType !== 1) return null;
    return target.parentElement?.querySelector(CONTROLLER_OVERLAY_SELECTOR) || target;
  }
  function findStoryMuteControls(_root, video) {
    const videoParent = findStoryVideoParent(video);
    const path = videoParent?.parentElement?.querySelector(
      STORY_MUTE_ICON_SELECTOR
    );
    const control = path?.closest('[role="button"]') || null;
    return uniqueElements([control]);
  }
  function createStoryVideoSurfaceAdapter(options = {}) {
    const surface = options.surface === VIDEO_SURFACE.HIGHLIGHT ? VIDEO_SURFACE.HIGHLIGHT : VIDEO_SURFACE.STORY;
    return {
      surface,
      supportsFullscreen: false,
      supportsLooping: false,
      setVolumeOnPlayback: true,
      controllerPosition: "absolute",
      findVideos,
      findControllerActivations(_root, videos) {
        return videos.flatMap((video) => {
          const parts = findStoryLayoutParts(video);
          return uniqueElements([
            ...parts.layers,
            ...parts.readMore,
            parts.bottomBar,
            parts.videoParent
          ]).map((target) => ({ target, video }));
        });
      },
      findControllerVideos(_root, selected) {
        return [selected];
      },
      locateControllerLayout(_root, video, event) {
        const parts = findStoryLayoutParts(video);
        return {
          overlay: findStoryOverlay(event),
          layers: parts.layers,
          hidden: uniqueElements([...parts.readMore, parts.bottomBar]),
          draggableLinks: [],
          restoreDraggableOnHide: false
        };
      },
      findMuteControls: findStoryMuteControls,
      isMuteControlMuted: isInstagramMuteControlMuted,
      findLoopAction() {
        return { button: null, reveal: [] };
      },
      findNavigationGuard() {
        return null;
      },
      onControllerVisibilityChange: options.onControllerVisibilityChange || null
    };
  }

  // src/controllers/video/video-volume-store.js
  var VIDEO_VOLUME_STORAGE_KEY = "G_VIDEO_VOLUME";
  var DEFAULT_VIDEO_VOLUME = 1;
  function readLegacyVideoVolume(storage, key = VIDEO_VOLUME_STORAGE_KEY, defaultValue = DEFAULT_VIDEO_VOLUME) {
    if (typeof storage?.getValue !== "function") {
      throw new TypeError("Video volume storage must expose getValue().");
    }
    const storedValue = storage.getValue(key);
    return storedValue ? storedValue : defaultValue;
  }
  var VideoVolumeStore = class {
    /**
     * @param {{getValue: (key: string) => *, setValue: (key: string, value: *) => *}} storage
     * @param {{key?: string, defaultValue?: *}} [options]
     */
    constructor(storage, options = {}) {
      if (typeof storage?.setValue !== "function") {
        throw new TypeError("Video volume storage must expose setValue().");
      }
      this.storage = storage;
      this.key = options.key || VIDEO_VOLUME_STORAGE_KEY;
      this.defaultValue = options.defaultValue ?? DEFAULT_VIDEO_VOLUME;
      this.value = readLegacyVideoVolume(
        storage,
        this.key,
        this.defaultValue
      );
    }
    /** @return {*} */
    get() {
      return this.value;
    }
    /**
     * @param {*} value
     * @return {*}
     */
    set(value) {
      this.value = value;
      this.storage.setValue(this.key, value);
      return value;
    }
  };

  // src/controllers/video/video-volume-slider-controller.js
  var VideoVolumeSliderController = class {
    /**
     * @param {Object} dependencies
     * @param {import("../../core/environment.js").UserscriptEnvironment} dependencies.environment
     * @param {{get: () => *, set: (value: *) => *}} dependencies.volume
     * @param {DisposableScope} [dependencies.scope]
     * @param {(...messages: *) => void} [dependencies.logger]
     */
    constructor({ environment: environment2, volume, scope, logger }) {
      if (typeof environment2?.getDocument !== "function") {
        throw new TypeError("VideoVolumeSliderController requires an environment.");
      }
      if (typeof volume?.get !== "function" || typeof volume?.set !== "function") {
        throw new TypeError(
          "VideoVolumeSliderController requires mutable volume state."
        );
      }
      this.document = environment2.getDocument();
      this.volume = volume;
      this.logger = logger || (() => {
      });
      this.scope = scope ? scope.child() : new DisposableScope(environment2);
      this.sliderRecords = /* @__PURE__ */ new WeakMap();
    }
    /** @return {boolean} */
    get disposed() {
      return this.scope.disposed;
    }
    /**
     * Preserve the legacy toggle contract: an existing descendant slider is
     * removed; otherwise one slider is appended to the supplied host.
     *
     * @param {VideoVolumeSliderMount} mount
     * @return {HTMLDivElement|null}
     */
    toggle({ host, resolveVideos, loggerType, customClass = "" }) {
      if (this.disposed) {
        throw new Error("A disposed VideoVolumeSliderController cannot be reused.");
      }
      if (!host || host.nodeType !== 1) return null;
      if (typeof resolveVideos !== "function") {
        throw new TypeError("A live video locator is required for the slider.");
      }
      const existing = host.querySelectorAll("div.volume_slider");
      if (existing.length > 0) {
        for (const slider2 of existing) {
          const record2 = this.sliderRecords.get(slider2);
          if (record2) record2.dispose();
          else slider2.remove();
        }
        return null;
      }
      const sliderScope = this.scope.child();
      const slider = this.document.createElement("div");
      slider.className = customClass ? `volume_slider ${customClass}` : "volume_slider";
      const wrapper = this.document.createElement("div");
      const input = this.document.createElement("input");
      input.type = "range";
      input.max = "1";
      input.min = "0";
      input.step = "0.05";
      const initialVolume = this.volume.get();
      input.setAttribute("value", initialVolume);
      input.value = initialVolume;
      setTrackProgress(input, initialVolume);
      wrapper.append(input);
      slider.append(wrapper);
      host.append(slider);
      const record = {
        dispose: () => sliderScope.dispose()
      };
      this.sliderRecords.set(slider, record);
      sliderScope.defer(() => {
        this.sliderRecords.delete(slider);
        slider.remove();
      });
      const applyVolumeToCurrentVideos = () => {
        for (const video of normalizeVideos(resolveVideos())) {
          this.logger(`(${loggerType})`, "video volume changed #slider");
          video.volume = this.volume.get();
        }
      };
      sliderScope.listen(input, "input", () => {
        this.volume.set(input.value);
        setTrackProgress(input, input.value);
        applyVolumeToCurrentVideos();
      });
      sliderScope.listen(input, "mouseenter", () => {
        input.value = this.volume.get();
        setTrackProgress(input, this.volume.get());
        applyVolumeToCurrentVideos();
      });
      sliderScope.listen(slider, "click", (event) => {
        event.stopPropagation();
        event.preventDefault();
      });
      return slider;
    }
    /** @return {*[]} */
    dispose() {
      return this.scope.dispose();
    }
  };
  function setTrackProgress(input, value) {
    input.setAttribute(
      "style",
      `--ig-track-progress: ${value * 100 + "%"}`
    );
  }
  function normalizeVideos(value) {
    if (value == null) return [];
    let candidates;
    if (typeof value.get === "function") candidates = value.get();
    else if (typeof value[Symbol.iterator] === "function") {
      candidates = Array.from(value);
    } else if (typeof value.length === "number") {
      candidates = Array.from(value);
    } else {
      candidates = [];
    }
    return candidates.filter(
      (candidate) => candidate?.nodeType === 1 && candidate.tagName === "VIDEO" && "volume" in candidate
    );
  }

  // src/services/download/batch.js
  var SAFARI_DOWNLOAD_BATCH_POLICY = Object.freeze({
    batchSize: 2,
    batchDelay: 700
  });
  var DEFAULT_DOWNLOAD_BATCH_POLICY = Object.freeze({
    batchSize: 5,
    batchDelay: 350
  });
  function getDownloadBatchPolicy(isSafari) {
    return isSafari ? SAFARI_DOWNLOAD_BATCH_POLICY : DEFAULT_DOWNLOAD_BATCH_POLICY;
  }
  async function runDownloadBatch(items, downloadItem, options = {}) {
    if (typeof downloadItem !== "function") {
      throw new TypeError("runDownloadBatch requires a download function.");
    }
    const source = items == null ? [] : Array.from(items);
    const policy = getDownloadBatchPolicy(options.isSafari === true);
    const batchSize = options.batchSize ?? policy.batchSize;
    const batchDelay = options.batchDelay ?? policy.batchDelay;
    const onProgress = options.onProgress || (() => {
    });
    const onError = options.onError || (() => {
    });
    const sleep = options.sleep || ((delay) => new Promise((resolve) => setTimeout(resolve, delay)));
    if (!Number.isInteger(batchSize) || batchSize < 1) {
      throw new TypeError("Download batch size must be a positive integer.");
    }
    if (!Number.isFinite(batchDelay) || batchDelay < 0) {
      throw new TypeError("Download batch delay must be a non-negative number.");
    }
    if (typeof onProgress !== "function" || typeof onError !== "function" || typeof sleep !== "function") {
      throw new TypeError("Download batch callbacks must be functions.");
    }
    const total = source.length;
    const failures = [];
    let completed = 0;
    if (total === 0) return { total, completed, failures };
    onProgress(0, total);
    for (let start = 0; start < total; start += batchSize) {
      const currentBatch = source.slice(start, start + batchSize);
      await Promise.all(
        currentBatch.map((item, offset) => {
          const index = start + offset;
          return Promise.resolve().then(() => downloadItem(item, index)).catch((error) => {
            const failure = { error, item, index };
            failures.push(failure);
            try {
              onError(error, item, index);
            } catch (_reportingError) {
            }
          }).finally(() => {
            completed += 1;
            onProgress(completed, total);
          });
        })
      );
      if (start + batchSize < total) {
        await sleep(batchDelay);
      }
    }
    return { total, completed, failures };
  }

  // src/services/download/filename.js
  var DEFAULT_RENAME_FORMAT2 = "%USERNAME%-%SOURCE_TYPE%-%SHORTCODE%-%YEAR%%MONTH%%DAY%_%HOUR%%MINUTE%%SECOND%_%ORIGINAL_NAME_FIRST%";
  function normalizeFilenameTimestamp(timestamp) {
    return parseInt(timestamp.toString().padEnd(13, "0"));
  }
  function getOriginalMediaName(downloadUrl) {
    return new URL(downloadUrl).pathname.split("/").at(-1).split(".").slice(0, -1).join(".");
  }
  function createFilenameTokens(downloadUrl, metadata) {
    let {
      username,
      sourceType,
      timestamp,
      shortcode,
      index,
      uid
    } = metadata;
    timestamp = normalizeFilenameTimestamp(timestamp);
    index = index != null ? index : 0;
    const date = new Date(timestamp);
    const originalName = getOriginalMediaName(downloadUrl);
    const year = date.getFullYear().toString();
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    const day = date.getDate().toString().padStart(2, "0");
    const hour = date.getHours().toString().padStart(2, "0");
    const minute = date.getMinutes().toString().padStart(2, "0");
    const second = date.getSeconds().toString().padStart(2, "0");
    return {
      "%USERNAME%": username,
      "%SOURCE_TYPE%": sourceType,
      "%SHORTCODE%": shortcode || "",
      "%YEAR%": year,
      "%2-YEAR%": year.substr(-2),
      "%MONTH%": month,
      "%DAY%": day,
      "%HOUR%": hour,
      "%MINUTE%": minute,
      "%SECOND%": second,
      "%ORIGINAL_NAME%": originalName,
      "%ORIGINAL_NAME_FIRST%": originalName.split("_").at(0),
      "%INDEX%": index.toString(),
      "%UID%": uid || ""
    };
  }
  function formatFilenameTemplate(template, tokens) {
    let filename = template.replace(/%([^%]+)%/g, (_match, content) => {
      return `%${content.toUpperCase()}%`;
    });
    filename = filename.replace(/%[\w-]+%/g, (token) => {
      if (tokens[token] == null) return token;
      return String(tokens[token]);
    });
    return filename;
  }
  function createDownloadFilename(downloadUrl, metadata, options = {}) {
    const autoRename = options.autoRename ?? true;
    const renameFormat = options.renameFormat ?? DEFAULT_RENAME_FORMAT2;
    const tokens = createFilenameTokens(downloadUrl, metadata);
    const filename = formatFilenameTemplate(renameFormat, tokens);
    const originalName = tokens["%ORIGINAL_NAME%"];
    const originalFilename = `${metadata.username}_${originalName}.${metadata.filetype}`;
    return autoRename ? `${filename}.${metadata.filetype}` : originalFilename;
  }

  // src/services/download/transport.js
  var DEFAULT_OBJECT_URL_REVOKE_DELAY = 6e4;
  var DEFAULT_GM_OBJECT_URL_TIMEOUT = 3e4;
  var DEFAULT_ANCHOR_SETTLE_DELAY = 125;
  function createAbortError() {
    const error = new Error("Download operation was aborted.");
    error.name = "AbortError";
    return error;
  }
  function throwIfAborted(signal) {
    if (signal?.aborted) throw createAbortError();
  }
  function isAbort(error, signal) {
    return signal?.aborted === true || error?.name === "AbortError";
  }
  function listenForAbort(signal, callback) {
    if (!signal) return () => {
    };
    if (typeof signal.addEventListener !== "function" || typeof signal.removeEventListener !== "function") {
      throw new TypeError("Download operation signal must be an AbortSignal.");
    }
    if (signal.aborted) {
      callback();
      return () => {
      };
    }
    signal.addEventListener("abort", callback, { once: true });
    return () => signal.removeEventListener("abort", callback);
  }
  function abortTask(task) {
    try {
      task?.abort?.();
    } catch (_abortError) {
    }
  }
  function getDownloadErrorMessage(error) {
    return error?.error || error?.message || error?.details || String(error);
  }
  function toError(error, fallbackMessage) {
    if (error instanceof Error) return error;
    return new Error(getDownloadErrorMessage(error) || fallbackMessage);
  }
  var DownloadTransport = class {
    /**
     * @param {DownloadTransportDependencies} dependencies
     * @param {DownloadTransportOptions} [options]
     */
    constructor(dependencies, options = {}) {
      if (dependencies === null || typeof dependencies !== "object") {
        throw new TypeError("DownloadTransport requires injected dependencies.");
      }
      for (const timer of ["setTimeout", "clearTimeout"]) {
        if (typeof dependencies[timer] !== "function") {
          throw new TypeError(`DownloadTransport requires ${timer}().`);
        }
      }
      for (const name of [
        "gmDownload",
        "fetch",
        "gmRequest",
        "onFallback"
      ]) {
        if (dependencies[name] != null && typeof dependencies[name] !== "function") {
          throw new TypeError(`DownloadTransport ${name} must be a function.`);
        }
      }
      this.dependencies = Object.freeze({ ...dependencies });
      this.options = Object.freeze({
        objectUrlRevokeDelay: options.objectUrlRevokeDelay ?? DEFAULT_OBJECT_URL_REVOKE_DELAY,
        gmObjectUrlTimeout: options.gmObjectUrlTimeout ?? DEFAULT_GM_OBJECT_URL_TIMEOUT,
        directGmTimeout: options.directGmTimeout ?? 0,
        anchorSettleDelay: options.anchorSettleDelay ?? DEFAULT_ANCHOR_SETTLE_DELAY
      });
    }
    /** @returns {boolean} */
    isGmDownloadAvailable() {
      return typeof this.dependencies.gmDownload === "function";
    }
    /**
     * Wrap callback-based GM_download with single-settlement and optional abort.
     *
     * @param {string} url
     * @param {string} filename
     * @param {{timeout?: number, signal?: AbortSignal}} [options]
     * @returns {Promise<true>}
     */
    downloadWithGm(url, filename, options = {}) {
      return new Promise((resolve, reject) => {
        const signal = options.signal;
        if (signal?.aborted) {
          reject(createAbortError());
          return;
        }
        if (!this.isGmDownloadAvailable()) {
          reject(new Error("GM_download is not available."));
          return;
        }
        let settled = false;
        let timeoutId = null;
        let downloadTask = null;
        let releaseAbort = () => {
        };
        const settle = (handler, value) => {
          if (settled) return;
          settled = true;
          releaseAbort();
          if (timeoutId != null) {
            this.dependencies.clearTimeout(timeoutId);
            timeoutId = null;
          }
          handler(value);
        };
        const rejectCallback = (error) => {
          settle(
            reject,
            signal?.aborted ? createAbortError() : new Error(getDownloadErrorMessage(error))
          );
        };
        const abortDownload = () => {
          abortTask(downloadTask);
          settle(reject, createAbortError());
        };
        try {
          releaseAbort = listenForAbort(signal, abortDownload);
          if (settled) return;
          downloadTask = this.dependencies.gmDownload({
            url,
            name: filename,
            saveAs: false,
            onload: () => settle(resolve, true),
            onerror: rejectCallback,
            ontimeout: rejectCallback
          });
          if (signal?.aborted) {
            abortTask(downloadTask);
            settle(reject, createAbortError());
            return;
          }
          const timeout = Number(options.timeout);
          if (!settled && Number.isFinite(timeout) && timeout > 0) {
            timeoutId = this.dependencies.setTimeout(() => {
              abortTask(downloadTask);
              settle(reject, new Error("GM_download timed out."));
            }, timeout);
          }
        } catch (error) {
          settle(reject, error);
        }
      });
    }
    /**
     * @param {string} url
     * @param {DownloadOperationOptions} [options]
     * @returns {Promise<Blob>}
     */
    fetchBlobWithGm(url, options = {}) {
      if (typeof this.dependencies.gmRequest !== "function") {
        return Promise.reject(new Error("GM_xmlhttpRequest is not available."));
      }
      return new Promise((resolve, reject) => {
        const signal = options.signal;
        if (signal?.aborted) {
          reject(createAbortError());
          return;
        }
        let requestTask = null;
        let settled = false;
        let releaseAbort = () => {
        };
        const settle = (handler, value) => {
          if (settled) return;
          settled = true;
          releaseAbort();
          handler(value);
        };
        const rejectRequest = (error, fallbackMessage) => {
          settle(
            reject,
            signal?.aborted ? createAbortError() : toError(error, fallbackMessage)
          );
        };
        const abortRequest = () => {
          abortTask(requestTask);
          settle(reject, createAbortError());
        };
        try {
          releaseAbort = listenForAbort(signal, abortRequest);
          if (settled) return;
          requestTask = this.dependencies.gmRequest({
            method: "GET",
            url,
            responseType: "blob",
            onload: (response) => {
              if (response?.status >= 200 && response.status < 300 && response.response) {
                settle(resolve, response.response);
              } else {
                settle(
                  reject,
                  new Error(`HTTP ${response?.status || "unknown"}`)
                );
              }
            },
            onerror: (error) => rejectRequest(error, "GM request failed."),
            ontimeout: (error) => rejectRequest(error, "GM request timed out."),
            onabort: () => settle(reject, createAbortError())
          });
          if (signal?.aborted) {
            abortTask(requestTask);
            settle(reject, createAbortError());
          }
        } catch (error) {
          settle(reject, error);
        }
      });
    }
    /**
     * Fetch with same-session credentials, then fail open to GM request access.
     *
     * @param {string} url
     * @param {DownloadOperationOptions} [options]
     * @returns {Promise<Blob>}
     */
    async fetchMediaBlob(url, options = {}) {
      const signal = options.signal;
      throwIfAborted(signal);
      try {
        if (typeof this.dependencies.fetch !== "function") {
          throw new Error("fetch is not available.");
        }
        const response = await this.dependencies.fetch(url, {
          credentials: "include",
          ...signal ? { signal } : {}
        });
        throwIfAborted(signal);
        if (!response?.ok) throw new Error(`HTTP ${response?.status}`);
        const blob = await response.blob();
        throwIfAborted(signal);
        return blob;
      } catch (error) {
        if (isAbort(error, signal)) throw createAbortError();
        await this._reportFallback(error, "credentialed-fetch", "gm-request");
        throwIfAborted(signal);
        return await this.fetchBlobWithGm(url, { signal });
      }
    }
    /**
     * @param {string} url
     * @param {string} filename
     * @param {DownloadOperationOptions} [options]
     * @returns {Promise<true>}
     */
    triggerAnchorDownload(url, filename, options = {}) {
      return new Promise((resolve, reject) => {
        const signal = options.signal;
        if (signal?.aborted) {
          reject(createAbortError());
          return;
        }
        let link = null;
        let settleTimer = null;
        let settled = false;
        let releaseAbort = () => {
        };
        const removeLink = () => {
          link?.remove?.();
          link = null;
        };
        const settle = (handler, value) => {
          if (settled) return;
          settled = true;
          releaseAbort();
          if (settleTimer != null) {
            this.dependencies.clearTimeout(settleTimer);
            settleTimer = null;
          }
          removeLink();
          handler(value);
        };
        try {
          releaseAbort = listenForAbort(
            signal,
            () => settle(reject, createAbortError())
          );
          if (settled) return;
          const document2 = this.dependencies.document;
          if (typeof document2?.createElement !== "function" || !document2.body) {
            throw new Error("Anchor download requires a document body.");
          }
          link = document2.createElement("a");
          link.href = url;
          link.download = filename;
          link.style.display = "none";
          document2.body.appendChild(link);
          link.click();
          removeLink();
          settleTimer = this.dependencies.setTimeout(
            () => settle(resolve, true),
            this.options.anchorSettleDelay
          );
        } catch (error) {
          settle(reject, error);
        }
      });
    }
    /**
     * @param {Blob} blob
     * @param {string} filename
     * @param {DownloadOperationOptions} [options]
     * @returns {Promise<true>}
     */
    async downloadBlob(blob, filename, options = {}) {
      const signal = options.signal;
      throwIfAborted(signal);
      const urlApi = this.dependencies.urlApi;
      if (typeof urlApi?.createObjectURL !== "function" || typeof urlApi?.revokeObjectURL !== "function") {
        throw new Error("Blob download requires createObjectURL and revokeObjectURL.");
      }
      const objectUrl = urlApi.createObjectURL(blob);
      let revoked = false;
      const revoke = () => {
        if (revoked) return;
        revoked = true;
        urlApi.revokeObjectURL(objectUrl);
      };
      try {
        if (this.isGmDownloadAvailable()) {
          try {
            await this.downloadWithGm(objectUrl, filename, {
              timeout: this.options.gmObjectUrlTimeout,
              signal
            });
            revoke();
            return true;
          } catch (error) {
            if (isAbort(error, signal)) throw createAbortError();
            await this._reportFallback(error, "gm-blob-download", "anchor");
            throwIfAborted(signal);
          }
        }
        await this.triggerAnchorDownload(objectUrl, filename, { signal });
        this._scheduleObjectUrlRevocation(revoke, signal);
        return true;
      } catch (error) {
        revoke();
        throw error;
      }
    }
    /**
     * Prefer a direct GM download. Any unavailable or failed GM path falls back
     * through credentialed fetch, GM request, Blob URL, and finally an anchor.
     *
     * @param {string} url
     * @param {string} filename
     * @param {DownloadOperationOptions} [options]
     * @returns {Promise<true>}
     */
    async downloadUrl(url, filename, options = {}) {
      if (typeof url !== "string" || url.length === 0) {
        throw new TypeError("downloadUrl requires a non-empty URL.");
      }
      if (typeof filename !== "string" || filename.length === 0) {
        throw new TypeError("downloadUrl requires a non-empty filename.");
      }
      const signal = options.signal;
      throwIfAborted(signal);
      if (this.isGmDownloadAvailable()) {
        try {
          await this.downloadWithGm(url, filename, {
            timeout: this.options.directGmTimeout,
            signal
          });
          return true;
        } catch (error) {
          if (isAbort(error, signal)) throw createAbortError();
          await this._reportFallback(error, "gm-direct-download", "blob");
          throwIfAborted(signal);
        }
      }
      const blob = await this.fetchMediaBlob(url, { signal });
      return await this.downloadBlob(blob, filename, { signal });
    }
    /**
     * Preserve the legacy 60-second object URL lifetime while allowing route
     * teardown to revoke it early and clear the pending timer.
     *
     * @param {() => void} revoke
     * @param {AbortSignal|undefined} signal
     * @returns {void}
     * @private
     */
    _scheduleObjectUrlRevocation(revoke, signal) {
      let timerId = null;
      let finished = false;
      let releaseAbort = () => {
      };
      const finish = (clearTimer) => {
        if (finished) return;
        finished = true;
        releaseAbort();
        if (clearTimer && timerId != null) {
          this.dependencies.clearTimeout(timerId);
        }
        timerId = null;
        revoke();
      };
      releaseAbort = listenForAbort(signal, () => finish(true));
      if (finished) return;
      try {
        timerId = this.dependencies.setTimeout(
          () => finish(false),
          this.options.objectUrlRevokeDelay
        );
      } catch (error) {
        finish(false);
        throw error;
      }
    }
    /**
     * @param {*} error
     * @param {string} stage
     * @param {string | null} fallback
     * @returns {Promise<void>}
     * @private
     */
    async _reportFallback(error, stage, fallback) {
      if (typeof this.dependencies.onFallback !== "function") return;
      try {
        await this.dependencies.onFallback(error, { stage, fallback });
      } catch (_reportingError) {
      }
    }
  };

  // src/services/image-cache/constants.js
  var IMAGE_CACHE_KEY = "URLS_OF_IMAGES_TEMPORARILY_STORED";
  var IMAGE_CACHE_MAX_AGE = 12 * 60 * 60 * 1e3;
  var IMAGE_CACHE_MAX_ITEMS = 300;
  var IMAGE_CACHE_PERSIST_DELAY = 500;

  // src/services/image-cache/image-cache.js
  function decodeImageCacheMediaId(url, decodeBase64) {
    try {
      const parsed = new URL(url);
      const key = parsed.searchParams.get("ig_cache_key");
      if (!key) return null;
      return decodeBase64(key.split(".")[0]);
    } catch (_error) {
      return null;
    }
  }
  var ImageCache = class {
    /**
     * @param {ImageCacheDependencies} dependencies
     * @param {ImageCacheOptions} [options]
     */
    constructor(dependencies, options = {}) {
      if (dependencies === null || typeof dependencies !== "object") {
        throw new TypeError("ImageCache requires injected dependencies.");
      }
      for (const name of [
        "getValue",
        "setValue",
        "now",
        "setTimeout",
        "clearTimeout",
        "decodeBase64"
      ]) {
        if (typeof dependencies[name] !== "function") {
          throw new TypeError(`ImageCache requires ${name}().`);
        }
      }
      this.dependencies = Object.freeze({ ...dependencies });
      this.storageKey = options.storageKey ?? IMAGE_CACHE_KEY;
      this.maxAge = options.maxAge ?? IMAGE_CACHE_MAX_AGE;
      this.maxItems = options.maxItems ?? IMAGE_CACHE_MAX_ITEMS;
      this.persistDelay = options.persistDelay ?? IMAGE_CACHE_PERSIST_DELAY;
      this.entries = dependencies.getValue(this.storageKey, {});
      this._dirty = false;
      this._saveTimer = null;
    }
    /**
     * Decode an Instagram resource URL with this cache's Base64 adapter.
     *
     * @param {string} url
     * @returns {string | null}
     */
    decodeMediaId(url) {
      return decodeImageCacheMediaId(url, this.dependencies.decodeBase64);
    }
    /**
     * Test raw cache membership without applying lazy expiry. Performance
     * capture intentionally uses this behavior to match the legacy guard.
     *
     * @param {string} mediaId
     * @returns {boolean}
     */
    has(mediaId) {
      return Boolean(mediaId && this.entries[mediaId]);
    }
    /**
     * Remove entries strictly older than the twelve-hour boundary and persist
     * the complete object immediately, even when no entry changed.
     *
     * @returns {number}
     */
    purge() {
      const currentTime = this.dependencies.now();
      let removed = 0;
      for (const mediaId in this.entries) {
        if (currentTime - this.entries[mediaId].ts > this.maxAge) {
          delete this.entries[mediaId];
          removed += 1;
        }
      }
      this.dependencies.setValue(this.storageKey, this.entries);
      return removed;
    }
    /**
     * Insert or update one resource. At capacity, the oldest entry is evicted
     * before assignment, including when the incoming ID already exists.
     *
     * @param {string} mediaId
     * @param {string} url
     * @returns {boolean}
     */
    put(mediaId, url) {
      if (!mediaId) return false;
      const keys = Object.keys(this.entries);
      if (keys.length >= this.maxItems) {
        keys.sort((left, right) => {
          return this.entries[left].ts - this.entries[right].ts;
        });
        delete this.entries[keys[0]];
      }
      this._dirty = true;
      this.entries[mediaId] = {
        url,
        ts: this.dependencies.now()
      };
      this._schedulePersistence();
      return true;
    }
    /**
     * Read an entry and lazily remove it when strictly older than max age. Lazy
     * expiry remains memory-only and does not schedule a storage write.
     *
     * @param {string} mediaId
     * @returns {string | null}
     */
    get(mediaId) {
      if (!mediaId) return null;
      const entry = this.entries[mediaId];
      if (!entry) return null;
      if (this.dependencies.now() - entry.ts > this.maxAge) {
        delete this.entries[mediaId];
        return null;
      }
      return entry.url;
    }
    /**
     * Persist a dirty cache immediately. This is exposed for controlled teardown
     * and tests; ordinary writes continue to use the 500 ms coalescing window.
     *
     * @returns {boolean}
     */
    flush() {
      if (this._saveTimer != null) {
        this.dependencies.clearTimeout(this._saveTimer);
        this._saveTimer = null;
      }
      if (!this._dirty) return false;
      this.dependencies.setValue(this.storageKey, this.entries);
      this._dirty = false;
      return true;
    }
    /** @private */
    _schedulePersistence() {
      if (this._saveTimer != null) return;
      this._saveTimer = this.dependencies.setTimeout(() => {
        if (this._dirty) {
          this.dependencies.setValue(this.storageKey, this.entries);
          this._dirty = false;
        }
        this._saveTimer = null;
      }, this.persistDelay);
    }
  };

  // src/services/image-cache/performance-observer.js
  function isCacheableImageResourceUrl(url) {
    if (typeof url !== "string") return false;
    return (url.includes("_e35") || url.includes("_e15") || url.includes(".webp?")) && !url.includes("_e35_s") && !/_[sp](\d+)x\1(?!\d)/.test(url);
  }
  function isCacheableImagePerformanceEntry(entry) {
    return entry?.initiatorType === "img" && isCacheableImageResourceUrl(entry.name);
  }
  function registerImageCachePerformanceObserver({
    PerformanceObserver,
    cache,
    enabled,
    onError
  }) {
    if (typeof PerformanceObserver !== "function") return null;
    if (Array.isArray(PerformanceObserver.supportedEntryTypes) && !PerformanceObserver.supportedEntryTypes.includes("resource")) {
      return null;
    }
    const observer = new PerformanceObserver((list) => {
      if (!enabled()) return;
      list.getEntries().forEach((entry) => {
        if (!isCacheableImagePerformanceEntry(entry)) return;
        const mediaId = cache.decodeMediaId(entry.name);
        if (mediaId && !cache.has(mediaId)) {
          cache.put(mediaId, entry.name);
        }
      });
    });
    try {
      observer.observe({ entryTypes: ["resource"] });
    } catch (error) {
      onError?.(error);
    }
    return observer;
  }

  // src/services/update-check/update-check-service.js
  var UPDATE_CHECK_REMOTE_SCRIPT_URL = "https://raw.githubusercontent.com/paytonison/insta-loader/main/insta-loader.user.js";
  var UPDATE_NOTIFICATION_IMAGE_URL = "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a5/Instagram_icon.png/64px-Instagram_icon.png";
  var UPDATE_VERSION_PATTERN = /\/\/\s+@version\s+([0-9.\-a-zA-Z]+)/i;
  var UpdateCheckService = class {
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
      environment: environment2,
      preferencesStore: preferencesStore2,
      requestText: requestText2,
      translator,
      logger,
      getApplicationScope
    }) {
      if (typeof environment2?.now !== "function" || typeof environment2?.notify !== "function" || typeof environment2?.openInTab !== "function" || typeof environment2?.setTimeout !== "function") {
        throw new TypeError(
          "UpdateCheckService requires a complete userscript environment."
        );
      }
      if (typeof preferencesStore2?.getCheckTimestamp !== "function" || typeof preferencesStore2?.setCheckTimestamp !== "function") {
        throw new TypeError(
          "UpdateCheckService requires update timestamp preferences."
        );
      }
      if (typeof requestText2 !== "function" || typeof translator !== "function" || typeof logger !== "function") {
        throw new TypeError(
          "UpdateCheckService requires request, translation, and logging functions."
        );
      }
      if (getApplicationScope != null && typeof getApplicationScope !== "function") {
        throw new TypeError(
          "UpdateCheckService getApplicationScope must be a function."
        );
      }
      this.environment = environment2;
      this.preferencesStore = preferencesStore2;
      this.requestText = requestText2;
      this.translator = translator;
      this.logger = logger;
      this.getApplicationScope = getApplicationScope || null;
      this.scope = null;
      this.releaseScope = null;
      this.pendingRequests = /* @__PURE__ */ new Set();
    }
    /**
     * Attach future requests and notification timers to the current application
     * scope. Rebinding aborts work still owned by the previous application.
     *
     * @param {UpdateCheckScope} scope
     * @return {void}
     */
    mount(scope) {
      if (!scope || typeof scope.defer !== "function" || typeof scope.trackAbortable !== "function" || typeof scope.setTimeout !== "function") {
        throw new TypeError(
          "UpdateCheckService.mount() requires a disposable application scope."
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
      if (nowTime > parseInt(checkTimestamp) + intervalSeconds * 1e3) {
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
          url: UPDATE_CHECK_REMOTE_SCRIPT_URL
        });
      } catch (error) {
        this.logRequestFailure(error);
        return Promise.resolve();
      }
      this.pendingRequests.add(request);
      if (this.scope && typeof request?.abort === "function") {
        this.scope.trackAbortable(request);
      }
      return Promise.resolve(request).then((remoteScript) => {
        const match = remoteScript.match(UPDATE_VERSION_PATTERN);
        if (match && match[1]) {
          const remoteVersion = match[1];
          this.logger(
            "Current version: ",
            currentVersion,
            "|",
            "Remote version: ",
            remoteVersion
          );
          if (remoteVersion !== currentVersion) {
            this.environment.notify({
              text: this.translator("NOTICE_UPDATE_CONTENT"),
              title: this.translator("NOTICE_UPDATE_TITLE"),
              tag: "insta_loader_notice",
              highlight: true,
              timeout: 5e3,
              zombieTimeout: 5e3,
              image: UPDATE_NOTIFICATION_IMAGE_URL,
              onclick: (event) => {
                event?.preventDefault();
                const tab = this.environment.openInTab(
                  this.environment.scriptInfo.script.downloadURL
                );
                this.schedule(() => {
                  tab.close();
                }, 250);
              }
            });
          } else {
            this.logger("there is no new update");
          }
        } else {
          this.environment.window?.console?.error?.(
            "Could not find version in the remote script."
          );
        }
      }).catch((error) => {
        this.logRequestFailure(error);
      }).finally(() => {
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
      if (currentScope && !currentScope.disposed && currentScope !== this.scope) {
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
  };

  // src/legacy/runtime.js
  var LEGACY_JSON_REQUEST_TIMEOUT_MS = 15e3;
  var SAFARI_REQUEST_POLICY_VIOLATION_PATTERN = /(?:secfetch policy violation|resource isolation policy violated)/i;
  var STORY_SURFACE_ACTION_FAILURE_MESSAGE = "Could not complete this Story or Highlight action. Try again; details are available in Debug Window.";
  function startLegacyUserscript($, Mediabunny2, dependencies) {
    "use strict";
    const {
      environment: environment2,
      preferences: preferences2,
      preferencesStore: preferencesStore2,
      settingsStore: settingsStore2,
      resources,
      localization,
      media,
      jsonRequest: startJsonRequest,
      textRequest: startTextRequest
    } = dependencies;
    let activeApplicationScope = null;
    let activeLegacyRouteKind = null;
    let activeLegacyRouteScope = null;
    let activeStorySurfaceAction = null;
    const pendingApplicationRequests = /* @__PURE__ */ new Set();
    const downloadAbortControllerByScope = /* @__PURE__ */ new WeakMap();
    function ownApplicationRequest(request) {
      if (activeApplicationScope) {
        activeApplicationScope.trackAbortable(request);
      } else {
        pendingApplicationRequests.add(request);
      }
      Promise.resolve(request).then(
        () => pendingApplicationRequests.delete(request),
        () => pendingApplicationRequests.delete(request)
      );
      return request;
    }
    function jsonRequest(options) {
      const requestOptions = {
        timeout: LEGACY_JSON_REQUEST_TIMEOUT_MS,
        ...options
      };
      const requestScope = activeLegacyRouteScope;
      const request = startJsonRequest(requestOptions);
      if (requestScope) {
        requestScope.trackAbortable(request);
      }
      if (!isStorySurfaceInstagramRequest(requestOptions.url)) return request;
      return request.catch((error) => {
        if (!isSafariRequestPolicyViolation(error)) throw error;
        if (requestScope?.disposed) {
          throw new RequestError(
            REQUEST_ERROR_CATEGORY.ABORT,
            "The request was cancelled.",
            { cause: error, url: requestOptions.url }
          );
        }
        logger(
          "jsonRequest()",
          "Safari policy rejected the privileged request; retrying in page context.",
          requestOptions.url
        );
        return pageJsonRequest(requestOptions, requestScope);
      });
    }
    function isStorySurfaceInstagramRequest(url) {
      if (!IS_SAFARI || ![ROUTE_KIND.STORY, ROUTE_KIND.HIGHLIGHT].includes(activeLegacyRouteKind)) {
        return false;
      }
      try {
        const hostname = new URL(url).hostname;
        return hostname === "www.instagram.com" || hostname === "i.instagram.com";
      } catch (_error) {
        return false;
      }
    }
    function isSafariRequestPolicyViolation(error) {
      if (error?.category !== REQUEST_ERROR_CATEGORY.HTTP || Number(error?.status) !== 400) {
        return false;
      }
      const body = error?.response?.responseText ?? error?.response?.response ?? "";
      return SAFARI_REQUEST_POLICY_VIOLATION_PATTERN.test(String(body));
    }
    function createPageRequestHeaders(headers) {
      return Object.fromEntries(
        Object.entries(headers || {}).filter(
          ([name]) => name.toLowerCase() !== "user-agent"
        )
      );
    }
    function findPageRequestApiError(data, url, status, response) {
      let message = "";
      let details = null;
      if (Array.isArray(data?.errors) && data.errors.length > 0) {
        details = data.errors;
        message = data.errors.map(
          (error) => [error?.message, error?.description, error?.code].filter(Boolean).join(" ")
        ).join(" ");
      } else if (data?.status === "fail") {
        details = data;
        message = [data.message, data.feedback_message].filter(Boolean).join(": ");
      } else {
        return null;
      }
      const rateLimited = /rate|limit|throttl|please wait|try again later/i.test(message);
      return new RequestError(
        rateLimited ? REQUEST_ERROR_CATEGORY.RATE_LIMIT : REQUEST_ERROR_CATEGORY.API,
        message || "The server rejected the API request.",
        { details, status, url, response }
      );
    }
    function pageJsonRequest(options, scope) {
      if (scope?.disposed) {
        throw new RequestError(
          REQUEST_ERROR_CATEGORY.ABORT,
          "The request was cancelled.",
          { url: options.url }
        );
      }
      const fetchImpl = environment2.window.fetch?.bind(environment2.window);
      if (typeof fetchImpl !== "function") {
        throw new RequestError(
          REQUEST_ERROR_CATEGORY.NETWORK,
          "The page request fallback is unavailable.",
          { url: options.url }
        );
      }
      const AbortControllerConstructor = environment2.window.AbortController;
      const controller = typeof AbortControllerConstructor === "function" ? new AbortControllerConstructor() : null;
      let cancelRequest;
      let settled = false;
      let timeoutId = null;
      let removeSignalListener = () => {
      };
      const cancellation = new Promise((_resolve, reject) => {
        cancelRequest = reject;
      });
      const rejectCancellation = (error) => {
        if (settled) return;
        cancelRequest(error);
        try {
          controller?.abort();
        } catch (_error) {
        }
      };
      const abort = () => rejectCancellation(
        new RequestError(
          REQUEST_ERROR_CATEGORY.ABORT,
          "The request was cancelled.",
          { url: options.url }
        )
      );
      if (options.signal?.aborted) {
        abort();
      } else if (options.signal) {
        options.signal.addEventListener("abort", abort, { once: true });
        removeSignalListener = () => options.signal.removeEventListener("abort", abort);
      }
      const timeout = Number(options.timeout);
      if (Number.isFinite(timeout) && timeout > 0) {
        timeoutId = setTimeout2(() => {
          rejectCancellation(
            new RequestError(
              REQUEST_ERROR_CATEGORY.TIMEOUT,
              "The request timed out.",
              { url: options.url }
            )
          );
        }, Math.floor(timeout));
      }
      const fetchRequest = Promise.resolve().then(
        () => fetchImpl(options.url, {
          method: options.method || "GET",
          headers: createPageRequestHeaders(options.headers),
          body: options.data,
          credentials: "include",
          signal: controller?.signal
        })
      ).then(async (response) => {
        const status = Number(response?.status) || 200;
        const finalUrl = String(response?.url || options.url);
        const responseText = await response.text();
        const responseRecord = {
          finalUrl,
          response: responseText,
          responseText,
          status
        };
        if (status === 429) {
          throw new RequestError(
            REQUEST_ERROR_CATEGORY.RATE_LIMIT,
            "The server rate-limited the request.",
            { status, url: options.url, response: responseRecord }
          );
        }
        if (status < 200 || status >= 300) {
          throw new RequestError(
            REQUEST_ERROR_CATEGORY.HTTP,
            `The request returned HTTP ${status}.`,
            { status, url: options.url, response: responseRecord }
          );
        }
        if (/\/(accounts\/login|challenge|checkpoint)\b/i.test(finalUrl)) {
          throw new RequestError(
            REQUEST_ERROR_CATEGORY.LOGIN,
            "The request was redirected to a login or checkpoint page.",
            { status, url: finalUrl, response: responseRecord }
          );
        }
        if (/^\s*</.test(responseText)) {
          throw new RequestError(
            REQUEST_ERROR_CATEGORY.PARSE,
            "The server returned HTML instead of JSON.",
            { status, url: options.url, response: responseRecord }
          );
        }
        let data;
        try {
          data = JSON.parse(responseText);
        } catch (error) {
          throw new RequestError(
            REQUEST_ERROR_CATEGORY.PARSE,
            "The response could not be parsed as JSON.",
            {
              cause: error,
              status,
              url: options.url,
              response: responseRecord
            }
          );
        }
        if (options.detectApiErrors !== false) {
          const apiError = findPageRequestApiError(
            data,
            options.url,
            status,
            responseRecord
          );
          if (apiError) throw apiError;
        }
        if (options.validate) {
          let valid;
          try {
            valid = options.validate(data, responseRecord);
          } catch (error) {
            if (error instanceof RequestError) throw error;
            throw new RequestError(
              REQUEST_ERROR_CATEGORY.API,
              error?.message || "The response failed API validation.",
              {
                cause: error,
                status,
                url: options.url,
                response: responseRecord
              }
            );
          }
          if (valid === false) {
            throw new RequestError(
              REQUEST_ERROR_CATEGORY.API,
              "The response failed API validation.",
              { status, url: options.url, response: responseRecord }
            );
          }
        }
        if (!options.transform) return data;
        try {
          return options.transform(data, responseRecord);
        } catch (error) {
          if (error instanceof RequestError) throw error;
          throw new RequestError(
            REQUEST_ERROR_CATEGORY.PARSE,
            error?.message || "The JSON response could not be processed.",
            {
              cause: error,
              status,
              url: options.url,
              response: responseRecord
            }
          );
        }
      }).catch((error) => {
        if (error instanceof RequestError) throw error;
        if (controller?.signal.aborted) {
          throw new RequestError(
            REQUEST_ERROR_CATEGORY.ABORT,
            "The request was cancelled.",
            { cause: error, url: options.url }
          );
        }
        throw new RequestError(
          REQUEST_ERROR_CATEGORY.NETWORK,
          error?.message || "The network request failed.",
          { cause: error, url: options.url }
        );
      });
      const promise = Promise.race([fetchRequest, cancellation]).finally(() => {
        settled = true;
        removeSignalListener();
        if (timeoutId != null) clearTimeout(timeoutId);
      });
      const request = {
        promise,
        abort,
        then: promise.then.bind(promise),
        catch: promise.catch.bind(promise),
        finally: promise.finally.bind(promise)
      };
      if (scope && !scope.disposed) scope.trackAbortable(request);
      return request;
    }
    const {
      addStyle: GM_addStyle,
      clearInterval,
      clearTimeout,
      download: GM_download,
      notify: GM_notification,
      now,
      openInTab: GM_openInTab,
      queueMicrotask,
      request: GM_xmlhttpRequest,
      requestAnimationFrame,
      scriptInfo: GM_info,
      setInterval,
      setTimeout: setTimeout2
    } = environment2;
    function createDownloadOperationOptions() {
      const scope = activeLegacyRouteScope && !activeLegacyRouteScope.disposed ? activeLegacyRouteScope : activeApplicationScope && !activeApplicationScope.disposed ? activeApplicationScope : null;
      const AbortControllerConstructor = environment2.window.AbortController;
      if (!scope || typeof AbortControllerConstructor !== "function") return {};
      let controller = downloadAbortControllerByScope.get(scope);
      if (!controller) {
        controller = new AbortControllerConstructor();
        downloadAbortControllerByScope.set(scope, controller);
        scope.defer(() => downloadAbortControllerByScope.delete(scope));
        scope.trackAbortable(controller);
      }
      return { signal: controller.signal };
    }
    const SCRIPT_NAME = "insta-loader";
    const IS_SAFARI = /^((?!chrome|android|crios|fxios|edgios).)*safari/i.test(
      navigator.userAgent
    );
    const ENABLE_CONSOLE_LOGGING = false;
    const USER_SETTING = settingsStore2.snapshot();
    const imageCache = new ImageCache(
      {
        getValue: (_key, fallback) => preferencesStore2.getImageCache(fallback),
        setValue: (_key, value) => preferencesStore2.setImageCache(value),
        now,
        setTimeout: setTimeout2,
        clearTimeout,
        decodeBase64: (value) => atob(value)
      },
      {
        storageKey: IMAGE_CACHE_KEY,
        maxAge: IMAGE_CACHE_MAX_AGE,
        maxItems: IMAGE_CACHE_MAX_ITEMS,
        persistDelay: IMAGE_CACHE_PERSIST_DELAY
      }
    );
    const MEDIA_LIST_SELECTOR = ".IG_POPUP_DIG .IG_POPUP_DIG_MAIN .IG_POPUP_DIG_BODY";
    const SVG = {
      DOWNLOAD: '<svg aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3.75v10.5"/><path d="m8.25 10.5 3.75 3.75 3.75-3.75"/><path d="M5.25 16.75v1.5c0 .97.78 1.75 1.75 1.75h10c.97 0 1.75-.78 1.75-1.75v-1.5"/></svg>',
      NEW_TAB: '<svg aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M13.5 4.75h5.75v5.75"/><path d="m19 5-8 8"/><path d="M10.25 6h-3.5A1.75 1.75 0 0 0 5 7.75v9.5C5 18.22 5.78 19 6.75 19h9.5c.97 0 1.75-.78 1.75-1.75v-3.5"/></svg>',
      THUMBNAIL: '<svg aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="3.75" y="4.5" width="16.5" height="15" rx="2.25"/><circle cx="9" cy="9.25" r="1.25"/><path d="m5.5 17 4.25-4.25 2.75 2.75 2.25-2.25L18.5 17"/></svg>',
      DOWNLOAD_ALL: '<svg aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="m7.5 6.5 4.5 4 4.5-4"/><path d="m7.5 13.5 4.5 4 4.5-4"/></svg>',
      CLOSE: '<svg aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"><path d="m6.5 6.5 11 11"/><path d="m17.5 6.5-11 11"/></svg>',
      FULLSCREEN: '<svg aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M9.25 4.75h-4.5v4.5"/><path d="M14.75 4.75h4.5v4.5"/><path d="M19.25 14.75v4.5h-4.5"/><path d="M9.25 19.25h-4.5v-4.5"/></svg>',
      TURN_DEG: '<svg aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M7.25 7.5h-3.5V4"/><path d="M4.4 7.1A8 8 0 1 1 4.5 16.75"/></svg>'
    };
    const imageViewerController = new ImageViewerController({
      environment: environment2,
      $,
      icons: {
        close: SVG.CLOSE,
        rotate: SVG.TURN_DEG
      }
    });
    const checkInterval = IS_SAFARI ? 750 : 500;
    const buttonDetectionInterval = IS_SAFARI ? 150 : 100;
    const style = resources.internalCss;
    const injectedButtonStyle = `
    :root {
      --insta-loader-font: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", sans-serif;
      --insta-loader-bg: rgba(24, 24, 27, 0.92);
      --insta-loader-bg-strong: rgba(13, 13, 15, 0.97);
      --insta-loader-surface: rgba(255, 255, 255, 0.07);
      --insta-loader-surface-hover: rgba(255, 255, 255, 0.12);
      --insta-loader-surface-pressed: rgba(255, 255, 255, 0.16);
      --insta-loader-text: #f5f5f7;
      --insta-loader-secondary-text: rgba(235, 235, 245, 0.62);
      --insta-loader-tertiary-text: rgba(235, 235, 245, 0.42);
      --insta-loader-separator: rgba(255, 255, 255, 0.14);
      --insta-loader-accent: #0a84ff;
      --insta-loader-accent-hover: #409cff;
      --insta-loader-danger: #ff453a;
      --insta-loader-radius-large: 20px;
      --insta-loader-radius-medium: 12px;
      --insta-loader-radius-small: 9px;
      --insta-loader-shadow: 0 24px 80px rgba(0, 0, 0, 0.48), 0 2px 12px rgba(0, 0, 0, 0.28);
    }

    .button_wrapper,
    .IG_POPUP_DIG,
    #imageViewer,
    .circle_wrapper,
    #scrollWrapper,
    .volume_slider {
      font-family: var(--insta-loader-font);
      -webkit-font-smoothing: antialiased;
      text-rendering: optimizeLegibility;
    }

    .button_wrapper {
      right: 16px;
      line-height: 0;
      flex-flow: row-reverse nowrap;
      gap: 2px;
      z-index: 6;
      padding: 5px;
      overflow: hidden;
      isolation: isolate;
      background: linear-gradient(180deg, rgba(38, 38, 42, 0.84), rgba(16, 16, 18, 0.8));
      border: 1px solid rgba(255, 255, 255, 0.16);
      border-radius: 16px;
      box-shadow: 0 12px 36px rgba(0, 0, 0, 0.34), inset 0 1px 0 rgba(255, 255, 255, 0.08);
      -webkit-backdrop-filter: saturate(180%) blur(22px);
      backdrop-filter: saturate(180%) blur(22px);
    }

    .IG_DW_MAIN,
    .IG_NEWTAB_MAIN,
    .IG_THUMBNAIL_MAIN,
    .IG_DW_ALL_MAIN,
    .IG_IMAGE_VIEWER {
      position: relative;
      top: 0;
      display: inline-flex;
      flex: 0 0 32px;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      padding: 0;
      box-sizing: border-box;
      color: rgba(255, 255, 255, 0.82);
      background: transparent;
      border: 0;
      border-radius: 10px;
      cursor: pointer;
      -webkit-tap-highlight-color: transparent;
      transition: color 160ms ease, background 160ms ease, transform 160ms ease;
    }

    .IG_DW_MAIN:hover,
    .IG_NEWTAB_MAIN:hover,
    .IG_THUMBNAIL_MAIN:hover,
    .IG_DW_ALL_MAIN:hover,
    .IG_IMAGE_VIEWER:hover {
      color: #fff;
      background: var(--insta-loader-surface-hover);
      transform: translateY(-1px);
    }

    .IG_DW_MAIN:active,
    .IG_NEWTAB_MAIN:active,
    .IG_THUMBNAIL_MAIN:active,
    .IG_DW_ALL_MAIN:active,
    .IG_IMAGE_VIEWER:active {
      background: var(--insta-loader-surface-pressed);
      transform: scale(0.94);
    }

    .IG_DW_ALL_MAIN.is-busy {
      color: #fff;
      background: var(--insta-loader-surface-hover);
      cursor: progress;
      pointer-events: none;
    }

    .IG_DW_ALL_MAIN.is-busy svg {
      animation: insta-loader-breathe 900ms ease-in-out infinite alternate;
    }

    .IG_DW_MAIN svg,
    .IG_NEWTAB_MAIN svg,
    .IG_THUMBNAIL_MAIN svg,
    .IG_DW_ALL_MAIN svg,
    .IG_IMAGE_VIEWER svg {
      display: block;
      width: 19px;
      height: 19px;
      fill: none;
      stroke: currentColor;
    }

    .IG_REELS,
    .IG_REELS_NEWTAB,
    .IG_REELS_THUMBNAIL,
    .IG_DWSTORY,
    .IG_DWSTORY_ALL,
    .IG_DWNEWTAB,
    .IG_DWSTORY_THUMBNAIL,
    .IG_DWHISTORY,
    .IG_DWHISTORY_ALL,
    .IG_DWHINEWTAB,
    .IG_DWHISTORY_THUMBNAIL,
    .IG_DWPROFILE {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 30px;
      height: 30px;
      padding: 0;
      box-sizing: border-box;
      color: rgba(255, 255, 255, 0.86) !important;
      background: var(--insta-loader-bg);
      border: 1px solid var(--insta-loader-separator);
      border-radius: 10px;
      box-shadow: 0 6px 18px rgba(0, 0, 0, 0.28), inset 0 1px 0 rgba(255, 255, 255, 0.06);
      -webkit-backdrop-filter: saturate(160%) blur(16px);
      backdrop-filter: saturate(160%) blur(16px);
      transition: color 160ms ease, background 160ms ease, transform 160ms ease;
    }

    .IG_REELS:hover,
    .IG_REELS_NEWTAB:hover,
    .IG_REELS_THUMBNAIL:hover,
    .IG_DWSTORY:hover,
    .IG_DWSTORY_ALL:hover,
    .IG_DWNEWTAB:hover,
    .IG_DWSTORY_THUMBNAIL:hover,
    .IG_DWHISTORY:hover,
    .IG_DWHISTORY_ALL:hover,
    .IG_DWHINEWTAB:hover,
    .IG_DWHISTORY_THUMBNAIL:hover,
    .IG_DWPROFILE:hover {
      color: #fff;
      background: rgba(42, 42, 46, 0.94);
      transform: translateY(-1px);
    }

    .IG_REELS:active,
    .IG_REELS_NEWTAB:active,
    .IG_REELS_THUMBNAIL:active,
    .IG_DWSTORY:active,
    .IG_DWSTORY_ALL:active,
    .IG_DWNEWTAB:active,
    .IG_DWSTORY_THUMBNAIL:active,
    .IG_DWHISTORY:active,
    .IG_DWHISTORY_ALL:active,
    .IG_DWHINEWTAB:active,
    .IG_DWHISTORY_THUMBNAIL:active,
    .IG_DWPROFILE:active {
      transform: scale(0.94);
    }

    .IG_REELS svg,
    .IG_REELS_NEWTAB svg,
    .IG_REELS_THUMBNAIL svg,
    .IG_DWSTORY svg,
    .IG_DWSTORY_ALL svg,
    .IG_DWNEWTAB svg,
    .IG_DWSTORY_THUMBNAIL svg,
    .IG_DWHISTORY svg,
    .IG_DWHISTORY_ALL svg,
    .IG_DWHINEWTAB svg,
    .IG_DWHISTORY_THUMBNAIL svg,
    .IG_DWPROFILE svg {
      width: 17px;
      height: 17px;
      color: currentColor;
      fill: none;
      stroke: currentColor;
    }

    .IG_DWPROFILE {
      border-radius: 50%;
    }

    /* Keep Reels controls out of Safari's dynamic backdrop-filter layers.
       Instagram repaints this rail when Like state changes. */
    .IG_REELS,
    .IG_REELS_NEWTAB,
    .IG_REELS_THUMBNAIL {
      background: rgba(24, 24, 27, 0.97);
      -webkit-backdrop-filter: none;
      backdrop-filter: none;
    }

    .IG_REELS_CONTROLS {
      display: flex;
      flex: 0 0 auto;
      flex-direction: column;
      align-items: center;
      gap: 2px;
      margin: 0 0 20px;
      pointer-events: none;
    }

    .IG_REELS_CONTROLS > .IG_REELS,
    .IG_REELS_CONTROLS > .IG_REELS_NEWTAB,
    .IG_REELS_CONTROLS > .IG_REELS_THUMBNAIL {
      position: static;
      top: auto;
      right: auto;
      flex: 0 0 auto;
      pointer-events: auto;
    }

    .IG_DWSTORY_POSITION,
    .IG_DWHISTORY_POSITION {
      width: 30px;
      height: 30px;
      padding: 0;
      color: var(--insta-loader-text) !important;
      background: var(--insta-loader-bg);
      border: 1px solid var(--insta-loader-separator);
      border-radius: 10px;
      box-shadow: 0 6px 18px rgba(0, 0, 0, 0.28);
      -webkit-backdrop-filter: saturate(160%) blur(16px);
      backdrop-filter: saturate(160%) blur(16px);
      font-family: var(--insta-loader-font);
      font-size: 10px;
      font-weight: 600;
      letter-spacing: -0.15px;
      font-variant-numeric: tabular-nums;
    }

    .IG_POPUP_DIG {
      color-scheme: dark;
      color: var(--insta-loader-text);
    }

    .IG_POPUP_DIG.hidden {
      display: none;
    }

    .IG_POPUP_DIG_BG {
      background: rgba(0, 0, 0, 0.68);
      -webkit-backdrop-filter: saturate(120%) blur(18px);
      backdrop-filter: saturate(120%) blur(18px);
    }

    .IG_POPUP_DIG_MAIN {
      display: flex;
      flex-direction: column;
      top: max(24px, 5vh);
      width: min(680px, calc(100vw - 32px));
      max-height: min(900px, 90svh);
      padding: 0;
      overflow: hidden;
      color: var(--insta-loader-text);
      background: linear-gradient(180deg, rgba(31, 31, 34, 0.98), rgba(16, 16, 18, 0.98));
      border: 1px solid var(--insta-loader-separator);
      border-radius: var(--insta-loader-radius-large);
      box-shadow: var(--insta-loader-shadow), inset 0 1px 0 rgba(255, 255, 255, 0.06);
    }

    .IG_POPUP_DIG_TITLE {
      position: relative;
      flex: 0 0 auto;
      padding: 18px 20px 16px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    }

    .insta-loader-dialog-header {
      position: relative;
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      align-items: start;
      min-height: 36px;
      padding-right: 38px;
    }

    .insta-loader-dialog-brand {
      overflow: hidden;
      color: var(--insta-loader-text);
      font-size: 16px;
      font-weight: 650;
      line-height: 20px;
      letter-spacing: -0.2px;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .insta-loader-dialog-shortcut {
      align-self: center;
      color: var(--insta-loader-tertiary-text);
      font-size: 11px;
      line-height: 18px;
      white-space: nowrap;
    }

    .IG_POPUP_DIG #post_info {
      margin-top: 4px;
      overflow: hidden;
      color: var(--insta-loader-secondary-text);
      font-size: 12px;
      font-weight: 450;
      line-height: 16px;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .IG_POPUP_DIG #post_info a {
      color: var(--insta-loader-secondary-text);
      text-decoration: none;
    }

    .IG_POPUP_DIG #post_info a:hover {
      color: var(--insta-loader-text);
    }

    .IG_POPUP_DIG_BODY {
      flex: 1 1 auto;
      min-height: 0;
      max-height: none;
      padding: 14px 18px 18px;
      box-sizing: border-box;
      overflow-x: hidden;
      overflow-y: auto;
      overscroll-behavior: contain;
      scrollbar-color: rgba(255, 255, 255, 0.28) transparent;
    }

    .IG_POPUP_DIG_BODY::-webkit-scrollbar {
      width: 8px;
    }

    .IG_POPUP_DIG_BODY::-webkit-scrollbar-thumb {
      background: rgba(255, 255, 255, 0.22);
      border: 2px solid transparent;
      border-radius: 999px;
      background-clip: padding-box;
    }

    .IG_POPUP_DIG_BTN,
    #rotate_left,
    #rotate_right,
    #iv_close {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 30px;
      height: 30px;
      padding: 0;
      box-sizing: border-box;
      color: var(--insta-loader-secondary-text);
      background: transparent;
      border-radius: 9px;
      transition: color 160ms ease, background 160ms ease, transform 160ms ease;
    }

    .IG_POPUP_DIG_BTN:hover,
    #rotate_left:hover,
    #rotate_right:hover,
    #iv_close:hover {
      color: var(--insta-loader-text);
      background: var(--insta-loader-surface-hover);
    }

    .IG_POPUP_DIG_BTN:active,
    #rotate_left:active,
    #rotate_right:active,
    #iv_close:active {
      transform: scale(0.92);
    }

    .IG_POPUP_DIG_BTN svg,
    #rotate_left svg,
    #rotate_right svg,
    #iv_close svg {
      width: 18px;
      height: 18px;
      fill: none;
      stroke: currentColor;
    }

    .IG_POPUP_DIG button,
    .IG_POPUP_DIG select,
    .IG_POPUP_DIG input,
    .IG_POPUP_DIG textarea {
      font-family: var(--insta-loader-font);
    }

    .IG_POPUP_DIG button {
      min-height: 32px;
      margin: 0;
      padding: 6px 12px;
      color: var(--insta-loader-text);
      background: var(--insta-loader-surface);
      border: 1px solid var(--insta-loader-separator);
      border-radius: var(--insta-loader-radius-small);
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
      cursor: pointer;
      font-size: 13px;
      font-weight: 550;
      line-height: 18px;
      transition: background 150ms ease, border-color 150ms ease, transform 150ms ease;
    }

    .IG_POPUP_DIG button:hover {
      background: var(--insta-loader-surface-hover);
      border-color: rgba(255, 255, 255, 0.2);
    }

    .IG_POPUP_DIG button:active {
      background: var(--insta-loader-surface-pressed);
      transform: scale(0.98);
    }

    .IG_POPUP_DIG button:focus-visible,
    .IG_POPUP_DIG select:focus-visible,
    .IG_POPUP_DIG input:focus-visible,
    .IG_POPUP_DIG textarea:focus-visible {
      outline: 2px solid var(--insta-loader-accent);
      outline-offset: 2px;
    }

    .IG_POPUP_DIG button:disabled {
      opacity: 0.42;
    }

    .IG_POPUP_DIG_TITLE #button_group {
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: 8px;
      margin-top: 14px;
    }

    .IG_POPUP_DIG_TITLE #button_group button {
      flex: 1 1 220px;
      min-width: 0;
      white-space: normal;
    }

    .IG_POPUP_DIG_TITLE #batch_download_selected {
      color: #fff;
      background: var(--insta-loader-accent);
      border-color: rgba(255, 255, 255, 0.12);
    }

    .IG_POPUP_DIG_TITLE #batch_download_selected:hover {
      background: var(--insta-loader-accent-hover);
    }

    .IG_POPUP_DIG_TITLE .checkbox {
      display: flex;
      align-items: center;
      min-height: 24px;
      margin: 10px 0 0;
      color: var(--insta-loader-secondary-text);
      font-size: 12px;
      line-height: 16px;
    }

    .IG_POPUP_DIG_TITLE .checkbox input {
      width: 16px;
      height: 16px;
      margin: 0 8px 0 0;
      accent-color: var(--insta-loader-accent);
      transform: none;
    }

    .IG_POPUP_DIG_MEDIA .IG_POPUP_DIG_BODY {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
      grid-auto-rows: max-content;
      align-content: start;
      gap: 10px;
    }

    .IG_POPUP_DIG_MEDIA .IG_POPUP_DIG_BODY > div {
      position: relative;
      min-width: 0;
      margin: 0;
      overflow: hidden;
      background: rgba(255, 255, 255, 0.035);
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: var(--insta-loader-radius-medium);
      transition: background 160ms ease, border-color 160ms ease, transform 160ms ease;
    }

    .IG_POPUP_DIG_MEDIA .IG_POPUP_DIG_BODY > div:hover {
      background: rgba(255, 255, 255, 0.06);
      border-color: rgba(255, 255, 255, 0.22);
      transform: translateY(-1px);
    }

    .IG_POPUP_DIG_MEDIA .IG_POPUP_DIG_BODY a[data-needed="direct"] {
      display: block;
      min-height: 170px;
      padding: 0 0 9px;
      overflow: hidden;
      color: var(--insta-loader-secondary-text);
      border-radius: inherit;
      font-size: 11px;
      line-height: 15px;
      text-align: center;
      text-decoration: none;
    }

    .IG_POPUP_DIG_MEDIA .IG_POPUP_DIG_BODY a[data-needed="direct"] img {
      width: 100%;
      height: 140px;
      margin-bottom: 8px;
      object-fit: cover;
      background: #09090a;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    }

    .IG_POPUP_DIG_MEDIA .inner_box_wrapper {
      left: 8px;
      top: 8px;
      width: 24px;
      height: 24px;
      z-index: 4;
      overflow: hidden;
      background: rgba(15, 15, 17, 0.78);
      border: 1px solid rgba(255, 255, 255, 0.6);
      border-radius: 7px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.28);
      -webkit-backdrop-filter: blur(10px);
      backdrop-filter: blur(10px);
    }

    .IG_POPUP_DIG_MEDIA .inner_box ~ span {
      border-radius: 6px;
    }

    .IG_POPUP_DIG_MEDIA .inner_box:checked ~ span {
      background: var(--insta-loader-accent);
    }

    .IG_POPUP_DIG_MEDIA .inner_box ~ span::after {
      left: 7px;
      top: 5px;
      width: 5px;
      height: 10px;
      margin: 0;
      border-color: #fff;
      border-width: 0 2px 2px 0;
      transform: rotate(45deg);
    }

    .IG_POPUP_DIG_MEDIA .inner_box {
      inset: 0;
      width: 100%;
      height: 100%;
      transform: none;
    }

    .IG_POPUP_DIG_BODY .newTab,
    .IG_POPUP_DIG_BODY .videoThumbnail {
      display: flex;
      align-items: center;
      justify-content: center;
      right: 8px;
      width: 28px;
      height: 28px;
      padding: 0;
      box-sizing: border-box;
      color: rgba(255, 255, 255, 0.88);
      background: rgba(15, 15, 17, 0.74);
      border: 1px solid rgba(255, 255, 255, 0.18);
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.24);
      -webkit-backdrop-filter: blur(10px);
      backdrop-filter: blur(10px);
      transition: background 150ms ease, transform 150ms ease;
    }

    .IG_POPUP_DIG_BODY .newTab {
      top: 8px;
    }

    .IG_POPUP_DIG_BODY .videoThumbnail {
      top: 42px;
    }

    .IG_POPUP_DIG_BODY .newTab:hover,
    .IG_POPUP_DIG_BODY .videoThumbnail:hover {
      background: rgba(48, 48, 52, 0.9);
      transform: translateY(-1px);
    }

    .IG_POPUP_DIG_BODY .newTab svg,
    .IG_POPUP_DIG_BODY .videoThumbnail svg {
      width: 16px;
      height: 16px;
      fill: none;
      stroke: currentColor;
    }

    #_SNLOAD {
      grid-column: 1 / -1;
      display: flex;
      min-height: 100px;
      align-items: center;
      justify-content: center;
      gap: 10px;
      margin: 0;
      color: var(--insta-loader-secondary-text);
      font-size: 13px;
      font-weight: 500;
    }

    #_SNLOAD::before {
      width: 16px;
      height: 16px;
      content: "";
      border: 1.5px solid rgba(255, 255, 255, 0.2);
      border-top-color: rgba(255, 255, 255, 0.9);
      border-radius: 50%;
      animation: insta-loader-spin 700ms linear infinite;
    }

    .IG_POPUP_DIG_SETTINGS .IG_POPUP_DIG_MAIN,
    .IG_POPUP_DIG_HOTKEYS .IG_POPUP_DIG_MAIN {
      width: min(620px, calc(100vw - 32px));
    }

    .IG_POPUP_DIG_BODY > .insta-loader-language-row {
      position: static;
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(150px, 210px);
      align-items: center;
      gap: 16px;
      min-height: 48px;
      margin: 0;
      padding: 0 12px 10px;
      color: var(--insta-loader-secondary-text);
      background: transparent;
      border: 0;
      border-radius: 0;
      font-size: 13px;
    }

    .IG_POPUP_DIG_BODY > .insta-loader-language-row:hover {
      background: transparent;
    }

    .insta-loader-language-note {
      margin-top: 3px;
      color: var(--insta-loader-tertiary-text);
      font-size: 11px;
      line-height: 15px;
    }

    .IG_POPUP_DIG select,
    .IG_POPUP_DIG input[type="text"],
    .IG_POPUP_DIG input[type="number"],
    .IG_POPUP_DIG input#date_format {
      min-height: 32px;
      padding: 5px 30px 5px 9px;
      box-sizing: border-box;
      color: var(--insta-loader-text);
      background: rgba(255, 255, 255, 0.065);
      border: 1px solid var(--insta-loader-separator);
      border-radius: 8px;
      outline: none;
      font-size: 12px;
    }

    .globalSettings {
      display: block;
      min-height: 46px;
      margin: 0;
      padding: 13px 58px 13px 12px;
      box-sizing: border-box;
      color: var(--insta-loader-text);
      background: transparent;
      border-bottom: 1px solid rgba(255, 255, 255, 0.085);
      border-radius: 9px;
      font-size: 13px;
      font-weight: 450;
      line-height: 20px;
      transition: background 150ms ease;
    }

    .globalSettings:hover {
      background: rgba(255, 255, 255, 0.055);
    }

    .globalSettings.child {
      width: calc(100% - 22px);
      margin-left: 22px;
      color: var(--insta-loader-secondary-text);
    }

    .globalSettings .chbtn {
      right: 12px;
      width: 36px;
      height: 22px;
      background: rgba(120, 120, 128, 0.32);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 999px;
      transition: background 180ms ease, border-color 180ms ease;
    }

    .globalSettings .chbtn .rounds {
      left: 1px;
      top: 1px;
      width: 18px;
      height: 18px;
      background: #f5f5f7;
      border-radius: 50%;
      box-shadow: 0 1px 4px rgba(0, 0, 0, 0.42);
      transition: left 180ms cubic-bezier(0.25, 0.8, 0.25, 1);
    }

    .globalSettings input:checked ~ .chbtn {
      background: var(--insta-loader-accent);
      border-color: transparent;
    }

    .globalSettings input:checked ~ .chbtn .rounds {
      left: 15px;
      background: #fff;
    }

    .globalSettings #tempWrapper {
      z-index: 2;
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 0 44px 0 12px;
      box-sizing: border-box;
      background: rgba(29, 29, 32, 0.98);
      border-radius: inherit;
    }

    .globalSettings input#date_format {
      top: auto;
      width: 100%;
      padding-right: 9px;
      transform: none;
    }

    .globalSettings #tempWrapper input[type="range"] {
      top: auto;
      flex: 1;
      width: auto;
      accent-color: var(--insta-loader-accent);
      transform: none;
    }

    .globalSettings #tempWrapper input[type="number"] {
      top: auto;
      width: 58px;
      padding-right: 6px;
      transform: none;
    }

    .IG_POPUP_DIG_BODY > .hotkey-settings-container {
      position: static;
      display: block;
      margin: 0;
      background: transparent;
      border: 0;
      border-radius: 0;
    }

    .IG_POPUP_DIG_BODY > .hotkey-settings-container:hover {
      background: transparent;
    }

    .hotkey-setting-item {
      display: flex;
      align-items: center;
      gap: 16px;
      padding-right: 6px;
    }

    .hotkey-setting-item > span {
      min-width: 0;
      flex: 1;
    }

    .hotkey-select-wrapper {
      display: flex;
      flex: 0 0 auto;
      align-items: center;
      justify-content: flex-end;
      gap: 8px;
    }

    .hotkey-preset {
      min-width: 94px;
    }

    .hotkey-conflict-warning {
      position: absolute;
      left: 12px;
      bottom: -4px;
      z-index: 3;
      display: none;
      color: var(--insta-loader-danger);
      font-size: 10px;
      line-height: 12px;
      pointer-events: none;
    }

    .IG_POPUP_DIG_DEBUG textarea {
      width: 100%;
      height: min(420px, 52vh);
      padding: 12px;
      box-sizing: border-box;
      resize: vertical;
      color: #d1f7c4;
      background: #090b09;
      border: 1px solid var(--insta-loader-separator);
      border-radius: var(--insta-loader-radius-medium);
      outline: none;
      font: 12px/1.55 ui-monospace, SFMono-Regular, Menlo, monospace;
    }

    .IG_POPUP_DIG_BODY > .insta-loader-dialog-actions {
      position: static;
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 8px;
      margin-top: 12px;
      background: transparent;
      border: 0;
      border-radius: 0;
    }

    .IG_POPUP_DIG_BODY > .insta-loader-dialog-actions:hover {
      background: transparent;
    }

    .insta-loader-dialog-actions a {
      display: inline;
      padding: 0;
      color: inherit;
      font: inherit;
      line-height: inherit;
      text-decoration: none;
    }

    #scrollWrapper {
      z-index: 20;
    }

    #scrollWrapper .button-up,
    #scrollWrapper .button-down {
      width: 34px;
      height: 34px;
      margin: 6px 0;
      box-sizing: border-box;
      background: rgba(24, 24, 27, 0.97);
      border: 1px solid var(--insta-loader-separator);
      border-radius: 11px;
      box-shadow: 0 6px 18px rgba(0, 0, 0, 0.28);
      -webkit-backdrop-filter: none;
      backdrop-filter: none;
      transition: background 150ms ease, transform 150ms ease;
    }

    #scrollWrapper .button-up:hover,
    #scrollWrapper .button-down:hover {
      width: 34px;
      height: 34px;
      margin: 6px 0;
      background: rgba(42, 42, 46, 0.94);
      border-radius: 11px;
      transform: translateY(-1px);
    }

    #scrollWrapper .button-up > div,
    #scrollWrapper .button-down > div {
      left: 12px;
      padding: 3px;
      border-color: rgba(255, 255, 255, 0.88);
      border-width: 0 1.5px 1.5px 0;
    }

    #scrollWrapper .button-up > div {
      top: 12px;
    }

    #scrollWrapper .button-down > div {
      top: 9px;
    }

    .volume_slider > div {
      height: 34px;
      background: var(--insta-loader-bg);
      border: 1px solid var(--insta-loader-separator);
      border-radius: 999px;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.28);
      -webkit-backdrop-filter: saturate(160%) blur(16px);
      backdrop-filter: saturate(160%) blur(16px);
    }

    .volume_slider input[type="range"]::-webkit-slider-runnable-track {
      height: 4px;
      background: linear-gradient(to right, var(--insta-loader-accent) 0%, var(--insta-loader-accent) var(--ig-track-progress), rgba(255, 255, 255, 0.24) var(--ig-track-progress), rgba(255, 255, 255, 0.24) 100%);
      border-radius: 999px;
    }

    .volume_slider input[type="range"]::-moz-range-track {
      height: 4px;
      background: rgba(255, 255, 255, 0.24);
      border-radius: 999px;
    }

    .volume_slider input[type="range"]::-moz-range-progress {
      height: 4px;
      background: var(--insta-loader-accent);
      border-radius: 999px;
    }

    .volume_slider input[type="range"]::-webkit-slider-thumb {
      width: 14px;
      height: 14px;
      margin-top: -5px;
      background: #fff;
      box-shadow: 0 1px 5px rgba(0, 0, 0, 0.42);
    }

    .volume_slider input[type="range"]::-moz-range-thumb {
      width: 14px;
      height: 14px;
      background: #fff;
      border: 0;
      box-shadow: 0 1px 5px rgba(0, 0, 0, 0.42);
    }

    .circle_wrapper {
      gap: 8px;
      min-height: 38px;
      padding: 7px 12px 7px 9px;
      box-sizing: border-box;
      color: var(--insta-loader-text);
      background: var(--insta-loader-bg);
      border: 1px solid var(--insta-loader-separator);
      border-radius: 999px;
      box-shadow: 0 12px 36px rgba(0, 0, 0, 0.36), inset 0 1px 0 rgba(255, 255, 255, 0.06);
      -webkit-backdrop-filter: saturate(180%) blur(20px);
      backdrop-filter: saturate(180%) blur(20px);
    }

    .circle_wrapper circle {
      width: 15px;
      height: 15px;
      margin: 0;
      opacity: 1;
      border: 1.5px solid rgba(255, 255, 255, 0.2);
      border-top-color: rgba(255, 255, 255, 0.92);
      border-radius: 50%;
      animation: insta-loader-spin 700ms linear infinite;
    }

    .circle_wrapper span {
      color: var(--insta-loader-text);
      font-family: var(--insta-loader-font);
      font-size: 12px;
      font-weight: 600;
      line-height: 18px;
      font-variant-numeric: tabular-nums;
      letter-spacing: 0.1px;
    }

    #imageViewer {
      color-scheme: dark;
      color: var(--insta-loader-text);
      background: rgba(0, 0, 0, 0.94);
      -webkit-backdrop-filter: blur(12px);
      backdrop-filter: blur(12px);
    }

    #imageViewer > #iv_header {
      height: 56px;
      padding: 0 18px;
      box-sizing: border-box;
      color: var(--insta-loader-text);
      background: linear-gradient(180deg, rgba(28, 28, 30, 0.94), rgba(18, 18, 20, 0.86));
      border-bottom: 1px solid rgba(255, 255, 255, 0.12);
      font-family: var(--insta-loader-font);
      font-size: 13px;
      font-weight: 600;
      letter-spacing: -0.1px;
      -webkit-backdrop-filter: saturate(160%) blur(18px);
      backdrop-filter: saturate(160%) blur(18px);
    }

    #iv_header .iv_actions {
      display: flex;
      gap: 4px;
      margin-right: 6px;
    }

    #iv_header .iv_title {
      min-width: 0;
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    #rotate_right {
      transform: scaleX(-1);
    }

    #rotate_right:active {
      transform: scaleX(-1) scale(0.92);
    }

    #iv_close {
      filter: none;
    }

    #imageViewer > section {
      display: flex;
      width: 100%;
      height: 100%;
      padding: 72px 32px 28px;
      box-sizing: border-box;
      align-items: center;
      justify-content: center;
      overflow: hidden;
    }

    #iv_image {
      width: auto;
      height: auto;
      max-width: calc(100vw - 64px);
      max-height: calc(100svh - 100px);
      border-radius: 4px;
      box-shadow: 0 18px 80px rgba(0, 0, 0, 0.52);
    }

    @keyframes insta-loader-spin {
      to { transform: rotate(360deg); }
    }

    @keyframes insta-loader-breathe {
      from { opacity: 0.45; transform: translateY(-1px); }
      to { opacity: 1; transform: translateY(1px); }
    }

    @supports not ((backdrop-filter: blur(2px)) or (-webkit-backdrop-filter: blur(2px))) {
      .button_wrapper,
      .IG_REELS,
      .IG_REELS_NEWTAB,
      .IG_REELS_THUMBNAIL,
      .IG_DWSTORY,
      .IG_DWSTORY_ALL,
      .IG_DWNEWTAB,
      .IG_DWSTORY_THUMBNAIL,
      .IG_DWHISTORY,
      .IG_DWHISTORY_ALL,
      .IG_DWHINEWTAB,
      .IG_DWHISTORY_THUMBNAIL,
      .IG_DWPROFILE,
      .circle_wrapper,
      #scrollWrapper .button-up,
      #scrollWrapper .button-down,
      .volume_slider > div {
        background: rgba(20, 20, 22, 0.97);
      }
    }

    @media (max-width: 560px) {
      .IG_POPUP_DIG_MAIN {
        top: 12px;
        width: calc(100vw - 20px);
        max-height: calc(100svh - 24px);
        border-radius: 16px;
      }

      .IG_POPUP_DIG_TITLE {
        padding: 14px 14px 12px;
      }

      .insta-loader-dialog-shortcut {
        display: none;
      }

      .IG_POPUP_DIG_BODY {
        max-height: none;
        padding: 12px;
      }

      .IG_POPUP_DIG_MEDIA .IG_POPUP_DIG_BODY {
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 8px;
      }

      .IG_POPUP_DIG_BODY > .insta-loader-language-row {
        grid-template-columns: 1fr;
        gap: 8px;
        padding: 0 8px 10px;
      }

      .hotkey-setting-item {
        align-items: flex-start;
        flex-direction: column;
        gap: 8px;
      }

      .hotkey-select-wrapper {
        width: 100%;
        justify-content: space-between;
      }

      #imageViewer > section {
        padding: 68px 12px 12px;
      }

      #iv_image {
        max-width: calc(100vw - 24px);
        max-height: calc(100svh - 80px);
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .button_wrapper *,
      .IG_POPUP_DIG *,
      #imageViewer *,
      #scrollWrapper *,
      .circle_wrapper * {
        scroll-behavior: auto;
        transition-duration: 0.01ms;
      }

      .IG_DW_ALL_MAIN.is-busy svg {
        animation: none;
      }
    }

    .insta-loader-reel-quality-hold {
      position: fixed;
      z-index: 2147483000;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      background-color: #050505;
      background-position: center;
      background-repeat: no-repeat;
      background-size: cover;
      pointer-events: none;
    }

    .insta-loader-reel-quality-hold > img {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .insta-loader-reel-quality-spinner {
      position: relative;
      z-index: 1;
      width: 24px;
      height: 24px;
      box-sizing: border-box;
      border: 2px solid rgba(255, 255, 255, 0.34);
      border-top-color: rgba(255, 255, 255, 0.96);
      border-radius: 50%;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.42);
      animation: insta-loader-reel-quality-spin 700ms linear infinite;
    }

    @keyframes insta-loader-reel-quality-spin {
      to {
        transform: rotate(360deg);
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .insta-loader-reel-quality-spinner {
        animation: none;
      }
    }
  `;
    const locale_manifest = resources.localeManifest;
    const videoVolumeStore = new VideoVolumeStore(environment2);
    var state = {
      videoVolume: videoVolumeStore.get(),
      tempFetchRateLimit: false,
      fileRenameFormat: preferences2.renameFormat,
      locale: {},
      lang: preferences2.language,
      currentURL: location.href,
      firstStarted: false,
      pageLoaded: false,
      bulkDownloadActive: false,
      GL_registerEventList: [],
      GL_logger: [],
      GL_referrer: null,
      GL_postPath: null,
      GL_username: null,
      GL_repeat: null,
      GL_dataCache: {
        stories: {},
        highlights: {}
      },
      GL_observer: new MutationObserver(function() {
        onReadyMyDW();
      }),
      GL_imageCache: imageCache.entries,
      GL_mediaDataCache: {},
      debugHotkeyKeyCode: preferences2.hotkeys.debug,
      settingsHotkeyKeyCode: preferences2.hotkeys.settings,
      keySettingsHotkeyKeyCode: preferences2.hotkeys.keySettings,
      downloadStoryHotkeyKeyCode: preferences2.hotkeys.downloadStory
    };
    const legacyVideoVolumeState = {
      get: () => state.videoVolume,
      set(value) {
        state.videoVolume = videoVolumeStore.set(value);
        return state.videoVolume;
      }
    };
    const postVideoBehaviorServices = /* @__PURE__ */ new WeakMap();
    const reelVideoBehaviorServices = /* @__PURE__ */ new WeakMap();
    const storyVideoBehaviorServices = /* @__PURE__ */ new WeakMap();
    const surfaceVideoBehaviorByVideo = /* @__PURE__ */ new WeakMap();
    const globalVideoVolumeFallbackBindings = /* @__PURE__ */ new WeakMap();
    const storyThumbnailBindings = /* @__PURE__ */ new WeakMap();
    const storyImageLoadBindings = /* @__PURE__ */ new WeakMap();
    const storyPictureContextMenuBindings = /* @__PURE__ */ new Map();
    let activeVideoVolumeSliderController = null;
    let applicationLifecycleMountCount = 0;
    let applicationTranslationGeneration = 0;
    var translationTextCache = null;
    const downloadTransport = new DownloadTransport({
      gmDownload: environment2.browser.supports("GM_download") ? GM_download : void 0,
      fetch: environment2.window.fetch?.bind(environment2.window),
      gmRequest: GM_xmlhttpRequest,
      document: environment2.getDocument(),
      urlApi: environment2.window.URL,
      setTimeout: setTimeout2,
      clearTimeout,
      onFallback(error, context) {
        logger(
          "DownloadTransport",
          `${context.stage} failed; falling back to ${context.fallback}`,
          error?.message || error
        );
      }
    });
    const mediaDescriptorByElement = /* @__PURE__ */ new WeakMap();
    function createMaximumReelPlaybackControllerInstance() {
      return new MaximumReelPlaybackController({
        environment: environment2,
        isEnabled: () => USER_SETTING.MAX_REEL_PLAYBACK_QUALITY,
        logger: (...messages) => logger(...messages),
        normalizeCandidates: media.normalizeMaximumReelCandidates,
        requestMetadata(shortcode, options = {}) {
          const query = new URLSearchParams({
            query_id: "9496392173716084",
            variables: JSON.stringify({
              shortcode,
              __relay_internal__pv__PolarisFeedShareMenurelayprovider: true,
              __relay_internal__pv__PolarisIsLoggedInrelayprovider: true
            })
          });
          return startJsonRequest({
            url: `https://www.instagram.com/graphql/query/?${query.toString()}`,
            timeout: options.timeout,
            headers: {
              "User-Agent": "Mozilla/5.0 (Linux; Android 10; Pixel 7 XL)Build/RP1A.20845.002; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/5.0 Chrome/117.0.5938.60 Mobile Safari/537.36 Instagram 307.0.0.34.111",
              "X-IG-App-ID": getAppID()
            },
            validate: (payload) => Boolean(payload?.data && typeof payload.data === "object"),
            transform: (payload) => payload.data
          });
        }
      });
    }
    let maximumReelPlaybackController = createMaximumReelPlaybackControllerInstance();
    let pendingMaximumReelReloadHandoff = null;
    const updateCheckService = new UpdateCheckService({
      environment: environment2,
      preferencesStore: preferencesStore2,
      requestText: startTextRequest,
      translator: _i18n,
      logger,
      getApplicationScope: () => activeApplicationScope
    });
    const settingsController = new SettingsController({
      $,
      environment: environment2,
      settings: USER_SETTING,
      localeManifest: locale_manifest,
      parentChildMapping: USER_SETTING_HIERARCHY,
      icons: { close: SVG.CLOSE },
      createDialog: () => IG_createDM(),
      translate: _i18n,
      translateHtml: _i18nHTML,
      model: {
        getLanguage: () => state.lang,
        setLanguage(value) {
          state.lang = preferencesStore2.setLanguage(value);
          return state.lang;
        },
        hasLocale: (language) => state.locale[language] != null,
        setLocale(language, dictionary) {
          state.locale[language] = dictionary;
        },
        clearTranslationCache() {
          translationTextCache = null;
        },
        getVideoVolume: () => state.videoVolume,
        setVideoVolume(value) {
          state.videoVolume = videoVolumeStore.set(value);
          return state.videoVolume;
        },
        getRenameFormat: () => state.fileRenameFormat,
        setRenameFormat(value) {
          state.fileRenameFormat = preferencesStore2.setRenameFormat(value);
          return state.fileRenameFormat;
        },
        setSetting(name, value) {
          settingsStore2.set(name, value);
          USER_SETTING[name] = value;
        }
      },
      loadTranslation: getTranslationText2,
      repaintTranslations: repaintingTranslations,
      refreshMenus: () => menuController.refresh(),
      reportAsync: fireAndReport,
      onSettingChanged(name, value) {
        if (name === "MAX_REEL_PLAYBACK_QUALITY") {
          maximumReelPlaybackController.refresh({ settingChanged: true });
        }
        if (name === "REDIRECT_CLICK_USER_STORY_PICTURE" && value === false) {
          releaseStoryPictureContextMenuBindings();
        }
      },
      logger
    });
    const debugController = new DebugController({
      $,
      environment: environment2,
      createDialog: () => IG_createDM(),
      translateHtml: _i18nHTML,
      getLogs: () => state.GL_logger,
      isJQuery: (value) => value instanceof $
    });
    const hotkeyController = new HotkeyController({
      $,
      environment: environment2,
      createDialog: () => IG_createDM(),
      translateHtml: _i18nHTML,
      model: {
        get: (stateKey) => state[stateKey],
        set(preferenceName, stateKey, value) {
          state[stateKey] = value;
          preferencesStore2.setHotkey(preferenceName, value);
          return value;
        }
      },
      showSettings: () => settingsController.show(),
      showDebug: () => debugController.showDebug(),
      reload: reloadScript
    });
    const menuController = new MenuController({
      environment: environment2,
      translate: _i18n,
      showSettings: () => settingsController.show(),
      showHotkeySettings: () => hotkeyController.show(),
      showDebug: () => debugController.showDebug(),
      showFeedback: () => debugController.showFeedback(),
      checkForUpdate: callNotification,
      reload: reloadScript,
      logger
    });
    function createRouteVideoBehaviorService(adapter) {
      if (!activeLegacyRouteScope) return null;
      const service = new VideoBehaviorService({
        environment: environment2,
        settings: settingsStore2,
        volume: legacyVideoVolumeState,
        scope: activeLegacyRouteScope,
        triggerClick: triggerReactClickHandler,
        logger: (...messages) => logger(...messages)
      });
      activeLegacyRouteScope.defer(() => service.dispose());
      service.mount(adapter.root, adapter.surfaceAdapter);
      markSurfaceManagedVideos(service, adapter.root);
      return service;
    }
    function getRouteVideoVolumeSliderController() {
      if (!activeLegacyRouteScope) return null;
      if (activeVideoVolumeSliderController && !activeVideoVolumeSliderController.disposed) {
        return activeVideoVolumeSliderController;
      }
      const controller = new VideoVolumeSliderController({
        environment: environment2,
        volume: legacyVideoVolumeState,
        scope: activeLegacyRouteScope,
        logger: (...messages) => logger(...messages)
      });
      activeVideoVolumeSliderController = controller;
      activeLegacyRouteScope.defer(() => {
        if (activeVideoVolumeSliderController === controller) {
          activeVideoVolumeSliderController = null;
        }
      });
      return controller;
    }
    function refreshRouteVideoBehavior(serviceMap, root, createAdapter) {
      if (!root) return null;
      let service = serviceMap.get(root);
      if (!service || service.disposed) {
        service = createRouteVideoBehaviorService({
          root,
          surfaceAdapter: createAdapter()
        });
        if (service) serviceMap.set(root, service);
      } else {
        service.refresh();
      }
      if (service) markSurfaceManagedVideos(service, root);
      return service;
    }
    function refreshStoryVideoBehavior(root, storyType) {
      if (!root) return null;
      let record = storyVideoBehaviorServices.get(root);
      if (record && (record.service.disposed || record.storyType !== storyType)) {
        record.service.dispose();
        record = null;
      }
      if (!record) {
        const surface = storyType === "highlight" ? VIDEO_SURFACE.HIGHLIGHT : VIDEO_SURFACE.STORY;
        const service = createRouteVideoBehaviorService({
          root,
          surfaceAdapter: createStoryVideoSurfaceAdapter({
            surface,
            onControllerVisibilityChange({ selectedVideo }) {
              toggleStoryVolumeSilder($(selectedVideo), storyType);
            }
          })
        });
        if (!service) return null;
        record = { service, storyType };
        storyVideoBehaviorServices.set(root, record);
      } else {
        record.service.refresh();
      }
      markSurfaceManagedVideos(record.service, root);
      return record.service;
    }
    function collectVideoElements(node) {
      if (node?.nodeType !== 1) return [];
      const videos = [];
      if (node.matches?.("video")) videos.push(node);
      videos.push(...node.querySelectorAll("video"));
      return [...new Set(videos)];
    }
    function releaseGlobalVideoVolumeFallback(video) {
      globalVideoVolumeFallbackBindings.get(video)?.release();
    }
    function markSurfaceManagedVideos(service, root) {
      if (!service || service.disposed || !root) return;
      for (const video of collectVideoElements(root)) {
        releaseGlobalVideoVolumeFallback(video);
        surfaceVideoBehaviorByVideo.set(video, service);
      }
    }
    function isSurfaceManagedVideo(video) {
      const service = surfaceVideoBehaviorByVideo.get(video);
      return Boolean(
        service && !service.disposed && service.root?.contains(video) === true
      );
    }
    function bindGlobalVideoVolumeFallback(video) {
      const surfaceManaged = isSurfaceManagedVideo(video);
      if (!activeApplicationScope || !USER_SETTING.MODIFY_VIDEO_VOLUME || surfaceManaged) {
        if (surfaceManaged) releaseGlobalVideoVolumeFallback(video);
        return;
      }
      const current = globalVideoVolumeFallbackBindings.get(video);
      if (current && !current.scope.disposed) return;
      current?.release();
      const applySavedVolume = function() {
        if (video.hasAttribute("data-modify")) return;
        $(video).attr("data-modify", true);
        video.volume = state.videoVolume;
        logger("(audio_observer) Added video event listener #modify");
      };
      const releasePlay = activeApplicationScope.listen(
        video,
        "play",
        applySavedVolume
      );
      const releasePlaying = activeApplicationScope.listen(
        video,
        "playing",
        applySavedVolume
      );
      const record = {
        scope: activeApplicationScope,
        released: false,
        release() {
          if (record.released) return;
          record.released = true;
          releasePlay();
          releasePlaying();
          video.removeAttribute("data-insta-loader-volume-fallback");
          if (globalVideoVolumeFallbackBindings.get(video) === record) {
            globalVideoVolumeFallbackBindings.delete(video);
          }
        }
      };
      globalVideoVolumeFallbackBindings.set(video, record);
      video.setAttribute("data-insta-loader-volume-fallback", "true");
      activeApplicationScope.defer(record.release);
    }
    function bindStoryThumbnailTimeupdate(video) {
      const routeScope = activeLegacyRouteScope;
      if (!routeScope || !location.pathname.startsWith("/stories/")) return;
      $(video).removeData("modify-thumbnail");
      video.removeAttribute("data-modify-thumbnail");
      const current = storyThumbnailBindings.get(video);
      if (current && current.scope === routeScope && !routeScope.disposed) {
        return;
      }
      current?.release();
      const onTimeUpdate = function() {
        if (!location.pathname.startsWith("/stories/")) return;
        if ($(video).data("modify-thumbnail")) return;
        const isHighlight = location.pathname.startsWith(
          "/stories/highlights/"
        );
        const storyType = isHighlight ? "highlight" : "story";
        const $video = $(video);
        const thumbnailExists = $video.parents("div[style][class]").filter(function() {
          return $(this).width() == $video.width();
        }).find(
          ".IG_DWSTORY_THUMBNAIL, .IG_DWHISTORY_THUMBNAIL"
        ).length > 0;
        $video.attr("data-modify-thumbnail", true);
        if (thumbnailExists) {
          logger(`(${storyType})`, "Thumbnail button already inserted");
          return;
        }
        if (isHighlight) {
          fireAndReport(
            () => onHighlightsStoryThumbnail(false),
            "onHighlightsStoryThumbnail()"
          );
        } else {
          fireAndReport(
            () => onStoryThumbnail(false),
            "onStoryThumbnail()"
          );
        }
        logger(`(${storyType})`, "Manually inserting thumbnail button");
      };
      const releaseListener = routeScope.listen(
        video,
        "timeupdate",
        onTimeUpdate
      );
      const record = {
        scope: routeScope,
        released: false,
        release() {
          if (record.released) return;
          record.released = true;
          releaseListener();
          $(video).removeData("modify-thumbnail");
          video.removeAttribute("data-modify-thumbnail");
          video.removeAttribute("data-insta-loader-story-thumbnail-bound");
          if (storyThumbnailBindings.get(video) === record) {
            storyThumbnailBindings.delete(video);
          }
        }
      };
      storyThumbnailBindings.set(video, record);
      video.setAttribute("data-insta-loader-story-thumbnail-bound", "true");
      routeScope.defer(record.release);
    }
    function bindStoryImageLoad(image, $element, surface) {
      const routeScope = activeLegacyRouteScope;
      if (!routeScope) return;
      const current = storyImageLoadBindings.get(image);
      if (current && current.scope === routeScope && !routeScope.disposed) {
        return;
      }
      current?.release();
      const thumbnailSelector = surface === "highlight" ? ".IG_DWHISTORY_THUMBNAIL" : ".IG_DWSTORY_THUMBNAIL";
      const onLoad = function() {
        if (!$(this).data("remove-thumbnail")) {
          if ($element.find(thumbnailSelector).length === 0) {
            $(this).attr("data-remove-thumbnail", true);
            $(thumbnailSelector).remove();
            logger(`(${surface}) Manually removing thumbnail button`);
          } else {
            $(this).attr("data-remove-thumbnail", true);
            logger(`(${surface}) Thumbnail button is not present for this picture`);
          }
        }
      };
      const releaseListener = routeScope.listenJQuery(
        $(image),
        "load",
        onLoad
      );
      const record = {
        scope: routeScope,
        released: false,
        release() {
          if (record.released) return;
          record.released = true;
          releaseListener();
          if (storyImageLoadBindings.get(image) === record) {
            storyImageLoadBindings.delete(image);
          }
        }
      };
      storyImageLoadBindings.set(image, record);
      routeScope.defer(record.release);
    }
    function releaseStoryPictureContextMenuBindings() {
      for (const record of [...storyPictureContextMenuBindings.values()]) {
        record.release();
      }
    }
    function bindStoryPictureContextMenu(image, applicationScope) {
      if (!image || !applicationScope || applicationScope.disposed) return;
      const current = storyPictureContextMenuBindings.get(image);
      if (current?.scope === applicationScope) return;
      current?.release();
      const $image = $(image);
      if ($image.data("contextmenu")) return;
      const preventNativeContextMenu = function(event) {
        event.preventDefault();
      };
      const releaseListener = applicationScope.listenJQuery(
        $image,
        "contextmenu",
        preventNativeContextMenu
      );
      const record = {
        scope: applicationScope,
        released: false,
        release() {
          if (record.released) return;
          record.released = true;
          releaseListener();
          $image.removeData("contextmenu");
          if (storyPictureContextMenuBindings.get(image) === record) {
            storyPictureContextMenuBindings.delete(image);
          }
        }
      };
      storyPictureContextMenuBindings.set(image, record);
      $image.data("contextmenu", true);
      applicationScope.defer(record.release);
    }
    function processApplicationVideos(videos, mountRoot) {
      if (videos.length === 0) return;
      if (location.pathname.startsWith("/stories/")) {
        const isHighlight = location.pathname.startsWith(
          "/stories/highlights/"
        );
        const storyType = isHighlight ? "highlight" : "story";
        const controllerCandidates = new Set(
          USER_SETTING.HTML5_VIDEO_CONTROL ? videos.filter(
            (video) => !video.hasAttribute("data-controls")
          ) : []
        );
        refreshStoryVideoBehavior(mountRoot, storyType);
        for (const video of videos) {
          bindStoryThumbnailTimeupdate(video);
          if (!USER_SETTING.HTML5_VIDEO_CONTROL || controllerCandidates.has(video)) {
            toggleStoryVolumeSilder($(video), storyType);
          }
        }
      }
      for (const video of videos) bindGlobalVideoVolumeFallback(video);
    }
    function handleApplicationAddedNode(node, mountRoot) {
      if (location.pathname.startsWith("/stories/highlights/")) {
        if ($(node).attr("data-ih-locale-title") == null && $(node).attr("data-visualcompletion") == null && node.tagName === "DIV") {
          const $time = getHighlightCurrentTimeElement($(node));
          setTimeElementDateAndLocaleTime($time);
        }
      }
      processApplicationVideos(collectVideoElements(node), mountRoot);
    }
    function rescanApplicationMount(mountRoot) {
      processApplicationVideos(collectVideoElements(mountRoot), mountRoot);
    }
    function createCurrentReelVideoSurfaceAdapter() {
      return createReelVideoSurfaceAdapter({
        supportsLooping: activeLegacyRouteKind !== ROUTE_KIND.REELS
      });
    }
    initSettings();
    GM_addStyle(style);
    GM_addStyle(injectedButtonStyle);
    function loadApplicationTranslation(language) {
      const generation = ++applicationTranslationGeneration;
      return getTranslationText2(language).then((res) => {
        if (generation !== applicationTranslationGeneration) return;
        state.locale[language] = res;
        if (state.lang !== language) return;
        translationTextCache = null;
        repaintingTranslations();
        menuController.refresh();
        checkingScriptUpdate(300);
      }).catch((err) => {
        if (generation !== applicationTranslationGeneration) return;
        menuController.refresh();
        checkingScriptUpdate(300);
        if (!language.startsWith("en")) {
          console.error("getTranslationText catch error:", err);
        }
      });
    }
    const initialLanguage = state.lang;
    loadApplicationTranslation(initialLanguage);
    logger(
      "Script Loaded",
      GM_info.script.name,
      "version:",
      GM_info.script.version
    );
    purgeCache();
    function disposeLegacyRouteResources() {
      clearInterval(state.GL_repeat);
      state.GL_repeat = null;
      state.GL_observer.disconnect();
      state.GL_registerEventList.forEach((item) => {
        item.trigger.forEach((bindElement) => {
          $(item.element).off("click", bindElement);
        });
      });
      state.GL_registerEventList = [];
      $(".button_wrapper").remove();
      $(
        ".IG_DWSTORY, .IG_DWSTORY_ALL, .IG_DWSTORY_THUMBNAIL, .IG_DWSTORY_POSITION, .IG_DWNEWTAB, .IG_DWHISTORY, .IG_DWHISTORY_ALL, .IG_DWHINEWTAB, .IG_DWHISTORY_THUMBNAIL, .IG_DWHISTORY_POSITION, .IG_REELS_CONTROLS, #scrollWrapper, .insta-loader-reel-quality-hold"
      ).remove();
      $(".IG_POPUP_DIG_ROUTE").remove();
      removeImageViewer();
      $(".circle_wrapper").remove();
      state.bulkDownloadActive = false;
      $("[data-snig]").removeAttr("data-snig");
      state.pageLoaded = false;
    }
    const postFeedRouteAdapter = {
      mount(context) {
        mountLegacyRouteSurface(context, runPostFeedRouteCycle);
      },
      refresh(_change, context) {
        refreshLegacyRouteSurface(context, runPostFeedRouteCycle);
      },
      dispose(context) {
        disposeLegacyRouteSurface(context);
      }
    };
    const storyRouteAdapter = {
      mount(context) {
        mountLegacyRouteSurface(context, runStoryRouteCycle);
      },
      refresh(_change, context) {
        refreshLegacyRouteSurface(context, runStoryRouteCycle);
      },
      dispose(context) {
        disposeLegacyRouteSurface(context);
      }
    };
    const highlightRouteAdapter = {
      mount(context) {
        mountLegacyRouteSurface(context, runHighlightRouteCycle);
      },
      refresh(_change, context) {
        refreshLegacyRouteSurface(context, runHighlightRouteCycle);
      },
      dispose(context) {
        disposeLegacyRouteSurface(context);
      }
    };
    let activeProfileController = null;
    function createLegacyProfileController() {
      return new ProfileController({
        $,
        downloadIcon: SVG.DOWNLOAD,
        downloadIntent: media.MEDIA_INTENT.DOWNLOAD,
        environment: environment2,
        executeMediaDescriptor,
        getDownloadTitle: () => _i18nHTML("DW"),
        getHighResolutionProfile: getUserHighSizeProfile,
        getLocation: () => location,
        getUserInfo: getUserId,
        logger: (...messages) => logger(...messages),
        normalizeProfileAvatar: media.normalizeProfileAvatar,
        now: () => (/* @__PURE__ */ new Date()).getTime(),
        onError: (error) => console.error("[profile]", error),
        setLoading: updateLoadingBar
      });
    }
    const profileRouteAdapter = {
      mount(context) {
        mountLegacyRouteSurface(context, (route) => {
          activeProfileController = createLegacyProfileController();
          activeProfileController.mount(context);
          runProfileRouteCycle(route);
        });
      },
      refresh(change, context) {
        activeProfileController?.refresh(change);
        refreshLegacyRouteSurface(context, runProfileRouteCycle);
      },
      dispose(context) {
        activeProfileController?.dispose();
        activeProfileController = null;
        disposeLegacyRouteSurface(context);
      }
    };
    const singularReelControlsRouteAdapter = {
      mount(context) {
        mountLegacyRouteSurface(context, runSingularReelControlsRouteCycle);
      },
      refresh(_change, context) {
        refreshLegacyRouteSurface(context, runSingularReelControlsRouteCycle);
      },
      dispose(context) {
        disposeLegacyRouteSurface(context);
      }
    };
    const reelsControlsRouteAdapter = {
      mount(context) {
        mountLegacyRouteSurface(context, runReelsControlsRouteCycle);
      },
      refresh(_change, context) {
        refreshLegacyRouteSurface(context, runReelsControlsRouteCycle);
      },
      dispose(context) {
        disposeLegacyRouteSurface(context);
      }
    };
    function mountLegacyRouteSurface(context, runCycle) {
      activeLegacyRouteKind = context.route?.kind || null;
      activeLegacyRouteScope = context.scope;
      context.scope.defer(() => state.GL_observer.disconnect());
      runCycle(context.route);
    }
    function refreshLegacyRouteSurface(context, runCycle) {
      if (!context || activeLegacyRouteScope !== context.scope) return;
      runCycle(context.route);
    }
    function disposeLegacyRouteSurface(context) {
      if (!context || activeLegacyRouteScope === context.scope) {
        activeLegacyRouteKind = null;
        activeLegacyRouteScope = null;
      }
      disposeLegacyRouteResources();
    }
    function routeSetTimeout(callback, delay, ...args) {
      return activeLegacyRouteScope ? activeLegacyRouteScope.setTimeout(callback, delay, ...args) : setTimeout2(callback, delay, ...args);
    }
    function routeSetInterval(callback, delay, ...args) {
      return activeLegacyRouteScope ? activeLegacyRouteScope.setInterval(callback, delay, ...args) : setInterval(callback, delay, ...args);
    }
    function routeDelay(delay) {
      const scope = activeLegacyRouteScope;
      if (!scope) {
        return new Promise((resolve) => setTimeout2(resolve, delay));
      }
      return new Promise((resolve, reject) => {
        let completed = false;
        const releaseOnDispose = scope.defer(() => {
          if (completed) return;
          const error = new Error("Route-owned delay was cancelled.");
          error.name = "AbortError";
          reject(error);
        });
        scope.setTimeout(() => {
          completed = true;
          releaseOnDispose();
          resolve();
        }, delay);
      });
    }
    function ownRouteObserver(observer) {
      if (activeLegacyRouteScope) {
        activeLegacyRouteScope.defer(() => observer.disconnect());
      }
      return observer;
    }
    function runLegacySurfaceCycle(route, initializeSurface) {
      maximumReelPlaybackController.refresh();
      if (!document.body) return;
      if (document.hidden && state.currentURL === location.href && state.pageLoaded) {
        return;
      }
      if (route?.kind === ROUTE_KIND.IGNORED) {
        state.pageLoaded = false;
        return;
      }
      if (state.currentURL != location.href || !state.firstStarted || !state.pageLoaded) {
        logger("Main Timer", "triggering");
        clearInterval(state.GL_repeat);
        state.pageLoaded = false;
        state.firstStarted = true;
        state.currentURL = location.href;
        state.GL_observer.disconnect();
        if (USER_SETTING.SKIP_SHARED_WITH_YOU_DIALOG && window.location.search.includes("igsh")) {
          let tries = 0;
          const skipTimer = routeSetInterval(() => {
            tries += 1;
            if (!window.location.search.includes("igsh")) {
              clearInterval(skipTimer);
              return;
            }
            skipSharedWithYouDialog();
            if (tries >= 20) {
              clearInterval(skipTimer);
            }
          }, 200);
        }
        initializeSurface(route);
        checkingScriptUpdate(300);
        state.GL_referrer = new URL(location.href).pathname;
      }
    }
    function runPostFeedRouteCycle(route) {
      runLegacySurfaceCycle(route, (currentRoute) => {
        if (currentRoute.kind === ROUTE_KIND.FEED) {
          initializeFeedRoute();
        } else {
          initializePostControlsRoute();
        }
      });
    }
    function runStoryRouteCycle(route) {
      runLegacySurfaceCycle(route, initializeStoryRoute);
    }
    function runHighlightRouteCycle(route) {
      runLegacySurfaceCycle(route, initializeHighlightRoute);
    }
    function runProfileRouteCycle(route) {
      runLegacySurfaceCycle(route, () => {
        if (activeProfileController?.refresh({ type: "route-cycle" })) {
          logger("isProfile");
          state.pageLoaded = true;
          return;
        }
        removeLegacyStoryControls();
      });
    }
    function runSingularReelControlsRouteCycle(route) {
      runLegacySurfaceCycle(route, initializePostControlsRoute);
    }
    function runReelsControlsRouteCycle(route) {
      runLegacySurfaceCycle(route, initializeReelsControlsRoute);
    }
    function initializePostControlsRoute() {
      state.GL_dataCache.stories = {};
      state.GL_dataCache.highlights = {};
      logger("isDialog");
      const dialogTimer = routeSetInterval(() => {
        if ($(`body > div[class]:not([id^="mount"]) div div[role="dialog"] article,
                            section:visible > main > div > div > div > div > div > hr,
                            body > div[id^="mount"] section nav + div > article,
                            section:visible > main > div > div > article > div > div > div > div > div > header
                        `).length > 0) {
          clearInterval(dialogTimer);
          routeSetTimeout(() => {
            onReadyMyDW(false);
          }, 15);
        }
      }, buttonDetectionInterval);
      state.pageLoaded = true;
    }
    function initializeFeedRoute() {
      state.GL_dataCache.stories = {};
      state.GL_dataCache.highlights = {};
      const hasReferrer = state.GL_referrer?.match(/^\/(stories|highlights)\//gi) != null;
      logger("isHomepage", hasReferrer);
      routeSetTimeout(() => {
        onReadyMyDW(false, hasReferrer);
        const element = $(
          'div[id^="mount"] > div > div div > section > main div:not([class]):not([style]) > div > article'
        )?.parent()[0];
        if (element) {
          state.GL_observer.observe(element, {
            childList: true
          });
        }
      }, 150);
      state.pageLoaded = true;
    }
    function initializeReelsControlsRoute() {
      logger("isReelsPage");
      routeSetTimeout(() => {
        onReels(false);
      }, 150);
      state.pageLoaded = true;
    }
    function initializeHighlightRoute() {
      state.GL_dataCache.highlights = {};
      logger("isHighlightsStory");
      fireAndReport(
        () => onHighlightsStory(false),
        "onHighlightsStory()"
      );
      state.GL_repeat = routeSetInterval(() => {
        fireAndReport(
          () => onHighlightsStoryThumbnail(false),
          "onHighlightsStoryThumbnail()"
        );
      }, checkInterval);
      if ($(".IG_DWHISTORY").length) {
        markStorySurfaceLoadedAfterConfirmation();
      }
    }
    function initializeStoryRoute() {
      logger("isStory");
      if ($('div[id^="mount"] section > div > a[href="/"]').length > 0 || $('div[id^="mount"] section > div > a[href^="/?hl="]').length > 0 || $('div[id^="mount"] section i[aria-label="Instagram"]').length > 0) {
        $(".IG_DWSTORY").remove();
        $(".IG_DWNEWTAB").remove();
        if ($(".IG_DWSTORY_THUMBNAIL").length) {
          $(".IG_DWSTORY_THUMBNAIL").remove();
        }
        if ($(".IG_DWSTORY_POSITION").length) {
          $(".IG_DWSTORY_POSITION").remove();
        }
        fireAndReport(() => onStory(false), "onStory()");
        routeSetTimeout(() => {
          fireAndReport(() => onStory(false), "onStory()");
        }, 150);
      }
      if ($(".IG_DWSTORY").length) {
        markStorySurfaceLoadedAfterConfirmation();
      }
    }
    function markStorySurfaceLoadedAfterConfirmation() {
      routeSetTimeout(() => {
        if (USER_SETTING.SKIP_VIEW_STORY_CONFIRM) {
          const $viewStoryButton = $(
            'div[id^="mount"] section:last-child > div > div:not([class]) div:last-child > div[role="button"]'
          ).filter(function() {
            return $(this).children().length === 0 && this.textContent.trim() !== "";
          });
          $viewStoryButton?.trigger("click");
        }
        state.pageLoaded = true;
      }, 150);
    }
    function removeLegacyStoryControls() {
      state.pageLoaded = false;
      $(
        ".IG_DWSTORY, .IG_DWSTORY_ALL, .IG_DWNEWTAB, .IG_DWSTORY_THUMBNAIL, .IG_DWSTORY_POSITION, .IG_DWHISTORY, .IG_DWHISTORY_ALL, .IG_DWHINEWTAB, .IG_DWHISTORY_THUMBNAIL, .IG_DWHISTORY_POSITION"
      ).remove();
    }
    const legacyRouteControllerFactory = createRouteControllerFactory({
      adapters: {
        highlights: highlightRouteAdapter,
        posts: postFeedRouteAdapter,
        profiles: profileRouteAdapter,
        reelControls: singularReelControlsRouteAdapter,
        reelsControls: reelsControlsRouteAdapter,
        stories: storyRouteAdapter
      },
      environment: environment2,
      onError: (error, context) => logger("FeatureController", context?.phase || "error", error)
    });
    const routeCoordinator = new RouteCoordinator({
      environment: environment2,
      controllerFactory: legacyRouteControllerFactory,
      getClassificationOptions: () => ({
        splashVisible: $("div#splash-screen").length > 0 && !$("div#splash-screen").is(":hidden"),
        followersDialogOpen: $(`body > div[class]:not([id^="mount"]) div div[role="dialog"]`).length > 0
      }),
      isReady: () => true,
      onError: (error, context) => logger("RouteCoordinator", context?.phase || "error", error),
      pollInterval: checkInterval,
      refreshOnUnchanged: true
    });
    const applicationDomLifecycleService = new ApplicationDomLifecycleService({
      environment: environment2,
      findMountRoot: () => $('div[id^="mount"]')[0] || null,
      onAddedNode: handleApplicationAddedNode,
      onMountScan: rescanApplicationMount,
      registerPerformanceObserver,
      onError: (error, context) => logger(
        "ApplicationDomLifecycleService",
        context?.phase || "error",
        error
      )
    });
    const applicationCoordinator = createApplicationCoordinator({
      environment: environment2,
      routeCoordinator,
      globalServiceAdapters: [
        {
          name: "application-dom-lifecycle",
          adapter: {
            mount(context) {
              activeApplicationScope = context.scope;
              for (const request of pendingApplicationRequests) {
                context.scope.trackAbortable(request);
              }
              pendingApplicationRequests.clear();
              applicationDomLifecycleService.mount(context.scope);
            },
            refresh(change) {
              applicationDomLifecycleService.refresh(change);
            },
            dispose(context) {
              applicationDomLifecycleService.dispose();
              if (activeApplicationScope === context.scope) {
                activeApplicationScope = null;
              }
            }
          }
        },
        {
          name: "application-events",
          adapter: {
            mount(context) {
              mountApplicationEventHandlers(context.scope);
            }
          }
        },
        {
          name: "application-localization",
          adapter: {
            mount() {
              applicationLifecycleMountCount += 1;
              if (applicationLifecycleMountCount > 1 && state.locale[state.lang] == null) {
                loadApplicationTranslation(state.lang);
              }
            }
          }
        },
        {
          name: "image-cache",
          adapter: {
            mount(context) {
              context.scope.defer(() => imageCache.flush());
            }
          }
        },
        {
          name: "maximum-reel-playback",
          adapter: {
            mount() {
              if (maximumReelPlaybackController.disposed) {
                maximumReelPlaybackController = createMaximumReelPlaybackControllerInstance();
              }
              maximumReelPlaybackController.mount();
              if (pendingMaximumReelReloadHandoff) {
                const handoff = pendingMaximumReelReloadHandoff;
                pendingMaximumReelReloadHandoff = null;
                if (!maximumReelPlaybackController.adoptManualReloadHandoff(
                  handoff
                )) {
                  handoff.cancel("reload-handoff-not-adopted");
                }
              }
            },
            refresh() {
              maximumReelPlaybackController.refresh();
            },
            dispose() {
              maximumReelPlaybackController.dispose();
            }
          }
        }
      ],
      globalControllerFactory: () => [
        settingsController,
        hotkeyController,
        debugController,
        menuController
      ],
      onError: (error, context) => logger("ApplicationCoordinator", context?.phase || "error", error)
    });
    applicationCoordinator.start();
    applicationDomLifecycleService.refresh({
      reason: "route-coordinator-started",
      type: "application-start"
    });
    var timer = applicationCoordinator;
    function isLegacyStoryElementVisible(element) {
      return $(element).is(":visible");
    }
    function getLegacyStoryElementHeight(element) {
      return $(element).height();
    }
    function readLegacyStoryDomState() {
      return readStoryDomState(document, {
        pathname: location.pathname,
        isVisible: isLegacyStoryElementVisible,
        getHeight: getLegacyStoryElementHeight
      });
    }
    function readLegacyHighlightDomState(itemCount) {
      return readHighlightDomState(document, {
        pathname: location.pathname,
        href: location.href,
        itemCount,
        isVisible: isLegacyStoryElementVisible,
        getHeight: getLegacyStoryElementHeight
      });
    }
    function createLegacyStoryActionContext(surface, payload, domState, intent) {
      return createStoryActionContext({
        surface,
        payload,
        domState,
        settings: USER_SETTING,
        runtimeState: state,
        intent
      });
    }
    function getLegacyVisibleStoryImageUrl() {
      let srcset = $(
        "body > div section:visible img[referrerpolicy][class], body > div section:visible img[crossorigin][class]:not([alt])"
      ).attr("srcset")?.split(",")[0]?.split(" ")[0];
      let link = srcset ? srcset : $(
        "body > div section:visible img[referrerpolicy][class], body > div section:visible img[crossorigin][class]:not([alt])"
      ).filter(function() {
        return $(this).parents("a").length === 0 && $(this).width() === $(this).parent().width();
      }).attr("src");
      if (!link) {
        const $element = $("body > div section:visible img._aa63");
        link = $element.attr("srcset") ? $element.attr("srcset")?.split(",")[0]?.split(" ")[0] : $element.attr("src");
      }
      return link || null;
    }
    function normalizeLegacyStoryCurrentDescriptor(payload, actionContext, options) {
      const {
        imageCandidate,
        publishTime,
        shortcode,
        surface
      } = options;
      const descriptors = media.normalizeStorySurfaceMedia(payload, {
        surface,
        renamePublishDate: USER_SETTING.RENAME_PUBLISH_DATE,
        nowSeconds: Math.floor(Date.now() / 1e3),
        ...imageCandidate ? { imageCandidate } : {},
        videoCandidate: surface === STORY_SURFACE.HIGHLIGHT ? media.STORY_VIDEO_CANDIDATE.LAST : media.STORY_VIDEO_CANDIDATE.FIRST
      });
      const currentItem = actionContext.current.item;
      const descriptor = descriptors.find(
        (candidate) => candidate.rawMediaItem === currentItem || String(candidate.mediaId) === String(actionContext.current.mediaId)
      );
      if (!descriptor) return null;
      return {
        ...descriptor,
        owner: actionContext.owner || descriptor.owner,
        ...Object.prototype.hasOwnProperty.call(options, "publishTime") ? { publishTime } : {},
        ...Object.prototype.hasOwnProperty.call(options, "shortcode") ? { shortcode } : {},
        hasCanonicalMediaId: true
      };
    }
    function createLegacyStoryApiDescriptor(payload, actionContext, domState, options) {
      const normalized = normalizeLegacyStoryCurrentDescriptor(
        payload,
        actionContext,
        options
      );
      if (normalized) return normalized;
      const visibleVideo = $(
        "body > div section:visible video[playsinline]"
      ).first()[0];
      const visibleImageUrl = getLegacyVisibleStoryImageUrl();
      const kind = visibleVideo ? "video" : "image";
      const thumbnailUrl = visibleVideo?.getAttribute("poster") || domState?.thumbnail?.posterUrl || visibleImageUrl;
      const directUrl = visibleVideo?.currentSrc || visibleVideo?.getAttribute("src") || visibleImageUrl || thumbnailUrl || location.href;
      return {
        mediaId: actionContext.current.mediaId,
        directUrl,
        thumbnailUrl,
        kind,
        extension: kind === "video" ? "mp4" : "jpg",
        owner: actionContext.owner,
        shortcode: actionContext.current.mediaId,
        publishTime: null,
        carouselIndex: 1,
        rawMediaItem: actionContext.current.item,
        dashManifest: actionContext.current.item?.video_dash_manifest || null,
        hasCanonicalMediaId: true,
        sourceType: options.surface
      };
    }
    function getHighlightsStoryUsername() {
      let href = $('body > div section:visible a[href^="/"]').filter(function() {
        return $(this).attr("href").split("/").filter((e) => e.length > 0).length === 1;
      }).first().attr("href");
      return href?.split("/").filter((e) => e.length > 0).at(0);
    }
    function fireAndReport(action, context) {
      const report = (error) => {
        if (error?.category === "abort" || error?.name === "AbortError") {
          return void 0;
        }
        console.error(`${context} failed:`, error);
        logger(context, "reject", error?.message || error);
        return void 0;
      };
      try {
        return Promise.resolve(action()).catch(report);
      } catch (error) {
        report(error);
        return Promise.resolve(void 0);
      }
    }
    function storyActionErrorChainIncludes(error, predicate) {
      const visited = /* @__PURE__ */ new Set();
      let current = error;
      while (current != null && (typeof current === "object" || typeof current === "function") && !visited.has(current)) {
        if (predicate(current)) return true;
        visited.add(current);
        current = current.cause;
      }
      return error === -1 && predicate(error);
    }
    function isStoryActionAbort(error) {
      return storyActionErrorChainIncludes(
        error,
        (candidate) => candidate?.category === "abort" || candidate?.name === "AbortError"
      );
    }
    function isStoryActionErrorReported(error) {
      return storyActionErrorChainIncludes(
        error,
        (candidate) => candidate === -1 || candidate?.alreadyReported === true
      );
    }
    function getStoryActionFailureDetails(error) {
      const visited = /* @__PURE__ */ new Set();
      let current = error;
      while (current != null && (typeof current === "object" || typeof current === "function") && !visited.has(current)) {
        visited.add(current);
        if (current.url || current.status || current.category) {
          return {
            category: current.category || null,
            status: current.status || null,
            url: current.url || null
          };
        }
        current = current.cause;
      }
      return { category: null, status: null, url: null };
    }
    function createStorySurfaceRouteCancellation(scope) {
      let armed = true;
      let cancelled = false;
      let release = () => {
      };
      const createAbortError2 = () => new RequestError(
        REQUEST_ERROR_CATEGORY.ABORT,
        "The Story or Highlight route was disposed."
      );
      const promise = new Promise((_resolve, reject) => {
        const abort = () => {
          if (!armed) return;
          cancelled = true;
          armed = false;
          reject(createAbortError2());
        };
        if (!scope || scope.disposed) {
          abort();
          return;
        }
        const releaseScopeCleanup = scope.defer(abort);
        release = () => {
          if (!armed) return;
          armed = false;
          releaseScopeCleanup();
        };
      });
      return {
        operationOptions: createDownloadOperationOptions(),
        promise,
        release,
        throwIfCancelled() {
          if (cancelled || !scope || scope.disposed) {
            throw createAbortError2();
          }
        }
      };
    }
    function throwIfStorySurfaceActionCancelled(actionLifecycle) {
      actionLifecycle?.throwIfCancelled?.();
    }
    function createStorySurfaceMediaActionOptions(actionLifecycle) {
      if (!actionLifecycle) return {};
      return {
        operationOptions: actionLifecycle.operationOptions,
        throwIfCancelled: () => throwIfStorySurfaceActionCancelled(actionLifecycle)
      };
    }
    function runStorySurfaceAction(action, context) {
      if (activeStorySurfaceAction) return activeStorySurfaceAction;
      const routeCancellation = createStorySurfaceRouteCancellation(
        activeLegacyRouteScope
      );
      updateLoadingBar(true);
      const actionPromise = Promise.resolve().then(
        () => action(routeCancellation)
      );
      const task = Promise.race([actionPromise, routeCancellation.promise]).catch((error) => {
        if (isStoryActionAbort(error)) return void 0;
        const failureDetails = getStoryActionFailureDetails(error);
        console.error(`${context} failed:`, error, failureDetails);
        logger(context, "reject", error?.message || error, failureDetails);
        if (!isStoryActionErrorReported(error)) {
          alert(STORY_SURFACE_ACTION_FAILURE_MESSAGE);
        }
        return void 0;
      }).finally(() => {
        routeCancellation.release();
        updateLoadingBar(false);
        if (activeStorySurfaceAction === task) {
          activeStorySurfaceAction = null;
        }
      });
      activeStorySurfaceAction = task;
      return task;
    }
    async function downloadStoryBatchDescriptor(descriptor, allowDash, actionLifecycle) {
      throwIfStorySurfaceActionCancelled(actionLifecycle);
      return await executeMediaDescriptor(
        descriptor,
        media.MEDIA_INTENT.DOWNLOAD,
        {
          ...createStorySurfaceMediaActionOptions(actionLifecycle),
          useMediaApi: allowDash && descriptor.kind === "video" && !state.tempFetchRateLimit,
          useDash: allowDash,
          markMediaApiFallback: allowDash
        }
      );
    }
    function scheduleStoryBatchDownloads(payload, surface, allowDash = false, actionLifecycle) {
      throwIfStorySurfaceActionCancelled(actionLifecycle);
      const descriptors = buildStoryBatchDescriptors(payload, {
        surface,
        renamePublishDate: USER_SETTING.RENAME_PUBLISH_DATE,
        nowSeconds: Math.floor(Date.now() / 1e3)
      });
      let complete = 0;
      setDownloadProgress(complete, descriptors.length);
      descriptors.forEach((descriptor, index) => {
        routeSetTimeout(() => {
          fireAndReport(
            () => downloadStoryBatchDescriptor(
              descriptor,
              allowDash,
              actionLifecycle
            ).then(() => {
              throwIfStorySurfaceActionCancelled(actionLifecycle);
              setDownloadProgress(++complete, descriptors.length);
            }),
            "downloadStoryBatchDescriptor()"
          );
        }, 100 * index);
      });
    }
    async function onHighlightsStoryAll(actionLifecycle) {
      throwIfStorySurfaceActionCancelled(actionLifecycle);
      let highlightId = location.href.replace(/\/$/gi, "").split("/").at(-1);
      let highStories = await getHighlightStories(highlightId);
      throwIfStorySurfaceActionCancelled(actionLifecycle);
      if (USER_SETTING.DIRECT_DOWNLOAD_STORY) {
        scheduleStoryBatchDownloads(
          highStories,
          STORY_SURFACE.HIGHLIGHT,
          true,
          actionLifecycle
        );
      } else {
        throwIfStorySurfaceActionCancelled(actionLifecycle);
        IG_createDM(false, true, true);
        createStoryListDOM(highStories, "highlights");
      }
    }
    async function onHighlightsStory(isDownload, isPreview, actionLifecycle) {
      var username = getHighlightsStoryUsername();
      if (isDownload) {
        throwIfStorySurfaceActionCancelled(actionLifecycle);
        let date = (/* @__PURE__ */ new Date()).getTime();
        let timestamp = Math.floor(date / 1e3);
        let highlightId = location.href.replace(/\/$/gi, "").split("/").at(-1);
        let highStories;
        if (state.GL_dataCache.highlights[highlightId]) {
          logger("Fetch from memory cache:", highlightId);
          highStories = state.GL_dataCache.highlights[highlightId];
        } else {
          highStories = await getHighlightStories(highlightId);
          throwIfStorySurfaceActionCancelled(actionLifecycle);
          state.GL_dataCache.highlights[highlightId] = highStories;
        }
        const domState = readLegacyHighlightDomState(
          highStories.data.reels_media[0].items.length
        );
        const actionContext = createLegacyStoryActionContext(
          STORY_SURFACE.HIGHLIGHT,
          highStories,
          domState,
          isPreview ? STORY_INTENT.PREVIEW : STORY_INTENT.DOWNLOAD
        );
        const responseCacheKey = actionContext.responseCacheKey || highlightId;
        const target = actionContext.current.item;
        username = actionContext.owner || username;
        logger(
          "onHighlightsStory",
          responseCacheKey,
          state.GL_dataCache.highlights[responseCacheKey]
        );
        if (actionContext.mediaApiPolicy.renamePublishDate) {
          timestamp = target.taken_at_timestamp;
        }
        const descriptor = normalizeLegacyStoryCurrentDescriptor(
          highStories,
          actionContext,
          {
            imageCandidate: media.STORY_IMAGE_CANDIDATE.LAST,
            surface: STORY_SURFACE.HIGHLIGHT
          }
        );
        if (!descriptor) {
          throw new Error("Cannot resolve the current Highlight resource.");
        }
        let usedImageCache = false;
        await executeMediaDescriptor(
          descriptor,
          isPreview ? media.MEDIA_INTENT.PREVIEW : media.MEDIA_INTENT.DOWNLOAD,
          {
            ...createStorySurfaceMediaActionOptions(actionLifecycle),
            defaultTimestamp: timestamp,
            deferMediaApiRequestFailureAlert: true,
            includeIndex: false,
            logMediaApiError: true,
            swallowMediaApiFailure: true,
            onMediaApiFallback: async () => {
              delete state.GL_dataCache.highlights[responseCacheKey];
              state.tempFetchRateLimit = true;
              return await onHighlightsStory(
                true,
                isPreview,
                actionLifecycle
              );
            },
            onOutput: (context) => {
              if (context.source === "cache") {
                usedImageCache = true;
                logger("[Restore Cached onHighlight]", target.id);
              }
            },
            outputShortcode: (context) => context.source === "media-api" ? context.descriptor.rawMediaItem?.id || target.id : target.id,
            replacePreviewHost: false,
            retainFirstMediaApiImageCandidate: true,
            resolveMissingOwner: false,
            useDash: actionContext.mediaApiPolicy.requestDash,
            useDashForPreview: actionContext.mediaApiPolicy.requestDash,
            useImageCache: actionContext.mediaApiPolicy.useImageCache,
            useMediaApi: actionContext.mediaApiPolicy.requestMediaApi
          }
        );
        if (usedImageCache) return;
        if (!actionContext.mediaApiPolicy.requestMediaApi) {
          state.tempFetchRateLimit = false;
        }
      } else {
        if (!$(".IG_DWHISTORY").length) {
          let $element = null;
          if ($("body > div section._ac0a").length > 0) {
            $element = $("body > div section:visible._ac0a");
          } else {
            $element = $(
              "body > div section:visible > div > div[style]:not([class])"
            );
            $element.css("position", "relative");
          }
          if ($element.length === 0) {
            let $$element = $(
              "body > div div:not([hidden]) section:visible > div div[class][style] > div[style]:not([class])"
            );
            let nowSize = 0;
            $$element.each(function() {
              if ($(this).width() > nowSize) {
                nowSize = $(this).width();
                $element = $(this).children("div").first();
              }
            });
          }
          if ($element != null) {
            $element.append(
              `<div data-ih-locale-title="DW" title="${_i18nHTML("DW")}" class="IG_DWHISTORY">${SVG.DOWNLOAD}</div>`
            );
            $element.append(
              `<div data-ih-locale-title="NEW_TAB" title="${_i18nHTML("NEW_TAB")}" class="IG_DWHINEWTAB">${SVG.NEW_TAB}</div>`
            );
            let $header = getStoryProgress(username);
            if ($header.length > 1) {
              $element.append(
                `<div data-ih-locale-title="DW_ALL" title="${_i18nHTML("DW_ALL")}" class="IG_DWHISTORY_ALL">${SVG.DOWNLOAD_ALL}</div>`
              );
            }
            setStoryProgressIndexText($element, $header, "IG_DWHISTORY_POSITION");
            setTimeElementDateAndLocaleTime(
              getHighlightCurrentTimeElement($header)
            );
            $element.find("img[referrerpolicy]").each(function() {
              bindStoryImageLoad(this, $element, "highlight");
            });
          }
        }
      }
    }
    async function onHighlightsStoryThumbnail(isDownload, actionLifecycle) {
      if (isDownload) {
        throwIfStorySurfaceActionCancelled(actionLifecycle);
        let date = (/* @__PURE__ */ new Date()).getTime();
        let timestamp = Math.floor(date / 1e3);
        let highlightId = location.href.replace(/\/$/gi, "").split("/").at(-1);
        let username = "";
        let highStories;
        if (state.GL_dataCache.highlights[highlightId]) {
          logger("Fetch from memory cache:", highlightId);
          highStories = state.GL_dataCache.highlights[highlightId];
        } else {
          highStories = await getHighlightStories(highlightId);
          throwIfStorySurfaceActionCancelled(actionLifecycle);
          state.GL_dataCache.highlights[highlightId] = highStories;
        }
        const domState = readLegacyHighlightDomState(
          highStories.data.reels_media[0].items.length
        );
        const actionContext = createLegacyStoryActionContext(
          STORY_SURFACE.HIGHLIGHT,
          highStories,
          domState,
          STORY_INTENT.THUMBNAIL
        );
        const responseCacheKey = actionContext.responseCacheKey || highlightId;
        const target = actionContext.current.item;
        username = actionContext.owner || username;
        if (actionContext.mediaApiPolicy.renamePublishDate) {
          timestamp = target.taken_at_timestamp;
        }
        const descriptor = normalizeLegacyStoryCurrentDescriptor(
          highStories,
          actionContext,
          {
            imageCandidate: media.STORY_IMAGE_CANDIDATE.LAST,
            surface: STORY_SURFACE.HIGHLIGHT
          }
        );
        if (!descriptor) {
          throw new Error("Cannot resolve the current Highlight thumbnail.");
        }
        let usedImageCache = false;
        await executeMediaDescriptor(
          descriptor,
          media.MEDIA_INTENT.THUMBNAIL,
          {
            ...createStorySurfaceMediaActionOptions(actionLifecycle),
            allowMediaApiForThumbnail: true,
            defaultTimestamp: timestamp,
            deferMediaApiRequestFailureAlert: true,
            includeIndex: false,
            logMediaApiError: true,
            swallowMediaApiFailure: true,
            onMediaApiFallback: async () => {
              delete state.GL_dataCache.highlights[responseCacheKey];
              state.tempFetchRateLimit = true;
              return await onHighlightsStoryThumbnail(
                true,
                actionLifecycle
              );
            },
            onOutput: (context) => {
              if (context.source === "cache") {
                usedImageCache = true;
                logger(
                  "[Restore Cached onHighlightsStoryThumbnail]",
                  target.id
                );
              }
            },
            outputShortcode: (context) => context.source === "cache" ? target.id : highlightId,
            retainFirstMediaApiImageCandidate: true,
            resolveMissingOwner: false,
            thumbnailSourceType: "highlights",
            useDash: false,
            useImageCache: actionContext.mediaApiPolicy.useImageCache,
            useMediaApi: actionContext.mediaApiPolicy.requestMediaApi
          }
        );
        if (usedImageCache) return;
        if (!actionContext.mediaApiPolicy.requestMediaApi) {
          state.tempFetchRateLimit = false;
        }
      } else {
        setStoryProgressIndexByUsername(
          $(".IG_DWHISTORY").parent(),
          getHighlightsStoryUsername(),
          "IG_DWHISTORY_POSITION"
        );
        if ($("body > div section video.xh8yej3").length) {
          if (!$(".IG_DWHISTORY_THUMBNAIL").length) {
            let $element = null;
            if ($("body > div section._ac0a").length > 0) {
              $element = $("body > div section:visible._ac0a");
            } else {
              $element = $(
                "body > div section:visible > div > div[style]:not([class])"
              );
              $element.css("position", "relative");
            }
            if ($element.length === 0) {
              let $$element = $(
                "body > div div:not([hidden]) section:visible > div div[class][style] > div[style]:not([class])"
              );
              let nowSize = 0;
              $$element.each(function() {
                if ($(this).width() > nowSize) {
                  nowSize = $(this).width();
                  $element = $(this).children("div").first();
                }
              });
            }
            if ($element != null) {
              $element.append(
                `<div data-ih-locale-title="VIDEO_THUMBNAIL" title="${_i18nHTML("VIDEO_THUMBNAIL")}" class="IG_DWHISTORY_THUMBNAIL">${SVG.THUMBNAIL}</div>`
              );
            }
          }
        } else {
          $(".IG_DWHISTORY_THUMBNAIL").remove();
        }
      }
    }
    function onReadyMyDW(NoDialog, hasReferrer) {
      if (hasReferrer === true) {
        logger("hasReferrer", "regenerated");
        $('article[data-snig="canDownload"], div[data-snig="canDownload"]').filter(function() {
          return $(this).find(".IG_DW_MAIN").length === 0;
        }).removeAttr("data-snig");
      }
      if (NoDialog == false) {
        const maxCall = 100;
        let i = 0;
        var repeat = routeSetInterval(() => {
          if (i > maxCall || $(
            'article[data-snig="canDownload"], section:visible > main > div > div[data-snig="canDownload"] > div > div > div > hr, div[id^="mount"] > div > div > div.x1n2onr6.x1vjfegm div[data-snig="canDownload"]'
          ).length > 0) {
            clearInterval(repeat);
            if (i > maxCall) {
              console.warn(
                "onReadyMyDW() Timer",
                "maximum number of repetitions reached, terminated"
              );
            }
          }
          logger(
            "onReadyMyDW() Timer",
            "repeating to call detection createDownloadButton()"
          );
          createDownloadButton();
          i++;
        }, buttonDetectionInterval);
      } else {
        createDownloadButton();
      }
    }
    function initPostVideoFunction($mainElement) {
      refreshRouteVideoBehavior(
        postVideoBehaviorServices,
        $mainElement.first()[0],
        createPostVideoSurfaceAdapter
      );
      var $buttonParent = $mainElement.find("video + div > div").first();
      toggleVolumeSilder(
        () => $mainElement.find("video").get(),
        $buttonParent,
        "post",
        "bottom"
      );
    }
    function resolveLegacyPostContext($mainElement, actionElement, visibleIndexSource = "main") {
      return resolvePostContext({
        mainElement: $mainElement.first()[0],
        actionElement,
        pathname: location.pathname,
        resolveVisibleIndex: (host) => getVisibleNodeIndex($(host)),
        visibleIndexSource
      });
    }
    function appendLegacyPostImageRow(imgLink, publishTime, carouselIndex) {
      const descriptor = {
        mediaId: `legacy-url:${imgLink}`,
        directUrl: imgLink,
        thumbnailUrl: imgLink,
        kind: "image",
        extension: "jpg",
        owner: state.GL_username || null,
        shortcode: state.GL_postPath || null,
        publishTime,
        carouselIndex,
        rawMediaItem: null,
        dashManifest: null,
        hasCanonicalMediaId: false,
        sourceType: "photo"
      };
      renderMediaDescriptor($(MEDIA_LIST_SELECTOR), descriptor);
    }
    const LEGACY_POST_RESOURCE_COUNT_SELECTOR = "*:not([data-pagelet])>*:not([role]):not([data-pagelet])>*>*>*[role]>*>ul[class] li[class]";
    function setupLegacyPostCarouselCounter($mainElement) {
      if ($mainElement.find("._acay").length === 0) return;
      if ($mainElement.find("._acay + .x24i39r").length > 0) {
        $mainElement.find("._acay + .x24i39r").css("top", "37px");
      }
      const observeNode = $mainElement.find("._acay").first().parent()[0];
      const observer = ownRouteObserver(
        new MutationObserver(function() {
          $mainElement.find("._acay + .x24i39r").css("top", "37px");
        })
      );
      observer.observe(observeNode, {
        childList: true
      });
    }
    function setupLegacyPostMediaObservers($mainElement, $childElement, thumbnailElement, viewerElement) {
      routeSetTimeout(() => {
        const checkNodeCallback = (entries, observer2) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              var $targetNode = $(entry.target);
              $childElement.find(".IG_THUMBNAIL_MAIN")?.remove();
              $childElement.find(".IG_IMAGE_VIEWER")?.remove();
              if ($targetNode.find("video").length > 0) {
                if ($childElement.find(".IG_THUMBNAIL_MAIN").length === 0) {
                  $childElement.find(".button_wrapper").append(thumbnailElement);
                }
                initPostVideoFunction($mainElement);
              } else {
                $childElement.find(".button_wrapper").append(viewerElement);
              }
            }
          });
        };
        const observer_i = ownRouteObserver(
          typeof IntersectionObserver === "function" ? new IntersectionObserver(checkNodeCallback, {
            root: $childElement.find(".button_wrapper").parent()[0],
            rootMargin: "0px",
            threshold: 0.1
          }) : {
            disconnect() {
            },
            observe(target) {
              checkNodeCallback([{ isIntersecting: true, target }], this);
            }
          }
        );
        const observer = ownRouteObserver(
          new MutationObserver(function(mutation, owner) {
            var target = mutation.at(0)?.target;
            observer_i.disconnect();
            $(target).find("li").each(function() {
              if ($(target).find("video").length > 0 || $(target).find("img").length > 0) {
                observer_i.observe(this);
              }
            });
          })
        );
        let $triggeredTarget = null;
        $childElement.find(".button_wrapper").parent().find('ul li, div[role="button"] > div, div[class] > div').each(function() {
          const $targetNode = $(this).find("video").length > 0 ? $(this).find("video")?.first() : $(this).find("img")?.first();
          if ($targetNode.length > 0 && $targetNode.is(":visible") && $targetNode.get(0).getBoundingClientRect().width > 0 && $targetNode.get(0).getBoundingClientRect().height > 0 && this.getBoundingClientRect().width > 64 && this.getBoundingClientRect().height > 64 && $triggeredTarget?.get(0) != $targetNode?.get(0)) {
            if ($targetNode.get(0).tagName === "IMG" && $targetNode.attr("alt")?.length == 0) {
              return;
            }
            $triggeredTarget = $targetNode;
            observer_i.observe(this);
          }
        });
        const listRoot = $childElement.find(".button_wrapper").parent().find('ul li, div[role="button"] > div').first().parent()[0];
        if (listRoot) {
          observer.observe(listRoot, {
            attributes: true,
            childList: true
          });
        } else {
          initPostVideoFunction($mainElement);
          logger(
            "Cannot find resource list root element, thumbnail and viewer button may not work."
          );
        }
      }, 50);
    }
    function mountLegacyPostControls($mainElement, $childElement, tagName) {
      setupLegacyPostCarouselCounter($mainElement);
      $childElement.eq(tagName === "DIV" ? 0 : $childElement.length - 2).append(`<div class="button_wrapper">`);
      const downloadElement = `<div data-ih-locale-title="DW" title="${_i18nHTML("DW")}" class="IG_DW_MAIN">${SVG.DOWNLOAD}</div>`;
      const newTabElement = `<div data-ih-locale-title="NEW_TAB" title="${_i18nHTML("NEW_TAB")}" class="IG_NEWTAB_MAIN">${SVG.NEW_TAB}</div>`;
      const thumbnailElement = `<div data-ih-locale-title="VIDEO_THUMBNAIL" title="${_i18nHTML("VIDEO_THUMBNAIL")}" class="IG_THUMBNAIL_MAIN">${SVG.THUMBNAIL}</div>`;
      const viewerElement = `<div data-ih-locale-title="IMAGE_VIEWER" title="${_i18nHTML("IMAGE_VIEWER")}" class="IG_IMAGE_VIEWER">${SVG.FULLSCREEN}</div>`;
      $childElement.find(".button_wrapper").append(downloadElement);
      const resource_count = $mainElement.find(
        LEGACY_POST_RESOURCE_COUNT_SELECTOR
      ).length;
      if (resource_count > 1 && USER_SETTING.DIRECT_DOWNLOAD_VISIBLE_RESOURCE && !USER_SETTING.DIRECT_DOWNLOAD_ALL) {
        const downloadAllElement = `<div data-ih-locale-title="DW_ALL" title="${_i18nHTML("DW_ALL")}" class="IG_DW_ALL_MAIN">${SVG.DOWNLOAD_ALL}</div>`;
        $childElement.find(".button_wrapper").append(downloadAllElement);
      }
      $childElement.find(".button_wrapper").append(newTabElement);
      const $resourceLayout = $childElement.filter(function() {
        return $(this).width() > 100 && $(this).height() > 100;
      }).first();
      const $isNewPostStyleLayout = $resourceLayout.find(`a[role="link"][tabindex="0"][href^="/"]`).filter(function() {
        return !$(this).attr("href").startsWith("/p/") && !$(this).attr("href").startsWith("/reels/");
      }).length > 0;
      if ($isNewPostStyleLayout) {
        $childElement.find(".button_wrapper").css("top", "45px");
      }
      setupLegacyPostMediaObservers(
        $mainElement,
        $childElement,
        thumbnailElement,
        viewerElement
      );
      $childElement.css("position", "relative");
    }
    async function handleLegacyPostImageViewerAction(e, actionElement, $mainElement) {
      consumeInjectedClick(e);
      if (state.bulkDownloadActive) return;
      updateLoadingBar(true);
      try {
        const postContext = resolveLegacyPostContext(
          $mainElement,
          actionElement
        );
        state.GL_username = postContext.owner;
        state.GL_postPath = postContext.shortcode;
        var index = postContext.visibleIndex;
        IG_createDM(true, false, true);
        await createMediaListDOM(state.GL_postPath, MEDIA_LIST_SELECTOR, "");
        var $linkElement = getMediaListLinkByIndex(index);
        if ($linkElement == null || $linkElement.length === 0) {
          console.error("Cannot find image viewer link element.", {
            index,
            postPath: state.GL_postPath
          });
          alert("Cannot find resource url.");
          return;
        }
        var href = getMediaDescriptorForElement($linkElement.first()[0]).directUrl;
        if (href) {
          let viewerHref = href;
          try {
            viewerHref = replaceSameOriginHost(href);
          } catch (err) {
            logger(
              "Open image viewer",
              "replaceSameOriginHost failed, using original href",
              err?.message || err
            );
          }
          openImageViewer(viewerHref);
        } else {
          console.error("Cannot find image viewer data-href.", {
            index,
            postPath: state.GL_postPath,
            linkElement: $linkElement?.get(0)
          });
          alert("Cannot find resource url.");
        }
      } catch (err) {
        console.error("Failed to open image viewer:", err);
        alert("Cannot find resource url.");
      } finally {
        updateLoadingBar(false);
        removeMediaDialog();
      }
    }
    function handleLegacyPostThumbnailAction(e, actionElement, $mainElement) {
      consumeInjectedClick(e);
      if (state.bulkDownloadActive) return;
      updateLoadingBar(true);
      const postContext = resolveLegacyPostContext($mainElement, actionElement);
      state.GL_username = postContext.owner;
      state.GL_postPath = postContext.shortcode;
      var index = postContext.visibleIndex;
      IG_createDM(true, false, true);
      createMediaListDOM(state.GL_postPath, MEDIA_LIST_SELECTOR, "").then(() => {
        var $videoThumbnail = getMediaListLinkByIndex(index)?.parent().find(".videoThumbnail")?.first();
        if ($videoThumbnail != null && $videoThumbnail.length > 0) {
          $videoThumbnail.trigger("click");
        } else {
          alert("Cannot find thumbnail URL.");
        }
        updateLoadingBar(false);
        removeMediaDialog();
      });
    }
    async function handleLegacyPostNewTabAction(e, actionElement, $mainElement) {
      consumeInjectedClick(e);
      if (state.bulkDownloadActive) return;
      updateLoadingBar(true);
      try {
        const postContext = resolveLegacyPostContext(
          $mainElement,
          actionElement
        );
        state.GL_username = postContext.owner;
        state.GL_postPath = postContext.shortcode;
        var index = postContext.visibleIndex;
        IG_createDM(true, false, true);
        await createMediaListDOM(state.GL_postPath, MEDIA_LIST_SELECTOR, "");
        var $linkElement = getMediaListLinkByIndex(index);
        if ($linkElement == null || $linkElement.length === 0) {
          console.error("Cannot find new-tab link element.", {
            index,
            postPath: state.GL_postPath
          });
          alert("Cannot find open tab URL.");
          return;
        }
        await executeMediaDescriptor(
          getMediaDescriptorForElement($linkElement.first()[0]),
          media.MEDIA_INTENT.PREVIEW,
          {
            useMediaApi: USER_SETTING.FORCE_RESOURCE_VIA_MEDIA && USER_SETTING.NEW_TAB_ALWAYS_FORCE_MEDIA_IN_POST
          }
        );
      } catch (err) {
        console.error("Failed to open resource in new tab:", err);
        alert("Cannot find open tab URL.");
      } finally {
        updateLoadingBar(false);
        removeMediaDialog();
      }
    }
    async function handleLegacyPostDownloadAllAction(e, actionElement, $mainElement) {
      consumeInjectedClick(e);
      const $downloadAllButton = $(actionElement);
      if (state.bulkDownloadActive || $downloadAllButton.hasClass("is-busy")) {
        return;
      }
      state.bulkDownloadActive = true;
      $downloadAllButton.addClass("is-busy").attr("aria-busy", "true");
      try {
        const postContext = resolveLegacyPostContext(
          $mainElement,
          actionElement
        );
        state.GL_username = postContext.owner;
        state.GL_postPath = postContext.shortcode;
        const descriptors = await fetchPostBatchDescriptors(
          state.GL_postPath
        );
        if (descriptors.length === 0) {
          throw new Error("No downloadable media found for this post.");
        }
        await batchDownloadPostDescriptors(descriptors);
      } catch (err) {
        console.error("Failed to download all post media:", err);
        alert("Cannot find downloadable media for this post.");
      } finally {
        state.bulkDownloadActive = false;
        $downloadAllButton.removeClass("is-busy").removeAttr("aria-busy");
      }
    }
    async function handleLegacyPostDownloadAction(e, actionElement, $mainElement) {
      consumeInjectedClick(e);
      if (state.bulkDownloadActive) return;
      const postContext = resolveLegacyPostContext(
        $mainElement,
        actionElement,
        "action"
      );
      state.GL_username = postContext.owner;
      state.GL_postPath = postContext.shortcode;
      IG_createDM(USER_SETTING.DIRECT_DOWNLOAD_ALL, true, true);
      $("#article-id").html(
        `<a href="https://www.instagram.com/p/${state.GL_postPath}">${state.GL_postPath}</a>`
      );
      if (USER_SETTING.DIRECT_DOWNLOAD_VISIBLE_RESOURCE) {
        updateLoadingBar(true);
        IG_setDM(true);
        var index = postContext.visibleIndex;
        await createMediaListDOM(state.GL_postPath, MEDIA_LIST_SELECTOR, "");
        var $linkElement = getMediaListLinkByIndex(index);
        var href = $linkElement?.attr("data-href");
        if ($linkElement == null || $linkElement.length === 0) {
          console.error("Cannot find download link element.", {
            index,
            postPath: state.GL_postPath
          });
          alert("Cannot find download URL.");
        } else if (href) {
          updateLoadingBar(false);
          await triggerLinkElement($linkElement[0]);
        } else {
          console.error("Cannot find download data-href.", {
            index,
            postPath: state.GL_postPath,
            linkElement: $linkElement?.get(0)
          });
          alert("Cannot find download URL.");
        }
        updateLoadingBar(false);
        removeMediaDialog();
        return;
      }
      const $actionElement = $(actionElement);
      if (!USER_SETTING.DIRECT_DOWNLOAD_ALL) {
        var s = 0;
        var multiple = $actionElement.parent().parent().find(LEGACY_POST_RESOURCE_COUNT_SELECTOR).length;
        var blob = USER_SETTING.FORCE_FETCH_ALL_RESOURCES;
        var publish_time = new Date(
          $actionElement.parent().parent().parent().find("a[href] time[datetime]").filter(function() {
            let href2 = $(this).parents("a[href]").attr("href");
            return href2?.startsWith("/p/") || href2?.match(/\/([\w.\-_]+)\/p\//gi) != null;
          }).first().attr("datetime")
        ).getTime();
        if (multiple) {
          $actionElement.parent().parent().find(LEGACY_POST_RESOURCE_COUNT_SELECTOR).each(function() {
            let element_videos = $(this).parent().parent().parent().find("video");
            if (element_videos && element_videos.attr("src")) {
              blob = true;
            }
          });
          if (blob || USER_SETTING.FORCE_RESOURCE_VIA_MEDIA) {
            createMediaListDOM(
              state.GL_postPath,
              ".IG_POPUP_DIG .IG_POPUP_DIG_MAIN .IG_POPUP_DIG_BODY",
              _i18n("LOAD_BLOB_MULTIPLE")
            );
          } else {
            $actionElement.parent().parent().find(LEGACY_POST_RESOURCE_COUNT_SELECTOR).each(function() {
              s++;
              let element_videos = $(this).find("video");
              let element_images = $(this).find("._aagv img");
              let imgLink = element_images.attr("srcset") ? element_images.attr("srcset").split(" ")[0] : element_images.attr("src");
              if (element_videos && element_videos.attr("src")) {
                blob = true;
              }
              if (element_images && imgLink) {
                appendLegacyPostImageRow(imgLink, publish_time, s);
              }
            });
            if (blob) {
              createMediaListDOM(
                state.GL_postPath,
                ".IG_POPUP_DIG .IG_POPUP_DIG_MAIN .IG_POPUP_DIG_BODY",
                _i18n("LOAD_BLOB_RELOAD")
              );
            }
          }
        } else {
          if (USER_SETTING.FORCE_RESOURCE_VIA_MEDIA) {
            createMediaListDOM(
              state.GL_postPath,
              ".IG_POPUP_DIG .IG_POPUP_DIG_MAIN .IG_POPUP_DIG_BODY",
              _i18n("LOAD_BLOB_MULTIPLE")
            );
          } else {
            s++;
            let element_videos = $actionElement.parent().parent().parent().find("video");
            let element_images = $actionElement.parent().parent().parent().find("._aagv img");
            let imgLink = element_images.attr("srcset") ? element_images.attr("srcset").split(" ")[0] : element_images.attr("src");
            if (element_videos && element_videos.attr("src")) {
              createMediaListDOM(
                state.GL_postPath,
                ".IG_POPUP_DIG .IG_POPUP_DIG_MAIN .IG_POPUP_DIG_BODY",
                _i18n("LOAD_BLOB_ONE")
              );
            }
            if (element_images && imgLink) {
              appendLegacyPostImageRow(imgLink, publish_time, s);
            }
          }
        }
      }
      $(".IG_POPUP_DIG .IG_POPUP_DIG_MAIN .IG_POPUP_DIG_BODY a").each(
        function() {
          $(this).wrap("<div></div>");
          $(this).before(
            '<label class="inner_box_wrapper"><input class="inner_box" type="checkbox"><span></span></label>'
          );
          $(this).after(
            `<div data-ih-locale-title="NEW_TAB" title="${_i18nHTML("NEW_TAB")}" class="newTab">${SVG.NEW_TAB}</div>`
          );
          if ($(this).attr("data-name") == "video") {
            $(this).after(
              `<div data-ih-locale-title="VIDEO_THUMBNAIL" title="${_i18nHTML("VIDEO_THUMBNAIL")}" class="videoThumbnail">${SVG.THUMBNAIL}</div>`
            );
          }
        }
      );
      if (USER_SETTING.DIRECT_DOWNLOAD_ALL) {
        const descriptors = await fetchPostBatchDescriptors(
          state.GL_postPath
        );
        await batchDownloadPostDescriptors(descriptors);
        removeMediaDialog();
      }
    }
    function registerLegacyPostActionHandlers($postElement, $mainElement) {
      const handlerRegistrations = [
        [".IG_IMAGE_VIEWER", handleLegacyPostImageViewerAction],
        [".IG_THUMBNAIL_MAIN", handleLegacyPostThumbnailAction],
        [".IG_NEWTAB_MAIN", handleLegacyPostNewTabAction],
        [".IG_DW_ALL_MAIN", handleLegacyPostDownloadAllAction],
        [".IG_DW_MAIN", handleLegacyPostDownloadAction]
      ];
      state.GL_registerEventList.push({
        element: $postElement[0],
        trigger: [
          ".IG_THUMBNAIL_MAIN",
          ".IG_NEWTAB_MAIN",
          ".IG_DW_ALL_MAIN",
          ".IG_DW_MAIN",
          ".IG_IMAGE_VIEWER"
        ]
      });
      handlerRegistrations.forEach(([selector, handler]) => {
        const routeHandler = function(e) {
          return handler(e, this, $mainElement);
        };
        if (activeLegacyRouteScope) {
          activeLegacyRouteScope.listenJQuery(
            $postElement,
            "click",
            selector,
            routeHandler
          );
        } else {
          $postElement.on("click", selector, routeHandler);
        }
      });
    }
    function createDownloadButton() {
      $("article, section:visible > main > div > div > div > div > div > hr").map(function(index) {
        return $(this).is(
          "section:visible > main > div > div > div > div > div > hr"
        ) ? $(this).parent().parent().parent().parent()[0] : this;
      }).filter(function() {
        return $(this).height() > 0 && $(this).width() > 0;
      }).each(function(index) {
        if (!$(this).attr("data-snig") && !$(this).hasClass("x1iyjqo2") && !$(this).children("article")?.hasClass("x1iyjqo2") && $(this).parents("div#scrollview").length === 0) {
          logger("Found post container", $(this));
          const $mainElement = $(this);
          const tagName = this.tagName;
          if (tagName === "DIV" && index != 0) {
            return;
          }
          const $childElement = $mainElement.children("div").children("div");
          if ($childElement.length === 0) return;
          logger("Found insert point", $childElement);
          mountLegacyPostControls($mainElement, $childElement, tagName);
          registerLegacyPostActionHandlers($(this), $mainElement);
          var username = $(this).find("header > div:last-child > div:first-child span a").first().text() || $(this).find('a[href^="/"]').filter(function() {
            return $(this)?.text()?.length > 0;
          }).first().text();
          $(this).attr("data-snig", "canDownload");
          $(this).attr("data-username", username);
        }
      });
    }
    function renderMediaDescriptor($container, descriptor) {
      const isVideo = descriptor.kind === "video";
      const anchor = media.renderMediaRow(document, descriptor, _i18n);
      $container.append(anchor);
      mediaDescriptorByElement.set(anchor, descriptor);
      if (isVideo && descriptor.dashManifest) {
        state.GL_mediaDataCache[descriptor.mediaId] = descriptor.rawMediaItem;
      }
      return anchor;
    }
    async function fetchPostMediaDescriptors(postURL) {
      const result = await getBlobMedia(postURL);
      const descriptors = media.normalizeMediaResponse(result);
      if (descriptors.some((descriptor) => descriptor.owner == null)) {
        logger("carousel_media:", "undefined username");
        alert("carousel_media: undefined username");
      }
      return descriptors;
    }
    async function fetchPostBatchDescriptors(postURL) {
      try {
        return await fetchPostMediaDescriptors(postURL);
      } catch (err) {
        logger("createMediaListDOM", err);
        return [];
      }
    }
    function preparePostMediaList($container, message) {
      $container.find("a").remove();
      $container.append($("<p>", { id: "_SNLOAD" }).text(message));
    }
    function renderPostMediaDescriptors($container, descriptors) {
      descriptors.forEach(
        (descriptor) => renderMediaDescriptor($container, descriptor)
      );
      $container.find("#_SNLOAD").remove();
    }
    function decoratePostMediaRows($container) {
      $container.find('a[data-needed="direct"]').each(function() {
        $(this).wrap("<div></div>");
        $(this).before(
          '<label class="inner_box_wrapper"><input class="inner_box" type="checkbox"><span></span></label>'
        );
        $(this).after(
          `<div data-ih-locale-title="NEW_TAB" title="${_i18nHTML("NEW_TAB")}" class="newTab">${SVG.NEW_TAB}</div>`
        );
        if ($(this).attr("data-name") == "video") {
          $(this).after(
            `<div data-ih-locale-title="VIDEO_THUMBNAIL" title="${_i18nHTML("VIDEO_THUMBNAIL")}" class="videoThumbnail">${SVG.THUMBNAIL}</div>`
          );
        }
      });
    }
    async function createMediaListDOM(postURL, selector, message) {
      try {
        const $container = $(selector);
        preparePostMediaList($container, message);
        const descriptors = await fetchPostMediaDescriptors(postURL);
        renderPostMediaDescriptors($container, descriptors);
        decoratePostMediaRows($container);
        if ($container.closest(".IG_POPUP_DIG").length > 0) {
          updatePopupSelectionSummary();
        }
      } catch (err) {
        logger("createMediaListDOM", err);
      }
    }
    function getMediaListLinks(selector = MEDIA_LIST_SELECTOR) {
      return $(selector).find('a[data-needed="direct"]');
    }
    function getMediaDescriptorsForElements(elements) {
      const source = elements?.jquery ? elements.toArray() : Array.from(elements || []);
      return source.map((element) => element?.jquery ? element[0] : element).filter(Boolean).map((element) => getMediaDescriptorForElement(element));
    }
    function getMediaListLinkByIndex(index) {
      return $(
        `${MEDIA_LIST_SELECTOR} a[data-globalindex="${index + 1}"]`
      ).first();
    }
    function consumeInjectedClick(e) {
      e.preventDefault();
      e.stopPropagation();
      if (e.stopImmediatePropagation) e.stopImmediatePropagation();
    }
    const INJECTED_ACTION_SELECTOR = ".newTab, .videoThumbnail, .IG_IMAGE_VIEWER, .IG_NEWTAB_MAIN, .IG_DW_ALL_MAIN";
    function clickStartedOnInjectedAction(e) {
      return e?.target?.closest?.(INJECTED_ACTION_SELECTOR) != null;
    }
    function removeMediaDialog() {
      $(".IG_POPUP_DIG_ROUTE").remove();
    }
    function getVisibleNodeIndex($main) {
      const hasBackButton = $main.find("button._afxv._al46._al47").length > 0;
      if (!hasBackButton) {
        return 0;
      }
      var index = 0;
      const $viewport = $main.find(
        "*:not([data-pagelet])>*:not([role]):not([data-pagelet])>*>*>*[role]>*>ul[class]"
      ).parent().parent("[role]");
      if ($viewport.length > 0) {
        const viewportRect = $viewport.get(0).getBoundingClientRect();
        const itemWidth = viewportRect.width;
        if (itemWidth > 0) {
          const viewportRight = viewportRect.right;
          let closestSlideElement = null;
          let minDistance = Infinity;
          $main.find("li[class]").each(function() {
            if (this.getBoundingClientRect().width === 0) return;
            const slideRect = this.getBoundingClientRect();
            const distance = Math.abs(slideRect.right - viewportRight);
            if (distance < minDistance) {
              minDistance = distance;
              closestSlideElement = this;
            }
          });
          if (closestSlideElement) {
            const style2 = $(closestSlideElement).attr("style");
            if (style2 && style2.includes("translateX")) {
              const offsetMatch = style2.match(/translateX\(([^p]+)px\)/);
              if (offsetMatch && offsetMatch[1]) {
                const totalOffset = parseFloat(offsetMatch[1]);
                index = Math.round(totalOffset / itemWidth);
              }
            }
          }
        }
      }
      return index;
    }
    async function batchDownloadPostDescriptors(descriptors) {
      try {
        await runDownloadBatch(
          Array.from(descriptors || []),
          (descriptor) => executeMediaDescriptor(descriptor, media.MEDIA_INTENT.DOWNLOAD, {
            dashBeforeMediaApi: true
          }),
          {
            isSafari: IS_SAFARI,
            onProgress: setDownloadProgress,
            onError(error) {
              console.error("Batch download failed:", error);
            },
            sleep: routeDelay
          }
        );
      } catch (error) {
        if (error?.name !== "AbortError") throw error;
      }
    }
    function skipSharedWithYouDialog() {
      if (!USER_SETTING.SKIP_SHARED_WITH_YOU_DIALOG) return;
      let url;
      try {
        url = new URL(window.location.href);
      } catch (e) {
        logger("[skipSharedWithYouDialog] invalid URL", e);
        return;
      }
      if (!url.searchParams || !url.searchParams.has("igsh")) return;
      const $dialogs = $('div[role="dialog"]');
      if (!$dialogs || !$dialogs.length) {
        return;
      }
      const profileUsername = location.pathname.split("/").filter((s) => s.length > 0).at(0)?.toLowerCase();
      $dialogs.each(function() {
        const $dialog = $(this);
        if (!$dialog.is(":visible")) {
          return;
        }
        const $headers = $dialog.find("h2");
        if (!$headers.length) {
          return;
        }
        const isSharedHeader = $headers.filter(function() {
          const rawText = (this.textContent || "").trim().toLowerCase();
          if (!rawText) return false;
          if (rawText.includes("shared this with you")) return true;
          if (rawText.includes("shared with you")) return true;
          if (profileUsername && rawText.includes(profileUsername) && rawText.includes("shared")) {
            return true;
          }
          return false;
        }).length > 0;
        if (!isSharedHeader) {
          return;
        }
        const $buttons = $dialog.find('div[role="button"]');
        if (!$buttons.length) {
          logger("[skipSharedWithYouDialog] dialog has no buttons");
          return;
        }
        let $notNow = null;
        $buttons.each(function() {
          const text = (this.textContent || "").trim().toLowerCase();
          if (!text) return;
          if (text === "not now") {
            $notNow = $(this);
            return false;
          }
        });
        if ((!$notNow || !$notNow.length) && $buttons.length === 2) {
          $notNow = $buttons.last();
        }
        if (!$notNow || !$notNow.length) {
          logger('[skipSharedWithYouDialog] could not find "Not now" button');
          return;
        }
        logger('[skipSharedWithYouDialog] clicking "Not now" button');
        $notNow.trigger("click");
      });
    }
    async function onReels(isDownload, isVideo, isPreview) {
      try {
        if (isDownload) {
          updateLoadingBar(true);
          let reelsPath = location.href.split("?").at(0).split("instagram.com/reels/").at(-1).replaceAll("/", "");
          let result = await getBlobMedia(reelsPath);
          const descriptor = media.normalizeReelMedia(result, {
            isVideo,
            shortcode: reelsPath
          })[0];
          if (!descriptor) {
            throw new Error("Cannot find Reel media resource.");
          }
          if (!descriptor.owner) {
            logger("carousel_media:", "undefined username");
            alert("carousel_media: undefined username");
            throw new Error("Cannot find Reel media owner.");
          }
          const intent = isPreview ? media.MEDIA_INTENT.PREVIEW : isVideo ? media.MEDIA_INTENT.DOWNLOAD : media.MEDIA_INTENT.THUMBNAIL;
          await executeMediaDescriptor(descriptor, intent, {
            defaultTimestamp: (/* @__PURE__ */ new Date()).getTime(),
            includeIndex: false,
            replacePreviewHost: false,
            resolveMissingOwner: false,
            thumbnailSourceType: "reels",
            useDash: false,
            useImageCache: false,
            useMediaApi: false
          });
          updateLoadingBar(false);
        } else {
          const svgClose = 'svg > polyline[points^="20.643 3.357 12 12 3.353 20.647"] ~ line';
          var timer2 = routeSetInterval(() => {
            const hasTiktokStyleLayout = $(svgClose).length > 0;
            if (hasTiktokStyleLayout || $('section > main[role="main"] > div div.x1qjc9v5 video').length > 0) {
              clearInterval(timer2);
              if (USER_SETTING.SCROLL_BUTTON) {
                const $reelsMain = $('section > main[role="main"]');
                let $scrollWrapper = $reelsMain.children("#scrollWrapper");
                if (!$scrollWrapper.length) {
                  $scrollWrapper = $(
                    '<section id="scrollWrapper"><div class="button-up"><div></div></div><div class="button-down"><div></div></div></section>'
                  );
                  $reelsMain.append($scrollWrapper);
                }
                const scrollReelsBy = function(top) {
                  const scrollContainer = $reelsMain.children("div")[0];
                  scrollContainer?.scrollBy({
                    top,
                    behavior: "smooth"
                  });
                };
                $scrollWrapper.find(".button-up").off("click.IG_reelsScroll").on("click.IG_reelsScroll", function() {
                  scrollReelsBy(-30);
                });
                $scrollWrapper.find(".button-down").off("click.IG_reelsScroll").on("click.IG_reelsScroll", function() {
                  scrollReelsBy(30);
                });
              } else {
                $("#scrollWrapper").remove();
              }
              $("div[aria-busy][tabindex]").children("div").each(function() {
                if ($(this).children().length > 0 && $(this).width() > window.innerWidth * 0.8 && $(this).height() > window.innerHeight * 0.8 && $(this).find("video").length > 0) {
                  scheduleReelsButton($(this));
                }
              });
            }
          }, checkInterval);
        }
      } catch (err) {
        console.error("[reels]", err);
      }
    }
    function scheduleReelsButton($main) {
      if ($main.find(".IG_REELS_CONTROLS").length) {
        refreshRouteVideoBehavior(
          reelVideoBehaviorServices,
          $main.first()[0],
          createCurrentReelVideoSurfaceAdapter
        );
        return;
      }
      if ($main.data("insta-loader-reels-controls-pending")) {
        return;
      }
      $main.data("insta-loader-reels-controls-pending", true);
      const scope = activeLegacyRouteScope;
      const scheduleTimeout = (callback, delay) => scope ? scope.setTimeout(callback, delay) : setTimeout2(callback, delay);
      scope?.defer(
        () => $main.removeData("insta-loader-reels-controls-pending")
      );
      let installQueued = false;
      const queueInstall = function() {
        if (installQueued || scope?.disposed) return;
        installQueued = true;
        const install = function() {
          $main.removeData("insta-loader-reels-controls-pending");
          if (!scope?.disposed && $main[0]?.isConnected) {
            appendReelsButton($main);
          }
        };
        if (typeof window.requestIdleCallback === "function") {
          if (scope) {
            scope.requestIdleCallback(install, { timeout: 1e3 });
          } else {
            window.requestIdleCallback(install, { timeout: 1e3 });
          }
        } else {
          scheduleTimeout(install, IS_SAFARI ? 250 : 0);
        }
      };
      const video = $main.find("video").first()[0];
      const queueAfterPlaybackStart = function() {
        scheduleTimeout(queueInstall, IS_SAFARI ? 1e3 : 0);
      };
      if (typeof video?.requestVideoFrameCallback === "function") {
        const frameCallback = video.requestVideoFrameCallback(
          queueAfterPlaybackStart
        );
        scope?.defer(
          () => video.cancelVideoFrameCallback?.(frameCallback)
        );
        scheduleTimeout(queueInstall, IS_SAFARI ? 2e3 : 1200);
      } else if (video && video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
        if (scope) {
          scope.listen(video, "loadeddata", queueAfterPlaybackStart, {
            once: true
          });
        } else {
          video.addEventListener("loadeddata", queueAfterPlaybackStart, {
            once: true
          });
        }
        scheduleTimeout(queueInstall, IS_SAFARI ? 2e3 : 1200);
      } else {
        queueAfterPlaybackStart();
      }
    }
    function appendReelsButton($main) {
      if (!$main.find(".IG_REELS_CONTROLS").length) {
        const $actionRail = $main.find("div").filter(function() {
          const $children = $(this).children();
          const directActionGroups = $children.filter(function() {
            return $(this).find('[role="button"] svg[aria-label]').length > 0;
          }).length;
          if (directActionGroups < 3) return false;
          const rect = this.getBoundingClientRect();
          const computedStyle = window.getComputedStyle(this);
          return computedStyle.display === "flex" && computedStyle.flexDirection === "column" && rect.width > 0 && rect.width <= 120 && rect.height >= 180;
        }).first();
        if (!$actionRail.length) {
          logger("Unable to locate the Reels action rail");
          return;
        }
        $actionRail.prepend(
          `<div class="IG_REELS_CONTROLS" data-insta-loader-controls="reels">
          <div data-ih-locale-title="DW" title="${_i18nHTML("DW")}" class="IG_REELS">${SVG.DOWNLOAD}</div>
          <div data-ih-locale-title="NEW_TAB" title="${_i18nHTML("NEW_TAB")}" class="IG_REELS_NEWTAB">${SVG.NEW_TAB}</div>
          <div data-ih-locale-title="VIDEO_THUMBNAIL" title="${_i18nHTML("VIDEO_THUMBNAIL")}" class="IG_REELS_THUMBNAIL">${SVG.THUMBNAIL}</div>
        </div>`
        );
        var $buttonParent = $main.find('div[role="presentation"] > div[role="button"] > div').first();
        toggleVolumeSilder(
          () => $main.find("video").get(),
          $buttonParent,
          "reel"
        );
      }
      refreshRouteVideoBehavior(
        reelVideoBehaviorServices,
        $main.first()[0],
        createCurrentReelVideoSurfaceAdapter
      );
    }
    async function createStoryListDOM(obj, type) {
      try {
        $(".IG_POPUP_DIG #post_info").text(
          `${type} ID: ${obj.data.reels_media[0].id}`
        );
        const selector = ".IG_POPUP_DIG .IG_POPUP_DIG_MAIN .IG_POPUP_DIG_BODY";
        const descriptors = buildStoryBatchDescriptors(obj, {
          surface: type,
          renamePublishDate: USER_SETTING.RENAME_PUBLISH_DATE,
          nowSeconds: Math.floor(Date.now() / 1e3)
        });
        descriptors.forEach((descriptor, idx) => {
          const anchor = media.renderMediaRow(
            document,
            descriptor,
            _i18n,
            {
              displayIndex: idx,
              labelTranslationAttribute: "data-ih-locale-title",
              sourceType: type
            }
          );
          $(selector).append(anchor);
          mediaDescriptorByElement.set(anchor, descriptor);
        });
        $(".IG_POPUP_DIG .IG_POPUP_DIG_MAIN .IG_POPUP_DIG_BODY a").each(
          function() {
            $(this).wrap("<div></div>");
            $(this).before(
              '<label class="inner_box_wrapper"><input class="inner_box" type="checkbox"><span></span></label>'
            );
            $(this).after(
              `<div data-ih-locale-title="NEW_TAB" title="${_i18nHTML("NEW_TAB")}" class="newTab">${SVG.NEW_TAB}</div>`
            );
            if ($(this).attr("data-type") == "mp4") {
              $(this).after(
                `<div data-ih-locale-title="VIDEO_THUMBNAIL" title="${_i18nHTML("VIDEO_THUMBNAIL")}" class="videoThumbnail">${SVG.THUMBNAIL}</div>`
              );
            }
          }
        );
        updatePopupSelectionSummary();
        updateLoadingBar(false);
      } catch (err) {
        console.error("createStoryListDOM()", err);
      }
    }
    async function onStoryAll(actionLifecycle) {
      throwIfStorySurfaceActionCancelled(actionLifecycle);
      let username = $("body > div section._ac0a header._ac0k ._ac0l a + div a").first().text() || location.pathname.split("/").filter((s) => s.length > 0).at(1);
      let userInfo = await getUserId(username);
      throwIfStorySurfaceActionCancelled(actionLifecycle);
      let userId = userInfo.user.pk;
      let stories = await getStories(userId);
      throwIfStorySurfaceActionCancelled(actionLifecycle);
      if (USER_SETTING.DIRECT_DOWNLOAD_STORY) {
        scheduleStoryBatchDownloads(
          stories,
          STORY_SURFACE.STORY,
          false,
          actionLifecycle
        );
      } else {
        throwIfStorySurfaceActionCancelled(actionLifecycle);
        IG_createDM(false, true, true);
        createStoryListDOM(stories, "stories");
      }
    }
    async function onStory(isDownload, isForce, isPreview, actionLifecycle) {
      var username = $("body > div section._ac0a header._ac0k ._ac0l a + div a").first().text() || location.pathname.split("/").filter((s) => s.length > 0).at(1);
      if (isDownload) {
        throwIfStorySurfaceActionCancelled(actionLifecycle);
        let date = (/* @__PURE__ */ new Date()).getTime();
        let timestamp = Math.floor(date / 1e3);
        const intent = isPreview ? STORY_INTENT.PREVIEW : STORY_INTENT.DOWNLOAD;
        const initialMediaApiPolicy = getStoryMediaApiPolicyInputs(
          USER_SETTING,
          state,
          { intent }
        );
        if (initialMediaApiPolicy.requestMediaApi) {
          let userInfo = await getUserId(username);
          throwIfStorySurfaceActionCancelled(actionLifecycle);
          let userId = userInfo.user.pk;
          let stories = await getStories(userId);
          throwIfStorySurfaceActionCancelled(actionLifecycle);
          const domState = readLegacyStoryDomState();
          const actionContext = createLegacyStoryActionContext(
            STORY_SURFACE.STORY,
            stories,
            domState,
            intent
          );
          const mediaId = actionContext.current.mediaId;
          if (mediaId == null) {
            await getMediaInfo(mediaId);
            return;
          }
          const descriptor = createLegacyStoryApiDescriptor(
            stories,
            actionContext,
            domState,
            {
              publishTime: null,
              surface: STORY_SURFACE.STORY
            }
          );
          let usedImageCache = false;
          await executeMediaDescriptor(
            descriptor,
            isPreview ? media.MEDIA_INTENT.PREVIEW : media.MEDIA_INTENT.DOWNLOAD,
            {
              ...createStorySurfaceMediaActionOptions(actionLifecycle),
              defaultTimestamp: timestamp,
              deferMediaApiRequestFailureAlert: true,
              includeIndex: false,
              logMediaApiError: true,
              swallowMediaApiFailure: true,
              onMediaApiFallback: async () => {
                state.tempFetchRateLimit = true;
                return await onStory(
                  isDownload,
                  isForce,
                  isPreview,
                  actionLifecycle
                );
              },
              onOutput: (context) => {
                if (context.source === "cache") {
                  usedImageCache = true;
                  logger("[Restore Cached onStory]", mediaId);
                }
              },
              outputShortcode: mediaId,
              outputTimestamp: (context) => actionContext.mediaApiPolicy.renamePublishDate && context.source === "media-api" ? context.descriptor.rawMediaItem?.taken_at ?? timestamp : timestamp,
              replacePreviewHost: false,
              retainFirstMediaApiImageCandidate: true,
              resolveMissingOwner: false,
              useDash: actionContext.mediaApiPolicy.requestDash,
              useDashForPreview: actionContext.mediaApiPolicy.requestDash,
              useImageCache: actionContext.mediaApiPolicy.useImageCache,
              useMediaApi: actionContext.mediaApiPolicy.requestMediaApi
            }
          );
          if (usedImageCache) return;
          return;
        }
        if ($("body > div section:visible video[playsinline]").length > 0) {
          let stories;
          let fetchedStories = false;
          if (state.GL_dataCache.stories[username] && !isForce) {
            logger("Fetch from memory cache:", username);
            stories = state.GL_dataCache.stories[username];
          } else {
            let userInfo = await getUserId(username);
            throwIfStorySurfaceActionCancelled(actionLifecycle);
            let userId = userInfo.user.pk;
            stories = await getStories(userId);
            throwIfStorySurfaceActionCancelled(actionLifecycle);
            fetchedStories = true;
            state.GL_dataCache.stories[username] = stories;
          }
          const domState = readLegacyStoryDomState();
          const actionContext = createLegacyStoryActionContext(
            STORY_SURFACE.STORY,
            stories,
            domState,
            intent
          );
          const descriptor = normalizeLegacyStoryCurrentDescriptor(
            stories,
            actionContext,
            {
              shortcode: USER_SETTING.RENAME_PUBLISH_DATE ? actionContext.current.mediaId : null,
              surface: STORY_SURFACE.STORY
            }
          );
          if (!descriptor || descriptor.kind !== "video") {
            if (!fetchedStories) {
              logger("Memory cache not found, try fetch from API:", username);
              return await onStory(
                true,
                true,
                void 0,
                actionLifecycle
              );
            }
            alert(_i18n("NO_VID_URL"));
          } else {
            await executeMediaDescriptor(
              descriptor,
              isPreview ? media.MEDIA_INTENT.PREVIEW : media.MEDIA_INTENT.DOWNLOAD,
              {
                ...createStorySurfaceMediaActionOptions(actionLifecycle),
                defaultTimestamp: timestamp,
                includeIndex: false,
                replacePreviewHost: false,
                resolveMissingOwner: false,
                useDash: false,
                useImageCache: false,
                useMediaApi: false
              }
            );
          }
        } else {
          const downloadLink = getLegacyVisibleStoryImageUrl();
          if (USER_SETTING.RENAME_PUBLISH_DATE) {
            timestamp = new Date(
              $("body > div section:visible time[datetime][class]").first().attr("datetime")
            ).getTime();
          }
          const decodedMediaId = getStoryId(downloadLink) ?? "-";
          const mediaId = getImageFromCache(decodedMediaId);
          const descriptor = {
            mediaId: decodedMediaId,
            directUrl: downloadLink,
            thumbnailUrl: downloadLink,
            kind: "image",
            extension: "jpg",
            owner: username,
            shortcode: mediaId,
            publishTime: timestamp,
            carouselIndex: 1,
            rawMediaItem: null,
            dashManifest: null,
            hasCanonicalMediaId: false,
            sourceType: STORY_SURFACE.STORY
          };
          let usedImageCache = false;
          await executeMediaDescriptor(
            descriptor,
            isPreview ? media.MEDIA_INTENT.PREVIEW : media.MEDIA_INTENT.DOWNLOAD,
            {
              ...createStorySurfaceMediaActionOptions(actionLifecycle),
              allowNonCanonicalImageCache: true,
              defaultTimestamp: timestamp,
              imageCacheKey: mediaId,
              includeIndex: false,
              onOutput: (context) => {
                if (context.source === "cache") usedImageCache = true;
              },
              outputShortcode: mediaId,
              replacePreviewHost: false,
              resolveMissingOwner: false,
              useDash: false,
              useImageCache: USER_SETTING.CAPTURE_IMAGE_VIA_MEDIA_CACHE,
              useMediaApi: false
            }
          );
          if (usedImageCache) return;
        }
        state.tempFetchRateLimit = false;
      } else {
        if (!$(".IG_DWSTORY").length) {
          state.GL_dataCache.stories = {};
          let $element = null;
          if ($("body > div section._ac0a").length > 0) {
            $element = $("body > div section:visible._ac0a");
          } else {
            $element = $(
              "body > div section:visible > div > div[style]:not([class])"
            );
            $element.css("position", "relative");
          }
          if ($element.length === 0) {
            $element = $('div[id^="mount"] section > div > a[href="/"]').parent().parent().parent().find("section:visible > div > div[style]:not([class])");
            $element.css("position", "relative");
          }
          if ($element.length === 0) {
            $element = $('div[id^="mount"] section > div > a[href="/"]').parent().parent().parent().find(
              'section:visible > div div[style]:not([class]) > div:not([data-visualcompletion="loading-state"])'
            );
            $element.css("position", "relative");
          }
          if ($element.length === 0) {
            $element = $('div[id^="mount"] section > div a[href="/"]').parents("section:visible").find("div[style]:not([class])");
            $element.css("position", "relative");
          }
          if ($element.length === 0) {
            let $$element = $(
              "body > div div:not([hidden]) section:visible > div div[class][style] > div[style]:not([class])"
            );
            let nowSize = 0;
            $$element.each(function() {
              if ($(this).width() > nowSize) {
                nowSize = $(this).width();
                $element = $(this).children("div").first();
              }
            });
          }
          if ($element != null) {
            $element.first().css("position", "relative");
            $element.first().append(
              `<div data-ih-locale-title="DW" title="${_i18nHTML("DW")}" class="IG_DWSTORY">${SVG.DOWNLOAD}</div>`
            );
            $element.first().append(
              `<div data-ih-locale-title="NEW_TAB" title="${_i18nHTML("NEW_TAB")}" class="IG_DWNEWTAB">${SVG.NEW_TAB}</div>`
            );
            let $header = getStoryProgress(username);
            if ($header.length > 1) {
              $element.first().append(
                `<div data-ih-locale-title="DW_ALL" title="${_i18nHTML("DW_ALL")}" class="IG_DWSTORY_ALL">${SVG.DOWNLOAD_ALL}</div>`
              );
            }
            setStoryProgressIndexText(
              $element.first(),
              $header,
              "IG_DWSTORY_POSITION"
            );
            $element.find("img[referrerpolicy]").each(function() {
              bindStoryImageLoad(this, $element, "story");
            });
          }
        } else {
          setStoryProgressIndexByUsername(
            $(".IG_DWSTORY").parent(),
            username,
            "IG_DWSTORY_POSITION"
          );
        }
      }
    }
    async function onStoryThumbnail(isDownload, isForce, actionLifecycle) {
      if (isDownload) {
        throwIfStorySurfaceActionCancelled(actionLifecycle);
        let date = (/* @__PURE__ */ new Date()).getTime();
        let timestamp = Math.floor(date / 1e3);
        let username = $("body > div section._ac0a header._ac0k ._ac0l a + div a").first().text() || location.pathname.split("/").at(2);
        let mediaId = null;
        const initialMediaApiPolicy = getStoryMediaApiPolicyInputs(
          USER_SETTING,
          state,
          { intent: STORY_INTENT.THUMBNAIL }
        );
        if (initialMediaApiPolicy.requestMediaApi) {
          let userInfo = await getUserId(username);
          throwIfStorySurfaceActionCancelled(actionLifecycle);
          let userId = userInfo.user.pk;
          let stories2 = await getStories(userId);
          throwIfStorySurfaceActionCancelled(actionLifecycle);
          const domState2 = readLegacyStoryDomState();
          const actionContext2 = createLegacyStoryActionContext(
            STORY_SURFACE.STORY,
            stories2,
            domState2,
            STORY_INTENT.THUMBNAIL
          );
          mediaId = actionContext2.current.mediaId;
          if (mediaId == null) {
            await getMediaInfo(mediaId);
            return;
          }
          const descriptor2 = createLegacyStoryApiDescriptor(
            stories2,
            actionContext2,
            domState2,
            {
              imageCandidate: media.STORY_IMAGE_CANDIDATE.DISPLAY_URL,
              publishTime: null,
              surface: STORY_SURFACE.STORY
            }
          );
          let usedImageCache = false;
          await executeMediaDescriptor(
            descriptor2,
            media.MEDIA_INTENT.THUMBNAIL,
            {
              ...createStorySurfaceMediaActionOptions(actionLifecycle),
              allowMediaApiForThumbnail: true,
              defaultTimestamp: timestamp,
              deferMediaApiRequestFailureAlert: true,
              includeIndex: false,
              logMediaApiError: true,
              swallowMediaApiFailure: true,
              onMediaApiFallback: async () => {
                state.tempFetchRateLimit = true;
                return await onStoryThumbnail(
                  true,
                  isForce,
                  actionLifecycle
                );
              },
              onOutput: (context) => {
                if (context.source === "cache") {
                  usedImageCache = true;
                  logger("[Restore Cached onStoryThumbnail]", mediaId);
                }
              },
              outputShortcode: mediaId,
              outputTimestamp: (context) => actionContext2.mediaApiPolicy.renamePublishDate && context.source === "media-api" ? context.descriptor.rawMediaItem?.taken_at ?? timestamp : timestamp,
              retainFirstMediaApiImageCandidate: true,
              resolveMissingOwner: false,
              thumbnailSourceType: "stories",
              useDash: false,
              useImageCache: actionContext2.mediaApiPolicy.useImageCache,
              useMediaApi: actionContext2.mediaApiPolicy.requestMediaApi
            }
          );
          if (usedImageCache) return;
          return;
        }
        let stories;
        let fetchedStories = false;
        if (state.GL_dataCache.stories[username] && !isForce) {
          logger("Fetch from memory cache:", username);
          stories = state.GL_dataCache.stories[username];
        } else {
          let userInfo = await getUserId(username);
          throwIfStorySurfaceActionCancelled(actionLifecycle);
          let userId = userInfo.user.pk;
          stories = await getStories(userId);
          throwIfStorySurfaceActionCancelled(actionLifecycle);
          fetchedStories = true;
        }
        const domState = readLegacyStoryDomState();
        const actionContext = createLegacyStoryActionContext(
          STORY_SURFACE.STORY,
          stories,
          domState,
          STORY_INTENT.THUMBNAIL
        );
        const descriptor = normalizeLegacyStoryCurrentDescriptor(
          stories,
          actionContext,
          {
            imageCandidate: media.STORY_IMAGE_CANDIDATE.DISPLAY_URL,
            shortcode: USER_SETTING.RENAME_PUBLISH_DATE ? actionContext.current.mediaId : null,
            surface: STORY_SURFACE.STORY
          }
        );
        if (!descriptor) {
          if (!fetchedStories) {
            logger("Memory cache not found, try fetch from API:", username);
            return await onStoryThumbnail(true, true, actionLifecycle);
          }
          throw new Error("Cannot resolve the current Story thumbnail.");
        }
        await executeMediaDescriptor(
          descriptor,
          media.MEDIA_INTENT.THUMBNAIL,
          {
            ...createStorySurfaceMediaActionOptions(actionLifecycle),
            defaultTimestamp: timestamp,
            includeIndex: false,
            resolveMissingOwner: false,
            useDash: false,
            useImageCache: false,
            useMediaApi: false
          }
        );
        state.tempFetchRateLimit = false;
      } else {
        if ($("body > div div.IG_DWSTORY").parent().find("video[class]").length) {
          let $element = null;
          if ($("body > div section._ac0a").length > 0) {
            $element = $("body > div section:visible._ac0a");
          } else {
            $element = $(
              "body > div section:visible > div > div[style]:not([class])"
            );
            $element.css("position", "relative");
          }
          if ($element.length === 0) {
            $element = $('div[id^="mount"] section > div > a[href="/"]').parent().parent().parent().find("section:visible > div > div[style]:not([class])");
            $element.css("position", "relative");
          }
          if ($element.length === 0) {
            $element = $('div[id^="mount"] section > div > a[href="/"]').parent().parent().parent().find(
              'section:visible > div div[style]:not([class]) > div:not([data-visualcompletion="loading-state"])'
            );
            $element.css("position", "relative");
          }
          if ($element.length === 0) {
            let $$element = $(
              "body > div div:not([hidden]) section:visible > div div[class][style] > div[style]:not([class])"
            );
            let nowSize = 0;
            $$element.each(function() {
              if ($(this).width() > nowSize) {
                nowSize = $(this).width();
                $element = $(this).children("div").first();
              }
            });
          }
          if ($element != null) {
            $element.first().css("position", "relative");
            $element.first().append(
              `<div data-ih-locale-title="VIDEO_THUMBNAIL" title="${_i18nHTML("VIDEO_THUMBNAIL")}" class="IG_DWSTORY_THUMBNAIL">${SVG.THUMBNAIL}</div>`
            );
          }
        }
      }
    }
    function getHighlightStories(highlightId) {
      const getURL = `https://www.instagram.com/graphql/query/?query_hash=45246d3fe16ccc6577e0bd297a5db1ab&variables=%7B%22highlight_reel_ids%22:%5B%22${highlightId}%22%5D,%22precomposed_overlay%22:false%7D`;
      return jsonRequest({ url: getURL, detectApiErrors: false }).catch((err) => {
        logger("getHighlightStories()", "reject", err.message);
        throw err;
      });
    }
    function getStories(userId) {
      const getURL = `https://www.instagram.com/graphql/query/?query_hash=15463e8449a83d3d60b06be7e90627c7&variables=%7B%22reel_ids%22:%5B%22${userId}%22%5D,%22precomposed_overlay%22:false%7D`;
      return jsonRequest({ url: getURL, detectApiErrors: false }).then((obj) => {
        logger("getStories()", obj);
        return obj;
      }).catch((err) => {
        logger("getStories()", "reject", err.message);
        throw err;
      });
    }
    async function getUserId(username) {
      const getURL = `https://www.instagram.com/web/search/topsearch/?query=${username}`;
      let obj;
      try {
        obj = await jsonRequest({ url: getURL, detectApiErrors: false });
      } catch (err) {
        logger("getUserId()", "reject", err);
        if (isStoryActionAbort(err)) throw err;
        return await getUserIdWithAgent(username);
      }
      const result = obj?.users?.find(
        (pos) => pos.user.username?.toLowerCase() === username?.toLowerCase()
      );
      if (result != null) {
        logger("getUserId()", result);
        return result;
      }
      try {
        return await getUserIdWithAgent(username);
      } catch (err) {
        alert("Cannot find user info from getUserId()");
        if (err && typeof err === "object") err.alreadyReported = true;
        throw err;
      }
    }
    function getUserIdWithAgent(username) {
      const getURL = `https://i.instagram.com/api/v1/users/web_profile_info/?username=${username}`;
      return jsonRequest({
        url: getURL,
        detectApiErrors: false,
        headers: {
          "X-IG-App-ID": getAppID()
        }
      }).then((obj) => {
        const userInfo = obj?.data;
        if (userInfo?.user == null) {
          logger("getUserIdWithAgent()", "reject", "undefined");
          throw new Error("undefined");
        }
        userInfo.user.pk = userInfo.user.id;
        logger("getUserIdWithAgent()", obj);
        return userInfo;
      }).catch((err) => {
        logger("getUserIdWithAgent()", "reject", err?.message || err);
        throw err;
      });
    }
    function getUserHighSizeProfile(userId) {
      const getURL = `https://www.instagram.com/api/v1/users/${userId}/info/`;
      return jsonRequest({
        url: getURL,
        detectApiErrors: false,
        headers: {
          "User-Agent": "Mozilla/5.0 (Linux; Android 10; Pixel 7 XL)Build/RP1A.20845.002; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/5.0 Chrome/117.0.5938.60 Mobile Safari/537.36 Instagram 307.0.0.34.111"
        }
      }).then((obj) => {
        if (obj?.status !== "ok") {
          logger("getUserHighSizeProfile()", "reject", obj);
          throw new Error("faild");
        }
        logger("getUserHighSizeProfile()", obj);
        return obj.user.hd_profile_pic_url_info?.url;
      }).catch((err) => {
        logger("getUserHighSizeProfile()", "reject", err);
        throw err;
      });
    }
    function getPostOwner(postPath) {
      if (!postPath) return Promise.reject("NOPATH");
      const getURL = `https://www.instagram.com/graphql/query/?query_hash=2c4c2e343a8f64c625ba02b2aa12c7f8&variables=%7B%22shortcode%22:%22${postPath}%22}`;
      return jsonRequest({ url: getURL, detectApiErrors: false }).then((obj) => {
        logger("getPostOwner()", obj);
        return obj.data.shortcode_media.owner.username;
      }).catch((err) => {
        logger("getPostOwner()", "reject", err.message || err);
        throw err;
      });
    }
    function getBlobMedia(postPath) {
      if (!postPath) return Promise.reject("NOPATH");
      const postShortCode = postPath;
      const getURL = `https://www.instagram.com/graphql/query/?query_hash=2c4c2e343a8f64c625ba02b2aa12c7f8&variables=%7B%22shortcode%22:%22${postShortCode}%22}`;
      const requestWithQueryId = (reason) => {
        logger(
          "Request with:",
          "getBlobMediaWithQueryID()",
          postShortCode,
          reason
        );
        return getBlobMediaWithQueryID(postShortCode).then((data) => ({
          type: "query_id",
          data
        }));
      };
      return jsonRequest({
        url: getURL,
        detectApiErrors: false,
        headers: {
          "User-Agent": "Mozilla/5.0 (Linux; Android 10; Pixel 7 XL)Build/RP1A.20845.002; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/5.0 Chrome/117.0.5938.60 Mobile Safari/537.36 Instagram 307.0.0.34.111"
        }
      }).then(
        (obj) => {
          logger(obj);
          const resource = obj?.data?.shortcode_media;
          if (resource != null && typeof resource === "object" && !Array.isArray(resource)) {
            return { type: "query_hash", data: obj.data };
          }
          return requestWithQueryId(
            obj?.status === "fail" ? obj?.message || "legacy-query-failed" : "legacy-query-returned-no-media"
          );
        },
        (err) => {
          logger("getBlobMedia()", "legacy query rejected", err.message || err);
          if (err?.category === "abort" || err?.name === "AbortError") {
            throw err;
          }
          return requestWithQueryId(err?.message || "legacy-query-rejected");
        }
      );
    }
    function createLegacyRequestError(code, message, rateLimited = false) {
      const error = new Error(message);
      error.code = code;
      error.rateLimited = rateLimited;
      return error;
    }
    function getBlobMediaWithQueryID(postPath, options = {}) {
      const silent = options.silent === true;
      const postShortCode = String(postPath || "");
      if (!/^[A-Za-z0-9_-]{5,64}$/.test(postShortCode)) {
        return Promise.reject(
          createLegacyRequestError(
            "invalid_shortcode",
            "A valid Instagram shortcode is required."
          )
        );
      }
      const query = new URLSearchParams({
        query_id: "9496392173716084",
        variables: JSON.stringify({
          shortcode: postShortCode,
          __relay_internal__pv__PolarisFeedShareMenurelayprovider: true,
          __relay_internal__pv__PolarisIsLoggedInrelayprovider: true
        })
      });
      const getURL = `https://www.instagram.com/graphql/query/?${query.toString()}`;
      return jsonRequest({
        url: getURL,
        timeout: options.timeout,
        detectApiErrors: false,
        onRequest: options.onRequest,
        headers: {
          "User-Agent": "Mozilla/5.0 (Linux; Android 10; Pixel 7 XL)Build/RP1A.20845.002; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/5.0 Chrome/117.0.5938.60 Mobile Safari/537.36 Instagram 307.0.0.34.111",
          "X-IG-App-ID": getAppID()
        }
      }).then((obj) => {
        if (Array.isArray(obj?.errors) && obj.errors.length) {
          const graphQLErrorText = obj.errors.map(
            (error) => [error?.message, error?.description, error?.code].filter(Boolean).join(" ")
          ).join(" ");
          const isRateLimited = /rate|limit|throttl|please wait|try again later/i.test(
            graphQLErrorText
          );
          throw createLegacyRequestError(
            isRateLimited ? "rate_limited" : "graphql_error",
            graphQLErrorText || "Instagram returned a GraphQL error.",
            isRateLimited
          );
        }
        if (obj?.status === "fail") {
          const feedback = [obj.message, obj.feedback_message].filter(Boolean).join(": ");
          const isRateLimited = /rate|limit|throttl|please wait|try again later/i.test(feedback);
          const apiError = createLegacyRequestError(
            isRateLimited ? "rate_limited" : "api_failure",
            feedback || "Instagram rejected the metadata request.",
            isRateLimited
          );
          if (!silent) {
            alert(`getBlobMediaWithQueryID(): ${apiError.message}`);
          }
          throw apiError;
        }
        if (!obj?.data || typeof obj.data !== "object") {
          throw createLegacyRequestError(
            "empty_metadata",
            "Instagram returned no Reel metadata."
          );
        }
        logger("getBlobMediaWithQueryID()", "success", postShortCode);
        return obj.data;
      }).catch((err) => {
        const legacyError = adaptLegacyMetadataRequestError(err);
        logger(
          "getBlobMediaWithQueryID()",
          "reject",
          legacyError?.code || legacyError?.name || "parse_failure"
        );
        throw legacyError;
      });
    }
    function adaptLegacyMetadataRequestError(error) {
      if (error?.code && !error?.category) return error;
      switch (error?.category) {
        case "rate-limit":
          return createLegacyRequestError(
            "rate_limited",
            "Instagram rate-limited the metadata request.",
            true
          );
        case "http":
          return createLegacyRequestError(
            "http_error",
            error.message || "Instagram metadata request failed."
          );
        case "login":
          return createLegacyRequestError(
            "login_required",
            "Instagram redirected the metadata request to a login or checkpoint."
          );
        case "parse":
          return createLegacyRequestError(
            /html/i.test(error.message || "") ? "unexpected_html" : "parse_failure",
            error.message || "Instagram returned malformed metadata."
          );
        case "timeout":
          return createLegacyRequestError(
            "request_timeout",
            "Instagram metadata request timed out."
          );
        case "abort":
          return createLegacyRequestError(
            "operation_cancelled",
            "The Reel metadata request was cancelled."
          );
        case "network":
        default:
          return createLegacyRequestError(
            "network_error",
            error?.message || "Instagram metadata request failed."
          );
      }
    }
    function getMediaInfo(mediaId) {
      const getURL = `https://i.instagram.com/api/v1/media/${mediaId}/info/`;
      if (mediaId == null) {
        const message = "Cannot call Media API because of the media id is invalid.";
        alert(message);
        logger("getMediaInfo()", "reject", message);
        updateLoadingBar(false);
        return Promise.reject(-1);
      }
      const appId = getAppID();
      if (appId == null) {
        const message = "Cannot call Media API because of the app id is invalid.";
        alert(message);
        logger("getMediaInfo()", "reject", message);
        updateLoadingBar(false);
        return Promise.reject(-1);
      }
      return jsonRequest({
        url: getURL,
        detectApiErrors: false,
        headers: {
          "User-Agent": window.navigator.userAgent,
          Accept: "*/*",
          "X-IG-App-ID": appId
        },
        transform(obj, response) {
          const finalUrl = String(response?.finalUrl || "");
          if (finalUrl && finalUrl !== getURL) {
            const error = new Error("Media API redirect");
            error.redirectUrl = finalUrl;
            throw error;
          }
          return obj;
        }
      }).then((obj) => {
        logger("getMediaInfo()", obj);
        return obj;
      }).catch((err) => {
        if (err?.category === "network") {
          const legacyNetworkError = err.cause || err;
          logger("getMediaInfo()", "reject", legacyNetworkError);
          return legacyNetworkError;
        }
        const redirectUrl = err?.cause?.redirectUrl;
        if (err?.category === "login") {
          const message = "The account must be logged in to access Media API.";
          logger("getMediaInfo()", "reject", message);
          alert(message);
          updateLoadingBar(false);
          throw -1;
        }
        if (redirectUrl) {
          const message = 'Unable to retrieve content because the API was redirected to "' + redirectUrl + '"';
          logger("getMediaInfo()", "reject", message);
          alert(message);
          updateLoadingBar(false);
          throw -1;
        }
        logger("getMediaInfo()", "reject", err);
        throw err;
      });
    }
    function isMacOS() {
      return /Macintosh|Mac OS/i.test(navigator.userAgent);
    }
    function getPlatformModifierKey() {
      return isMacOS() ? "⌥" : "Alt";
    }
    function getStoryId(url) {
      let obj = new URL(url);
      let base64 = obj?.searchParams?.get("ig_cache_key")?.split(".").at(0);
      if (base64) {
        return atob(base64);
      } else {
        return null;
      }
    }
    function getAppID() {
      let result = null;
      $('script[type="application/json"]').each(function() {
        const regexp = /"APP_ID":"([0-9]+)"/gi;
        const matcher = $(this).text().match(regexp);
        if (matcher != null && result == null) {
          result = [...$(this).text().matchAll(regexp)];
        }
      });
      return result ? result.at(0).at(-1) : null;
    }
    function getTimeElementBaseDateSource($time) {
      const titleText = $time.attr("title")?.trim();
      if (titleText) {
        return {
          dateText: titleText,
          cacheKey: `title:${titleText}`
        };
      }
      const datetime = $time.attr("datetime")?.trim();
      if (datetime) {
        const date = new Date(datetime);
        if (!Number.isNaN(date.getTime())) {
          return {
            dateText: new Intl.DateTimeFormat(void 0, {
              year: "numeric",
              month: "short",
              day: "numeric"
            }).format(date),
            cacheKey: `datetime:${datetime}`
          };
        }
      }
      return {
        dateText: null,
        cacheKey: null
      };
    }
    function getTimeElementBaseDateText($time) {
      const preservedText = $time.attr("data-ih-original-date")?.trim();
      const preservedKey = $time.attr("data-ih-original-date-key")?.trim();
      const { dateText, cacheKey } = getTimeElementBaseDateSource($time);
      if (preservedText && preservedKey && cacheKey && preservedKey === cacheKey) {
        return preservedText;
      }
      if (dateText && cacheKey) {
        $time.attr("data-ih-original-date", dateText);
        $time.attr("data-ih-original-date-key", cacheKey);
        return dateText;
      }
      return null;
    }
    function setTimeElementDateAndLocaleTime($time) {
      if ($time == null || $time.length === 0) {
        return;
      }
      const datetime = $time.attr("datetime");
      if (!datetime) {
        return;
      }
      const date = new Date(datetime);
      if (Number.isNaN(date.getTime())) {
        return;
      }
      const dateText = getTimeElementBaseDateText($time);
      if (!dateText) {
        return;
      }
      const localeTime = new Intl.DateTimeFormat(void 0, {
        hour: "numeric",
        minute: "2-digit"
      }).format(date);
      if (!localeTime) {
        return;
      }
      const finalText = `${dateText} ${localeTime}`;
      if ($time.text()?.trim() !== finalText) {
        $time.text(finalText);
        $time.css("white-space", "break-spaces");
      }
    }
    function getHighlightCurrentTimeElement($element) {
      if ($element == null || $element.length === 0) {
        $element = $("body");
      }
      let $section = $element.closest("section:visible");
      if ($section.length === 0) {
        $section = $("body > div section:visible").last();
      }
      if ($section.length === 0) {
        return $();
      }
      let $times = $section.find("time[datetime]").filter(function() {
        const $time = $(this);
        return $time.is(":visible") && $time.closest('a[href^="/stories/highlights/"]').length === 0 && $time.closest('[role="button"]').length === 0;
      });
      if ($times.length === 0) {
        return $();
      }
      return $times.first();
    }
    function updateLoadingBar(isLoading) {
      if (isLoading) {
        $('div[id^="mount"] > div > div > div:first').removeClass("x1s85apg");
        $('div[id^="mount"] > div > div > div:first').css("z-index", "20000");
      } else {
        $('div[id^="mount"] > div > div > div:first').addClass("x1s85apg");
        $('div[id^="mount"] > div > div > div:first').css("z-index", "");
      }
    }
    function getStoryProgress(username) {
      let $header = $(
        'body > div section:visible a[href^="/' + username + '"] span'
      ).filter(function() {
        return $(this).children().length === 0 && $(this).find("svg").length === 0 && $(this).text()?.toLowerCase() === username?.toLowerCase();
      }).parents("div:not([class]):not([style])").filter(function() {
        return $(this).text()?.toLowerCase() !== username?.toLowerCase();
      }).filter(function() {
        return $(this).children().length > 1;
      }).first();
      if ($header.length === 0) {
        $header = $('body > div section:visible a[href^="/' + username + '"]').filter(function() {
          return $(this).find("img").length > 0;
        }).parents("div:not([class]):not([style])").filter(function() {
          return $(this).text()?.toLowerCase() !== username?.toLowerCase();
        }).filter(function() {
          return $(this).children().length > 1;
        }).first();
      }
      return $header.children().filter(function() {
        return $(this).height() < 10;
      }).first().children();
    }
    function getStoryProgressIndex($header) {
      return getStoryProgressMetadata($header.toArray());
    }
    function setStoryProgressIndexText($element, $header, className) {
      let progress = getStoryProgressIndex($header);
      let $counter = $element.find("." + className).first();
      if (progress == null || progress.total < 2) {
        if ($counter.length > 0) {
          $counter.remove();
        }
        return;
      }
      let text = progress.current + "/" + progress.total;
      let title = _i18n("ITEM_POSITION").replace("%CURRENT%", progress.current).replace("%TOTAL%", progress.total);
      if ($counter.length === 0) {
        $counter = $("<div>").addClass(className);
        $element.append($counter);
      }
      if ($counter.text() !== text) {
        $counter.text(text);
      }
      if ($counter.attr("title") !== title) {
        $counter.attr("title", title);
      }
      if ($counter.attr("aria-label") !== title) {
        $counter.attr("aria-label", title);
      }
    }
    function setStoryProgressIndexByUsername($element, username, className) {
      if ($element == null || $element.length === 0 || username == null) {
        return;
      }
      let $header = getStoryProgress(username);
      setStoryProgressIndexText($element, $header, className);
    }
    function setDownloadProgress(now2, total) {
      if ($(".circle_wrapper").length) {
        $(".circle_wrapper span").text(`${now2}/${total}`);
        if (now2 >= total) {
          $(".circle_wrapper").fadeOut(250, function() {
            $(this).remove();
          });
        }
      } else {
        $("body").append(
          `<div class="circle_wrapper"><circle></circle><span>${now2}/${total}</span></div>`
        );
      }
    }
    async function fetchMediaBlob(downloadLink, operationOptions = {}) {
      return await downloadTransport.fetchMediaBlob(
        downloadLink,
        operationOptions
      );
    }
    function shouldFetchBlobBeforeDownload(metadata) {
      return USER_SETTING.MODIFY_RESOURCE_EXIF && metadata.filetype === "jpg" && metadata.shortcode && metadata.sourceType === "photo";
    }
    function shouldModifyExifBlob(object, metadata) {
      return shouldFetchBlobBeforeDownload(metadata) && (object.type === "image/jpeg" || object.type === "image/webp");
    }
    function saveFilenameNeedsUid() {
      return state.fileRenameFormat.toUpperCase().includes("%UID%");
    }
    async function prepareSaveMetadata(metadata, needsUid) {
      const prepared = { ...metadata };
      if (prepared.uid == null && needsUid) {
        const userInfo = await getUserId(prepared.username);
        prepared.uid = userInfo?.user?.id || null;
      }
      return prepared;
    }
    async function triggerDirectDownload(downloadLink, filename, operationOptions = {}) {
      return await downloadTransport.downloadUrl(
        downloadLink,
        filename,
        operationOptions
      );
    }
    async function saveFiles(downloadLink, metadata, operationOptions = createDownloadOperationOptions()) {
      updateLoadingBar(true);
      try {
        if (!downloadLink) {
          throw new Error("Missing download URL.");
        }
        if (!shouldFetchBlobBeforeDownload(metadata)) {
          const preparedMetadata = await prepareSaveMetadata(
            metadata,
            saveFilenameNeedsUid()
          );
          const downloadName = getSaveFileName(downloadLink, preparedMetadata);
          return await triggerDirectDownload(
            downloadLink,
            downloadName,
            operationOptions
          );
        }
        const dwel = await fetchMediaBlob(downloadLink, operationOptions);
        return await createSaveFileElement(
          downloadLink,
          dwel,
          metadata,
          operationOptions
        );
      } catch (err) {
        console.error("Failed to save media:", err);
        logger("saveFiles()", "failed", err?.message || err);
        return false;
      } finally {
        updateLoadingBar(false);
      }
    }
    async function fetchArrayBuffer(url) {
      updateLoadingBar(true);
      const abortController = typeof environment2.window.AbortController === "function" ? new environment2.window.AbortController() : null;
      if (abortController && activeLegacyRouteScope) {
        activeLegacyRouteScope.trackAbortable(abortController);
      }
      try {
        const res = await fetch(
          url,
          abortController ? { signal: abortController.signal } : void 0
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.arrayBuffer();
      } finally {
        updateLoadingBar(false);
      }
    }
    async function muxDashVideoAudioToMp4(videoBuf, audioBuf) {
      const MB = Mediabunny2;
      const videoInput = new MB.Input({
        formats: [MB.MP4],
        source: new MB.BufferSource(videoBuf)
      });
      const audioInput = new MB.Input({
        formats: [MB.MP4],
        source: new MB.BufferSource(audioBuf)
      });
      const vTrack = await videoInput.getPrimaryVideoTrack();
      if (!vTrack || !vTrack.codec) throw new Error("No video track found");
      const aTrack = await audioInput.getPrimaryAudioTrack();
      if (!aTrack || !aTrack.codec) throw new Error("No audio track found");
      const vSink = new MB.EncodedPacketSink(vTrack);
      const aSink = new MB.EncodedPacketSink(aTrack);
      const output = new MB.Output({
        format: new MB.Mp4OutputFormat({ fastStart: "in-memory" }),
        target: new MB.BufferTarget()
      });
      const vSource = new MB.EncodedVideoPacketSource(vTrack.codec);
      const aSource = new MB.EncodedAudioPacketSource(aTrack.codec);
      output.addVideoTrack(vSource, { rotation: vTrack.rotation || 0 });
      output.addAudioTrack(aSource);
      await output.start();
      const vDecoderConfig = await vTrack.getDecoderConfig();
      const aDecoderConfig = await aTrack.getDecoderConfig();
      const vMeta = vDecoderConfig ? { decoderConfig: vDecoderConfig } : void 0;
      const aMeta = aDecoderConfig ? { decoderConfig: aDecoderConfig } : void 0;
      const vIter = vSink.packets();
      const aIter = aSink.packets();
      let vNext = await vIter.next();
      let aNext = await aIter.next();
      let vSentMeta = false;
      let aSentMeta = false;
      while (!vNext.done || !aNext.done) {
        const takeVideo = (() => {
          if (vNext.done) return false;
          if (aNext.done) return true;
          return vNext.value.timestamp <= aNext.value.timestamp;
        })();
        if (takeVideo) {
          await vSource.add(vNext.value, vSentMeta ? void 0 : vMeta);
          vSentMeta = true;
          vNext = await vIter.next();
        } else {
          await aSource.add(aNext.value, aSentMeta ? void 0 : aMeta);
          aSentMeta = true;
          aNext = await aIter.next();
        }
      }
      await output.finalize();
      const outBuf = output.target.buffer;
      if (outBuf instanceof ArrayBuffer) return outBuf;
      if (outBuf && outBuf.buffer) {
        return outBuf.buffer.slice(
          outBuf.byteOffset,
          outBuf.byteOffset + outBuf.byteLength
        );
      }
      throw new Error("Unexpected output buffer type");
    }
    const dashExecutionCoordinator = new media.DashExecutionCoordinator({
      createMp4Blob: (buffer) => new Blob([buffer], { type: "video/mp4" }),
      fetchArrayBuffer,
      logger: (...messages) => logger(...messages),
      mux: muxDashVideoAudioToMp4,
      saveMerged: (sourceUrl, blob, metadata) => createSaveFileElement(
        sourceUrl,
        blob,
        metadata,
        metadata.downloadOperationOptions
      ),
      saveStream: (url, metadata) => saveFiles(url, metadata, metadata.downloadOperationOptions)
    });
    async function downloadDashStreams(videoUrl, audioUrl, username, sourceType, timestamp, shortcode, operationOptions = createDownloadOperationOptions()) {
      return await dashExecutionCoordinator.execute({
        videoUrl,
        audioUrl,
        metadata: {
          username,
          sourceType,
          timestamp,
          shortcode,
          downloadOperationOptions: operationOptions
        }
      });
    }
    async function tryHandleDashFromMediaItem({
      mediaItem,
      username,
      sourceType,
      timestamp,
      shortcode,
      isPreview,
      index,
      operationOptions,
      throwIfCancelled = () => {
      }
    }) {
      try {
        throwIfCancelled();
        if (!USER_SETTING.PREFER_DASH_MANIFEST) return false;
        if (!USER_SETTING.FORCE_RESOURCE_VIA_MEDIA) return false;
        if (!mediaItem?.video_dash_manifest) return false;
        if (!mediaItem?.video_versions) return false;
        const best = media.parseDashManifest(mediaItem.video_dash_manifest, {
          DOMParser,
          hasAudio: mediaItem.has_audio,
          logger: (...messages) => logger(...messages)
        });
        const vUrl = best?.video?.url || "";
        const aUrl = best?.audio?.url || "";
        if (!vUrl) {
          return false;
        }
        logger("[DASH]", "best reps selected", {
          video: best.video ? {
            height: best.video.height,
            width: best.video.width,
            bandwidth: best.video.bandwidth,
            codecs: best.video.codecs
          } : null,
          audio: best.audio ? { bandwidth: best.audio.bandwidth, codecs: best.audio.codecs } : "(none)"
        });
        if (isPreview) {
          throwIfCancelled();
          openNewTab(vUrl);
          return true;
        }
        if (!aUrl) {
          logger("[DASH]", "download mode -> VIDEO-ONLY DASH (no audio rep)");
          return await saveFiles(vUrl, {
            username,
            sourceType,
            timestamp,
            filetype: "mp4",
            shortcode,
            index
          }, operationOptions);
        }
        logger("[DASH]", "download mode -> DASH video+audio");
        return await downloadDashStreams(
          vUrl,
          aUrl,
          username,
          sourceType,
          timestamp,
          shortcode,
          operationOptions
        );
      } catch (e) {
        if (isStoryActionAbort(e)) throw e;
        logger(
          "[DASH]",
          "tryHandleDashFromMediaItem failed -> fallback",
          e?.message || e
        );
        return false;
      }
    }
    async function triggerDownload(blob, filename, operationOptions = createDownloadOperationOptions()) {
      return await downloadTransport.downloadBlob(
        blob,
        filename,
        operationOptions
      );
    }
    function getSaveFileName(downloadLink, metadata) {
      return createDownloadFilename(downloadLink, metadata, {
        autoRename: USER_SETTING.AUTO_RENAME,
        renameFormat: state.fileRenameFormat
      });
    }
    async function createSaveFileElement(downloadLink, object, metadata, operationOptions = createDownloadOperationOptions()) {
      const shouldModifyExif = shouldModifyExifBlob(object, metadata);
      const preparedMetadata = await prepareSaveMetadata(
        metadata,
        shouldModifyExif || saveFilenameNeedsUid()
      );
      const downloadName = getSaveFileName(downloadLink, preparedMetadata);
      if (shouldModifyExif) {
        try {
          const newBlob = await changeExifData(object, preparedMetadata);
          return await triggerDownload(
            newBlob,
            downloadName,
            operationOptions
          );
        } catch (err) {
          console.error(
            "Failed to strip EXIF and/or attach post URL to EXIF.",
            err
          );
          return await triggerDownload(object, downloadName, operationOptions);
        }
      }
      return await triggerDownload(object, downloadName, operationOptions);
    }
    async function changeExifData(blob, metadata) {
      const concat = (...arr) => {
        const len = arr.reduce((s, a) => s + a.length, 0);
        const out = new Uint8Array(len);
        let p = 0;
        for (const a of arr) {
          out.set(a, p);
          p += a.length;
        }
        return out;
      };
      const u32le = (v) => {
        const b = new Uint8Array(4);
        new DataView(b.buffer).setUint32(0, v, true);
        return b;
      };
      const u16le = (v) => {
        const b = new Uint8Array(2);
        new DataView(b.buffer).setUint16(0, v, true);
        return b;
      };
      const enc = (s) => new TextEncoder().encode(s);
      const encUtf16le = (s) => {
        const out = new Uint8Array(s.length * 2);
        for (let i = 0; i < s.length; i++) {
          const code = s.charCodeAt(i);
          out[i * 2] = code & 255;
          out[i * 2 + 1] = code >> 8 & 255;
        }
        return out;
      };
      const formatExifDate = (ts) => {
        let parsed = Number(ts);
        if (!Number.isFinite(parsed)) {
          parsed = Date.now();
        }
        if (parsed < 1e12) {
          parsed *= 1e3;
        }
        const date = new Date(parsed);
        if (Number.isNaN(date.getTime())) {
          return "1970:01:01 00:00:00";
        }
        const y = String(date.getFullYear()).padStart(4, "0");
        const m = String(date.getMonth() + 1).padStart(2, "0");
        const d = String(date.getDate()).padStart(2, "0");
        const hh = String(date.getHours()).padStart(2, "0");
        const mm = String(date.getMinutes()).padStart(2, "0");
        const ss = String(date.getSeconds()).padStart(2, "0");
        return `${y}:${m}:${d} ${hh}:${mm}:${ss}`;
      };
      const makeIFDEntry = (tag, type, count, valueOrOffset) => concat(u16le(tag), u16le(type), u32le(count), u32le(valueOrOffset));
      const fourCC = (dv2, o) => String.fromCharCode(
        dv2.getUint8(o),
        dv2.getUint8(o + 1),
        dv2.getUint8(o + 2),
        dv2.getUint8(o + 3)
      );
      const head = new Uint8Array(await blob.slice(0, 12).arrayBuffer());
      const isJPEG = head[0] === 255 && head[1] === 216;
      const isWEBP = head.length >= 12 && String.fromCharCode(...head.subarray(0, 4)) === "RIFF" && String.fromCharCode(...head.subarray(8, 12)) === "WEBP";
      if (!isJPEG && !isWEBP) throw new Error("Not a JPEG or WEBP");
      const exifDateString = `${formatExifDate(metadata.timestamp)}\0`;
      const username = `${(metadata.username || "unknown").toString()}\0`;
      const url = `https://www.instagram.com/p/${metadata.shortcode}/`;
      const commentUrl = `https://www.instagram.com/uid/${metadata.uid || "unknown"}`;
      const dateBytes = enc(exifDateString);
      const artistBytes = enc(username);
      const keywordBytes = encUtf16le(`${url}\0`);
      const xpCommentBytes = encUtf16le(`${commentUrl}\0`);
      const exifPrefix = enc("Exif\0\0");
      const tiffHeader = Uint8Array.from([
        73,
        73,
        42,
        0,
        8,
        0,
        0,
        0
      ]);
      const ifd0Count = 4;
      const exifIfdCount = 1;
      const ifd0Size = 2 + ifd0Count * 12 + 4;
      const exifIfdOffset = 8 + ifd0Size;
      const exifIfdSize = 2 + exifIfdCount * 12 + 4;
      const dataStartOffset = 8 + ifd0Size + exifIfdSize;
      const artistOffset = dataStartOffset;
      const keywordOffset = artistOffset + artistBytes.length;
      const xpCommentOffset = keywordOffset + keywordBytes.length;
      const dateOffset = xpCommentOffset + xpCommentBytes.length;
      const ifd0 = concat(
        u16le(ifd0Count),
        makeIFDEntry(315, 2, artistBytes.length, artistOffset),
        // Artist
        makeIFDEntry(34665, 4, 1, exifIfdOffset),
        // Exif Offset
        makeIFDEntry(40092, 1, xpCommentBytes.length, xpCommentOffset),
        // XPComment
        makeIFDEntry(40094, 1, keywordBytes.length, keywordOffset),
        // XPKeywords
        u32le(0)
      );
      const exifIfd = concat(
        u16le(exifIfdCount),
        makeIFDEntry(36867, 2, dateBytes.length, dateOffset),
        u32le(0)
      );
      const tiffBody = concat(
        tiffHeader,
        ifd0,
        exifIfd,
        artistBytes,
        keywordBytes,
        xpCommentBytes,
        dateBytes
      );
      if (isJPEG) {
        const ab2 = await blob.arrayBuffer();
        const dv2 = new DataView(ab2);
        const app1Body = concat(exifPrefix, tiffBody);
        const app1Header = new Uint8Array(4);
        new DataView(app1Header.buffer).setUint16(0, 65505);
        new DataView(app1Header.buffer).setUint16(2, app1Body.length + 2);
        const newAPP1 = concat(app1Header, app1Body);
        const parts = [new Uint8Array(ab2, 0, 2)];
        let off = 2, added = false;
        while (off < dv2.byteLength) {
          const marker = dv2.getUint16(off);
          if ((marker & 65280) !== 65280) break;
          if (marker === 65498) {
            if (!added) parts.push(newAPP1);
            parts.push(new Uint8Array(ab2, off));
            break;
          }
          const len = dv2.getUint16(off + 2) + 2;
          if (marker === 65505) {
            off += len;
            continue;
          }
          parts.push(new Uint8Array(ab2, off, len));
          off += len;
        }
        const total = parts.reduce((s, a) => s + a.length, 0);
        const out = new Uint8Array(total);
        let p = 0;
        parts.forEach((a) => {
          out.set(a, p);
          p += a.length;
        });
        return new Blob([out], {
          type: "image/jpeg"
        });
      }
      const ab = await blob.arrayBuffer();
      const dv = new DataView(ab);
      const chunks = [];
      let vp8xIdx = -1;
      let offset = 12;
      while (offset < dv.byteLength) {
        const cc = fourCC(dv, offset);
        const sz = dv.getUint32(offset + 4, true);
        const pad = sz & 1;
        const full = 8 + sz + pad;
        if (cc !== "EXIF" && cc !== "XMP ") {
          chunks.push(new Uint8Array(ab, offset, full));
          if (cc === "VP8X") vp8xIdx = chunks.length - 1;
        }
        offset += full;
      }
      let exifChunk = concat(
        enc("EXIF"),
        u32le(exifPrefix.length + tiffBody.length),
        exifPrefix,
        tiffBody
      );
      if (exifChunk.length & 1) exifChunk = concat(exifChunk, Uint8Array.of(0));
      if (vp8xIdx !== -1) {
        const vp8x = new Uint8Array(chunks[vp8xIdx]);
        vp8x[8] |= 16;
        chunks[vp8xIdx] = vp8x;
        chunks.splice(vp8xIdx + 1, 0, exifChunk);
      } else {
        chunks.push(exifChunk);
      }
      const payload = chunks.reduce((s, c) => s + c.length, 0);
      const riffHeader = concat(enc("RIFF"), u32le(payload + 4), enc("WEBP"));
      const finalBuf = concat(riffHeader, ...chunks);
      return new Blob([finalBuf], {
        type: "image/webp"
      });
    }
    function getMediaDescriptorForElement(element) {
      const stored = mediaDescriptorByElement.get(element);
      if (stored) return stored;
      const $element = $(element);
      const sourceType = $element.attr("data-name");
      const extension = $element.attr("data-type") || (sourceType === "video" ? "mp4" : "jpg");
      const directUrl = $element.attr("data-href") || "";
      const canonicalMediaId = $element.attr("media-id");
      const mediaId = canonicalMediaId || `legacy-url:${directUrl}`;
      const descriptor = {
        mediaId,
        directUrl,
        thumbnailUrl: $element.find("img").attr("src") || null,
        kind: extension === "mp4" || sourceType === "video" ? "video" : "image",
        extension,
        owner: $element.attr("data-username") || null,
        shortcode: $element.attr("data-path") || null,
        publishTime: $element.attr("datetime") || null,
        carouselIndex: Number($element.attr("data-globalindex")) || 0,
        rawMediaItem: canonicalMediaId ? state.GL_mediaDataCache[canonicalMediaId] || null : null,
        dashManifest: state.GL_mediaDataCache[canonicalMediaId]?.video_dash_manifest || null,
        hasCanonicalMediaId: canonicalMediaId != null,
        sourceType
      };
      mediaDescriptorByElement.set(element, descriptor);
      return descriptor;
    }
    function createLegacyMediaActionService(metadata, actionOptions = {}) {
      let mediaApiAttempted = false;
      let dashResult;
      let fallbackActionHandled = false;
      let fallbackActionResult;
      const throwIfCancelled = typeof actionOptions.throwIfCancelled === "function" ? actionOptions.throwIfCancelled : () => {
      };
      function resolveOutputOption(name, context, fallback) {
        if (!Object.prototype.hasOwnProperty.call(actionOptions, name)) {
          return fallback;
        }
        const option = actionOptions[name];
        return typeof option === "function" ? option(context) : option;
      }
      function createActionFileOptions(context, intent) {
        const isThumbnail = intent === media.MEDIA_INTENT.THUMBNAIL;
        const defaultSourceType = isThumbnail ? actionOptions.thumbnailSourceType || "thumbnail" : metadata.sourceType;
        const fileOptions = {
          username: metadata.username,
          sourceType: resolveOutputOption(
            "outputSourceType",
            context,
            defaultSourceType
          ),
          timestamp: resolveOutputOption(
            "outputTimestamp",
            context,
            metadata.timestamp
          ),
          filetype: isThumbnail ? "jpg" : context.originalDescriptor.extension,
          shortcode: resolveOutputOption(
            "outputShortcode",
            context,
            context.originalDescriptor.shortcode
          )
        };
        if (!isThumbnail) fileOptions.uid = metadata.uid;
        if (!isThumbnail && !mediaApiAttempted && actionOptions.includeIndex !== false) {
          fileOptions.index = metadata.index;
        }
        return fileOptions;
      }
      function resolvePreviewDashDescriptor(resolved, intent) {
        const mediaItem = resolved?.rawMediaItem;
        if (intent !== media.MEDIA_INTENT.PREVIEW || actionOptions.useDashForPreview !== true || !USER_SETTING.PREFER_DASH_MANIFEST || !USER_SETTING.FORCE_RESOURCE_VIA_MEDIA || !mediaItem?.video_dash_manifest || !mediaItem?.video_versions) {
          return resolved;
        }
        try {
          const best = media.parseDashManifest(mediaItem.video_dash_manifest, {
            DOMParser,
            hasAudio: mediaItem.has_audio,
            logger: (...messages) => logger(...messages)
          });
          const videoUrl = best?.video?.url;
          if (!videoUrl) return resolved;
          logger("[DASH]", "preview mode -> best video representation");
          return { ...resolved, directUrl: videoUrl };
        } catch (error) {
          logger(
            "[DASH]",
            "preview manifest failed -> progressive fallback",
            error?.message || error
          );
          return resolved;
        }
      }
      function notifyActionOutput(context) {
        throwIfCancelled();
        actionOptions.onOutput?.(context);
      }
      return new media.MediaActionService(
        {
          getCachedImage({ descriptor }) {
            const cacheKey = Object.prototype.hasOwnProperty.call(
              actionOptions,
              "imageCacheKey"
            ) ? actionOptions.imageCacheKey : descriptor.mediaId;
            return getImageFromCache(cacheKey);
          },
          async resolveMedia({ descriptor, intent }) {
            throwIfCancelled();
            mediaApiAttempted = true;
            updateLoadingBar(true);
            let result;
            try {
              result = await getMediaInfo(descriptor.mediaId);
            } catch (cause) {
              if (isStoryActionAbort(cause)) throw cause;
              const error = new Error("Media API request failed.");
              error.cause = cause;
              error.alreadyReported = cause === -1 || cause?.alreadyReported === true;
              throw error;
            } finally {
              updateLoadingBar(false);
            }
            throwIfCancelled();
            if (result?.status !== "ok") {
              const error = new Error(
                result?.message || "Media API returned an unsuccessful response."
              );
              error.response = result;
              throw error;
            }
            let resolved = media.normalizeApiMedia(result)[0];
            if (!resolved?.directUrl) {
              throw new Error("Media API returned no downloadable resource.");
            }
            if (actionOptions.retainFirstMediaApiImageCandidate === true && resolved.kind === "image") {
              const firstImageUrl = resolved.rawMediaItem?.image_versions2?.candidates?.[0]?.url;
              if (firstImageUrl) {
                resolved = {
                  ...resolved,
                  directUrl: firstImageUrl,
                  thumbnailUrl: firstImageUrl
                };
              }
            }
            return resolvePreviewDashDescriptor(resolved, intent);
          },
          async resolveDash(context) {
            throwIfCancelled();
            const { descriptor, originalDescriptor } = context;
            const cachedMediaItem = state.GL_mediaDataCache[descriptor.mediaId];
            const mediaItem = [
              descriptor.rawMediaItem,
              originalDescriptor.rawMediaItem,
              cachedMediaItem
            ].find((item) => item?.video_dash_manifest);
            if (!mediaItem?.video_dash_manifest) return null;
            logger(
              "[Video Dash Stream]",
              "Processing video with DASH manifest, mediaId:",
              descriptor.mediaId
            );
            const handled = await tryHandleDashFromMediaItem({
              mediaItem,
              username: metadata.username,
              sourceType: resolveOutputOption(
                "outputSourceType",
                context,
                metadata.sourceType
              ),
              timestamp: resolveOutputOption(
                "outputTimestamp",
                context,
                metadata.timestamp
              ),
              shortcode: resolveOutputOption(
                "outputShortcode",
                context,
                descriptor.shortcode
              ),
              isPreview: false,
              index: metadata.index,
              operationOptions: actionOptions.operationOptions,
              throwIfCancelled
            });
            if (!handled) return null;
            dashResult = handled;
            return {
              directUrl: descriptor.directUrl,
              rawMediaItem: mediaItem,
              dashManifest: mediaItem.video_dash_manifest
            };
          },
          outputs: {
            download(context) {
              if (fallbackActionHandled) return fallbackActionResult;
              if (dashResult !== void 0) return dashResult;
              notifyActionOutput(context);
              return saveFiles(
                context.url,
                createActionFileOptions(
                  context,
                  media.MEDIA_INTENT.DOWNLOAD
                ),
                actionOptions.operationOptions
              );
            },
            preview(context) {
              if (fallbackActionHandled) return fallbackActionResult;
              notifyActionOutput(context);
              openNewTab(
                context.source === "cache" ? context.url : actionOptions.replacePreviewHost === false ? context.url : replaceSameOriginHost(context.url)
              );
              return true;
            },
            thumbnail(context) {
              if (fallbackActionHandled) return fallbackActionResult;
              notifyActionOutput(context);
              return saveFiles(
                context.url,
                createActionFileOptions(
                  context,
                  media.MEDIA_INTENT.THUMBNAIL
                ),
                actionOptions.operationOptions
              );
            }
          },
          async onStageError(error, context) {
            if (context.stage === media.MEDIA_ACTION_STAGE.MEDIA_API && context.willFallback && actionOptions.markMediaApiFallback && error?.response) {
              state.tempFetchRateLimit = true;
            }
            if (context.stage === media.MEDIA_ACTION_STAGE.MEDIA_API && actionOptions.logMediaApiError && error?.response) {
              logger(error.response);
            }
            if (context.stage === media.MEDIA_ACTION_STAGE.MEDIA_API && context.willFallback && typeof actionOptions.onMediaApiFallback === "function") {
              fallbackActionHandled = true;
              fallbackActionResult = await actionOptions.onMediaApiFallback(
                error,
                context
              );
            }
            if (context.stage === media.MEDIA_ACTION_STAGE.MEDIA_API && !context.willFallback && !error?.alreadyReported && !(actionOptions.deferMediaApiRequestFailureAlert === true && !error?.response)) {
              alert(
                "Fetch failed from Media API. API response message: " + error.message
              );
              error.alreadyReported = true;
            }
          }
        },
        {
          dashBeforeMediaApi: actionOptions.dashBeforeMediaApi === true,
          failOpenOnCacheError: (error) => !isStoryActionAbort(error),
          failOpenOnDashError: (error) => !isStoryActionAbort(error),
          useImageCache: ({ descriptor }) => actionOptions.useImageCache !== false && USER_SETTING.CAPTURE_IMAGE_VIA_MEDIA_CACHE && (descriptor.hasCanonicalMediaId !== false || actionOptions.allowNonCanonicalImageCache === true),
          useMediaApi: ({ descriptor, intent }) => actionOptions.useMediaApi !== false && USER_SETTING.FORCE_RESOURCE_VIA_MEDIA && descriptor.hasCanonicalMediaId !== false && (intent !== media.MEDIA_INTENT.THUMBNAIL || actionOptions.allowMediaApiForThumbnail === true),
          useDash: ({ descriptor, originalDescriptor }) => !fallbackActionHandled && actionOptions.useDash !== false && USER_SETTING.PREFER_DASH_MANIFEST && USER_SETTING.FORCE_RESOURCE_VIA_MEDIA && descriptor.hasCanonicalMediaId !== false && Boolean(
            descriptor.dashManifest || descriptor.rawMediaItem?.video_dash_manifest || originalDescriptor.dashManifest || originalDescriptor.rawMediaItem?.video_dash_manifest || state.GL_mediaDataCache[descriptor.mediaId]?.video_dash_manifest
          ),
          failOpenOnMediaApiError: (error) => USER_SETTING.FALLBACK_TO_BLOB_FETCH_IF_MEDIA_API_THROTTLED && !error?.alreadyReported && !isStoryActionAbort(error)
        }
      );
    }
    async function executeMediaDescriptor(descriptor, intent, actionOptions = {}) {
      actionOptions.throwIfCancelled?.();
      const sourceType = descriptor.sourceType || (descriptor.kind === "video" ? "video" : "photo");
      let timestamp = actionOptions.defaultTimestamp ?? Math.floor((/* @__PURE__ */ new Date()).getTime() / 1e3);
      let username = descriptor.owner || state.GL_username;
      const index = descriptor.carouselIndex || 0;
      if (!username && descriptor.shortcode && actionOptions.resolveMissingOwner !== false && intent !== media.MEDIA_INTENT.PREVIEW) {
        logger(
          "catching owner name from shortcode:",
          descriptor.directUrl
        );
        username = await getPostOwner(descriptor.shortcode).catch((err) => {
          logger(
            "get username failed, replace with default string, error message:",
            err.message
          );
        });
        actionOptions.throwIfCancelled?.();
        if (username == null) username = "NONE";
      }
      if (USER_SETTING.RENAME_PUBLISH_DATE && descriptor.publishTime) {
        timestamp = parseInt(descriptor.publishTime);
      }
      const actionDescriptor = {
        ...descriptor,
        owner: username || null,
        publishTime: timestamp,
        carouselIndex: Math.max(1, Number(descriptor.carouselIndex) || 1)
      };
      const actionService = createLegacyMediaActionService({
        username,
        sourceType,
        timestamp,
        index,
        uid: actionOptions.uid
      }, actionOptions);
      try {
        actionOptions.throwIfCancelled?.();
        return await actionService.execute(actionDescriptor, intent);
      } catch (error) {
        if (actionOptions.swallowMediaApiFailure === true && error?.response) {
          return false;
        }
        throw error;
      }
    }
    async function triggerLinkElement(element, isPreview) {
      try {
        if (!element) {
          throw new Error("Missing link element.");
        }
        return await executeMediaDescriptor(
          getMediaDescriptorForElement(element),
          isPreview ? media.MEDIA_INTENT.PREVIEW : media.MEDIA_INTENT.DOWNLOAD,
          { dashBeforeMediaApi: !isPreview }
        );
      } catch (err) {
        console.error("Occur error in triggerLinkElement:", err);
        logger("Occur error in triggerLinkElement:", err);
        return false;
      }
    }
    function replaceSameOriginHost(url) {
      var urlObj = new URL(url);
      urlObj.host = "scontent.cdninstagram.com";
      return urlObj.href;
    }
    function mountUpdateCheckService() {
      if (activeApplicationScope && !activeApplicationScope.disposed) {
        updateCheckService.mount(activeApplicationScope);
      }
    }
    function checkingScriptUpdate(interval) {
      mountUpdateCheckService();
      updateCheckService.checkIfDue(
        interval,
        USER_SETTING.CHECK_FOR_UPDATE
      );
    }
    function callNotification() {
      mountUpdateCheckService();
      return updateCheckService.notifyIfUpdateAvailable();
    }
    function openNewTab(link) {
      var a = document.createElement("a");
      a.href = link;
      a.target = "_blank";
      document.body.appendChild(a);
      a.click();
      a.remove();
      routeSetTimeout(() => {
        updateLoadingBar(false);
      }, 125);
    }
    function reloadScript() {
      const reloadChange = { reason: "manual-reload", type: "reload" };
      pendingMaximumReelReloadHandoff = maximumReelPlaybackController.relinquish("manual-reload");
      state.firstStarted = false;
      state.currentURL = location.href;
      const reloadHandoff = pendingMaximumReelReloadHandoff;
      try {
        applicationCoordinator.reload(reloadChange.reason);
      } finally {
        if (reloadHandoff && pendingMaximumReelReloadHandoff === reloadHandoff) {
          pendingMaximumReelReloadHandoff = null;
          reloadHandoff.cancel("application-reload-failed");
        }
      }
      applicationDomLifecycleService.refresh(reloadChange);
      logger("main timer re-register completed");
    }
    function logger(...messages) {
      var dd = /* @__PURE__ */ new Date();
      state.GL_logger.push({
        time: dd.getTime(),
        content: [...messages]
      });
      if (state.GL_logger.length > 1e3) {
        state.GL_logger = [
          {
            time: dd.getTime(),
            content: ["logger sliced"]
          },
          ...state.GL_logger.slice(-999)
        ];
      }
      if (ENABLE_CONSOLE_LOGGING) {
        console.log(`[${dd.toISOString()}]`, ...messages);
      }
    }
    function initSettings() {
      Object.assign(USER_SETTING, settingsStore2.load());
      if (settingsStore2.wasLoadedFromStorage("MODIFY_VIDEO_VOLUME") && USER_SETTING.MODIFY_VIDEO_VOLUME !== true) {
        state.videoVolume = 1;
      }
    }
    function toggleVolumeSilder(resolveVideos, $buttonParent, loggerType, customClass = "") {
      const controller = getRouteVideoVolumeSliderController();
      if (!controller) return;
      const liveVideoLocator = typeof resolveVideos === "function" ? resolveVideos : () => resolveVideos?.get?.() || resolveVideos;
      controller.toggle({
        host: $buttonParent.first()[0],
        resolveVideos: liveVideoLocator,
        loggerType,
        customClass
      });
    }
    function toggleStoryVolumeSilder($video, storyType) {
      const $host = $video.parents("div[style][class]").filter(function() {
        return $(this).width() == $video.width();
      }).first();
      toggleVolumeSilder(
        () => $host.find("video").get(),
        $host,
        storyType,
        "vertical"
      );
    }
    function triggerReactClickHandler(el) {
      const reactKey = Object.keys(el).find(
        (k) => k.startsWith("__reactProps") || k.startsWith("__reactEventHandlers")
      );
      const props = el[reactKey];
      if (props && typeof props.onClick === "function") {
        const mockEvent = {
          target: el,
          currentTarget: el,
          preventDefault: () => {
          },
          stopPropagation: () => {
          },
          nativeEvent: new MouseEvent("click")
        };
        props.onClick(mockEvent);
      } else {
        logger("No React click handler found for the element:", el);
      }
    }
    function updatePopupSelectionSummary(root = ".IG_POPUP_DIG") {
      const $root = typeof root === "string" ? $(root) : root;
      if (!$root || $root.length === 0) return;
      const $titleCheckbox = $root.find(".IG_POPUP_DIG_TITLE .checkbox");
      const $countSpan = $titleCheckbox.find(".item-count");
      if ($titleCheckbox.length === 0 || $countSpan.length === 0) return;
      const $items = $root.find(".IG_POPUP_DIG_BODY .inner_box");
      const total = $items.length;
      const selected = $items.filter(":checked").length;
      $titleCheckbox.find("input").prop("checked", total > 0 && selected === total);
      const formatCount = (count, singularKey, pluralKey) => {
        const key = count === 1 ? singularKey : pluralKey;
        const template = _i18n(key);
        return typeof template === "string" ? template.replace("%COUNT%", count) : String(count);
      };
      const totalLabel = formatCount(
        total,
        "ITEM_COUNT_SINGULAR",
        "ITEM_COUNT_PLURAL"
      );
      const selectedLabel = formatCount(
        selected,
        "SELECTED_COUNT_SINGULAR",
        "SELECTED_COUNT_PLURAL"
      );
      $countSpan.text(` (${selectedLabel} / ${totalLabel})`);
    }
    function IG_createDM(hasHidden = false, hasCheckbox = false, routeOwned = false) {
      const dialogClasses = ["IG_POPUP_DIG"];
      if (hasHidden) dialogClasses.push("hidden");
      if (hasCheckbox) dialogClasses.push("IG_POPUP_DIG_MEDIA");
      if (routeOwned) dialogClasses.push("IG_POPUP_DIG_ROUTE");
      $("body").append(
        `<div class="${dialogClasses.join(" ")}"><div class="IG_POPUP_DIG_BG"></div><div class="IG_POPUP_DIG_MAIN"><div class="IG_POPUP_DIG_TITLE"></div><div class="IG_POPUP_DIG_BODY"></div></div></div>`
      );
      $(".IG_POPUP_DIG .IG_POPUP_DIG_MAIN .IG_POPUP_DIG_TITLE").append(
        `<div class="insta-loader-dialog-header"><div><div class="insta-loader-dialog-brand">${SCRIPT_NAME} <span>${GM_info.script.version}</span></div><div id="post_info">Post ID: <span id="article-id"></span></div></div><div class="insta-loader-dialog-shortcut"><kbd>${getPlatformModifierKey()}</kbd>+<kbd>Q</kbd> <span data-ih-locale="CLOSE">${_i18nHTML("CLOSE")}</span></div><div class="IG_POPUP_DIG_BTN">${SVG.CLOSE}</div></div>`
      );
      if (hasCheckbox) {
        $(".IG_POPUP_DIG .IG_POPUP_DIG_MAIN .IG_POPUP_DIG_TITLE").append(
          '<div id="button_group"></div>'
        );
        $(
          ".IG_POPUP_DIG .IG_POPUP_DIG_MAIN .IG_POPUP_DIG_TITLE > div#button_group"
        ).append(
          `<button id="batch_download_selected" data-ih-locale="BATCH_DOWNLOAD_SELECTED">${_i18nHTML("BATCH_DOWNLOAD_SELECTED")}</button>`
        );
        $(
          ".IG_POPUP_DIG .IG_POPUP_DIG_MAIN .IG_POPUP_DIG_TITLE > div#button_group"
        ).append(
          `<button id="batch_download_direct" data-ih-locale="BATCH_DOWNLOAD_DIRECT">${_i18nHTML("BATCH_DOWNLOAD_DIRECT")}</button>`
        );
        $(".IG_POPUP_DIG .IG_POPUP_DIG_MAIN .IG_POPUP_DIG_TITLE").append(
          `<label class="checkbox"><input value="yes" type="checkbox" /><span data-ih-locale="ALL_CHECK">${_i18nHTML("ALL_CHECK")}</span><span class="item-count"></span></label>`
        );
      }
    }
    function IG_setDM(hasHidden) {
      if ($(".IG_POPUP_DIG").length) {
        if (hasHidden) {
          $(".IG_POPUP_DIG").addClass("hidden");
        } else {
          $(".IG_POPUP_DIG").removeClass("hidden");
        }
      }
    }
    function openImageViewer(imageUrl) {
      return imageViewerController.open(imageUrl, activeLegacyRouteScope);
    }
    function removeImageViewer() {
      return imageViewerController.dispose();
    }
    function purgeCache() {
      imageCache.purge();
    }
    function mediaIdFromURL(url) {
      return imageCache.decodeMediaId(url);
    }
    function putInCache(mediaId, url) {
      imageCache.put(mediaId, url);
    }
    function getImageFromCache(mediaId) {
      return imageCache.get(mediaId);
    }
    function registerPerformanceObserver() {
      return registerImageCachePerformanceObserver({
        PerformanceObserver: environment2.window.PerformanceObserver,
        cache: {
          decodeMediaId: mediaIdFromURL,
          has: (mediaId) => Boolean(state.GL_imageCache[mediaId]),
          put: putInCache
        },
        enabled: () => USER_SETTING.CAPTURE_IMAGE_VIA_MEDIA_CACHE,
        onError: (err) => {
          logger(
            "registerPerformanceObserver()",
            "disabled",
            err?.message || err
          );
        }
      });
    }
    function translateText() {
      if (translationTextCache != null) {
        return translationTextCache;
      }
      var eLocale = {
        "en-US": {
          NOTICE_UPDATE_TITLE: "New version released.",
          NOTICE_UPDATE_CONTENT: "insta-loader has released a new version, click here to update.",
          CHECK_FOR_UPDATE: "Check for Script Updates",
          RELOAD_SCRIPT: "Reload Script",
          DONATE: "Donate",
          FEEDBACK: "Feedback",
          IMAGE_VIEWER: "Open Image In Viewer",
          NEW_TAB: "Open in New Tab",
          SHOW_DOM_TREE: "Show DOM Tree",
          SELECT_AND_COPY: "Select All and Copy from the Input Box",
          DOWNLOAD_DOM_TREE: "Download DOM Tree as a Text File",
          REPORT_GITHUB: "Report an Issue on GitHub",
          REPORT_DISCORD: "Report an Issue on Discord Support Server",
          REPORT_FORK: "Report an Issue",
          DEBUG: "Debug Window",
          CLOSE: "Close",
          ALL_CHECK: "Select All",
          ITEM_COUNT_SINGULAR: "%COUNT% item",
          ITEM_COUNT_PLURAL: "%COUNT% items",
          ITEM_POSITION: "Item %CURRENT% of %TOTAL%",
          SELECTED_COUNT_SINGULAR: "%COUNT% selected",
          SELECTED_COUNT_PLURAL: "%COUNT% selected",
          BATCH_DOWNLOAD_SELECTED: "Download Selected Resources",
          BATCH_DOWNLOAD_DIRECT: "Download All Resources",
          IMG: "Image",
          VID: "Video",
          DW: "Download",
          DW_ALL: "Download All Resources",
          VIDEO_THUMBNAIL: "Download Video Thumbnail",
          LOAD_BLOB_ONE: "Loading Blob Media...",
          LOAD_BLOB_MULTIPLE: "Loading Blob Media and Others...",
          LOAD_BLOB_RELOAD: "Detecting Blob Media, reloading...",
          NO_CHECK_RESOURCE: "You need to select a resource to download.",
          NO_VID_URL: "Cannot find video URL.",
          SETTING: "Settings",
          AUTO_RENAME: "Automatically Rename Files (Right-Click to Set)",
          RENAME_PUBLISH_DATE: "Set Renamed File Timestamp to Resource Publish Date",
          RENAME_LOCATE_DATE: "Modify Renamed File Timestamp Date Format (Right-Click to Set)",
          DISABLE_VIDEO_LOOPING: "Disable Video Auto-looping",
          HTML5_VIDEO_CONTROL: "Display HTML5 Video Controller",
          MAX_REEL_PLAYBACK_QUALITY: "Play Standalone Reels at Maximum Quality",
          REDIRECT_CLICK_USER_STORY_PICTURE: "Redirect When Clicking on User's Story Picture",
          FORCE_FETCH_ALL_RESOURCES: "Force Fetch All Resources in the Post",
          DIRECT_DOWNLOAD_VISIBLE_RESOURCE: "Directly Download the Visible Resources in the Post",
          DIRECT_DOWNLOAD_ALL: "Directly Download All Resources in the Post",
          DIRECT_DOWNLOAD_STORY: "Directly Download All Resources in the Story/Highlight",
          MODIFY_VIDEO_VOLUME: "Modify Video Volume (Right-Click to Set)",
          MODIFY_RESOURCE_EXIF: "Modify Resource EXIF Properties",
          SCROLL_BUTTON: "Enable Scroll Buttons for Reels Page",
          FORCE_RESOURCE_VIA_MEDIA: "Force Fetch Resource via Media API",
          PREFER_DASH_MANIFEST: "Prefer DASH Manifest (Higher-Quality Video via Media API)",
          FALLBACK_TO_BLOB_FETCH_IF_MEDIA_API_THROTTLED: "Use Alternative Methods to Download When the Media API is Not Accessible",
          NEW_TAB_ALWAYS_FORCE_MEDIA_IN_POST: "Always Use Media API for [Open in New Tab] in Posts",
          SKIP_VIEW_STORY_CONFIRM: "Skip the Confirmation Page for Viewing a Story/Highlight",
          SKIP_SHARED_WITH_YOU_DIALOG: 'Skip "shared this with you" dialog on shared profile links',
          CAPTURE_IMAGE_VIA_MEDIA_CACHE: "Capture Image Resource Using Media Cache",
          AUTO_RENAME_INTRO: [
            "Auto rename file to custom format:",
            "Custom Format List:",
            "%USERNAME% - Username",
            "%SOURCE_TYPE% - Download Source",
            "%SHORTCODE% - Post Shortcode",
            "%YEAR% - Year when downloaded/published",
            "%2-YEAR% - Year (last two digits) when downloaded/published",
            "%MONTH% - Month when downloaded/published",
            "%DAY% - Day when downloaded/published",
            "%HOUR% - Hour when downloaded/published",
            "%MINUTE% - Minute when downloaded/published",
            "%SECOND% - Second when downloaded/published",
            "%ORIGINAL_NAME% - Original name of downloaded file",
            "%ORIGINAL_NAME_FIRST% - Original name of downloaded file (first part of name)",
            "%INDEX% - Resource index",
            "%UID% - User account unique ID",
            "",
            "If set to false, the file name will remain unchanged.",
            "Example: instagram_321565527_679025940443063_4318007696887450953_n.jpg"
          ],
          RENAME_PUBLISH_DATE_INTRO: "Sets the timestamp in the file rename format to the resource publish date (browser time zone).\n\nThis feature only works when [Automatically Rename Files] is set to TRUE.",
          RENAME_LOCATE_DATE_INTRO: "Modify the renamed file timestamp date format to the browser's local time, and format it to your preferred regional date format.\n\nThis feature only works when [Automatically Rename Files] is set to TRUE.",
          DISABLE_VIDEO_LOOPING_INTRO: "Disable video auto-looping in Reels and posts.",
          HTML5_VIDEO_CONTROL_INTRO: "Display the HTML5 video controller in video resource.\n\nThis will hide the custom video volume slider and replace it with the HTML5 controller. The HTML5 controller can be hidden by right-clicking on the video to reveal the original details.",
          MAX_REEL_PLAYBACK_QUALITY_INTRO: "On standalone /reel/ pages, hold the active Reel's poster for up to five seconds while loading the highest-resolution complete progressive MP4 reported by Instagram. The scrolling /reels/ feed stays on Instagram's native player because it recycles video elements. This uses more bandwidth and a private metadata request. Native playback resumes if the request is throttled, fails, times out, or Safari rejects the source. DASH downloads are separate and may provide a higher-resolution saved file.",
          REDIRECT_CLICK_USER_STORY_PICTURE_INTRO: "Redirect to a user's profile page when right-clicking on their avatar in the story area on the homepage.\nIf you use the middle mouse button to click, it will open in a new tab.",
          FORCE_FETCH_ALL_RESOURCES_INTRO: "Force fetching of all resources (photos and videos) in a post via the Instagram API to remove the limit of three resources per post.",
          DIRECT_DOWNLOAD_VISIBLE_RESOURCE_INTRO: "Directly download the current resources available in the post.",
          DIRECT_DOWNLOAD_ALL_INTRO: "When you click the download button, all resources in the post will be forcibly fetched and downloaded.",
          MODIFY_VIDEO_VOLUME_INTRO: "Modify the video playback volume in Reels and posts (right-click to open the volume setting slider).",
          SCROLL_BUTTON_INTRO: "Enable scroll buttons for the lower right corner of the Reels page.",
          FORCE_RESOURCE_VIA_MEDIA_INTRO: "The Media API will try to get the highest quality photo or video possible, but it may take longer to load.",
          PREFER_DASH_MANIFEST_INTRO: "Prefer the DASH manifest for video resources via the Media API. If a DASH manifest is available, it will download the video and audio streams SEPARATELY for the best possible quality.",
          FALLBACK_TO_BLOB_FETCH_IF_MEDIA_API_THROTTLED_INTRO: "When the Media API reaches its rate limit or cannot be used for other reasons, the Forced Fetch API will be used to download resources (the resource quality may be slightly lower).",
          NEW_TAB_ALWAYS_FORCE_MEDIA_IN_POST_INTRO: "The [Open in New Tab] button in posts will always use the Media API to obtain high-resolution resources.",
          CHECK_FOR_UPDATE_INTRO: "Check for updates when the script is triggered (check every 300 seconds).\nUpdate notifications will be sent as desktop notifications through the browser.",
          SKIP_VIEW_STORY_CONFIRM_INTRO: "Automatically skip when confirmation page is shown in story or highlight.",
          SKIP_SHARED_WITH_YOU_DIALOG_INTRO: 'Automatically click "Not now" on the "X shared this with you" dialog when opening any ?igsh= links.',
          MODIFY_RESOURCE_EXIF_INTRO: "Modify the EXIF attribute of the image resource to include metadata such as post link, shooting date, and author.",
          DIRECT_DOWNLOAD_STORY_INTRO: "When you click [Download All Resources], all stories/highlights are downloaded directly, without showing the image selection dialog.",
          CAPTURE_IMAGE_VIA_MEDIA_CACHE_INTRO: "Use a watcher to capture any high-quality image URLs in the DOM tree into the script's storage so that they can be extracted when available and upon user input.",
          HOTKEY_DEBUG_KEY: "Debug Window",
          HOTKEY_SETTINGS_KEY: "Preference Settings",
          HOTKEY_KEY_SETTINGS_KEY: "Hotkey Settings",
          HOTKEY_DOWNLOAD_STORY_KEY: "Download Story",
          HOTKEY_CONFLICT_WARNING: "This hotkey may conflict with other settings.",
          HOTKEY_RESET: "Reset"
        }
      };
      var resultUnsorted = Object.assign({}, eLocale);
      Object.entries(state.locale).forEach(([lang, translations]) => {
        resultUnsorted[lang] = Object.assign(
          {},
          resultUnsorted[lang] || {},
          translations
        );
      });
      var resultSorted = Object.keys(resultUnsorted).sort().reduce((obj, key) => {
        obj[key] = resultUnsorted[key];
        return obj;
      }, {});
      var result = Object.assign({}, resultSorted);
      for (const lang in result) {
        const translations = result[lang];
        if (!translations || typeof translations !== "object") {
          continue;
        }
        Object.keys(translations).forEach((key) => {
          const value = translations[key];
          if (Array.isArray(value)) {
            translations[key] = value.join("\n");
          }
        });
      }
      translationTextCache = result;
      return translationTextCache;
    }
    async function getTranslationText2(lang) {
      return localization.loadTranslationDictionary(
        lang,
        (url) => (
          // Locale selection is application state. A route transition must not
          // abort this request and cache the English fallback under another
          // language code.
          ownApplicationRequest(
            startJsonRequest({ url, detectApiErrors: false })
          ).catch((err) => {
            logger("getTranslationText()", "reject", err);
            throw err;
          })
        )
      );
    }
    function _i18n(text) {
      const translate = translateText();
      if (translate[state.lang] != void 0 && translate[state.lang][text] != void 0) {
        return translate[state.lang][text];
      } else {
        return translate["en-US"][text];
      }
    }
    function _i18nHTML(text) {
      return String(_i18n(text) ?? "").replace(
        /[&<>"']/g,
        (character) => ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;"
        })[character]
      );
    }
    function repaintingTranslations() {
      localization.applyTranslations(document, _i18n);
    }
    function mountApplicationEventHandlers(applicationScope) {
      const register = function() {
        if (!applicationScope.disposed) {
          registerApplicationEventHandlers(applicationScope);
        }
      };
      if (document.readyState === "loading") {
        applicationScope.listen(document, "DOMContentLoaded", register, {
          once: true
        });
      } else {
        register();
      }
    }
    function registerApplicationEventHandlers(applicationScope) {
      if (!applicationScope || applicationScope.disposed) return;
      function listenApplicationJQuery(target, events, selectorOrHandler, handler) {
        return applicationScope.listenJQuery(
          target,
          events,
          selectorOrHandler,
          handler
        );
      }
      listenApplicationJQuery(
        $("body"),
        "click",
        ".IG_POPUP_DIG_BTN, .IG_POPUP_DIG_BG",
        function() {
          if ($(this).parent("#tempWrapper").length > 0) {
            $(this).parent("#tempWrapper").fadeOut(250, function() {
              $(this).remove();
            });
          } else {
            $(".IG_POPUP_DIG").remove();
          }
        }
      );
      listenApplicationJQuery(
        $("body"),
        "click",
        'a[data-needed="direct"]',
        async function(e) {
          if (clickStartedOnInjectedAction(e)) {
            return;
          }
          const directAnchor = e.target?.closest?.('a[data-needed="direct"]');
          if (directAnchor !== this) {
            return;
          }
          e.preventDefault();
          await fireAndReport(
            () => triggerLinkElement(this),
            "triggerLinkElement()"
          );
        }
      );
      listenApplicationJQuery(
        $("body"),
        "click",
        ".IG_POPUP_DIG_BODY .newTab",
        async function(e) {
          consumeInjectedClick(e);
          const $linkElement = $(this).parent().children("a").first();
          const linkElement = $linkElement[0];
          if (USER_SETTING.FORCE_RESOURCE_VIA_MEDIA && USER_SETTING.NEW_TAB_ALWAYS_FORCE_MEDIA_IN_POST) {
            if (!linkElement) {
              console.error("Cannot find popup new-tab link element.");
              alert("Cannot find open tab URL.");
              return;
            }
            await fireAndReport(
              () => triggerLinkElement(linkElement, true),
              "triggerLinkElement()"
            );
          } else {
            if (!linkElement) {
              console.error("Cannot find popup new-tab data-href.", {
                linkElement: $linkElement.get(0)
              });
              alert("Cannot find open tab URL.");
              return;
            }
            await fireAndReport(
              () => executeMediaDescriptor(
                getMediaDescriptorForElement(linkElement),
                media.MEDIA_INTENT.PREVIEW,
                { useMediaApi: false }
              ),
              "executeMediaDescriptor()"
            );
          }
        }
      );
      listenApplicationJQuery(
        $("body"),
        "click",
        ".IG_POPUP_DIG_BODY .videoThumbnail",
        async function(e) {
          consumeInjectedClick(e);
          const linkElement = $(this).parent().children("a").first()[0];
          if (!linkElement) return false;
          const descriptor = getMediaDescriptorForElement(linkElement);
          return await fireAndReport(
            () => executeMediaDescriptor(
              {
                ...descriptor,
                shortcode: descriptor.shortcode ?? $("#article-id").text()
              },
              media.MEDIA_INTENT.THUMBNAIL,
              { useMediaApi: false }
            ),
            "executeMediaDescriptor()"
          );
        }
      );
      listenApplicationJQuery($("body"), "click", ".IG_DWSTORY", function(e) {
        consumeInjectedClick(e);
        return runStorySurfaceAction(
          (actionLifecycle) => onStory(true, void 0, void 0, actionLifecycle),
          "onStory()"
        );
      });
      listenApplicationJQuery($("body"), "click", ".IG_DWSTORY_ALL", function(e) {
        consumeInjectedClick(e);
        return runStorySurfaceAction(
          (actionLifecycle) => onStoryAll(actionLifecycle),
          "onStoryAll()"
        );
      });
      listenApplicationJQuery($("body"), "click", ".IG_DWNEWTAB", function(e) {
        consumeInjectedClick(e);
        return runStorySurfaceAction(
          (actionLifecycle) => onStory(true, true, true, actionLifecycle),
          "onStory()"
        );
      });
      listenApplicationJQuery(
        $("body"),
        "click",
        ".IG_DWSTORY_THUMBNAIL",
        function(e) {
          consumeInjectedClick(e);
          return runStorySurfaceAction(
            (actionLifecycle) => onStoryThumbnail(true, void 0, actionLifecycle),
            "onStoryThumbnail()"
          );
        }
      );
      listenApplicationJQuery($("body"), "click", ".IG_DWHISTORY", function(e) {
        consumeInjectedClick(e);
        return runStorySurfaceAction(
          (actionLifecycle) => onHighlightsStory(true, void 0, actionLifecycle),
          "onHighlightsStory()"
        );
      });
      listenApplicationJQuery(
        $("body"),
        "click",
        ".IG_DWHISTORY_ALL",
        function(e) {
          consumeInjectedClick(e);
          return runStorySurfaceAction(
            (actionLifecycle) => onHighlightsStoryAll(actionLifecycle),
            "onHighlightsStoryAll()"
          );
        }
      );
      listenApplicationJQuery($("body"), "click", ".IG_DWHINEWTAB", function(e) {
        consumeInjectedClick(e);
        return runStorySurfaceAction(
          (actionLifecycle) => onHighlightsStory(true, true, actionLifecycle),
          "onHighlightsStory()"
        );
      });
      listenApplicationJQuery(
        $("body"),
        "click",
        ".IG_DWHISTORY_THUMBNAIL",
        function(e) {
          consumeInjectedClick(e);
          return runStorySurfaceAction(
            (actionLifecycle) => onHighlightsStoryThumbnail(true, actionLifecycle),
            "onHighlightsStoryThumbnail()"
          );
        }
      );
      listenApplicationJQuery($("body"), "click", ".IG_REELS", function() {
        fireAndReport(() => onReels(true, true), "onReels()");
      });
      listenApplicationJQuery(
        $("body"),
        "click",
        ".IG_REELS_NEWTAB",
        function() {
          fireAndReport(() => onReels(true, true, true), "onReels()");
        }
      );
      listenApplicationJQuery(
        $("body"),
        "click",
        ".IG_REELS_THUMBNAIL",
        function() {
          fireAndReport(() => onReels(true, false), "onReels()");
        }
      );
      listenApplicationJQuery(
        $("body"),
        "mousedown",
        'button[role="menuitem"], div[role="menuitem"], ul > li[tabindex="-1"] > div[role="button"]',
        function(e) {
          if (e.which === 3 || e.which === 2) {
            if (location.href === "https://www.instagram.com/" && USER_SETTING.REDIRECT_CLICK_USER_STORY_PICTURE) {
              e.preventDefault();
              $(this).find("img").each(function() {
                bindStoryPictureContextMenu(this, applicationScope);
              });
              if ($(this).find("canvas._aarh, canvas + span > img").length > 0) {
                const targetUrl = "https://www.instagram.com/" + $(this).children("div").last().text();
                if (e.which === 2) {
                  GM_openInTab(targetUrl);
                } else {
                  location.href = targetUrl;
                }
              }
            }
          }
        }
      );
      listenApplicationJQuery(
        $("body"),
        "change",
        ".IG_POPUP_DIG_TITLE .checkbox",
        function() {
          const isChecked = $(this).find("input").prop("checked");
          $(".IG_POPUP_DIG_BODY .inner_box").each(function() {
            $(this).prop("checked", isChecked);
          });
          updatePopupSelectionSummary();
        }
      );
      listenApplicationJQuery(
        $("body"),
        "change",
        ".IG_POPUP_DIG_BODY .inner_box",
        function() {
          updatePopupSelectionSummary();
        }
      );
      listenApplicationJQuery(
        $("body"),
        "click",
        ".IG_POPUP_DIG_TITLE #batch_download_selected",
        async function(e) {
          consumeInjectedClick(e);
          const selectedElements = [];
          $('.IG_POPUP_DIG_BODY a[data-needed="direct"]').each(function() {
            const $link = $(this);
            if ($link.prev().children("input").prop("checked")) {
              selectedElements.push(this);
            }
          });
          const descriptors = getMediaDescriptorsForElements(selectedElements);
          if (descriptors.length === 0) {
            alert(_i18n("NO_CHECK_RESOURCE"));
          } else {
            await fireAndReport(
              () => batchDownloadPostDescriptors(descriptors),
              "batchDownloadPostFiles()"
            );
          }
        }
      );
      listenApplicationJQuery(
        $("body"),
        "click",
        ".IG_POPUP_DIG_TITLE #batch_download_direct",
        async function(e) {
          consumeInjectedClick(e);
          const descriptors = getMediaDescriptorsForElements(
            $('.IG_POPUP_DIG_BODY a[data-needed="direct"]')
          );
          await fireAndReport(
            () => batchDownloadPostDescriptors(descriptors),
            "batchDownloadPostFiles()"
          );
        }
      );
    }
  }

  // src/index.js
  var environment = createUserscriptEnvironment();
  var settingsStore = new SettingsStore(environment);
  var preferencesStore = new PreferencesStore(environment, {
    defaultLanguage: environment.window.navigator.language || environment.window.navigator.userLanguage,
    now: environment.now
  });
  var preferences = preferencesStore.load();
  startLegacyUserscript(jQuery, Mediabunny, {
    environment,
    preferences,
    preferencesStore,
    settingsStore,
    resources: {
      internalCss: INTERNAL_CSS,
      localeManifest: LOCALE_MANIFEST
    },
    localization: localization_exports,
    media: media_exports,
    jsonRequest: (options) => requestJson(environment, options),
    textRequest: (options) => requestText(environment, options)
  });
})();
