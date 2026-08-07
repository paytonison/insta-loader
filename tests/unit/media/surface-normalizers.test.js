import { describe, expect, it } from "vitest";

import fixture from "./fixtures/surface-normalizers.json";
import {
  MEDIA_SURFACE,
  normalizeHighlightMedia,
  normalizeProfileAvatar,
  normalizeReelMedia,
  normalizeStoryMedia,
  normalizeStorySurfaceMedia,
} from "../../../src/media/index.js";

describe("profile avatar normalization", () => {
  it("preserves the high-resolution request and profile fallback precedence", () => {
    const before = structuredClone(fixture.profile);
    const [descriptor] = normalizeProfileAvatar(fixture.profile.web, {
      highResolutionPayload: fixture.profile.highResolution,
      publishTime: 1_800_000_001,
    });

    expect(descriptor).toMatchObject({
      mediaId: "profile-pk-1",
      directUrl: "https://cdn.example.test/profile-api-hd.jpg",
      thumbnailUrl: "https://cdn.example.test/profile-small.jpg",
      kind: "image",
      extension: "jpg",
      owner: "profile_owner",
      shortcode: null,
      publishTime: 1_800_000_001,
      carouselIndex: 1,
      dashManifest: null,
      sourceType: "avatar",
    });
    expect(descriptor.rawMediaItem).toBe(fixture.profile.web.data.user);
    expect(fixture.profile).toEqual(before);

    const [webHdFallback] = normalizeProfileAvatar(fixture.profile.web);
    expect(webHdFallback.directUrl).toBe(
      "https://cdn.example.test/profile-web-hd.jpg",
    );
  });

  it("omits malformed profiles instead of manufacturing an avatar", () => {
    expect(normalizeProfileAvatar(null)).toEqual([]);
    expect(normalizeProfileAvatar({ user: { id: "missing-url" } })).toEqual(
      [],
    );
  });
});

describe("Story and Highlight normalization", () => {
  it("keeps Story owner, candidate, timestamp, and one-based item precedence", () => {
    const before = structuredClone(fixture.story);
    const descriptors = normalizeStoryMedia(fixture.story, {
      renamePublishDate: true,
      nowSeconds: 1_800_000_002,
    });

    expect(descriptors).toHaveLength(3);
    expect(descriptors[0]).toMatchObject({
      mediaId: "story-image-1",
      directUrl: "https://cdn.example.test/story-image-1080.jpg",
      thumbnailUrl: "https://cdn.example.test/story-image-1080.jpg",
      kind: "image",
      extension: "jpg",
      owner: "story_user_precedence",
      shortcode: "story-image-1",
      publishTime: 1_701_000_001,
      carouselIndex: 1,
      dashManifest: null,
      sourceType: "stories",
    });
    expect(descriptors[1]).toMatchObject({
      mediaId: "story-video-1",
      directUrl: "https://cdn.example.test/story-video-first.mp4",
      thumbnailUrl: "https://cdn.example.test/story-video-poster.jpg",
      kind: "video",
      extension: "mp4",
      publishTime: 1_701_000_002,
      carouselIndex: 2,
      dashManifest: "<MPD>story-video</MPD>",
    });
    expect(descriptors[2]).toMatchObject({
      mediaId: "story-image-4",
      carouselIndex: 4,
    });
    expect(descriptors[1].rawMediaItem).toBe(
      fixture.story.data.reels_media[0].items[1],
    );
    expect(fixture.story).toEqual(before);
  });

  it("keeps the Highlight owner fallback and current-time batch behavior", () => {
    const [descriptor] = normalizeHighlightMedia(fixture.highlight, {
      renamePublishDate: false,
      nowSeconds: 1_800_000_003,
    });

    expect(descriptor).toMatchObject({
      mediaId: "highlight-video-1",
      directUrl: "https://cdn.example.test/highlight-video.mp4",
      thumbnailUrl: "https://cdn.example.test/highlight-poster.jpg",
      kind: "video",
      extension: "mp4",
      owner: "highlight_owner",
      shortcode: "highlight-video-1",
      publishTime: 1_800_000_003,
      carouselIndex: 1,
      dashManifest: "<MPD>highlight-video</MPD>",
      sourceType: "highlights",
    });

    const [batchDescriptor] = normalizeStorySurfaceMedia(fixture.highlight, {
      surface: MEDIA_SURFACE.HIGHLIGHT,
      renamePublishDate: false,
      nowSeconds: 1_800_000_003,
    });
    expect(batchDescriptor).toMatchObject({
      directUrl: "https://cdn.example.test/highlight-video-first.mp4",
      thumbnailUrl: "https://cdn.example.test/highlight-poster.jpg",
    });
  });

  it("rejects invalid surface policy inputs", () => {
    expect(() =>
      normalizeStorySurfaceMedia(fixture.story, {
        surface: "unknown",
        nowSeconds: 1,
      })
    ).toThrow("Unknown Story surface");
    expect(() =>
      normalizeStorySurfaceMedia(fixture.story, {
        surface: MEDIA_SURFACE.STORY,
        nowSeconds: Number.NaN,
      })
    ).toThrow("nowSeconds must be a finite number");
  });
});

