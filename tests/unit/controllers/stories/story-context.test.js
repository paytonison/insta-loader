import { describe, expect, it } from "vitest";

import highlightFixture from "../../../fixtures/json/highlight.json";
import storyFixture from "../../../fixtures/json/story.json";
import {
  STORY_INTENT,
  STORY_SURFACE,
  buildStoryBatchDescriptors,
  createStoryActionContext,
  getStoryMediaApiPolicyInputs,
  getStorySurfaceCacheKey,
} from "../../../../src/controllers/stories/story-context.js";

const enabledSettings = {
  CAPTURE_IMAGE_VIA_MEDIA_CACHE: true,
  FALLBACK_TO_BLOB_FETCH_IF_MEDIA_API_THROTTLED: true,
  FORCE_RESOURCE_VIA_MEDIA: true,
  PREFER_DASH_MANIFEST: true,
  RENAME_PUBLISH_DATE: true,
};

describe("Story/Highlight action context", () => {
  it("shares current-item, cache, policy, progress, and thumbnail metadata", () => {
    const context = createStoryActionContext({
      surface: STORY_SURFACE.STORY,
      payload: storyFixture,
      domState: {
        username: "fixture_user",
        highlightId: null,
        identity: {
          explicitMediaId: "300000000000000102",
          visibleTimestamp: 1_700_000_000,
          progressIndex: 0,
          layoutIndex: null,
          routeMediaId: "300000000000000102",
        },
        progress: { current: 2, total: 2 },
        thumbnail: {
          available: true,
          posterUrl: "https://cdn.example/dom-poster.jpg",
        },
      },
      settings: enabledSettings,
      runtimeState: { tempFetchRateLimit: false },
      intent: STORY_INTENT.DOWNLOAD,
    });

    expect(context).toMatchObject({
      surface: "stories",
      owner: "fixture_user",
      responseCacheKey: "fixture_user",
      imageCacheKey: "300000000000000102",
      current: {
        itemIndex: 1,
        mediaId: "300000000000000102",
        source: "explicit-url",
      },
      mediaApiPolicy: {
        requestMediaApi: true,
        useImageCache: false,
        requestDash: true,
        fallbackToLegacyOnMediaApiFailure: true,
      },
      progress: { current: 2, total: 2 },
      thumbnail: {
        mediaId: "300000000000000102",
        displayUrl:
          "https://scontent.cdninstagram.com/story-2-poster.jpg",
        posterUrl: "https://cdn.example/dom-poster.jpg",
        available: true,
      },
    });
  });

  it("uses the Highlight ID cache key and suppresses Media API work during cooldown", () => {
    const context = createStoryActionContext({
      surface: STORY_SURFACE.HIGHLIGHT,
      payload: highlightFixture,
      domState: {
        username: "fixture_user",
        highlightId: "Highlight1",
        identity: { progressIndex: 1 },
        progress: null,
        thumbnail: { available: false, posterUrl: null },
      },
      settings: enabledSettings,
      runtimeState: { tempFetchRateLimit: true },
      intent: STORY_INTENT.THUMBNAIL,
    });

    expect(context.responseCacheKey).toBe("Highlight1");
    expect(context.current.item).toBe(
      highlightFixture.data.reels_media[0].items[1],
    );
    expect(context.mediaApiPolicy).toMatchObject({
      rateLimited: true,
      requestMediaApi: false,
      useImageCache: true,
      requestDash: false,
    });
  });

  it("keeps surface cache ownership and policy inputs explicit", () => {
    expect(
      getStorySurfaceCacheKey(STORY_SURFACE.STORY, {
        username: "story_owner",
        highlightId: "ignored",
      }),
    ).toBe("story_owner");
    expect(
      getStorySurfaceCacheKey(STORY_SURFACE.HIGHLIGHT, {
        username: "ignored",
        highlightId: "Highlight42",
      }),
    ).toBe("Highlight42");

    expect(
      getStoryMediaApiPolicyInputs(
        enabledSettings,
        { tempFetchRateLimit: false },
        { intent: STORY_INTENT.PREVIEW, item: { is_video: false } },
      ),
    ).toMatchObject({
      requestMediaApi: true,
      useImageCache: true,
      requestDash: false,
      renamePublishDate: true,
    });
  });
});

describe("Story/Highlight batch descriptors", () => {
  it("builds one-based Story descriptors without mutating API resources", () => {
    const fixture = structuredClone(storyFixture);
    fixture.data.reels_media[0].items[0].display_resources = [
      {
        src: "https://cdn.example/story-small.jpg",
        config_width: 320,
      },
      {
        src: "https://cdn.example/story-large.jpg",
        config_width: 1080,
      },
    ];
    const before = structuredClone(fixture);

    const descriptors = buildStoryBatchDescriptors(fixture, {
      surface: STORY_SURFACE.STORY,
      renamePublishDate: false,
      nowSeconds: 1_800_000_000,
    });

    expect(descriptors).toHaveLength(2);
    expect(descriptors[0]).toMatchObject({
      mediaId: "300000000000000101",
      directUrl: "https://cdn.example/story-large.jpg",
      thumbnailUrl: "https://cdn.example/story-large.jpg",
      kind: "image",
      extension: "jpg",
      owner: "fixture_user",
      shortcode: "300000000000000101",
      publishTime: 1_800_000_000,
      carouselIndex: 1,
    });
    expect(descriptors[1]).toMatchObject({
      directUrl: "https://scontent.cdninstagram.com/story-2.mp4",
      kind: "video",
      extension: "mp4",
      carouselIndex: 2,
    });
    expect(fixture).toEqual(before);
  });

  it("uses publish timestamps for renamed Highlight batches", () => {
    const descriptors = buildStoryBatchDescriptors(highlightFixture, {
      surface: STORY_SURFACE.HIGHLIGHT,
      renamePublishDate: true,
      nowSeconds: 1_800_000_000,
    });

    expect(descriptors.map((descriptor) => descriptor.publishTime)).toEqual([
      1_700_086_400,
      1_700_086_460,
    ]);
    expect(descriptors[1].rawMediaItem).toBe(
      highlightFixture.data.reels_media[0].items[1],
    );
  });
});
