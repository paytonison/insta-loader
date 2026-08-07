/**
 * The order and values are part of the published settings-dialog contract.
 * Each property name is also its literal Tampermonkey storage key.
 */
export const USER_SETTING_DEFAULTS = Object.freeze({
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

export const USER_SETTING_KEYS = Object.freeze(
  Object.keys(USER_SETTING_DEFAULTS),
);

/**
 * Presentation metadata only. The legacy settings dialog indents these
 * children but never coerces or disables them when a parent changes.
 */
export const USER_SETTING_HIERARCHY = Object.freeze({
  AUTO_RENAME: Object.freeze(["RENAME_PUBLISH_DATE"]),
  FORCE_RESOURCE_VIA_MEDIA: Object.freeze([
    "FALLBACK_TO_BLOB_FETCH_IF_MEDIA_API_THROTTLED",
    "NEW_TAB_ALWAYS_FORCE_MEDIA_IN_POST",
    "PREFER_DASH_MANIFEST",
  ]),
});

/**
 * @typedef {keyof typeof USER_SETTING_DEFAULTS} UserSettingName
 */

/**
 * @typedef {Object} SettingChange
 * @property {UserSettingName} name
 * @property {boolean} value
 * @property {boolean} previousValue
 * @property {"storage"|"user"} source
 */

/**
 * Preserve the userscript's boolean-only storage precedence without writing
 * defaults or attempting to migrate invalid legacy values.
 */
export class SettingsStore {
  /**
   * @param {{getValue: (key: string, defaultValue?: *) => *, setValue: (key: string, value: *) => *}} storage
   * @param {Object<string, boolean>} [defaults]
   */
  constructor(storage, defaults = USER_SETTING_DEFAULTS) {
    if (
      typeof storage?.getValue !== "function" ||
      typeof storage?.setValue !== "function"
    ) {
      throw new TypeError(
        "SettingsStore requires getValue() and setValue() storage methods.",
      );
    }

    this.storage = storage;
    this.defaults = Object.freeze({ ...defaults });
    this.keys = Object.freeze(Object.keys(this.defaults));
    this._values = { ...this.defaults };
    this._storedBooleans = new Set();
    this._listeners = new Set();
    this._loaded = false;

    for (const key of this.keys) {
      if (typeof this.defaults[key] !== "boolean") {
        throw new TypeError(`Setting default ${key} must be boolean.`);
      }
    }
  }

  /** @return {boolean} */
  get loaded() {
    return this._loaded;
  }

  /**
   * Rebuild the in-memory values from source defaults and stored booleans.
   * A missing, null, or non-boolean stored value deliberately has no effect.
   *
   * @return {Object<string, boolean>}
   */
  load() {
    this._values = { ...this.defaults };
    this._storedBooleans.clear();

    for (const key of this.keys) {
      const stored = this.storage.getValue(key);
      if (typeof stored === "boolean") {
        this._values[key] = stored;
        this._storedBooleans.add(key);
      }
    }

    this._loaded = true;
    return this.snapshot();
  }

  /**
   * @param {UserSettingName|string} name
   * @return {boolean}
   */
  get(name) {
    this._assertKnown(name);
    return this._values[name];
  }

  /**
   * Persist one checkbox value immediately and update the live store. Settings
   * dependencies remain visual-only; setting a parent never rewrites a child.
   *
   * @param {UserSettingName|string} name
   * @param {boolean} value
   * @return {*}
   */
  set(name, value) {
    this._assertKnown(name);
    if (typeof value !== "boolean") {
      throw new TypeError(`Setting ${name} must be boolean.`);
    }

    const previousValue = this._values[name];
    const result = this.storage.setValue(name, value);
    this._values[name] = value;
    this._emit({
      name,
      value,
      previousValue,
      source: "user",
    });
    return result;
  }

  /**
   * Whether startup found an actual stored boolean for this setting. This is
   * intentionally distinct from its effective value: the legacy startup only
   * resets the in-memory saved volume when `MODIFY_VIDEO_VOLUME=false` was
   * explicitly stored, not merely because its source default is false.
   *
   * @param {UserSettingName|string} name
   * @return {boolean}
   */
  wasLoadedFromStorage(name) {
    this._assertKnown(name);
    return this._storedBooleans.has(name);
  }

  /**
   * @return {Object<string, boolean>}
   */
  snapshot() {
    return { ...this._values };
  }

  /**
   * @param {(change: SettingChange) => void} listener
   * @return {() => void}
   */
  subscribe(listener) {
    if (typeof listener !== "function") {
      throw new TypeError("A settings listener must be a function.");
    }
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  }

  /**
   * @param {string} name
   * @return {void}
   * @private
   */
  _assertKnown(name) {
    if (!Object.prototype.hasOwnProperty.call(this.defaults, name)) {
      throw new RangeError(`Unknown setting: ${name}`);
    }
  }

  /**
   * @param {SettingChange} change
   * @return {void}
   * @private
   */
  _emit(change) {
    for (const listener of this._listeners) listener(change);
  }
}
