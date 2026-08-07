// @vitest-environment node

import { readFileSync } from "node:fs";

import { afterEach, beforeAll, describe, expect, it } from "vitest";

import { buildUserscript } from "../../scripts/build.mjs";
import { createUserscriptRuntime } from "./helpers/userscript-runtime.js";

const postControlsHtml = readFileSync(
  new URL("../fixtures/html/post-controls.html", import.meta.url),
  "utf8",
);
const carouselResponse = JSON.parse(
  readFileSync(
    new URL(
      "../fixtures/json/legacy-carousel-query-hash.json",
      import.meta.url,
    ),
    "utf8",
  ),
);
const videoOnlyDashManifest = readFileSync(
  new URL("../unit/media/fixtures/dash-video-only.mpd", import.meta.url),
  "utf8",
);
const imageCarouselResponse = JSON.parse(JSON.stringify(carouselResponse));
const secondImageNode =
  imageCarouselResponse.data.shortcode_media.edge_sidecar_to_children.edges[1]
    .node;
secondImageNode.__typename = "GraphImage";
delete secondImageNode.video_url;

const firstMediaId = "300000000000000011";
const secondMediaId = "300000000000000012";
const originalMediaIds = [firstMediaId, secondMediaId];
const runtimes = [];
let currentUserscriptSource;

function carouselResponseWithDash(manifest = videoOnlyDashManifest) {
  const response = structuredClone(carouselResponse);
  const videoNode =
    response.data.shortcode_media.edge_sidecar_to_children.edges[1].node;
  videoNode.video_dash_manifest = manifest;
  videoNode.video_versions = [
    {
      url: "https://scontent.cdninstagram.com/carousel-2.mp4",
      width: 1080,
      height: 1920,
    },
  ];
  return response;
}

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

