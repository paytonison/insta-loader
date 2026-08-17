import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

import { JSDOM } from "jsdom";
import { vi } from "vitest";

const require = createRequire(import.meta.url);
const userscriptPath = new URL("../../../insta-loader.user.js", import.meta.url);
const userscriptSource = readFileSync(userscriptPath, "utf8");
const jquerySource = readFileSync(require.resolve("jquery"), "utf8");

const defaultDocument = `<!doctype html>
<html style="display:block;visibility:visible;opacity:1">
  <head>
    <script type="application/json">{"APP_ID":"936619743392459"}</script>
  </head>
  <body style="display:block;visibility:visible;opacity:1">
    <div id="mount_0"></div>
  </body>
</html>`;

const defaultLocaleManifest = {
  "en-US": "English",
  "es-ES": "Español",
};

function createManualClock(window, missingApis = new Set()) {
  let nextId = 1;
  let now = 0;
  const tasks = new Map();

  function schedule(kind, callback, delay, args) {
    const id = nextId++;
    tasks.set(id, {
      args,
      callback,
      delay: Number(delay) || 0,
      due: now + Math.max(0, Number(delay) || 0),
      id,
      kind,
    });
    return id;
  }

  window.setTimeout = (callback, delay, ...args) =>
    schedule("timeout", callback, delay, args);
  window.setInterval = (callback, delay, ...args) =>
    schedule("interval", callback, delay, args);
  window.clearTimeout = (id) => tasks.delete(id);
  window.clearInterval = (id) => tasks.delete(id);
  window.requestAnimationFrame = (callback) =>
    schedule("animation-frame", callback, 16, []);
  window.cancelAnimationFrame = (id) => tasks.delete(id);
  if (!missingApis.has("requestIdleCallback")) {
    window.requestIdleCallback = (callback, options = {}) =>
      schedule(
        "idle-callback",
        callback,
        Math.min(Number(options.timeout) || 1, 1),
        [],
      );
    window.cancelIdleCallback = (id) => tasks.delete(id);
  }

  function invoke(task) {
    if (!tasks.has(task.id)) return;
    if (task.kind !== "interval") tasks.delete(task.id);

    if (task.kind === "animation-frame") {
      task.callback(now);
    } else if (task.kind === "idle-callback") {
      task.callback({
        didTimeout: false,
        timeRemaining: () => 50,
      });
    } else {
      task.callback(...task.args);
    }

    if (task.kind === "interval" && tasks.has(task.id)) {
      task.due = now + Math.max(1, task.delay);
      tasks.set(task.id, task);
    }
  }

  function runDue(maxDelay = 0, limit = 100) {
    const target = now + Math.max(0, Number(maxDelay) || 0);
    let runs = 0;

    while (runs < limit) {
      const next = [...tasks.values()]
        .filter((task) => task.kind !== "interval" && task.due <= target)
        .sort((a, b) => a.due - b.due || a.id - b.id)[0];
      if (!next) break;
      now = next.due;
      invoke(next);
      runs += 1;
    }

    now = target;
    if (runs === limit) {
      throw new Error(`Manual clock exceeded its ${limit}-callback safety limit.`);
    }
    return runs;
  }

  function runIntervalsOnce() {
    const intervals = [...tasks.values()]
      .filter((task) => task.kind === "interval")
      .sort((a, b) => a.id - b.id);
    intervals.forEach(invoke);
    return intervals.length;
  }

  return {
    pending: () => [...tasks.values()],
    runDue,
    runIntervalsOnce,
  };
}

function createObserverHarness() {
  const mutationObservers = [];
  const intersectionObservers = [];
  const performanceObservers = [];

  class MockMutationObserver {
    constructor(callback) {
      this.callback = callback;
      this.disconnected = false;
      this.observations = [];
      mutationObservers.push(this);
    }

    observe(target, options) {
      this.observations.push({ options, target });
    }

    disconnect() {
      this.disconnected = true;
      this.observations = [];
    }

    takeRecords() {
      return [];
    }

    emit(records) {
      this.callback(records, this);
    }
  }

  class MockIntersectionObserver {
    constructor(callback, options) {
      this.callback = callback;
      this.options = options;
      this.targets = new Set();
      intersectionObservers.push(this);
    }

    observe(target) {
      this.targets.add(target);
    }

    unobserve(target) {
      this.targets.delete(target);
    }

    disconnect() {
      this.targets.clear();
    }

    takeRecords() {
      return [];
    }

    emit(entries) {
      this.callback(entries, this);
    }
  }

  class MockPerformanceObserver {
    static supportedEntryTypes = ["resource"];

    constructor(callback) {
      this.callback = callback;
      this.observations = [];
      performanceObservers.push(this);
    }

    observe(options) {
      this.observations.push(options);
    }

    disconnect() {
      this.observations = [];
    }

    takeRecords() {
      return [];
    }
  }

  return {
    intersectionObservers,
    MockIntersectionObserver,
    MockMutationObserver,
    MockPerformanceObserver,
    mutationObservers,
    performanceObservers,
  };
}

