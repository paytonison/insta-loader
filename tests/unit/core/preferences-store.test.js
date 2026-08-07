import { describe, expect, it, vi } from "vitest";

import {
  DEFAULT_RENAME_FORMAT,
  HOTKEY_DEFAULTS,
  HOTKEY_PREFERENCE,
  HOTKEY_STORAGE_KEYS,
  PREFERENCE_STORAGE_KEYS,
  PreferencesStore,
} from "../../../src/core/preferences-store.js";

function createStorage(initialValues = {}) {
  const values = new Map(Object.entries(initialValues));
  return {
    values,
    getValue: vi.fn((key, defaultValue) => {
      return values.has(key) ? values.get(key) : defaultValue;
    }),
    setValue: vi.fn((key, value) => {
      values.set(key, value);
      return value;
    }),
  };
}

describe("PreferencesStore storage contract", () => {
  it("owns the exact published non-boolean storage keys and defaults", () => {
    expect(PREFERENCE_STORAGE_KEYS).toEqual({
      RENAME_FORMAT: "G_RENAME_FORMAT",
      LANGUAGE: "UI_LANGUAGE",
      HOTKEY_DEBUG_KEYCODE: "G_HOTKEY_DEBUG_KEYCODE",
      HOTKEY_SETTINGS_KEYCODE: "G_HOTKEY_SETTINGS_KEYCODE",
      HOTKEY_KEY_SETTINGS_KEYCODE: "G_HOTKEY_KEY_SETTINGS_KEYCODE",
      HOTKEY_DOWNLOAD_STORY_KEYCODE:
        "G_HOTKEY_DOWNLOAD_STORY_KEYCODE",
      CHECK_TIMESTAMP: "G_CHECK_TIMESTAMP",
      IMAGE_CACHE: "URLS_OF_IMAGES_TEMPORARILY_STORED",
    });
    expect(DEFAULT_RENAME_FORMAT).toBe(
      "%USERNAME%-%SOURCE_TYPE%-%SHORTCODE%-%YEAR%%MONTH%%DAY%_%HOUR%%MINUTE%%SECOND%_%ORIGINAL_NAME_FIRST%",
    );
    expect(HOTKEY_DEFAULTS).toEqual({
      debug: 90,
      settings: 87,
      keySettings: 67,
      downloadStory: 83,
    });
    expect(HOTKEY_STORAGE_KEYS).toEqual({
      debug: "G_HOTKEY_DEBUG_KEYCODE",
      settings: "G_HOTKEY_SETTINGS_KEYCODE",
      keySettings: "G_HOTKEY_KEY_SETTINGS_KEYCODE",
      downloadStory: "G_HOTKEY_DOWNLOAD_STORY_KEYCODE",
    });
  });

  it("uses truthy stored values without coercion", () => {
    const storage = createStorage({
      G_RENAME_FORMAT: "%SHORTCODE%",
      UI_LANGUAGE: "es",
      G_HOTKEY_DEBUG_KEYCODE: "88",
      G_HOTKEY_SETTINGS_KEYCODE: 75,
      G_HOTKEY_KEY_SETTINGS_KEYCODE: 49,
      G_HOTKEY_DOWNLOAD_STORY_KEYCODE: 50,
    });
    const store = new PreferencesStore(storage, {
      defaultLanguage: "en-US",
    });

    expect(store.load()).toEqual({
      renameFormat: "%SHORTCODE%",
      language: "es",
      hotkeys: {
        debug: "88",
        settings: 75,
        keySettings: 49,
        downloadStory: 50,
      },
    });
    expect(store.loaded).toBe(true);
  });

  it("preserves truthiness fallback for rename, language, and hotkeys", () => {
    const storage = createStorage({
      G_RENAME_FORMAT: "",
      UI_LANGUAGE: 0,
      G_HOTKEY_DEBUG_KEYCODE: 0,
      G_HOTKEY_SETTINGS_KEYCODE: false,
      G_HOTKEY_KEY_SETTINGS_KEYCODE: null,
      G_HOTKEY_DOWNLOAD_STORY_KEYCODE: undefined,
    });
    const store = new PreferencesStore(storage, {
      defaultLanguage: "fr-CA",
    });

    expect(store.load()).toEqual({
      renameFormat: DEFAULT_RENAME_FORMAT,
      language: "fr-CA",
      hotkeys: HOTKEY_DEFAULTS,
    });
  });

  it("persists live values under the unchanged keys", () => {
    const storage = createStorage();
    const store = new PreferencesStore(storage, {
      defaultLanguage: "en-US",
    });
    store.load();

    expect(store.setRenameFormat("")).toBe("");
    expect(store.setLanguage("de")).toBe("de");
    expect(store.setHotkey(HOTKEY_PREFERENCE.SETTINGS, 75)).toBe(75);

    expect(store.getRenameFormat()).toBe("");
    expect(store.getLanguage()).toBe("de");
    expect(store.getHotkey(HOTKEY_PREFERENCE.SETTINGS)).toBe(75);
    expect(storage.setValue.mock.calls).toEqual([
      ["G_RENAME_FORMAT", ""],
      ["UI_LANGUAGE", "de"],
      ["G_HOTKEY_SETTINGS_KEYCODE", 75],
    ]);
  });

  it("uses nullish precedence for the lazy update timestamp", () => {
    const now = vi.fn(() => 123_456);

    for (const storedValue of [0, false, ""]) {
      const storage = createStorage({ G_CHECK_TIMESTAMP: storedValue });
      const store = new PreferencesStore(storage, { now });
      expect(store.getCheckTimestamp()).toBe(storedValue);
    }

    for (const storedValue of [null, undefined]) {
      const storage = createStorage({ G_CHECK_TIMESTAMP: storedValue });
      const store = new PreferencesStore(storage, { now });
      expect(store.getCheckTimestamp()).toBe(123_456);
    }

    expect(now).toHaveBeenCalledTimes(2);
  });

  it("writes either an injected timestamp or an explicit timestamp", () => {
    const storage = createStorage();
    const store = new PreferencesStore(storage, { now: () => 222 });

    expect(store.setCheckTimestamp()).toBe(222);
    expect(store.setCheckTimestamp(0)).toBe(0);
    expect(storage.setValue.mock.calls).toEqual([
      ["G_CHECK_TIMESTAMP", 222],
      ["G_CHECK_TIMESTAMP", 0],
    ]);
  });

  it("provides raw image-cache storage without cloning or validation", () => {
    const entries = {
      media: { url: "https://cdn.test/image.jpg", ts: 100 },
    };
    const storage = createStorage({
      URLS_OF_IMAGES_TEMPORARILY_STORED: entries,
    });
    const store = new PreferencesStore(storage);

    expect(store.getImageCache()).toBe(entries);
    expect(storage.getValue).toHaveBeenCalledWith(
      "URLS_OF_IMAGES_TEMPORARILY_STORED",
      {},
    );

    const replacement = "legacy-raw-value";
    expect(store.setImageCache(replacement)).toBe(replacement);
    expect(storage.setValue).toHaveBeenCalledWith(
      "URLS_OF_IMAGES_TEMPORARILY_STORED",
      replacement,
    );
  });

  it("passes an injected image-cache default through by identity", () => {
    const storage = createStorage();
    const store = new PreferencesStore(storage);
    const fallback = Object.create(null);

    expect(store.getImageCache(fallback)).toBe(fallback);
    expect(storage.getValue).toHaveBeenCalledWith(
      "URLS_OF_IMAGES_TEMPORARILY_STORED",
      fallback,
    );
  });

  it("rejects incomplete dependencies and unknown hotkeys", () => {
    expect(() => new PreferencesStore({})).toThrow(TypeError);
    expect(
      () =>
        new PreferencesStore({
          getValue: vi.fn(),
          setValue: vi.fn(),
        }, { now: 123 }),
    ).toThrow(TypeError);

    const store = new PreferencesStore(createStorage());
    expect(() => store.getHotkey("unknown")).toThrow(RangeError);
    expect(() => store.setHotkey("unknown", 90)).toThrow(RangeError);
  });
});
