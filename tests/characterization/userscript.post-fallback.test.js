// @vitest-environment node

import { readFileSync } from "node:fs";

import { afterEach, beforeAll, describe, expect, it } from "vitest";

import { buildUserscript } from "../../scripts/build.mjs";
import { createUserscriptRuntime } from "./helpers/userscript-runtime.js";

const postControlsHtml = readFileSync(
  new URL("../fixtures/html/post-controls.html", import.meta.url),
  "utf8",
);
const legacyPostResponse = JSON.parse(
  readFileSync(
    new URL("../fixtures/json/legacy-query-hash.json", import.meta.url),
    "utf8",
  ),
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

function makeVisible(element, width = 640, height = 640) {
  const rect = {
    bottom: height,
    height,
    left: 0,
    right: width,
    top: 0,
    width,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  };
  Object.defineProperties(element, {
    offsetHeight: { configurable: true, value: height },
    offsetWidth: { configurable: true, value: width },
  });
  element.getBoundingClientRect = () => rect;
  element.getClientRects = () => [rect];
}

async function mountPostControls(app) {
  [
    "[data-fixture='post-controls']",
    ".post-surface",
    ".media-layout",
    "[data-fixture='post-media-target']",
    "[data-fixture='post-media-target'] a",
    "[data-fixture='post-media-target'] img",
  ].forEach((selector) => makeVisible(app.document.querySelector(selector)));

  app.clock.runIntervalsOnce();
  app.clock.runDue(15);
  app.clock.runIntervalsOnce();
  app.clock.runDue(50);
  await app.flushMicrotasks();
}

describe("post control fallback without IntersectionObserver", () => {
  it("mounts the complete image-post control group without throwing", async () => {
    const app = await createUserscriptRuntime({
      html: postControlsHtml,
      missingApis: ["IntersectionObserver"],
      url: "https://www.instagram.com/p/Post12345/",
    });
    runtimes.push(app);

    await mountPostControls(app);

    const wrappers = app.document.querySelectorAll(".button_wrapper");
    expect(app.window.IntersectionObserver).toBeUndefined();
    expect(app.observers.intersectionObservers).toHaveLength(0);
    expect(wrappers).toHaveLength(1);
    expect(wrappers[0].querySelectorAll(":scope > .IG_DW_MAIN")).toHaveLength(1);
    expect(wrappers[0].querySelectorAll(":scope > .IG_NEWTAB_MAIN")).toHaveLength(
      1,
    );
    expect(wrappers[0].querySelectorAll(":scope > .IG_IMAGE_VIEWER")).toHaveLength(
      1,
    );
    expect(wrappers[0].querySelector(".IG_DW_ALL_MAIN")).toBeNull();
    expect(wrappers[0].querySelector(".IG_THUMBNAIL_MAIN")).toBeNull();
  });

  it("releases source-bundle post action handlers with their route scope", async () => {
    const app = await createUserscriptRuntime({
      html: postControlsHtml,
      missingApis: ["IntersectionObserver"],
      network: [
        {
          match: "query_hash=2c4c2e343a8f64c625ba02b2aa12c7f8",
          response: { body: legacyPostResponse },
        },
      ],
      url: "https://www.instagram.com/p/Post12345/",
      userscriptSource: currentUserscriptSource,
    });
    runtimes.push(app);

    await mountPostControls(app);

    const post = app.document.querySelector("[data-fixture='post-controls']");
    expect(app.document.querySelectorAll(".button_wrapper")).toHaveLength(1);
    expect(app.window.jQuery._data(post, "events")?.click || []).toHaveLength(5);
    expect(post.getAttribute("data-snig")).toBe("canDownload");

    post.querySelector(".IG_IMAGE_VIEWER").dispatchEvent(
      new app.window.MouseEvent("click", {
        bubbles: true,
        cancelable: true,
      }),
    );
    await app.flushMicrotasks(20);

    expect(
      app.requests.filter((request) =>
        request.url.includes("query_hash=2c4c2e343a8f64c625ba02b2aa12c7f8"),
      ),
    ).toHaveLength(1);
    expect(app.document.querySelectorAll("#imageViewer")).toHaveLength(1);

    app.window.history.pushState({}, "", "/stories/fixture_user/1/");
    app.clock.runIntervalsOnce();
    await app.flushMicrotasks();

    expect(app.window.jQuery._data(post, "events")?.click || []).toHaveLength(0);
    expect(post.hasAttribute("data-snig")).toBe(false);
    expect(app.document.querySelectorAll(".button_wrapper")).toHaveLength(0);
  });
});
