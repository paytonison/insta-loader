// @vitest-environment node

import { readFileSync } from "node:fs";

import { afterEach, describe, expect, it } from "vitest";

import { createUserscriptRuntime } from "./helpers/userscript-runtime.js";

const mediaApiResponse = JSON.parse(
  readFileSync(new URL("../fixtures/json/media-api.json", import.meta.url), "utf8"),
);

const runtimes = [];

afterEach(() => {
  while (runtimes.length) runtimes.pop().dispose();
});

async function runtime(options = {}) {
  const value = await createUserscriptRuntime({
    network: [
      {
        match: "/api/v1/media/",
        response: { body: mediaApiResponse },
      },
    ],
    ...options,
    url: "https://www.instagram.com/p/Post12345/",
  });
  runtimes.push(value);
  return value;
}

function appendMediaRow(app) {
  const popup = app.document.createElement("div");
  popup.className = "IG_POPUP_DIG";
  popup.innerHTML = `
    <div class="IG_POPUP_DIG_BODY">
      <div class="fixture-media-row">
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
        ><img src="https://scontent.cdninstagram.com/v/t51.2885-15/post-thumb.jpg" alt="fixture"></a>
        <div class="newTab"><span class="new-tab-glyph">open</span></div>
        <div class="videoThumbnail"><span>thumbnail</span></div>
      </div>
    </div>`;
  app.document.body.appendChild(popup);
  return popup;
}

function mediaRequests(app) {
  return app.requests.filter((request) => request.url.includes("/api/v1/media/"));
}

function bodyClickHandlerCount(app) {
  return app.window.jQuery._data(app.document.body, "events")?.click?.length || 0;
}

describe("delegated media click routing", () => {
  it("dispatches a direct media anchor exactly once", async () => {
    const app = await runtime();
    const popup = appendMediaRow(app);
    const baseline = mediaRequests(app).length;

    popup.querySelector("a[data-needed='direct']").dispatchEvent(
      new app.window.MouseEvent("click", { bubbles: true, cancelable: true }),
    );
    await app.flushMicrotasks(12);

    expect(mediaRequests(app)).toHaveLength(baseline + 1);
    expect(app.downloads).toHaveLength(1);
  });

  it("downloads a legacy DOM row without a canonical media ID when Media API forcing is disabled", async () => {
    const app = await runtime({
      storage: {
        CAPTURE_IMAGE_VIA_MEDIA_CACHE: false,
        FORCE_RESOURCE_VIA_MEDIA: false,
      },
    });
    const popup = appendMediaRow(app);
    const anchor = popup.querySelector("a[data-needed='direct']");
    anchor.removeAttribute("media-id");
    const baseline = mediaRequests(app).length;

    anchor.dispatchEvent(
      new app.window.MouseEvent("click", { bubbles: true, cancelable: true }),
    );
    await app.flushMicrotasks(12);

    expect(mediaRequests(app)).toHaveLength(baseline);
    expect(app.downloads).toHaveLength(1);
  });

  it("routes a popup new-tab action without falling through to download", async () => {
    const app = await runtime();
    const popup = appendMediaRow(app);
    const baseline = mediaRequests(app).length;

    popup.querySelector(".new-tab-glyph").dispatchEvent(
      new app.window.MouseEvent("click", { bubbles: true, cancelable: true }),
    );
    await app.flushMicrotasks(12);

    expect(mediaRequests(app)).toHaveLength(baseline + 1);
    expect(app.downloads).toHaveLength(0);
    expect(app.anchorClicks).toContainEqual(
      expect.objectContaining({
        href: "https://scontent.cdninstagram.com/v/t51.2885-15/post-full.jpg",
        target: "_blank",
      }),
    );
  });

  it.each(["IG_NEWTAB_MAIN", "IG_DW_ALL_MAIN", "IG_IMAGE_VIEWER"])(
    "does not treat a nested .%s action as a direct-anchor click",
    async (className) => {
      const app = await runtime();
      const anchor = app.document.createElement("a");
      anchor.setAttribute("data-needed", "direct");
      anchor.setAttribute("media-id", "300000000000000001");
      anchor.innerHTML = `<span class="${className}"><span class="glyph">action</span></span>`;
      app.document.body.appendChild(anchor);
      const baseline = mediaRequests(app).length;

      anchor.querySelector(".glyph").dispatchEvent(
        new app.window.MouseEvent("click", { bubbles: true, cancelable: true }),
      );
      await app.flushMicrotasks();

      expect(mediaRequests(app)).toHaveLength(baseline);
      expect(app.downloads).toHaveLength(0);
    },
  );

  it("keeps controls and delegated actions single across route changes and reloads", async () => {
    const app = await runtime();
    const initialClickHandlers = bodyClickHandlerCount(app);

    expect(initialClickHandlers).toBeGreaterThan(0);

    for (let index = 0; index < 3; index += 1) {
      app.window.history.pushState({}, "", `/reels/Fixture${index}/`);
      app.clock.runIntervalsOnce();
      await app.flushMicrotasks();

      app.window.history.pushState({}, "", "/p/Post12345/");
      app.clock.runIntervalsOnce();
      await app.flushMicrotasks();

      const routeControl = app.document.createElement("div");
      routeControl.className = "IG_REELS_CONTROLS";
      routeControl.dataset.instaLoaderControls = "reels";
      app.document.body.appendChild(routeControl);
      app.menuByAccessKey("r").callback();

      expect(
        app.document.querySelectorAll('[data-insta-loader-controls="reels"]'),
      ).toHaveLength(0);
    }

    expect(bodyClickHandlerCount(app)).toBe(initialClickHandlers);

    const popup = appendMediaRow(app);
    const baselineRequests = mediaRequests(app).length;
    popup.querySelector("a[data-needed='direct']").dispatchEvent(
      new app.window.MouseEvent("click", {
        bubbles: true,
        cancelable: true,
      }),
    );
    await app.flushMicrotasks(12);

    expect(mediaRequests(app)).toHaveLength(baselineRequests + 1);
    expect(app.downloads).toHaveLength(1);
  });
});
