// @vitest-environment node

import { readFileSync } from "node:fs";

import { JSDOM } from "jsdom";
import { describe, expect, it, vi } from "vitest";

import {
  DashExecutionCoordinator,
  normalizeInstagramDashRepresentationUrl,
  parseDashManifest,
} from "../../../src/media/index.js";

const fixtureDirectory = new URL("./fixtures/", import.meta.url);
const DOMParser = new JSDOM().window.DOMParser;

function fixture(name) {
  return readFileSync(new URL(name, fixtureDirectory), "utf8");
}

function parse(manifest, options = {}) {
  return parseDashManifest(manifest, { DOMParser, ...options });
}

function createExecutionHarness(overrides = {}) {
  const videoBuffer = new ArrayBuffer(4);
  const audioBuffer = new ArrayBuffer(2);
  const mergedBuffer = new ArrayBuffer(6);
  const blob = { type: "video/mp4" };
  const dependencies = {
    createMp4Blob: vi.fn(() => blob),
    fetchArrayBuffer: vi.fn(async (url) =>
      url.includes("audio") ? audioBuffer : videoBuffer,
    ),
    logger: vi.fn(),
    mux: vi.fn(async () => mergedBuffer),
    saveMerged: vi.fn(async () => "merged-result"),
    saveStream: vi.fn(async () => true),
    ...overrides,
  };
  const coordinator = new DashExecutionCoordinator(dependencies);
  return {
    audioBuffer,
    blob,
    coordinator,
    dependencies,
    mergedBuffer,
    videoBuffer,
  };
}

const metadata = Object.freeze({
  shortcode: "DashFixture1",
  sourceType: "post",
  timestamp: 1700000000,
  username: "fixture_user",
});

describe("parseDashManifest", () => {
  it("filters non-HTTPS representations and preserves legacy ranking", () => {
    const result = parse(fixture("dash-mixed.mpd"));

    expect(result.video).toEqual({
      bandwidth: 5200000,
      codecs: "avc1.640028",
      contentType: "video",
      height: 1080,
      id: "video-1080-best",
      mimeType: "video/mp4",
      url: "https://cdn.example.test/video-1080-best.mp4",
      width: 1920,
    });
    expect(result.audio).toEqual({
      bandwidth: 256000,
      codecs: "mp4a.40.2",
      contentType: "audio",
      height: 0,
      id: "audio-256",
      mimeType: "audio/mp4",
      url: "https://cdn.example.test/audio-256.m4a",
      width: 0,
    });
  });

  it("accepts representation-level type metadata for video-only media", () => {
    expect(parse(fixture("dash-video-only.mpd"))).toEqual({
      video: {
        bandwidth: 3100000,
        codecs: "avc1.640028",
        contentType: "video",
        height: 1920,
        id: "video-only",
        mimeType: "video/mp4",
        url: "https://cdn.example.test/video-only.mp4",
        width: 1080,
      },
      audio: null,
    });
  });

  it("suppresses audio when the Media API reports has_audio=false", () => {
    const result = parse(fixture("dash-mixed.mpd"), {
      hasAudio: false,
    });

    expect(result.video?.id).toBe("video-1080-best");
    expect(result.audio).toBeNull();
  });

  it("recovers complete signed Instagram representations from range URLs", () => {
    const manifest = `<?xml version="1.0"?>
      <MPD xmlns="urn:mpeg:dash:schema:mpd:2011">
        <Period><AdaptationSet contentType="video" mimeType="video/mp4">
          <Representation id="signed" bandwidth="4000000" width="1080" height="1920">
            <BaseURL>https://scontent-sea1-1.cdninstagram.com/v/t66/video.mp4?efg=asset%3D1&amp;oe=6A000000&amp;oh=signed-value&amp;bytestart=0&amp;byteend=31</BaseURL>
          </Representation>
        </AdaptationSet></Period>
      </MPD>`;

    expect(parse(manifest).video?.url).toBe(
      "https://scontent-sea1-1.cdninstagram.com/v/t66/video.mp4?efg=asset%3D1&oe=6A000000&oh=signed-value",
    );
  });

  it.each([
    ["malformed", fixture("dash-malformed.mpd")],
    ["empty", fixture("dash-empty.mpd")],
    ["blank", ""],
    ["non-string", null],
  ])("returns an empty selection for %s manifests", (_name, manifest) => {
    expect(parse(manifest)).toEqual({
      video: null,
      audio: null,
    });
  });
});

