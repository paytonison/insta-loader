import { DisposableScope } from "../../core/disposable-scope.js";

/**
 * @typedef {Object} VideoVolumeSliderMount
 * @property {Element|null|undefined} host Existing Instagram element that receives the slider.
 * @property {() => (Iterable<HTMLVideoElement>|ArrayLike<HTMLVideoElement>|Object|null|undefined)} resolveVideos Live surface-specific video locator.
 * @property {string} loggerType Legacy logger label (`post`, `reel`, `story`, or `highlight`).
 * @property {string} [customClass] Existing orientation/placement class (`bottom` or `vertical`).
 */

/**
 * Route-owned implementation of the legacy `toggleVolumeSilder()` behavior.
 * Instagram DOM discovery remains injected so every surface can retain its
 * selector and placement order while handlers always resolve current videos.
 */
export class VideoVolumeSliderController {
  /**
   * @param {Object} dependencies
   * @param {import("../../core/environment.js").UserscriptEnvironment} dependencies.environment
   * @param {{get: () => *, set: (value: *) => *}} dependencies.volume
   * @param {DisposableScope} [dependencies.scope]
   * @param {(...messages: *) => void} [dependencies.logger]
   */
  constructor({ environment, volume, scope, logger }) {
    if (typeof environment?.getDocument !== "function") {
      throw new TypeError("VideoVolumeSliderController requires an environment.");
    }
    if (typeof volume?.get !== "function" || typeof volume?.set !== "function") {
      throw new TypeError(
        "VideoVolumeSliderController requires mutable volume state.",
      );
    }

    this.document = environment.getDocument();
    this.volume = volume;
    this.logger = logger || (() => {});
    this.scope = scope ? scope.child() : new DisposableScope(environment);
    this.sliderRecords = new WeakMap();
  }

  /** @return {boolean} */
  get disposed() {
    return this.scope.disposed;
  }

  /**
   * Preserve the legacy toggle contract: an existing descendant slider is
   * removed; otherwise one slider is appended to the supplied host.
   *
   * @param {VideoVolumeSliderMount} mount
   * @return {HTMLDivElement|null}
   */
  toggle({ host, resolveVideos, loggerType, customClass = "" }) {
    if (this.disposed) {
      throw new Error("A disposed VideoVolumeSliderController cannot be reused.");
    }
    if (!host || host.nodeType !== 1) return null;
    if (typeof resolveVideos !== "function") {
      throw new TypeError("A live video locator is required for the slider.");
    }

    const existing = host.querySelectorAll("div.volume_slider");
    if (existing.length > 0) {
      for (const slider of existing) {
        const record = this.sliderRecords.get(slider);
        if (record) record.dispose();
        else slider.remove();
      }
      return null;
    }

    const sliderScope = this.scope.child();
    const slider = this.document.createElement("div");
    slider.className = customClass
      ? `volume_slider ${customClass}`
      : "volume_slider";

    const wrapper = this.document.createElement("div");
    const input = this.document.createElement("input");
    input.type = "range";
    input.max = "1";
    input.min = "0";
    input.step = "0.05";
    const initialVolume = this.volume.get();
    input.setAttribute("value", initialVolume);
    input.value = initialVolume;
    setTrackProgress(input, initialVolume);
    wrapper.append(input);
    slider.append(wrapper);
    host.append(slider);

    const record = {
      dispose: () => sliderScope.dispose(),
    };
    this.sliderRecords.set(slider, record);
    sliderScope.defer(() => {
      this.sliderRecords.delete(slider);
      slider.remove();
    });

    const applyVolumeToCurrentVideos = () => {
      for (const video of normalizeVideos(resolveVideos())) {
        this.logger(`(${loggerType})`, "video volume changed #slider");
        video.volume = this.volume.get();
      }
    };

    sliderScope.listen(input, "input", () => {
      this.volume.set(input.value);
      setTrackProgress(input, input.value);
      applyVolumeToCurrentVideos();
    });

    sliderScope.listen(input, "mouseenter", () => {
      input.value = this.volume.get();
      setTrackProgress(input, this.volume.get());
      applyVolumeToCurrentVideos();
    });

    sliderScope.listen(slider, "click", (event) => {
      event.stopPropagation();
      event.preventDefault();
    });

    return slider;
  }

  /** @return {*[]} */
  dispose() {
    return this.scope.dispose();
  }
}

/**
 * @param {HTMLInputElement} input
 * @param {*} value
 */
function setTrackProgress(input, value) {
  input.setAttribute(
    "style",
    `--ig-track-progress: ${value * 100 + "%"}`,
  );
}

/**
 * Accept arrays, NodeLists, jQuery collections, and other iterable/array-like
 * locator results without making the controller itself depend on jQuery.
 *
 * @param {*} value
 * @return {HTMLVideoElement[]}
 */
function normalizeVideos(value) {
  if (value == null) return [];

  let candidates;
  if (typeof value.get === "function") candidates = value.get();
  else if (typeof value[Symbol.iterator] === "function") {
    candidates = Array.from(value);
  } else if (typeof value.length === "number") {
    candidates = Array.from(value);
  } else {
    candidates = [];
  }

  return candidates.filter(
    (candidate) =>
      candidate?.nodeType === 1 &&
      candidate.tagName === "VIDEO" &&
      "volume" in candidate,
  );
}
