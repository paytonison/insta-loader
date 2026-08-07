// @vitest-environment jsdom

import { describe, expect, it } from "vitest";

import { renderMediaRow } from "../../../src/media/render.js";

function descriptor(overrides = {}) {
  return {
    mediaId: "media-1",
    directUrl: "https://cdn.example/full.jpg",
    thumbnailUrl: "https://cdn.example/thumb.jpg",
    kind: "image",
    extension: "jpg",
    owner: "fixture_user",
    shortcode: "Post12345",
    publishTime: 1700000000,
    carouselIndex: 2,
    rawMediaItem: {},
    dashManifest: null,
    ...overrides,
  };
}

describe("renderMediaRow", () => {
  it("retains compatibility attributes while rendering normalized data", () => {
    const anchor = renderMediaRow(document, descriptor(), (key) => key);

    expect(anchor.getAttribute("media-id")).toBe("media-1");
    expect(anchor.dataset.needed).toBe("direct");
    expect(anchor.dataset.path).toBe("Post12345");
    expect(anchor.dataset.name).toBe("photo");
    expect(anchor.dataset.type).toBe("jpg");
    expect(anchor.dataset.username).toBe("fixture_user");
    expect(anchor.dataset.globalindex).toBe("2");
    expect(anchor.dataset.href).toBe("https://cdn.example/full.jpg");
    expect(anchor.querySelector("img").src).toBe(
      "https://cdn.example/thumb.jpg",
    );
    expect(anchor.textContent).toBe("- IMG 2 -");
  });

  it("renders translated strings as literal text", () => {
    const anchor = renderMediaRow(
      document,
      descriptor({
        kind: "video",
        extension: "mp4",
        owner: '"><img src=x onerror=alert(1)>',
      }),
      () => "<strong>Video</strong>",
    );

    expect(anchor.dataset.name).toBe("video");
    expect(anchor.dataset.username).toBe('"><img src=x onerror=alert(1)>');
    expect(anchor.querySelector("strong")).toBeNull();
    expect(anchor.textContent).toBe("- <strong>Video</strong> 2 -");
  });

  it("retains the legacy GraphSidecar video title marker", () => {
    const anchor = renderMediaRow(
      document,
      descriptor({
        extension: "mp4",
        kind: "video",
        labelTranslationAttribute: "data-ih-locale-title",
      }),
      (key) => key,
    );

    expect(anchor.querySelector("span").getAttribute("data-ih-locale-title"))
      .toBe("VID");
    expect(anchor.querySelector("span").hasAttribute("data-ih-locale"))
      .toBe(false);
  });
});
