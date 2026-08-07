// @vitest-environment node

import { readFileSync } from "node:fs";

import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { buildUserscript } from "../../scripts/build.mjs";
import { createUserscriptRuntime } from "./helpers/userscript-runtime.js";

const storyFixture = JSON.parse(
  readFileSync(
    new URL("../fixtures/json/story.json", import.meta.url),
    "utf8",
  ),
);
const highlightFixture = JSON.parse(
  readFileSync(
    new URL("../fixtures/json/highlight.json", import.meta.url),
    "utf8",
  ),
);
const videoOnlyDashManifest = readFileSync(
  new URL("../unit/media/fixtures/dash-video-only.mpd", import.meta.url),
  "utf8",
);
const STORY_ACTION_FAILURE_MESSAGE =
  "Could not complete this Story or Highlight action. Try again; details are available in Debug Window.";
const STORY_QUERY_HASH = "15463e8449a83d3d60b06be7e90627c7";
const HIGHLIGHT_QUERY_HASH = "45246d3fe16ccc6577e0bd297a5db1ab";

const runtimes = [];
let currentUserscriptSource;

beforeAll(async () => {
  const contents = await buildUserscript({ write: false });
  currentUserscriptSource = new TextDecoder().decode(contents);
});

afterEach(() => {
  while (runtimes.length) runtimes.pop().dispose();
});

function storyHtml({
  actionClass = "IG_DWSTORY",
  datetime = null,
  mediaMarkup = "",
} = {}) {
  return `<!doctype html>
    <html style="display:block;visibility:visible;opacity:1">
      <head>
        <script type="application/json">{"APP_ID":"936619743392459"}</script>
      </head>
      <body style="display:block;visibility:visible;opacity:1">
        <div id="mount_0">
          <div><div><div class="x1s85apg" data-story-loading-bar></div></div></div>
          <section class="_ac0a">
            <header class="_ac0k">
              <div class="_ac0l">
                <a href="/"></a>
                <div><a href="/fixture_user/">fixture_user</a></div>
              </div>
              ${datetime ? `<time datetime="${datetime}"></time>` : ""}
            </header>
            ${mediaMarkup}
            <button class="${actionClass}" type="button">Story action</button>
          </section>
        </div>
      </body>
    </html>`;
}

function highlightHtml(actionClass = "IG_DWHISTORY") {
  return `<!doctype html>
    <html style="display:block;visibility:visible;opacity:1">
      <head>
        <script type="application/json">{"APP_ID":"936619743392459"}</script>
      </head>
      <body style="display:block;visibility:visible;opacity:1">
        <div id="mount_0">
          <div><div><div class="x1s85apg" data-story-loading-bar></div></div></div>
          <section class="_ac0a">
            <a href="/fixture_user/">fixture_user</a>
            <header class="_ac0k">
              <div class="_ac3r">
                <div class="_ac3n">
                  <div class="_ac3p" style="width:50%"></div>
                </div>
              </div>
            </header>
            <button class="${actionClass}" type="button">Highlight action</button>
          </section>
        </div>
      </body>
    </html>`;
}

function imageLoadLifecycleHtml(surface) {
  const mediaMarkup = `
    <div><a href="/">Instagram</a></div>
    <img referrerpolicy="origin" src="https://scontent.cdninstagram.com/recycled-story.jpg">
  `;
  const html =
    surface === "highlight"
      ? highlightHtml().replace("</header>", `</header>${mediaMarkup}`)
      : storyHtml({ mediaMarkup });

  return html.replace(
    '<body style="display:block;visibility:visible;opacity:1">\n        <div>',
    '<body style="display:block;visibility:visible;opacity:1">\n        <div id="mount_0">',
  );
}

function userSearchRoute() {
  return {
    match: "/web/search/topsearch/",
    response: {
      body: {
        users: [
          {
            user: {
              pk: "100000000000000001",
              username: "fixture_user",
            },
          },
        ],
      },
    },
  };
}

function mediaRoute(mediaId) {
  return {
    match: `/api/v1/media/${mediaId}/info/`,
    response: {
      body: {
        status: "ok",
        items: [
          {
            id: mediaId,
            taken_at: 1_700_000_060,
            image_versions2: {
              candidates: [
                {
                  url: `https://scontent.cdninstagram.com/${mediaId}.jpg`,
                  width: 1080,
                  height: 1920,
                },
                {
                  url:
                    `https://scontent.cdninstagram.com/${mediaId}-later.jpg`,
                  width: 2160,
                  height: 3840,
                },
              ],
            },
          },
        ],
      },
    },
  };
}

function videoMediaRoute(mediaId) {
  return {
    match: `/api/v1/media/${mediaId}/info/`,
    response: {
      body: {
        status: "ok",
        items: [
          {
            id: mediaId,
            taken_at: 1_700_000_060,
            has_audio: false,
            image_versions2: {
              candidates: [
                {
                  url: `https://scontent.cdninstagram.com/${mediaId}.jpg`,
                  width: 1080,
                  height: 1920,
                },
              ],
            },
            video_dash_manifest: videoOnlyDashManifest,
            video_versions: [
              {
                url: `https://scontent.cdninstagram.com/${mediaId}.mp4`,
                width: 1080,
                height: 1920,
              },
            ],
          },
        ],
      },
    },
  };
}

function manifestlessVideoMediaRoute(mediaId) {
  return {
    match: `/api/v1/media/${mediaId}/info/`,
    response: {
      body: {
        status: "ok",
        items: [
          {
            id: mediaId,
            taken_at: 1_700_000_060,
            has_audio: false,
            image_versions2: {
              candidates: [
                {
                  url: `https://scontent.cdninstagram.com/${mediaId}.jpg`,
                  width: 1080,
                  height: 1920,
                },
              ],
            },
            video_versions: [
              {
                url: `https://scontent.cdninstagram.com/${mediaId}.mp4`,
                width: 1080,
                height: 1920,
              },
            ],
          },
        ],
      },
    },
  };
}

