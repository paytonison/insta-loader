import { describe, expect, it, vi } from "vitest";

import {
  MEDIA_ACTION_STAGE,
  MEDIA_INTENT,
  MediaActionError,
  MediaActionService,
  createMediaActionService,
  validateMediaDescriptor,
  validateMediaIntent,
} from "../../../src/media/action-service.js";

function imageDescriptor(overrides = {}) {
  return {
    mediaId: "image-1",
    directUrl: "https://cdn.example.test/image.jpg",
    thumbnailUrl: "https://cdn.example.test/image-thumb.jpg",
    kind: "image",
    extension: "jpg",
    owner: "owner",
    shortcode: "IMAGE01",
    publishTime: 1700000000,
    carouselIndex: 1,
    rawMediaItem: { pk: "image-1" },
    dashManifest: null,
    ...overrides,
  };
}

function videoDescriptor(overrides = {}) {
  return {
    mediaId: "video-1",
    directUrl: "https://cdn.example.test/video.mp4",
    thumbnailUrl: "https://cdn.example.test/video-thumb.jpg",
    kind: "video",
    extension: "mp4",
    owner: "owner",
    shortcode: "VIDEO01",
    publishTime: 1700000001,
    carouselIndex: 1,
    rawMediaItem: { pk: "video-1" },
    dashManifest: null,
    ...overrides,
  };
}

function createDependencies(overrides = {}) {
  return {
    outputs: {
      download: vi.fn((context) => context),
      preview: vi.fn((context) => context),
      thumbnail: vi.fn((context) => context),
    },
    ...overrides,
  };
}

describe("MediaActionService validation", () => {
  it("requires every output dependency", () => {
    expect(() => new MediaActionService({ outputs: {} })).toThrow(
      "outputs.download()",
    );
    expect(() => new MediaActionService(null)).toThrow(
      "requires injected dependencies",
    );
  });

  it("validates descriptors and intents before invoking dependencies", async () => {
    const dependencies = createDependencies();
    const service = new MediaActionService(dependencies);

    await expect(
      service.execute(
        imageDescriptor({ mediaId: "" }),
        MEDIA_INTENT.DOWNLOAD,
      ),
    ).rejects.toThrow("mediaId");
    await expect(service.execute(imageDescriptor(), "share")).rejects.toThrow(
      "Media intent",
    );
    expect(dependencies.outputs.download).not.toHaveBeenCalled();
  });

  it("exports standalone validators and the factory seam", () => {
    const descriptor = imageDescriptor();
    const validated = validateMediaDescriptor(descriptor);

    expect(validated).not.toBe(descriptor);
    expect(Object.isFrozen(validated)).toBe(true);
    expect(validateMediaIntent(MEDIA_INTENT.PREVIEW)).toBeUndefined();
    expect(createMediaActionService(createDependencies())).toBeInstanceOf(
      MediaActionService,
    );
  });
});

