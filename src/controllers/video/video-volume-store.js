export const VIDEO_VOLUME_STORAGE_KEY = "G_VIDEO_VOLUME";
export const DEFAULT_VIDEO_VOLUME = 1;

/**
 * Read the saved volume with the same truthiness rule as the legacy runtime.
 * A stored numeric zero is intentionally treated as missing and becomes the
 * default after a reload. Changing that rule is a separate behavior change.
 *
 * @param {{getValue: (key: string) => *}} storage
 * @param {string} [key]
 * @param {*} [defaultValue]
 * @return {*}
 */
export function readLegacyVideoVolume(
  storage,
  key = VIDEO_VOLUME_STORAGE_KEY,
  defaultValue = DEFAULT_VIDEO_VOLUME,
) {
  if (typeof storage?.getValue !== "function") {
    throw new TypeError("Video volume storage must expose getValue().");
  }

  const storedValue = storage.getValue(key);
  return storedValue ? storedValue : defaultValue;
}

/**
 * Mutable application-lifetime volume state backed by userscript storage.
 * Values are deliberately not coerced because the existing range input writes
 * string values while browser volumechange events write numbers.
 */
export class VideoVolumeStore {
  /**
   * @param {{getValue: (key: string) => *, setValue: (key: string, value: *) => *}} storage
   * @param {{key?: string, defaultValue?: *}} [options]
   */
  constructor(storage, options = {}) {
    if (typeof storage?.setValue !== "function") {
      throw new TypeError("Video volume storage must expose setValue().");
    }

    this.storage = storage;
    this.key = options.key || VIDEO_VOLUME_STORAGE_KEY;
    this.defaultValue = options.defaultValue ?? DEFAULT_VIDEO_VOLUME;
    this.value = readLegacyVideoVolume(
      storage,
      this.key,
      this.defaultValue,
    );
  }

  /** @return {*} */
  get() {
    return this.value;
  }

  /**
   * @param {*} value
   * @return {*}
   */
  set(value) {
    this.value = value;
    this.storage.setValue(this.key, value);
    return value;
  }
}
