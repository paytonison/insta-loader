import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

import { expect, test } from "@playwright/test";

const require = createRequire(import.meta.url);
const jquerySource = readFileSync(require.resolve("jquery"), "utf8");
const userscriptSource = readFileSync(
  new URL("../../insta-loader.user.js", import.meta.url),
  "utf8",
);
const postHtml = readFileSync(
  new URL("../fixtures/html/post.html", import.meta.url),
  "utf8",
);
const standaloneReelHtml = readFileSync(
  new URL("../fixtures/html/standalone-reel.html", import.meta.url),
  "utf8",
);
const mediaApiResponse = JSON.parse(
  readFileSync(new URL("../fixtures/json/media-api.json", import.meta.url), "utf8"),
);

const reelsControlsHtml = `<!doctype html>
<html style="display:block;visibility:visible;opacity:1">
  <head>
    <script type="application/json">{"APP_ID":"936619743392459"}</script>
  </head>
  <body style="display:block;visibility:visible;opacity:1">
    <div id="mount_0">
      <section>
        <main role="main">
          <div aria-busy="false" tabindex="0">
            <div
              data-fixture="reels-controls"
              class="x1qjc9v5"
              style="position:relative;width:95vw;height:95vh;display:block;visibility:visible;opacity:1"
            >
              <a href="/reels/FeedReel1/">
                <video
                  data-fixture-reel="FeedReel1"
                  style="display:block;width:360px;height:640px;visibility:visible;opacity:1"
                ></video>
              </a>
              <div
                data-fixture-action-rail
                style="display:flex;flex-direction:column;width:64px;height:240px"
              >
                <div><div role="button"><svg aria-label="Like"></svg></div></div>
                <div><div role="button"><svg aria-label="Comment"></svg></div></div>
                <div><div role="button"><svg aria-label="Share"></svg></div></div>
              </div>
            </div>
          </div>
        </main>
      </section>
    </div>
  </body>
</html>`;

