import { DisposableScope } from "../../core/disposable-scope.js";

const VIDEO_SETTING = Object.freeze({
  DISABLE_LOOPING: "DISABLE_VIDEO_LOOPING",
  HTML5_CONTROLS: "HTML5_VIDEO_CONTROL",
  MODIFY_VOLUME: "MODIFY_VIDEO_VOLUME",
});

/**
 * @typedef {import("./surface-adapters.js").VideoSurfaceAdapter} VideoSurfaceAdapter
 * @typedef {import("./surface-adapters.js").VideoControllerLayout} VideoControllerLayout
 */

/**
 * @typedef {Object} VideoVolumeState
 * @property {() => *} get
 * @property {(value: *) => *} set
 */

/**
 * Owns the common video behavior for one feature-controller surface. Instagram
 * DOM discovery stays in an injected adapter; this service owns the event
 * semantics, state transitions, and complete teardown.
 */
export class VideoBehaviorService {
  /**
   * @param {Object} dependencies
   * @param {import("../../core/environment.js").UserscriptEnvironment} dependencies.environment
   * @param {Object} dependencies.settings SettingsStore or the live USER_SETTING object.
   * @param {VideoVolumeState} dependencies.volume
   * @param {DisposableScope} [dependencies.scope]
   * @param {(element: Element) => void} [dependencies.triggerClick]
   * @param {(surface: string, message: string, details?: Object) => void} [dependencies.logger]
   */
  constructor({
    environment,
    settings,
    volume,
    scope,
    triggerClick,
    logger,
  }) {
    if (typeof environment?.getDocument !== "function") {
      throw new TypeError("VideoBehaviorService requires an environment.");
    }
    if (typeof volume?.get !== "function" || typeof volume?.set !== "function") {
      throw new TypeError("VideoBehaviorService requires mutable volume state.");
    }

    this.environment = environment;
    this.document = environment.getDocument();
    this.settings = settings || {};
    this.volume = volume;
    this.triggerClick =
      triggerClick ||
      ((element) => {
        element.click();
      });
    this.logger = logger || (() => {});
    this.scope = scope
      ? scope.child()
      : new DisposableScope(environment, {
          onError: (error) =>
            this.logger("video", "Cleanup failed", { error }),
        });

    this.root = null;
    this.adapter = null;
    this.disposed = false;
    this.videoRecords = [];
    this.videoScopes = new WeakMap();
    this.elementMutationSnapshots = new WeakMap();
    this.boundActivationTargets = new WeakSet();
    this.boundNavigationGuards = new WeakSet();
    this.controllerLayouts = new WeakMap();
    this.muteControls = new WeakMap();
    this.hiddenDisplayValues = new WeakMap();
  }

  /**
   * @param {Element} root
   * @param {VideoSurfaceAdapter} adapter
   * @return {VideoBehaviorService}
   */
  mount(root, adapter) {
    if (this.disposed) {
      throw new Error("A disposed VideoBehaviorService cannot be remounted.");
    }
    if (root?.nodeType !== 1) {
      throw new TypeError("VideoBehaviorService.mount() requires an element.");
    }
    validateAdapter(adapter);

    if (
      this.root &&
      (this.root !== root || this.adapter !== adapter)
    ) {
      throw new Error(
        "Create a new VideoBehaviorService for a different surface root.",
      );
    }

    this.root = root;
    this.adapter = adapter;
    this.refresh();
    return this;
  }

  /**
   * Attach behavior to new video nodes and release nodes no longer owned by the
   * mounted surface. Repeated refreshes never duplicate listeners.
   *
   * @param {*} [_change]
   * @return {number} Number of currently owned video nodes.
   */
  refresh(_change) {
    if (this.disposed || !this.root || !this.adapter) return 0;

    this.releaseDetachedVideos();
    const videos = this.adapter.findVideos(this.root);
    for (const video of videos) this.ensureVideo(video);

    if (this.isEnabled(VIDEO_SETTING.HTML5_CONTROLS)) {
      this.bindControllerActivations(videos);
      this.bindNavigationGuards(videos);
    }

    return this.videoRecords.length;
  }

  /**
   * @return {*[]}
   */
  dispose() {
    if (this.disposed) return [];
    this.disposed = true;
    const errors = this.scope.dispose();
    this.videoRecords.length = 0;
    this.root = null;
    this.adapter = null;
    return errors;
  }

