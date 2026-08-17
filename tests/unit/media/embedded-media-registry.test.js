// @vitest-environment node

import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";

import { EmbeddedMediaRegistry } from "../../../src/media/index.js";

function documentWithPayloads(...payloads) {
  const dom = new JSDOM("<!doctype html><html><head></head><body></body></html>");
  for (const payload of payloads) {
    const script = dom.window.document.createElement("script");
    script.type = "application/json";
    script.textContent = typeof payload === "string"
      ? payload
      : JSON.stringify(payload);
    dom.window.document.head.append(script);
  }
  return dom.window.document;
}

function currentVideoItem(overrides = {}) {
  return {
    id: "3811480328699137079_25025320",
    pk: "3811480328699137079",
    media_type: 2,
    taken_at: 1_710_000_001,
    user: {
      id: "25025320",
      pk: "25025320",
      username: "fixture_user",
    },
    image_versions2: {
      candidates: [
        {
          url: "https://cdn.example.test/current-poster.jpg",
          width: 1080,
          height: 1920,
        },
      ],
    },
    video_versions: [
      {
        url: "https://cdn.example.test/current-video.mp4",
        width: 720,
        height: 1280,
      },
    ],
    ...overrides,
  };
}

describe("EmbeddedMediaRegistry", () => {
  it("finds a deeply nested XIG Reel by exact shortcode", () => {
    const item = currentVideoItem({
      code: "CurrentReel1",
      user: { username: "reel_owner" },
    });
    const document = documentWithPayloads({
      require: [
        ["PolarisRoot", [], { payload: { xig_polaris_media: {
          if_not_gated_logged_out: item,
        } } }],
      ],
    });
    const registry = new EmbeddedMediaRegistry();

    expect(registry.scan(document)).toMatchObject({
      parseFailures: 0,
      reelItems: 1,
      scripts: 1,
    });
    expect(registry.getReel("CurrentReel1")).toEqual(item);
    expect(registry.getReel("WrongReel1")).toBeNull();
  });

  it("indexes the current XDT Story connection by Highlight and owner", () => {
    const item = currentVideoItem();
    const reel = {
      id: "highlight:18142207969557132",
      user: {
        id: "25025320",
        pk: "25025320",
        username: "fixture_user",
      },
      items: [item],
    };
    const document = documentWithPayloads({
      nested: {
        xdt_api__v1__feed__reels_media__connection: {
          edges: [{ node: reel }],
        },
      },
    });
    const registry = new EmbeddedMediaRegistry();

    expect(registry.scan(document)).toMatchObject({ storyReels: 1 });
    expect(registry.getStory({
      highlightId: "18142207969557132",
    })?.data.reels_media[0]).toEqual(reel);
    expect(registry.getStory({ username: "FIXTURE_USER" })
      ?.data.reels_media[0]).toEqual(reel);
    expect(registry.getStory({ userId: "25025320" })
      ?.data.reels_media[0]).toEqual(reel);
  });

  it("binds one unlabelled Story connection to the exact route hint", () => {
    const reel = { items: [currentVideoItem({ user: undefined })] };
    const document = documentWithPayloads({
      xdt_api__v1__feed__reels_media__connection: {
        edges: [{ node: reel }],
      },
    });
    const registry = new EmbeddedMediaRegistry();

    registry.scan(document, { username: "route_owner" });

    expect(registry.getStory({ username: "route_owner" })
      ?.data.reels_media[0]).toMatchObject({
        items: [expect.objectContaining({ id: reel.items[0].id })],
      });
  });

  it("skips malformed and oversized scripts without rescanning them", () => {
    const registry = new EmbeddedMediaRegistry({ maxScriptCharacters: 24 });
    const document = documentWithPayloads("{not-json", {
      xig_polaris_media: {
        if_not_gated_logged_out: currentVideoItem({ code: "TooLarge1" }),
      },
    });

    expect(registry.scan(document)).toMatchObject({
      parseFailures: 1,
      scripts: 0,
      truncatedScripts: 1,
    });
    expect(registry.scan(document)).toEqual({
      parseFailures: 0,
      reelItems: 0,
      scripts: 0,
      storyReels: 0,
      truncatedScripts: 0,
    });
    expect(registry.getReel("TooLarge1")).toBeNull();
  });

  it("stops traversal at the configured node budget", () => {
    const registry = new EmbeddedMediaRegistry({ maxTraversedNodes: 2 });
    const document = documentWithPayloads({
      first: { second: { third: { xig_polaris_media: {
        if_not_gated_logged_out: currentVideoItem({ code: "TooDeep1" }),
      } } } },
    });

    expect(registry.scan(document).truncatedScripts).toBe(1);
    expect(registry.getReel("TooDeep1")).toBeNull();
  });
});
