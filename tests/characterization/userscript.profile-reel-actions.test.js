// @vitest-environment node

import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { buildUserscript } from "../../scripts/build.mjs";
import { createUserscriptRuntime } from "./helpers/userscript-runtime.js";

const profileHtml = `<!doctype html>
  <html style="display:block;visibility:visible;opacity:1">
    <head>
      <script type="application/json">{"APP_ID":"936619743392459"}</script>
    </head>
    <body style="display:block;visibility:visible;opacity:1">
      <div id="mount_0">
        <button class="IG_DWPROFILE" type="button">Profile download</button>
      </div>
    </body>
  </html>`;

function reelHtml(actionClass, embeddedPayload = null) {
  return `<!doctype html>
    <html style="display:block;visibility:visible;opacity:1">
      <head>
        <script type="application/json">{"APP_ID":"936619743392459"}</script>
        ${embeddedPayload
          ? `<script type="application/json">${JSON.stringify(embeddedPayload)}</script>`
          : ""}
      </head>
      <body style="display:block;visibility:visible;opacity:1">
        <div id="mount_0">
          <button class="${actionClass}" type="button">Reel action</button>
        </div>
      </body>
    </html>`;
}

function reelQueryHash({
  owner = "fixture_reel_owner",
  posterUrl = "https://instagram.ftpe8-2.fna.fbcdn.net/reel-poster.jpg",
  videoUrl = "https://instagram.ftpe8-2.fna.fbcdn.net/reel-video.mp4",
} = {}) {
  return {
    status: "ok",
    data: {
      shortcode_media: {
        __typename: "GraphVideo",
        id: "legacy-reel-id",
        shortcode: "RouteReel1",
        is_video: true,
        taken_at_timestamp: 1_703_000_001,
        owner: { username: owner },
        display_resources: [
          {
            src: "https://instagram.ftpe8-2.fna.fbcdn.net/reel-small.jpg",
            config_width: 320,
            config_height: 569,
          },
          {
            src: posterUrl,
            config_width: 1080,
            config_height: 1920,
          },
        ],
        video_url: videoUrl,
        video_dash_manifest: "<MPD></MPD>",
      },
    },
  };
}

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
  const value = await createUserscriptRuntime({
    ...options,
    userscriptSource: currentUserscriptSource,
  });
  runtimes.push(value);
  return value;
}

function click(app, selector) {
  app.document.querySelector(selector).dispatchEvent(
    new app.window.MouseEvent("click", {
      bubbles: true,
      cancelable: true,
    }),
  );
}

function metadataRequests(app) {
  return app.requests.filter((request) =>
    request.url.includes("/graphql/query/")
  );
}

describe("profile avatar MediaDescriptor action integration", () => {
  it("keeps high-resolution precedence, UID naming, and the legacy zero index", async () => {
    const app = await runtime({
      html: profileHtml,
      network: [
        {
          match: "/web/search/topsearch/",
          response: {
            body: {
              users: [
                {
                  user: {
                    id: "profile-user-id",
                    pk: "profile-user-pk",
                    username: "fixture_user",
                    profile_pic_url:
                      "https://cdn.example.test/profile-small.jpg",
                    profile_pic_url_hd:
                      "https://cdn.example.test/profile-web-hd.jpg",
                  },
                },
              ],
            },
          },
        },
        {
          match: "/api/v1/users/profile-user-pk/info/",
          response: {
            body: {
              status: "ok",
              user: {
                hd_profile_pic_url_info: {
                  url: "https://cdn.example.test/profile-api-hd.jpg",
                },
              },
            },
          },
        },
      ],
      storage: {
        G_RENAME_FORMAT: "%USERNAME%-%SOURCE_TYPE%-%UID%-%INDEX%",
      },
      url: "https://www.instagram.com/fixture_user/",
    });

    click(app, ".IG_DWPROFILE");
    await app.flushMicrotasks(30);

    expect(app.downloads).toHaveLength(1);
    expect(app.downloads[0]).toMatchObject({
      name: "fixture_user-avatar-profile-user-id-0.jpg",
      url: "https://cdn.example.test/profile-api-hd.jpg",
    });
    expect(
      app.requests.filter((request) => request.url.includes("/api/v1/media/")),
    ).toHaveLength(0);
  });

  it("falls back from the separate avatar request to the web-profile HD URL", async () => {
    const app = await runtime({
      html: profileHtml,
      network: [
        {
          match: "/web/search/topsearch/",
          response: {
            body: {
              users: [
                {
                  user: {
                    id: "profile-user-id",
                    pk: "profile-user-pk",
                    username: "fixture_user",
                    profile_pic_url:
                      "https://cdn.example.test/profile-small.jpg",
                    profile_pic_url_hd:
                      "https://cdn.example.test/profile-web-hd.jpg",
                  },
                },
              ],
            },
          },
        },
        {
          match: "/api/v1/users/profile-user-pk/info/",
          response: { event: "error" },
        },
      ],
      url: "https://www.instagram.com/fixture_user/",
    });

    click(app, ".IG_DWPROFILE");
    await app.flushMicrotasks(30);

    expect(app.downloads).toHaveLength(1);
    expect(app.downloads[0].url).toBe(
      "https://cdn.example.test/profile-web-hd.jpg",
    );
  });
});

