import { describe, expect, it } from "vitest";

import apiFixture from "./fixtures/api-query-id.json";
import legacyFixture from "./fixtures/legacy-query-hash.json";
import {
  extractApiResource,
  getMediaOwner,
  normalizeApiMedia,
  normalizeLegacyMedia,
  normalizeMediaResponse,
} from "../../../src/media/normalizers.js";

describe("legacy query-hash media normalization", () => {
  it("normalizes GraphImage with the largest display resource", () => {
    const [descriptor] = normalizeLegacyMedia({
      shortcode_media: legacyFixture.graphImage,
    });

    expect(descriptor).toMatchObject({
      mediaId: "legacy-image-1",
      directUrl: "https://cdn.example.test/legacy-image-1080.jpg",
      thumbnailUrl: "https://cdn.example.test/legacy-image-640.jpg",
      kind: "image",
      extension: "jpg",
      owner: "legacy_owner",
      shortcode: "IMGcode01",
      publishTime: 1700000001,
      carouselIndex: 1,
      dashManifest: null,
    });
    expect(descriptor.rawMediaItem).toBe(legacyFixture.graphImage);
  });

  it("normalizes GraphVideo and retains its DASH-bearing raw item", () => {
    const [descriptor] = normalizeLegacyMedia(legacyFixture.graphVideo);

    expect(descriptor).toMatchObject({
      mediaId: "legacy-video-1",
      directUrl: "https://cdn.example.test/legacy-video.mp4",
      thumbnailUrl: "https://cdn.example.test/legacy-video-640.jpg",
      kind: "video",
      extension: "mp4",
      owner: "legacy_owner",
      shortcode: "VIDcode01",
      publishTime: 1700000002,
      carouselIndex: 1,
      dashManifest: "<MPD>legacy-video</MPD>",
    });
    expect(descriptor.rawMediaItem).toBe(legacyFixture.graphVideo);
  });

  it("normalizes sidecar children with parent context and one-based indices", () => {
    const descriptors = normalizeLegacyMedia(legacyFixture.graphSidecar);

    expect(descriptors).toHaveLength(2);
    expect(descriptors[0]).toMatchObject({
      mediaId: "legacy-child-video",
      owner: "sidecar_owner",
      shortcode: "SIDEcode1",
      publishTime: 1700000003,
      carouselIndex: 1,
      kind: "video",
      dashManifest: "<MPD>sidecar-child</MPD>",
      labelTranslationAttribute: "data-ih-locale-title",
    });
    expect(descriptors[1]).toMatchObject({
      mediaId: "legacy-child-image",
      directUrl: "https://cdn.example.test/legacy-child-image-1080.jpg",
      owner: "sidecar_owner",
      shortcode: "SIDEcode1",
      publishTime: 1700000003,
      carouselIndex: 2,
      kind: "image",
      labelTranslationAttribute: "data-ih-locale",
    });
  });
});

describe("query-ID and Media API normalization", () => {
  it("normalizes an image with the existing stp ordering without mutation", () => {
    const before = structuredClone(apiFixture.image);
    const [descriptor] = normalizeApiMedia(apiFixture.image);

    expect(descriptor).toMatchObject({
      mediaId: "api-image-1",
      directUrl: "https://cdn.example.test/api-image-clean.jpg?stp=dst-jpg",
      thumbnailUrl: "https://cdn.example.test/api-image-clean.jpg?stp=dst-jpg",
      kind: "image",
      extension: "jpg",
      owner: "api_owner",
      shortcode: "APIimage1",
      publishTime: 1700000101,
      carouselIndex: 1,
    });
    expect(apiFixture.image).toEqual(before);
  });

  it("normalizes a video using the first API versions and the user fallback", () => {
    const [descriptor] = normalizeApiMedia(apiFixture.video);

    expect(descriptor).toMatchObject({
      mediaId: "api-video-1",
      directUrl: "https://cdn.example.test/api-video-first.mp4",
      thumbnailUrl: "https://cdn.example.test/api-video-thumb-first.jpg",
      kind: "video",
      extension: "mp4",
      owner: "api_user_fallback",
      shortcode: "APIvideo1",
      publishTime: 1700000102,
      carouselIndex: 1,
      dashManifest: "<MPD>api-video</MPD>",
    });
  });

  it("accepts the Media API id field when pk is absent", () => {
    const [descriptor] = normalizeApiMedia({
      status: "ok",
      items: [
        {
          id: "media-api-id-only",
          taken_at: 1_700_000_103,
          image_versions2: {
            candidates: [
              {
                url: "https://cdn.example.test/media-api-id-only.jpg",
              },
            ],
          },
        },
      ],
    });

    expect(descriptor).toMatchObject({
      mediaId: "media-api-id-only",
      directUrl: "https://cdn.example.test/media-api-id-only.jpg",
      kind: "image",
    });
  });

  it("normalizes carousel children with parent owner/code and child time", () => {
    const descriptors = normalizeApiMedia(apiFixture.carousel);

    expect(descriptors).toHaveLength(2);
    expect(descriptors[0]).toMatchObject({
      mediaId: "api-child-image",
      directUrl: "https://cdn.example.test/api-child-image-1080.jpg",
      owner: "carousel_owner",
      shortcode: "APIcar01",
      publishTime: 1700000111,
      carouselIndex: 1,
      kind: "image",
    });
    expect(descriptors[1]).toMatchObject({
      mediaId: "api-child-video",
      directUrl: "https://cdn.example.test/api-child-video.mp4",
      owner: "carousel_owner",
      shortcode: "APIcar01",
      publishTime: 1700000112,
      carouselIndex: 2,
      kind: "video",
      dashManifest: "<MPD>api-child-video</MPD>",
    });
  });

  it("unwraps XDT and getBlobMedia response envelopes", () => {
    const xdt = {
      xdt_api__v1__media__shortcode__web_info: {
        items: [apiFixture.video],
      },
    };

    expect(extractApiResource(xdt)).toBe(apiFixture.video);
    expect(normalizeMediaResponse({ type: "query_id", data: xdt })).toEqual(
      normalizeApiMedia(apiFixture.video),
    );
    expect(normalizeMediaResponse({
      type: "query_hash",
      data: { shortcode_media: legacyFixture.graphImage },
    })).toEqual(normalizeLegacyMedia(legacyFixture.graphImage));
  });

  it("handles missing resources and owner data without throwing", () => {
    expect(normalizeApiMedia(null)).toEqual([]);
    expect(normalizeLegacyMedia({ shortcode_media: null })).toEqual([]);
    expect(getMediaOwner({})).toBeNull();
  });
});