function installFixtureRuntime(mediaResponse) {
  const fixture = {
    abortedRequests: 0,
    anchorClicks: [],
    cancelledIdleCallbacks: 0,
    cancelledTimeouts: 0,
    cancelledVideoFrames: 0,
    downloads: [],
    holdIdleCallbacks: false,
    holdVideoFrames: false,
    idleCancelCalls: 0,
    idleCallbacksScheduled: 0,
    mediaActions: [],
    menus: {},
    observerEvents: [],
    openedTabs: [],
    pendingIdleCallbacks: 0,
    pendingTimeouts: 0,
    pendingVideoFrames: 0,
    requests: [],
    schedulerEvents: [],
    storage: {},
    storageReads: [],
    storageWrites: [],
    styles: [],
    timeoutClearCalls: 0,
    videoFrameCancelCalls: 0,
    videoFramesScheduled: 0,
  };
  window.__instaLoaderFixture = fixture;

  const hasOwn = (object, key) =>
    Object.prototype.hasOwnProperty.call(object, key);
  const nativeSetTimeout = window.setTimeout.bind(window);
  const nativeClearTimeout = window.clearTimeout.bind(window);
  const trackedTimeouts = new Map();
  const pendingIdleCallbacks = new Map();
  const cancelledIdleCallbacks = new Map();
  const pendingVideoFrames = new Map();
  const cancelledVideoFrames = new Map();
  let nextMenuId = 1;
  let nextIdleCallbackId = 1;
  let nextVideoFrameId = 1;

  const recordSchedulerEvent = (type, details = {}) => {
    fixture.schedulerEvents.push({ type, ...details });
  };
  const syncPendingSchedulerCounts = () => {
    fixture.pendingIdleCallbacks = pendingIdleCallbacks.size;
    fixture.pendingTimeouts = trackedTimeouts.size;
    fixture.pendingVideoFrames = pendingVideoFrames.size;
  };

  window.setTimeout = (callback, delay, ...args) => {
    let handle;
    const normalizedDelay = Number(delay) || 0;
    const wrappedCallback = (...callbackArgs) => {
      trackedTimeouts.delete(handle);
      syncPendingSchedulerCounts();
      recordSchedulerEvent("timeout:fire", {
        delay: normalizedDelay,
        id: handle,
      });
      return callback(...callbackArgs);
    };

    handle = nativeSetTimeout(wrappedCallback, delay, ...args);
    trackedTimeouts.set(handle, { delay: normalizedDelay });
    syncPendingSchedulerCounts();
    recordSchedulerEvent("timeout:schedule", {
      delay: normalizedDelay,
      id: handle,
    });
    return handle;
  };
  window.clearTimeout = (handle) => {
    fixture.timeoutClearCalls += 1;
    if (trackedTimeouts.delete(handle)) {
      fixture.cancelledTimeouts += 1;
      recordSchedulerEvent("timeout:cancel", { id: handle });
      syncPendingSchedulerCounts();
    }
    nativeClearTimeout(handle);
  };

  const runIdleCallback = (id, source) => {
    const entry = pendingIdleCallbacks.get(id);
    if (!entry) return false;

    pendingIdleCallbacks.delete(id);
    if (entry.nativeHandle != null) nativeClearTimeout(entry.nativeHandle);
    syncPendingSchedulerCounts();
    recordSchedulerEvent(`idle:${source}`, { id });
    entry.callback({
      didTimeout: false,
      timeRemaining: () => 50,
    });
    return true;
  };
  window.requestIdleCallback = (callback, options = {}) => {
    const id = nextIdleCallbackId++;
    const entry = { callback, nativeHandle: null, options };
    pendingIdleCallbacks.set(id, entry);
    fixture.idleCallbacksScheduled += 1;
    syncPendingSchedulerCounts();
    recordSchedulerEvent("idle:schedule", { id });

    if (!fixture.holdIdleCallbacks) {
      entry.nativeHandle = nativeSetTimeout(
        () => runIdleCallback(id, "fire"),
        0,
      );
    }
    return id;
  };
  window.cancelIdleCallback = (id) => {
    fixture.idleCancelCalls += 1;
    const entry = pendingIdleCallbacks.get(id);
    recordSchedulerEvent("idle:cancel-call", { id });
    if (!entry) return;

    pendingIdleCallbacks.delete(id);
    if (entry.nativeHandle != null) nativeClearTimeout(entry.nativeHandle);
    cancelledIdleCallbacks.set(id, entry);
    fixture.cancelledIdleCallbacks += 1;
    syncPendingSchedulerCounts();
    recordSchedulerEvent("idle:cancel", { id });
  };
  fixture.firePendingIdleCallbacks = () => {
    [...pendingIdleCallbacks.keys()].forEach((id) =>
      runIdleCallback(id, "fixture-fire"),
    );
  };
  fixture.fireCancelledIdleCallbacks = () => {
    for (const [id, entry] of cancelledIdleCallbacks) {
      cancelledIdleCallbacks.delete(id);
      recordSchedulerEvent("idle:stale-fire", { id });
      entry.callback({
        didTimeout: false,
        timeRemaining: () => 50,
      });
    }
  };

  const runVideoFrame = (id, source) => {
    const entry = pendingVideoFrames.get(id);
    if (!entry) return false;

    pendingVideoFrames.delete(id);
    if (entry.nativeHandle != null) nativeClearTimeout(entry.nativeHandle);
    syncPendingSchedulerCounts();
    recordSchedulerEvent(`video-frame:${source}`, { id });
    entry.callback(window.performance.now(), {});
    return true;
  };
  fixture.firePendingVideoFrames = () => {
    [...pendingVideoFrames.keys()].forEach((id) =>
      runVideoFrame(id, "fixture-fire"),
    );
  };
  fixture.fireCancelledVideoFrames = () => {
    for (const [id, entry] of cancelledVideoFrames) {
      cancelledVideoFrames.delete(id);
      recordSchedulerEvent("video-frame:stale-fire", { id });
      entry.callback(window.performance.now(), {});
    }
  };

  window.GM_info = {
    script: {
      downloadURL:
        "https://raw.githubusercontent.com/paytonison/insta-loader/main/insta-loader.user.js",
      name: "insta-loader",
      version: "v1.3.4",
    },
  };
  window.GM_getValue = (key, fallback) => {
    fixture.storageReads.push(key);
    return hasOwn(fixture.storage, key) ? fixture.storage[key] : fallback;
  };
  window.GM_setValue = (key, value) => {
    fixture.storage[key] = value;
    fixture.storageWrites.push({ key, value });
  };
  window.GM_addStyle = (css) => {
    fixture.styles.push({
      length: String(css).length,
      localControls: String(css).includes("--insta-loader-font"),
      upstreamControls: String(css).includes(".button_wrapper"),
    });
  };
  window.GM_getResourceText = (name) => {
    if (name === "LOCALE_MANIFEST") return '{"en-US":"English"}';
    return "/* unused fixture resource */";
  };
  window.GM_registerMenuCommand = (label, callback, options) => {
    const id = nextMenuId++;
    fixture.menus[id] = {
      accessKey: options?.accessKey,
      label,
    };
    fixture[`menuCallback${id}`] = callback;
    return id;
  };
  window.GM_unregisterMenuCommand = (id) => {
    delete fixture.menus[id];
    delete fixture[`menuCallback${id}`];
  };
  window.GM_notification = () => {};
  window.GM_openInTab = (url, options) => {
    fixture.openedTabs.push({ options, url });
    return { close() {} };
  };
  window.GM_download = (options) => {
    fixture.downloads.push({
      name: options.name,
      saveAs: options.saveAs,
      url: options.url,
    });
    queueMicrotask(() => options.onload?.());
    return { abort() {} };
  };
  window.GM_xmlhttpRequest = (options) => {
    const request = {
      aborted: false,
      method: options.method,
      timeout: options.timeout,
      url: String(options.url),
    };
    fixture.requests.push(request);

    if (request.url.includes("/api/v1/media/")) {
      queueMicrotask(() =>
        options.onload?.({
          finalUrl: request.url,
          response: JSON.stringify(mediaResponse),
          responseText: JSON.stringify(mediaResponse),
          status: 200,
        }),
      );
    } else if (!request.url.includes("/graphql/query/")) {
      queueMicrotask(() =>
        options.onload?.({
          finalUrl: request.url,
          response: "{}",
          responseText: "{}",
          status: 200,
        }),
      );
    }

    return {
      abort() {
        if (request.aborted) return;
        request.aborted = true;
        fixture.abortedRequests += 1;
        queueMicrotask(() => options.onabort?.());
      },
    };
  };

  window.fetch = async () => ({
    arrayBuffer: async () => new ArrayBuffer(0),
    blob: async () => new Blob([], { type: "application/octet-stream" }),
    ok: true,
    status: 200,
  });

  const NativeMutationObserver = window.MutationObserver;
  window.MutationObserver = class TrackingMutationObserver {
    constructor(callback) {
      fixture.observerEvents.push("mutation:create");
      this.observer = new NativeMutationObserver(callback);
    }

    observe(target, options) {
      fixture.observerEvents.push("mutation:observe");
      this.observer.observe(target, options);
    }

    disconnect() {
      fixture.observerEvents.push("mutation:disconnect");
      this.observer.disconnect();
    }

    takeRecords() {
      return this.observer.takeRecords();
    }
  };

  const NativeIntersectionObserver = window.IntersectionObserver;
  window.IntersectionObserver = class TrackingIntersectionObserver {
    constructor(callback, options) {
      fixture.observerEvents.push("intersection:create");
      this.observer = NativeIntersectionObserver
        ? new NativeIntersectionObserver(callback, options)
        : null;
      this.targets = new Set();
    }

    observe(target) {
      fixture.observerEvents.push("intersection:observe");
      this.targets.add(target);
      this.observer?.observe(target);
    }

    unobserve(target) {
      this.targets.delete(target);
      this.observer?.unobserve(target);
    }

    disconnect() {
      fixture.observerEvents.push("intersection:disconnect");
      this.targets.clear();
      this.observer?.disconnect();
    }

    takeRecords() {
      return this.observer?.takeRecords() || [];
    }
  };

  const mediaPrototype = window.HTMLMediaElement.prototype;
  const videoPrototype = window.HTMLVideoElement.prototype;
  const nativePause = mediaPrototype.pause;
  const nativePlay = mediaPrototype.play;
  const nativeLoad = mediaPrototype.load;
  mediaPrototype.pause = function () {
    fixture.mediaActions.push("pause");
    return nativePause.call(this);
  };
  mediaPrototype.play = function () {
    fixture.mediaActions.push("play");
    return nativePlay.call(this);
  };
  mediaPrototype.load = function () {
    fixture.mediaActions.push("load");
    return nativeLoad.call(this);
  };
  Object.defineProperty(videoPrototype, "requestVideoFrameCallback", {
    configurable: true,
    value(callback) {
      const id = nextVideoFrameId++;
      const entry = { callback, nativeHandle: null };
      pendingVideoFrames.set(id, entry);
      fixture.videoFramesScheduled += 1;
      syncPendingSchedulerCounts();
      recordSchedulerEvent("video-frame:schedule", { id });

      if (!fixture.holdVideoFrames) {
        entry.nativeHandle = nativeSetTimeout(
          () => runVideoFrame(id, "fire"),
          16,
        );
      }
      return id;
    },
    writable: true,
  });
  Object.defineProperty(videoPrototype, "cancelVideoFrameCallback", {
    configurable: true,
    value(id) {
      fixture.videoFrameCancelCalls += 1;
      const entry = pendingVideoFrames.get(id);
      recordSchedulerEvent("video-frame:cancel-call", { id });
      if (!entry) return;

      pendingVideoFrames.delete(id);
      if (entry.nativeHandle != null) nativeClearTimeout(entry.nativeHandle);
      cancelledVideoFrames.set(id, entry);
      fixture.cancelledVideoFrames += 1;
      syncPendingSchedulerCounts();
      recordSchedulerEvent("video-frame:cancel", { id });
    },
    writable: true,
  });

  const srcDescriptor = Object.getOwnPropertyDescriptor(mediaPrototype, "src");
  if (srcDescriptor?.get && srcDescriptor?.set) {
    Object.defineProperty(mediaPrototype, "src", {
      configurable: true,
      get() {
        return srcDescriptor.get.call(this);
      },
      set(value) {
        fixture.mediaActions.push("src");
        srcDescriptor.set.call(this, value);
      },
    });
  }

  const nativeAnchorClick = window.HTMLAnchorElement.prototype.click;
  window.HTMLAnchorElement.prototype.click = function () {
    fixture.anchorClicks.push({
      download: this.download,
      href: this.href,
      target: this.target,
    });
    if (!this.target && !this.download) return nativeAnchorClick.call(this);
  };

  window.Mediabunny = {};
}

