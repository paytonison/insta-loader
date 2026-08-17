import { resolvePostContext } from "../controllers/posts/post-context.js";
import {
  STORY_INTENT,
  STORY_SURFACE,
  buildStoryBatchDescriptors,
  createStoryActionContext,
  getStoryMediaApiPolicyInputs,
  getStoryProgressMetadata,
  readHighlightDomState,
  readStoryDomState,
} from "../controllers/stories/index.js";
import {
  ApplicationDomLifecycleService,
  DebugController,
  HotkeyController,
  ImageViewerController,
  MaximumReelPlaybackController,
  MenuController,
  ProfileController,
  SettingsController,
  createApplicationCoordinator,
  createRouteControllerFactory,
} from "../controllers/index.js";
import {
  VIDEO_SURFACE,
  VideoBehaviorService,
  VideoVolumeSliderController,
  VideoVolumeStore,
  createPostVideoSurfaceAdapter,
  createReelVideoSurfaceAdapter,
  createStoryVideoSurfaceAdapter,
} from "../controllers/video/index.js";
import { RouteCoordinator } from "../core/route-coordinator.js";
import {
  REQUEST_ERROR_CATEGORY,
  RequestError,
} from "../core/request.js";
import { ROUTE_KIND } from "../core/routes.js";
import { USER_SETTING_HIERARCHY } from "../core/settings-store.js";
import {
  DownloadTransport,
  createDownloadFilename,
  runDownloadBatch,
} from "../services/download/index.js";
import {
  IMAGE_CACHE_KEY,
  IMAGE_CACHE_MAX_AGE,
  IMAGE_CACHE_MAX_ITEMS,
  IMAGE_CACHE_PERSIST_DELAY,
  ImageCache,
  registerImageCachePerformanceObserver,
} from "../services/image-cache/index.js";
import { UpdateCheckService } from "../services/update-check/index.js";

const LEGACY_JSON_REQUEST_TIMEOUT_MS = 15_000;
const SAFARI_REQUEST_POLICY_VIOLATION_PATTERN =
  /(?:secfetch policy violation|resource isolation policy violated)/i;
const STORY_SURFACE_ACTION_FAILURE_MESSAGE =
  "Could not complete this Story or Highlight action. Try again; details are available in Debug Window.";