  /**
   * @param {string} name
   * @return {boolean}
   * @private
   */
  isEnabled(name) {
    if (typeof this.settings.get === "function") {
      return this.settings.get(name) === true;
    }
    return this.settings[name] === true;
  }

  /** @private */
  releaseDetachedVideos() {
    this.videoRecords = this.videoRecords.filter((record) => {
      if (this.root.contains(record.video)) return true;
      record.scope.dispose();
      this.videoScopes.delete(record.video);
      return false;
    });
  }

  /**
   * @param {HTMLVideoElement} video
   * @private
   */
  ensureVideo(video) {
    if (this.videoScopes.has(video)) return;

    const videoScope = this.scope.child();
    const record = {
      initialVolumeApplied: false,
      loopStopped: false,
      scope: videoScope,
      video,
    };
    this.videoScopes.set(video, videoScope);
    this.videoRecords.push(record);

    if (this.adapter.supportsFullscreen) {
      videoScope.listen(video, "fullscreenchange", () => {
        if (!video.getAttribute("style")?.includes("object-fit")) return;
        this.setStyle(
          video,
          "objectFit",
          this.document.fullscreenElement === video ? "contain" : "cover",
          videoScope,
        );
      });
    }

    if (
      this.adapter.supportsLooping &&
      this.isEnabled(VIDEO_SETTING.DISABLE_LOOPING)
    ) {
      videoScope.listen(video, "ended", () => this.stopLooping(record));
    }

    if (
      this.adapter.setVolumeOnPlayback &&
      this.isEnabled(VIDEO_SETTING.MODIFY_VOLUME)
    ) {
      const applyInitialVolume = () => {
        if (record.initialVolumeApplied) return;
        record.initialVolumeApplied = true;
        this.setAttribute(video, "data-modify", "true", videoScope);
        video.volume = this.volume.get();
        this.logger(this.adapter.surface, "Applied saved playback volume");
      };
      videoScope.listen(video, "play", applyInitialVolume);
      videoScope.listen(video, "playing", applyInitialVolume);
      if (!video.paused) applyInitialVolume();
    }

    if (this.isEnabled(VIDEO_SETTING.HTML5_CONTROLS)) {
      this.initializeHtml5Controller(video, videoScope);
    }
  }

  /**
   * @param {{video: HTMLVideoElement, scope: DisposableScope, loopStopped: boolean}} record
   * @private
   */
  stopLooping(record) {
    if (record.loopStopped) return;
    record.loopStopped = true;
    const { video } = record;
    this.setAttribute(video, "data-loop", "true", record.scope);

    const action = this.adapter.findLoopAction(this.root, video);
    if (action.button) {
      action.button.click();
      this.logger(this.adapter.surface, "Stopped looping through native UI");
      return;
    }

    for (const element of action.reveal) {
      this.removeAttribute(element, "style", record.scope);
    }
    video.pause();
    this.logger(this.adapter.surface, "Stopped looping through pause()");
  }

  /**
   * @param {HTMLVideoElement} video
   * @param {DisposableScope} videoScope
   * @private
   */
  initializeHtml5Controller(video, videoScope) {
    if (this.isEnabled(VIDEO_SETTING.MODIFY_VOLUME)) {
      video.volume = this.volume.get();
      videoScope.listen(video, "loadstart", () => {
        video.volume = this.volume.get();
      });
    }

    this.muteControls.set(
      video,
      this.adapter.findMuteControls(this.root, video),
    );
    videoScope.listen(video, "contextmenu", (event) => {
      this.hideHtml5Controller(video, event);
    });
    videoScope.listen(video, "volumechange", () => {
      this.synchronizeMuteAndVolume(video);
    });

    this.setStyle(
      video,
      "position",
      this.adapter.controllerPosition,
      videoScope,
    );
    this.setAttribute(video, "data-controls", "true", videoScope);
    this.logger(this.adapter.surface, "Installed HTML5 video controller hooks");
  }

