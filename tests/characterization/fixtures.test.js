// @vitest-environment node

import { readFileSync } from "node:fs";

import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";

function fixture(path) {
  return readFileSync(new URL(`../fixtures/${path}`, import.meta.url), "utf8");
}

function jsonFixture(name) {
  return JSON.parse(fixture(`json/${name}.json`));
}

describe("sanitized characterization fixtures", () => {
  it.each([
    ["post", "/p/Post12345/"],
    ["carousel", "/p/Carousel12/"],
    ["story", "/stories/fixture_user/"],
    ["highlight", "/stories/highlights/Highlight1/"],
    ["profile", "/fixture_user/"],
    ["standalone-reel", "/reel/Standalone1/"],
    ["reels-feed", "/reels/FeedReel1/"],
  ])("contains a self-identifying %s DOM surface", (name, href) => {
    const dom = new JSDOM(fixture(`html/${name}.html`), {
      url: "https://www.instagram.com/",
    });

    expect(dom.window.document.querySelector(`[data-fixture='${name}']`)).not.toBeNull();
    expect(dom.window.document.querySelector(`a[href='${href}']`)).not.toBeNull();
    dom.window.close();
  });

  it("covers legacy query-hash image and carousel response shapes", () => {
    const post = jsonFixture("legacy-query-hash");
    const carousel = jsonFixture("legacy-carousel-query-hash");

    expect(post.data.shortcode_media.__typename).toBe("GraphImage");
    expect(carousel.data.shortcode_media.__typename).toBe("GraphSidecar");
    expect(carousel.data.shortcode_media.edge_sidecar_to_children.edges).toHaveLength(2);
  });

  it("covers query-ID, Media API, Story, Highlight, Reel, and profile shapes", () => {
    expect(jsonFixture("query-id").data.xdt_api__v1__media__shortcode__web_info.items).toHaveLength(1);
    expect(jsonFixture("media-api").items[0].image_versions2.candidates.length).toBeGreaterThan(1);
    expect(jsonFixture("story").data.reels_media[0].items).toHaveLength(2);
    expect(jsonFixture("highlight").data.reels_media[0].items).toHaveLength(2);
    expect(jsonFixture("reels-feed").items).toHaveLength(2);
    expect(jsonFixture("profile").data.user.username).toBe("fixture_user");
  });

  it("covers redirects, throttling, malformed payloads, and transport failures", () => {
    const errors = jsonFixture("response-errors");

    expect(errors.loginRedirect.finalUrl).toContain("/accounts/login/");
    expect(errors.throttled.status).toBe(429);
    expect(errors.apiFailure.body.status).toBe("fail");
    expect(() => JSON.parse(errors.malformed.body)).toThrow();
    expect(errors.network.event).toBe("error");
    expect(errors.timeout.event).toBe("timeout");
  });
});