const fixtureRuntimeSource =
  `(${installFixtureRuntime.toString()})(${JSON.stringify(mediaApiResponse)});`;
const userscriptRuntimeSource = [jquerySource, userscriptSource].join("\n");

async function openFixture(page, url, html, fixtureOptions = {}) {
  const pageErrors = [];
  let reportFirstPageError;
  const firstPageError = new Promise((resolve) => {
    reportFirstPageError = resolve;
  });

  page.on("pageerror", (error) => {
    pageErrors.push(error.message);
    reportFirstPageError(error);
  });

  await page.route("**/*", async (route) => {
    if (route.request().isNavigationRequest()) {
      await route.fulfill({
        body: html,
        contentType: "text/html; charset=utf-8",
        status: 200,
      });
    } else {
      await route.abort();
    }
  });
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.evaluate((options) => {
    Object.assign(window.__instaLoaderFixture, options);
  }, fixtureOptions);
  await page.evaluate((source) => window.eval(source), userscriptRuntimeSource);

  const startupResult = await Promise.race([
    page
      .waitForFunction(() => window.__instaLoaderFixture?.styles.length === 2)
      .then(() => ({ type: "ready" })),
    firstPageError.then((error) => ({ error, type: "pageerror" })),
  ]);

  if (startupResult.type === "pageerror") {
    throw startupResult.error;
  }

  return pageErrors;
}