function createMediabunnyMock() {
  class InertClass {
    constructor(options = {}) {
      Object.assign(this, options);
    }
  }

  return {
    BufferSource: InertClass,
    BufferTarget: InertClass,
    EncodedAudioPacketSource: InertClass,
    EncodedPacketSink: InertClass,
    EncodedVideoPacketSource: InertClass,
    Input: InertClass,
    MP4: {},
    Mp4OutputFormat: InertClass,
    Output: InertClass,
  };
}

function normalizeNetworkResponse(request, response) {
  const normalized =
    typeof response === "function" ? response(request) : response || {};
  const body = normalized.body ?? normalized.response ?? {};

  return {
    finalUrl: normalized.finalUrl || request.url,
    response: typeof body === "string" ? body : JSON.stringify(body),
    responseText: typeof body === "string" ? body : JSON.stringify(body),
    status: normalized.status ?? 200,
    ...normalized,
  };
}

function matchesRoute(route, request) {
  if (typeof route.match === "function") return route.match(request);
  if (route.match instanceof RegExp) return route.match.test(request.url);
  return String(request.url).includes(String(route.match));
}

async function flushMicrotasks(rounds = 6) {
  for (let i = 0; i < rounds; i += 1) {
    await Promise.resolve();
  }
}

/**
 * Evaluate the committed userscript artifact in an isolated browser realm.
 * Every runtime owns its timers, observers, storage, network, and DOM.
 */