describe("Reel normalization", () => {
  it("keeps the legacy video and last-display-resource choices", () => {
    const before = structuredClone(fixture.reelQueryHash);
    const [descriptor] = normalizeReelMedia(fixture.reelQueryHash, {
      isVideo: true,
      shortcode: "RouteReel1",
    });

    expect(descriptor).toMatchObject({
      mediaId: "legacy-reel-1",
      directUrl: "https://cdn.example.test/legacy-reel.mp4",
      thumbnailUrl: "https://cdn.example.test/legacy-reel-poster.jpg",
      kind: "video",
      extension: "mp4",
      owner: "legacy_reel_owner",
      shortcode: "RouteReel1",
      publishTime: 1_703_000_001,
      carouselIndex: 1,
      dashManifest: "<MPD>legacy-reel</MPD>",
      sourceType: "reels",
    });
    expect(descriptor.rawMediaItem).toBe(
      fixture.reelQueryHash.data.shortcode_media,
    );

    const [thumbnail] = normalizeReelMedia(fixture.reelQueryHash, {
      isVideo: false,
    });
    expect(thumbnail).toMatchObject({
      directUrl: "https://cdn.example.test/legacy-reel-poster.jpg",
      kind: "image",
      extension: "jpg",
      shortcode: "LegacyReel1",
    });
    expect(fixture.reelQueryHash).toEqual(before);
  });

  it("keeps the first API video and first poster candidate without ranking", () => {
    const [descriptor] = normalizeReelMedia(fixture.reelQueryId, {
      isVideo: true,
    });

    expect(descriptor).toMatchObject({
      mediaId: "api-reel-1",
      directUrl: "https://cdn.example.test/api-reel-first.mp4",
      thumbnailUrl: "https://cdn.example.test/api-reel-poster-first.jpg",
      kind: "video",
      extension: "mp4",
      owner: "api_reel_user_fallback",
      shortcode: "ApiReel1",
      publishTime: 1_703_000_101,
      carouselIndex: 1,
      dashManifest: "<MPD>api-reel</MPD>",
    });

    const [thumbnail] = normalizeReelMedia(fixture.reelQueryId, {
      isVideo: false,
    });
    expect(thumbnail.directUrl).toBe(
      "https://cdn.example.test/api-reel-poster-first.jpg",
    );
  });

  it("normalizes feed envelopes without losing one-based item identity", () => {
    const descriptors = normalizeReelMedia(fixture.reelFeed);

    expect(descriptors).toHaveLength(2);
    expect(descriptors[0]).toMatchObject({
      mediaId: "feed-reel-1",
      kind: "image",
      directUrl: "https://cdn.example.test/feed-reel-one.jpg",
      shortcode: "FeedReel1",
      carouselIndex: 1,
    });
    expect(descriptors[1]).toMatchObject({
      mediaId: "feed-reel-2",
      kind: "video",
      directUrl: "https://cdn.example.test/feed-reel-two.mp4",
      thumbnailUrl: "https://cdn.example.test/feed-reel-two.jpg",
      shortcode: "FeedReel2",
      carouselIndex: 2,
    });
  });

  it("returns no descriptor for malformed or source-less Reel responses", () => {
    expect(normalizeReelMedia(null)).toEqual([]);
    expect(normalizeReelMedia({ type: "query_id", data: { items: [{}] } }))
      .toEqual([]);
  });
});