test.beforeEach(async ({ context }) => {
  await context.addInitScript({ content: fixtureRuntimeSource });
});

test("boots the generated userscript with deterministic browser APIs", async ({
  page,
}) => {
  const pageErrors = await openFixture(
    page,
    "https://www.instagram.com/p/Post12345/",
    postHtml,
  );

  const bootstrap = await page.evaluate(() => ({
    menuAccessKeys: Object.values(window.__instaLoaderFixture.menus)
      .map((menu) => menu.accessKey)
      .sort(),
    observerEvents: window.__instaLoaderFixture.observerEvents,
    storageReads: window.__instaLoaderFixture.storageReads,
    styles: window.__instaLoaderFixture.styles,
  }));

  expect(pageErrors).toEqual([]);
  expect(bootstrap.styles).toHaveLength(2);
  expect(bootstrap.styles.some((style) => style.localControls)).toBe(true);
  expect(bootstrap.menuAccessKeys).toEqual(["c", "d", "f", "q", "r", "w", "z"]);
  expect(bootstrap.storageReads).toContain("URLS_OF_IMAGES_TEMPORARILY_STORED");
  expect(bootstrap.observerEvents).toContain("mutation:observe");
  expect(bootstrap.observerEvents).toContain("intersection:create");
});

test("remounts exactly one Reels control group after repeated reloads", async ({
  page,
}) => {
  await openFixture(
    page,
    "https://www.instagram.com/reels/FeedReel1/",
    reelsControlsHtml,
  );

  await expect(page.locator(".IG_REELS_CONTROLS")).toHaveCount(1, {
    timeout: 6000,
  });

  const beforeReload = await page.evaluate(() => {
    const fixture = window.__instaLoaderFixture;
    return {
      cancelledTimeouts: fixture.cancelledTimeouts,
      disconnects: fixture.observerEvents.filter((event) =>
        event.endsWith(":disconnect"),
      ).length,
    };
  });
  await page.evaluate(() => {
    const fixture = window.__instaLoaderFixture;
    const reloadEntry = Object.entries(fixture.menus).find(
      ([, menu]) => menu.accessKey === "r",
    );
    if (!reloadEntry) throw new Error("Reload menu command was not registered.");
    const reload = fixture[`menuCallback${reloadEntry[0]}`];
    reload();
    reload();
  });

  await expect
    .poll(() =>
      page.evaluate(
        () =>
          window.__instaLoaderFixture.observerEvents.filter((event) =>
            event.endsWith(":disconnect"),
          ).length,
      ),
    )
    .toBeGreaterThan(beforeReload.disconnects);
  await expect
    .poll(() =>
      page.evaluate(() => window.__instaLoaderFixture.cancelledTimeouts),
    )
    .toBeGreaterThan(beforeReload.cancelledTimeouts);
  await expect(page.locator(".IG_REELS_CONTROLS")).toHaveCount(1, {
    timeout: 6000,
  });
  await page.waitForTimeout(2200);
  await expect(page.locator(".IG_REELS_CONTROLS")).toHaveCount(1);
  await expect(page.locator(".IG_REELS_CONTROLS > div")).toHaveCount(3);
});

