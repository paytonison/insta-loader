import { describe, expect, it, vi } from "vitest";

import {
  SettingsStore,
  USER_SETTING_DEFAULTS,
  USER_SETTING_KEYS,
} from "../../../src/core/settings-store.js";

describe("SettingsStore", () => {
  it("preserves all 21 source defaults in their published order", () => {
    expect(USER_SETTING_KEYS).toHaveLength(21);
    expect(USER_SETTING_DEFAULTS).toEqual({
      AUTO_RENAME: true,
      CAPTURE_IMAGE_VIA_MEDIA_CACHE: false,
      CHECK_FOR_UPDATE: false,
      DIRECT_DOWNLOAD_ALL: true,
      DIRECT_DOWNLOAD_STORY: true,
      DIRECT_DOWNLOAD_VISIBLE_RESOURCE: true,
      DISABLE_VIDEO_LOOPING: false,
      FALLBACK_TO_BLOB_FETCH_IF_MEDIA_API_THROTTLED: false,
      FORCE_FETCH_ALL_RESOURCES: true,
      FORCE_RESOURCE_VIA_MEDIA: true,
      HTML5_VIDEO_CONTROL: false,
      MAX_REEL_PLAYBACK_QUALITY: true,
      MODIFY_RESOURCE_EXIF: false,
      MODIFY_VIDEO_VOLUME: false,
      NEW_TAB_ALWAYS_FORCE_MEDIA_IN_POST: true,
      PREFER_DASH_MANIFEST: true,
      REDIRECT_CLICK_USER_STORY_PICTURE: false,
      RENAME_PUBLISH_DATE: true,
      SCROLL_BUTTON: false,
      SKIP_VIEW_STORY_CONFIRM: true,
      SKIP_SHARED_WITH_YOU_DIALOG: true,
    });
  });

  it("only lets stored booleans override defaults and writes no defaults", () => {
    const values = new Map([
      ["AUTO_RENAME", false],
      ["CHECK_FOR_UPDATE", "true"],
      ["SCROLL_BUTTON", 1],
      ["MODIFY_VIDEO_VOLUME", false],
    ]);
    const storage = {
      getValue: vi.fn((key) => values.get(key)),
      setValue: vi.fn(),
    };
    const store = new SettingsStore(storage);

    const settings = store.load();

    expect(settings.AUTO_RENAME).toBe(false);
    expect(settings.CHECK_FOR_UPDATE).toBe(false);
    expect(settings.SCROLL_BUTTON).toBe(false);
    expect(storage.getValue).toHaveBeenCalledTimes(21);
    expect(storage.setValue).not.toHaveBeenCalled();
    expect(store.wasLoadedFromStorage("MODIFY_VIDEO_VOLUME")).toBe(true);
    expect(store.wasLoadedFromStorage("CHECK_FOR_UPDATE")).toBe(false);
  });

  it("persists immediate boolean changes without coercing child settings", () => {
    const storage = { getValue: vi.fn(), setValue: vi.fn() };
    const listener = vi.fn();
    const store = new SettingsStore(storage);
    store.load();
    store.subscribe(listener);

    store.set("FORCE_RESOURCE_VIA_MEDIA", false);

    expect(storage.setValue).toHaveBeenCalledWith(
      "FORCE_RESOURCE_VIA_MEDIA",
      false,
    );
    expect(store.get("PREFER_DASH_MANIFEST")).toBe(true);
    expect(listener).toHaveBeenCalledWith({
      name: "FORCE_RESOURCE_VIA_MEDIA",
      value: false,
      previousValue: true,
      source: "user",
    });
    expect(() => store.set("AUTO_RENAME", "false")).toThrow(TypeError);
  });
});