export function startLegacyUserscript($, Mediabunny, dependencies) {
  "use strict";

  const {
    environment,
    preferences,
    preferencesStore,
    settingsStore,
    resources,
    localization,
    media,
    jsonRequest: startJsonRequest,
    textRequest: startTextRequest,
  } = dependencies;
  let activeApplicationScope = null;
  let activeLegacyRouteKind = null;
  let activeLegacyRouteScope = null;
  let activeStorySurfaceAction = null;
  const pendingApplicationRequests = new Set();
  const downloadAbortControllerByScope = new WeakMap();

  function ownApplicationRequest(request) {
    if (activeApplicationScope) {
      activeApplicationScope.trackAbortable(request);
    } else {
      pendingApplicationRequests.add(request);
    }
    Promise.resolve(request).then(
      () => pendingApplicationRequests.delete(request),
      () => pendingApplicationRequests.delete(request),
    );
    return request;
  }

  function jsonRequest(options) {
    const requestOptions = {
      timeout: LEGACY_JSON_REQUEST_TIMEOUT_MS,
      ...options,
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
          { cause: error, url: requestOptions.url },
        );
      }

      logger(
        "jsonRequest()",
        "Safari policy rejected the privileged request; retrying in page context.",
        requestOptions.url,
      );
      return pageJsonRequest(requestOptions, requestScope);
    });
  }

  function isStorySurfaceInstagramRequest(url) {
    if (
      !IS_SAFARI ||
      ![ROUTE_KIND.STORY, ROUTE_KIND.HIGHLIGHT].includes(activeLegacyRouteKind)
    ) {
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
    if (
      error?.category !== REQUEST_ERROR_CATEGORY.HTTP ||
      Number(error?.status) !== 400
    ) {
      return false;
    }

    const body =
      error?.response?.responseText ?? error?.response?.response ?? "";
    return SAFARI_REQUEST_POLICY_VIOLATION_PATTERN.test(String(body));
  }

  function createPageRequestHeaders(headers) {
    return Object.fromEntries(
      Object.entries(headers || {}).filter(
        ([name]) => name.toLowerCase() !== "user-agent",
      ),
    );
  }

  function findPageRequestApiError(data, url, status, response) {
    let message = "";
    let details = null;

    if (Array.isArray(data?.errors) && data.errors.length > 0) {
      details = data.errors;
      message = data.errors
        .map((error) =>
          [error?.message, error?.description, error?.code]
            .filter(Boolean)
            .join(" "),
        )
        .join(" ");
    } else if (data?.status === "fail") {
      details = data;
      message = [data.message, data.feedback_message]
        .filter(Boolean)
        .join(": ");
    } else {
      return null;
    }

    const rateLimited =
      /rate|limit|throttl|please wait|try again later/i.test(message);
    return new RequestError(
      rateLimited
        ? REQUEST_ERROR_CATEGORY.RATE_LIMIT
        : REQUEST_ERROR_CATEGORY.API,
      message || "The server rejected the API request.",
      { details, status, url, response },
    );
  }

  function pageJsonRequest(options, scope) {
    if (scope?.disposed) {
      throw new RequestError(
        REQUEST_ERROR_CATEGORY.ABORT,
        "The request was cancelled.",
        { url: options.url },
      );
    }

    const fetchImpl = environment.window.fetch?.bind(environment.window);
    if (typeof fetchImpl !== "function") {
      throw new RequestError(
        REQUEST_ERROR_CATEGORY.NETWORK,
        "The page request fallback is unavailable.",
        { url: options.url },
      );
    }

    const AbortControllerConstructor = environment.window.AbortController;
    const controller =
      typeof AbortControllerConstructor === "function"
        ? new AbortControllerConstructor()
        : null;
    let cancelRequest;
    let settled = false;
    let timeoutId = null;
    let removeSignalListener = () => {};

    const cancellation = new Promise((_resolve, reject) => {
      cancelRequest = reject;
    });
    const rejectCancellation = (error) => {
      if (settled) return;
      cancelRequest(error);
      try {
        controller?.abort();
      } catch (_error) {
        // The canonical timeout/abort error has already been selected.
      }
    };
    const abort = () =>
      rejectCancellation(
        new RequestError(
          REQUEST_ERROR_CATEGORY.ABORT,
          "The request was cancelled.",
          { url: options.url },
        ),
      );

    if (options.signal?.aborted) {
      abort();
    } else if (options.signal) {
      options.signal.addEventListener("abort", abort, { once: true });
      removeSignalListener = () =>
        options.signal.removeEventListener("abort", abort);
    }

    const timeout = Number(options.timeout);
    if (Number.isFinite(timeout) && timeout > 0) {
      timeoutId = setTimeout(() => {
        rejectCancellation(
          new RequestError(
            REQUEST_ERROR_CATEGORY.TIMEOUT,
            "The request timed out.",
            { url: options.url },
          ),
        );
      }, Math.floor(timeout));
    }

    const fetchRequest = Promise.resolve()
      .then(() =>
        fetchImpl(options.url, {
          method: options.method || "GET",
          headers: createPageRequestHeaders(options.headers),
          body: options.data,
          credentials: "include",
          signal: controller?.signal,
        }),
      )
      .then(async (response) => {
        const status = Number(response?.status) || 200;
        const finalUrl = String(response?.url || options.url);
        const responseText = await response.text();
        const responseRecord = {
          finalUrl,
          response: responseText,
          responseText,
          status,
        };

        if (status === 429) {
          throw new RequestError(
            REQUEST_ERROR_CATEGORY.RATE_LIMIT,
            "The server rate-limited the request.",
            { status, url: options.url, response: responseRecord },
          );
        }
        if (status < 200 || status >= 300) {
          throw new RequestError(
            REQUEST_ERROR_CATEGORY.HTTP,
            `The request returned HTTP ${status}.`,
            { status, url: options.url, response: responseRecord },
          );
        }
        if (/\/(accounts\/login|challenge|checkpoint)\b/i.test(finalUrl)) {
          throw new RequestError(
            REQUEST_ERROR_CATEGORY.LOGIN,
            "The request was redirected to a login or checkpoint page.",
            { status, url: finalUrl, response: responseRecord },
          );
        }
        if (/^\s*</.test(responseText)) {
          throw new RequestError(
            REQUEST_ERROR_CATEGORY.PARSE,
            "The server returned HTML instead of JSON.",
            { status, url: options.url, response: responseRecord },
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
              response: responseRecord,
            },
          );
        }

        if (options.detectApiErrors !== false) {
          const apiError = findPageRequestApiError(
            data,
            options.url,
            status,
            responseRecord,
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
                response: responseRecord,
              },
            );
          }
          if (valid === false) {
            throw new RequestError(
              REQUEST_ERROR_CATEGORY.API,
              "The response failed API validation.",
              { status, url: options.url, response: responseRecord },
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
              response: responseRecord,
            },
          );
        }
      })
      .catch((error) => {
        if (error instanceof RequestError) throw error;
        if (controller?.signal.aborted) {
          throw new RequestError(
            REQUEST_ERROR_CATEGORY.ABORT,
            "The request was cancelled.",
            { cause: error, url: options.url },
          );
        }
        throw new RequestError(
          REQUEST_ERROR_CATEGORY.NETWORK,
          error?.message || "The network request failed.",
          { cause: error, url: options.url },
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
      finally: promise.finally.bind(promise),
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
    setTimeout,
  } = environment;

  /**
   * Share one abort signal across every transport operation started by the
   * active route. Route changes and manual reload dispose that scope, aborting
   * pending GM/fetch work and transport-owned timers as one unit.
   *
   * @returns {{signal?: AbortSignal}}
   */
  function createDownloadOperationOptions() {
    const scope =
      activeLegacyRouteScope && !activeLegacyRouteScope.disposed
        ? activeLegacyRouteScope
        : activeApplicationScope && !activeApplicationScope.disposed
          ? activeApplicationScope
          : null;
    const AbortControllerConstructor = environment.window.AbortController;
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

  /* initial */

  /******** USER SETTINGS ********/
  // !!! DO NOT CHANGE THIS AREA !!!
  // ??? PLEASE CHANGE SETTING WITH MENU ???
  const SCRIPT_NAME = "insta-loader";
  const IS_SAFARI =
    /^((?!chrome|android|crios|fxios|edgios).)*safari/i.test(
      navigator.userAgent,
    );
  const ENABLE_CONSOLE_LOGGING = false;

  const USER_SETTING = settingsStore.snapshot();
  const imageCache = new ImageCache(
    {
      getValue: (_key, fallback) =>
        preferencesStore.getImageCache(fallback),
      setValue: (_key, value) =>
        preferencesStore.setImageCache(value),
      now,
      setTimeout,
      clearTimeout,
      decodeBase64: (value) => atob(value),
    },
    {
      storageKey: IMAGE_CACHE_KEY,
      maxAge: IMAGE_CACHE_MAX_AGE,
      maxItems: IMAGE_CACHE_MAX_ITEMS,
      persistDelay: IMAGE_CACHE_PERSIST_DELAY,
    },
  );

  const MEDIA_LIST_SELECTOR =
    ".IG_POPUP_DIG .IG_POPUP_DIG_MAIN .IG_POPUP_DIG_BODY";
  /*******************************/

  // Precision line icons shared by every Insta-loader surface.
  const SVG = {
    DOWNLOAD:
      '<svg aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3.75v10.5"/><path d="m8.25 10.5 3.75 3.75 3.75-3.75"/><path d="M5.25 16.75v1.5c0 .97.78 1.75 1.75 1.75h10c.97 0 1.75-.78 1.75-1.75v-1.5"/></svg>',
    NEW_TAB:
      '<svg aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M13.5 4.75h5.75v5.75"/><path d="m19 5-8 8"/><path d="M10.25 6h-3.5A1.75 1.75 0 0 0 5 7.75v9.5C5 18.22 5.78 19 6.75 19h9.5c.97 0 1.75-.78 1.75-1.75v-3.5"/></svg>',
    THUMBNAIL:
      '<svg aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="3.75" y="4.5" width="16.5" height="15" rx="2.25"/><circle cx="9" cy="9.25" r="1.25"/><path d="m5.5 17 4.25-4.25 2.75 2.75 2.25-2.25L18.5 17"/></svg>',
    DOWNLOAD_ALL:
      '<svg aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="m7.5 6.5 4.5 4 4.5-4"/><path d="m7.5 13.5 4.5 4 4.5-4"/></svg>',
    CLOSE:
      '<svg aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"><path d="m6.5 6.5 11 11"/><path d="m17.5 6.5-11 11"/></svg>',
    FULLSCREEN:
      '<svg aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M9.25 4.75h-4.5v4.5"/><path d="M14.75 4.75h4.5v4.5"/><path d="M19.25 14.75v4.5h-4.5"/><path d="M9.25 19.25h-4.5v-4.5"/></svg>',
    TURN_DEG:
      '<svg aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M7.25 7.5h-3.5V4"/><path d="M4.4 7.1A8 8 0 1 1 4.5 16.75"/></svg>',
  };
  const imageViewerController = new ImageViewerController({
    environment,
    $,
    icons: {
      close: SVG.CLOSE,
      rotate: SVG.TURN_DEG,
    },
  });

  /*******************************/
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
  const videoVolumeStore = new VideoVolumeStore(environment);

  var state = {
    videoVolume: videoVolumeStore.get(),
    tempFetchRateLimit: false,
    fileRenameFormat: preferences.renameFormat,
    locale: {},
    lang: preferences.language,
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
      highlights: {},
    },
    GL_observer: new MutationObserver(function () {
      onReadyMyDW();
    }),
    GL_imageCache: imageCache.entries,
    GL_mediaDataCache: {},
    debugHotkeyKeyCode: preferences.hotkeys.debug,
    settingsHotkeyKeyCode: preferences.hotkeys.settings,
    keySettingsHotkeyKeyCode: preferences.hotkeys.keySettings,
    downloadStoryHotkeyKeyCode: preferences.hotkeys.downloadStory,
  };
  const embeddedMediaRegistry = new media.EmbeddedMediaRegistry();
  const embeddedStoryPayloads = new WeakSet();

  function getEmbeddedReelResponse(shortcode) {
    embeddedMediaRegistry.scan(document);
    const item = embeddedMediaRegistry.getReel(shortcode);
    if (!item) return null;

    logger("EmbeddedMediaRegistry", "Reel hit", shortcode);
    return {
      type: "query_id",
      data: {
        xig_polaris_media: { if_not_gated_logged_out: item },
      },
    };
  }

  function getEmbeddedStoryResponse(identity) {
    embeddedMediaRegistry.scan(document, identity);
    const payload = embeddedMediaRegistry.getStory(identity);
    if (!payload) return null;

    embeddedStoryPayloads.add(payload);
    logger("EmbeddedMediaRegistry", "Story hit", identity);
    return payload;
  }
  const legacyVideoVolumeState = {
    get: () => state.videoVolume,
    set(value) {
      state.videoVolume = videoVolumeStore.set(value);
      return state.videoVolume;
    },
  };
  const postVideoBehaviorServices = new WeakMap();
  const reelVideoBehaviorServices = new WeakMap();
  const storyVideoBehaviorServices = new WeakMap();
  const surfaceVideoBehaviorByVideo = new WeakMap();
  const globalVideoVolumeFallbackBindings = new WeakMap();
  const storyThumbnailBindings = new WeakMap();
  const storyImageLoadBindings = new WeakMap();
  const storyPictureContextMenuBindings = new Map();
  let activeVideoVolumeSliderController = null;
  let applicationLifecycleMountCount = 0;
  let applicationTranslationGeneration = 0;
  var translationTextCache = null;
  const downloadTransport = new DownloadTransport({
    gmDownload: environment.browser.supports("GM_download")
      ? GM_download
      : undefined,
    fetch: environment.window.fetch?.bind(environment.window),
    gmRequest: GM_xmlhttpRequest,
    document: environment.getDocument(),
    urlApi: environment.window.URL,
    setTimeout,
    clearTimeout,
    onFallback(error, context) {
      logger(
        "DownloadTransport",
        `${context.stage} failed; falling back to ${context.fallback}`,
        error?.message || error,
      );
    },
  });
  const mediaDescriptorByElement = new WeakMap();
  function createMaximumReelPlaybackControllerInstance() {
    return new MaximumReelPlaybackController({
      environment,
      isEnabled: () => USER_SETTING.MAX_REEL_PLAYBACK_QUALITY,
      logger: (...messages) => logger(...messages),
      normalizeCandidates: media.normalizeMaximumReelCandidates,
      requestMetadata(shortcode, options = {}) {
        const query = new URLSearchParams({
          query_id: "9496392173716084",
          variables: JSON.stringify({
            shortcode,
            __relay_internal__pv__PolarisFeedShareMenurelayprovider: true,
            __relay_internal__pv__PolarisIsLoggedInrelayprovider: true,
          }),
        });
        return startJsonRequest({
          url: `https://www.instagram.com/graphql/query/?${query.toString()}`,
          timeout: options.timeout,
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Linux; Android 10; Pixel 7 XL)Build/RP1A.20845.002; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/5.0 Chrome/117.0.5938.60 Mobile Safari/537.36 Instagram 307.0.0.34.111",
            "X-IG-App-ID": getAppID(),
          },
          validate: (payload) =>
            Boolean(payload?.data && typeof payload.data === "object"),
          transform: (payload) => payload.data,
        });
      },
    });
  }

  let maximumReelPlaybackController =
    createMaximumReelPlaybackControllerInstance();
  let pendingMaximumReelReloadHandoff = null;
  const updateCheckService = new UpdateCheckService({
    environment,
    preferencesStore,
    requestText: startTextRequest,
    translator: _i18n,
    logger,
    getApplicationScope: () => activeApplicationScope,
  });
  const settingsController = new SettingsController({
    $,
    environment,
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
        state.lang = preferencesStore.setLanguage(value);
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
        state.fileRenameFormat = preferencesStore.setRenameFormat(value);
        return state.fileRenameFormat;
      },
      setSetting(name, value) {
        settingsStore.set(name, value);
        USER_SETTING[name] = value;
      },
    },
    loadTranslation: getTranslationText,
    repaintTranslations: repaintingTranslations,
    refreshMenus: () => menuController.refresh(),
    reportAsync: fireAndReport,
    onSettingChanged(name, value) {
      if (name === "MAX_REEL_PLAYBACK_QUALITY") {
        maximumReelPlaybackController.refresh({ settingChanged: true });
      }
      if (
        name === "REDIRECT_CLICK_USER_STORY_PICTURE" &&
        value === false
      ) {
        releaseStoryPictureContextMenuBindings();
      }
    },
    logger,
  });
  const debugController = new DebugController({
    $,
    environment,
    createDialog: () => IG_createDM(),
    translateHtml: _i18nHTML,
    getLogs: () => state.GL_logger,
    isJQuery: (value) => value instanceof $,
  });
  const hotkeyController = new HotkeyController({
    $,
    environment,
    createDialog: () => IG_createDM(),
    translateHtml: _i18nHTML,
    model: {
      get: (stateKey) => state[stateKey],
      set(preferenceName, stateKey, value) {
        state[stateKey] = value;
        preferencesStore.setHotkey(preferenceName, value);
        return value;
      },
    },
    showSettings: () => settingsController.show(),
    showDebug: () => debugController.showDebug(),
    reload: reloadScript,
  });
  const menuController = new MenuController({
    environment,
    translate: _i18n,
    showSettings: () => settingsController.show(),
    showHotkeySettings: () => hotkeyController.show(),
    showDebug: () => debugController.showDebug(),
    showFeedback: () => debugController.showFeedback(),
    checkForUpdate: callNotification,
    reload: reloadScript,
    logger,
  });
  /*******************************/

  function createRouteVideoBehaviorService(adapter) {
    if (!activeLegacyRouteScope) return null;

    const service = new VideoBehaviorService({
      environment,
      settings: settingsStore,
      volume: legacyVideoVolumeState,
      scope: activeLegacyRouteScope,
      triggerClick: triggerReactClickHandler,
      logger: (...messages) => logger(...messages),
    });
    activeLegacyRouteScope.defer(() => service.dispose());
    service.mount(adapter.root, adapter.surfaceAdapter);
    markSurfaceManagedVideos(service, adapter.root);
    return service;
  }

  function getRouteVideoVolumeSliderController() {
    if (!activeLegacyRouteScope) return null;
    if (
      activeVideoVolumeSliderController &&
      !activeVideoVolumeSliderController.disposed
    ) {
      return activeVideoVolumeSliderController;
    }

    const controller = new VideoVolumeSliderController({
      environment,
      volume: legacyVideoVolumeState,
      scope: activeLegacyRouteScope,
      logger: (...messages) => logger(...messages),
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
        surfaceAdapter: createAdapter(),
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
    if (
      record &&
      (record.service.disposed || record.storyType !== storyType)
    ) {
      record.service.dispose();
      record = null;
    }

    if (!record) {
      const surface =
        storyType === "highlight"
          ? VIDEO_SURFACE.HIGHLIGHT
          : VIDEO_SURFACE.STORY;
      const service = createRouteVideoBehaviorService({
        root,
        surfaceAdapter: createStoryVideoSurfaceAdapter({
          surface,
          onControllerVisibilityChange({ selectedVideo }) {
            toggleStoryVolumeSilder($(selectedVideo), storyType);
          },
        }),
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
      service &&
        !service.disposed &&
        service.root?.contains(video) === true,
    );
  }

  function bindGlobalVideoVolumeFallback(video) {
    const surfaceManaged = isSurfaceManagedVideo(video);
    if (
      !activeApplicationScope ||
      !USER_SETTING.MODIFY_VIDEO_VOLUME ||
      surfaceManaged
    ) {
      if (surfaceManaged) releaseGlobalVideoVolumeFallback(video);
      return;
    }

    const current = globalVideoVolumeFallbackBindings.get(video);
    if (current && !current.scope.disposed) return;
    current?.release();

    const applySavedVolume = function () {
      if (video.hasAttribute("data-modify")) return;
      $(video).attr("data-modify", true);
      video.volume = state.videoVolume;
      logger("(audio_observer) Added video event listener #modify");
    };
    const releasePlay = activeApplicationScope.listen(
      video,
      "play",
      applySavedVolume,
    );
    const releasePlaying = activeApplicationScope.listen(
      video,
      "playing",
      applySavedVolume,
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
      },
    };
    globalVideoVolumeFallbackBindings.set(video, record);
    video.setAttribute("data-insta-loader-volume-fallback", "true");
    activeApplicationScope.defer(record.release);
  }

  function bindStoryThumbnailTimeupdate(video) {
    const routeScope = activeLegacyRouteScope;
    if (!routeScope || !location.pathname.startsWith("/stories/")) return;

    // Recycled Story nodes may move beneath another visual host without being
    // recreated. Reevaluate their current host on the next rendered frame.
    $(video).removeData("modify-thumbnail");
    video.removeAttribute("data-modify-thumbnail");

    const current = storyThumbnailBindings.get(video);
    if (current && current.scope === routeScope && !routeScope.disposed) {
      return;
    }
    current?.release();

    const onTimeUpdate = function () {
      if (!location.pathname.startsWith("/stories/")) return;
      if ($(video).data("modify-thumbnail")) return;

      const isHighlight = location.pathname.startsWith(
        "/stories/highlights/",
      );
      const storyType = isHighlight ? "highlight" : "story";
      const $video = $(video);
      const thumbnailExists =
        $video
          .parents("div[style][class]")
          .filter(function () {
            return $(this).width() == $video.width();
          })
          .find(
            ".IG_DWSTORY_THUMBNAIL, .IG_DWHISTORY_THUMBNAIL",
          ).length > 0;

      $video.attr("data-modify-thumbnail", true);
      if (thumbnailExists) {
        logger(`(${storyType})`, "Thumbnail button already inserted");
        return;
      }

      if (isHighlight) {
        fireAndReport(
          () => onHighlightsStoryThumbnail(false),
          "onHighlightsStoryThumbnail()",
        );
      } else {
        fireAndReport(
          () => onStoryThumbnail(false),
          "onStoryThumbnail()",
        );
      }
      logger(`(${storyType})`, "Manually inserting thumbnail button");
    };
    const releaseListener = routeScope.listen(
      video,
      "timeupdate",
      onTimeUpdate,
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
      },
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

    const thumbnailSelector =
      surface === "highlight"
        ? ".IG_DWHISTORY_THUMBNAIL"
        : ".IG_DWSTORY_THUMBNAIL";
    const onLoad = function () {
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
      onLoad,
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
      },
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

    const preventNativeContextMenu = function (event) {
      event.preventDefault();
    };
    const releaseListener = applicationScope.listenJQuery(
      $image,
      "contextmenu",
      preventNativeContextMenu,
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
      },
    };
    storyPictureContextMenuBindings.set(image, record);
    $image.data("contextmenu", true);
    applicationScope.defer(record.release);
  }

  function processApplicationVideos(videos, mountRoot) {
    if (videos.length === 0) return;

    if (location.pathname.startsWith("/stories/")) {
      const isHighlight = location.pathname.startsWith(
        "/stories/highlights/",
      );
      const storyType = isHighlight ? "highlight" : "story";
      const controllerCandidates = new Set(
        USER_SETTING.HTML5_VIDEO_CONTROL
          ? videos.filter(
              (video) => !video.hasAttribute("data-controls"),
            )
          : [],
      );

      refreshStoryVideoBehavior(mountRoot, storyType);
      for (const video of videos) {
        bindStoryThumbnailTimeupdate(video);
        if (
          !USER_SETTING.HTML5_VIDEO_CONTROL ||
          controllerCandidates.has(video)
        ) {
          toggleStoryVolumeSilder($(video), storyType);
        }
      }
    }

    for (const video of videos) bindGlobalVideoVolumeFallback(video);
  }

  function handleApplicationAddedNode(node, mountRoot) {
    if (location.pathname.startsWith("/stories/highlights/")) {
      if (
        $(node).attr("data-ih-locale-title") == null &&
        $(node).attr("data-visualcompletion") == null &&
        node.tagName === "DIV"
      ) {
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
      supportsLooping: activeLegacyRouteKind !== ROUTE_KIND.REELS,
    });
  }

  // initialization script
  initSettings();
  GM_addStyle(style);
  GM_addStyle(injectedButtonStyle);

  function loadApplicationTranslation(language) {
    const generation = ++applicationTranslationGeneration;
    return getTranslationText(language)
      .then((res) => {
        if (generation !== applicationTranslationGeneration) return;
        state.locale[language] = res;
      if (state.lang !== language) return;
      translationTextCache = null;
      repaintingTranslations();
      menuController.refresh();
      checkingScriptUpdate(300);
      })
      .catch((err) => {
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
    GM_info.script.version,
  );
  purgeCache();
  /*******************************/

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
      ".IG_DWSTORY, .IG_DWSTORY_ALL, .IG_DWSTORY_THUMBNAIL, .IG_DWSTORY_POSITION, .IG_DWNEWTAB, .IG_DWHISTORY, .IG_DWHISTORY_ALL, .IG_DWHINEWTAB, .IG_DWHISTORY_THUMBNAIL, .IG_DWHISTORY_POSITION, .IG_REELS_CONTROLS, #scrollWrapper, .insta-loader-reel-quality-hold",
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
    },
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
    },
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
    },
  };

  let activeProfileController = null;

  function createLegacyProfileController() {
    return new ProfileController({
      $,
      downloadIcon: SVG.DOWNLOAD,
      downloadIntent: media.MEDIA_INTENT.DOWNLOAD,
      environment,
      executeMediaDescriptor,
      getDownloadTitle: () => _i18nHTML("DW"),
      getHighResolutionProfile: getUserHighSizeProfile,
      getLocation: () => location,
      getUserInfo: getUserId,
      logger: (...messages) => logger(...messages),
      normalizeProfileAvatar: media.normalizeProfileAvatar,
      now: () => new Date().getTime(),
      onError: (error) => console.error("[profile]", error),
      setLoading: updateLoadingBar,
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
    },
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
    },
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
    },
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
    return activeLegacyRouteScope
      ? activeLegacyRouteScope.setTimeout(callback, delay, ...args)
      : setTimeout(callback, delay, ...args);
  }

  function routeSetInterval(callback, delay, ...args) {
    return activeLegacyRouteScope
      ? activeLegacyRouteScope.setInterval(callback, delay, ...args)
      : setInterval(callback, delay, ...args);
  }

  function routeDelay(delay) {
    const scope = activeLegacyRouteScope;
    if (!scope) {
      return new Promise((resolve) => setTimeout(resolve, delay));
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

  // RouteCoordinator owns the compatibility polling timer. Each surface now
  // owns only its existing DOM readiness cycle while sharing the historical
  // document/visibility gate and initialization order.
  function runLegacySurfaceCycle(route, initializeSurface) {
    maximumReelPlaybackController.refresh();

    // @run-at document-start is needed for Reel playback interception, but the
    // existing page UI initializer still requires a body.
    if (!document.body) return;

    if (
      document.hidden &&
      state.currentURL === location.href &&
      state.pageLoaded
    ) {
      return;
    }

    // Route recognition is centralized; feature code only consumes the
    // current classified route and retains its existing DOM readiness checks.
    if (route?.kind === ROUTE_KIND.IGNORED) {
      state.pageLoaded = false;
      return;
    }

    if (
      state.currentURL != location.href ||
      !state.firstStarted ||
      !state.pageLoaded
    ) {
      logger("Main Timer", "triggering");

      clearInterval(state.GL_repeat);
      state.pageLoaded = false;
      state.firstStarted = true;
      state.currentURL = location.href;
      state.GL_observer.disconnect();

      // Auto-skip "X shared this with you" dialog on any ?igsh= link
      if (
        USER_SETTING.SKIP_SHARED_WITH_YOU_DIALOG &&
        window.location.search.includes("igsh")
      ) {
        let tries = 0;
        const skipTimer = routeSetInterval(() => {
          tries += 1;

          // stop early if URL no longer has ?igsh (navigation changed)
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

    // This is a delayed function call that prevents the dialog element from appearing before the function is called.
    const dialogTimer = routeSetInterval(() => {
      // body > div[id^="mount"] section nav + div > article << (mobile page in single post) >>
      // section:visible > main > div > div > div > div > div > hr << (single foreground post in page, non-floating // <hr> element here is literally the line beneath poster's username) >>
      // section:visible > main > div > div > article > div > div > div > div > div > header (is the same as above, except that this is on the route of the /{username}/p/{shortcode} structure)
      // section:visible > main > div > div.xdt5ytf << (former CSS selector for single foreground post in page, non-floating) >>
      // <hr> is much more unique element than "div.xdt5ytf"
      if (
        $(`body > div[class]:not([id^="mount"]) div div[role="dialog"] article,
                            section:visible > main > div > div > div > div > div > hr,
                            body > div[id^="mount"] section nav + div > article,
                            section:visible > main > div > div > article > div > div > div > div > div > header
                        `).length > 0
      ) {
        clearInterval(dialogTimer);

        // This is to prevent the detection of the "Modify Video Volume" setting from being too slow.
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

    const hasReferrer =
      state.GL_referrer?.match(/^\/(stories|highlights)\//gi) != null;

    logger("isHomepage", hasReferrer);
    routeSetTimeout(() => {
      onReadyMyDW(false, hasReferrer);

      const element = $(
        'div[id^="mount"] > div > div div > section > main div:not([class]):not([style]) > div > article',
      )?.parent()[0];
      if (element) {
        state.GL_observer.observe(element, {
          childList: true,
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
      "onHighlightsStory()",
    );
    state.GL_repeat = routeSetInterval(() => {
      fireAndReport(
        () => onHighlightsStoryThumbnail(false),
        "onHighlightsStoryThumbnail()",
      );
    }, checkInterval);

    if ($(".IG_DWHISTORY").length) {
      markStorySurfaceLoadedAfterConfirmation();
    }
  }

  function initializeStoryRoute() {
    logger("isStory");

    // Detect the Instagram logo in the left-top corner.
    if (
      $('div[id^="mount"] section > div > a[href="/"]').length > 0 ||
      $('div[id^="mount"] section > div > a[href^="/?hl="]').length > 0 ||
      $('div[id^="mount"] section i[aria-label="Instagram"]').length > 0
    ) {
      $(".IG_DWSTORY").remove();
      $(".IG_DWNEWTAB").remove();
      if ($(".IG_DWSTORY_THUMBNAIL").length) {
        $(".IG_DWSTORY_THUMBNAIL").remove();
      }
      if ($(".IG_DWSTORY_POSITION").length) {
        $(".IG_DWSTORY_POSITION").remove();
      }

      fireAndReport(() => onStory(false), "onStory()");

      // Prevent buttons from being eaten by black holes sometimes.
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
          'div[id^="mount"] section:last-child > div > div:not([class]) div:last-child > div[role="button"]',
        ).filter(function () {
          return (
            $(this).children().length === 0 && this.textContent.trim() !== ""
          );
        });
        $viewStoryButton?.trigger("click");
      }

      state.pageLoaded = true;
    }, 150);
  }

  function removeLegacyStoryControls() {
    state.pageLoaded = false;
    $(
      ".IG_DWSTORY, .IG_DWSTORY_ALL, .IG_DWNEWTAB, .IG_DWSTORY_THUMBNAIL, .IG_DWSTORY_POSITION, .IG_DWHISTORY, .IG_DWHISTORY_ALL, .IG_DWHINEWTAB, .IG_DWHISTORY_THUMBNAIL, .IG_DWHISTORY_POSITION",
    ).remove();
  }

  const legacyRouteControllerFactory = createRouteControllerFactory({
    adapters: {
      highlights: highlightRouteAdapter,
      posts: postFeedRouteAdapter,
      profiles: profileRouteAdapter,
      reelControls: singularReelControlsRouteAdapter,
      reelsControls: reelsControlsRouteAdapter,
      stories: storyRouteAdapter,
    },
    environment,
    onError: (error, context) =>
      logger("FeatureController", context?.phase || "error", error),
  });
  const routeCoordinator = new RouteCoordinator({
    environment,
    controllerFactory: legacyRouteControllerFactory,
    getClassificationOptions: () => ({
      splashVisible:
        $("div#splash-screen").length > 0 &&
        !$("div#splash-screen").is(":hidden"),
      followersDialogOpen:
        $(`body > div[class]:not([id^="mount"]) div div[role="dialog"]`)
          .length > 0,
    }),
    isReady: () => true,
    onError: (error, context) =>
      logger("RouteCoordinator", context?.phase || "error", error),
    pollInterval: checkInterval,
    refreshOnUnchanged: true,
  });
  const applicationDomLifecycleService =
    new ApplicationDomLifecycleService({
      environment,
      findMountRoot: () => $('div[id^="mount"]')[0] || null,
      onAddedNode: handleApplicationAddedNode,
      onMountScan: rescanApplicationMount,
      registerPerformanceObserver,
      onError: (error, context) =>
        logger(
          "ApplicationDomLifecycleService",
          context?.phase || "error",
          error,
        ),
    });
  const applicationCoordinator = createApplicationCoordinator({
    environment,
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
          },
        },
      },
      {
        name: "application-events",
        adapter: {
          mount(context) {
            mountApplicationEventHandlers(context.scope);
          },
        },
      },
      {
        name: "application-localization",
        adapter: {
          mount() {
            applicationLifecycleMountCount += 1;
            if (
              applicationLifecycleMountCount > 1 &&
              state.locale[state.lang] == null
            ) {
              loadApplicationTranslation(state.lang);
            }
          },
        },
      },
      {
        name: "image-cache",
        adapter: {
          mount(context) {
            context.scope.defer(() => imageCache.flush());
          },
        },
      },
      {
        name: "maximum-reel-playback",
        adapter: {
          mount() {
            if (maximumReelPlaybackController.disposed) {
              maximumReelPlaybackController =
                createMaximumReelPlaybackControllerInstance();
            }
            maximumReelPlaybackController.mount();
            if (pendingMaximumReelReloadHandoff) {
              const handoff = pendingMaximumReelReloadHandoff;
              pendingMaximumReelReloadHandoff = null;
              if (
                !maximumReelPlaybackController.adoptManualReloadHandoff(
                  handoff,
                )
              ) {
                handoff.cancel("reload-handoff-not-adopted");
              }
            }
          },
          refresh() {
            maximumReelPlaybackController.refresh();
          },
          dispose() {
            maximumReelPlaybackController.dispose();
          },
        },
      },
    ],
    globalControllerFactory: () => [
      settingsController,
      hotkeyController,
      debugController,
      menuController,
    ],
    onError: (error, context) =>
      logger("ApplicationCoordinator", context?.phase || "error", error),
  });
  applicationCoordinator.start();
  applicationDomLifecycleService.refresh({
    reason: "route-coordinator-started",
    type: "application-start",
  });

  // Retain the old debug symbol while ownership moves to the coordinator.
  // eslint-disable-next-line no-unused-vars
  var timer = applicationCoordinator;

  /* Main functions */

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
      getHeight: getLegacyStoryElementHeight,
    });
  }

  function readLegacyHighlightDomState(itemCount) {
    return readHighlightDomState(document, {
      pathname: location.pathname,
      href: location.href,
      itemCount,
      isVisible: isLegacyStoryElementVisible,
      getHeight: getLegacyStoryElementHeight,
    });
  }

  function createLegacyStoryActionContext(
    surface,
    payload,
    domState,
    intent,
  ) {
    return createStoryActionContext({
      surface,
      payload,
      domState,
      settings: USER_SETTING,
      runtimeState: state,
      intent,
    });
  }

  function getLegacyVisibleStoryImageUrl() {
    let srcset = $(
      "body > div section:visible img[referrerpolicy][class], body > div section:visible img[crossorigin][class]:not([alt])",
    )
      .attr("srcset")
      ?.split(",")[0]
      ?.split(" ")[0];
    let link = srcset
      ? srcset
      : $(
          "body > div section:visible img[referrerpolicy][class], body > div section:visible img[crossorigin][class]:not([alt])",
        )
          .filter(function () {
            return (
              $(this).parents("a").length === 0 &&
              $(this).width() === $(this).parent().width()
            );
          })
          .attr("src");

    if (!link) {
      // _aa63 means the Story picture rather than the account avatar.
      const $element = $("body > div section:visible img._aa63");
      link = $element.attr("srcset")
        ? $element.attr("srcset")?.split(",")[0]?.split(" ")[0]
        : $element.attr("src");
    }

    return link || null;
  }

  function normalizeLegacyStoryCurrentDescriptor(
    payload,
    actionContext,
    options,
  ) {
    const {
      imageCandidate,
      publishTime,
      shortcode,
      surface,
    } = options;
    const descriptors = media.normalizeStorySurfaceMedia(payload, {
      surface,
      renamePublishDate: USER_SETTING.RENAME_PUBLISH_DATE,
      nowSeconds: Math.floor(Date.now() / 1000),
      ...(imageCandidate ? { imageCandidate } : {}),
      videoCandidate:
        surface === STORY_SURFACE.HIGHLIGHT
          ? media.STORY_VIDEO_CANDIDATE.LAST
          : media.STORY_VIDEO_CANDIDATE.FIRST,
    });
    const currentItem = actionContext.current.item;
    const descriptor = descriptors.find(
      (candidate) =>
        candidate.rawMediaItem === currentItem ||
        String(candidate.mediaId) ===
          String(actionContext.current.mediaId),
    );
    if (!descriptor) return null;

    return {
      ...descriptor,
      owner: actionContext.owner || descriptor.owner,
      ...(Object.prototype.hasOwnProperty.call(options, "publishTime")
        ? { publishTime }
        : {}),
      ...(Object.prototype.hasOwnProperty.call(options, "shortcode")
        ? { shortcode }
        : {}),
      hasCanonicalMediaId: true,
    };
  }

  function createLegacyStoryApiDescriptor(
    payload,
    actionContext,
    domState,
    options,
  ) {
    const normalized = normalizeLegacyStoryCurrentDescriptor(
      payload,
      actionContext,
      options,
    );
    if (normalized) return normalized;

    const visibleVideo = $(
      "body > div section:visible video[playsinline]",
    ).first()[0];
    const visibleImageUrl = getLegacyVisibleStoryImageUrl();
    const kind = visibleVideo ? "video" : "image";
    const thumbnailUrl =
      visibleVideo?.getAttribute("poster") ||
      domState?.thumbnail?.posterUrl ||
      visibleImageUrl;
    const directUrl =
      visibleVideo?.currentSrc ||
      visibleVideo?.getAttribute("src") ||
      visibleImageUrl ||
      thumbnailUrl ||
      location.href;

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
      dashManifest:
        actionContext.current.item?.video_dash_manifest || null,
      hasCanonicalMediaId: true,
      sourceType: options.surface,
    };
  }

  /**
   * getHighlightsStoryUsername
   * @description Get the current highlight story owner's username.
   *
   * @return {?String}
   */
  function getHighlightsStoryUsername() {
    let href = $('body > div section:visible a[href^="/"]')
      .filter(function () {
        return (
          $(this)
            .attr("href")
            .split("/")
            .filter((e) => e.length > 0).length === 1
        );
      })
      .first()
      .attr("href");

    return href
      ?.split("/")
      .filter((e) => e.length > 0)
      .at(0);
  }

  /**
   * Settle an async action that has no awaiting caller. Route disposal is an
   * expected cancellation; every other failure remains visible in both logs.
   *
   * @param {() => *} action
   * @param {String} context
   * @return {Promise<*>}
   */
  function fireAndReport(action, context) {
    const report = (error) => {
      if (error?.category === "abort" || error?.name === "AbortError") {
        return undefined;
      }

      console.error(`${context} failed:`, error);
      logger(context, "reject", error?.message || error);
      return undefined;
    };

    try {
      return Promise.resolve(action()).catch(report);
    } catch (error) {
      report(error);
      return Promise.resolve(undefined);
    }
  }

  function storyActionErrorChainIncludes(error, predicate) {
    const visited = new Set();
    let current = error;

    while (
      current != null &&
      (typeof current === "object" || typeof current === "function") &&
      !visited.has(current)
    ) {
      if (predicate(current)) return true;
      visited.add(current);
      current = current.cause;
    }

    return error === -1 && predicate(error);
  }

  function isStoryActionAbort(error) {
    return storyActionErrorChainIncludes(
      error,
      (candidate) =>
        candidate?.category === "abort" ||
        candidate?.name === "AbortError",
    );
  }

  function isStoryActionErrorReported(error) {
    return storyActionErrorChainIncludes(
      error,
      (candidate) =>
        candidate === -1 || candidate?.alreadyReported === true,
    );
  }

  function getStoryActionFailureDetails(error) {
    const visited = new Set();
    let current = error;

    while (
      current != null &&
      (typeof current === "object" || typeof current === "function") &&
      !visited.has(current)
    ) {
      visited.add(current);
      if (current.url || current.status || current.category) {
        return {
          category: current.category || null,
          status: current.status || null,
          url: current.url || null,
        };
      }
      current = current.cause;
    }

    return { category: null, status: null, url: null };
  }

  function createStorySurfaceRouteCancellation(scope) {
    let armed = true;
    let cancelled = false;
    let release = () => {};
    const createAbortError = () =>
      new RequestError(
        REQUEST_ERROR_CATEGORY.ABORT,
        "The Story or Highlight route was disposed.",
      );
    const promise = new Promise((_resolve, reject) => {
      const abort = () => {
        if (!armed) return;
        cancelled = true;
        armed = false;
        reject(createAbortError());
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
          throw createAbortError();
        }
      },
    };
  }

  function throwIfStorySurfaceActionCancelled(actionLifecycle) {
    actionLifecycle?.throwIfCancelled?.();
  }

  function createStorySurfaceMediaActionOptions(actionLifecycle) {
    if (!actionLifecycle) return {};
    return {
      operationOptions: actionLifecycle.operationOptions,
      throwIfCancelled: () =>
        throwIfStorySurfaceActionCancelled(actionLifecycle),
    };
  }

  function hasDeliveredCurrentMedia(descriptor) {
    const item = descriptor?.rawMediaItem;
    const imageCandidates = item?.image_versions2?.candidates;
    if (!Array.isArray(imageCandidates) || imageCandidates.length === 0) {
      return false;
    }
    if (descriptor.kind !== "video") return true;
    return Array.isArray(item.video_versions) && item.video_versions.length > 0;
  }

  /**
   * Own the visible lifecycle of one user-triggered Story/Highlight action.
   * Repeated clicks share the pending action instead of starting duplicate
   * requests or outputs. Route disposal remains an expected silent abort.
   *
   * @param {(actionLifecycle: Object) => *} action
   * @param {String} context
   * @return {Promise<*>}
   */
  function runStorySurfaceAction(action, context) {
    if (activeStorySurfaceAction) return activeStorySurfaceAction;

    const routeCancellation = createStorySurfaceRouteCancellation(
      activeLegacyRouteScope,
    );
    updateLoadingBar(true);
    const actionPromise = Promise.resolve().then(() =>
      action(routeCancellation)
    );
    const task = Promise.race([actionPromise, routeCancellation.promise])
      .catch((error) => {
        if (isStoryActionAbort(error)) return undefined;

        const failureDetails = getStoryActionFailureDetails(error);
        console.error(`${context} failed:`, error, failureDetails);
        logger(context, "reject", error?.message || error, failureDetails);
        if (!isStoryActionErrorReported(error)) {
          alert(STORY_SURFACE_ACTION_FAILURE_MESSAGE);
        }
        return undefined;
      })
      .finally(() => {
        routeCancellation.release();
        updateLoadingBar(false);
        if (activeStorySurfaceAction === task) {
          activeStorySurfaceAction = null;
        }
      });

    activeStorySurfaceAction = task;
    return task;
  }

  async function downloadStoryBatchDescriptor(
    descriptor,
    allowDash,
    actionLifecycle,
  ) {
    throwIfStorySurfaceActionCancelled(actionLifecycle);
    const hasDeliveredMedia = hasDeliveredCurrentMedia(descriptor);
    return await executeMediaDescriptor(
      descriptor,
      media.MEDIA_INTENT.DOWNLOAD,
      {
        ...createStorySurfaceMediaActionOptions(actionLifecycle),
        dashBeforeMediaApi: hasDeliveredMedia,
        useMediaApi:
          allowDash &&
          !hasDeliveredMedia &&
          descriptor.kind === "video" &&
          !state.tempFetchRateLimit,
        useDash: allowDash,
        markMediaApiFallback: allowDash,
      },
    );
  }

  function scheduleStoryBatchDownloads(
    payload,
    surface,
    allowDash = false,
    actionLifecycle,
  ) {
    throwIfStorySurfaceActionCancelled(actionLifecycle);
    const descriptors = buildStoryBatchDescriptors(payload, {
      surface,
      renamePublishDate: USER_SETTING.RENAME_PUBLISH_DATE,
      nowSeconds: Math.floor(Date.now() / 1000),
    });
    let complete = 0;
    setDownloadProgress(complete, descriptors.length);

    descriptors.forEach((descriptor, index) => {
      routeSetTimeout(() => {
        fireAndReport(
          () =>
            downloadStoryBatchDescriptor(
              descriptor,
              allowDash,
              actionLifecycle,
            ).then(() => {
              throwIfStorySurfaceActionCancelled(actionLifecycle);
              setDownloadProgress(++complete, descriptors.length);
            }),
          "downloadStoryBatchDescriptor()",
        );
      }, 100 * index);
    });
  }

  /**
   * onHighlightsStoryAll
   * @description Trigger user's highlight all download event.
   *
   * @return {void}
   */
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
        actionLifecycle,
      );
    } else {
      throwIfStorySurfaceActionCancelled(actionLifecycle);
      IG_createDM(false, true, true);
      createStoryListDOM(highStories, "highlights");
    }
  }

  /**
   * onHighlightsStory
   * @description Trigger user's highlight download event or button display event.
   *
   * @param  {Boolean}  isDownload - Check if it is a download operation
   * @param  {Boolean}  isPreview - Check if it is need to open new tab
   * @return {void}
   */
  async function onHighlightsStory(
    isDownload,
    isPreview,
    actionLifecycle,
  ) {
    var username = getHighlightsStoryUsername();

    if (isDownload) {
      throwIfStorySurfaceActionCancelled(actionLifecycle);
      let date = new Date().getTime();
      let timestamp = Math.floor(date / 1000);
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
        highStories.data.reels_media[0].items.length,
      );
      const actionContext = createLegacyStoryActionContext(
        STORY_SURFACE.HIGHLIGHT,
        highStories,
        domState,
        isPreview ? STORY_INTENT.PREVIEW : STORY_INTENT.DOWNLOAD,
      );
      const responseCacheKey = actionContext.responseCacheKey || highlightId;
      const target = actionContext.current.item;
      username = actionContext.owner || username;

      logger(
        "onHighlightsStory",
        responseCacheKey,
        state.GL_dataCache.highlights[responseCacheKey],
      );

      if (actionContext.mediaApiPolicy.renamePublishDate) {
        timestamp = target.taken_at_timestamp ?? target.taken_at;
      }

      const descriptor = normalizeLegacyStoryCurrentDescriptor(
        highStories,
        actionContext,
        {
          imageCandidate: media.STORY_IMAGE_CANDIDATE.LAST,
          surface: STORY_SURFACE.HIGHLIGHT,
        },
      );
      if (!descriptor) {
        throw new Error("Cannot resolve the current Highlight resource.");
      }
      const hasDeliveredMedia = hasDeliveredCurrentMedia(descriptor);

      let usedImageCache = false;
      await executeMediaDescriptor(
        descriptor,
        isPreview
          ? media.MEDIA_INTENT.PREVIEW
          : media.MEDIA_INTENT.DOWNLOAD,
        {
          ...createStorySurfaceMediaActionOptions(actionLifecycle),
          dashBeforeMediaApi: hasDeliveredMedia,
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
              actionLifecycle,
            );
          },
          onOutput: (context) => {
            if (context.source === "cache") {
              usedImageCache = true;
              logger("[Restore Cached onHighlight]", target.id);
            }
          },
          outputShortcode: (context) =>
            context.source === "media-api"
              ? context.descriptor.rawMediaItem?.id || target.id
              : target.id,
          replacePreviewHost: false,
          retainFirstMediaApiImageCandidate: true,
          resolveMissingOwner: false,
          useDash: actionContext.mediaApiPolicy.requestDash,
          useDashForPreview: actionContext.mediaApiPolicy.requestDash,
          useImageCache: actionContext.mediaApiPolicy.useImageCache,
          useMediaApi:
            actionContext.mediaApiPolicy.requestMediaApi &&
            !hasDeliveredMedia,
        },
      );

      if (usedImageCache) return;

      if (!actionContext.mediaApiPolicy.requestMediaApi) {
        state.tempFetchRateLimit = false;
      }

    } else {
      // Add the stories download button
      if (!$(".IG_DWHISTORY").length) {
        let $element = null;

        // Default detecter (section layout mode)
        if ($("body > div section._ac0a").length > 0) {
          $element = $("body > div section:visible._ac0a");
        } else {
          $element = $(
            "body > div section:visible > div > div[style]:not([class])",
          );
          $element.css("position", "relative");
        }

        // Detecter for div layout mode
        if ($element.length === 0) {
          let $$element = $(
            "body > div div:not([hidden]) section:visible > div div[class][style] > div[style]:not([class])",
          );
          let nowSize = 0;

          $$element.each(function () {
            if ($(this).width() > nowSize) {
              nowSize = $(this).width();
              $element = $(this).children("div").first();
            }
          });
        }

        if ($element != null) {
          $element.append(
            `<div data-ih-locale-title="DW" title="${_i18nHTML("DW")}" class="IG_DWHISTORY">${SVG.DOWNLOAD}</div>`,
          );
          $element.append(
            `<div data-ih-locale-title="NEW_TAB" title="${_i18nHTML("NEW_TAB")}" class="IG_DWHINEWTAB">${SVG.NEW_TAB}</div>`,
          );

          let $header = getStoryProgress(username);
          if ($header.length > 1) {
            $element.append(
              `<div data-ih-locale-title="DW_ALL" title="${_i18nHTML("DW_ALL")}" class="IG_DWHISTORY_ALL">${SVG.DOWNLOAD_ALL}</div>`,
            );
          }

          setStoryProgressIndexText($element, $header, "IG_DWHISTORY_POSITION");

          // replace something times ago format to publish time in first init
          setTimeElementDateAndLocaleTime(
            getHighlightCurrentTimeElement($header),
          );

          // Make sure to first remove thumbnail button if still exists and highlight is a picture
          $element.find("img[referrerpolicy]").each(function () {
            bindStoryImageLoad(this, $element, "highlight");
          });

        }
      }
    }
  }

  /**
   * onHighlightsStoryThumbnail
   * @description Trigger user's highlight video thumbnail download event or button display event.
   *
   * @param  {Boolean}  isDownload - Check if it is a download operation
   * @return {void}
   */
  async function onHighlightsStoryThumbnail(
    isDownload,
    actionLifecycle,
  ) {
    if (isDownload) {
      throwIfStorySurfaceActionCancelled(actionLifecycle);
      let date = new Date().getTime();
      let timestamp = Math.floor(date / 1000);
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
        highStories.data.reels_media[0].items.length,
      );
      const actionContext = createLegacyStoryActionContext(
        STORY_SURFACE.HIGHLIGHT,
        highStories,
        domState,
        STORY_INTENT.THUMBNAIL,
      );
      const responseCacheKey = actionContext.responseCacheKey || highlightId;
      const target = actionContext.current.item;
      username = actionContext.owner || username;

      if (actionContext.mediaApiPolicy.renamePublishDate) {
        timestamp = target.taken_at_timestamp ?? target.taken_at;
      }

      const descriptor = normalizeLegacyStoryCurrentDescriptor(
        highStories,
        actionContext,
        {
          imageCandidate: media.STORY_IMAGE_CANDIDATE.LAST,
          surface: STORY_SURFACE.HIGHLIGHT,
        },
      );
      if (!descriptor) {
        throw new Error("Cannot resolve the current Highlight thumbnail.");
      }
      const hasDeliveredMedia = hasDeliveredCurrentMedia(descriptor);

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
              actionLifecycle,
            );
          },
          onOutput: (context) => {
            if (context.source === "cache") {
              usedImageCache = true;
              logger(
                "[Restore Cached onHighlightsStoryThumbnail]",
                target.id,
              );
            }
          },
          outputShortcode: (context) =>
            context.source === "cache" ? target.id : highlightId,
          retainFirstMediaApiImageCandidate: true,
          resolveMissingOwner: false,
          thumbnailSourceType: "highlights",
          useDash: false,
          useImageCache: actionContext.mediaApiPolicy.useImageCache,
          useMediaApi:
            actionContext.mediaApiPolicy.requestMediaApi &&
            !hasDeliveredMedia,
        },
      );

      if (usedImageCache) return;

      if (!actionContext.mediaApiPolicy.requestMediaApi) {
        state.tempFetchRateLimit = false;
      }

    } else {
      setStoryProgressIndexByUsername(
        $(".IG_DWHISTORY").parent(),
        getHighlightsStoryUsername(),
        "IG_DWHISTORY_POSITION",
      );

      if ($("body > div section video.xh8yej3").length) {
        // Add the stories thumbnail download button
        if (!$(".IG_DWHISTORY_THUMBNAIL").length) {
          let $element = null;

          // Default detecter (section layout mode)
          if ($("body > div section._ac0a").length > 0) {
            $element = $("body > div section:visible._ac0a");
          } else {
            $element = $(
              "body > div section:visible > div > div[style]:not([class])",
            );
            $element.css("position", "relative");
          }

          // Detecter for div layout mode
          if ($element.length === 0) {
            let $$element = $(
              "body > div div:not([hidden]) section:visible > div div[class][style] > div[style]:not([class])",
            );
            let nowSize = 0;

            $$element.each(function () {
              if ($(this).width() > nowSize) {
                nowSize = $(this).width();
                $element = $(this).children("div").first();
              }
            });
          }

          if ($element != null) {
            $element.append(
              `<div data-ih-locale-title="VIDEO_THUMBNAIL" title="${_i18nHTML("VIDEO_THUMBNAIL")}" class="IG_DWHISTORY_THUMBNAIL">${SVG.THUMBNAIL}</div>`,
            );
          }
        }
      } else {
        $(".IG_DWHISTORY_THUMBNAIL").remove();
      }
    }
  }

  /**
   * onReadyMyDW
   * @description Create an event entry point for the download button for the post.
   *
   * @param  {Boolean}  NoDialog    - Check if it not showing the dialog
   * @param  {?Boolean}  hasReferrer - Check if the source of the previous page is a story page
   * @return {void}
   */
  function onReadyMyDW(NoDialog, hasReferrer) {
    if (hasReferrer === true) {
      logger("hasReferrer", "regenerated");
      $('article[data-snig="canDownload"], div[data-snig="canDownload"]')
        .filter(function () {
          return $(this).find(".IG_DW_MAIN").length === 0;
        })
        .removeAttr("data-snig");
    }

    // Whether is Instagram dialog?
    if (NoDialog == false) {
      const maxCall = 100;
      let i = 0;
      var repeat = routeSetInterval(() => {
        // section:visible > main > div > div[data-snig="canDownload"] > div > div > div > hr << (single foreground post in page, non-floating // <hr> element here is literally the line beneath poster's username) >>
        // section:visible > main > div > div.xdt5ytf[data-snig="canDownload"] << (former CSS selector for single foreground post in page, non-floating) >>
        // <hr> is much more unique element than "div.xdt5ytf"
        if (
          i > maxCall ||
          $(
            'article[data-snig="canDownload"], section:visible > main > div > div[data-snig="canDownload"] > div > div > div > hr, div[id^="mount"] > div > div > div.x1n2onr6.x1vjfegm div[data-snig="canDownload"]',
          ).length > 0
        ) {
          clearInterval(repeat);

          if (i > maxCall) {
            //alert('Trying to call button creation method reached to maximum try times. If you want to re-register method, please open script menu and press "Reload Script" button or hotkey "R" to reload main timer.');
            console.warn(
              "onReadyMyDW() Timer",
              "maximum number of repetitions reached, terminated",
            );
          }
        }

        logger(
          "onReadyMyDW() Timer",
          "repeating to call detection createDownloadButton()",
        );
        createDownloadButton();
        i++;
      }, buttonDetectionInterval);
    } else {
      createDownloadButton();
    }
  }

  /**
   * initPostVideoFunction
   * @description Initialize settings related to the video resources in the post.
   *
   * @param  {JQuery<HTMLElement>}  $mainElement
   * @return {Void}
   */
  function initPostVideoFunction($mainElement) {
    refreshRouteVideoBehavior(
      postVideoBehaviorServices,
      $mainElement.first()[0],
      createPostVideoSurfaceAdapter,
    );

    var $buttonParent = $mainElement.find("video + div > div").first();
    toggleVolumeSilder(
      () => $mainElement.find("video").get(),
      $buttonParent,
      "post",
      "bottom",
    );
  }

  /**
   * Adapt the extracted post-context resolver to the legacy jQuery index
   * locator without changing its selector behavior.
   *
   * @param {jQuery} $mainElement
   * @param {Element} actionElement
   * @param {"main" | "action"} [visibleIndexSource="main"]
   * @return {{shortcode: string | undefined, owner: string | undefined, visibleIndex: number, actionHost: Element | null}}
   */
  function resolveLegacyPostContext(
    $mainElement,
    actionElement,
    visibleIndexSource = "main",
  ) {
    return resolvePostContext({
      mainElement: $mainElement.first()[0],
      actionElement,
      pathname: location.pathname,
      resolveVisibleIndex: (host) => getVisibleNodeIndex($(host)),
      visibleIndexSource,
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
      sourceType: "photo",
    };
    renderMediaDescriptor($(MEDIA_LIST_SELECTOR), descriptor);
  }

  const LEGACY_POST_RESOURCE_COUNT_SELECTOR =
    "*:not([data-pagelet])>*:not([role]):not([data-pagelet])>*>*>*[role]>*>ul[class] li[class]";

  function setupLegacyPostCarouselCounter($mainElement) {
    if ($mainElement.find("._acay").length === 0) return;

    if ($mainElement.find("._acay + .x24i39r").length > 0) {
      $mainElement.find("._acay + .x24i39r").css("top", "37px");
    }

    const observeNode = $mainElement.find("._acay").first().parent()[0];
    const observer = ownRouteObserver(
      new MutationObserver(function () {
        $mainElement.find("._acay + .x24i39r").css("top", "37px");
      }),
    );

    observer.observe(observeNode, {
      childList: true,
    });
  }

  function setupLegacyPostMediaObservers(
    $mainElement,
    $childElement,
    thumbnailElement,
    viewerElement,
  ) {
    routeSetTimeout(() => {
      // eslint-disable-next-line no-unused-vars
      const checkNodeCallback = (entries, observer) => {
        entries.forEach((entry) => {
          //logger(entry);
          if (entry.isIntersecting) {
            var $targetNode = $(entry.target);
            $childElement.find(".IG_THUMBNAIL_MAIN")?.remove();
            $childElement.find(".IG_IMAGE_VIEWER")?.remove();

            // Check if video?
            if ($targetNode.find("video").length > 0) {
              if ($childElement.find(".IG_THUMBNAIL_MAIN").length === 0) {
                $childElement
                  .find(".button_wrapper")
                  .append(thumbnailElement);
              }

              initPostVideoFunction($mainElement);
            }
            // is Image
            else {
              $childElement.find(".button_wrapper").append(viewerElement);
            }
          }
        });
      };

      const observer_i = ownRouteObserver(
        typeof IntersectionObserver === "function"
          ? new IntersectionObserver(checkNodeCallback, {
              root: $childElement.find(".button_wrapper").parent()[0],
              rootMargin: "0px",
              threshold: 0.1,
            })
          : {
              disconnect() {},
              observe(target) {
                checkNodeCallback([{ isIntersecting: true, target }], this);
              },
            },
      );

      // trigger when switching resources
      // eslint-disable-next-line no-unused-vars
      const observer = ownRouteObserver(
        new MutationObserver(function (mutation, owner) {
          var target = mutation.at(0)?.target;
          observer_i.disconnect();

          $(target)
            .find("li")
            .each(function () {
              if (
                $(target).find("video").length > 0 ||
                $(target).find("img").length > 0
              ) {
                observer_i.observe(this);
              }
            });
        }),
      );

      let $triggeredTarget = null;
      // first onload
      $childElement
        .find(".button_wrapper")
        .parent()
        .find('ul li, div[role="button"] > div, div[class] > div')
        .each(function () {
          const $targetNode =
            $(this).find("video").length > 0
              ? $(this).find("video")?.first()
              : $(this).find("img")?.first();

          // Check if the node is visible and has size,
          // and not the same node as last triggered one to avoid duplicated trigger
          // when switching resources with same container
          if (
            $targetNode.length > 0 &&
            $targetNode.is(":visible") &&
            $targetNode.get(0).getBoundingClientRect().width > 0 &&
            $targetNode.get(0).getBoundingClientRect().height > 0 &&
            this.getBoundingClientRect().width > 64 &&
            this.getBoundingClientRect().height > 64 &&
            $triggeredTarget?.get(0) != $targetNode?.get(0)
          ) {
            // ignore the image without alt attribute,
            // because it is usually used for video thumbnail
            if (
              $targetNode.get(0).tagName === "IMG" &&
              $targetNode.attr("alt")?.length == 0
            ) {
              return;
            }

            $triggeredTarget = $targetNode;
            observer_i.observe(this);
          }
        });

      const listRoot = $childElement
        .find(".button_wrapper")
        .parent()
        .find('ul li, div[role="button"] > div')
        .first()
        .parent()[0];

      if (listRoot) {
        observer.observe(listRoot, {
          attributes: true,
          childList: true,
        });
      } else {
        initPostVideoFunction($mainElement);
        logger(
          "Cannot find resource list root element, thumbnail and viewer button may not work.",
        );
      }
    }, 50);
  }

  function mountLegacyPostControls($mainElement, $childElement, tagName) {
    setupLegacyPostCarouselCounter($mainElement);

    $childElement
      .eq(tagName === "DIV" ? 0 : $childElement.length - 2)
      .append(`<div class="button_wrapper">`);

    const downloadElement = `<div data-ih-locale-title="DW" title="${_i18nHTML("DW")}" class="IG_DW_MAIN">${SVG.DOWNLOAD}</div>`;
    const newTabElement = `<div data-ih-locale-title="NEW_TAB" title="${_i18nHTML("NEW_TAB")}" class="IG_NEWTAB_MAIN">${SVG.NEW_TAB}</div>`;
    const thumbnailElement = `<div data-ih-locale-title="VIDEO_THUMBNAIL" title="${_i18nHTML("VIDEO_THUMBNAIL")}" class="IG_THUMBNAIL_MAIN">${SVG.THUMBNAIL}</div>`;
    const viewerElement = `<div data-ih-locale-title="IMAGE_VIEWER" title="${_i18nHTML("IMAGE_VIEWER")}" class="IG_IMAGE_VIEWER">${SVG.FULLSCREEN}</div>`;

    $childElement.find(".button_wrapper").append(downloadElement);

    const resource_count = $mainElement.find(
      LEGACY_POST_RESOURCE_COUNT_SELECTOR,
    ).length;

    if (
      resource_count > 1 &&
      USER_SETTING.DIRECT_DOWNLOAD_VISIBLE_RESOURCE &&
      !USER_SETTING.DIRECT_DOWNLOAD_ALL
    ) {
      const downloadAllElement = `<div data-ih-locale-title="DW_ALL" title="${_i18nHTML("DW_ALL")}" class="IG_DW_ALL_MAIN">${SVG.DOWNLOAD_ALL}</div>`;
      $childElement.find(".button_wrapper").append(downloadAllElement);
    }

    $childElement.find(".button_wrapper").append(newTabElement);

    const $resourceLayout = $childElement
      .filter(function () {
        return $(this).width() > 100 && $(this).height() > 100;
      })
      .first();

    const $isNewPostStyleLayout =
      $resourceLayout
        .find(`a[role="link"][tabindex="0"][href^="/"]`)
        .filter(function () {
          return (
            !$(this).attr("href").startsWith("/p/") &&
            !$(this).attr("href").startsWith("/reels/")
          );
        }).length > 0;

    // Make sure the button wrapper doesn't cover the "More Options" button.
    if ($isNewPostStyleLayout) {
      $childElement.find(".button_wrapper").css("top", "45px");
    }

    setupLegacyPostMediaObservers(
      $mainElement,
      $childElement,
      thumbnailElement,
      viewerElement,
    );
    $childElement.css("position", "relative");
  }

  async function handleLegacyPostImageViewerAction(
    e,
    actionElement,
    $mainElement,
  ) {
    consumeInjectedClick(e);
    if (state.bulkDownloadActive) return;
    updateLoadingBar(true);

    try {
      const postContext = resolveLegacyPostContext(
        $mainElement,
        actionElement,
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
          postPath: state.GL_postPath,
        });
        alert("Cannot find resource url.");
        return;
      }

      var href = getMediaDescriptorForElement($linkElement.first()[0])
        .directUrl;

      if (href) {
        let viewerHref = href;
        try {
          viewerHref = replaceSameOriginHost(href);
        } catch (err) {
          logger(
            "Open image viewer",
            "replaceSameOriginHost failed, using original href",
            err?.message || err,
          );
        }
        openImageViewer(viewerHref);
      } else {
        console.error("Cannot find image viewer data-href.", {
          index,
          postPath: state.GL_postPath,
          linkElement: $linkElement?.get(0),
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
      var $videoThumbnail = getMediaListLinkByIndex(index)
        ?.parent()
        .find(".videoThumbnail")
        ?.first();

      if ($videoThumbnail != null && $videoThumbnail.length > 0) {
        $videoThumbnail.trigger("click");
      } else {
        alert("Cannot find thumbnail URL.");
      }

      updateLoadingBar(false);
      removeMediaDialog();
    });
  }

  async function handleLegacyPostNewTabAction(
    e,
    actionElement,
    $mainElement,
  ) {
    consumeInjectedClick(e);
    if (state.bulkDownloadActive) return;
    updateLoadingBar(true);

    try {
      const postContext = resolveLegacyPostContext(
        $mainElement,
        actionElement,
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
          postPath: state.GL_postPath,
        });
        alert("Cannot find open tab URL.");
        return;
      }

      await executeMediaDescriptor(
        getMediaDescriptorForElement($linkElement.first()[0]),
        media.MEDIA_INTENT.PREVIEW,
        {
          useMediaApi:
            USER_SETTING.FORCE_RESOURCE_VIA_MEDIA &&
            USER_SETTING.NEW_TAB_ALWAYS_FORCE_MEDIA_IN_POST,
        },
      );
    } catch (err) {
      console.error("Failed to open resource in new tab:", err);
      alert("Cannot find open tab URL.");
    } finally {
      updateLoadingBar(false);
      removeMediaDialog();
    }
  }

  async function handleLegacyPostDownloadAllAction(
    e,
    actionElement,
    $mainElement,
  ) {
    consumeInjectedClick(e);
    const $downloadAllButton = $(actionElement);
    if (
      state.bulkDownloadActive ||
      $downloadAllButton.hasClass("is-busy")
    ) {
      return;
    }

    state.bulkDownloadActive = true;
    $downloadAllButton.addClass("is-busy").attr("aria-busy", "true");

    try {
      const postContext = resolveLegacyPostContext(
        $mainElement,
        actionElement,
      );
      state.GL_username = postContext.owner;
      state.GL_postPath = postContext.shortcode;

      const descriptors = await fetchPostBatchDescriptors(
        state.GL_postPath,
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

  async function handleLegacyPostDownloadAction(
    e,
    actionElement,
    $mainElement,
  ) {
    consumeInjectedClick(e);
    if (state.bulkDownloadActive) return;
    const postContext = resolveLegacyPostContext(
      $mainElement,
      actionElement,
      "action",
    );
    state.GL_username = postContext.owner;
    state.GL_postPath = postContext.shortcode;

    // Create element that download dailog
    IG_createDM(USER_SETTING.DIRECT_DOWNLOAD_ALL, true, true);

    $("#article-id").html(
      `<a href="https://www.instagram.com/p/${state.GL_postPath}">${state.GL_postPath}</a>`,
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
          postPath: state.GL_postPath,
        });
        alert("Cannot find download URL.");
      } else if (href) {
        updateLoadingBar(false);
        await triggerLinkElement($linkElement[0]);
      } else {
        console.error("Cannot find download data-href.", {
          index,
          postPath: state.GL_postPath,
          linkElement: $linkElement?.get(0),
        });
        alert("Cannot find download URL.");
      }

      updateLoadingBar(false);
      removeMediaDialog();

      return;
    }

    const $actionElement = $(actionElement);
    if (!USER_SETTING.DIRECT_DOWNLOAD_ALL) {
      // Find video/image element and add the download icon
      var s = 0;
      var multiple = $actionElement
        .parent()
        .parent()
        .find(LEGACY_POST_RESOURCE_COUNT_SELECTOR).length;
      var blob = USER_SETTING.FORCE_FETCH_ALL_RESOURCES;
      var publish_time = new Date(
        $actionElement
          .parent()
          .parent()
          .parent()
          .find("a[href] time[datetime]")
          .filter(function () {
            let href = $(this).parents("a[href]").attr("href");
            return (
              href?.startsWith("/p/") ||
              href?.match(/\/([\w.\-_]+)\/p\//gi) != null
            );
          })
          .first()
          .attr("datetime"),
      ).getTime();

      // If posts have more than one images or videos.
      if (multiple) {
        $actionElement
          .parent()
          .parent()
          .find(LEGACY_POST_RESOURCE_COUNT_SELECTOR)
          .each(function () {
            let element_videos = $(this)
              .parent()
              .parent()
              .parent()
              .find("video");
            if (element_videos && element_videos.attr("src")) {
              blob = true;
            }
          });

        if (blob || USER_SETTING.FORCE_RESOURCE_VIA_MEDIA) {
          createMediaListDOM(
            state.GL_postPath,
            ".IG_POPUP_DIG .IG_POPUP_DIG_MAIN .IG_POPUP_DIG_BODY",
            _i18n("LOAD_BLOB_MULTIPLE"),
          );
        } else {
          $actionElement
            .parent()
            .parent()
            .find(LEGACY_POST_RESOURCE_COUNT_SELECTOR)
            .each(function () {
              s++;
              let element_videos = $(this).find("video");
              let element_images = $(this).find("._aagv img");
              let imgLink = element_images.attr("srcset")
                ? element_images.attr("srcset").split(" ")[0]
                : element_images.attr("src");

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
              _i18n("LOAD_BLOB_RELOAD"),
            );
          }
        }
      } else {
        if (USER_SETTING.FORCE_RESOURCE_VIA_MEDIA) {
          createMediaListDOM(
            state.GL_postPath,
            ".IG_POPUP_DIG .IG_POPUP_DIG_MAIN .IG_POPUP_DIG_BODY",
            _i18n("LOAD_BLOB_MULTIPLE"),
          );
        } else {
          s++;
          let element_videos = $actionElement
            .parent()
            .parent()
            .parent()
            .find("video");
          let element_images = $actionElement
            .parent()
            .parent()
            .parent()
            .find("._aagv img");
          let imgLink = element_images.attr("srcset")
            ? element_images.attr("srcset").split(" ")[0]
            : element_images.attr("src");

          if (element_videos && element_videos.attr("src")) {
            createMediaListDOM(
              state.GL_postPath,
              ".IG_POPUP_DIG .IG_POPUP_DIG_MAIN .IG_POPUP_DIG_BODY",
              _i18n("LOAD_BLOB_ONE"),
            );
          }
          if (element_images && imgLink) {
            appendLegacyPostImageRow(imgLink, publish_time, s);
          }
        }
      }
    }

    $(".IG_POPUP_DIG .IG_POPUP_DIG_MAIN .IG_POPUP_DIG_BODY a").each(
      function () {
        $(this).wrap("<div></div>");
        $(this).before(
          '<label class="inner_box_wrapper"><input class="inner_box" type="checkbox"><span></span></label>',
        );
        $(this).after(
          `<div data-ih-locale-title="NEW_TAB" title="${_i18nHTML("NEW_TAB")}" class="newTab">${SVG.NEW_TAB}</div>`,
        );

        if ($(this).attr("data-name") == "video") {
          $(this).after(
            `<div data-ih-locale-title="VIDEO_THUMBNAIL" title="${_i18nHTML("VIDEO_THUMBNAIL")}" class="videoThumbnail">${SVG.THUMBNAIL}</div>`,
          );
        }
      },
    );

    if (USER_SETTING.DIRECT_DOWNLOAD_ALL) {
      const descriptors = await fetchPostBatchDescriptors(
        state.GL_postPath,
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
      [".IG_DW_MAIN", handleLegacyPostDownloadAction],
    ];

    state.GL_registerEventList.push({
      element: $postElement[0],
      trigger: [
        ".IG_THUMBNAIL_MAIN",
        ".IG_NEWTAB_MAIN",
        ".IG_DW_ALL_MAIN",
        ".IG_DW_MAIN",
        ".IG_IMAGE_VIEWER",
      ],
    });

    handlerRegistrations.forEach(([selector, handler]) => {
      const routeHandler = function (e) {
        return handler(e, this, $mainElement);
      };

      if (activeLegacyRouteScope) {
        activeLegacyRouteScope.listenJQuery(
          $postElement,
          "click",
          selector,
          routeHandler,
        );
      } else {
        $postElement.on("click", selector, routeHandler);
      }
    });
  }

  /**
   * createDownloadButton
   * @description Create a download button in the upper right corner of each post.
   *
   * @return {void}
   */
  function createDownloadButton() {
    // Add download icon per each posts
    // eslint-disable-next-line no-unused-vars
    $("article, section:visible > main > div > div > div > div > div > hr")
      .map(function (index) {
        return $(this).is(
          "section:visible > main > div > div > div > div > div > hr",
        )
          ? $(this).parent().parent().parent().parent()[0]
          : this;
      })
      .filter(function () {
        return $(this).height() > 0 && $(this).width() > 0;
      })
      .each(function (index) {
        // If it is have not download icon
        // class x1iyjqo2 mean user profile pages post list container
        if (
          !$(this).attr("data-snig") &&
          !$(this).hasClass("x1iyjqo2") &&
          !$(this).children("article")?.hasClass("x1iyjqo2") &&
          $(this).parents("div#scrollview").length === 0
        ) {
          logger("Found post container", $(this));

          const $mainElement = $(this);
          const tagName = this.tagName;

          // not loop each in single top post
          if (tagName === "DIV" && index != 0) {
            return;
          }

          const $childElement = $mainElement.children("div").children("div");

          if ($childElement.length === 0) return;

          logger("Found insert point", $childElement);

          mountLegacyPostControls($mainElement, $childElement, tagName);

          registerLegacyPostActionHandlers($(this), $mainElement);

          // Add the mark that download is ready
          var username =
            $(this)
              .find("header > div:last-child > div:first-child span a")
              .first()
              .text() ||
            $(this)
              .find('a[href^="/"]')
              .filter(function () {
                return $(this)?.text()?.length > 0;
              })
              .first()
              .text();

          $(this).attr("data-snig", "canDownload");
          $(this).attr("data-username", username);
        }
      });
  }

  /**
   * Render one normalized media row while retaining the established DOM
   * attributes for delegated handlers and third-party styling.
   *
   * @param {jQuery} $container
   * @param {import("../media/types.js").MediaDescriptor} descriptor
   * @return {HTMLAnchorElement}
   */
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
      // Preserve createMediaListDOM's historical fail-open behavior for the
      // two automatic batch paths, which do not expose a selectable list.
      logger("createMediaListDOM", err);
      return [];
    }
  }

  function preparePostMediaList($container, message) {
    $container.find("a").remove();
    $container.append($("<p>", { id: "_SNLOAD" }).text(message));
  }

  function renderPostMediaDescriptors($container, descriptors) {
    descriptors.forEach((descriptor) =>
      renderMediaDescriptor($container, descriptor),
    );
    $container.find("#_SNLOAD").remove();
  }

  function decoratePostMediaRows($container) {
    $container.find('a[data-needed="direct"]').each(function () {
      $(this).wrap("<div></div>");
      $(this).before(
        '<label class="inner_box_wrapper"><input class="inner_box" type="checkbox"><span></span></label>',
      );
      $(this).after(
        `<div data-ih-locale-title="NEW_TAB" title="${_i18nHTML("NEW_TAB")}" class="newTab">${SVG.NEW_TAB}</div>`,
      );

      if ($(this).attr("data-name") == "video") {
        $(this).after(
          `<div data-ih-locale-title="VIDEO_THUMBNAIL" title="${_i18nHTML("VIDEO_THUMBNAIL")}" class="videoThumbnail">${SVG.THUMBNAIL}</div>`,
        );
      }
    });
  }

  /**
   * Fetch, normalize, render, and decorate one post media list. The phases are
   * deliberately separate so normalized descriptors remain the data source
   * while the historical DOM contract stays intact.
   *
   * @param  {String}  postURL
   * @param  {String|jQuery}  selector - CSS selector or container receiving the media list.
   * @param  {String}  message - i18n display loading message
   * @return {void}
   */
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

  /**
   * Translate compatibility media rows into their internal records exactly
   * once at a DOM selection boundary. Generated rows resolve from the
   * WeakMap; legacy markup retains the existing attribute fallback.
   *
   * @param {jQuery|Iterable<Element>|ArrayLike<Element>} elements
   * @return {Array<import("../media/types.js").MediaDescriptor>}
   */
  function getMediaDescriptorsForElements(elements) {
    const source = elements?.jquery
      ? elements.toArray()
      : Array.from(elements || []);
    return source
      .map((element) => (element?.jquery ? element[0] : element))
      .filter(Boolean)
      .map((element) => getMediaDescriptorForElement(element));
  }

  function getMediaListLinkByIndex(index) {
    return $(
      `${MEDIA_LIST_SELECTOR} a[data-globalindex="${index + 1}"]`,
    ).first();
  }

  function consumeInjectedClick(e) {
    e.preventDefault();
    e.stopPropagation();
    if (e.stopImmediatePropagation) e.stopImmediatePropagation();
  }

  const INJECTED_ACTION_SELECTOR =
    ".newTab, .videoThumbnail, .IG_IMAGE_VIEWER, .IG_NEWTAB_MAIN, .IG_DW_ALL_MAIN";

  function clickStartedOnInjectedAction(e) {
    return e?.target?.closest?.(INJECTED_ACTION_SELECTOR) != null;
  }

  function removeMediaDialog() {
    $(".IG_POPUP_DIG_ROUTE").remove();
  }

  /**
   * getVisibleNodeIndex
   * @description Get element visible node.
   *
   * @param  {Object}  $main
   * @return {Integer}
   */
  function getVisibleNodeIndex($main) {
    // 1. Prioritize the most efficient rule: check if the "back" button exists.
    const hasBackButton = $main.find("button._afxv._al46._al47").length > 0;

    // 2. If the "back" button does not exist, it is determined to be the first image, and the result is returned immediately.
    if (!hasBackButton) {
      return 0;
    }
    var index = 0;

    // 3. If the code execution reaches here, it means it is not the first image, and the final geometric algorithm is enabled.

    // a. Locate the "viewport" element: it is the grandparent of ul
    // "_acay" class of <ul> has been removed by Instagram; [class] added to <ul> to get much lesser matches in page
    // The parent of the parent of ul[class] always has the attributes "role"
    // '*:not([data-pagelet])>*:not([role]):not([data-pagelet])>*>*>*[role]>*>ul[class]' is useful for avoiding the homepage stories section, account highlights section, and notes section in Messages.
    const $viewport = $main
      .find(
        "*:not([data-pagelet])>*:not([role]):not([data-pagelet])>*>*>*[role]>*>ul[class]",
      )
      .parent()
      .parent("[role]");

    if ($viewport.length > 0) {
      const viewportRect = $viewport.get(0).getBoundingClientRect();
      // b. Get itemWidth: directly use the width of the viewport, this method is the most generalizable
      const itemWidth = viewportRect.width;

      // Must successfully obtain the width to continue, to prevent division by zero errors
      if (itemWidth > 0) {
        // STAGE 1: Visual positioning, find the currently displayed <li> element
        // "_acaz" class of <li> has been removed by Instagram; [class] added to <li> to get much lesser matches in page
        const viewportRight = viewportRect.right;
        let closestSlideElement = null;
        let minDistance = Infinity;

        $main.find("li[class]").each(function () {
          if (this.getBoundingClientRect().width === 0) return;

          const slideRect = this.getBoundingClientRect();
          const distance = Math.abs(slideRect.right - viewportRight);

          if (distance < minDistance) {
            minDistance = distance;
            closestSlideElement = this;
          }
        });

        // STAGE 2: Index calculation, use the found <li> and itemWidth to calculate the global index
        if (closestSlideElement) {
          const style = $(closestSlideElement).attr("style");
          if (style && style.includes("translateX")) {
            const offsetMatch = style.match(/translateX\(([^p]+)px\)/);
            if (offsetMatch && offsetMatch[1]) {
              const totalOffset = parseFloat(offsetMatch[1]);
              // c. Execute the final calculation formula
              index = Math.round(totalOffset / itemWidth);
            }
          }
        }
      }
    }
    return index;
  }

  /**
   * batchDownloadPostDescriptors
   * @description Batch download media files in posts to prevent browser crashes.
   * @param {Iterable<import("../media/types.js").MediaDescriptor>|ArrayLike<import("../media/types.js").MediaDescriptor>} descriptors
   * @return {Promise<void>}
   */
  async function batchDownloadPostDescriptors(descriptors) {
    try {
      await runDownloadBatch(
        Array.from(descriptors || []),
        (descriptor) =>
          executeMediaDescriptor(descriptor, media.MEDIA_INTENT.DOWNLOAD, {
            dashBeforeMediaApi: true,
          }),
        {
          isSafari: IS_SAFARI,
          onProgress: setDownloadProgress,
          onError(error) {
            console.error("Batch download failed:", error);
          },
          sleep: routeDelay,
        },
      );
    } catch (error) {
      if (error?.name !== "AbortError") throw error;
    }
  }

  /**
   * skipSharedWithYouDialog
   * @description Auto-skip the "X shared this with you" dialog for ?igsh= links.
   *
   * @return {void}
   */
  function skipSharedWithYouDialog() {
    if (!USER_SETTING.SKIP_SHARED_WITH_YOU_DIALOG) return;

    let url;
    try {
      url = new URL(window.location.href);
    } catch (e) {
      logger("[skipSharedWithYouDialog] invalid URL", e);
      return;
    }

    // only for shared links with the tracking param ?igsh=...
    if (!url.searchParams || !url.searchParams.has("igsh")) return;

    const $dialogs = $('div[role="dialog"]');
    if (!$dialogs || !$dialogs.length) {
      return;
    }

    const profileUsername = location.pathname
      .split("/")
      .filter((s) => s.length > 0)
      .at(0)
      ?.toLowerCase();

    $dialogs.each(function () {
      const $dialog = $(this);

      if (!$dialog.is(":visible")) {
        return;
      }

      const $headers = $dialog.find("h2");
      if (!$headers.length) {
        return;
      }

      // Heuristic: header text that looks like "profile_name shared this with you"
      const isSharedHeader =
        $headers.filter(function () {
          const rawText = (this.textContent || "").trim().toLowerCase();
          if (!rawText) return false;

          // Typical case
          if (rawText.includes("shared this with you")) return true;
          if (rawText.includes("shared with you")) return true;

          // Fallback: contains username + "shared"
          if (
            profileUsername &&
            rawText.includes(profileUsername) &&
            rawText.includes("shared")
          ) {
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

      // Prefer a button whose text is exactly "Not now" (case-insensitive)
      $buttons.each(function () {
        const text = (this.textContent || "").trim().toLowerCase();
        if (!text) return;

        if (text === "not now") {
          $notNow = $(this);
          return false;
        }
      });

      // Fallback: if there are exactly 2 buttons, assume the second is "Not now"
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


  /**
   * onReels
   * @description Trigger user's reels download event or button display event.
   *
   * @param  {Boolean}  isDownload - Check if it is a download operation
   * @param  {Boolean}  isVideo - Check if reel is a video element
   * @param  {Boolean}  isPreview - Check if it is need to open new tab
   * @return {void}
   */
  async function onReels(isDownload, isVideo, isPreview) {
    try {
      if (isDownload) {
        updateLoadingBar(true);

        const reelsPath = location.pathname.match(
          /\/(?:reel|reels)\/([A-Za-z0-9_-]{5,64})(?:\/|$)/,
        )?.[1];
        let result = await getReelMedia(reelsPath);
        const descriptor = media.normalizeReelMedia(result, {
          isVideo,
          shortcode: reelsPath,
        })[0];
        if (!descriptor) {
          throw new Error("Cannot find Reel media resource.");
        }
        if (!descriptor.owner) {
          logger("carousel_media:", "undefined username");
          alert("carousel_media: undefined username");
          throw new Error("Cannot find Reel media owner.");
        }

        const intent = isPreview
          ? media.MEDIA_INTENT.PREVIEW
          : isVideo
            ? media.MEDIA_INTENT.DOWNLOAD
            : media.MEDIA_INTENT.THUMBNAIL;
        await executeMediaDescriptor(descriptor, intent, {
          defaultTimestamp: new Date().getTime(),
          includeIndex: false,
          replacePreviewHost: false,
          resolveMissingOwner: false,
          thumbnailSourceType: "reels",
          useDash: false,
          useImageCache: false,
          useMediaApi: false,
        });

        updateLoadingBar(false);
      } else {
        const svgClose =
          'svg > polyline[points^="20.643 3.357 12 12 3.353 20.647"] ~ line';
        var timer = routeSetInterval(() => {
          const hasTiktokStyleLayout = $(svgClose).length > 0;
          if (
            hasTiktokStyleLayout ||
            $('section > main[role="main"] > div div.x1qjc9v5 video').length > 0
          ) {
            clearInterval(timer);

            if (USER_SETTING.SCROLL_BUTTON) {
              const $reelsMain = $('section > main[role="main"]');
              let $scrollWrapper = $reelsMain.children("#scrollWrapper");

              if (!$scrollWrapper.length) {
                $scrollWrapper = $(
                  '<section id="scrollWrapper"><div class="button-up"><div></div></div><div class="button-down"><div></div></div></section>',
                );
                $reelsMain.append($scrollWrapper);
              }

              const scrollReelsBy = function (top) {
                const scrollContainer = $reelsMain.children("div")[0];
                scrollContainer?.scrollBy({
                  top,
                  behavior: "smooth",
                });
              };

              $scrollWrapper
                .find(".button-up")
                .off("click.IG_reelsScroll")
                .on("click.IG_reelsScroll", function () {
                  scrollReelsBy(-30);
                });
              $scrollWrapper
                .find(".button-down")
                .off("click.IG_reelsScroll")
                .on("click.IG_reelsScroll", function () {
                  scrollReelsBy(30);
                });
            } else {
              $("#scrollWrapper").remove();
            }

            // Reels playback uses an adaptive MediaSource stream. Let Safari
            // render its first frame before measuring and modifying the rail.
            $("div[aria-busy][tabindex]")
              .children("div")
              .each(function () {
                if (
                  $(this).children().length > 0 &&
                  $(this).width() > window.innerWidth * 0.8 &&
                  $(this).height() > window.innerHeight * 0.8 &&
                  $(this).find("video").length > 0
                ) {
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
        createCurrentReelVideoSurfaceAdapter,
      );
      return;
    }

    if ($main.data("insta-loader-reels-controls-pending")) {
      return;
    }

    $main.data("insta-loader-reels-controls-pending", true);
    const scope = activeLegacyRouteScope;
    const scheduleTimeout = (callback, delay) =>
      scope
        ? scope.setTimeout(callback, delay)
        : setTimeout(callback, delay);
    scope?.defer(() =>
      $main.removeData("insta-loader-reels-controls-pending")
    );

    let installQueued = false;
    const queueInstall = function () {
      if (installQueued || scope?.disposed) return;
      installQueued = true;

      const install = function () {
        $main.removeData("insta-loader-reels-controls-pending");
        if (!scope?.disposed && $main[0]?.isConnected) {
          appendReelsButton($main);
        }
      };

      if (typeof window.requestIdleCallback === "function") {
        if (scope) {
          scope.requestIdleCallback(install, { timeout: 1000 });
        } else {
          window.requestIdleCallback(install, { timeout: 1000 });
        }
      } else {
        scheduleTimeout(install, IS_SAFARI ? 250 : 0);
      }
    };

    const video = $main.find("video").first()[0];
    const queueAfterPlaybackStart = function () {
      scheduleTimeout(queueInstall, IS_SAFARI ? 1000 : 0);
    };

    if (typeof video?.requestVideoFrameCallback === "function") {
      const frameCallback = video.requestVideoFrameCallback(
        queueAfterPlaybackStart,
      );
      scope?.defer(() =>
        video.cancelVideoFrameCallback?.(frameCallback)
      );
      scheduleTimeout(queueInstall, IS_SAFARI ? 2000 : 1200);
    } else if (video && video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      if (scope) {
        scope.listen(video, "loadeddata", queueAfterPlaybackStart, {
          once: true,
        });
      } else {
        video.addEventListener("loadeddata", queueAfterPlaybackStart, {
          once: true,
        });
      }
      scheduleTimeout(queueInstall, IS_SAFARI ? 2000 : 1200);
    } else {
      queueAfterPlaybackStart();
    }
  }

  function appendReelsButton($main) {
    if (!$main.find(".IG_REELS_CONTROLS").length) {
      const $actionRail = $main
        .find("div")
        .filter(function () {
          const $children = $(this).children();
          const directActionGroups = $children.filter(function () {
            return $(this).find('[role="button"] svg[aria-label]').length > 0;
          }).length;

          // Avoid forcing layout for every descendant in a Reel. Only the
          // small set of action-group candidates needs geometry inspection.
          if (directActionGroups < 3) return false;

          const rect = this.getBoundingClientRect();
          const computedStyle = window.getComputedStyle(this);

          return (
            computedStyle.display === "flex" &&
            computedStyle.flexDirection === "column" &&
            rect.width > 0 &&
            rect.width <= 120 &&
            rect.height >= 180
          );
        })
        .first();

      if (!$actionRail.length) {
        logger("Unable to locate the Reels action rail");
        return;
      }

      $actionRail.prepend(
        `<div class="IG_REELS_CONTROLS" data-insta-loader-controls="reels">
          <div data-ih-locale-title="DW" title="${_i18nHTML("DW")}" class="IG_REELS">${SVG.DOWNLOAD}</div>
          <div data-ih-locale-title="NEW_TAB" title="${_i18nHTML("NEW_TAB")}" class="IG_REELS_NEWTAB">${SVG.NEW_TAB}</div>
          <div data-ih-locale-title="VIDEO_THUMBNAIL" title="${_i18nHTML("VIDEO_THUMBNAIL")}" class="IG_REELS_THUMBNAIL">${SVG.THUMBNAIL}</div>
        </div>`,
      );

      var $buttonParent = $main
        .find('div[role="presentation"] > div[role="button"] > div')
        .first();
      toggleVolumeSilder(
        () => $main.find("video").get(),
        $buttonParent,
        "reel",
      );
    }

    refreshRouteVideoBehavior(
      reelVideoBehaviorServices,
      $main.first()[0],
      createCurrentReelVideoSurfaceAdapter,
    );
  }

  /**
   * createStoryListDOM
   * @description Create a list of story items in the popup dialog.
   *
   * @return {void}
   */
  async function createStoryListDOM(obj, type) {
    try {
      $(".IG_POPUP_DIG #post_info").text(
        `${type} ID: ${obj.data.reels_media[0].id}`,
      );
      const selector = ".IG_POPUP_DIG .IG_POPUP_DIG_MAIN .IG_POPUP_DIG_BODY";

      const descriptors = buildStoryBatchDescriptors(obj, {
        surface: type,
        renamePublishDate: USER_SETTING.RENAME_PUBLISH_DATE,
        nowSeconds: Math.floor(Date.now() / 1000),
      });
      descriptors.forEach((descriptor, idx) => {
        const anchor = media.renderMediaRow(
          document,
          descriptor,
          _i18n,
          {
            displayIndex: idx,
            labelTranslationAttribute: "data-ih-locale-title",
            sourceType: type,
          },
        );
        $(selector).append(anchor);
        mediaDescriptorByElement.set(anchor, descriptor);
      });

      $(".IG_POPUP_DIG .IG_POPUP_DIG_MAIN .IG_POPUP_DIG_BODY a").each(
        function () {
          $(this).wrap("<div></div>");
          $(this).before(
            '<label class="inner_box_wrapper"><input class="inner_box" type="checkbox"><span></span></label>',
          );
          $(this).after(
            `<div data-ih-locale-title="NEW_TAB" title="${_i18nHTML("NEW_TAB")}" class="newTab">${SVG.NEW_TAB}</div>`,
          );

          if ($(this).attr("data-type") == "mp4") {
            $(this).after(
              `<div data-ih-locale-title="VIDEO_THUMBNAIL" title="${_i18nHTML("VIDEO_THUMBNAIL")}" class="videoThumbnail">${SVG.THUMBNAIL}</div>`,
            );
          }
        },
      );

      updatePopupSelectionSummary();
      updateLoadingBar(false);
    } catch (err) {
      console.error("createStoryListDOM()", err);
    }
  }

  /**
   * onStoryAll
   * @description Trigger user's story all download event.
   *
   * @return {void}
   */
  async function onStoryAll(actionLifecycle) {
    throwIfStorySurfaceActionCancelled(actionLifecycle);
    let username =
      $("body > div section._ac0a header._ac0k ._ac0l a + div a")
        .first()
        .text() ||
      location.pathname
        .split("/")
        .filter((s) => s.length > 0)
        .at(1);

    let stories = await getStoriesByUsername(username);
    throwIfStorySurfaceActionCancelled(actionLifecycle);

    if (USER_SETTING.DIRECT_DOWNLOAD_STORY) {
      scheduleStoryBatchDownloads(
        stories,
        STORY_SURFACE.STORY,
        false,
        actionLifecycle,
      );
    } else {
      throwIfStorySurfaceActionCancelled(actionLifecycle);
      IG_createDM(false, true, true);
      createStoryListDOM(stories, "stories");
    }
  }

  /**
   * onStory
   * @description Trigger user's story download event or button display event.
   *
   * @param  {Boolean}  isDownload - Check if it is a download operation
   * @param  {Boolean}  isForce - Check if downloading directly from API instead of cache
   * @param  {Boolean}  isPreview - Check if it is need to open new tab
   * @return {void}
   */
  async function onStory(
    isDownload,
    isForce,
    isPreview,
    actionLifecycle,
  ) {
    var username =
      $("body > div section._ac0a header._ac0k ._ac0l a + div a")
        .first()
        .text() ||
      location.pathname
        .split("/")
        .filter((s) => s.length > 0)
        .at(1);
    if (isDownload) {
      throwIfStorySurfaceActionCancelled(actionLifecycle);
      let date = new Date().getTime();
      let timestamp = Math.floor(date / 1000);

      const intent = isPreview
        ? STORY_INTENT.PREVIEW
        : STORY_INTENT.DOWNLOAD;
      const initialMediaApiPolicy = getStoryMediaApiPolicyInputs(
        USER_SETTING,
        state,
        { intent },
      );
      if (initialMediaApiPolicy.requestMediaApi) {
        let stories = await getStoriesByUsername(username);
        throwIfStorySurfaceActionCancelled(actionLifecycle);
        const domState = readLegacyStoryDomState();
        const actionContext = createLegacyStoryActionContext(
          STORY_SURFACE.STORY,
          stories,
          domState,
          intent,
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
            surface: STORY_SURFACE.STORY,
          },
        );
        const hasDeliveredMedia = hasDeliveredCurrentMedia(descriptor);

        let usedImageCache = false;
        await executeMediaDescriptor(
          descriptor,
          isPreview
            ? media.MEDIA_INTENT.PREVIEW
            : media.MEDIA_INTENT.DOWNLOAD,
          {
            ...createStorySurfaceMediaActionOptions(actionLifecycle),
            dashBeforeMediaApi: hasDeliveredMedia,
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
                actionLifecycle,
              );
            },
            onOutput: (context) => {
              if (context.source === "cache") {
                usedImageCache = true;
                logger("[Restore Cached onStory]", mediaId);
              }
            },
            outputShortcode: mediaId,
            outputTimestamp: (context) =>
              actionContext.mediaApiPolicy.renamePublishDate &&
                context.source === "media-api"
                ? context.descriptor.rawMediaItem?.taken_at ?? timestamp
                : timestamp,
            replacePreviewHost: false,
            retainFirstMediaApiImageCandidate: true,
            resolveMissingOwner: false,
            useDash: actionContext.mediaApiPolicy.requestDash,
            useDashForPreview: actionContext.mediaApiPolicy.requestDash,
            useImageCache: actionContext.mediaApiPolicy.useImageCache,
            useMediaApi:
              actionContext.mediaApiPolicy.requestMediaApi &&
              !hasDeliveredMedia,
          },
        );

        if (usedImageCache) return;

        return;
      }

      if ($("body > div section:visible video[playsinline]").length > 0) {
        // Download stories if it is video
        let stories;
        let fetchedStories = false;

        if (state.GL_dataCache.stories[username] && !isForce) {
          logger("Fetch from memory cache:", username);
          stories = state.GL_dataCache.stories[username];
        } else {
          stories = await getStoriesByUsername(username, {
            skipEmbedded: isForce,
          });
          throwIfStorySurfaceActionCancelled(actionLifecycle);
          fetchedStories = !embeddedStoryPayloads.has(stories);
          state.GL_dataCache.stories[username] = stories;
        }

        const domState = readLegacyStoryDomState();
        const actionContext = createLegacyStoryActionContext(
          STORY_SURFACE.STORY,
          stories,
          domState,
          intent,
        );
        const descriptor = normalizeLegacyStoryCurrentDescriptor(
          stories,
          actionContext,
          {
            shortcode: USER_SETTING.RENAME_PUBLISH_DATE
              ? actionContext.current.mediaId
              : null,
            surface: STORY_SURFACE.STORY,
          },
        );

        if (!descriptor || descriptor.kind !== "video") {
          if (!fetchedStories) {
            logger("Memory cache not found, try fetch from API:", username);
            return await onStory(
              true,
              true,
              undefined,
              actionLifecycle,
            );
          }
          alert(_i18n("NO_VID_URL"));
        } else {
          await executeMediaDescriptor(
            descriptor,
            isPreview
              ? media.MEDIA_INTENT.PREVIEW
              : media.MEDIA_INTENT.DOWNLOAD,
            {
              ...createStorySurfaceMediaActionOptions(actionLifecycle),
              defaultTimestamp: timestamp,
              includeIndex: false,
              replacePreviewHost: false,
              resolveMissingOwner: false,
              useDash: false,
              useImageCache: false,
              useMediaApi: false,
            },
          );
        }
      } else {
        // Download stories if it is image
        const downloadLink = getLegacyVisibleStoryImageUrl();

        if (USER_SETTING.RENAME_PUBLISH_DATE) {
          timestamp = new Date(
            $("body > div section:visible time[datetime][class]")
              .first()
              .attr("datetime"),
          ).getTime();
        }

        const decodedMediaId = getStoryId(downloadLink) ?? "-";
        // This first lookup, followed by the action service's lookup using
        // its result, deliberately preserves the published double-cache
        // Story image behavior.
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
          sourceType: STORY_SURFACE.STORY,
        };

        let usedImageCache = false;
        await executeMediaDescriptor(
          descriptor,
          isPreview
            ? media.MEDIA_INTENT.PREVIEW
            : media.MEDIA_INTENT.DOWNLOAD,
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
            useImageCache:
              USER_SETTING.CAPTURE_IMAGE_VIA_MEDIA_CACHE,
            useMediaApi: false,
          },
        );
        if (usedImageCache) return;
      }

      state.tempFetchRateLimit = false;
    } else {
      // Add the stories download button
      if (!$(".IG_DWSTORY").length) {
        state.GL_dataCache.stories = {};
        let $element = null;
        // Default detecter (section layout mode)
        if ($("body > div section._ac0a").length > 0) {
          $element = $("body > div section:visible._ac0a");
        }
        // detecter (single story layout mode)
        else {
          $element = $(
            "body > div section:visible > div > div[style]:not([class])",
          );
          $element.css("position", "relative");
        }

        if ($element.length === 0) {
          $element = $('div[id^="mount"] section > div > a[href="/"]')
            .parent()
            .parent()
            .parent()
            .find("section:visible > div > div[style]:not([class])");
          $element.css("position", "relative");
        }

        if ($element.length === 0) {
          $element = $('div[id^="mount"] section > div > a[href="/"]')
            .parent()
            .parent()
            .parent()
            .find(
              'section:visible > div div[style]:not([class]) > div:not([data-visualcompletion="loading-state"])',
            );
          $element.css("position", "relative");
        }

        if ($element.length === 0) {
          $element = $('div[id^="mount"] section > div a[href="/"]')
            .parents("section:visible")
            .find("div[style]:not([class])");
          $element.css("position", "relative");
        }

        // Detecter for div layout mode
        if ($element.length === 0) {
          let $$element = $(
            "body > div div:not([hidden]) section:visible > div div[class][style] > div[style]:not([class])",
          );
          let nowSize = 0;

          $$element.each(function () {
            if ($(this).width() > nowSize) {
              nowSize = $(this).width();
              $element = $(this).children("div").first();
            }
          });
        }

        if ($element != null) {
          $element.first().css("position", "relative");
          $element
            .first()
            .append(
              `<div data-ih-locale-title="DW" title="${_i18nHTML("DW")}" class="IG_DWSTORY">${SVG.DOWNLOAD}</div>`,
            );
          $element
            .first()
            .append(
              `<div data-ih-locale-title="NEW_TAB" title="${_i18nHTML("NEW_TAB")}" class="IG_DWNEWTAB">${SVG.NEW_TAB}</div>`,
            );

          let $header = getStoryProgress(username);
          if ($header.length > 1) {
            $element
              .first()
              .append(
                `<div data-ih-locale-title="DW_ALL" title="${_i18nHTML("DW_ALL")}" class="IG_DWSTORY_ALL">${SVG.DOWNLOAD_ALL}</div>`,
              );
          }

          setStoryProgressIndexText(
            $element.first(),
            $header,
            "IG_DWSTORY_POSITION",
          );

          // Make sure to first remove thumbnail button if still exists and story is a picture
          $element.find("img[referrerpolicy]").each(function () {
            bindStoryImageLoad(this, $element, "story");
          });

        }
      } else {
        setStoryProgressIndexByUsername(
          $(".IG_DWSTORY").parent(),
          username,
          "IG_DWSTORY_POSITION",
        );
      }
    }
  }

  /**
   * onStoryThumbnail
   * @description Trigger user's story video thumbnail download event or button display event.
   *
   * @param  {Boolean}  isDownload - Check if it is a download operation
   * @param  {Boolean}  isForce - Check if downloading directly from API instead of cache
   * @return {void}
   */
  async function onStoryThumbnail(
    isDownload,
    isForce,
    actionLifecycle,
  ) {
    if (isDownload) {
      throwIfStorySurfaceActionCancelled(actionLifecycle);
      // Download stories if it is video
      let date = new Date().getTime();
      let timestamp = Math.floor(date / 1000);
      let username =
        $("body > div section._ac0a header._ac0k ._ac0l a + div a")
          .first()
          .text() || location.pathname.split("/").at(2);
      let mediaId = null;

      const initialMediaApiPolicy = getStoryMediaApiPolicyInputs(
        USER_SETTING,
        state,
        { intent: STORY_INTENT.THUMBNAIL },
      );
      if (initialMediaApiPolicy.requestMediaApi) {
        let stories = await getStoriesByUsername(username);
        throwIfStorySurfaceActionCancelled(actionLifecycle);
        const domState = readLegacyStoryDomState();
        const actionContext = createLegacyStoryActionContext(
          STORY_SURFACE.STORY,
          stories,
          domState,
          STORY_INTENT.THUMBNAIL,
        );
        mediaId = actionContext.current.mediaId;

        if (mediaId == null) {
          await getMediaInfo(mediaId);
          return;
        }

        const descriptor = createLegacyStoryApiDescriptor(
          stories,
          actionContext,
          domState,
          {
            imageCandidate: media.STORY_IMAGE_CANDIDATE.DISPLAY_URL,
            publishTime: null,
            surface: STORY_SURFACE.STORY,
          },
        );
        const hasDeliveredMedia = hasDeliveredCurrentMedia(descriptor);

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
              state.tempFetchRateLimit = true;
              return await onStoryThumbnail(
                true,
                isForce,
                actionLifecycle,
              );
            },
            onOutput: (context) => {
              if (context.source === "cache") {
                usedImageCache = true;
                logger("[Restore Cached onStoryThumbnail]", mediaId);
              }
            },
            outputShortcode: mediaId,
            outputTimestamp: (context) =>
              actionContext.mediaApiPolicy.renamePublishDate &&
                context.source === "media-api"
                ? context.descriptor.rawMediaItem?.taken_at ?? timestamp
                : timestamp,
            retainFirstMediaApiImageCandidate: true,
            resolveMissingOwner: false,
            thumbnailSourceType: "stories",
            useDash: false,
            useImageCache: actionContext.mediaApiPolicy.useImageCache,
            useMediaApi:
              actionContext.mediaApiPolicy.requestMediaApi &&
              !hasDeliveredMedia,
          },
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
        stories = await getStoriesByUsername(username, {
          skipEmbedded: isForce,
        });
        throwIfStorySurfaceActionCancelled(actionLifecycle);
        fetchedStories = !embeddedStoryPayloads.has(stories);
      }

      const domState = readLegacyStoryDomState();
      const actionContext = createLegacyStoryActionContext(
        STORY_SURFACE.STORY,
        stories,
        domState,
        STORY_INTENT.THUMBNAIL,
      );
      const descriptor = normalizeLegacyStoryCurrentDescriptor(
        stories,
        actionContext,
        {
          imageCandidate: media.STORY_IMAGE_CANDIDATE.DISPLAY_URL,
          shortcode: USER_SETTING.RENAME_PUBLISH_DATE
            ? actionContext.current.mediaId
            : null,
          surface: STORY_SURFACE.STORY,
        },
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
          useMediaApi: false,
        },
      );
      state.tempFetchRateLimit = false;
    } else {
      if ($("body > div div.IG_DWSTORY").parent().find("video[class]").length) {
        // Add the stories download button
        let $element = null;
        // Default detecter (section layout mode)
        if ($("body > div section._ac0a").length > 0) {
          $element = $("body > div section:visible._ac0a");
        }
        // detecter (single story layout mode)
        else {
          $element = $(
            "body > div section:visible > div > div[style]:not([class])",
          );
          $element.css("position", "relative");
        }

        if ($element.length === 0) {
          $element = $('div[id^="mount"] section > div > a[href="/"]')
            .parent()
            .parent()
            .parent()
            .find("section:visible > div > div[style]:not([class])");
          $element.css("position", "relative");
        }

        if ($element.length === 0) {
          $element = $('div[id^="mount"] section > div > a[href="/"]')
            .parent()
            .parent()
            .parent()
            .find(
              'section:visible > div div[style]:not([class]) > div:not([data-visualcompletion="loading-state"])',
            );
          $element.css("position", "relative");
        }

        // Detecter for div layout mode
        if ($element.length === 0) {
          let $$element = $(
            "body > div div:not([hidden]) section:visible > div div[class][style] > div[style]:not([class])",
          );
          let nowSize = 0;

          $$element.each(function () {
            if ($(this).width() > nowSize) {
              nowSize = $(this).width();
              $element = $(this).children("div").first();
            }
          });
        }

        if ($element != null) {
          $element.first().css("position", "relative");
          $element
            .first()
            .append(
              `<div data-ih-locale-title="VIDEO_THUMBNAIL" title="${_i18nHTML("VIDEO_THUMBNAIL")}" class="IG_DWSTORY_THUMBNAIL">${SVG.THUMBNAIL}</div>`,
            );
        }
      }
    }
  }

  /* utils */

  /**
   * getHighlightStories
   * @description Get a list of all stories in highlight Id.
   *
   * @param  {Integer}  highlightId
   * @return {Object}
   */
  function getHighlightStories(highlightId, options = {}) {
    if (options.skipEmbedded !== true) {
      const embedded = getEmbeddedStoryResponse({ highlightId });
      if (embedded) return Promise.resolve(embedded);
    }

    const getURL = `https://www.instagram.com/graphql/query/?query_hash=45246d3fe16ccc6577e0bd297a5db1ab&variables=%7B%22highlight_reel_ids%22:%5B%22${highlightId}%22%5D,%22precomposed_overlay%22:false%7D`;
    return jsonRequest({ url: getURL, detectApiErrors: false }).catch((err) => {
      logger("getHighlightStories()", "reject", err.message);
      throw err;
    });
  }

  /**
   * getStories
   * @description Get a list of all stories in user Id.
   *
   * @param  {Integer}  userId
   * @param  {Object}  options
   * @return {Object}
   */
  function getStories(userId, options = {}) {
    if (options.skipEmbedded !== true) {
      const embedded = getEmbeddedStoryResponse({
        userId,
        username: options.username,
      });
      if (embedded) return Promise.resolve(embedded);
    }

    const getURL = `https://www.instagram.com/graphql/query/?query_hash=15463e8449a83d3d60b06be7e90627c7&variables=%7B%22reel_ids%22:%5B%22${userId}%22%5D,%22precomposed_overlay%22:false%7D`;
    return jsonRequest({ url: getURL, detectApiErrors: false })
      .then((obj) => {
        logger("getStories()", obj);
        return obj;
      })
      .catch((err) => {
        logger("getStories()", "reject", err.message);
        throw err;
      });
  }

  async function getStoriesByUsername(username, options = {}) {
    if (options.skipEmbedded !== true) {
      const embedded = getEmbeddedStoryResponse({ username });
      if (embedded) return embedded;
    }

    const userInfo = await getUserId(username);
    return await getStories(userInfo.user.pk, {
      skipEmbedded: true,
      username,
    });
  }

  /**
   * getUserId
   * @description Get user's id with username.
   *
   * @param  {String}  username
   * @return {Promise<Integer>}
   */
  async function getUserId(username) {
    const getURL = `https://www.instagram.com/web/search/topsearch/?query=${username}`;

    let obj;
    try {
      obj = await jsonRequest({ url: getURL, detectApiErrors: false });
    } catch (err) {
      logger("getUserId()", "reject", err);
      if (isStoryActionAbort(err)) throw err;

      // Keep the established secondary profile lookup for ordinary failures.
      // Safari policy denials are normally recovered inside jsonRequest() by
      // retrying the same endpoint through the authenticated page context.
      return await getUserIdWithAgent(username);
    }

    // Fix search issue by Discord: sno_w_
    const result = obj?.users?.find(
      (pos) =>
        pos.user.username?.toLowerCase() === username?.toLowerCase(),
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

  /**
   * getUserIdWithAgent
   * @description Get user's id with username.
   *
   * @param  {String}  username
   * @return {Integer}
   */
  function getUserIdWithAgent(username) {
    const getURL = `https://i.instagram.com/api/v1/users/web_profile_info/?username=${username}`;

    return jsonRequest({
      url: getURL,
      detectApiErrors: false,
      headers: {
        "X-IG-App-ID": getAppID(),
      },
    })
      .then((obj) => {
        const userInfo = obj?.data;
        if (userInfo?.user == null) {
          logger("getUserIdWithAgent()", "reject", "undefined");
          throw new Error("undefined");
        }

        userInfo.user.pk = userInfo.user.id;
        logger("getUserIdWithAgent()", obj);
        return userInfo;
      })
      .catch((err) => {
        logger("getUserIdWithAgent()", "reject", err?.message || err);
        throw err;
      });
  }

  /**
   * getUserHighSizeProfile
   * @description Get user's high quality avatar image.
   *
   * @param  {Integer}  userId
   * @return {String}
   */
  function getUserHighSizeProfile(userId) {
    const getURL = `https://www.instagram.com/api/v1/users/${userId}/info/`;

    return jsonRequest({
      url: getURL,
      detectApiErrors: false,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Linux; Android 10; Pixel 7 XL)Build/RP1A.20845.002; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/5.0 Chrome/117.0.5938.60 Mobile Safari/537.36 Instagram 307.0.0.34.111",
      },
    })
      .then((obj) => {
        if (obj?.status !== "ok") {
          logger("getUserHighSizeProfile()", "reject", obj);
          throw new Error("faild");
        }

        logger("getUserHighSizeProfile()", obj);
        return obj.user.hd_profile_pic_url_info?.url;
      })
      .catch((err) => {
        logger("getUserHighSizeProfile()", "reject", err);
        throw err;
      });
  }

  /**
   * getPostOwner
   * @description Get post's author with post shortcode.
   *
   * @param  {String}  postPath
   * @return {String}
   */
  function getPostOwner(postPath) {
    if (!postPath) return Promise.reject("NOPATH");
    const getURL = `https://www.instagram.com/graphql/query/?query_hash=2c4c2e343a8f64c625ba02b2aa12c7f8&variables=%7B%22shortcode%22:%22${postPath}%22}`;

    return jsonRequest({ url: getURL, detectApiErrors: false })
      .then((obj) => {
        logger("getPostOwner()", obj);
        return obj.data.shortcode_media.owner.username;
      })
      .catch((err) => {
        logger("getPostOwner()", "reject", err.message || err);
        throw err;
      });
  }

  /**
   * getBlobMediaWithQueryHash
   * @description Use the legacy post query without triggering another lookup.
   *
   * @param  {String}  postPath
   * @return {Object}
   */
  function getBlobMediaWithQueryHash(postPath) {
    if (!postPath) return Promise.reject("NOPATH");
    const postShortCode = postPath;
    const getURL = `https://www.instagram.com/graphql/query/?query_hash=2c4c2e343a8f64c625ba02b2aa12c7f8&variables=%7B%22shortcode%22:%22${postShortCode}%22}`;

    return jsonRequest({
      url: getURL,
      detectApiErrors: false,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Linux; Android 10; Pixel 7 XL)Build/RP1A.20845.002; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/5.0 Chrome/117.0.5938.60 Mobile Safari/537.36 Instagram 307.0.0.34.111",
      },
    }).then((obj) => {
      logger(obj);
      const resource = obj?.data?.shortcode_media;
      if (
        resource != null &&
        typeof resource === "object" &&
        !Array.isArray(resource)
      ) {
        return { type: "query_hash", data: obj.data };
      }

      throw createLegacyRequestError(
        "legacy_query_no_media",
        obj?.status === "fail"
          ? obj?.message || "The legacy query rejected the media request."
          : "The legacy query returned no media.",
      );
    });
  }

  function isMetadataRequestAbort(error) {
    return (
      error?.category === "abort" ||
      error?.name === "AbortError" ||
      error?.code === "operation_cancelled"
    );
  }

  /**
   * Resolve Reel metadata in the order supported by Instagram's current
   * delivery: already-delivered bootstrap JSON, current query ID, then the
   * legacy query hash as a last compatibility fallback.
   *
   * @param {String} postPath
   * @return {Promise<Object>}
   */
  async function getReelMedia(postPath) {
    const postShortCode = String(postPath || "");
    if (!/^[A-Za-z0-9_-]{5,64}$/.test(postShortCode)) {
      throw createLegacyRequestError(
        "invalid_shortcode",
        "A valid Instagram shortcode is required.",
      );
    }

    const embedded = getEmbeddedReelResponse(postShortCode);
    if (embedded) return embedded;

    try {
      const data = await getBlobMediaWithQueryID(postShortCode, {
        silent: true,
      });
      return { type: "query_id", data };
    } catch (error) {
      if (isMetadataRequestAbort(error)) throw error;
      logger(
        "getReelMedia()",
        "current query rejected; trying legacy query",
        error?.code || error?.message || error,
      );
      return await getBlobMediaWithQueryHash(postShortCode);
    }
  }

  /**
   * getBlobMedia
   * @description Preserve the post path's legacy-first lookup order.
   *
   * @param  {String}  postPath
   * @return {Object}
   */
  function getBlobMedia(postPath) {
    const postShortCode = String(postPath || "");
    if (!postShortCode) return Promise.reject("NOPATH");

    const requestWithQueryId = (reason) => {
      logger(
        "Request with:",
        "getBlobMediaWithQueryID()",
        postShortCode,
        reason,
      );
      return getBlobMediaWithQueryID(postShortCode).then((data) => ({
        type: "query_id",
        data,
      }));
    };

    return getBlobMediaWithQueryHash(postShortCode).catch((err) => {
      logger("getBlobMedia()", "legacy query rejected", err.message || err);
      if (isMetadataRequestAbort(err)) throw err;
      return requestWithQueryId(
        err?.message || "legacy-query-rejected",
      );
    });
  }

  /**
   * createLegacyRequestError
   * @description Preserve the endpoint wrapper's historical error shape while
   * playback-specific policy lives in MaximumReelPlaybackController.
   *
   * @return {Error}
   */
  function createLegacyRequestError(code, message, rateLimited = false) {
    const error = new Error(message);
    error.code = code;
    error.rateLimited = rateLimited;
    return error;
  }

  /**
   * getBlobMediaWithQueryID
   * @description Get list of all media files in post with post shortcode.
   *
   * @param  {String}  postPath
   * @param  {Object}  options - silent and timeout options for automatic use
   * @return {Object}
   */
  function getBlobMediaWithQueryID(postPath, options = {}) {
    const silent = options.silent === true;
    const postShortCode = String(postPath || "");
    if (!/^[A-Za-z0-9_-]{5,64}$/.test(postShortCode)) {
      return Promise.reject(
        createLegacyRequestError(
          "invalid_shortcode",
          "A valid Instagram shortcode is required.",
        ),
      );
    }

    const query = new URLSearchParams({
      query_id: "9496392173716084",
      variables: JSON.stringify({
        shortcode: postShortCode,
        __relay_internal__pv__PolarisFeedShareMenurelayprovider: true,
        __relay_internal__pv__PolarisIsLoggedInrelayprovider: true,
      }),
    });
    const getURL = `https://www.instagram.com/graphql/query/?${query.toString()}`;

    return jsonRequest({
      url: getURL,
      timeout: options.timeout,
      detectApiErrors: false,
      onRequest: options.onRequest,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Linux; Android 10; Pixel 7 XL)Build/RP1A.20845.002; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/5.0 Chrome/117.0.5938.60 Mobile Safari/537.36 Instagram 307.0.0.34.111",
        "X-IG-App-ID": getAppID(),
      },
    })
      .then((obj) => {
        if (Array.isArray(obj?.errors) && obj.errors.length) {
          const graphQLErrorText = obj.errors
            .map((error) =>
              [error?.message, error?.description, error?.code]
                .filter(Boolean)
                .join(" "),
            )
            .join(" ");
          const isRateLimited =
            /rate|limit|throttl|please wait|try again later/i.test(
              graphQLErrorText,
            );
          throw createLegacyRequestError(
            isRateLimited ? "rate_limited" : "graphql_error",
            graphQLErrorText || "Instagram returned a GraphQL error.",
            isRateLimited,
          );
        }

        if (obj?.status === "fail") {
          const feedback = [obj.message, obj.feedback_message]
            .filter(Boolean)
            .join(": ");
          const isRateLimited =
            /rate|limit|throttl|please wait|try again later/i.test(feedback);
          const apiError = createLegacyRequestError(
            isRateLimited ? "rate_limited" : "api_failure",
            feedback || "Instagram rejected the metadata request.",
            isRateLimited,
          );
          if (!silent) {
            alert(`getBlobMediaWithQueryID(): ${apiError.message}`);
          }
          throw apiError;
        }

        if (!obj?.data || typeof obj.data !== "object") {
          throw createLegacyRequestError(
            "empty_metadata",
            "Instagram returned no Reel metadata.",
          );
        }

        logger("getBlobMediaWithQueryID()", "success", postShortCode);
        return obj.data;
      })
      .catch((err) => {
        const legacyError = adaptLegacyMetadataRequestError(err);
        logger(
          "getBlobMediaWithQueryID()",
          "reject",
          legacyError?.code || legacyError?.name || "parse_failure",
        );
        throw legacyError;
      });
  }

  /**
   * Map the shared transport categories back to the endpoint's historical
   * error codes while callers migrate to RequestError directly.
   *
   * @param {*} error
   * @return {Error}
   */
  function adaptLegacyMetadataRequestError(error) {
    if (error?.code && !error?.category) return error;

    switch (error?.category) {
      case "rate-limit":
        return createLegacyRequestError(
          "rate_limited",
          "Instagram rate-limited the metadata request.",
          true,
        );
      case "http":
        return createLegacyRequestError(
          "http_error",
          error.message || "Instagram metadata request failed.",
        );
      case "login":
        return createLegacyRequestError(
          "login_required",
          "Instagram redirected the metadata request to a login or checkpoint.",
        );
      case "parse":
        return createLegacyRequestError(
          /html/i.test(error.message || "")
            ? "unexpected_html"
            : "parse_failure",
          error.message || "Instagram returned malformed metadata.",
        );
      case "timeout":
        return createLegacyRequestError(
          "request_timeout",
          "Instagram metadata request timed out.",
        );
      case "abort":
        return createLegacyRequestError(
          "operation_cancelled",
          "The Reel metadata request was cancelled.",
        );
      case "network":
      default:
        return createLegacyRequestError(
          "network_error",
          error?.message || "Instagram metadata request failed.",
        );
    }
  }

  /**
   * getMediaInfo
   * @description Get Instagram Media object.
   *
   * @param  {String}  mediaId
   * @return {Object}
   */
  function getMediaInfo(mediaId) {
    const getURL = `https://i.instagram.com/api/v1/media/${mediaId}/info/`;
    if (mediaId == null) {
      const message =
        "Cannot call Media API because of the media id is invalid.";
      alert(message);
      logger("getMediaInfo()", "reject", message);
      updateLoadingBar(false);
      return Promise.reject(-1);
    }

    const appId = getAppID();
    if (appId == null) {
      const message =
        "Cannot call Media API because of the app id is invalid.";
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
        "X-IG-App-ID": appId,
      },
      transform(obj, response) {
        const finalUrl = String(response?.finalUrl || "");
        if (finalUrl && finalUrl !== getURL) {
          const error = new Error("Media API redirect");
          error.redirectUrl = finalUrl;
          throw error;
        }
        return obj;
      },
    })
      .then((obj) => {
        logger("getMediaInfo()", obj);
        return obj;
      })
      .catch((err) => {
        if (err?.category === "network") {
          const legacyNetworkError = err.cause || err;
          logger("getMediaInfo()", "reject", legacyNetworkError);
          // The historical wrapper resolved GM onerror values so callers could
          // decide whether to fail open to the original resource.
          return legacyNetworkError;
        }

        const redirectUrl = err?.cause?.redirectUrl;
        if (err?.category === "login") {
          const message =
            "The account must be logged in to access Media API.";
          logger("getMediaInfo()", "reject", message);
          alert(message);
          updateLoadingBar(false);
          throw -1;
        }
        if (redirectUrl) {
          const message =
            'Unable to retrieve content because the API was redirected to "' +
            redirectUrl +
            '"';
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

  /**
   * getStoryId
   * @description Obtain the media id through the resource URL.
   *
   * @param  {string}  url
   * @return {string}
   */
  function getStoryId(url) {
    let obj = new URL(url);
    let base64 = obj?.searchParams?.get("ig_cache_key")?.split(".").at(0);
    if (base64) {
      return atob(base64);
    } else {
      return null;
    }
  }

  /**
   * getAppID
   * @description Get Instagram App ID.
   *
   * @return {?integer}
   */
  function getAppID() {
    let result = null;
    $('script[type="application/json"]').each(function () {
      const regexp = /"APP_ID":"([0-9]+)"/gi;
      const matcher = $(this).text().match(regexp);
      if (matcher != null && result == null) {
        result = [...$(this).text().matchAll(regexp)];
      }
    });

    return result ? result.at(0).at(-1) : null;
  }

  /**
   * getTimeElementBaseDateSource
   * @description Get the base date text source and cache key from a time element.
   *
   * @param  {JQuery}  $time
   * @return {{dateText: ?string, cacheKey: ?string}}
   */
  function getTimeElementBaseDateSource($time) {
    const titleText = $time.attr("title")?.trim();
    if (titleText) {
      return {
        dateText: titleText,
        cacheKey: `title:${titleText}`,
      };
    }

    const datetime = $time.attr("datetime")?.trim();
    if (datetime) {
      const date = new Date(datetime);
      if (!Number.isNaN(date.getTime())) {
        return {
          dateText: new Intl.DateTimeFormat(undefined, {
            year: "numeric",
            month: "short",
            day: "numeric",
          }).format(date),
          cacheKey: `datetime:${datetime}`,
        };
      }
    }

    return {
      dateText: null,
      cacheKey: null,
    };
  }

  /**
   * getTimeElementBaseDateText
   * @description Get the preserved absolute date text from a time element.
   *
   * @param  {JQuery}  $time
   * @return {?string}
   */
  function getTimeElementBaseDateText($time) {
    const preservedText = $time.attr("data-ih-original-date")?.trim();
    const preservedKey = $time.attr("data-ih-original-date-key")?.trim();
    const { dateText, cacheKey } = getTimeElementBaseDateSource($time);

    if (
      preservedText &&
      preservedKey &&
      cacheKey &&
      preservedKey === cacheKey
    ) {
      return preservedText;
    }

    if (dateText && cacheKey) {
      $time.attr("data-ih-original-date", dateText);
      $time.attr("data-ih-original-date-key", cacheKey);
      return dateText;
    }

    return null;
  }

  /**
   * setTimeElementDateAndLocaleTime
   * @description Replace time element text with absolute date and localized time.
   *
   * @param  {JQuery}  $time
   * @return {void}
   */
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

    const localeTime = new Intl.DateTimeFormat(undefined, {
      hour: "numeric",
      minute: "2-digit",
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

  /**
   * getHighlightCurrentTimeElement
   * @description Get the publish time element in the current highlight view.
   *
   * @param  {JQuery}  $element
   * @return {JQuery}
   */
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

    let $times = $section.find("time[datetime]").filter(function () {
      const $time = $(this);

      return (
        $time.is(":visible") &&
        $time.closest('a[href^="/stories/highlights/"]').length === 0 &&
        $time.closest('[role="button"]').length === 0
      );
    });

    if ($times.length === 0) {
      return $();
    }

    return $times.first();
  }

  /**
   * updateLoadingBar
   * @description Update loading state.
   *
   * @param  {Boolean}  isLoading - Check if loading state
   * @return {void}
   */
  function updateLoadingBar(isLoading) {
    if (isLoading) {
      $('div[id^="mount"] > div > div > div:first').removeClass("x1s85apg");
      $('div[id^="mount"] > div > div > div:first').css("z-index", "20000");
    } else {
      $('div[id^="mount"] > div > div > div:first').addClass("x1s85apg");
      $('div[id^="mount"] > div > div > div:first').css("z-index", "");
    }
  }

  /**
   * getStoryProgress
   * @description Get the story progress of the username (post several stories).
   *
   * @param  {String}  username - Get progress of username
   * @return {Object}
   */
  function getStoryProgress(username) {
    let $header = $(
      'body > div section:visible a[href^="/' + username + '"] span',
    )
      .filter(function () {
        return (
          $(this).children().length === 0 &&
          $(this).find("svg").length === 0 &&
          $(this).text()?.toLowerCase() === username?.toLowerCase()
        );
      })
      .parents("div:not([class]):not([style])")
      .filter(function () {
        return $(this).text()?.toLowerCase() !== username?.toLowerCase();
      })
      .filter(function () {
        return $(this).children().length > 1;
      })
      .first();

    if ($header.length === 0) {
      $header = $('body > div section:visible a[href^="/' + username + '"]')
        .filter(function () {
          return $(this).find("img").length > 0;
        })
        .parents("div:not([class]):not([style])")
        .filter(function () {
          return $(this).text()?.toLowerCase() !== username?.toLowerCase();
        })
        .filter(function () {
          return $(this).children().length > 1;
        })
        .first();
    }

    return $header
      .children()
      .filter(function () {
        return $(this).height() < 10;
      })
      .first()
      .children();
  }

  /**
   * getStoryProgressIndex
   * @description Get the current story index and total count from Instagram's progress bar.
   *
   * @param  {Object}  $header - Progress bar items returned by getStoryProgress
   * @return {?Object}
   */
  function getStoryProgressIndex($header) {
    return getStoryProgressMetadata($header.toArray());
  }

  /**
   * setStoryProgressIndexText
   * @description Render the current story index and total count.
   *
   * @param  {Object}  $element - Element to append the counter to
   * @param  {Object}  $header - Progress bar items returned by getStoryProgress
   * @param  {String}  className - Counter class name
   * @return {void}
   */
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
    let title = _i18n("ITEM_POSITION")
      .replace("%CURRENT%", progress.current)
      .replace("%TOTAL%", progress.total);

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

  /**
   * setStoryProgressIndexByUsername
   * @description Render current story index and total count from a username.
   *
   * @param  {Object}  $element - Element to append the counter to
   * @param  {String}  username - Story owner's username
   * @param  {String}  className - Counter class name
   * @return {void}
   */
  function setStoryProgressIndexByUsername($element, username, className) {
    if ($element == null || $element.length === 0 || username == null) {
      return;
    }

    let $header = getStoryProgress(username);
    setStoryProgressIndexText($element, $header, className);
  }

  /**
   * setDownloadProgress
   * @description Show and set download circle progress.
   *
   * @param  {Integer}  now
   * @param  {Integer}  total
   * @return {Void}
   */
  function setDownloadProgress(now, total) {
    if ($(".circle_wrapper").length) {
      $(".circle_wrapper span").text(`${now}/${total}`);

      if (now >= total) {
        $(".circle_wrapper").fadeOut(250, function () {
          $(this).remove();
        });
      }
    } else {
      $("body").append(
        `<div class="circle_wrapper"><circle></circle><span>${now}/${total}</span></div>`,
      );
    }
  }

  /**
   * saveFiles
   * @description Download the specified media URL to the computer.
   *
   * @param  {String}  downloadLink
   * @param  {Object}  metadata
   * @param  {String}  metadata.username
   * @param  {String}  metadata.sourceType
   * @param  {Integer}  metadata.timestamp
   * @param  {String}  metadata.filetype
   * @param  {String}  metadata.shortcode
   * @param  {Integer|null}  metadata.index
   * @param  {String|null}  metadata.uid
   * @return {Promise}
   */
  async function fetchMediaBlob(downloadLink, operationOptions = {}) {
    return await downloadTransport.fetchMediaBlob(
      downloadLink,
      operationOptions,
    );
  }

  function shouldFetchBlobBeforeDownload(metadata) {
    return (
      USER_SETTING.MODIFY_RESOURCE_EXIF &&
      metadata.filetype === "jpg" &&
      metadata.shortcode &&
      metadata.sourceType === "photo"
    );
  }

  function shouldModifyExifBlob(object, metadata) {
    return (
      shouldFetchBlobBeforeDownload(metadata) &&
      (object.type === "image/jpeg" || object.type === "image/webp")
    );
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

  async function triggerDirectDownload(
    downloadLink,
    filename,
    operationOptions = {},
  ) {
    return await downloadTransport.downloadUrl(
      downloadLink,
      filename,
      operationOptions,
    );
  }

  async function saveFiles(
    downloadLink,
    metadata,
    operationOptions = createDownloadOperationOptions(),
  ) {
    updateLoadingBar(true);
    try {
      if (!downloadLink) {
        throw new Error("Missing download URL.");
      }

      if (!shouldFetchBlobBeforeDownload(metadata)) {
        const preparedMetadata = await prepareSaveMetadata(
          metadata,
          saveFilenameNeedsUid(),
        );
        const downloadName = getSaveFileName(downloadLink, preparedMetadata);
        return await triggerDirectDownload(
          downloadLink,
          downloadName,
          operationOptions,
        );
      }

      const dwel = await fetchMediaBlob(downloadLink, operationOptions);
      return await createSaveFileElement(
        downloadLink,
        dwel,
        metadata,
        operationOptions,
      );
    } catch (err) {
      console.error("Failed to save media:", err);
      logger("saveFiles()", "failed", err?.message || err);
      return false;
    } finally {
      updateLoadingBar(false);
    }
  }

  /**
   * fetchArrayBuffer
   * @description Download URL as ArrayBuffer.
   *
   * @param {string} url
   * @return {Promise<ArrayBuffer>}
   */
  async function fetchArrayBuffer(url) {
    updateLoadingBar(true);
    const abortController =
      typeof environment.window.AbortController === "function"
        ? new environment.window.AbortController()
        : null;
    if (abortController && activeLegacyRouteScope) {
      activeLegacyRouteScope.trackAbortable(abortController);
    }
    try {
      const res = await fetch(
        url,
        abortController ? { signal: abortController.signal } : undefined,
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.arrayBuffer();
    } finally {
      updateLoadingBar(false);
    }
  }

  /**
   * muxDashVideoAudioToMp4
   * @description Mux DASH video+audio into one MP4 using Mediabunny (demux + mux).
   *
   * @param {ArrayBuffer} videoBuf
   * @param {ArrayBuffer} audioBuf
   * @return {Promise<ArrayBuffer>}
   */
  async function muxDashVideoAudioToMp4(videoBuf, audioBuf) {
    const MB = Mediabunny;

    const videoInput = new MB.Input({
      formats: [MB.MP4],
      source: new MB.BufferSource(videoBuf),
    });
    const audioInput = new MB.Input({
      formats: [MB.MP4],
      source: new MB.BufferSource(audioBuf),
    });

    const vTrack = await videoInput.getPrimaryVideoTrack();
    if (!vTrack || !vTrack.codec) throw new Error("No video track found");

    const aTrack = await audioInput.getPrimaryAudioTrack();
    if (!aTrack || !aTrack.codec) throw new Error("No audio track found");

    const vSink = new MB.EncodedPacketSink(vTrack);
    const aSink = new MB.EncodedPacketSink(aTrack);

    const output = new MB.Output({
      format: new MB.Mp4OutputFormat({ fastStart: "in-memory" }),
      target: new MB.BufferTarget(),
    });

    const vSource = new MB.EncodedVideoPacketSource(vTrack.codec);
    const aSource = new MB.EncodedAudioPacketSource(aTrack.codec);

    output.addVideoTrack(vSource, { rotation: vTrack.rotation || 0 });
    output.addAudioTrack(aSource);

    await output.start();

    const vDecoderConfig = await vTrack.getDecoderConfig();
    const aDecoderConfig = await aTrack.getDecoderConfig();

    const vMeta = vDecoderConfig
      ? { decoderConfig: vDecoderConfig }
      : undefined;
    const aMeta = aDecoderConfig
      ? { decoderConfig: aDecoderConfig }
      : undefined;

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
        await vSource.add(vNext.value, vSentMeta ? undefined : vMeta);
        vSentMeta = true;
        vNext = await vIter.next();
      } else {
        await aSource.add(aNext.value, aSentMeta ? undefined : aMeta);
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
        outBuf.byteOffset + outBuf.byteLength,
      );
    }
    throw new Error("Unexpected output buffer type");
  }

  const dashExecutionCoordinator = new media.DashExecutionCoordinator({
    createMp4Blob: (buffer) => new Blob([buffer], { type: "video/mp4" }),
    fetchArrayBuffer,
    logger: (...messages) => logger(...messages),
    mux: muxDashVideoAudioToMp4,
    saveMerged: (sourceUrl, blob, metadata) =>
      createSaveFileElement(
        sourceUrl,
        blob,
        metadata,
        metadata.downloadOperationOptions,
      ),
    saveStream: (url, metadata) =>
      saveFiles(url, metadata, metadata.downloadOperationOptions),
  });

  async function downloadDashStreams(
    videoUrl,
    audioUrl,
    username,
    sourceType,
    timestamp,
    shortcode,
    operationOptions = createDownloadOperationOptions(),
  ) {
    return await dashExecutionCoordinator.execute({
      videoUrl,
      audioUrl,
      metadata: {
        username,
        sourceType,
        timestamp,
        shortcode,
        downloadOperationOptions: operationOptions,
      },
    });
  }

  /**
   * tryHandleDashFromMediaItem
   * @description Centralized DASH handling for Media API items.
   *              Uses video_dash_manifest when present.
   *              Picks best video by resolution (height/width), then bandwidth.
   *              Audio is optional.
   *
   * @return {Promise<boolean>} true if DASH path handled it, false to let caller fallback.
   */
  async function tryHandleDashFromMediaItem({
    mediaItem,
    username,
    sourceType,
    timestamp,
    shortcode,
    isPreview,
    index,
    operationOptions,
    throwIfCancelled = () => {},
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
        logger: (...messages) => logger(...messages),
      });
      const vUrl = best?.video?.url || "";
      const aUrl = best?.audio?.url || "";

      if (!vUrl) {
        return false;
      }

      logger("[DASH]", "best reps selected", {
        video: best.video
          ? {
              height: best.video.height,
              width: best.video.width,
              bandwidth: best.video.bandwidth,
              codecs: best.video.codecs,
            }
          : null,
        audio: best.audio
          ? { bandwidth: best.audio.bandwidth, codecs: best.audio.codecs }
          : "(none)",
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
          index,
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
        operationOptions,
      );
    } catch (e) {
      if (isStoryActionAbort(e)) throw e;
      logger(
        "[DASH]",
        "tryHandleDashFromMediaItem failed -> fallback",
        e?.message || e,
      );
      return false;
    }
  }

  /**
   * @description Trigger download from Blob with filename.
   *
   * @param {Blob} blob
   * @param {string} filename
   * @return {Promise<boolean>}
   */
  async function triggerDownload(
    blob,
    filename,
    operationOptions = createDownloadOperationOptions(),
  ) {
    return await downloadTransport.downloadBlob(
      blob,
      filename,
      operationOptions,
    );
  }

  /**
   * getSaveFileName
   * @description Get the file name for downloaded media according to the user settings and resource information.
   *
   * @param  {String}  downloadLink
   * @param  {Object}  metadata
   * @param  {String}  metadata.username
   * @param  {String}  metadata.sourceType
   * @param  {Integer}  metadata.timestamp
   * @param  {String}  metadata.filetype
   * @param  {String}  metadata.shortcode
   * @param  {Integer|null}  metadata.index
   * @param  {String|null}  metadata.uid
   * @return {String}  The generated filename
   */
  function getSaveFileName(downloadLink, metadata) {
    return createDownloadFilename(downloadLink, metadata, {
      autoRename: USER_SETTING.AUTO_RENAME,
      renameFormat: state.fileRenameFormat,
    });
  }

  /**
   * createSaveFileElement
   * @description Download the specified media with link element.
   *
   * @param  {String}  downloadLink
   * @param  {Object}  object
   * @param  {Object}  metadata
   * @param  {String}  metadata.username
   * @param  {String}  metadata.sourceType
   * @param  {Integer}  metadata.timestamp
   * @param  {String}  metadata.filetype
   * @param  {String}  metadata.shortcode
   * @param  {Integer|null}  metadata.index
   * @param  {String|null}  metadata.uid
   * @return {Promise<boolean>}
   */
  async function createSaveFileElement(
    downloadLink,
    object,
    metadata,
    operationOptions = createDownloadOperationOptions(),
  ) {
    const shouldModifyExif = shouldModifyExifBlob(object, metadata);
    const preparedMetadata = await prepareSaveMetadata(
      metadata,
      shouldModifyExif || saveFilenameNeedsUid(),
    );

    const downloadName = getSaveFileName(downloadLink, preparedMetadata);

    if (shouldModifyExif) {
      try {
        const newBlob = await changeExifData(object, preparedMetadata);
        return await triggerDownload(
          newBlob,
          downloadName,
          operationOptions,
        );
      } catch (err) {
        console.error(
          "Failed to strip EXIF and/or attach post URL to EXIF.",
          err,
        );
        return await triggerDownload(object, downloadName, operationOptions);
      }
    }

    return await triggerDownload(object, downloadName, operationOptions);
  }

  /**
   * changeExifData
   * @description Strips EXIF metadata and attaches post URLs to the EXIF of downloaded image resources.
   *
   * @param  {Object}  blob
   * @param  {Object}  metadata
   * @param  {String}  metadata.username
   * @param  {String}  metadata.sourceType
   * @param  {Integer}  metadata.timestamp
   * @param  {String}  metadata.filetype
   * @param  {String}  metadata.shortcode
   * @param  {Integer|null}  metadata.index
   * @param  {String}  metadata.uid
   * @return {Blob}
   */
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
        out[i * 2] = code & 0xff;
        out[i * 2 + 1] = (code >> 8) & 0xff;
      }
      return out;
    };
    const formatExifDate = (ts) => {
      let parsed = Number(ts);
      if (!Number.isFinite(parsed)) {
        parsed = Date.now();
      }
      if (parsed < 1e12) {
        parsed *= 1000;
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
    const makeIFDEntry = (tag, type, count, valueOrOffset) =>
      concat(u16le(tag), u16le(type), u32le(count), u32le(valueOrOffset));
    const fourCC = (dv, o) =>
      String.fromCharCode(
        dv.getUint8(o),
        dv.getUint8(o + 1),
        dv.getUint8(o + 2),
        dv.getUint8(o + 3),
      );

    const head = new Uint8Array(await blob.slice(0, 12).arrayBuffer());
    const isJPEG = head[0] === 0xff && head[1] === 0xd8;
    const isWEBP =
      head.length >= 12 &&
      String.fromCharCode(...head.subarray(0, 4)) === "RIFF" &&
      String.fromCharCode(...head.subarray(8, 12)) === "WEBP";
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
      0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00,
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
      makeIFDEntry(0x013b, 2, artistBytes.length, artistOffset), // Artist
      makeIFDEntry(0x8769, 4, 1, exifIfdOffset), // Exif Offset
      makeIFDEntry(0x9c9c, 1, xpCommentBytes.length, xpCommentOffset), // XPComment
      makeIFDEntry(0x9c9e, 1, keywordBytes.length, keywordOffset), // XPKeywords
      u32le(0),
    );

    const exifIfd = concat(
      u16le(exifIfdCount),
      makeIFDEntry(0x9003, 2, dateBytes.length, dateOffset),
      u32le(0),
    );

    const tiffBody = concat(
      tiffHeader,
      ifd0,
      exifIfd,
      artistBytes,
      keywordBytes,
      xpCommentBytes,
      dateBytes,
    );

    if (isJPEG) {
      const ab = await blob.arrayBuffer();
      const dv = new DataView(ab);
      const app1Body = concat(exifPrefix, tiffBody);
      const app1Header = new Uint8Array(4);
      new DataView(app1Header.buffer).setUint16(0, 0xffe1);
      new DataView(app1Header.buffer).setUint16(2, app1Body.length + 2);
      const newAPP1 = concat(app1Header, app1Body);

      const parts = [new Uint8Array(ab, 0, 2)];
      let off = 2,
        added = false;
      while (off < dv.byteLength) {
        const marker = dv.getUint16(off);
        if ((marker & 0xff00) !== 0xff00) break;
        if (marker === 0xffda) {
          if (!added) parts.push(newAPP1);
          parts.push(new Uint8Array(ab, off));
          break;
        }
        const len = dv.getUint16(off + 2) + 2;
        if (marker === 0xffe1) {
          off += len;
          continue;
        }
        parts.push(new Uint8Array(ab, off, len));
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
        type: "image/jpeg",
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
      tiffBody,
    );
    if (exifChunk.length & 1) exifChunk = concat(exifChunk, Uint8Array.of(0));
    if (vp8xIdx !== -1) {
      const vp8x = new Uint8Array(chunks[vp8xIdx]);
      vp8x[8] |= 0x10;
      chunks[vp8xIdx] = vp8x;
      chunks.splice(vp8xIdx + 1, 0, exifChunk);
    } else {
      chunks.push(exifChunk);
    }
    const payload = chunks.reduce((s, c) => s + c.length, 0);
    const riffHeader = concat(enc("RIFF"), u32le(payload + 4), enc("WEBP"));
    const finalBuf = concat(riffHeader, ...chunks);
    return new Blob([finalBuf], {
      type: "image/webp",
    });
  }

  /**
   * Resolve the internal media record for a rendered link. Newly rendered
   * rows use the WeakMap as their source of truth; the attribute fallback
   * keeps existing injected markup and delegated consumers compatible while
   * they migrate.
   *
   * @param {Element} element
   * @return {import("../media/types.js").MediaDescriptor}
   */
  function getMediaDescriptorForElement(element) {
    const stored = mediaDescriptorByElement.get(element);
    if (stored) return stored;

    const $element = $(element);
    const sourceType = $element.attr("data-name");
    const extension = $element.attr("data-type") ||
      (sourceType === "video" ? "mp4" : "jpg");
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
      rawMediaItem: canonicalMediaId
        ? state.GL_mediaDataCache[canonicalMediaId] || null
        : null,
      dashManifest:
        state.GL_mediaDataCache[canonicalMediaId]?.video_dash_manifest || null,
      hasCanonicalMediaId: canonicalMediaId != null,
      sourceType,
    };
    mediaDescriptorByElement.set(element, descriptor);
    return descriptor;
  }

  /**
   * Adapt the legacy download/output policy to the descriptor-only media
   * action pipeline. One service instance is created per action so concurrent
   * batch items cannot leak endpoint/fallback state into each other.
   *
   * @param {Object} metadata
   * @param {String} metadata.username
   * @param {String} metadata.sourceType
   * @param {Number} metadata.timestamp
   * @param {Number} metadata.index
   * @param {String|Number|null} [metadata.uid]
   * @param {Object} [actionOptions]
   * @param {Boolean} [actionOptions.allowMediaApiForThumbnail]
   * @param {Boolean} [actionOptions.allowNonCanonicalImageCache]
   * @param {Boolean} [actionOptions.dashBeforeMediaApi]
   * @param {Boolean} [actionOptions.deferMediaApiRequestFailureAlert]
   * @param {String|Number|null} [actionOptions.imageCacheKey]
   * @param {Boolean} [actionOptions.includeIndex]
   * @param {Boolean} [actionOptions.logMediaApiError]
   * @param {Boolean} [actionOptions.swallowMediaApiFailure]
   * @param {Function} [actionOptions.onMediaApiFallback]
   * @param {Function} [actionOptions.onOutput]
   * @param {String|Function} [actionOptions.outputShortcode]
   * @param {String|Function} [actionOptions.outputSourceType]
   * @param {Number|Function} [actionOptions.outputTimestamp]
   * @param {Boolean} [actionOptions.replacePreviewHost]
   * @param {Boolean} [actionOptions.retainFirstMediaApiImageCandidate]
   * @param {String} [actionOptions.thumbnailSourceType]
   * @param {String|Number|null} [actionOptions.uid]
   * @param {Boolean} [actionOptions.useImageCache]
   * @param {Boolean} [actionOptions.useMediaApi]
   * @param {Boolean} [actionOptions.useDash]
   * @param {Boolean} [actionOptions.useDashForPreview]
   * @param {Boolean} [actionOptions.markMediaApiFallback]
   * @param {{signal?: AbortSignal}} [actionOptions.operationOptions]
   * @param {Function} [actionOptions.throwIfCancelled]
   * @return {media.MediaActionService}
   */
  function createLegacyMediaActionService(metadata, actionOptions = {}) {
    let mediaApiAttempted = false;
    let dashResult;
    let fallbackActionHandled = false;
    let fallbackActionResult;
    const throwIfCancelled =
      typeof actionOptions.throwIfCancelled === "function"
        ? actionOptions.throwIfCancelled
        : () => {};

    function resolveOutputOption(name, context, fallback) {
      if (!Object.prototype.hasOwnProperty.call(actionOptions, name)) {
        return fallback;
      }

      const option = actionOptions[name];
      return typeof option === "function" ? option(context) : option;
    }

    function createActionFileOptions(context, intent) {
      const isThumbnail = intent === media.MEDIA_INTENT.THUMBNAIL;
      const defaultSourceType = isThumbnail
        ? actionOptions.thumbnailSourceType || "thumbnail"
        : metadata.sourceType;
      const fileOptions = {
        username: metadata.username,
        sourceType: resolveOutputOption(
          "outputSourceType",
          context,
          defaultSourceType,
        ),
        timestamp: resolveOutputOption(
          "outputTimestamp",
          context,
          metadata.timestamp,
        ),
        filetype: isThumbnail
          ? "jpg"
          : context.originalDescriptor.extension,
        shortcode: resolveOutputOption(
          "outputShortcode",
          context,
          context.originalDescriptor.shortcode,
        ),
      };

      if (!isThumbnail) fileOptions.uid = metadata.uid;
      if (
        !isThumbnail &&
        !mediaApiAttempted &&
        actionOptions.includeIndex !== false
      ) {
        fileOptions.index = metadata.index;
      }

      return fileOptions;
    }

    function resolvePreviewDashDescriptor(resolved, intent) {
      const mediaItem = resolved?.rawMediaItem;
      if (
        intent !== media.MEDIA_INTENT.PREVIEW ||
        actionOptions.useDashForPreview !== true ||
        !USER_SETTING.PREFER_DASH_MANIFEST ||
        !USER_SETTING.FORCE_RESOURCE_VIA_MEDIA ||
        !mediaItem?.video_dash_manifest ||
        !mediaItem?.video_versions
      ) {
        return resolved;
      }

      try {
        const best = media.parseDashManifest(mediaItem.video_dash_manifest, {
          DOMParser,
          hasAudio: mediaItem.has_audio,
          logger: (...messages) => logger(...messages),
        });
        const videoUrl = best?.video?.url;
        if (!videoUrl) return resolved;

        logger("[DASH]", "preview mode -> best video representation");
        return { ...resolved, directUrl: videoUrl };
      } catch (error) {
        logger(
          "[DASH]",
          "preview manifest failed -> progressive fallback",
          error?.message || error,
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
            "imageCacheKey",
          )
            ? actionOptions.imageCacheKey
            : descriptor.mediaId;
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
            error.alreadyReported =
              cause === -1 || cause?.alreadyReported === true;
            throw error;
          } finally {
            updateLoadingBar(false);
          }
          throwIfCancelled();

          if (result?.status !== "ok") {
            const error = new Error(
              result?.message || "Media API returned an unsuccessful response.",
            );
            error.response = result;
            throw error;
          }

          let resolved = media.normalizeApiMedia(result)[0];
          if (!resolved?.directUrl) {
            throw new Error("Media API returned no downloadable resource.");
          }
          if (
            actionOptions.retainFirstMediaApiImageCandidate === true &&
            resolved.kind === "image"
          ) {
            const firstImageUrl =
              resolved.rawMediaItem?.image_versions2?.candidates?.[0]?.url;
            if (firstImageUrl) {
              resolved = {
                ...resolved,
                directUrl: firstImageUrl,
                thumbnailUrl: firstImageUrl,
              };
            }
          }
          return resolvePreviewDashDescriptor(resolved, intent);
        },
        async resolveDash(context) {
          throwIfCancelled();
          const { descriptor, originalDescriptor } = context;
          const cachedMediaItem =
            state.GL_mediaDataCache[descriptor.mediaId];
          const mediaItem = [
            descriptor.rawMediaItem,
            originalDescriptor.rawMediaItem,
            cachedMediaItem,
          ].find((item) => item?.video_dash_manifest);
          if (!mediaItem?.video_dash_manifest) return null;

          logger(
            "[Video Dash Stream]",
            "Processing video with DASH manifest, mediaId:",
            descriptor.mediaId,
          );
          const handled = await tryHandleDashFromMediaItem({
            mediaItem,
            username: metadata.username,
            sourceType: resolveOutputOption(
              "outputSourceType",
              context,
              metadata.sourceType,
            ),
            timestamp: resolveOutputOption(
              "outputTimestamp",
              context,
              metadata.timestamp,
            ),
            shortcode: resolveOutputOption(
              "outputShortcode",
              context,
              descriptor.shortcode,
            ),
            isPreview: false,
            index: metadata.index,
            operationOptions: actionOptions.operationOptions,
            throwIfCancelled,
          });
          if (!handled) return null;

          dashResult = handled;
          return {
            directUrl: descriptor.directUrl,
            rawMediaItem: mediaItem,
            dashManifest: mediaItem.video_dash_manifest,
          };
        },
        outputs: {
          download(context) {
            if (fallbackActionHandled) return fallbackActionResult;
            if (dashResult !== undefined) return dashResult;
            notifyActionOutput(context);
            return saveFiles(
              context.url,
              createActionFileOptions(
                context,
                media.MEDIA_INTENT.DOWNLOAD,
              ),
              actionOptions.operationOptions,
            );
          },
          preview(context) {
            if (fallbackActionHandled) return fallbackActionResult;
            notifyActionOutput(context);
            openNewTab(
              context.source === "cache"
                ? context.url
                : actionOptions.replacePreviewHost === false
                  ? context.url
                  : replaceSameOriginHost(context.url),
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
                media.MEDIA_INTENT.THUMBNAIL,
              ),
              actionOptions.operationOptions,
            );
          },
        },
        async onStageError(error, context) {
          if (
            context.stage === media.MEDIA_ACTION_STAGE.MEDIA_API &&
            context.willFallback &&
            actionOptions.markMediaApiFallback &&
            error?.response
          ) {
            state.tempFetchRateLimit = true;
          }
          if (
            context.stage === media.MEDIA_ACTION_STAGE.MEDIA_API &&
            actionOptions.logMediaApiError &&
            error?.response
          ) {
            logger(error.response);
          }
          if (
            context.stage === media.MEDIA_ACTION_STAGE.MEDIA_API &&
            context.willFallback &&
            typeof actionOptions.onMediaApiFallback === "function"
          ) {
            fallbackActionHandled = true;
            fallbackActionResult = await actionOptions.onMediaApiFallback(
              error,
              context,
            );
          }
          if (
            context.stage === media.MEDIA_ACTION_STAGE.MEDIA_API &&
            !context.willFallback &&
            !error?.alreadyReported &&
            !(
              actionOptions.deferMediaApiRequestFailureAlert === true &&
              !error?.response
            )
          ) {
            alert(
              "Fetch failed from Media API. API response message: " +
                error.message,
            );
            error.alreadyReported = true;
          }
        },
      },
      {
        dashBeforeMediaApi: actionOptions.dashBeforeMediaApi === true,
        failOpenOnCacheError: (error) => !isStoryActionAbort(error),
        failOpenOnDashError: (error) => !isStoryActionAbort(error),
        useImageCache: ({ descriptor }) =>
          actionOptions.useImageCache !== false &&
          USER_SETTING.CAPTURE_IMAGE_VIA_MEDIA_CACHE &&
          (descriptor.hasCanonicalMediaId !== false ||
            actionOptions.allowNonCanonicalImageCache === true),
        useMediaApi: ({ descriptor, intent }) =>
          actionOptions.useMediaApi !== false &&
          USER_SETTING.FORCE_RESOURCE_VIA_MEDIA &&
          descriptor.hasCanonicalMediaId !== false &&
          (intent !== media.MEDIA_INTENT.THUMBNAIL ||
            actionOptions.allowMediaApiForThumbnail === true),
        useDash: ({ descriptor, originalDescriptor }) =>
          !fallbackActionHandled &&
          actionOptions.useDash !== false &&
          USER_SETTING.PREFER_DASH_MANIFEST &&
          USER_SETTING.FORCE_RESOURCE_VIA_MEDIA &&
          descriptor.hasCanonicalMediaId !== false &&
          Boolean(
            descriptor.dashManifest ||
              descriptor.rawMediaItem?.video_dash_manifest ||
              originalDescriptor.dashManifest ||
              originalDescriptor.rawMediaItem?.video_dash_manifest ||
              state.GL_mediaDataCache[descriptor.mediaId]?.video_dash_manifest,
          ),
        failOpenOnMediaApiError: (error) =>
          USER_SETTING.FALLBACK_TO_BLOB_FETCH_IF_MEDIA_API_THROTTLED &&
          !error?.alreadyReported &&
          !isStoryActionAbort(error),
      },
    );
  }

  /**
   * Resolve naming context and execute one descriptor without consulting
   * rendered DOM. Batch, preview, thumbnail, and direct handlers all converge
   * here after their compatibility element has been translated once.
   *
   * @param {import("../media/types.js").MediaDescriptor} descriptor
   * @param {String} intent
   * @param {Object} [actionOptions]
   * @param {Number} [actionOptions.defaultTimestamp]
   * @param {{signal?: AbortSignal}} [actionOptions.operationOptions]
   * @param {Boolean} [actionOptions.resolveMissingOwner]
   * @param {Function} [actionOptions.throwIfCancelled]
   * @param {String|Number|null} [actionOptions.uid]
   * @return {Promise<*>}
   */
  async function executeMediaDescriptor(
    descriptor,
    intent,
    actionOptions = {},
  ) {
    actionOptions.throwIfCancelled?.();
    const sourceType =
      descriptor.sourceType ||
      (descriptor.kind === "video" ? "video" : "photo");
    let timestamp = actionOptions.defaultTimestamp ??
      Math.floor(new Date().getTime() / 1000);
    let username = descriptor.owner || state.GL_username;
    const index = descriptor.carouselIndex || 0;

    if (
      !username &&
      descriptor.shortcode &&
      actionOptions.resolveMissingOwner !== false &&
      intent !== media.MEDIA_INTENT.PREVIEW
    ) {
      logger(
        "catching owner name from shortcode:",
        descriptor.directUrl,
      );
      username = await getPostOwner(descriptor.shortcode).catch((err) => {
        logger(
          "get username failed, replace with default string, error message:",
          err.message,
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
      carouselIndex: Math.max(1, Number(descriptor.carouselIndex) || 1),
    };
    const actionService = createLegacyMediaActionService({
      username,
      sourceType,
      timestamp,
      index,
      uid: actionOptions.uid,
    }, actionOptions);
    try {
      actionOptions.throwIfCancelled?.();
      return await actionService.execute(actionDescriptor, intent);
    } catch (error) {
      if (
        actionOptions.swallowMediaApiFailure === true &&
        error?.response
      ) {
        return false;
      }
      throw error;
    }
  }

  /**
   * triggerLinkElement
   * @description Trigger the link element to start downloading the resource.
   *
   * @param  {Object}  element
   * @return {Promise<boolean>}
   */
  async function triggerLinkElement(element, isPreview) {
    try {
      if (!element) {
        throw new Error("Missing link element.");
      }

      return await executeMediaDescriptor(
        getMediaDescriptorForElement(element),
        isPreview ? media.MEDIA_INTENT.PREVIEW : media.MEDIA_INTENT.DOWNLOAD,
        { dashBeforeMediaApi: !isPreview },
      );
    } catch (err) {
      console.error("Occur error in triggerLinkElement:", err);
      logger("Occur error in triggerLinkElement:", err);
      return false;
    }
  }

  /**
   * replaceSameOriginHost
   * @description Replace the host of the URL to bypass the same-origin policy for certain video resources that cannot be downloaded directly.
   *
   * @param  {string}  url
   * @return {string}
   */
  function replaceSameOriginHost(url) {
    // replace https://instagram.ftpe8-2.fna.fbcdn.net/ to https://scontent.cdninstagram.com/ becase of same origin policy (some video)
    var urlObj = new URL(url);
    urlObj.host = "scontent.cdninstagram.com";

    return urlObj.href;
  }

  /**
   * checkingScriptUpdate
   * @description Check if there is a new version of the script and push notification.
   *
   * @param  {Integer}  interval
   * @return {void}
   */
  function mountUpdateCheckService() {
    if (activeApplicationScope && !activeApplicationScope.disposed) {
      updateCheckService.mount(activeApplicationScope);
    }
  }

  function checkingScriptUpdate(interval) {
    mountUpdateCheckService();
    updateCheckService.checkIfDue(
      interval,
      USER_SETTING.CHECK_FOR_UPDATE,
    );
  }

  /**
   * callNotification
   * @description Call desktop notification by browser.
   *
   * @return {void}
   */
  function callNotification() {
    mountUpdateCheckService();
    return updateCheckService.notifyIfUpdateAvailable();
  }

  /**
   * openNewTab
   * @description Open URL in new tab.
   *
   * @param  {String}  link
   * @return {void}
   */
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

  /**
   * reloadScript
   * @description Re-register main timer.
   *
   * @return {void}
   */
  function reloadScript() {
    const reloadChange = { reason: "manual-reload", type: "reload" };
    pendingMaximumReelReloadHandoff =
      maximumReelPlaybackController.relinquish("manual-reload");
    state.firstStarted = false;
    state.currentURL = location.href;
    const reloadHandoff = pendingMaximumReelReloadHandoff;
    try {
      applicationCoordinator.reload(reloadChange.reason);
    } finally {
      if (
        reloadHandoff &&
        pendingMaximumReelReloadHandoff === reloadHandoff
      ) {
        pendingMaximumReelReloadHandoff = null;
        reloadHandoff.cancel("application-reload-failed");
      }
    }
    // Global services mount before the route coordinator. Rescan only after
    // reload() has installed the new route scope so retained Story listeners
    // are synchronously rebound without waiting for another DOM mutation.
    applicationDomLifecycleService.refresh(reloadChange);

    logger("main timer re-register completed");
  }

  /**
   * logger
   * @description Event record.
   *
   * @return {void}
   */
  function logger(...messages) {
    var dd = new Date();
    state.GL_logger.push({
      time: dd.getTime(),
      content: [...messages],
    });

    if (state.GL_logger.length > 1000) {
      state.GL_logger = [
        {
          time: dd.getTime(),
          content: ["logger sliced"],
        },
        ...state.GL_logger.slice(-999),
      ];
    }

    if (ENABLE_CONSOLE_LOGGING) {
      console.log(`[${dd.toISOString()}]`, ...messages);
    }
  }

  /**
   * initSettings
   * @description Initialize preferences.
   *
   * @return {void}
   */
  function initSettings() {
    Object.assign(USER_SETTING, settingsStore.load());

    if (
      settingsStore.wasLoadedFromStorage("MODIFY_VIDEO_VOLUME") &&
      USER_SETTING.MODIFY_VIDEO_VOLUME !== true
    ) {
      state.videoVolume = 1;
    }
  }

  /**
   * toggleVolumeSilder
   * @description Toggle display of custom volume slider.
   *
   * @param  {Function|object}  resolveVideos
   * @param  {object}  $buttonParent
   * @param  {string}  loggerType
   * @param  {string}  customClass
   * @return {void}
   */
  function toggleVolumeSilder(
    resolveVideos,
    $buttonParent,
    loggerType,
    customClass = "",
  ) {
    const controller = getRouteVideoVolumeSliderController();
    if (!controller) return;

    const liveVideoLocator =
      typeof resolveVideos === "function"
        ? resolveVideos
        : () => resolveVideos?.get?.() || resolveVideos;
    controller.toggle({
      host: $buttonParent.first()[0],
      resolveVideos: liveVideoLocator,
      loggerType,
      customClass,
    });
  }

  function toggleStoryVolumeSilder($video, storyType) {
    const $host = $video
      .parents("div[style][class]")
      .filter(function () {
        return $(this).width() == $video.width();
      })
      .first();
    toggleVolumeSilder(
      () => $host.find("video").get(),
      $host,
      storyType,
      "vertical",
    );
  }

  /**
   * @description Trigger React onClick event handler for the given element.
   * @param {HTMLElement} el
   */
  function triggerReactClickHandler(el) {
    const reactKey = Object.keys(el).find(
      (k) =>
        k.startsWith("__reactProps") || k.startsWith("__reactEventHandlers"),
    );
    const props = el[reactKey];

    if (props && typeof props.onClick === "function") {
      const mockEvent = {
        target: el,
        currentTarget: el,
        preventDefault: () => {},
        stopPropagation: () => {},
        nativeEvent: new MouseEvent("click"),
      };

      props.onClick(mockEvent);
    } else {
      logger("No React click handler found for the element:", el);
    }
  }

  /**
   * updatePopupSelectionSummary
   * @description Update selection summary in popup dialog.
   *
   * @param {string|JQuery} root
   * @return {void}
   */
  function updatePopupSelectionSummary(root = ".IG_POPUP_DIG") {
    const $root = typeof root === "string" ? $(root) : root;
    if (!$root || $root.length === 0) return;

    const $titleCheckbox = $root.find(".IG_POPUP_DIG_TITLE .checkbox");
    const $countSpan = $titleCheckbox.find(".item-count");
    if ($titleCheckbox.length === 0 || $countSpan.length === 0) return;

    const $items = $root.find(".IG_POPUP_DIG_BODY .inner_box");
    const total = $items.length;
    const selected = $items.filter(":checked").length;

    $titleCheckbox
      .find("input")
      .prop("checked", total > 0 && selected === total);

    const formatCount = (count, singularKey, pluralKey) => {
      const key = count === 1 ? singularKey : pluralKey;
      const template = _i18n(key);
      return typeof template === "string"
        ? template.replace("%COUNT%", count)
        : String(count);
    };

    const totalLabel = formatCount(
      total,
      "ITEM_COUNT_SINGULAR",
      "ITEM_COUNT_PLURAL",
    );
    const selectedLabel = formatCount(
      selected,
      "SELECTED_COUNT_SINGULAR",
      "SELECTED_COUNT_PLURAL",
    );

    $countSpan.text(` (${selectedLabel} / ${totalLabel})`);
  }

  /**
   * IG_createDM
   * @description A dialog showing a list of all media files in the post.
   *
   * @param  {Boolean}  hasHidden
   * @param  {Boolean}  hasCheckbox
   * @param  {Boolean}  routeOwned
   * @return {void}
   */
  function IG_createDM(
    hasHidden = false,
    hasCheckbox = false,
    routeOwned = false,
  ) {
    const dialogClasses = ["IG_POPUP_DIG"];
    if (hasHidden) dialogClasses.push("hidden");
    if (hasCheckbox) dialogClasses.push("IG_POPUP_DIG_MEDIA");
    if (routeOwned) dialogClasses.push("IG_POPUP_DIG_ROUTE");

    $("body").append(
      `<div class="${dialogClasses.join(" ")}"><div class="IG_POPUP_DIG_BG"></div><div class="IG_POPUP_DIG_MAIN"><div class="IG_POPUP_DIG_TITLE"></div><div class="IG_POPUP_DIG_BODY"></div></div></div>`,
    );
    $(".IG_POPUP_DIG .IG_POPUP_DIG_MAIN .IG_POPUP_DIG_TITLE").append(
      `<div class="insta-loader-dialog-header"><div><div class="insta-loader-dialog-brand">${SCRIPT_NAME} <span>${GM_info.script.version}</span></div><div id="post_info">Post ID: <span id="article-id"></span></div></div><div class="insta-loader-dialog-shortcut"><kbd>${getPlatformModifierKey()}</kbd>+<kbd>Q</kbd> <span data-ih-locale="CLOSE">${_i18nHTML("CLOSE")}</span></div><div class="IG_POPUP_DIG_BTN">${SVG.CLOSE}</div></div>`,
    );

    if (hasCheckbox) {
      $(".IG_POPUP_DIG .IG_POPUP_DIG_MAIN .IG_POPUP_DIG_TITLE").append(
        '<div id="button_group"></div>',
      );
      $(
        ".IG_POPUP_DIG .IG_POPUP_DIG_MAIN .IG_POPUP_DIG_TITLE > div#button_group",
      ).append(
        `<button id="batch_download_selected" data-ih-locale="BATCH_DOWNLOAD_SELECTED">${_i18nHTML("BATCH_DOWNLOAD_SELECTED")}</button>`,
      );
      $(
        ".IG_POPUP_DIG .IG_POPUP_DIG_MAIN .IG_POPUP_DIG_TITLE > div#button_group",
      ).append(
        `<button id="batch_download_direct" data-ih-locale="BATCH_DOWNLOAD_DIRECT">${_i18nHTML("BATCH_DOWNLOAD_DIRECT")}</button>`,
      );
      $(".IG_POPUP_DIG .IG_POPUP_DIG_MAIN .IG_POPUP_DIG_TITLE").append(
        `<label class="checkbox"><input value="yes" type="checkbox" /><span data-ih-locale="ALL_CHECK">${_i18nHTML("ALL_CHECK")}</span><span class="item-count"></span></label>`,
      );
    }
  }

  /**
   * IG_setDM
   * @description Set a dialog status.
   *
   * @param  {Boolean}  hasHidden
   * @return {void}
   */
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

  /**
   * purgeCache
   * @description Purge image cache entries older than 12 hours.
   *
   * @return {void}
   */
  function purgeCache() {
    imageCache.purge();
  }

  /**
   * mediaIdFromURL
   * @description Decode mediaId from ig_cache_key parameter that Instagram includes in the URL.
   *
   * @param  {string}  url
   * @return {?string}
   */
  function mediaIdFromURL(url) {
    return imageCache.decodeMediaId(url);
  }

  /**
   * putInCache
   * @description Save URL to image cache.
   *
   * @param  {string}  mediaId
   * @param  {string}  url
   * @return {void}
   */
  function putInCache(mediaId, url) {
    imageCache.put(mediaId, url);
  }

  /**
   * getImageFromCache
   * @description Read image URL from cache; returns null if not found or expired.
   *
   * @param  {string}  mediaId
   * @return {?string}
   */
  function getImageFromCache(mediaId) {
    return imageCache.get(mediaId);
  }

  /**
   * registerPerformanceObserver
   * @description Register performance observer to document, captures any loaded image resource.
   *
   * @return {*|null}
   */
  function registerPerformanceObserver() {
    return registerImageCachePerformanceObserver({
      PerformanceObserver: environment.window.PerformanceObserver,
      cache: {
        decodeMediaId: mediaIdFromURL,
        has: (mediaId) => Boolean(state.GL_imageCache[mediaId]),
        put: putInCache,
      },
      enabled: () => USER_SETTING.CAPTURE_IMAGE_VIA_MEDIA_CACHE,
      onError: (err) => {
        logger(
          "registerPerformanceObserver()",
          "disabled",
          err?.message || err,
        );
      },
    });
  }

  /**
   * translateText
   * @description i18n translation text.
   *
   * @return {void}
   */
  function translateText() {
    if (translationTextCache != null) {
      return translationTextCache;
    }

    var eLocale = {
      "en-US": {
        NOTICE_UPDATE_TITLE: "New version released.",
        NOTICE_UPDATE_CONTENT:
          "insta-loader has released a new version, click here to update.",
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
        RENAME_PUBLISH_DATE:
          "Set Renamed File Timestamp to Resource Publish Date",
        RENAME_LOCATE_DATE:
          "Modify Renamed File Timestamp Date Format (Right-Click to Set)",
        DISABLE_VIDEO_LOOPING: "Disable Video Auto-looping",
        HTML5_VIDEO_CONTROL: "Display HTML5 Video Controller",
        MAX_REEL_PLAYBACK_QUALITY:
          "Play Standalone Reels at Maximum Quality",
        REDIRECT_CLICK_USER_STORY_PICTURE:
          "Redirect When Clicking on User's Story Picture",
        FORCE_FETCH_ALL_RESOURCES: "Force Fetch All Resources in the Post",
        DIRECT_DOWNLOAD_VISIBLE_RESOURCE:
          "Directly Download the Visible Resources in the Post",
        DIRECT_DOWNLOAD_ALL: "Directly Download All Resources in the Post",
        DIRECT_DOWNLOAD_STORY:
          "Directly Download All Resources in the Story/Highlight",
        MODIFY_VIDEO_VOLUME: "Modify Video Volume (Right-Click to Set)",
        MODIFY_RESOURCE_EXIF: "Modify Resource EXIF Properties",
        SCROLL_BUTTON: "Enable Scroll Buttons for Reels Page",
        FORCE_RESOURCE_VIA_MEDIA: "Force Fetch Resource via Media API",
        PREFER_DASH_MANIFEST:
          "Prefer DASH Manifest (Higher-Quality Video via Media API)",
        FALLBACK_TO_BLOB_FETCH_IF_MEDIA_API_THROTTLED:
          "Use Alternative Methods to Download When the Media API is Not Accessible",
        NEW_TAB_ALWAYS_FORCE_MEDIA_IN_POST:
          "Always Use Media API for [Open in New Tab] in Posts",
        SKIP_VIEW_STORY_CONFIRM:
          "Skip the Confirmation Page for Viewing a Story/Highlight",
        SKIP_SHARED_WITH_YOU_DIALOG:
          'Skip "shared this with you" dialog on shared profile links',
        CAPTURE_IMAGE_VIA_MEDIA_CACHE:
          "Capture Image Resource Using Media Cache",
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
          "Example: instagram_321565527_679025940443063_4318007696887450953_n.jpg",
        ],
        RENAME_PUBLISH_DATE_INTRO:
          "Sets the timestamp in the file rename format to the resource publish date (browser time zone).\n\nThis feature only works when [Automatically Rename Files] is set to TRUE.",
        RENAME_LOCATE_DATE_INTRO:
          "Modify the renamed file timestamp date format to the browser's local time, and format it to your preferred regional date format.\n\nThis feature only works when [Automatically Rename Files] is set to TRUE.",
        DISABLE_VIDEO_LOOPING_INTRO:
          "Disable video auto-looping in Reels and posts.",
        HTML5_VIDEO_CONTROL_INTRO:
          "Display the HTML5 video controller in video resource.\n\nThis will hide the custom video volume slider and replace it with the HTML5 controller. The HTML5 controller can be hidden by right-clicking on the video to reveal the original details.",
        MAX_REEL_PLAYBACK_QUALITY_INTRO:
          "On standalone /reel/ pages, hold the active Reel's poster for up to five seconds while loading the highest-resolution complete progressive MP4 reported by Instagram. The scrolling /reels/ feed stays on Instagram's native player because it recycles video elements. This uses more bandwidth and a private metadata request. Native playback resumes if the request is throttled, fails, times out, or Safari rejects the source. DASH downloads are separate and may provide a higher-resolution saved file.",
        REDIRECT_CLICK_USER_STORY_PICTURE_INTRO:
          "Redirect to a user's profile page when right-clicking on their avatar in the story area on the homepage.\nIf you use the middle mouse button to click, it will open in a new tab.",
        FORCE_FETCH_ALL_RESOURCES_INTRO:
          "Force fetching of all resources (photos and videos) in a post via the Instagram API to remove the limit of three resources per post.",
        DIRECT_DOWNLOAD_VISIBLE_RESOURCE_INTRO:
          "Directly download the current resources available in the post.",
        DIRECT_DOWNLOAD_ALL_INTRO:
          "When you click the download button, all resources in the post will be forcibly fetched and downloaded.",
        MODIFY_VIDEO_VOLUME_INTRO:
          "Modify the video playback volume in Reels and posts (right-click to open the volume setting slider).",
        SCROLL_BUTTON_INTRO:
          "Enable scroll buttons for the lower right corner of the Reels page.",
        FORCE_RESOURCE_VIA_MEDIA_INTRO:
          "The Media API will try to get the highest quality photo or video possible, but it may take longer to load.",
        PREFER_DASH_MANIFEST_INTRO:
          "Prefer the DASH manifest for video resources via the Media API. If a DASH manifest is available, it will download the video and audio streams SEPARATELY for the best possible quality.",
        FALLBACK_TO_BLOB_FETCH_IF_MEDIA_API_THROTTLED_INTRO:
          "When the Media API reaches its rate limit or cannot be used for other reasons, the Forced Fetch API will be used to download resources (the resource quality may be slightly lower).",
        NEW_TAB_ALWAYS_FORCE_MEDIA_IN_POST_INTRO:
          "The [Open in New Tab] button in posts will always use the Media API to obtain high-resolution resources.",
        CHECK_FOR_UPDATE_INTRO:
          "Check for updates when the script is triggered (check every 300 seconds).\nUpdate notifications will be sent as desktop notifications through the browser.",
        SKIP_VIEW_STORY_CONFIRM_INTRO:
          "Automatically skip when confirmation page is shown in story or highlight.",
        SKIP_SHARED_WITH_YOU_DIALOG_INTRO:
          'Automatically click "Not now" on the "X shared this with you" dialog when opening any ?igsh= links.',
        MODIFY_RESOURCE_EXIF_INTRO:
          "Modify the EXIF attribute of the image resource to include metadata such as post link, shooting date, and author.",
        DIRECT_DOWNLOAD_STORY_INTRO:
          "When you click [Download All Resources], all stories/highlights are downloaded directly, without showing the image selection dialog.",
        CAPTURE_IMAGE_VIA_MEDIA_CACHE_INTRO:
          "Use a watcher to capture any high-quality image URLs in the DOM tree into the script's storage so that they can be extracted when available and upon user input.",
        HOTKEY_DEBUG_KEY: "Debug Window",
        HOTKEY_SETTINGS_KEY: "Preference Settings",
        HOTKEY_KEY_SETTINGS_KEY: "Hotkey Settings",
        HOTKEY_DOWNLOAD_STORY_KEY: "Download Story",
        HOTKEY_CONFLICT_WARNING:
          "This hotkey may conflict with other settings.",
        HOTKEY_RESET: "Reset",
      },
    };

    var resultUnsorted = Object.assign({}, eLocale);
    Object.entries(state.locale).forEach(([lang, translations]) => {
      resultUnsorted[lang] = Object.assign(
        {},
        resultUnsorted[lang] || {},
        translations,
      );
    });
    var resultSorted = Object.keys(resultUnsorted)
      .sort()
      .reduce((obj, key) => {
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

  /**
   * getTranslationText
   * @description i18n translation text.
   *
   * @param  {String}  lang
   * @return {Object}
   */
  async function getTranslationText(lang) {
    return localization.loadTranslationDictionary(lang, (url) =>
      // Locale selection is application state. A route transition must not
      // abort this request and cache the English fallback under another
      // language code.
      ownApplicationRequest(
        startJsonRequest({ url, detectApiErrors: false }),
      ).catch((err) => {
        logger("getTranslationText()", "reject", err);
        throw err;
      }),
    );
  }

  /**
   * _i18n
   * @description Perform i18n translation.
   *
   * @param  {String}  text
   * @return {void}
   */
  function _i18n(text) {
    const translate = translateText();

    if (
      translate[state.lang] != undefined &&
      translate[state.lang][text] != undefined
    ) {
      return translate[state.lang][text];
    } else {
      return translate["en-US"][text];
    }
  }

  /**
   * Escape a translation only when it must pass through legacy HTML-string
   * construction. Ordinary alerts, attributes set through DOM APIs, and
   * menu labels continue to receive the exact untranslated string.
   *
   * @param {String} text
   * @return {String}
   */
  function _i18nHTML(text) {
    return String(_i18n(text) ?? "").replace(
      /[&<>"']/g,
      (character) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[character],
    );
  }

  /**
   * repaintingTranslations
   * @description Perform i18n translation.
   *
   * @return {void}
   */
  function repaintingTranslations() {
    localization.applyTranslations(document, _i18n);
  }

  /* register all events */

  function mountApplicationEventHandlers(applicationScope) {
    const register = function () {
      if (!applicationScope.disposed) {
        registerApplicationEventHandlers(applicationScope);
      }
    };

    if (document.readyState === "loading") {
      applicationScope.listen(document, "DOMContentLoaded", register, {
        once: true,
      });
    } else {
      register();
    }
  }

  function registerApplicationEventHandlers(applicationScope) {
    if (!applicationScope || applicationScope.disposed) return;

    function listenApplicationJQuery(
      target,
      events,
      selectorOrHandler,
      handler,
    ) {
      return applicationScope.listenJQuery(
        target,
        events,
        selectorOrHandler,
        handler,
      );
    }

    // Close the download dialog if user click the close icon
    listenApplicationJQuery(
      $("body"),
      "click",
      ".IG_POPUP_DIG_BTN, .IG_POPUP_DIG_BG",
      function () {
        if ($(this).parent("#tempWrapper").length > 0) {
          $(this)
            .parent("#tempWrapper")
            .fadeOut(250, function () {
              $(this).remove();
            });
        } else {
          $(".IG_POPUP_DIG").remove();
        }
      },
    );

    listenApplicationJQuery(
      $("body"),
      "click",
      'a[data-needed="direct"]',
      async function (e) {
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
          "triggerLinkElement()",
        );
      },
    );

    listenApplicationJQuery(
      $("body"),
      "click",
      ".IG_POPUP_DIG_BODY .newTab",
      async function (e) {
        consumeInjectedClick(e);
        const $linkElement = $(this).parent().children("a").first();
        const linkElement = $linkElement[0];

        if (
          USER_SETTING.FORCE_RESOURCE_VIA_MEDIA &&
          USER_SETTING.NEW_TAB_ALWAYS_FORCE_MEDIA_IN_POST
        ) {
          if (!linkElement) {
            console.error("Cannot find popup new-tab link element.");
            alert("Cannot find open tab URL.");
            return;
          }
          await fireAndReport(
            () => triggerLinkElement(linkElement, true),
            "triggerLinkElement()",
          );
        } else {
          if (!linkElement) {
            console.error("Cannot find popup new-tab data-href.", {
              linkElement: $linkElement.get(0),
            });
            alert("Cannot find open tab URL.");
            return;
          }
          await fireAndReport(
            () =>
              executeMediaDescriptor(
                getMediaDescriptorForElement(linkElement),
                media.MEDIA_INTENT.PREVIEW,
                { useMediaApi: false },
              ),
            "executeMediaDescriptor()",
          );
        }
      },
    );

    listenApplicationJQuery(
      $("body"),
      "click",
      ".IG_POPUP_DIG_BODY .videoThumbnail",
      async function (e) {
        consumeInjectedClick(e);
        const linkElement = $(this).parent().children("a").first()[0];
        if (!linkElement) return false;
        const descriptor = getMediaDescriptorForElement(linkElement);
        return await fireAndReport(
          () =>
            executeMediaDescriptor(
              {
                ...descriptor,
                shortcode: descriptor.shortcode ?? $("#article-id").text(),
              },
              media.MEDIA_INTENT.THUMBNAIL,
              { useMediaApi: false },
            ),
          "executeMediaDescriptor()",
        );
      },
    );

    // Running if user left-click download icon in stories
    listenApplicationJQuery($("body"), "click", ".IG_DWSTORY", function (e) {
      consumeInjectedClick(e);
      return runStorySurfaceAction(
        (actionLifecycle) =>
          onStory(true, undefined, undefined, actionLifecycle),
        "onStory()",
      );
    });

    // Running if user left-click all download icon in stories
    listenApplicationJQuery($("body"), "click", ".IG_DWSTORY_ALL", function (e) {
      consumeInjectedClick(e);
      return runStorySurfaceAction(
        (actionLifecycle) => onStoryAll(actionLifecycle),
        "onStoryAll()",
      );
    });

    // Running if user left-click 'open in new tab' icon in stories
    listenApplicationJQuery($("body"), "click", ".IG_DWNEWTAB", function (e) {
      consumeInjectedClick(e);
      return runStorySurfaceAction(
        (actionLifecycle) => onStory(true, true, true, actionLifecycle),
        "onStory()",
      );
    });

    // Running if user left-click download thumbnail icon in stories
    listenApplicationJQuery(
      $("body"),
      "click",
      ".IG_DWSTORY_THUMBNAIL",
      function (e) {
        consumeInjectedClick(e);
        return runStorySurfaceAction(
          (actionLifecycle) =>
            onStoryThumbnail(true, undefined, actionLifecycle),
          "onStoryThumbnail()",
        );
      },
    );

    // Running if user left-click download icon in highlight stories
    listenApplicationJQuery($("body"), "click", ".IG_DWHISTORY", function (e) {
      consumeInjectedClick(e);
      return runStorySurfaceAction(
        (actionLifecycle) =>
          onHighlightsStory(true, undefined, actionLifecycle),
        "onHighlightsStory()",
      );
    });

    // Running if user left-click all download icon in highlight stories
    listenApplicationJQuery(
      $("body"),
      "click",
      ".IG_DWHISTORY_ALL",
      function (e) {
        consumeInjectedClick(e);
        return runStorySurfaceAction(
          (actionLifecycle) => onHighlightsStoryAll(actionLifecycle),
          "onHighlightsStoryAll()",
        );
      },
    );

    // Running if user left-click 'open in new tab' icon in highlight stories
    listenApplicationJQuery($("body"), "click", ".IG_DWHINEWTAB", function (e) {
      consumeInjectedClick(e);
      return runStorySurfaceAction(
        (actionLifecycle) =>
          onHighlightsStory(true, true, actionLifecycle),
        "onHighlightsStory()",
      );
    });

    // Running if user left-click thumbnail download icon in highlight stories
    listenApplicationJQuery(
      $("body"),
      "click",
      ".IG_DWHISTORY_THUMBNAIL",
      function (e) {
        consumeInjectedClick(e);
        return runStorySurfaceAction(
          (actionLifecycle) =>
            onHighlightsStoryThumbnail(true, actionLifecycle),
          "onHighlightsStoryThumbnail()",
        );
      },
    );

    // Running if user left-click download icon in reels
    listenApplicationJQuery($("body"), "click", ".IG_REELS", function () {
      fireAndReport(() => onReels(true, true), "onReels()");
    });

    // Running if user left-click newtab icon in reels
    listenApplicationJQuery(
      $("body"),
      "click",
      ".IG_REELS_NEWTAB",
      function () {
        fireAndReport(() => onReels(true, true, true), "onReels()");
      },
    );

    // Running if user left-click download icon in reels
    listenApplicationJQuery(
      $("body"),
      "click",
      ".IG_REELS_THUMBNAIL",
      function () {
        fireAndReport(() => onReels(true, false), "onReels()");
      },
    );

    // Running if user right-click profile picture in stories area
    listenApplicationJQuery(
      $("body"),
      "mousedown",
      'button[role="menuitem"], div[role="menuitem"], ul > li[tabindex="-1"] > div[role="button"]',
      function (e) {
        // Right-Click || Middle-Click
        if (e.which === 3 || e.which === 2) {
          if (
            location.href === "https://www.instagram.com/" &&
            USER_SETTING.REDIRECT_CLICK_USER_STORY_PICTURE
          ) {
            e.preventDefault();

            $(this)
              .find("img")
              .each(function () {
                bindStoryPictureContextMenu(this, applicationScope);
              });

            if ($(this).find("canvas._aarh, canvas + span > img").length > 0) {
              const targetUrl =
                "https://www.instagram.com/" +
                $(this).children("div").last().text();
              if (e.which === 2) {
                GM_openInTab(targetUrl);
              } else {
                location.href = targetUrl;
              }
            }
          }
        }
      },
    );

    listenApplicationJQuery(
      $("body"),
      "change",
      ".IG_POPUP_DIG_TITLE .checkbox",
      function () {
        const isChecked = $(this).find("input").prop("checked");
        $(".IG_POPUP_DIG_BODY .inner_box").each(function () {
          $(this).prop("checked", isChecked);
        });
        updatePopupSelectionSummary();
      },
    );

    listenApplicationJQuery(
      $("body"),
      "change",
      ".IG_POPUP_DIG_BODY .inner_box",
      function () {
        updatePopupSelectionSummary();
      },
    );

    listenApplicationJQuery(
      $("body"),
      "click",
      ".IG_POPUP_DIG_TITLE #batch_download_selected",
      async function (e) {
        consumeInjectedClick(e);
        const selectedElements = [];
        $('.IG_POPUP_DIG_BODY a[data-needed="direct"]').each(function () {
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
            "batchDownloadPostFiles()",
          );
        }
      },
    );

    listenApplicationJQuery(
      $("body"),
      "click",
      ".IG_POPUP_DIG_TITLE #batch_download_direct",
      async function (e) {
        consumeInjectedClick(e);
        const descriptors = getMediaDescriptorsForElements(
          $('.IG_POPUP_DIG_BODY a[data-needed="direct"]'),
        );

        await fireAndReport(
          () => batchDownloadPostDescriptors(descriptors),
          "batchDownloadPostFiles()",
        );
      },
    );
  }
}