describe("MediaActionService resolution pipeline", () => {
  it("uses the direct normalized descriptor when optional policies are disabled", async () => {
    const dependencies = createDependencies();
    const descriptor = imageDescriptor();
    const service = new MediaActionService(dependencies);

    const result = await service.execute(descriptor, MEDIA_INTENT.PREVIEW);

    expect(dependencies.outputs.preview).toHaveBeenCalledOnce();
    expect(result).toMatchObject({
      intent: "preview",
      source: "descriptor",
      resolutionPath: ["descriptor"],
      url: descriptor.directUrl,
    });
    expect(result.originalDescriptor).not.toBe(descriptor);
    expect(descriptor).toEqual(imageDescriptor());
  });

  it("uses an eligible image cache hit before and instead of Media API resolution", async () => {
    const getCachedImage = vi.fn(
      () => "blob:https://www.instagram.com/cached-image",
    );
    const resolveMedia = vi.fn(() => ({
      directUrl: "https://cdn.example.test/api-image.jpg",
    }));
    const dependencies = createDependencies({ getCachedImage, resolveMedia });
    const descriptor = imageDescriptor();
    const service = new MediaActionService(dependencies, {
      useImageCache: true,
      useMediaApi: true,
    });

    const result = await service.execute(descriptor, MEDIA_INTENT.DOWNLOAD);

    expect(getCachedImage).toHaveBeenCalledOnce();
    expect(resolveMedia).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      source: "cache",
      resolutionPath: ["descriptor", "cache"],
      url: "blob:https://www.instagram.com/cached-image",
    });
    expect(result.descriptor.directUrl).toBe(result.url);
    expect(result.descriptor.thumbnailUrl).toBe(result.url);
    expect(descriptor.directUrl).toBe("https://cdn.example.test/image.jpg");
  });

  it("skips image cache lookup for video and resolves through the Media API", async () => {
    const getCachedImage = vi.fn();
    const resolveMedia = vi.fn(() => ({
      directUrl: "https://cdn.example.test/api-video.mp4",
      dashManifest: "<MPD />",
      rawMediaItem: { pk: "video-1", video_versions: [{}] },
    }));
    const dependencies = createDependencies({ getCachedImage, resolveMedia });
    const service = new MediaActionService(dependencies, {
      useImageCache: true,
      useMediaApi: true,
    });

    const result = await service.execute(
      videoDescriptor(),
      MEDIA_INTENT.PREVIEW,
    );

    expect(getCachedImage).not.toHaveBeenCalled();
    expect(resolveMedia).toHaveBeenCalledOnce();
    expect(result.source).toBe("media-api");
    expect(result.url).toBe("https://cdn.example.test/api-video.mp4");
    expect(result.descriptor.dashManifest).toBe("<MPD />");
  });

  it("uses the image cache for a video thumbnail without entering DASH", async () => {
    const getCachedImage = vi.fn(
      () => "blob:https://www.instagram.com/cached-thumbnail",
    );
    const resolveDash = vi.fn();
    const dependencies = createDependencies({ getCachedImage, resolveDash });
    const service = new MediaActionService(dependencies, {
      useImageCache: true,
      useDash: true,
    });

    const result = await service.execute(
      videoDescriptor(),
      MEDIA_INTENT.THUMBNAIL,
    );

    expect(getCachedImage).toHaveBeenCalledOnce();
    expect(resolveDash).not.toHaveBeenCalled();
    expect(result.source).toBe("cache");
    expect(result.url).toBe(
      "blob:https://www.instagram.com/cached-thumbnail",
    );
  });

  it("runs Media API before DASH for a video download", async () => {
    const order = [];
    const resolveMedia = vi.fn(() => {
      order.push("media-api");
      return {
        directUrl: "https://cdn.example.test/api-video.mp4",
        dashManifest: "<MPD />",
      };
    });
    const resolveDash = vi.fn((context) => {
      order.push("dash");
      expect(context.descriptor.directUrl).toBe(
        "https://cdn.example.test/api-video.mp4",
      );
      expect(context.descriptor.dashManifest).toBe("<MPD />");
      return "blob:https://www.instagram.com/muxed-video";
    });
    const dependencies = createDependencies({ resolveMedia, resolveDash });
    dependencies.outputs.download.mockImplementation((context) => {
      order.push("output");
      return context;
    });
    const service = new MediaActionService(dependencies, {
      useMediaApi: true,
      useDash: true,
    });

    const result = await service.execute(
      videoDescriptor(),
      MEDIA_INTENT.DOWNLOAD,
    );

    expect(order).toEqual(["media-api", "dash", "output"]);
    expect(result).toMatchObject({
      source: "dash",
      resolutionPath: ["descriptor", "media-api", "dash"],
      url: "blob:https://www.instagram.com/muxed-video",
    });
  });

  it("can resolve an existing DASH item before and instead of Media API", async () => {
    const order = [];
    const resolveMedia = vi.fn(() => {
      order.push("media-api");
      return { directUrl: "https://cdn.example.test/api-video.mp4" };
    });
    const resolveDash = vi.fn((context) => {
      order.push("dash");
      expect(context.descriptor.dashManifest).toBe("<MPD>cached</MPD>");
      return "https://cdn.example.test/cached-dash.mp4";
    });
    const dependencies = createDependencies({ resolveMedia, resolveDash });
    dependencies.outputs.download.mockImplementation((context) => {
      order.push("output");
      return context;
    });
    const service = new MediaActionService(dependencies, {
      dashBeforeMediaApi: true,
      useMediaApi: true,
      useDash: ({ descriptor }) => Boolean(descriptor.dashManifest),
    });

    const result = await service.execute(
      videoDescriptor({ dashManifest: "<MPD>cached</MPD>" }),
      MEDIA_INTENT.DOWNLOAD,
    );

    expect(order).toEqual(["dash", "output"]);
    expect(resolveMedia).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      source: "dash",
      resolutionPath: ["descriptor", "dash"],
      url: "https://cdn.example.test/cached-dash.mp4",
    });
  });

  it("falls through from one unsuccessful early DASH attempt to Media API", async () => {
    const order = [];
    const resolveDash = vi.fn(() => {
      order.push("dash");
      return null;
    });
    const resolveMedia = vi.fn(() => {
      order.push("media-api");
      return {
        directUrl: "https://cdn.example.test/api-video.mp4",
        dashManifest: "<MPD>api</MPD>",
      };
    });
    const dependencies = createDependencies({ resolveDash, resolveMedia });
    dependencies.outputs.download.mockImplementation((context) => {
      order.push("output");
      return context;
    });
    const service = new MediaActionService(dependencies, {
      dashBeforeMediaApi: true,
      useMediaApi: true,
      useDash: true,
    });

    const result = await service.execute(
      videoDescriptor({ dashManifest: "<MPD>cached</MPD>" }),
      MEDIA_INTENT.DOWNLOAD,
    );

    expect(order).toEqual(["dash", "media-api", "output"]);
    expect(resolveDash).toHaveBeenCalledOnce();
    expect(resolveMedia).toHaveBeenCalledOnce();
    expect(result).toMatchObject({
      source: "media-api",
      resolutionPath: ["descriptor", "media-api"],
      url: "https://cdn.example.test/api-video.mp4",
    });
  });

  it("retains the original DASH-bearing item after manifest-less Media API enrichment", async () => {
    const cachedItem = {
      pk: "video-1",
      video_dash_manifest: "<MPD>cached</MPD>",
      video_versions: [{}],
    };
    const apiItem = { pk: "video-1", video_versions: [{}] };
    const resolveDash = vi.fn((context) => {
      expect(context.descriptor.rawMediaItem).toBe(apiItem);
      expect(context.descriptor.dashManifest).toBeNull();
      expect(context.originalDescriptor.rawMediaItem).toBe(cachedItem);
      expect(context.originalDescriptor.dashManifest).toBe(
        "<MPD>cached</MPD>",
      );
      return "https://cdn.example.test/cached-dash.mp4";
    });
    const dependencies = createDependencies({
      resolveMedia: vi.fn(() => ({
        directUrl: "https://cdn.example.test/api-video.mp4",
        rawMediaItem: apiItem,
        dashManifest: null,
      })),
      resolveDash,
    });
    const service = new MediaActionService(dependencies, {
      useMediaApi: true,
      useDash: ({ originalDescriptor }) =>
        Boolean(originalDescriptor.dashManifest),
    });

    const result = await service.execute(
      videoDescriptor({
        dashManifest: "<MPD>cached</MPD>",
        rawMediaItem: cachedItem,
      }),
      MEDIA_INTENT.DOWNLOAD,
    );

    expect(resolveDash).toHaveBeenCalledOnce();
    expect(result).toMatchObject({
      source: "dash",
      resolutionPath: ["descriptor", "media-api", "dash"],
      url: "https://cdn.example.test/cached-dash.mp4",
    });
  });

  it("never applies DASH resolution to previews or thumbnail actions", async () => {
    const resolveDash = vi.fn(() => "https://cdn.example.test/dash.mp4");
    const dependencies = createDependencies({ resolveDash });
    const service = new MediaActionService(dependencies, { useDash: true });

    const preview = await service.execute(
      videoDescriptor(),
      MEDIA_INTENT.PREVIEW,
    );
    const thumbnail = await service.execute(
      videoDescriptor(),
      MEDIA_INTENT.THUMBNAIL,
    );

    expect(resolveDash).not.toHaveBeenCalled();
    expect(preview.url).toBe("https://cdn.example.test/video.mp4");
    expect(thumbnail.url).toBe("https://cdn.example.test/video-thumb.jpg");
    expect(dependencies.outputs.preview).toHaveBeenCalledOnce();
    expect(dependencies.outputs.thumbnail).toHaveBeenCalledOnce();
  });

  it("allows Media API resolution to supply a missing video thumbnail", async () => {
    const dependencies = createDependencies({
      resolveMedia: vi.fn(
        () => "https://cdn.example.test/api-thumbnail.jpg",
      ),
    });
    const service = new MediaActionService(dependencies, {
      useMediaApi: true,
    });

    const result = await service.execute(
      videoDescriptor({ thumbnailUrl: null }),
      MEDIA_INTENT.THUMBNAIL,
    );

    expect(result.source).toBe("media-api");
    expect(result.url).toBe("https://cdn.example.test/api-thumbnail.jpg");
    expect(result.descriptor.directUrl).toBe(
      "https://cdn.example.test/video.mp4",
    );
  });

  it("treats null resolver results as non-applicable and retains direct output", async () => {
    const dependencies = createDependencies({
      resolveMedia: vi.fn(() => null),
      resolveDash: vi.fn(() => null),
    });
    const service = new MediaActionService(dependencies, {
      useMediaApi: true,
      useDash: true,
    });

    const result = await service.execute(
      videoDescriptor(),
      MEDIA_INTENT.DOWNLOAD,
    );

    expect(result.source).toBe("descriptor");
    expect(result.resolutionPath).toEqual(["descriptor"]);
    expect(result.url).toBe("https://cdn.example.test/video.mp4");
  });
});