test("cancels a pending Reel install and disconnects observers on route change", async ({
  page,
}) => {
  await openFixture(
    page,
    "https://www.instagram.com/reels/FeedReel1/",
    reelsControlsHtml,
    { holdVideoFrames: true },
  );

  await expect
    .poll(() =>
      page.evaluate(() => window.__instaLoaderFixture.pendingVideoFrames),
    )
    .toBeGreaterThan(0);
  await expect(page.locator(".IG_REELS_CONTROLS")).toHaveCount(0);

  const beforeNavigation = await page.evaluate(() => {
    const fixture = window.__instaLoaderFixture;
    return {
      cancelledTimeouts: fixture.cancelledTimeouts,
      disconnects: fixture.observerEvents.filter((event) =>
        event.endsWith(":disconnect"),
      ).length,
    };
  });

  await page.evaluate(() => {
    history.pushState({}, "", "/p/Post12345/");
    dispatchEvent(new PopStateEvent("popstate"));
  });
  await expect(page).toHaveURL("https://www.instagram.com/p/Post12345/");
  await expect
    .poll(() =>
      page.evaluate(() => window.__instaLoaderFixture.cancelledVideoFrames),
    )
    .toBeGreaterThan(0);
  await expect
    .poll(() =>
      page.evaluate(() => window.__instaLoaderFixture.cancelledTimeouts),
    )
    .toBeGreaterThan(beforeNavigation.cancelledTimeouts);
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          window.__instaLoaderFixture.observerEvents.filter((event) =>
            event.endsWith(":disconnect"),
          ).length,
      ),
    )
    .toBeGreaterThan(beforeNavigation.disconnects);

  await page.evaluate(() => {
    window.__instaLoaderFixture.fireCancelledVideoFrames();
  });
  await page.waitForTimeout(2200);

  const cleanup = await page.evaluate(() => {
    const fixture = window.__instaLoaderFixture;
    const reel = document.querySelector('[data-fixture="reels-controls"]');
    return {
      pendingMarker: window.jQuery(reel).data(
        "insta-loader-reels-controls-pending",
      ),
      pendingVideoFrames: fixture.pendingVideoFrames,
      staleFrameRuns: fixture.schedulerEvents.filter(
        (event) => event.type === "video-frame:stale-fire",
      ).length,
    };
  });

  expect(cleanup.pendingMarker).toBeUndefined();
  expect(cleanup.pendingVideoFrames).toBe(0);
  expect(cleanup.staleFrameRuns).toBeGreaterThan(0);
  await expect(page.locator(".IG_REELS_CONTROLS")).toHaveCount(0);
});