describe("normalizeInstagramDashRepresentationUrl", () => {
  it("preserves signed parameters while removing only a valid byte range", () => {
    expect(normalizeInstagramDashRepresentationUrl(
      "https://instagram.fboi1-1.fna.fbcdn.net/video.mp4?oe=6A000000&oh=signed&bytestart=32&byteend=63&_nc_sid=fixture",
    )).toBe(
      "https://instagram.fboi1-1.fna.fbcdn.net/video.mp4?oe=6A000000&oh=signed&_nc_sid=fixture",
    );
  });

  it.each([
    "https://cdn.example.test/video.mp4?bytestart=0&byteend=31&oh=signed",
    "https://scontent.cdninstagram.com/video.mp4?bytestart=nope&byteend=31&oh=signed",
    "https://scontent.cdninstagram.com/video.mp4?bytestart=64&byteend=31&oh=signed",
  ])("does not rewrite an unqualified URL: %s", (url) => {
    expect(normalizeInstagramDashRepresentationUrl(url)).toBe(url);
  });
});

describe("DashExecutionCoordinator", () => {
  it("fetches, muxes, and saves one merged MP4 on success", async () => {
    const harness = createExecutionHarness();

    await expect(
      harness.coordinator.execute({
        audioUrl: "https://cdn.example.test/audio.m4a",
        metadata,
        videoUrl: "https://cdn.example.test/video.mp4",
      }),
    ).resolves.toBe("merged-result");

    expect(harness.dependencies.fetchArrayBuffer).toHaveBeenCalledTimes(2);
    expect(harness.dependencies.mux).toHaveBeenCalledWith(
      harness.videoBuffer,
      harness.audioBuffer,
    );
    expect(harness.dependencies.createMp4Blob).toHaveBeenCalledWith(
      harness.mergedBuffer,
    );
    expect(harness.dependencies.saveMerged).toHaveBeenCalledWith(
      "https://cdn.example.test/video.mp4",
      harness.blob,
      { ...metadata, filetype: "mp4" },
    );
    expect(harness.dependencies.saveStream).not.toHaveBeenCalled();
  });

  it("falls back to separate MP4 and M4A downloads after mux failure", async () => {
    const harness = createExecutionHarness({
      mux: vi.fn(async () => {
        throw new Error("mux failed");
      }),
    });

    await expect(
      harness.coordinator.execute({
        audioUrl: "https://cdn.example.test/audio.m4a",
        metadata,
        videoUrl: "https://cdn.example.test/video.mp4",
      }),
    ).resolves.toBe(true);

    expect(harness.dependencies.saveMerged).not.toHaveBeenCalled();
    expect(harness.dependencies.saveStream.mock.calls).toEqual([
      ["https://cdn.example.test/video.mp4", { ...metadata, filetype: "mp4" }],
      ["https://cdn.example.test/audio.m4a", { ...metadata, filetype: "m4a" }],
    ]);
  });

  it("attempts both separate streams and preserves a partial-failure result", async () => {
    const saveStream = vi
      .fn()
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);
    const harness = createExecutionHarness({
      mux: vi.fn(async () => {
        throw new Error("mux failed");
      }),
      saveStream,
    });

    await expect(
      harness.coordinator.execute({
        audioUrl: "https://cdn.example.test/audio.m4a",
        metadata,
        videoUrl: "https://cdn.example.test/video.mp4",
      }),
    ).resolves.toBe(false);
    expect(saveStream).toHaveBeenCalledTimes(2);
  });

  it("downloads only the MP4 when no audio representation is selected", async () => {
    const harness = createExecutionHarness();

    await expect(
      harness.coordinator.execute({
        audioUrl: null,
        metadata,
        videoUrl: "https://cdn.example.test/video-only.mp4",
      }),
    ).resolves.toBe(true);

    expect(harness.dependencies.fetchArrayBuffer).not.toHaveBeenCalled();
    expect(harness.dependencies.mux).not.toHaveBeenCalled();
    expect(harness.dependencies.saveStream).toHaveBeenCalledWith(
      "https://cdn.example.test/video-only.mp4",
      { ...metadata, filetype: "mp4" },
    );
  });
});