async function createStoryRuntime({
  actionClass = "IG_DWSTORY",
  datetime = null,
  url,
} = {}) {
  const mediaId = "300000000000000102";
  const app = await createUserscriptRuntime({
    html: storyHtml({ actionClass, datetime }),
    url,
    network: [
      userSearchRoute(),
      {
        match: "query_hash=15463e8449a83d3d60b06be7e90627c7",
        response: { body: storyFixture },
      },
      mediaRoute(mediaId),
    ],
    userscriptSource: currentUserscriptSource,
  });
  runtimes.push(app);
  return app;
}

async function createCurrentUserscriptRuntime(options) {
  return await createUserscriptRuntime({
    ...options,
    userscriptSource: currentUserscriptSource,
  });
}

function click(app, selector) {
  let target = app.document.querySelector(selector);
  if (!target) {
    target = app.document.createElement("button");
    target.className = selector.replace(/^\./, "");
    target.type = "button";
    app.document.body.append(target);
  }
  const event = new app.window.MouseEvent("click", {
    bubbles: true,
    cancelable: true,
  });
  target.dispatchEvent(event);
  return event;
}

function mediaRequests(app) {
  return app.requests.filter((request) => request.url.includes("/api/v1/media/"));
}

function loadHandlerCount(app, image) {
  return app.window.jQuery._data(image, "events")?.load?.length || 0;
}

function loadingBar(app) {
  return app.document.querySelector("[data-story-loading-bar]");
}

function expectLoadingState(app, isLoading) {
  const element = loadingBar(app);
  expect(element).not.toBeNull();
  expect(element.classList.contains("x1s85apg")).toBe(!isLoading);
  expect(element.style.zIndex).toBe(isLoading ? "20000" : "");
}