function mediaApiResponse(request, videoMediaIds) {
  const mediaId = request.url.match(/\/media\/([^/]+)\/info\//)?.[1];
  const isVideo = videoMediaIds.has(mediaId);
  const mediaNumber = mediaId === secondMediaId ? 2 : 1;
  const item = {
    pk: mediaId,
    code: "Carousel12",
    taken_at: 1_700_000_100,
    owner: {
      pk: "100000000000000001",
      username: "fixture_user",
    },
    image_versions2: {
      candidates: [
        {
          url: isVideo
            ? "https://scontent.cdninstagram.com/api-carousel-2-poster.jpg"
            : `https://scontent.cdninstagram.com/api-carousel-${mediaNumber}.jpg`,
          width: 1080,
          height: isVideo ? 1920 : 1350,
        },
      ],
    },
  };
  if (isVideo) {
    item.video_versions = [
      {
        url: "https://scontent.cdninstagram.com/api-carousel-2.mp4",
        width: 1080,
        height: 1920,
      },
    ];
  }
  return { body: { status: "ok", items: [item] } };
}

async function runtime({
  response = carouselResponse,
  storage = {},
  videoMediaIds = [secondMediaId],
} = {}) {
  const videoIds = new Set(videoMediaIds);
  const app = await createUserscriptRuntime({
    html: postControlsHtml,
    missingApis: ["IntersectionObserver"],
    network: [
      {
        match: "query_hash=2c4c2e343a8f64c625ba02b2aa12c7f8",
        response: { body: response },
      },
      {
        match: "/api/v1/media/",
        response: (request) => mediaApiResponse(request, videoIds),
      },
    ],
    storage: {
      DIRECT_DOWNLOAD_ALL: false,
      DIRECT_DOWNLOAD_VISIBLE_RESOURCE: false,
      FORCE_RESOURCE_VIA_MEDIA: true,
      PREFER_DASH_MANIFEST: false,
      ...storage,
    },
    url: "https://www.instagram.com/p/Post12345/",
    userscriptSource: currentUserscriptSource,
  });
  runtimes.push(app);
  return app;
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

function click(app, element) {
  element.dispatchEvent(
    new app.window.MouseEvent("click", {
      bubbles: true,
      cancelable: true,
    }),
  );
}

function mediaRequestIds(app) {
  return app.requests
    .filter((request) => request.url.includes("/api/v1/media/"))
    .map((request) => request.url.match(/\/media\/([^/]+)\/info\//)?.[1]);
}

async function openMediaDialog(app) {
  click(app, app.document.querySelector(".IG_DW_MAIN"));
  await app.flushMicrotasks(30);
  const rows = [
    ...app.document.querySelectorAll(
      '.IG_POPUP_DIG_BODY a[data-needed="direct"]',
    ),
  ];
  expect(rows).toHaveLength(2);
  return rows;
}

function poisonCompatibilityAttributes(rows) {
  rows.forEach((row, index) => {
    row.setAttribute("media-id", `poison-media-${index}`);
    row.setAttribute("data-href", `https://poison.invalid/media-${index}`);
    row.setAttribute("data-path", `PoisonShortcode${index}`);
    row.setAttribute("data-username", `poison-user-${index}`);
    row.setAttribute("data-globalindex", String(90 - index));
    row.setAttribute("data-name", index === 0 ? "video" : "photo");
    row.setAttribute("data-type", index === 0 ? "mp4" : "jpg");
    row.setAttribute("datetime", "1");
    row.querySelector("img").src = `https://poison.invalid/thumb-${index}.jpg`;
  });
}

describe("post MediaDescriptor batch action boundaries", () => {
  it("uses a cached direct-post DASH manifest without requesting Media API", async () => {
    const app = await runtime({
      response: carouselResponseWithDash(),
      storage: { PREFER_DASH_MANIFEST: true },
    });
    await mountPostControls(app);
    const rows = await openMediaDialog(app);

    click(app, rows[1]);
    await app.flushMicrotasks(30);

    expect(mediaRequestIds(app)).toEqual([]);
    expect(app.downloads).toHaveLength(1);
    expect(app.downloads[0].url).toBe(
      "https://cdn.example.test/video-only.mp4",
    );
  });

  it("falls back once to Media API when cached direct-post DASH is unusable", async () => {
    const app = await runtime({
      response: carouselResponseWithDash("<MPD></MPD>"),
      storage: { PREFER_DASH_MANIFEST: true },
    });
    await mountPostControls(app);
    const rows = await openMediaDialog(app);

    click(app, rows[1]);
    await app.flushMicrotasks(30);

    expect(mediaRequestIds(app)).toEqual([secondMediaId]);
    expect(app.downloads).toHaveLength(1);
    expect(app.downloads[0].url).toBe(
      "https://scontent.cdninstagram.com/api-carousel-2.mp4",
    );
  });

  it("opens the generated image viewer from its bound descriptor exactly once", async () => {
    const app = await runtime({
      response: imageCarouselResponse,
      videoMediaIds: [],
    });
    await mountPostControls(app);

    const setAttribute = app.window.Element.prototype.setAttribute;
    const renderedDirectUrls = [];
    app.window.Element.prototype.setAttribute = function (name, value) {
      if (
        this instanceof app.window.HTMLAnchorElement &&
        name.toLowerCase() === "data-href" &&
        this.getAttribute("data-needed") === "direct"
      ) {
        renderedDirectUrls.push(String(value));
        return setAttribute.call(
          this,
          name,
          "https://poison.invalid/generated-viewer.jpg",
        );
      }
      return setAttribute.call(this, name, value);
    };

    try {
      click(app, app.document.querySelector(".IG_IMAGE_VIEWER"));
      await app.flushMicrotasks(30);
    } finally {
      app.window.Element.prototype.setAttribute = setAttribute;
    }

    expect(renderedDirectUrls).toEqual([
      "https://scontent.cdninstagram.com/carousel-1-full.jpg",
      "https://scontent.cdninstagram.com/carousel-2-full.jpg",
    ]);
    expect(
      app.requests.filter((request) =>
        request.url.includes(
          "query_hash=2c4c2e343a8f64c625ba02b2aa12c7f8",
        ),
      ),
    ).toHaveLength(1);
    expect(app.document.querySelectorAll("#imageViewer")).toHaveLength(1);
    expect(app.document.querySelector("#iv_image").getAttribute("src")).toBe(
      "https://scontent.cdninstagram.com/carousel-1-full.jpg",
    );
  });

  it("keeps selected/all order and ignores mutated row attributes", async () => {
    const app = await runtime({
      response: imageCarouselResponse,
      videoMediaIds: [],
    });
    await mountPostControls(app);
    const rows = await openMediaDialog(app);
    expect(rows.map((row) => row.getAttribute("media-id"))).toEqual(
      originalMediaIds,
    );

    poisonCompatibilityAttributes(rows);
    rows.forEach((row) => {
      row.previousElementSibling.querySelector("input").checked = true;
    });

    click(app, app.document.querySelector("#batch_download_selected"));
    await app.flushMicrotasks(40);

    expect(mediaRequestIds(app)).toEqual(originalMediaIds);
    expect(app.downloads.map(({ url }) => url)).toEqual([
      "https://scontent.cdninstagram.com/api-carousel-1.jpg",
      "https://scontent.cdninstagram.com/api-carousel-2.jpg",
    ]);

    click(app, app.document.querySelector("#batch_download_direct"));
    await app.flushMicrotasks(40);

    expect(mediaRequestIds(app)).toEqual([
      ...originalMediaIds,
      ...originalMediaIds,
    ]);
    expect(app.downloads.map(({ url }) => url)).toEqual([
      "https://scontent.cdninstagram.com/api-carousel-1.jpg",
      "https://scontent.cdninstagram.com/api-carousel-2.jpg",
      "https://scontent.cdninstagram.com/api-carousel-1.jpg",
      "https://scontent.cdninstagram.com/api-carousel-2.jpg",
    ]);
    expect(app.downloads.every(({ name }) => !name.includes("poison"))).toBe(
      true,
    );
  });

  it("dispatches a generated video thumbnail action exactly once", async () => {
    const app = await runtime();
    await mountPostControls(app);
    const rows = await openMediaDialog(app);
    poisonCompatibilityAttributes(rows);

    click(app, rows[1].parentElement.querySelector(".videoThumbnail"));
    await app.flushMicrotasks(20);

    expect(mediaRequestIds(app)).toEqual([]);
    expect(app.downloads).toHaveLength(1);
    expect(app.downloads[0].url).toBe(
      "https://scontent.cdninstagram.com/carousel-2-medium.jpg",
    );
  });

  it("dispatches the dedicated visible-resource Download All action once", async () => {
    const app = await runtime({
      storage: {
        DIRECT_DOWNLOAD_VISIBLE_RESOURCE: true,
      },
    });
    const mediaTarget = app.document.querySelector(
      "[data-fixture='post-media-target']",
    );
    mediaTarget.insertAdjacentHTML(
      "beforeend",
      `<div role="presentation"><div><ul class="fixture-resource-list">
        <li class="fixture-resource"></li>
        <li class="fixture-resource"></li>
      </ul></div></div>`,
    );

    await mountPostControls(app);

    const downloadAll = app.document.querySelector(".IG_DW_ALL_MAIN");
    expect(downloadAll).not.toBeNull();
    click(app, downloadAll);
    await app.flushMicrotasks(50);

    expect(
      app.requests.filter((request) =>
        request.url.includes(
          "query_hash=2c4c2e343a8f64c625ba02b2aa12c7f8",
        ),
      ),
    ).toHaveLength(1);
    expect(mediaRequestIds(app).sort()).toEqual([...originalMediaIds].sort());
    expect(app.downloads).toHaveLength(2);
    expect(downloadAll.classList.contains("is-busy")).toBe(false);
  });

  it("dispatches automatic DIRECT_DOWNLOAD_ALL without rendering batch rows", async () => {
    const app = await runtime({
      storage: {
        DIRECT_DOWNLOAD_ALL: true,
      },
    });
    await mountPostControls(app);

    click(app, app.document.querySelector(".IG_DW_MAIN"));
    await app.flushMicrotasks(50);

    expect(
      app.requests.filter((request) =>
        request.url.includes(
          "query_hash=2c4c2e343a8f64c625ba02b2aa12c7f8",
        ),
      ),
    ).toHaveLength(1);
    expect(mediaRequestIds(app).sort()).toEqual([...originalMediaIds].sort());
    expect(app.downloads).toHaveLength(2);
    expect(
      app.document.querySelectorAll(
        '.IG_POPUP_DIG_BODY a[data-needed="direct"]',
      ),
    ).toHaveLength(0);
    expect(app.document.querySelector(".IG_POPUP_DIG_ROUTE")).toBeNull();
  });
});