describe("ordinary Reel MediaDescriptor action integration", () => {
  it("falls back from the current Reel query to the legacy query hash", async () => {
    const app = await runtime({
      html: reelHtml("IG_REELS"),
      network: [
        {
          match: "query_hash=2c4c2e343a8f64c625ba02b2aa12c7f8",
          response: { body: reelQueryHash() },
        },
      ],
      storage: {
        G_RENAME_FORMAT: "%USERNAME%-%SOURCE_TYPE%-%SHORTCODE%-%INDEX%",
      },
      url: "https://www.instagram.com/reels/RouteReel1/",
    });

    click(app, ".IG_REELS");
    await app.flushMicrotasks(30);

    expect(app.downloads).toHaveLength(1);
    expect(app.downloads[0]).toMatchObject({
      name: "fixture_reel_owner-reels-RouteReel1-0.mp4",
      url: "https://instagram.ftpe8-2.fna.fbcdn.net/reel-video.mp4",
    });
    expect(metadataRequests(app)).toHaveLength(2);
    expect(metadataRequests(app)[0].url).toContain(
      "query_id=9496392173716084",
    );
    expect(metadataRequests(app)[1].url).toContain(
      "query_hash=2c4c2e343a8f64c625ba02b2aa12c7f8",
    );
    expect(
      app.requests.filter((request) => request.url.includes("/api/v1/media/")),
    ).toHaveLength(0);
  });

  it("opens the normalized Reel resource without rewriting its CDN host", async () => {
    const app = await runtime({
      html: reelHtml("IG_REELS_NEWTAB"),
      network: [
        {
          match: "query_hash=2c4c2e343a8f64c625ba02b2aa12c7f8",
          response: { body: reelQueryHash() },
        },
      ],
      url: "https://www.instagram.com/reels/RouteReel1/",
    });

    click(app, ".IG_REELS_NEWTAB");
    await app.flushMicrotasks(30);

    expect(app.downloads).toHaveLength(0);
    expect(app.anchorClicks.at(-1)).toMatchObject({
      href: "https://instagram.ftpe8-2.fna.fbcdn.net/reel-video.mp4",
      target: "_blank",
    });
  });

  it("downloads the last legacy poster as a Reel resource, not a generic thumbnail", async () => {
    const app = await runtime({
      html: reelHtml("IG_REELS_THUMBNAIL"),
      network: [
        {
          match: "query_hash=2c4c2e343a8f64c625ba02b2aa12c7f8",
          response: { body: reelQueryHash() },
        },
      ],
      storage: {
        G_RENAME_FORMAT: "%SOURCE_TYPE%-%SHORTCODE%-%INDEX%",
      },
      url: "https://www.instagram.com/reels/RouteReel1/",
    });

    click(app, ".IG_REELS_THUMBNAIL");
    await app.flushMicrotasks(30);

    expect(app.downloads).toHaveLength(1);
    expect(app.downloads[0]).toMatchObject({
      name: "reels-RouteReel1-0.jpg",
      url: "https://instagram.ftpe8-2.fna.fbcdn.net/reel-poster.jpg",
    });
  });

  it("uses the current query directly and keeps its first video candidate", async () => {
    const queryIdPayload = {
      data: {
        xdt_api__v1__media__shortcode__web_info: {
          items: [
            {
              pk: "api-reel-id",
              code: "RouteReel1",
              taken_at: 1_703_000_101,
              user: { username: "api_reel_owner" },
              image_versions2: {
                candidates: [
                  {
                    url: "https://cdn.example.test/api-reel-poster.jpg",
                    width: 320,
                    height: 569,
                  },
                ],
              },
              video_versions: [
                {
                  url: "https://cdn.example.test/api-reel-first.mp4",
                  width: 720,
                  height: 1280,
                },
                {
                  url: "https://cdn.example.test/api-reel-larger.mp4",
                  width: 1080,
                  height: 1920,
                },
              ],
            },
          ],
        },
      },
    };
    const app = await runtime({
      html: reelHtml("IG_REELS"),
      network: [
        {
          match: "query_hash=2c4c2e343a8f64c625ba02b2aa12c7f8",
          response: { body: { status: "fail" } },
        },
        {
          match: "query_id=9496392173716084",
          response: { body: queryIdPayload },
        },
      ],
      url: "https://www.instagram.com/reels/RouteReel1/",
    });

    click(app, ".IG_REELS");
    await app.flushMicrotasks(30);

    expect(metadataRequests(app)).toHaveLength(1);
    expect(metadataRequests(app)[0].url).toContain(
      "query_id=9496392173716084",
    );
    expect(app.downloads).toHaveLength(1);
    expect(app.downloads[0].url).toBe(
      "https://cdn.example.test/api-reel-first.mp4",
    );
    expect(app.alerts).toEqual([]);
  });

  it("downloads an exact XIG bootstrap Reel without a metadata request", async () => {
    const item = {
      pk: "embedded-reel-id",
      code: "EmbeddedReel1",
      media_type: 2,
      taken_at: 1_703_000_201,
      user: { username: "embedded_reel_owner" },
      image_versions2: {
        candidates: [
          { url: "https://cdn.example.test/embedded-reel-poster.jpg" },
        ],
      },
      video_versions: [
        { url: "https://cdn.example.test/embedded-reel.mp4" },
      ],
    };
    const app = await runtime({
      html: reelHtml("IG_REELS", {
        deeply: {
          nested: {
            xig_polaris_media: { if_not_gated_logged_out: item },
          },
        },
      }),
      url: "https://www.instagram.com/reel/EmbeddedReel1/",
    });

    click(app, ".IG_REELS");
    await app.flushMicrotasks(30);

    expect(metadataRequests(app)).toHaveLength(0);
    expect(app.downloads).toHaveLength(1);
    expect(app.downloads[0]).toMatchObject({
      url: "https://cdn.example.test/embedded-reel.mp4",
    });
    expect(app.alerts).toEqual([]);
  });

  it("retains the legacy missing-owner alert and declines the action", async () => {
    const response = reelQueryHash();
    delete response.data.shortcode_media.owner;
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      const app = await runtime({
        html: reelHtml("IG_REELS"),
        network: [
          {
            match: "query_hash=2c4c2e343a8f64c625ba02b2aa12c7f8",
            response: { body: response },
          },
        ],
        url: "https://www.instagram.com/reels/RouteReel1/",
      });

      click(app, ".IG_REELS");
      await app.flushMicrotasks(30);

      expect(app.alerts).toEqual(["carousel_media: undefined username"]);
      expect(app.downloads).toHaveLength(0);
    } finally {
      consoleError.mockRestore();
    }
  });
});