describe("mounted Story/Highlight current-item integration", () => {
  it.each([
    ["Story", "story", "/stories/fixture_user/300000000000000102/"],
    ["Highlight", "highlight", "/stories/highlights/Highlight1/"],
  ])(
    "owns one recycled %s image load handler across reload and navigation",
    async (_label, surface, pathname) => {
      const app = await createCurrentUserscriptRuntime({
        html: imageLoadLifecycleHtml(surface),
        url: `https://www.instagram.com${pathname}`,
      });
      runtimes.push(app);

      const section = app.document.querySelector("section");
      const image = section.querySelector("img[referrerpolicy]");
      Object.defineProperties(section, {
        offsetHeight: { configurable: true, value: 1 },
        offsetWidth: { configurable: true, value: 1 },
      });
      section.getClientRects = () => [{ height: 1, width: 1 }];

      const reload = app.menuByAccessKey("r").callback;
      reload();
      expect(loadHandlerCount(app, image)).toBe(1);

      reload();
      expect(loadHandlerCount(app, image)).toBe(1);

      image.dispatchEvent(new app.window.Event("load"));
      expect(image.getAttribute("data-remove-thumbnail")).toBe("true");

      app.window.history.pushState({}, "", "/p/Post12345/");
      app.clock.runIntervalsOnce();
      await app.flushMicrotasks();
      expect(loadHandlerCount(app, image)).toBe(0);

      app.window.history.pushState({}, "", pathname);
      app.clock.runIntervalsOnce();
      await app.flushMicrotasks();
      expect(loadHandlerCount(app, image)).toBe(1);
    },
  );

  it("retries Safari policy-denied Story metadata in the authenticated page context", async () => {
    const mediaId = "300000000000000102";
    const app = await createCurrentUserscriptRuntime({
      html: storyHtml(),
      network: [
        {
          match: "/web/search/topsearch/",
          response: {
            body: "SecFetch Policy violation.",
            status: 400,
          },
        },
        {
          match: `query_hash=${STORY_QUERY_HASH}`,
          response: {
            body: "Resource Isolation Policy Violated",
            status: 400,
          },
        },
        {
          match: `/api/v1/media/${mediaId}/info/`,
          response: {
            body: "Resource Isolation Policy Violated",
            status: 400,
          },
        },
      ],
      fetchNetwork: [
        userSearchRoute(),
        {
          match: `query_hash=${STORY_QUERY_HASH}`,
          response: { body: storyFixture },
        },
        mediaRoute(mediaId),
      ],
      url: `https://www.instagram.com/stories/fixture_user/${mediaId}/`,
    });
    runtimes.push(app);

    click(app, ".IG_DWSTORY");
    await app.flushMicrotasks(200);

    expect(app.fetchRequests).toHaveLength(3);
    expect(app.fetchRequests.map((request) => request.url)).toEqual([
      expect.stringContaining("/web/search/topsearch/"),
      expect.stringContaining(`query_hash=${STORY_QUERY_HASH}`),
      expect.stringContaining(`/api/v1/media/${mediaId}/info/`),
    ]);
    expect(app.fetchRequests).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ credentials: "include" }),
      ]),
    );
    expect(
      app.fetchRequests.find((request) =>
        request.url.includes(`/api/v1/media/${mediaId}/info/`),
      )?.headers,
    ).toMatchObject({ "X-IG-App-ID": "936619743392459" });
    expect(
      Object.keys(
        app.fetchRequests.find((request) =>
          request.url.includes(`/api/v1/media/${mediaId}/info/`),
        )?.headers || {},
      ).map((name) => name.toLowerCase()),
    ).not.toContain("user-agent");
    expect(
      app.requests.filter((request) =>
        request.url.includes(`query_hash=${STORY_QUERY_HASH}`),
      ),
    ).toHaveLength(1);
    expect(app.downloads).toHaveLength(1);
    expect(app.alerts).toEqual([]);
    expectLoadingState(app, false);
  });

  it("retries Safari policy-denied Highlight metadata in the authenticated page context", async () => {
    const mediaId = "300000000000000202";
    const app = await createCurrentUserscriptRuntime({
      html: highlightHtml(),
      network: [
        {
          match: `query_hash=${HIGHLIGHT_QUERY_HASH}`,
          response: {
            body: "SecFetch Policy violation.",
            status: 400,
          },
        },
        {
          match: `/api/v1/media/${mediaId}/info/`,
          response: {
            body: "Resource Isolation Policy Violated",
            status: 400,
          },
        },
      ],
      fetchNetwork: [
        {
          match: `query_hash=${HIGHLIGHT_QUERY_HASH}`,
          response: { body: highlightFixture },
        },
        mediaRoute(mediaId),
      ],
      url: "https://www.instagram.com/stories/highlights/Highlight1/",
    });
    runtimes.push(app);

    click(app, ".IG_DWHISTORY");
    await app.flushMicrotasks(200);

    expect(app.fetchRequests.map((request) => request.url)).toEqual([
      expect.stringContaining(`query_hash=${HIGHLIGHT_QUERY_HASH}`),
      expect.stringContaining(`/api/v1/media/${mediaId}/info/`),
    ]);
    expect(app.downloads).toHaveLength(1);
    expect(app.alerts).toEqual([]);
    expectLoadingState(app, false);
  });

  it("times out and reports a stalled Safari page-context fallback once", async () => {
    const searchRoute = userSearchRoute();
    const app = await createCurrentUserscriptRuntime({
      html: storyHtml(),
      network: [
        {
          match: searchRoute.match,
          response: {
            body: "SecFetch Policy violation.",
            status: 400,
          },
        },
      ],
      fetchNetwork: [
        {
          match: searchRoute.match,
          response: { ...searchRoute.response, defer: true },
        },
      ],
      url: "https://www.instagram.com/stories/fixture_user/300000000000000102/",
    });
    runtimes.push(app);
    const unhandledRejections = [];
    app.window.addEventListener("unhandledrejection", (event) => {
      unhandledRejections.push(event.reason);
      event.preventDefault();
    });
    const consoleError = vi.spyOn(app.window.console, "error");

    try {
      click(app, ".IG_DWSTORY");
      await app.flushMicrotasks(30);

      expect(app.fetchRequests).toHaveLength(1);
      expectLoadingState(app, true);

      app.clock.runDue(14_999);
      await app.flushMicrotasks();
      expectLoadingState(app, true);
      expect(app.alerts).toEqual([]);

      app.clock.runDue(1);
      await app.flushMicrotasks(50);

      expect(app.abortedFetchRequests).toEqual(app.fetchRequests);
      expectLoadingState(app, false);
      expect(app.downloads).toEqual([]);
      expect(app.openedTabs).toEqual([]);
      expect(app.alerts).toEqual([STORY_ACTION_FAILURE_MESSAGE]);
      expect(unhandledRejections).toEqual([]);
      expect(consoleError).toHaveBeenCalledTimes(1);
    } finally {
      consoleError.mockRestore();
    }
  });

  it("silently aborts a Safari page-context fallback on route disposal and permits retry", async () => {
    const mediaId = "300000000000000102";
    const searchRoute = userSearchRoute();
    let pageSearchCount = 0;
    const app = await createCurrentUserscriptRuntime({
      html: storyHtml(),
      network: [
        {
          match: searchRoute.match,
          response: {
            body: "Resource Isolation Policy Violated",
            status: 400,
          },
        },
        {
          match: `query_hash=${STORY_QUERY_HASH}`,
          response: { body: storyFixture },
        },
        mediaRoute(mediaId),
      ],
      fetchNetwork: [
        {
          match: searchRoute.match,
          response: () => ({
            ...searchRoute.response,
            defer: ++pageSearchCount === 1,
          }),
        },
      ],
      url: `https://www.instagram.com/stories/fixture_user/${mediaId}/`,
    });
    runtimes.push(app);
    const unhandledRejections = [];
    app.window.addEventListener("unhandledrejection", (event) => {
      unhandledRejections.push(event.reason);
      event.preventDefault();
    });
    const consoleError = vi.spyOn(app.window.console, "error");

    try {
      click(app, ".IG_DWSTORY");
      await app.flushMicrotasks(30);
      expectLoadingState(app, true);
      expect(app.fetchRequests).toHaveLength(1);

      app.window.history.pushState({}, "", "/p/Post12345/");
      app.clock.runIntervalsOnce();
      await app.flushMicrotasks(30);

      expect(app.abortedFetchRequests).toEqual([app.fetchRequests[0]]);
      expectLoadingState(app, false);
      expect(app.downloads).toEqual([]);
      expect(app.alerts).toEqual([]);
      expect(unhandledRejections).toEqual([]);
      expect(consoleError).not.toHaveBeenCalled();

      app.window.history.pushState(
        {},
        "",
        `/stories/fixture_user/${mediaId}/`,
      );
      app.clock.runIntervalsOnce();
      await app.flushMicrotasks(20);
      click(app, ".IG_DWSTORY");
      await app.flushMicrotasks(50);

      expect(pageSearchCount).toBe(2);
      expect(app.downloads).toHaveLength(1);
      expectLoadingState(app, false);
    } finally {
      consoleError.mockRestore();
    }
  });

  it("blocks a late Story response from outputting on the replacement route", async () => {
    const originalMediaId = "300000000000000102";
    const replacementMediaId = "300000000000000101";
    let storyRequestCount = 0;
    const app = await createCurrentUserscriptRuntime({
      html: storyHtml(),
      network: [
        userSearchRoute(),
        {
          match: `query_hash=${STORY_QUERY_HASH}`,
          response: () => {
            storyRequestCount += 1;
            return {
              body: storyFixture,
              defer: storyRequestCount === 1,
              ignoreAbort: storyRequestCount === 1,
            };
          },
        },
        mediaRoute(replacementMediaId),
      ],
      url:
        `https://www.instagram.com/stories/fixture_user/${originalMediaId}/`,
    });
    runtimes.push(app);
    const unhandledRejections = [];
    app.window.addEventListener("unhandledrejection", (event) => {
      unhandledRejections.push(event.reason);
      event.preventDefault();
    });
    const consoleError = vi.spyOn(app.window.console, "error");

    try {
      click(app, ".IG_DWSTORY");
      await app.flushMicrotasks(30);
      const pendingRequest = app.deferredRequests.find((entry) =>
        entry.request.url.includes(`query_hash=${STORY_QUERY_HASH}`)
      )?.request;
      expect(pendingRequest).toBeDefined();
      expectLoadingState(app, true);

      app.window.history.pushState(
        {},
        "",
        `/stories/fixture_user/${replacementMediaId}/`,
      );
      app.clock.runIntervalsOnce();
      await app.flushMicrotasks(30);

      expect(app.abortedRequests).toContain(pendingRequest);
      expectLoadingState(app, false);

      expect(app.resolveDeferredRequests(STORY_QUERY_HASH)).toBe(1);
      await app.flushMicrotasks(50);

      expect(app.downloads).toEqual([]);
      expect(app.anchorClicks).toEqual([]);
      expect(app.openedTabs).toEqual([]);
      expect(app.alerts).toEqual([]);
      expect(unhandledRejections).toEqual([]);
      expect(consoleError).not.toHaveBeenCalled();
      expectLoadingState(app, false);

      click(app, ".IG_DWSTORY");
      await app.flushMicrotasks(60);

      expect(storyRequestCount).toBe(2);
      expect(app.downloads).toHaveLength(1);
      expect(app.alerts).toEqual([]);
      expectLoadingState(app, false);
    } finally {
      consoleError.mockRestore();
    }
  });

  it("blocks a late Highlight response from outputting on the replacement route", async () => {
    const mediaId = "300000000000000202";
    let highlightRequestCount = 0;
    const app = await createCurrentUserscriptRuntime({
      html: highlightHtml(),
      network: [
        {
          match: `query_hash=${HIGHLIGHT_QUERY_HASH}`,
          response: () => {
            highlightRequestCount += 1;
            return {
              body: highlightFixture,
              defer: highlightRequestCount === 1,
              ignoreAbort: highlightRequestCount === 1,
            };
          },
        },
        mediaRoute(mediaId),
      ],
      url: "https://www.instagram.com/stories/highlights/Highlight1/",
    });
    runtimes.push(app);
    const unhandledRejections = [];
    app.window.addEventListener("unhandledrejection", (event) => {
      unhandledRejections.push(event.reason);
      event.preventDefault();
    });
    const consoleError = vi.spyOn(app.window.console, "error");

    try {
      click(app, ".IG_DWHISTORY");
      await app.flushMicrotasks(30);
      const pendingRequest = app.deferredRequests.find((entry) =>
        entry.request.url.includes(`query_hash=${HIGHLIGHT_QUERY_HASH}`)
      )?.request;
      expect(pendingRequest).toBeDefined();
      expectLoadingState(app, true);

      app.window.history.pushState(
        {},
        "",
        "/stories/highlights/ReplacementHighlight/",
      );
      app.clock.runIntervalsOnce();
      await app.flushMicrotasks(30);

      expect(app.abortedRequests).toContain(pendingRequest);
      expectLoadingState(app, false);

      expect(app.resolveDeferredRequests(HIGHLIGHT_QUERY_HASH)).toBe(1);
      await app.flushMicrotasks(50);

      expect(app.downloads).toEqual([]);
      expect(app.anchorClicks).toEqual([]);
      expect(app.openedTabs).toEqual([]);
      expect(app.alerts).toEqual([]);
      expect(unhandledRejections).toEqual([]);
      expect(consoleError).not.toHaveBeenCalled();
      expectLoadingState(app, false);

      click(app, ".IG_DWHISTORY");
      await app.flushMicrotasks(60);

      expect(highlightRequestCount).toBe(2);
      expect(app.downloads).toHaveLength(1);
      expect(app.alerts).toEqual([]);
      expectLoadingState(app, false);
    } finally {
      consoleError.mockRestore();
    }
  });

  it.each([
    ["Story download", "story", "IG_DWSTORY"],
    ["Story download all", "story", "IG_DWSTORY_ALL"],
    ["Story new tab", "story", "IG_DWNEWTAB"],
    ["Story thumbnail", "story", "IG_DWSTORY_THUMBNAIL"],
    ["Highlight download", "highlight", "IG_DWHISTORY"],
    ["Highlight download all", "highlight", "IG_DWHISTORY_ALL"],
    ["Highlight new tab", "highlight", "IG_DWHINEWTAB"],
    ["Highlight thumbnail", "highlight", "IG_DWHISTORY_THUMBNAIL"],
  ])(
    "consumes the %s click before Instagram's document listener",
    async (_label, surface, actionClass) => {
      const isStory = surface === "story";
      const queryHash = isStory ? STORY_QUERY_HASH : HIGHLIGHT_QUERY_HASH;
      const mediaId = isStory
        ? "300000000000000102"
        : "300000000000000202";
      const app = await createCurrentUserscriptRuntime({
        html: isStory
          ? storyHtml({ actionClass })
          : highlightHtml(actionClass),
        network: [
          ...(isStory ? [userSearchRoute()] : []),
          {
            match: `query_hash=${queryHash}`,
            response: {
              body: isStory ? storyFixture : highlightFixture,
            },
          },
          mediaRoute(mediaId),
        ],
        url: isStory
          ? `https://www.instagram.com/stories/fixture_user/${mediaId}/`
          : "https://www.instagram.com/stories/highlights/Highlight1/",
      });
      runtimes.push(app);
      const instagramDocumentClick = vi.fn();
      app.document.addEventListener("click", instagramDocumentClick);

      const event = click(app, `.${actionClass}`);
      await app.flushMicrotasks(40);

      expect(event.defaultPrevented).toBe(true);
      expect(instagramDocumentClick).not.toHaveBeenCalled();
      expect(
        app.requests.filter((request) =>
          request.url.includes(`query_hash=${queryHash}`),
        ),
      ).toHaveLength(1);
      expect(mediaRequests(app)).toHaveLength(
        actionClass.endsWith("_ALL") ? 0 : 1,
      );
      expectLoadingState(app, false);
    },
  );

  it.each([
    ["Story", "story", STORY_QUERY_HASH],
    ["Highlight", "highlight", HIGHLIGHT_QUERY_HASH],
  ])(
    "joins repeated %s clicks to one pending action and releases the guard",
    async (_label, surface, queryHash) => {
      const isStory = surface === "story";
      const mediaId = isStory
        ? "300000000000000102"
        : "300000000000000202";
      const actionClass = isStory ? "IG_DWSTORY" : "IG_DWHISTORY";
      let queryResponseCount = 0;
      const app = await createCurrentUserscriptRuntime({
        html: isStory
          ? storyHtml({ actionClass })
          : highlightHtml(actionClass),
        network: [
          ...(isStory ? [userSearchRoute()] : []),
          {
            match: `query_hash=${queryHash}`,
            response: () => ({
              body: isStory ? storyFixture : highlightFixture,
              defer: queryResponseCount++ === 0,
            }),
          },
          mediaRoute(mediaId),
        ],
        url: isStory
          ? `https://www.instagram.com/stories/fixture_user/${mediaId}/`
          : "https://www.instagram.com/stories/highlights/Highlight1/",
      });
      runtimes.push(app);

      click(app, `.${actionClass}`);
      click(app, `.${actionClass}`);
      expectLoadingState(app, true);
      await app.flushMicrotasks(20);

      expect(
        app.requests.filter((request) =>
          request.url.includes(`query_hash=${queryHash}`),
        ),
      ).toHaveLength(1);
      expect(app.deferredRequests).toHaveLength(1);

      expect(app.resolveDeferredRequests(`query_hash=${queryHash}`)).toBe(1);
      await app.flushMicrotasks(40);

      expect(mediaRequests(app)).toHaveLength(1);
      expect(app.downloads).toHaveLength(1);
      expectLoadingState(app, false);

      click(app, `.${actionClass}`);
      await app.flushMicrotasks(40);
      expect(mediaRequests(app)).toHaveLength(2);
      expect(app.downloads).toHaveLength(2);
    },
  );

  it.each([
    ["Story username lookup", "story-user"],
    ["Story query", "story-query"],
    ["Highlight query", "highlight-query"],
    ["Story media metadata", "story-media"],
  ])(
    "times out a pending %s and always restores the loading state",
    async (_label, stage) => {
      const mediaId = "300000000000000102";
      const isHighlight = stage === "highlight-query";
      const pendingMatch =
        stage === "story-user"
          ? "/web/search/topsearch/"
          : stage === "highlight-query"
            ? `query_hash=${HIGHLIGHT_QUERY_HASH}`
            : stage === "story-media"
              ? `/api/v1/media/${mediaId}/info/`
              : `query_hash=${STORY_QUERY_HASH}`;
      const searchRoute = userSearchRoute();
      const storyQueryRoute = {
        match: `query_hash=${STORY_QUERY_HASH}`,
        response: { body: storyFixture },
      };
      const storyMediaRoute = mediaRoute(mediaId);
      const network = isHighlight
        ? [
            {
              match: `query_hash=${HIGHLIGHT_QUERY_HASH}`,
              response: { body: highlightFixture, defer: true },
            },
          ]
        : [
            stage === "story-user"
              ? {
                  ...searchRoute,
                  response: { ...searchRoute.response, defer: true },
                }
              : searchRoute,
            stage === "story-query"
              ? {
                  ...storyQueryRoute,
                  response: {
                    ...storyQueryRoute.response,
                    defer: true,
                  },
                }
              : storyQueryRoute,
            stage === "story-media"
              ? {
                  ...storyMediaRoute,
                  response: {
                    ...storyMediaRoute.response,
                    defer: true,
                  },
                }
              : storyMediaRoute,
          ];
      const app = await createCurrentUserscriptRuntime({
        html: isHighlight ? highlightHtml() : storyHtml(),
        network,
        storage: {
          FALLBACK_TO_BLOB_FETCH_IF_MEDIA_API_THROTTLED: false,
        },
        url: isHighlight
          ? "https://www.instagram.com/stories/highlights/Highlight1/"
          : `https://www.instagram.com/stories/fixture_user/${mediaId}/`,
      });
      runtimes.push(app);
      const unhandledRejections = [];
      app.window.addEventListener("unhandledrejection", (event) => {
        unhandledRejections.push(event.reason);
        event.preventDefault();
      });
      const consoleError = vi.spyOn(app.window.console, "error");

      try {
        click(app, isHighlight ? ".IG_DWHISTORY" : ".IG_DWSTORY");
        await app.flushMicrotasks(30);

        const pendingRequest = app.requests.find((request) =>
          request.url.includes(pendingMatch),
        );
        expect(pendingRequest?.timeout).toBe(15_000);
        expect(app.deferredRequests).toHaveLength(1);
        expectLoadingState(app, true);

        app.clock.runDue(14_999);
        await app.flushMicrotasks();
        expectLoadingState(app, true);
        expect(app.alerts).toEqual([]);

        app.clock.runDue(1);
        await app.flushMicrotasks(40);

        expect(app.deferredRequests).toHaveLength(0);
        expectLoadingState(app, false);
        expect(app.downloads).toEqual([]);
        expect(app.anchorClicks).toEqual([]);
        expect(app.openedTabs).toEqual([]);
        expect(app.alerts).toEqual([STORY_ACTION_FAILURE_MESSAGE]);
        expect(unhandledRejections).toEqual([]);
        expect(consoleError).toHaveBeenCalledTimes(1);
      } finally {
        consoleError.mockRestore();
      }
    },
  );

  it.each([
    ["network failure", { event: "error", error: { message: "blocked" } }],
    ["malformed response", { body: "{" }],
  ])(
    "reports one Story action error for a %s",
    async (_label, storyResponse) => {
      const searchRoute = userSearchRoute();
      const network =
        storyResponse.event === "error"
          ? [
              {
                ...searchRoute,
                response: storyResponse,
              },
            ]
          : [
              searchRoute,
              {
                match: `query_hash=${STORY_QUERY_HASH}`,
                response: storyResponse,
              },
            ];
      const app = await createCurrentUserscriptRuntime({
        html: storyHtml(),
        network,
        url: "https://www.instagram.com/stories/fixture_user/300000000000000102/",
      });
      runtimes.push(app);
      const consoleError = vi.spyOn(app.window.console, "error");

      try {
        click(app, ".IG_DWSTORY");
        await app.flushMicrotasks(40);

        expectLoadingState(app, false);
        expect(app.downloads).toEqual([]);
        expect(app.anchorClicks).toEqual([]);
        expect(app.openedTabs).toEqual([]);
        expect(app.alerts).toEqual([STORY_ACTION_FAILURE_MESSAGE]);
        expect(consoleError).toHaveBeenCalledTimes(1);
      } finally {
        consoleError.mockRestore();
      }
    },
  );

  it("silently aborts a deferred Story action when its route is disposed", async () => {
    const searchRoute = userSearchRoute();
    let searchCount = 0;
    const app = await createCurrentUserscriptRuntime({
      html: storyHtml(),
      network: [
        {
          ...searchRoute,
          response: () => ({
            ...searchRoute.response,
            defer: ++searchCount === 1,
          }),
        },
        {
          match: `query_hash=${STORY_QUERY_HASH}`,
          response: { body: storyFixture },
        },
        mediaRoute("300000000000000102"),
      ],
      url: "https://www.instagram.com/stories/fixture_user/300000000000000102/",
    });
    runtimes.push(app);

    const unhandledRejections = [];
    app.window.addEventListener("unhandledrejection", (event) => {
      unhandledRejections.push(event.reason);
      event.preventDefault();
    });
    const consoleError = vi.spyOn(app.window.console, "error");

    try {
      click(app, ".IG_DWSTORY");
      expectLoadingState(app, true);
      await app.flushMicrotasks(20);
      expect(app.deferredRequests).toHaveLength(1);
      const pendingRequest = app.deferredRequests[0].request;

      app.window.history.pushState({}, "", "/p/Post12345/");
      app.clock.runIntervalsOnce();
      await app.flushMicrotasks(30);

      expect(app.abortedRequests).toContain(pendingRequest);
      expect(unhandledRejections).toEqual([]);
      expect(consoleError).not.toHaveBeenCalled();
      expect(app.downloads).toEqual([]);
      expect(app.anchorClicks).toEqual([]);
      expect(app.openedTabs).toEqual([]);
      expect(app.alerts).toEqual([]);
      expectLoadingState(app, false);

      app.window.history.pushState(
        {},
        "",
        "/stories/fixture_user/300000000000000102/",
      );
      app.clock.runIntervalsOnce();
      await app.flushMicrotasks(20);
      click(app, ".IG_DWSTORY");
      await app.flushMicrotasks(40);

      expect(searchCount).toBe(2);
      expect(app.downloads).toHaveLength(1);
      expectLoadingState(app, false);
    } finally {
      consoleError.mockRestore();
    }
  });

  it.each([
    ["resource", ".IG_DWSTORY"],
    ["thumbnail", ".IG_DWSTORY_THUMBNAIL"],
  ])(
    "keeps a forced Story %s retry joined through route-abort cleanup",
    async (_label, actionSelector) => {
      const retryFixture = structuredClone(storyFixture);
      retryFixture.data.reels_media[0].items = [
        {
          id: "300000000000000102",
          is_video: true,
          taken_at_timestamp: 1_700_000_060,
        },
      ];
      const searchRoute = userSearchRoute();
      let searchCount = 0;
      const app = await createCurrentUserscriptRuntime({
        html: storyHtml({
          mediaMarkup: `
            <video class="story-video" playsinline></video>
            <button class="IG_DWSTORY_THUMBNAIL" type="button">Thumbnail action</button>
          `,
        }),
        network: [
          {
            match: searchRoute.match,
            response: () => ({
              ...searchRoute.response,
              defer: ++searchCount > 1,
            }),
          },
          {
            match: "query_hash=15463e8449a83d3d60b06be7e90627c7",
            response: { body: retryFixture },
          },
        ],
        storage: {
          FORCE_RESOURCE_VIA_MEDIA: false,
        },
        url: "https://www.instagram.com/stories/fixture_user/300000000000000102/",
      });
      runtimes.push(app);

      const section = app.document.querySelector("section");
      Object.defineProperties(section, {
        offsetHeight: { configurable: true, value: 1 },
        offsetWidth: { configurable: true, value: 1 },
      });
      section.getClientRects = () => [{ height: 1, width: 1 }];

      click(app, ".IG_DWSTORY");
      await app.flushMicrotasks(30);
      expect(searchCount).toBe(1);

      app.alerts.length = 0;
      const unhandledRejections = [];
      app.window.addEventListener("unhandledrejection", (event) => {
        unhandledRejections.push(event.reason);
        event.preventDefault();
      });
      const consoleError = vi.spyOn(app.window.console, "error");

      try {
        click(app, actionSelector);
        await app.flushMicrotasks(20);
        expect(app.deferredRequests).toHaveLength(1);
        const pendingRequest = app.deferredRequests[0].request;

        app.window.history.pushState({}, "", "/p/Post12345/");
        app.clock.runIntervalsOnce();
        await app.flushMicrotasks(30);

        expect(app.abortedRequests).toContain(pendingRequest);
        expect(unhandledRejections).toEqual([]);
        expect(consoleError).not.toHaveBeenCalled();
        expect(app.downloads).toEqual([]);
        expect(app.anchorClicks).toEqual([]);
        expect(app.openedTabs).toEqual([]);
        expect(app.alerts).toEqual([]);
        expectLoadingState(app, false);
      } finally {
        consoleError.mockRestore();
      }
    },
  );

  it.each(["IG_DWSTORY", "IG_DWSTORY_THUMBNAIL"])(
    "uses the explicit Story route ID for .%s",
    async (actionClass) => {
      const app = await createStoryRuntime({
        actionClass,
        url: "https://www.instagram.com/stories/fixture_user/300000000000000102/",
      });

      click(app, `.${actionClass}`);
      await app.flushMicrotasks(30);

      expect(mediaRequests(app)).toHaveLength(1);
      expect(mediaRequests(app)[0].url).toContain(
        "/api/v1/media/300000000000000102/info/",
      );
      expect(app.downloads).toHaveLength(1);
    },
  );

  it("uses the visible timestamp before progress/layout Story fallbacks", async () => {
    const app = await createStoryRuntime({
      datetime: "2023-11-14T22:14:20.000Z",
      url: "https://www.instagram.com/stories/fixture_user/",
    });
    const time = app.document.querySelector("time[datetime]");
    Object.defineProperty(time, "offsetWidth", {
      configurable: true,
      value: 1,
    });
    time.getClientRects = () => [{ height: 1, width: 1 }];

    click(app, ".IG_DWSTORY");
    await app.flushMicrotasks(30);

    expect(mediaRequests(app)).toHaveLength(1);
    expect(mediaRequests(app)[0].url).toContain(
      "/api/v1/media/300000000000000102/info/",
    );
  });

  it("preserves the direct Story preview URL and dispatches no download", async () => {
    const app = await createStoryRuntime({
      actionClass: "IG_DWNEWTAB",
      url: "https://www.instagram.com/stories/fixture_user/300000000000000102/",
    });

    click(app, ".IG_DWNEWTAB");
    await app.flushMicrotasks(30);

    expect(app.downloads).toHaveLength(0);
    expect(app.anchorClicks).toContainEqual({
      download: "",
      href:
        "https://scontent.cdninstagram.com/300000000000000102.jpg",
      target: "_blank",
    });
  });

  it("retains the DASH video choice for a Story preview", async () => {
    const mediaId = "300000000000000102";
    const app = await createCurrentUserscriptRuntime({
      html: storyHtml({ actionClass: "IG_DWNEWTAB" }),
      network: [
        userSearchRoute(),
        {
          match: "query_hash=15463e8449a83d3d60b06be7e90627c7",
          response: { body: storyFixture },
        },
        videoMediaRoute(mediaId),
      ],
      url: `https://www.instagram.com/stories/fixture_user/${mediaId}/`,
    });
    runtimes.push(app);

    click(app, ".IG_DWNEWTAB");
    await app.flushMicrotasks(30);

    expect(app.downloads).toHaveLength(0);
    expect(app.anchorClicks.at(-1)).toMatchObject({
      href: "https://cdn.example.test/video-only.mp4",
      target: "_blank",
    });
  });

  it("retains an original Highlight DASH item after manifest-less Media API enrichment", async () => {
    const mediaId = "300000000000000202";
    const dashHighlightFixture = structuredClone(highlightFixture);
    const originalVideo = dashHighlightFixture.data.reels_media[0].items[1];
    originalVideo.has_audio = false;
    originalVideo.video_dash_manifest = videoOnlyDashManifest;
    originalVideo.video_versions = [
      {
        url: "https://scontent.cdninstagram.com/highlight-2.mp4",
        width: 1080,
        height: 1920,
      },
    ];
    const app = await createCurrentUserscriptRuntime({
      html: highlightHtml("IG_DWHISTORY_ALL"),
      network: [
        {
          match: "query_hash=45246d3fe16ccc6577e0bd297a5db1ab",
          response: { body: dashHighlightFixture },
        },
        manifestlessVideoMediaRoute(mediaId),
      ],
      storage: {
        DIRECT_DOWNLOAD_STORY: true,
        FORCE_RESOURCE_VIA_MEDIA: true,
        PREFER_DASH_MANIFEST: true,
      },
      url: "https://www.instagram.com/stories/highlights/Highlight1/",
    });
    runtimes.push(app);

    click(app, ".IG_DWHISTORY_ALL");
    await app.flushMicrotasks(20);
    app.clock.runDue(100);
    await app.flushMicrotasks(40);

    expect(mediaRequests(app)).toHaveLength(1);
    expect(mediaRequests(app)[0].url).toContain(
      `/api/v1/media/${mediaId}/info/`,
    );
    expect(app.downloads.map(({ url }) => url)).toEqual([
      "https://scontent.cdninstagram.com/highlight-1.jpg",
      "https://cdn.example.test/video-only.mp4",
    ]);
  });

  it("keeps Story thumbnail filename metadata on the Story surface", async () => {
    const app = await createCurrentUserscriptRuntime({
      html: storyHtml({ actionClass: "IG_DWSTORY_THUMBNAIL" }),
      network: [
        userSearchRoute(),
        {
          match: "query_hash=15463e8449a83d3d60b06be7e90627c7",
          response: { body: storyFixture },
        },
        mediaRoute("300000000000000102"),
      ],
      storage: {
        G_RENAME_FORMAT: "%SOURCE_TYPE%-%SHORTCODE%-%INDEX%",
      },
      url: "https://www.instagram.com/stories/fixture_user/300000000000000102/",
    });
    runtimes.push(app);

    click(app, ".IG_DWSTORY_THUMBNAIL");
    await app.flushMicrotasks(30);

    expect(app.downloads).toHaveLength(1);
    expect(app.downloads[0].name).toBe(
      "stories-300000000000000102-0.jpg",
    );
  });

  it.each(["IG_DWHISTORY", "IG_DWHISTORY_THUMBNAIL"])(
    "uses the Highlight reverse-progress item for .%s and reuses its response cache",
    async (actionClass) => {
      const mediaId = "300000000000000202";
      const app = await createCurrentUserscriptRuntime({
        html: highlightHtml(actionClass),
        url: "https://www.instagram.com/stories/highlights/Highlight1/",
        network: [
          {
            match: "query_hash=45246d3fe16ccc6577e0bd297a5db1ab",
            response: { body: highlightFixture },
          },
          mediaRoute(mediaId),
        ],
      });
      runtimes.push(app);

      click(app, `.${actionClass}`);
      await app.flushMicrotasks(30);
      click(app, `.${actionClass}`);
      await app.flushMicrotasks(30);

      const highlightRequests = app.requests.filter((request) =>
        request.url.includes("query_hash=45246d3fe16ccc6577e0bd297a5db1ab"),
      );
      expect(highlightRequests).toHaveLength(1);
      expect(mediaRequests(app)).toHaveLength(2);
      expect(mediaRequests(app)[0].url).toContain(
        "/api/v1/media/300000000000000202/info/",
      );
    },
  );

  it("keeps Highlight thumbnail source and route-ID filename metadata", async () => {
    const app = await createCurrentUserscriptRuntime({
      html: highlightHtml("IG_DWHISTORY_THUMBNAIL"),
      network: [
        {
          match: "query_hash=45246d3fe16ccc6577e0bd297a5db1ab",
          response: { body: highlightFixture },
        },
        mediaRoute("300000000000000202"),
      ],
      storage: {
        G_RENAME_FORMAT: "%SOURCE_TYPE%-%SHORTCODE%-%INDEX%",
      },
      url: "https://www.instagram.com/stories/highlights/Highlight1/",
    });
    runtimes.push(app);

    click(app, ".IG_DWHISTORY_THUMBNAIL");
    await app.flushMicrotasks(30);

    expect(app.downloads).toHaveLength(1);
    expect(app.downloads[0].name).toBe("highlights-Highlight1-0.jpg");
  });

  it("deletes and refetches the Highlight response before rate-limit fallback", async () => {
    const mediaId = "300000000000000202";
    const fallbackFixture = structuredClone(highlightFixture);
    const fallbackItem = fallbackFixture.data.reels_media[0].items[1];
    fallbackItem.has_audio = false;
    fallbackItem.video_dash_manifest = videoOnlyDashManifest;
    fallbackItem.video_versions = [
      { url: "https://cdn.example.test/outer-dash-must-not-run.mp4" },
    ];
    const app = await createCurrentUserscriptRuntime({
      html: highlightHtml("IG_DWHISTORY"),
      network: [
        {
          match: "query_hash=45246d3fe16ccc6577e0bd297a5db1ab",
          response: { body: fallbackFixture },
        },
        {
          match: `/api/v1/media/${mediaId}/info/`,
          response: {
            body: { message: "Please wait a few minutes", status: "fail" },
          },
        },
      ],
      storage: {
        FALLBACK_TO_BLOB_FETCH_IF_MEDIA_API_THROTTLED: true,
        G_RENAME_FORMAT: "%SOURCE_TYPE%-%SHORTCODE%-%INDEX%",
      },
      url: "https://www.instagram.com/stories/highlights/Highlight1/",
    });
    runtimes.push(app);

    click(app, ".IG_DWHISTORY");
    await app.flushMicrotasks(50);

    expect(
      app.requests.filter((request) =>
        request.url.includes(
          "query_hash=45246d3fe16ccc6577e0bd297a5db1ab",
        ),
      ),
    ).toHaveLength(2);
    expect(mediaRequests(app)).toHaveLength(1);
    expect(app.downloads).toHaveLength(1);
    expect(app.downloads[0]).toMatchObject({
      name: `highlights-${mediaId}-0.mp4`,
      url: "https://scontent.cdninstagram.com/highlight-2.mp4",
    });
    expect(app.alerts).toEqual([]);
  });

  it("reports a Story Media API failure without downloading when fallback is disabled", async () => {
    const mediaId = "300000000000000102";
    const app = await createCurrentUserscriptRuntime({
      html: storyHtml(),
      network: [
        userSearchRoute(),
        {
          match: "query_hash=15463e8449a83d3d60b06be7e90627c7",
          response: { body: storyFixture },
        },
        {
          match: `/api/v1/media/${mediaId}/info/`,
          response: {
            body: { message: "Please wait a few minutes", status: "fail" },
          },
        },
      ],
      storage: {
        FALLBACK_TO_BLOB_FETCH_IF_MEDIA_API_THROTTLED: false,
        FORCE_RESOURCE_VIA_MEDIA: true,
      },
      url: `https://www.instagram.com/stories/fixture_user/${mediaId}/`,
    });
    runtimes.push(app);

    click(app, ".IG_DWSTORY");
    await app.flushMicrotasks(30);

    expect(mediaRequests(app)).toHaveLength(1);
    expect(app.downloads).toHaveLength(0);
    expect(app.alerts).toEqual([
      "Fetch failed from Media API. API response message: Please wait a few minutes",
    ]);
  });

  it("retains the native Story image double-cache lookup", async () => {
    const decodedMediaId = "story-native-image";
    const firstCacheResult = "story-native-cache-key";
    const nestedCachedUrl =
      "https://scontent.cdninstagram.com/story-native-cached.jpg";
    const cacheKey = Buffer.from(decodedMediaId).toString("base64");
    const sourceUrl =
      `https://scontent.cdninstagram.com/story-native.jpg?ig_cache_key=${cacheKey}.1`;
    const app = await createCurrentUserscriptRuntime({
      html: storyHtml({
        mediaMarkup:
          `<img class="story-image" referrerpolicy="origin" srcset="${sourceUrl} 1080w">`,
      }),
      storage: {
        CAPTURE_IMAGE_VIA_MEDIA_CACHE: true,
        FORCE_RESOURCE_VIA_MEDIA: false,
        URLS_OF_IMAGES_TEMPORARILY_STORED: {
          [decodedMediaId]: { ts: Date.now(), url: firstCacheResult },
          [firstCacheResult]: { ts: Date.now(), url: nestedCachedUrl },
        },
      },
      url: "https://www.instagram.com/stories/fixture_user/",
    });
    runtimes.push(app);
    const section = app.document.querySelector("section");
    Object.defineProperties(section, {
      offsetHeight: { configurable: true, value: 1 },
      offsetWidth: { configurable: true, value: 1 },
    });
    section.getClientRects = () => [{ height: 1, width: 1 }];

    click(app, ".IG_DWSTORY");
    await app.flushMicrotasks(30);

    expect(mediaRequests(app)).toHaveLength(0);
    expect(app.downloads).toHaveLength(1);
    expect(app.downloads[0].url).toBe(nestedCachedUrl);
  });
});