  /**
   * @param {HTMLVideoElement[]} videos
   * @private
   */
  bindControllerActivations(videos) {
    const activations = this.adapter.findControllerActivations(
      this.root,
      videos,
    );

    for (const activation of activations) {
      if (this.boundActivationTargets.has(activation.target)) continue;
      const activationScope =
        this.videoScopes.get(activation.video) || this.scope;
      this.boundActivationTargets.add(activation.target);
      activationScope.defer(() => {
        this.boundActivationTargets.delete(activation.target);
      });
      activationScope.listen(activation.target, "contextmenu", (event) => {
        this.showHtml5Controller(activation.video, event);
      });
    }
  }

  /**
   * @param {HTMLVideoElement[]} videos
   * @private
   */
  bindNavigationGuards(videos) {
    for (const video of videos) {
      const guard = this.adapter.findNavigationGuard(this.root, video);
      if (!guard || this.boundNavigationGuards.has(guard)) continue;
      const guardScope = this.videoScopes.get(video) || this.scope;
      this.boundNavigationGuards.add(guard);
      guardScope.defer(() => {
        this.boundNavigationGuards.delete(guard);
      });
      guardScope.listen(guard, "click", (event) => {
        const guardedVideoHasControls = this.adapter
          .findVideos(this.root)
          .some(
            (candidate) =>
              guard.contains(candidate) && candidate.hasAttribute("controls"),
          );
        if (!guardedVideoHasControls) return;
        event.preventDefault();
        event.stopPropagation();
      });
    }
  }

  /**
   * @param {HTMLVideoElement} requestedVideo
   * @param {Event} event
   * @private
   */
  showHtml5Controller(requestedVideo, event) {
    event.preventDefault();
    event.stopPropagation();

    const videos = this.adapter.findVideos(this.root);
    const selectedVideo = videos.includes(requestedVideo)
      ? requestedVideo
      : videos[0];
    if (!selectedVideo) return;

    const layout = this.adapter.locateControllerLayout(
      this.root,
      selectedVideo,
      event,
    );
    const controllerVideos = this.adapter.findControllerVideos(
      this.root,
      selectedVideo,
      videos,
    );

    for (const video of controllerVideos) {
      const videoScope = this.videoScopes.get(video) || this.scope;
      this.setStyle(video, "zIndex", "2", videoScope);
      this.setAttribute(video, "controls", "", videoScope);
      this.controllerLayouts.set(video, layout);
    }
    const layoutScope =
      this.videoScopes.get(selectedVideo) || this.scope;
    this.setLayerZIndex(
      [layout.overlay, ...layout.layers],
      "-10",
      layoutScope,
    );
    for (const element of layout.hidden) {
      if (!this.hiddenDisplayValues.has(element)) {
        this.hiddenDisplayValues.set(element, element.style.display);
      }
      this.setStyle(element, "display", "none", layoutScope);
    }
    for (const link of layout.draggableLinks) {
      this.setAttribute(link, "draggable", "false", layoutScope);
    }

    this.adapter.onControllerVisibilityChange?.({
      visible: true,
      root: this.root,
      selectedVideo,
      videos: controllerVideos,
      layout,
      surface: this.adapter.surface,
    });
  }

  /**
   * @param {HTMLVideoElement} video
   * @param {Event} event
   * @private
   */
  hideHtml5Controller(video, event) {
    event.preventDefault();
    event.stopPropagation();

    const layout =
      this.controllerLayouts.get(video) ||
      this.adapter.locateControllerLayout(this.root, video, event);
    const videoScope = this.videoScopes.get(video) || this.scope;

    this.setStyle(video, "zIndex", "-1", videoScope);
    this.removeAttribute(video, "controls", videoScope);
    this.setLayerZIndex(
      [layout.overlay, ...layout.layers],
      "1",
      videoScope,
    );
    for (const element of layout.hidden) {
      this.setStyle(
        element,
        "display",
        this.hiddenDisplayValues.get(element) || "",
        videoScope,
      );
      this.hiddenDisplayValues.delete(element);
    }
    if (layout.restoreDraggableOnHide) {
      for (const link of layout.draggableLinks) {
        this.removeAttribute(link, "draggable", videoScope);
      }
    }

    this.adapter.onControllerVisibilityChange?.({
      visible: false,
      root: this.root,
      selectedVideo: video,
      videos: [video],
      layout,
      surface: this.adapter.surface,
    });
  }

