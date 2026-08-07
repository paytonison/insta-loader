export const PREFERENCE_STORAGE_KEYS = Object.freeze({
  RENAME_FORMAT: "G_RENAME_FORMAT",
  LANGUAGE: "UI_LANGUAGE",
  HOTKEY_DEBUG_KEYCODE: "G_HOTKEY_DEBUG_KEYCODE",
  HOTKEY_SETTINGS_KEYCODE: "G_HOTKEY_SETTINGS_KEYCODE",
  HOTKEY_KEY_SETTINGS_KEYCODE: "G_HOTKEY_KEY_SETTINGS_KEYCODE",
  HOTKEY_DOWNLOAD_STORY_KEYCODE: "G_HOTKEY_DOWNLOAD_STORY_KEYCODE",
  CHECK_TIMESTAMP: "G_CHECK_TIMESTAMP",
  IMAGE_CACHE: "URLS_OF_IMAGES_TEMPORARILY_STORED",
});

export const DEFAULT_RENAME_FORMAT =
  "%USERNAME%-%SOURCE_TYPE%-%SHORTCODE%-%YEAR%%MONTH%%DAY%_%HOUR%%MINUTE%%SECOND%_%ORIGINAL_NAME_FIRST%";

export const HOTKEY_PREFERENCE = Object.freeze({
  DEBUG: "debug",
  SETTINGS: "settings",
  KEY_SETTINGS: "keySettings",
  DOWNLOAD_STORY: "downloadStory",
});

export const HOTKEY_DEFAULTS = Object.freeze({
  [HOTKEY_PREFERENCE.DEBUG]: 90,
  [HOTKEY_PREFERENCE.SETTINGS]: 87,
  [HOTKEY_PREFERENCE.KEY_SETTINGS]: 67,
  [HOTKEY_PREFERENCE.DOWNLOAD_STORY]: 83,
});

export const HOTKEY_STORAGE_KEYS = Object.freeze({
  [HOTKEY_PREFERENCE.DEBUG]:
    PREFERENCE_STORAGE_KEYS.HOTKEY_DEBUG_KEYCODE,
  [HOTKEY_PREFERENCE.SETTINGS]:
    PREFERENCE_STORAGE_KEYS.HOTKEY_SETTINGS_KEYCODE,
  [HOTKEY_PREFERENCE.KEY_SETTINGS]:
    PREFERENCE_STORAGE_KEYS.HOTKEY_KEY_SETTINGS_KEYCODE,
  [HOTKEY_PREFERENCE.DOWNLOAD_STORY]:
    PREFERENCE_STORAGE_KEYS.HOTKEY_DOWNLOAD_STORY_KEYCODE,
});

/**
 * @typedef {"debug"|"settings"|"keySettings"|"downloadStory"} HotkeyPreference
 */

/**
 * @typedef {Object} PreferenceSnapshot
 * @property {*} renameFormat
 * @property {*} language
 * @property {Object<HotkeyPreference, *>} hotkeys
 */

/**
 * Application-lifetime storage for the userscript's non-boolean preferences.
 * Values intentionally remain uncoerced because the published userscript has
 * always accepted whatever Tampermonkey returned for these keys.
 */
export class PreferencesStore {
  /**
   * @param {{getValue: (key: string, defaultValue?: *) => *, setValue: (key: string, value: *) => *}} storage
   * @param {{defaultLanguage?: *, now?: () => number}} [options]
   */
  constructor(storage, options = {}) {
    if (
      typeof storage?.getValue !== "function" ||
      typeof storage?.setValue !== "function"
    ) {
      throw new TypeError(
        "PreferencesStore requires getValue() and setValue() storage methods.",
      );
    }
    if (options.now != null && typeof options.now !== "function") {
      throw new TypeError("PreferencesStore now must be a function.");
    }

    this.storage = storage;
    this.defaultLanguage = options.defaultLanguage;
    this.now = options.now || Date.now;
    this._renameFormat = DEFAULT_RENAME_FORMAT;
    this._language = this.defaultLanguage;
    this._hotkeys = { ...HOTKEY_DEFAULTS };
    this._loaded = false;
  }

