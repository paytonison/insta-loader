// @vitest-environment node

import { readFileSync } from "node:fs";

import { afterEach, beforeAll, describe, expect, it } from "vitest";

import { buildUserscript } from "../../scripts/build.mjs";
import { createUserscriptRuntime } from "./helpers/userscript-runtime.js";

const standaloneReelHtml = readFileSync(
  new URL("../fixtures/html/standalone-reel.html", import.meta.url),
  "utf8",
);
const reelsFeedHtml = readFileSync(
  new URL("../fixtures/html/reels-feed.html", import.meta.url),
  "utf8",
);
const queryIdResponse = JSON.parse(
  readFileSync(new URL("../fixtures/json/query-id.json", import.meta.url), "utf8"),
);

const runtimes = [];
let currentUserscriptSource;

beforeAll(async () => {
  const contents = await buildUserscript({ write: false });
  currentUserscriptSource = new TextDecoder().decode(contents);
});

afterEach(() => {
  while (runtimes.length) runtimes.pop().dispose();
});

async function runtime(options) {
  const value = await createUserscriptRuntime(options);
  runtimes.push(value);
  return value;
}

function metadataRequests(app) {
  return app.requests.filter((request) => request.url.includes("/graphql/query/"));
}

function playVideo(app, selector = "video") {
  const video = app.makeVideoActive(app.document.querySelector(selector));
  video.dispatchEvent(new app.window.Event("play", { bubbles: false }));
  return video;
}

describe("maximum-quality Reel route boundary", () => {
  it.each([
    "https://www.instagram.com/reels/",
    "https://www.instagram.com/reels/FeedReel1/",
    "https://www.instagram.com/fixture_user/reels/FeedReel1/",
  ])("leaves plural feed players entirely native on %s", async (url) => {
    const app = await runtime({ html: reelsFeedHtml, url });
    const requestBaseline = metadataRequests(app).length;
    const actionBaseline = app.mediaActions.length;
    const video = playVideo(app, "video[data-fixture-reel='FeedReel1']");
    await app.flushMicrotasks();

    expect(metadataRequests(app)).toHaveLength(requestBaseline);
    expect(app.mediaActions.slice(actionBaseline)).toEqual([]);
    expect(app.document.querySelector(".insta-loader-reel-quality-hold")).toBeNull();
    expect(video.getAttribute("src")).toBe("blob:https://www.instagram.com/native-feed-1");
  });

  it.each([
    "https://www.instagram.com/reel/Standalone1/",
    "https://www.instagram.com/fixture_user/reel/Standalone1/",
    "https://www.instagram.com/reel/Standalone1/embed",
  ])("starts the bounded handoff on singular route %s", async (url) => {
    const app = await runtime({
      html: standaloneReelHtml,
      network: [
        {
          match: "/graphql/query/",
          response: { body: queryIdResponse },
        },
      ],
      url,
    });
    app.menuByAccessKey("r").callback();
    await app.flushMicrotasks();
    const requestBaseline = metadataRequests(app).length;
    const actionBaseline = app.mediaActions.length;
    playVideo(app);
    await app.flushMicrotasks();

    expect(metadataRequests(app)).toHaveLength(requestBaseline + 1);
    expect(app.mediaActions.slice(actionBaseline).some((action) => action.type === "pause")).toBe(true);
    expect(app.document.querySelector(".insta-loader-reel-quality-hold")).not.toBeNull();
  });

  it("remounts the source capture listener after a full application reload", async () => {
    const app = await runtime({
      html: standaloneReelHtml,
      network: [
        {
          match: "/graphql/query/",
          response: { body: queryIdResponse },
        },
      ],
      url: "https://www.instagram.com/reel/Standalone1/",
      userscriptSource: currentUserscriptSource,
    });

    app.menuByAccessKey("r").callback();
    await app.flushMicrotasks();
    const requestBaseline = metadataRequests(app).length;

    playVideo(app);
    await app.flushMicrotasks();

    expect(metadataRequests(app)).toHaveLength(requestBaseline + 1);
    expect(app.document.querySelector(".insta-loader-reel-quality-hold")).not.toBeNull();
  });

  it("uses the singular-Reel fallback when IntersectionObserver is unavailable", async () => {
    const app = await runtime({
      html: standaloneReelHtml,
      missingApis: ["IntersectionObserver"],
      network: [
        {
          match: "/graphql/query/",
          response: { body: queryIdResponse },
        },
      ],
      url: "https://www.instagram.com/reel/Standalone1/",
    });
    const requestBaseline = metadataRequests(app).length;
    const actionBaseline = app.mediaActions.length;

    playVideo(app);
    await app.flushMicrotasks();

    expect(app.window.IntersectionObserver).toBeUndefined();
    expect(app.observers.intersectionObservers).toHaveLength(0);
    expect(metadataRequests(app)).toHaveLength(requestBaseline + 1);
    expect(
      app.mediaActions
        .slice(actionBaseline)
        .some((action) => action.type === "pause"),
    ).toBe(true);
    expect(
      app.document.querySelector(".insta-loader-reel-quality-hold"),
    ).not.toBeNull();
  });

  it("keeps a pre-poll singular metadata request out of the stale plural route scope", async () => {
    const app = await runtime({
      defaultNetworkResponse: { body: {}, defer: true },
      html: reelsFeedHtml,
      network: [
        {
          match: "/graphql/query/",
          response: { body: queryIdResponse, defer: true },
        },
      ],
      url: "https://www.instagram.com/reels/FeedReel1/",
    });
    const requestBaseline = metadataRequests(app).length;

    app.window.history.pushState({}, "", "/reel/FeedReel1/");
    playVideo(app, "video[data-fixture-reel='FeedReel1']");
    await app.flushMicrotasks();

    const metadataRequest = metadataRequests(app).at(-1);
    expect(metadataRequests(app)).toHaveLength(requestBaseline + 1);
    expect(metadataRequest).toBeDefined();
    expect(app.deferredRequests.some(({ request }) => request === metadataRequest)).toBe(
      true,
    );

    app.clock.runIntervalsOnce();
    await app.flushMicrotasks();

    expect(app.abortedRequests).not.toContain(metadataRequest);
    expect(app.deferredRequests.some(({ request }) => request === metadataRequest)).toBe(
      true,
    );
  });

  it("does not take Reel ownership on an ordinary post route", async () => {
    const app = await runtime({
      html: standaloneReelHtml,
      url: "https://www.instagram.com/p/Post12345/",
    });
    const requestBaseline = metadataRequests(app).length;
    const actionBaseline = app.mediaActions.length;
    playVideo(app);
    await app.flushMicrotasks();

    expect(metadataRequests(app)).toHaveLength(requestBaseline);
    expect(app.mediaActions.slice(actionBaseline)).toEqual([]);
  });
});