test("routes direct-download and new-tab actions exactly once", async ({ page }) => {
  await openFixture(page, "https://www.instagram.com/p/Post12345/", postHtml);

  await page.evaluate(() => {
    const popup = document.createElement("div");
    popup.className = "IG_POPUP_DIG";
    popup.innerHTML = `
      <div class="IG_POPUP_DIG_BODY">
        <div>
          <a
            media-id="300000000000000001"
            datetime="1700000000"
            data-needed="direct"
            data-path="Post12345"
            data-name="photo"
            data-type="jpg"
            data-username="fixture_user"
            data-globalindex="1"
            data-href="https://scontent.cdninstagram.com/v/t51.2885-15/post-full.jpg"
            href="javascript:;"
          >fixture media</a>
          <div class="newTab"><span class="new-tab-glyph">open</span></div>
        </div>
      </div>`;
    document.body.appendChild(popup);
  });

  await page.locator("a[data-needed='direct']").dispatchEvent("click");
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          window.__instaLoaderFixture.requests.filter((request) =>
            request.url.includes("/api/v1/media/"),
          ).length,
      ),
    )
    .toBe(1);
  await expect
    .poll(() =>
      page.evaluate(() => window.__instaLoaderFixture.downloads.length),
    )
    .toBe(1);

  await page.locator(".new-tab-glyph").dispatchEvent("click");
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          window.__instaLoaderFixture.requests.filter((request) =>
            request.url.includes("/api/v1/media/"),
          ).length,
      ),
    )
    .toBe(2);
  await expect
    .poll(() =>
      page.evaluate(() => window.__instaLoaderFixture.anchorClicks.length),
    )
    .toBe(1);
  expect(await page.evaluate(() => window.__instaLoaderFixture.downloads.length)).toBe(1);
});

test("relinquishes a pending standalone Reel handoff on plural-feed navigation", async ({
  page,
}) => {
  await openFixture(
    page,
    "https://www.instagram.com/reel/Standalone1/",
    standaloneReelHtml,
  );

  await page.locator("video").dispatchEvent("play");
  await expect(page.locator(".insta-loader-reel-quality-hold")).toHaveCount(1);
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          window.__instaLoaderFixture.requests.filter((request) =>
            request.url.includes("/graphql/query/"),
          ).length,
      ),
    )
    .toBe(1);

  await page.evaluate(() => {
    history.pushState({}, "", "/reels/FeedReel1/");
    dispatchEvent(new PopStateEvent("popstate"));
  });

  await expect(page).toHaveURL("https://www.instagram.com/reels/FeedReel1/");
  await expect(page.locator(".insta-loader-reel-quality-hold")).toHaveCount(0);
  await expect
    .poll(() =>
      page.evaluate(() => window.__instaLoaderFixture.abortedRequests),
    )
    .toBe(1);
  expect(
    await page.evaluate(
      () =>
        window.__instaLoaderFixture.requests.filter((request) =>
          request.url.includes("/graphql/query/"),
        ).length,
    ),
  ).toBe(1);
});