describe("MediaActionService fail-open policy", () => {
  it("fails closed on Media API errors by default", async () => {
    const failure = new Error("Media API throttled");
    const onStageError = vi.fn();
    const dependencies = createDependencies({
      resolveMedia: vi.fn(() => {
        throw failure;
      }),
      onStageError,
    });
    const service = new MediaActionService(dependencies, {
      useMediaApi: true,
    });

    await expect(
      service.execute(imageDescriptor(), MEDIA_INTENT.DOWNLOAD),
    ).rejects.toBe(failure);
    expect(dependencies.outputs.download).not.toHaveBeenCalled();
    expect(onStageError).toHaveBeenCalledWith(
      failure,
      expect.objectContaining({
        stage: MEDIA_ACTION_STAGE.MEDIA_API,
        willFallback: false,
      }),
    );
  });

  it("can fail open from Media API to the descriptor through a predicate", async () => {
    const failure = new Error("Media API throttled");
    const fallback = vi.fn((error, context) => {
      expect(error).toBe(failure);
      expect(context.stage).toBe(MEDIA_ACTION_STAGE.MEDIA_API);
      return true;
    });
    const dependencies = createDependencies({
      resolveMedia: vi.fn(() => {
        throw failure;
      }),
    });
    const service = new MediaActionService(dependencies, {
      useMediaApi: true,
      failOpenOnMediaApiError: fallback,
    });

    const result = await service.execute(
      imageDescriptor(),
      MEDIA_INTENT.DOWNLOAD,
    );

    expect(fallback).toHaveBeenCalledOnce();
    expect(result.source).toBe("descriptor");
    expect(result.url).toBe("https://cdn.example.test/image.jpg");
  });

  it("fails open on cache and DASH errors by default", async () => {
    const onStageError = vi.fn();
    const cacheDependencies = createDependencies({
      getCachedImage: vi.fn(() => {
        throw new Error("cache damaged");
      }),
      onStageError,
    });
    const cacheService = new MediaActionService(cacheDependencies, {
      useImageCache: true,
    });
    const dashDependencies = createDependencies({
      resolveDash: vi.fn(() => {
        throw new Error("mux failed");
      }),
      onStageError,
    });
    const dashService = new MediaActionService(dashDependencies, {
      useDash: true,
    });

    const imageResult = await cacheService.execute(
      imageDescriptor(),
      MEDIA_INTENT.DOWNLOAD,
    );
    const videoResult = await dashService.execute(
      videoDescriptor(),
      MEDIA_INTENT.DOWNLOAD,
    );

    expect(imageResult.source).toBe("descriptor");
    expect(videoResult.source).toBe("descriptor");
    expect(onStageError).toHaveBeenCalledTimes(2);
    expect(onStageError.mock.calls.map((call) => call[1])).toEqual([
      expect.objectContaining({ stage: "cache", willFallback: true }),
      expect.objectContaining({ stage: "dash", willFallback: true }),
    ]);
  });

  it("can make DASH resolution fail closed", async () => {
    const failure = new MediaActionError("dash", "mux failed");
    const dependencies = createDependencies({
      resolveDash: vi.fn(() => {
        throw failure;
      }),
    });
    const service = new MediaActionService(dependencies, {
      useDash: true,
      failOpenOnDashError: false,
    });

    await expect(
      service.execute(videoDescriptor(), MEDIA_INTENT.DOWNLOAD),
    ).rejects.toBe(failure);
    expect(dependencies.outputs.download).not.toHaveBeenCalled();
  });

  it("reports output errors without replacing them", async () => {
    const failure = new Error("download rejected");
    const onStageError = vi.fn(() => {
      throw new Error("logger failed");
    });
    const dependencies = createDependencies({ onStageError });
    dependencies.outputs.download.mockRejectedValue(failure);
    const service = new MediaActionService(dependencies);

    await expect(
      service.execute(imageDescriptor(), MEDIA_INTENT.DOWNLOAD),
    ).rejects.toBe(failure);
    expect(onStageError).toHaveBeenCalledWith(
      failure,
      expect.objectContaining({
        stage: "output",
        willFallback: false,
      }),
    );
  });

  it("reports a missing video thumbnail as an output-stage error", async () => {
    const onStageError = vi.fn();
    const dependencies = createDependencies({ onStageError });
    const service = new MediaActionService(dependencies);

    await expect(
      service.execute(
        videoDescriptor({ thumbnailUrl: null }),
        MEDIA_INTENT.THUMBNAIL,
      ),
    ).rejects.toMatchObject({
      name: "MediaActionError",
      stage: MEDIA_ACTION_STAGE.OUTPUT,
    });
    expect(dependencies.outputs.thumbnail).not.toHaveBeenCalled();
    expect(onStageError).toHaveBeenCalledWith(
      expect.any(MediaActionError),
      expect.objectContaining({
        stage: MEDIA_ACTION_STAGE.OUTPUT,
        willFallback: false,
      }),
    );
  });
});