export async function createUserscriptRuntime(options = {}) {
  const dom = new JSDOM(options.html || defaultDocument, {
    pretendToBeVisual: true,
    runScripts: "outside-only",
    url: options.url || "https://www.instagram.com/",
  });
  const { window } = dom;
  const missingApis = new Set(options.missingApis || []);
  const clock = createManualClock(window, missingApis);
  const observers = createObserverHarness();
  const storage = new Map(Object.entries(options.storage || {}));
  const abortedRequests = [];
  const abortedDownloads = [];
  const deferredRequests = [];
  const requests = [];
  const fetchRequests = [];
  const abortedFetchRequests = [];
  const downloads = [];
  const styles = [];
  const menuCommands = new Map();
  const unregisteredMenuIds = [];
  const storageReads = [];
  const storageWrites = [];
  const openedTabs = [];
  const anchorClicks = [];
  const alerts = [];
  const mediaActions = [];
  let nextMenuId = 1;

  Object.defineProperty(window.navigator, "language", {
    configurable: true,
    value: options.language || "en-US",
  });
  Object.defineProperty(window.navigator, "userLanguage", {
    configurable: true,
    value: options.language || "en-US",
  });
  Object.defineProperty(window.navigator, "userAgent", {
    configurable: true,
    value:
      options.userAgent ||
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.6 Safari/605.1.15",
  });
  Object.defineProperty(window.document, "hidden", {
    configurable: true,
    value: false,
  });
  Object.defineProperty(window.document, "visibilityState", {
    configurable: true,
    value: "visible",
  });

  window.MutationObserver = observers.MockMutationObserver;
  window.IntersectionObserver = missingApis.has("IntersectionObserver")
    ? undefined
    : observers.MockIntersectionObserver;
  window.PerformanceObserver = observers.MockPerformanceObserver;
  window.Mediabunny = createMediabunnyMock();

  window.alert = vi.fn((message) => alerts.push(String(message)));
  window.fetch = vi.fn((url, fetchOptions = {}) => {
    const request = {
      ...fetchOptions,
      headers: fetchOptions.headers || {},
      url: String(url),
    };
    fetchRequests.push(request);
    const route = (options.fetchNetwork || []).find((candidate) =>
      matchesRoute(candidate, request),
    );
    const response = normalizeNetworkResponse(
      request,
      route?.response || options.defaultFetchResponse || { body: {} },
    );

    if (response.defer === true) {
      return new Promise((_resolve, reject) => {
        fetchOptions.signal?.addEventListener(
          "abort",
          () => {
            abortedFetchRequests.push(request);
            reject(new window.DOMException("The operation was aborted.", "AbortError"));
          },
          { once: true },
        );
      });
    }

    return Promise.resolve({
      arrayBuffer: async () => new ArrayBuffer(0),
      blob: async () =>
        new window.Blob([], { type: "application/octet-stream" }),
      ok: response.status >= 200 && response.status < 300,
      status: response.status,
      text: async () => response.responseText,
      url: response.finalUrl,
    });
  });
  window.URL.createObjectURL = vi.fn(() => "blob:https://www.instagram.com/fixture");
  window.URL.revokeObjectURL = vi.fn();
  window.document.execCommand = vi.fn(() => true);

  const mediaPrototype = window.HTMLMediaElement.prototype;
  const mediaSrcDescriptor = Object.getOwnPropertyDescriptor(
    mediaPrototype,
    "src",
  );
  if (mediaSrcDescriptor?.get && mediaSrcDescriptor?.set) {
    Object.defineProperty(mediaPrototype, "src", {
      configurable: true,
      get() {
        return mediaSrcDescriptor.get.call(this);
      },
      set(value) {
        mediaActions.push({ target: this, type: "src", value });
        mediaSrcDescriptor.set.call(this, value);
      },
    });
  }
  mediaPrototype.play = vi.fn(function () {
    mediaActions.push({ target: this, type: "play" });
    return Promise.resolve();
  });
  mediaPrototype.pause = vi.fn(function () {
    mediaActions.push({ target: this, type: "pause" });
  });
  mediaPrototype.load = vi.fn(function () {
    mediaActions.push({ target: this, type: "load" });
  });
  if (!("srcObject" in mediaPrototype)) {
    Object.defineProperty(mediaPrototype, "srcObject", {
      configurable: true,
      get() {
        return this.__fixtureSrcObject ?? null;
      },
      set(value) {
        this.__fixtureSrcObject = value;
        mediaActions.push({ target: this, type: "srcObject", value });
      },
    });
  }
  if (!missingApis.has("requestVideoFrameCallback")) {
    mediaPrototype.requestVideoFrameCallback = function (callback) {
      return window.requestAnimationFrame(() => callback(0, {}));
    };
    mediaPrototype.cancelVideoFrameCallback = function (id) {
      window.cancelAnimationFrame(id);
    };
  }

  window.HTMLAnchorElement.prototype.click = vi.fn(function () {
    anchorClicks.push({
      download: this.download,
      href: this.href,
      target: this.target,
    });
  });

  window.GM_info = options.gmInfo || {
    script: {
      downloadURL:
        "https://raw.githubusercontent.com/paytonison/insta-loader/main/insta-loader.user.js",
      name: "insta-loader",
      version: "v1.3.4",
    },
  };
  window.GM_getResourceText = vi.fn((name) => {
    if (name === "INTERNAL_CSS") return "/* fixture base stylesheet */";
    if (name === "LOCALE_MANIFEST") {
      return JSON.stringify(options.localeManifest || defaultLocaleManifest);
    }
    return "";
  });
  window.GM_getValue = vi.fn((key, fallback) => {
    storageReads.push(key);
    return storage.has(key) ? storage.get(key) : fallback;
  });
  window.GM_setValue = vi.fn((key, value) => {
    storage.set(key, value);
    storageWrites.push({ key, value });
  });
  window.GM_addStyle = vi.fn((css) => {
    styles.push(css);
    return null;
  });
  window.GM_notification = vi.fn();
  window.GM_openInTab = vi.fn((url, tabOptions) => {
    openedTabs.push({ options: tabOptions, url });
    return { close: vi.fn() };
  });
  window.GM_registerMenuCommand = vi.fn((label, callback, commandOptions) => {
    const id = nextMenuId++;
    menuCommands.set(id, { callback, label, options: commandOptions });
    return id;
  });
  window.GM_unregisterMenuCommand = vi.fn((id) => {
    unregisteredMenuIds.push(id);
    menuCommands.delete(id);
  });
  window.GM_download = vi.fn((downloadOptions) => {
    downloads.push(downloadOptions);
    const handle = {
      abort: vi.fn(() => abortedDownloads.push(downloadOptions)),
    };
    if (options.deferDownloads !== true) {
      window.queueMicrotask(() => downloadOptions.onload?.());
    }
    return handle;
  });

  function dispatchNetworkResponse(request, response) {
    if (response.event === "error") request.onerror?.(response.error || {});
    else if (response.event === "timeout") request.ontimeout?.();
    else if (response.event === "abort") request.onabort?.();
    else request.onload?.(response);
  }

  window.GM_xmlhttpRequest = vi.fn((request) => {
    requests.push(request);
    const route = (options.network || []).find((candidate) =>
      matchesRoute(candidate, request),
    );
    const fallback = request.url.includes("/locale/translations/")
      ? { body: {} }
      : options.defaultNetworkResponse || { body: {} };
    const response = normalizeNetworkResponse(request, route?.response || fallback);
    let deferredEntry = null;
    const handle = {
      abort: vi.fn(() => {
        abortedRequests.push(request);
        if (response.ignoreAbort === true) return;
        if (deferredEntry?.timeoutId != null) {
          window.clearTimeout(deferredEntry.timeoutId);
        }
        const pendingIndex = deferredRequests.findIndex(
          (pending) => pending.request === request,
        );
        if (pendingIndex >= 0) deferredRequests.splice(pendingIndex, 1);
        request.onabort?.();
      }),
    };

    if (response.defer === true) {
      deferredEntry = { request, response, timeoutId: null };
      const timeout = Number(request.timeout);
      if (Number.isFinite(timeout) && timeout > 0) {
        deferredEntry.timeoutId = window.setTimeout(() => {
          const pendingIndex = deferredRequests.indexOf(deferredEntry);
          if (pendingIndex >= 0) deferredRequests.splice(pendingIndex, 1);
          request.ontimeout?.();
        }, timeout);
      }
      deferredRequests.push(deferredEntry);
    } else {
      window.queueMicrotask(() => dispatchNetworkResponse(request, response));
    }
    return handle;
  });

  window.eval(jquerySource);
  window.eval(options.userscriptSource || userscriptSource);
  window.document.dispatchEvent(new window.Event("DOMContentLoaded"));
  window.dispatchEvent(new window.Event("load"));
  await flushMicrotasks();
  clock.runDue(0);
  await flushMicrotasks();

  function menuByAccessKey(accessKey) {
    return [...menuCommands.values()].find(
      (command) => command.options?.accessKey === accessKey,
    );
  }

  function resolveDeferredRequests(urlPart = "") {
    let resolved = 0;
    for (let index = deferredRequests.length - 1; index >= 0; index -= 1) {
      const pending = deferredRequests[index];
      if (!String(pending.request.url).includes(String(urlPart))) continue;

      deferredRequests.splice(index, 1);
      if (pending.timeoutId != null) window.clearTimeout(pending.timeoutId);
      window.queueMicrotask(() =>
        dispatchNetworkResponse(pending.request, pending.response),
      );
      resolved += 1;
    }
    return resolved;
  }

  function makeVideoActive(video, rect = {}) {
    const visibleRect = {
      bottom: rect.bottom ?? 680,
      height: rect.height ?? 640,
      left: rect.left ?? 272,
      right: rect.right ?? 632,
      top: rect.top ?? 40,
      width: rect.width ?? 360,
      x: rect.left ?? 272,
      y: rect.top ?? 40,
      toJSON: () => ({}),
    };
    Object.defineProperty(video, "paused", {
      configurable: true,
      value: false,
    });
    Object.defineProperty(video, "ended", {
      configurable: true,
      value: false,
    });
    Object.defineProperty(video, "duration", {
      configurable: true,
      value: 30,
    });
    Object.defineProperty(video, "currentTime", {
      configurable: true,
      writable: true,
      value: 1,
    });
    video.getBoundingClientRect = vi.fn(() => visibleRect);
    for (let element = video; element; element = element.parentElement) {
      element.style.display = "block";
      element.style.visibility = "visible";
      element.style.opacity = "1";
    }
    return video;
  }

  return {
    abortedFetchRequests,
    abortedDownloads,
    abortedRequests,
    alerts,
    anchorClicks,
    clock,
    document: window.document,
    deferredRequests,
    dom,
    downloads,
    fetchRequests,
    flushMicrotasks,
    makeVideoActive,
    mediaActions,
    menuByAccessKey,
    menuCommands,
    unregisteredMenuIds,
    observers,
    openedTabs,
    requests,
    resolveDeferredRequests,
    storage,
    storageReads,
    storageWrites,
    styles,
    window,
    dispose() {
      dom.window.close();
    },
  };
}

export function readUserscriptSource() {
  return userscriptSource;
}
