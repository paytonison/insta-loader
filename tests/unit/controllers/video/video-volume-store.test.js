import { describe, expect, it, vi } from "vitest";

import {
  DEFAULT_VIDEO_VOLUME,
  VIDEO_VOLUME_STORAGE_KEY,
  VideoVolumeStore,
  readLegacyVideoVolume,
} from "../../../../src/controllers/video/video-volume-store.js";

describe("legacy video volume state", () => {
  it("preserves the stored-zero truthiness behavior on reload", () => {
    const storage = {
      getValue: vi.fn(() => 0),
      setValue: vi.fn(),
    };

    expect(readLegacyVideoVolume(storage)).toBe(DEFAULT_VIDEO_VOLUME);
    expect(new VideoVolumeStore(storage).get()).toBe(DEFAULT_VIDEO_VOLUME);
    expect(storage.getValue).toHaveBeenCalledWith(VIDEO_VOLUME_STORAGE_KEY);
  });

  it("retains nonzero numeric and slider-string values without coercion", () => {
    const numeric = {
      getValue: vi.fn(() => 0.35),
      setValue: vi.fn(),
    };
    const sliderString = {
      getValue: vi.fn(() => "0.45"),
      setValue: vi.fn(),
    };

    expect(new VideoVolumeStore(numeric).get()).toBe(0.35);
    expect(new VideoVolumeStore(sliderString).get()).toBe("0.45");
  });

  it("updates shared state and the unchanged userscript storage key", () => {
    const storage = {
      getValue: vi.fn(() => 0.5),
      setValue: vi.fn(),
    };
    const volume = new VideoVolumeStore(storage);

    expect(volume.set("0.75")).toBe("0.75");
    expect(volume.get()).toBe("0.75");
    expect(storage.setValue).toHaveBeenCalledWith(
      VIDEO_VOLUME_STORAGE_KEY,
      "0.75",
    );
  });

  it("rejects incomplete storage adapters", () => {
    expect(() => readLegacyVideoVolume({})).toThrow(TypeError);
    expect(
      () => new VideoVolumeStore({ getValue: vi.fn() }),
    ).toThrow(TypeError);
  });
});