  /** @return {boolean} */
  get loaded() {
    return this._loaded;
  }

  /**
   * Apply the legacy truthiness precedence used at startup. Empty strings,
   * zero, false, null, and undefined all fall back; other values are retained
   * without coercion.
   *
   * @return {PreferenceSnapshot}
   */
  load() {
    this._renameFormat = this._readTruthy(
      PREFERENCE_STORAGE_KEYS.RENAME_FORMAT,
      DEFAULT_RENAME_FORMAT,
    );
    this._language = this._readTruthy(
      PREFERENCE_STORAGE_KEYS.LANGUAGE,
      this.defaultLanguage,
    );
    this._hotkeys = {};

    for (const name of Object.values(HOTKEY_PREFERENCE)) {
      this._hotkeys[name] = this._readTruthy(
        HOTKEY_STORAGE_KEYS[name],
        HOTKEY_DEFAULTS[name],
      );
    }

    this._loaded = true;
    return this.snapshot();
  }

  /** @return {*} */
  getRenameFormat() {
    return this._renameFormat;
  }

  /**
   * @param {*} value
   * @return {*}
   */
  setRenameFormat(value) {
    this._renameFormat = value;
    this.storage.setValue(PREFERENCE_STORAGE_KEYS.RENAME_FORMAT, value);
    return value;
  }

  /** @return {*} */
  getLanguage() {
    return this._language;
  }

  /**
   * @param {*} value
   * @return {*}
   */
  setLanguage(value) {
    this._language = value;
    this.storage.setValue(PREFERENCE_STORAGE_KEYS.LANGUAGE, value);
    return value;
  }

  /**
   * @param {HotkeyPreference|string} name
   * @return {*}
   */
  getHotkey(name) {
    this._assertHotkey(name);
    return this._hotkeys[name];
  }

  /**
   * @param {HotkeyPreference|string} name
   * @param {*} value
   * @return {*}
   */
  setHotkey(name, value) {
    this._assertHotkey(name);
    this._hotkeys[name] = value;
    this.storage.setValue(HOTKEY_STORAGE_KEYS[name], value);
    return value;
  }

  /**
   * Read the update timestamp lazily so disabling update checks continues to
   * avoid touching its storage key. Only null and undefined fall back to now;
   * stored zero, false, and empty-string values remain observable.
   *
   * @return {*}
   */
  getCheckTimestamp() {
    return (
      this.storage.getValue(PREFERENCE_STORAGE_KEYS.CHECK_TIMESTAMP) ??
      this.now()
    );
  }

  /**
   * @param {*} [value]
   * @return {*}
   */
  setCheckTimestamp(value = this.now()) {
    this.storage.setValue(PREFERENCE_STORAGE_KEYS.CHECK_TIMESTAMP, value);
    return value;
  }

  /**
   * Read the image-cache payload without imposing a shape or cloning it. The
   * image-cache service remains responsible for validation, expiry, and size.
   *
   * @param {*} [defaultValue]
   * @return {*}
   */
  getImageCache(defaultValue = {}) {
    return this.storage.getValue(
      PREFERENCE_STORAGE_KEYS.IMAGE_CACHE,
      defaultValue,
    );
  }

  /**
   * @param {*} value
   * @return {*}
   */
  setImageCache(value) {
    return this.storage.setValue(PREFERENCE_STORAGE_KEYS.IMAGE_CACHE, value);
  }

  /**
   * @return {PreferenceSnapshot}
   */
  snapshot() {
    return {
      renameFormat: this._renameFormat,
      language: this._language,
      hotkeys: { ...this._hotkeys },
    };
  }

  /**
   * @param {string} key
   * @param {*} fallback
   * @return {*}
   * @private
   */
  _readTruthy(key, fallback) {
    const stored = this.storage.getValue(key);
    return stored ? stored : fallback;
  }

  /**
   * @param {string} name
   * @return {void}
   * @private
   */
  _assertHotkey(name) {
    if (!Object.prototype.hasOwnProperty.call(HOTKEY_DEFAULTS, name)) {
      throw new RangeError(`Unknown hotkey preference: ${name}`);
    }
  }
}