  /**
   * @param {HTMLVideoElement} video
   * @private
   */
  synchronizeMuteAndVolume(video) {
    const controls =
      this.muteControls.get(video) ||
      this.adapter.findMuteControls(this.root, video);
    const interfaceMuted =
      controls.length > 0
        ? this.adapter.isMuteControlMuted(controls[0])
        : video.muted;

    if (video.muted !== interfaceMuted) {
      video.volume = this.volume.get();
      const overlay = this.controllerLayouts.get(video)?.overlay;
      const control =
        controls.length === 1
          ? controls[0]
          : controls.find((candidate) => overlay?.contains(candidate)) ||
            controls[0];
      if (control) this.triggerClick(control);
    }

    if (video.hasAttribute("data-completed")) {
      this.volume.set(video.volume);
    }

    // Deliberately retain the legacy loose comparison: range-input values may
    // be strings while HTMLMediaElement.volume is numeric.
    if (video.volume == this.volume.get()) {
      this.setAttribute(
        video,
        "data-completed",
        "true",
        this.videoScopes.get(video) || this.scope,
      );
    }
  }

  /**
   * @param {Element} element
   * @param {string} property
   * @param {string} value
   * @param {DisposableScope} scope
   * @private
   */
  setStyle(element, property, value, scope) {
    if (!this.rememberMutation(element, `style:${property}`, scope, () => {
      const originalValue = element.style[property];
      return () => {
        element.style[property] = originalValue;
      };
    })) {
      return;
    }
    element.style[property] = value;
  }

  /**
   * @param {Element} element
   * @param {string} name
   * @param {string} value
   * @param {DisposableScope} scope
   * @private
   */
  setAttribute(element, name, value, scope) {
    if (!this.rememberAttribute(element, name, scope)) return;
    element.setAttribute(name, value);
  }

  /**
   * @param {Element} element
   * @param {string} name
   * @param {DisposableScope} scope
   * @private
   */
  removeAttribute(element, name, scope) {
    if (!this.rememberAttribute(element, name, scope)) return;
    element.removeAttribute(name);
  }

  /**
   * @param {Element} element
   * @param {string} name
   * @param {DisposableScope} scope
   * @return {boolean}
   * @private
   */
  rememberAttribute(element, name, scope) {
    return this.rememberMutation(
      element,
      `attribute:${name}`,
      scope,
      () => {
        const originalValue = element.getAttribute(name);
        return () => {
          if (originalValue == null) element.removeAttribute(name);
          else element.setAttribute(name, originalValue);
        };
      },
    );
  }

  /**
   * @param {Array<Element|null|undefined>} elements
   * @param {string} zIndex
   * @param {DisposableScope} scope
   * @private
   */
  setLayerZIndex(elements, zIndex, scope) {
    const seen = new Set();
    for (const element of elements) {
      if (!element || seen.has(element)) continue;
      seen.add(element);
      this.setStyle(element, "zIndex", zIndex, scope);
    }
  }

  /**
   * Snapshot one service-owned DOM mutation and register its restoration with
   * the scope that owns the affected video. Repeated writes share the original
   * value, while an early child-scope disposal permits a recycled element to
   * be tracked again.
   *
   * @param {Element} element
   * @param {string} key
   * @param {DisposableScope} scope
   * @param {() => () => void} createRestore
   * @return {boolean}
   * @private
   */
  rememberMutation(element, key, scope, createRestore) {
    if (scope.disposed) return false;

    let mutations = this.elementMutationSnapshots.get(element);
    if (!mutations) {
      mutations = new Set();
      this.elementMutationSnapshots.set(element, mutations);
    }
    if (mutations.has(key)) return true;

    mutations.add(key);
    const restore = createRestore();
    scope.defer(() => {
      restore();
      mutations.delete(key);
    });
    return true;
  }
}

/**
 * @param {VideoSurfaceAdapter} adapter
 */
function validateAdapter(adapter) {
  const methods = [
    "findVideos",
    "findControllerActivations",
    "findControllerVideos",
    "locateControllerLayout",
    "findMuteControls",
    "isMuteControlMuted",
    "findLoopAction",
    "findNavigationGuard",
  ];
  if (!adapter || methods.some((name) => typeof adapter[name] !== "function")) {
    throw new TypeError("The video surface adapter is incomplete.");
  }
}
