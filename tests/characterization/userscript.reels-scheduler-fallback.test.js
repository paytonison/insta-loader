// @vitest-environment node

import { readFileSync } from "node:fs";

import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { buildUserscript } from "../../scripts/build.mjs";
import { createUserscriptRuntime } from "./helpers/userscript-runtime.js";

const reelsControlsHtml = readFileSync(
  new URL("../fixtures/html/reels-controls.html", import.meta.url),
  "utf8",
);
const runtimeVariants = ["committed artifact", "current source build"];
const runtimes = [];
let currentUserscriptSource;

beforeAll(async () => {
  const contents = await buildUserscript({ write: false });
  currentUserscriptSource = new TextDecoder().decode(contents);
});

afterEach(() => {
  while (runtimes.length) runtimes.pop().dispose();
});

async function runtime(variant) {
  const app = await createUserscriptRuntime({
    html: reelsControlsHtml,
    missingApis: ["requestIdleCallback", "requestVideoFrameCallback"],
    url: "https://www.instagram.com/reels/FeedReel1/",
    userscriptSource:
      variant === "current source build" ? currentUserscriptSource : undefined,
  });
  runtimes.push(app);

  const actionRail = app.document.querySelector("[data-fixture-action-rail]");
  actionRail.getBoundingClientRect = vi.fn(() => ({
    bottom: 280,
    height: 240,
    left: 850,
    right: 914,
    top: 40,
    width: 64,
    x: 850,
    y: 40,
    toJSON: () => ({}),
  }));
  return app;
}

function startReelsButtonSchedule(app) {
  app.clock.runDue(150);
  app.clock.runIntervalsOnce();
}

function finishLoadedDataFallback(app) {
  const video = app.document.querySelector("video");
  video.dispatchEvent(new app.window.Event("loadeddata"));
  video.dispatchEvent(new app.window.Event("loadeddata"));
  app.clock.runDue(1000);
  app.clock.runDue(250);
}

describe.each(runtimeVariants)(
  "Reels scheduler fallbacks in the %s",
  (variant) => {
    it("mounts exactly one control group without idle or video-frame callbacks", async () => {
      const app = await runtime(variant);

      expect(app.window.requestIdleCallback).toBeUndefined();
      expect(
        app.window.HTMLMediaElement.prototype.requestVideoFrameCallback,
      ).toBeUndefined();

      startReelsButtonSchedule(app);
      finishLoadedDataFallback(app);

      expect(app.document.querySelectorAll(".IG_REELS_CONTROLS")).toHaveLength(1);
      expect(
        app.document.querySelectorAll(".IG_REELS_CONTROLS > div"),
      ).toHaveLength(3);

      // The watchdog reaches queueInstall after loadeddata, but its one-shot
      // guard must not create a second control group.
      app.clock.runDue(1000);
      expect(app.document.querySelectorAll(".IG_REELS_CONTROLS")).toHaveLength(1);
    });

    it("cancels the pending timeout and loadeddata fallback on teardown", async () => {
      const app = await runtime(variant);
      const video = app.document.querySelector("video");

      startReelsButtonSchedule(app);
      const pendingWatchdog = app.clock
        .pending()
        .find((task) => task.kind === "timeout" && task.delay === 2000);
      expect(pendingWatchdog).toBeDefined();
      expect(
        app.window.jQuery("[data-fixture='reels-controls']").data(
          "insta-loader-reels-controls-pending",
        ),
      ).toBe(true);

      app.window.history.pushState({}, "", "/p/Post12345/");
      app.clock.runIntervalsOnce();

      expect(
        app.clock.pending().some((task) => task.id === pendingWatchdog.id),
      ).toBe(false);
      expect(
        app.window.jQuery("[data-fixture='reels-controls']").data(
          "insta-loader-reels-controls-pending",
        ),
      ).toBeUndefined();

      video.dispatchEvent(new app.window.Event("loadeddata"));
      app.clock.runDue(2500);
      expect(app.document.querySelector(".IG_REELS_CONTROLS")).toBeNull();
    });
  },
);
