// @vitest-environment node

import { afterEach, beforeAll, describe, expect, it } from "vitest";

import { buildUserscript } from "../../scripts/build.mjs";
import { createUserscriptRuntime } from "./helpers/userscript-runtime.js";

const runtimes = [];
let currentUserscriptSource;

beforeAll(async () => {
  const contents = await buildUserscript({ write: false });
  currentUserscriptSource = new TextDecoder().decode(contents);
});

afterEach(() => {
  while (runtimes.length) runtimes.pop().dispose();
});

function mediaRowHtml() {
  return `<!doctype html>
    <html style="display:block;visibility:visible;opacity:1">
      <head>
        <script type="application/json">{"APP_ID":"936619743392459"}</script>
      </head>
      <body style="display:block;visibility:visible;opacity:1">
        <div id="mount_0"></div>
        <div class="IG_POPUP_DIG">
          <div class="IG_POPUP_DIG_BODY">
            <a
              data-needed="direct"
              data-path="Post12345"
              data-name="photo"
              data-type="jpg"
              data-username="fixture_user"
              data-globalindex="1"
              data-href="https://scontent.cdninstagram.com/pending.jpg"
              href="javascript:;"
            >pending media</a>
          </div>
        </div>
      </body>
    </html>`;
}

async function runtime() {
  const app = await createUserscriptRuntime({
    deferDownloads: true,
    html: mediaRowHtml(),
    storage: {
      FORCE_RESOURCE_VIA_MEDIA: false,
      MODIFY_RESOURCE_EXIF: false,
    },
    url: "https://www.instagram.com/p/Post12345/",
    userscriptSource: currentUserscriptSource,
  });
  runtimes.push(app);
  return app;
}

function startPendingDownload(app) {
  app.document.querySelector("a[data-needed='direct']").dispatchEvent(
    new app.window.MouseEvent("click", {
      bubbles: true,
      cancelable: true,
    }),
  );
}

describe("route-owned download lifecycle", () => {
  it("aborts a pending direct GM download when SPA navigation disposes the route", async () => {
    const app = await runtime();

    startPendingDownload(app);
    await app.flushMicrotasks(12);
    expect(app.downloads).toHaveLength(1);
    expect(app.abortedDownloads).toHaveLength(0);

    app.window.history.pushState({}, "", "/reels/");
    app.clock.runIntervalsOnce();
    await app.flushMicrotasks(12);

    expect(app.abortedDownloads).toEqual([app.downloads[0]]);
    expect(app.downloads).toHaveLength(1);
  });

  it("aborts a pending direct GM download when Manual Reload disposes the route", async () => {
    const app = await runtime();

    startPendingDownload(app);
    await app.flushMicrotasks(12);
    expect(app.downloads).toHaveLength(1);

    app.menuByAccessKey("r").callback();
    await app.flushMicrotasks(12);

    expect(app.abortedDownloads).toEqual([app.downloads[0]]);
    expect(app.downloads).toHaveLength(1);
  });
});
