import { DisposableScope } from "../core/disposable-scope.js";
import {
  getMaximumReelPlaybackRouteShortcode as getStandaloneReelShortcode,
  isMaximumReelFeedRoute as isNativeReelsFeedRoute,
  parseMaximumReelShortcode as parseReelShortcode,
} from "../core/routes.js";

/**
 * @typedef {Object} MaximumReelPlaybackOptions
 * @property {Object} environment Userscript environment adapter.
 * @property {() => boolean} isEnabled Current maximum-quality setting.
 * @property {(shortcode: string, options: {timeout: number}) => (Promise<*>|{promise: Promise<*>, abort?: () => void, handle?: *})} requestMetadata
 * @property {(data: *) => Array<Object>} normalizeCandidates
 * @property {() => Location|URL|{href: string, origin: string, hostname?: string}} [getLocation]
 * @property {Object} [videoOperations]
 * @property {(...messages: *) => void} [logger]
 * @property {number} [holdTimeout]
 * @property {number} [failureRetryDelay]
 * @property {number} [rateLimitCooldown]
 * @property {number} [cacheMaxAge]
 */

/**
 * Owns the complete standalone-Reel maximum-quality playback lifecycle.
 *
 * The route gate is intentionally singular: every plural `/reels/` route is
 * Instagram-native and is rejected before metadata traffic or player mutation.
 */
export class MaximumReelPlaybackController {
  /**
   * @param {MaximumReelPlaybackOptions} options
   */
  constructor(options) {
    if (!options?.environment) {
      throw new TypeError("MaximumReelPlaybackController requires an environment.");
    }
    if (typeof options.isEnabled !== "function") {
      throw new TypeError("MaximumReelPlaybackController requires isEnabled().");
    }
    if (typeof options.requestMetadata !== "function") {
      throw new TypeError(
        "MaximumReelPlaybackController requires requestMetadata().",
      );
    }
    if (typeof options.normalizeCandidates !== "function") {
      throw new TypeError(
        "MaximumReelPlaybackController requires normalizeCandidates().",
      );
    }

    const getLocation = options.getLocation || options.environment.getLocation;
    this.options = options;
    this.environment = options.environment;
    this.state = createMaximumReelPlaybackState(getLocation().href);
    this._scope = null;
    this._engine = null;
    this._mounted = false;
    this._disposed = false;
  }

  /** @return {boolean} */
  get mounted() {
    return this._mounted;
  }

  /** @return {boolean} */
  get disposed() {
    return this._disposed;
  }

  /**
   * @param {*} [_routeContext]
   * @return {void}
   */
  mount(_routeContext) {
    if (this._disposed || this._mounted) return;

    this._scope = new DisposableScope(this.environment, {
      onError: (error) =>
        this.options.logger?.(
          "[Reel Quality] Playback cleanup failed",
          error?.name || "cleanup_failure",
        ),
    });
    this._engine = createMaximumReelPlaybackEngine(
      this,
      this._scope,
      this.options,
    );
    this._mounted = true;
    this._engine.init();
  }

  /**
   * @param {{settingChanged?: boolean}|*} [change]
   * @return {boolean}
   */
  refresh(change) {
    if (!this._mounted || this._disposed) return false;
    const routeChanged = this._engine.syncRoute();
    if (!this.options.isEnabled()) {
      this._engine.cancel("setting-disabled", true);
      return true;
    }

    if (change?.settingChanged) this._engine.scan();
    return routeChanged;
  }

  /**
   * Idempotently release all active or ready standalone player ownership.
   *
   * @param {string} [reason]
   * @return {Object|null} Opaque delayed-seek handoff for Manual Reload.
   */
  relinquish(reason = "controller-relinquished") {
    return this._engine?.relinquish(reason) || null;
  }

  /**
   * Transfer a Manual Reload native-seek handoff into this fresh controller.
   *
   * @param {Object|null} handoff
   * @return {boolean}
   */
  adoptManualReloadHandoff(handoff) {
    if (!this._mounted || this._disposed) return false;
    return this._engine?.adoptManualReloadHandoff(handoff) || false;
  }

  /**
   * Idempotently cancel requests, waits, overlays, observers, listeners, and
   * schedulers owned by this controller.
   *
   * @return {void}
   */
  dispose() {
    if (this._disposed) return;
    this._disposed = true;
    this._engine?.relinquish("controller-disposed");
    this._engine?.dispose();
    this._scope?.dispose();
    this._engine = null;
    this._scope = null;
    this._mounted = false;
  }
}

/**
 * @param {string} routeHref
 * @return {Object}
 */
function createMaximumReelPlaybackState(routeHref) {
  return {
    activeRequest: null,
    activeOperation: null,
    candidateCache: new Map(),
    cooldownUntil: 0,
    failedAt: new Map(),
    generation: 0,
    hostOwners: new WeakMap(),
    intersectionObserver: null,
    mutationObserver: null,
    observedVideos: new WeakSet(),
    pendingNativeResume: null,
    rebindHistory: new Map(),
    reloadHandoffs: new WeakMap(),
    routeHref,
    scanQueued: false,
    videoState: new WeakMap(),
  };
}

/**
 * @param {MaximumReelPlaybackController} controller
 * @param {DisposableScope} scope
 * @param {MaximumReelPlaybackOptions} options
 * @return {Object}
 */
function createMaximumReelPlaybackEngine(controller, scope, options) {
  const environment = options.environment;
  const window = environment.window;
  const document = environment.getDocument();
  const getLocation = options.getLocation || environment.getLocation;
  const now = environment.now;
  const queueMicrotask = (callback) =>
    environment.queueMicrotask(() => {
      if (!controller.disposed) callback();
    });
  const requestAnimationFrame = (callback) =>
    scope.requestAnimationFrame(callback);
  const cancelAnimationFrame = environment.cancelAnimationFrame;
  const setTimeout = (callback, delay, ...args) =>
    scope.setTimeout(callback, delay, ...args);
  const clearTimeout = environment.clearTimeout;
  const Node = window.Node;
  const HTMLVideoElement = window.HTMLVideoElement;
  const HTMLMediaElement = window.HTMLMediaElement;
  const MutationObserver = window.MutationObserver;
  const IntersectionObserver = window.IntersectionObserver;
  const getComputedStyle = window.getComputedStyle.bind(window);
  const logger = options.logger || (() => {});
  const isEnabled = options.isEnabled;
  const normalizeCandidates = options.normalizeCandidates;
  const reelQuality = controller.state;
  const REEL_QUALITY_HOLD_TIMEOUT = options.holdTimeout ?? 5000;
  const REEL_QUALITY_FAILURE_RETRY_DELAY =
    options.failureRetryDelay ?? 60 * 1000;
  const REEL_QUALITY_RATE_LIMIT_COOLDOWN =
    options.rateLimitCooldown ?? 5 * 60 * 1000;
  const REEL_QUALITY_CACHE_MAX_AGE = options.cacheMaxAge ?? 30 * 60 * 1000;
  const videoOperations = createVideoOperations(options.videoOperations);

  function getBlobMediaWithQueryID(shortcode, requestOptions = {}) {
    const value = options.requestMetadata(shortcode, {
      timeout: requestOptions.timeout,
    });
    const record =
      value && typeof value === "object" && "promise" in value
        ? value
        : { promise: Promise.resolve(value) };
    const abortable = {
      abort: () => record.abort?.(),
      handle: record.handle,
    };
    requestOptions.onRequest?.(abortable);
    return Promise.resolve(record.promise);
  }

/**
 * initMaximumReelPlayback
 * @description Intercept playback of only the active Reel and replace its
 * adaptive source with Instagram's best complete progressive representation.
 * The original source is left untouched until metadata has been resolved.
 *
 * @return {void}
 */
function initMaximumReelPlayback() {
  scope.listen(document, "play", handleMaximumReelPlay, true);
  scope.listen(window, "popstate", function () {
    queueMicrotask(syncMaximumReelPlaybackRoute);
  });
  scope.listen(document, "visibilitychange", function () {
    if (document.visibilityState === "hidden") {
      const operation = reelQuality.activeOperation;
      if (operation?.wantsPlayback) {
        operation.nativeResumeOnce = true;
        reelQuality.pendingNativeResume = operation;
      }
      cancelMaximumReelPlayback("document-hidden", false);
    } else {
      if (!resumeMaximumReelAfterVisibility()) scanForPlayingReels();
    }
  });

  if (typeof IntersectionObserver === "function") {
    reelQuality.intersectionObserver = new IntersectionObserver(
      function (entries) {
        if (isMaximumReelFeedRoute(getLocation().href)) {
          entries.forEach(function (entry) {
            if (!entry.isIntersecting || entry.intersectionRatio < 0.5) return;

            const previous = reelQuality.videoState.get(entry.target);
            if (
              previous &&
              (previous.phase === "ready" ||
                previous.candidateBound ||
                reelQuality.activeOperation === previous)
            ) {
              relinquishMaximumReelPlayback(
                previous,
                "managed-player-entered-feed",
              );
            }
          });
        }

        const operation = reelQuality.activeOperation;
        if (!operation || operation.finished) return;

        const activeEntry = entries.find(
          (entry) => entry.target === operation.video,
        );
        if (
          activeEntry &&
          (!activeEntry.isIntersecting || activeEntry.intersectionRatio < 0.5)
        ) {
          requestAnimationFrame(function () {
            if (
              reelQuality.activeOperation === operation &&
              (!isActiveReelVideo(operation.video) ||
                getReelShortcodeForVideo(operation.video) !==
                  operation.shortcode)
            ) {
              cancelMaximumReelPlayback("reel-left-viewport", false);
            }
          });
        }
      },
      { threshold: [0, 0.5, 0.75, 1] },
    );
  }

  reelQuality.mutationObserver = new MutationObserver(function (mutations) {
    syncMaximumReelPlaybackRoute();

    let removedOperation = null;
    for (const mutation of mutations) {
      mutation.addedNodes.forEach(function (node) {
        observeMaximumReelVideos(node);
      });

      const operation = reelQuality.activeOperation;
      if (!operation || operation.finished) continue;

      mutation.removedNodes.forEach(function (node) {
        if (
          node === operation.video ||
          (node.nodeType === Node.ELEMENT_NODE &&
            node.contains(operation.video))
        ) {
          removedOperation = operation;
        }
      });
    }

    reelQuality.activeOperation?.hold?.sync?.();
    if (removedOperation) {
      queueMicrotask(function () {
        if (
          reelQuality.activeOperation === removedOperation &&
          !removedOperation.video.isConnected
        ) {
          cancelMaximumReelPlayback("reel-video-removed", false);
        }
      });
    }
  });
  reelQuality.mutationObserver.observe(document, {
    childList: true,
    subtree: true,
  });

  observeMaximumReelVideos(document);
  requestAnimationFrame(scanForPlayingReels);
  setTimeout(scanForPlayingReels, 500);
}

/**
 * syncMaximumReelPlaybackRoute
 * @description Relinquish any player owned by a standalone Reel operation
 * before Instagram can recycle it into the scrolling Reels feed.
 *
 * @return {Boolean}
 */
function syncMaximumReelPlaybackRoute() {
  if (reelQuality.routeHref === getLocation().href) return false;

  reelQuality.routeHref = getLocation().href;
  const operation = reelQuality.activeOperation;
  if (
    operation &&
    !isMaximumReelPlaybackRouteEligible(
      operation.video,
      operation.shortcode,
    )
  ) {
    relinquishMaximumReelPlayback(operation, "playback-route-changed");
  }

  document.querySelectorAll("video").forEach(function (video) {
    const previous = reelQuality.videoState.get(video);
    if (
      previous &&
      (previous.phase === "ready" ||
        previous.phase === "fallback" ||
        previous.pendingRestoreTimeCancel ||
        previous.manualReloadRestored) &&
      !isMaximumReelPlaybackRouteEligible(video, previous.shortcode)
    ) {
      relinquishMaximumReelPlayback(previous, "ready-player-route-changed");
    }

    const reloadHandoff = reelQuality.reloadHandoffs.get(video);
    if (
      reloadHandoff?.status === "pending" &&
      !isMaximumReelPlaybackRouteEligible(video, reloadHandoff.shortcode)
    ) {
      reloadHandoff.cancel("reload-handoff-route-changed");
      reelQuality.reloadHandoffs.delete(video);
    }
  });

  if (getMaximumReelPlaybackRouteShortcode(getLocation().href)) {
    requestAnimationFrame(scanForPlayingReels);
  }
  return true;
}

/**
 * observeMaximumReelVideos
 * @description Track video nodes without starting metadata prefetches.
 *
 * @param {Node} root
 * @return {Boolean}
 */
function observeMaximumReelVideos(root) {
  if (!root || !root.querySelectorAll) return;

  const videos = [];
  if (root.nodeType === Node.ELEMENT_NODE && root.matches("video")) {
    videos.push(root);
  }
  root.querySelectorAll("video").forEach((video) => videos.push(video));

  videos.forEach(function (video) {
    if (reelQuality.observedVideos.has(video)) return;

    reelQuality.observedVideos.add(video);
    reelQuality.intersectionObserver?.observe(video);

    if (!video.paused && !video.ended) {
      queueMaximumReelScan();
    }
  });
}

/** @return {void} */
function queueMaximumReelScan() {
  if (reelQuality.scanQueued) return;

  reelQuality.scanQueued = true;
  queueMicrotask(function () {
    reelQuality.scanQueued = false;
    scanForPlayingReels();
  });
}

/**
 * scanForPlayingReels
 * @description Catch a Reel that started before this document-start script
 * finished loading its external dependencies.
 *
 * @return {void}
 */
function scanForPlayingReels() {
  const candidates = [];
  document.querySelectorAll("video").forEach(function (video) {
    observeMaximumReelVideos(video);
    const shortcode = getReelShortcodeForVideo(video);
    if (
      !video.paused &&
      !video.ended &&
      isActiveReelVideo(video) &&
      shortcode &&
      isMaximumReelPlaybackRouteEligible(video, shortcode)
    ) {
      candidates.push(video);
    }
  });

  candidates.sort(function (a, b) {
    return maximumReelActivityScore(b) - maximumReelActivityScore(a);
  });
  if (candidates[0]) handleMaximumReelPlay({ target: candidates[0] });
}

/**
 * resumeMaximumReelAfterVisibility
 * @description Resume the native source once after a tab-background
 * cancellation without immediately intercepting that recovery play event.
 *
 * @return {void}
 */
function resumeMaximumReelAfterVisibility() {
  const operation = reelQuality.pendingNativeResume;
  reelQuality.pendingNativeResume = null;
  if (!operation) return false;

  if (
    operation.video.isConnected &&
    getReelShortcodeForVideo(operation.video) === operation.shortcode &&
    isActiveReelVideo(operation.video)
  ) {
    Promise.resolve(videoOperations.play(operation.video))
      .then(function () {
        operation.nativeResumeOnce = false;
      })
      .catch(function (err) {
        operation.nativeResumeOnce = false;
        logger(
          "[Reel Quality] Native playback resume after background was blocked",
          err?.name || "play_rejected",
        );
      });
    return true;
  } else {
    operation.nativeResumeOnce = false;
  }
  return false;
}

/**
 * handleMaximumReelPlay
 * @description Capture a native play request before beginning the bounded HQ
 * handoff. Repeated play events only preserve the user's playback intent.
 *
 * @param {Event|Object} event
 * @return {void}
 */
function handleMaximumReelPlay(event) {
  const video = event?.target;
  if (
    !isEnabled() ||
    !(video instanceof HTMLVideoElement)
  ) {
    return;
  }

  const previous = reelQuality.videoState.get(video);
  const shortcode = getReelShortcodeForVideo(video);
  if (!shortcode || !isActiveReelVideo(video)) return;
  if (!isMaximumReelPlaybackRouteEligible(video, shortcode)) {
    if (
      previous &&
      (previous.phase === "ready" ||
        previous.candidateBound ||
        reelQuality.activeOperation === previous)
    ) {
      relinquishMaximumReelPlayback(previous, "managed-player-entered-feed");
    }
    return;
  }

  const currentTime = now();

  if (
    previous?.nativeResumeOnce &&
    previous.shortcode === shortcode
  ) {
    previous.nativeResumeOnce = false;
    return;
  }

  const reloadHandoff = reelQuality.reloadHandoffs.get(video);
  if (
    reloadHandoff?.status === "pending" &&
    reloadHandoff.shortcode === shortcode
  ) {
    return;
  }

  if (
    previous?.phase === "ready" &&
    previous.shortcode === shortcode &&
    maximumReelSourceMatches(video, previous.selectedUrl)
  ) {
    return;
  }

  if (previous?.phase === "resolving" || previous?.phase === "loading") {
    if (
      previous.shortcode === shortcode &&
      reelQuality.activeOperation === previous
    ) {
      previous.wantsPlayback = true;
      try {
        videoOperations.pause(video);
      } catch (_err) {
        // The element may have detached between the event and this handler.
      }
      return;
    }

    if (reelQuality.activeOperation === previous) {
      abandonMaximumReelPlayback(previous, "video-reused-for-new-reel");
    }
  }

  if (
    previous?.phase === "fallback" &&
    previous.shortcode === shortcode &&
    currentTime < previous.retryAt
  ) {
    return;
  }

  if (currentTime < reelQuality.cooldownUntil) {
    logger(
      "[Reel Quality] Native playback; metadata cooldown active",
      Math.ceil((reelQuality.cooldownUntil - currentTime) / 1000),
      "seconds remaining",
    );
    return;
  }

  const failedAt = reelQuality.failedAt.get(shortcode) || 0;
  if (currentTime - failedAt < REEL_QUALITY_FAILURE_RETRY_DELAY) return;

  if (!registerMaximumReelBinding(shortcode)) {
    reelQuality.failedAt.set(shortcode, currentTime);
    logger(
      "[Reel Quality] Native playback; source rebind limit reached",
      shortcode,
    );
    return;
  }

  startMaximumReelPlayback(video, shortcode);
}

/**
 * startMaximumReelPlayback
 * @description Pause and hold the active Reel while its progressive source is
 * resolved. No metadata request is started for an inactive or next Reel.
 *
 * @param {HTMLVideoElement} video
 * @param {String} shortcode
 * @return {void}
 */
function startMaximumReelPlayback(video, shortcode) {
  cancelMaximumReelRestoreTime(reelQuality.videoState.get(video));

  const activeOperation = reelQuality.activeOperation;
  if (activeOperation && activeOperation.video !== video) {
    if (activeOperation.shortcode === shortcode) {
      abandonMaximumReelPlayback(
        activeOperation,
        "same-reel-video-replaced",
        { keepRequest: true },
      );
    } else {
      cancelMaximumReelPlayback("active-reel-changed", false);
    }
  }

  const operation = {
    deadline: now() + REEL_QUALITY_HOLD_TIMEOUT,
    candidateBound: false,
    destructive: false,
    finished: false,
    generation: ++reelQuality.generation,
    hold: null,
    manualReloadRestored: false,
    pendingRestoreTimeCancel: null,
    pendingWaitCancel: null,
    phase: "resolving",
    selectedUrl: null,
    shortcode,
    snapshot: snapshotMaximumReelVideo(video),
    startedAt: now(),
    video,
    wantsPlayback: true,
  };

  reelQuality.activeOperation = operation;
  reelQuality.videoState.set(video, operation);

  try {
    videoOperations.pause(video);
  } catch (_err) {
    // The validity check in the async runner will fail open if it detached.
  }
  operation.hold = createMaximumReelHold(operation);
  operation.hardTimeout = setTimeout(function () {
    failMaximumReelPlayback(operation, "hold_timeout", {
      markFailure: true,
      resumeNative: true,
    });
  }, maximumReelTimeRemaining(operation));

  logger("[Reel Quality] Resolving progressive sources", shortcode);
  void runMaximumReelPlayback(operation);
}

/**
 * runMaximumReelPlayback
 * @description Resolve, rank, and try progressive candidates within one shared
 * five-second deadline.
 *
 * @param {Object} operation
 * @return {Promise<void>}
 */
async function runMaximumReelPlayback(operation) {
  try {
    assertMaximumReelOperation(operation);
    let resolution = await resolveMaximumReelCandidates(
      operation,
      false,
      maximumReelTimeRemaining(operation),
    );
    assertMaximumReelOperation(operation);

    let selected = await tryMaximumReelCandidates(
      operation,
      resolution.candidates,
    );

    if (
      !selected &&
      resolution.fromCache &&
      maximumReelTimeRemaining(operation) > 700
    ) {
        reelQuality.candidateCache.delete(operation.shortcode);
      resolution = await resolveMaximumReelCandidates(
        operation,
        true,
        maximumReelTimeRemaining(operation),
      );
      assertMaximumReelOperation(operation);
      selected = await tryMaximumReelCandidates(
        operation,
        resolution.candidates,
      );
    }

    if (!selected) {
      throw createMaximumReelError(
        "candidate_failure",
        "No progressive candidate decoded before the hold deadline.",
      );
    }

    finishMaximumReelPlayback(operation, selected);
  } catch (err) {
    if (operation.finished) return;

    const reason = err?.code || "metadata_failure";
    if (reason === "source_rebound") {
      resumeMaximumReelCurrentSource(operation, reason);
      return;
    }
    if (reason === "video_reused") {
      abandonMaximumReelPlayback(operation, reason);
      return;
    }
    if (reason === "ineligible_route") {
      relinquishMaximumReelPlayback(operation, reason);
      return;
    }
    if (err?.rateLimited) {
      reelQuality.cooldownUntil =
        now() + REEL_QUALITY_RATE_LIMIT_COOLDOWN;
    }

    failMaximumReelPlayback(operation, reason, {
      markFailure:
        reason !== "operation_cancelled" && reason !== "inactive_reel",
      resumeNative: reason !== "inactive_reel",
    });
  }
}

/**
 * resolveMaximumReelCandidates
 * @description Fetch and memory-cache normalized progressive representations.
 *
 * @param {Object} operation
 * @param {Boolean} force
 * @param {Number} timeout
 * @return {Promise<Object>}
 */
async function resolveMaximumReelCandidates(operation, force, timeout) {
  const shortcode = operation.shortcode;
  const currentTime = now();
  const cached = reelQuality.candidateCache.get(shortcode);

  if (
    !force &&
    cached &&
    currentTime - cached.createdAt < REEL_QUALITY_CACHE_MAX_AGE
  ) {
    logger(
      "[Reel Quality] Using cached progressive metadata",
      shortcode,
      cached.candidates.length,
      "candidates",
    );
    return { candidates: cached.candidates, fromCache: true };
  }

  if (currentTime < reelQuality.cooldownUntil) {
    throw createMaximumReelError(
      "rate_limited",
      "Instagram metadata requests are cooling down.",
      true,
    );
  }

  let requestRecord = reelQuality.activeRequest;
  if (
    requestRecord &&
    (force || requestRecord.shortcode !== shortcode)
  ) {
    abortMaximumReelMetadataRequest();
    requestRecord = null;
  }

  if (!requestRecord) {
    requestRecord = { handle: null, promise: null, shortcode };
    const request = getBlobMediaWithQueryID(shortcode, {
      onRequest: function (handle) {
        requestRecord.handle = handle;
      },
      silent: true,
      timeout: Math.max(1, Math.floor(timeout)),
    })
      .then(function (data) {
        const consumer = reelQuality.activeOperation;
        if (
          !consumer ||
          consumer.finished ||
          consumer.shortcode !== shortcode
        ) {
          throw createMaximumReelError(
            "operation_cancelled",
            "The metadata response no longer has an active Reel consumer.",
          );
        }
        const candidates = normalizeMaximumReelCandidates(data);
        if (!candidates.length) {
          throw createMaximumReelError(
            "empty_candidates",
            "Instagram returned no complete progressive video source.",
          );
        }

        reelQuality.candidateCache.set(shortcode, {
          candidates,
          createdAt: now(),
        });
        logger(
          "[Reel Quality] Progressive metadata resolved",
          shortcode,
          candidates.map((candidate) => ({
            bandwidth: candidate.bandwidth,
            height: candidate.height,
            width: candidate.width,
          })),
        );
        return candidates;
      })
      .finally(function () {
        if (reelQuality.activeRequest === requestRecord) {
          reelQuality.activeRequest = null;
        }
      });
    requestRecord.promise = request;
    reelQuality.activeRequest = requestRecord;
  }

  const candidates = await requestRecord.promise;
  return { candidates, fromCache: false };
}

/**
 * normalizeMaximumReelCandidates
 * @description Normalize and rank complete progressive representations. The
 * XDT video_versions list is used before the single video_url fallback.
 *
 * @param {Object} data
 * @return {Array<Object>}
 */
function normalizeMaximumReelCandidates(data) {
  return normalizeCandidates(data);
}

/**
 * tryMaximumReelCandidates
 * @description Try ranked sources in order, reserving part of the shared
 * deadline for lower-ranked Safari-compatible fallbacks.
 *
 * @param {Object} operation
 * @param {Array<Object>} candidates
 * @return {Promise<Object|null>}
 */
async function tryMaximumReelCandidates(operation, candidates) {
  for (let index = 0; index < candidates.length; index++) {
    assertMaximumReelOperation(operation);
    const remaining = maximumReelTimeRemaining(operation);
    if (remaining <= 0) break;

    const remainingCandidates = candidates.length - index - 1;
    const reserve = Math.min(
      remainingCandidates * 600,
      Math.max(0, remaining - 800),
    );
    const candidateDeadline = Math.min(
      operation.deadline,
      now() + Math.max(1, remaining - reserve),
    );
    const candidate = candidates[index];

    try {
      await loadMaximumReelCandidate(
        operation,
        candidate,
        candidateDeadline,
      );
      return candidate;
    } catch (err) {
      assertMaximumReelOperation(operation);
      if (
        err?.code === "operation_cancelled" ||
        err?.code === "inactive_reel" ||
        err?.code === "source_rebound" ||
        err?.code === "video_reused"
      ) {
        throw err;
      }
      logger(
        "[Reel Quality] Progressive candidate rejected",
        {
          height: candidate.height,
          reason: err?.code || "media_error",
          width: candidate.width,
        },
      );
    }
  }

  return null;
}

/**
 * loadMaximumReelCandidate
 * @description Bind one direct source to the same video, restore the playback
 * position, and wait until Safari reports a decoded frame.
 *
 * @param {Object} operation
 * @param {Object} candidate
 * @param {Number} candidateDeadline
 * @return {Promise<void>}
 */
async function loadMaximumReelCandidate(
  operation,
  candidate,
  candidateDeadline,
) {
  const video = operation.video;
  operation.phase = "loading";
  operation.destructive = true;
  operation.candidateBound = false;
  operation.selectedUrl = candidate.url;

  const metadataReady = waitForMaximumReelVideo(
    operation,
    ["loadedmetadata"],
    function () {
      return video.readyState >= HTMLMediaElement.HAVE_METADATA;
    },
    candidateDeadline,
    "metadata_timeout",
    false,
  );

  try {
    videoOperations.pause(video);
    video.autoplay = false;
    video.removeAttribute("autoplay");
    if ("srcObject" in video) videoOperations.clearSourceObject(video);
    operation.snapshot.sourceElements.forEach(function (source) {
      if (source.element.parentElement === video) {
        source.element.removeAttribute("src");
      }
    });
    video.setAttribute("preload", "auto");
    video.setAttribute("playsinline", "");
    video.setAttribute("webkit-playsinline", "");
    videoOperations.setSource(video, candidate.url);
    operation.candidateBound = true;
    videoOperations.load(video);
  } catch (err) {
    operation.pendingWaitCancel?.();
    try {
      await metadataReady;
    } catch (_cancelledError) {
      // Consume the cancelled waiter before reporting the bind failure.
    }
    throw createMaximumReelError(
      "source_bind_failure",
      err?.message || "The progressive source could not be attached.",
    );
  }

  await metadataReady;
  assertMaximumReelOperation(operation);

  const targetTime = maximumReelSeekTime(
    operation.snapshot.currentTime,
    video.duration,
  );
  if (targetTime > 0) {
    try {
      video.currentTime = targetTime;
    } catch (_err) {
      // A candidate can still be used if Safari declines the initial seek.
    }
  }

  await waitForMaximumReelVideo(
    operation,
    ["loadeddata", "canplay", "seeked"],
    function () {
      return (
        !video.seeking &&
        video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
        video.videoWidth > 0 &&
        video.videoHeight > 0
      );
    },
    candidateDeadline,
    "frame_timeout",
    true,
  );
}

/**
 * waitForMaximumReelVideo
 * @description Wait for a media state with cancellation, error, and a bounded
 * deadline. URLs are intentionally omitted from diagnostics.
 *
 * @return {Promise<void>}
 */
function waitForMaximumReelVideo(
  operation,
  eventNames,
  predicate,
  deadline,
  timeoutCode,
  checkImmediately,
) {
  return new Promise(function (resolve, reject) {
    const video = operation.video;
    let settled = false;
    let timer = null;

    function cleanup() {
      eventNames.forEach((name) => video.removeEventListener(name, onReady));
      video.removeEventListener("error", onError);
      if (timer) clearTimeout(timer);
      if (operation.pendingWaitCancel === onCancel) {
        operation.pendingWaitCancel = null;
      }
    }

    function finish(callback, value) {
      if (settled) return;
      settled = true;
      cleanup();
      callback(value);
    }

    function onReady() {
      try {
        assertMaximumReelOperation(operation);
        if (predicate()) finish(resolve);
      } catch (err) {
        finish(reject, err);
      }
    }

    function onError() {
      finish(
        reject,
        createMaximumReelError(
          "media_error",
          video.error?.message || "Safari rejected the progressive source.",
        ),
      );
    }

    function onCancel() {
      finish(
        reject,
        createMaximumReelError(
          "operation_cancelled",
          "The active Reel changed during source loading.",
        ),
      );
    }

    eventNames.forEach((name) => video.addEventListener(name, onReady));
    video.addEventListener("error", onError);
    operation.pendingWaitCancel = onCancel;

    const delay = Math.max(0, deadline - now());
    timer = setTimeout(function () {
      finish(
        reject,
        createMaximumReelError(
          timeoutCode,
          "The progressive source did not become ready in time.",
        ),
      );
    }, delay);

    if (checkImmediately) onReady();
  });
}

/**
 * finishMaximumReelPlayback
 * @description Reveal the decoded direct source and honor the last native
 * playback request if the same Reel is still active.
 *
 * @param {Object} operation
 * @param {Object} candidate
 * @return {void}
 */
function finishMaximumReelPlayback(operation, candidate) {
  assertMaximumReelOperation(operation);
  if (operation.hardTimeout) clearTimeout(operation.hardTimeout);
  operation.finished = true;
  operation.phase = "ready";
  operation.selectedUrl = candidate.url;
  operation.retryAt = 0;

  restoreMaximumReelSourceElements(operation.snapshot);
  restoreMaximumReelPlaybackProperties(operation.video, operation.snapshot);
  cleanupMaximumReelHold(operation);

  reelQuality.failedAt.delete(operation.shortcode);
  reelQuality.videoState.set(operation.video, operation);
  if (reelQuality.activeOperation === operation) {
    reelQuality.activeOperation = null;
  }

  operation.video.dataset.instaLoaderReelQuality =
    `${operation.video.videoWidth}x${operation.video.videoHeight}`;
  logger(
    "[Reel Quality] Maximum progressive source ready",
    operation.shortcode,
    {
      decodedHeight: operation.video.videoHeight,
      decodedWidth: operation.video.videoWidth,
      elapsedMs: Math.round(now() - operation.startedAt),
      reportedHeight: candidate.height,
      reportedWidth: candidate.width,
    },
  );

  if (
    operation.wantsPlayback &&
    isEnabled() &&
    operation.video.isConnected &&
    getReelShortcodeForVideo(operation.video) === operation.shortcode &&
    isActiveReelVideo(operation.video)
  ) {
    Promise.resolve(videoOperations.play(operation.video)).catch(function (err) {
      logger(
        "[Reel Quality] Maximum source loaded but autoplay was blocked",
        err?.name || "play_rejected",
      );
    });
  }
}

/**
 * failMaximumReelPlayback
 * @description Remove the hold and fail open to the native source. Source
 * restoration is only needed after the first destructive load().
 *
 * @param {Object} operation
 * @param {String} reason
 * @param {Object} options
 * @return {void}
 */
function failMaximumReelPlayback(operation, reason, options = {}) {
  if (!operation || operation.finished) return;

  if (operation.hardTimeout) clearTimeout(operation.hardTimeout);
  operation.finished = true;
  operation.pendingWaitCancel?.();
  operation.pendingWaitCancel = null;
  abortMaximumReelMetadataRequest(operation);

  if (options.markFailure) {
    reelQuality.failedAt.set(operation.shortcode, now());
    reelQuality.candidateCache.delete(operation.shortcode);
  }

  const canResume =
    options.resumeNative &&
    operation.wantsPlayback &&
    operation.video.isConnected &&
    getReelShortcodeForVideo(operation.video) === operation.shortcode &&
    isActiveReelVideo(operation.video);

  let restored = true;
  if (operation.destructive) {
    restored = restoreMaximumReelNativeSource(operation);
  } else {
    restoreMaximumReelPlaybackProperties(operation.video, operation.snapshot);
  }

  operation.phase = options.markFailure ? "fallback" : "native";
  operation.retryAt = options.markFailure
    ? now() + REEL_QUALITY_FAILURE_RETRY_DELAY
    : 0;
  reelQuality.videoState.set(operation.video, operation);
  cleanupMaximumReelHold(operation);

  if (reelQuality.activeOperation === operation) {
    reelQuality.activeOperation = null;
  }

  logger("[Reel Quality] Native playback fallback", operation.shortcode, {
    elapsedMs: Math.round(now() - operation.startedAt),
    reason,
    restored,
  });

  if (canResume && restored) {
    Promise.resolve(videoOperations.play(operation.video)).catch(function (err) {
      logger(
        "[Reel Quality] Native playback resume was blocked",
        err?.name || "play_rejected",
      );
    });
  }
}

/**
 * cancelMaximumReelPlayback
 * @description Invalidate the current hold immediately, including when the
 * preference is switched off.
 *
 * @param {String} reason
 * @param {Boolean} resumeNative
 * @return {void}
 */
function cancelMaximumReelPlayback(reason, resumeNative = true) {
  const operation = reelQuality.activeOperation;
  if (!operation) return;

  if (reason === "reel-video-removed") {
    abandonMaximumReelPlayback(operation, reason);
    return;
  }

  failMaximumReelPlayback(operation, reason, {
    markFailure: false,
    resumeNative,
  });
}

/**
 * abandonMaximumReelPlayback
 * @description Drop stale work when React reuses the same video for another
 * Reel. Restoring the old snapshot here would overwrite the new native source.
 *
 * @param {Object} operation
 * @param {String} reason
 * @param {Object} options
 * @return {void}
 */
function abandonMaximumReelPlayback(operation, reason, options = {}) {
  if (!operation || operation.finished) return;

  if (operation.hardTimeout) clearTimeout(operation.hardTimeout);
  operation.finished = true;
  operation.phase = "native";
  operation.pendingWaitCancel?.();
  operation.pendingWaitCancel = null;
  if (!options.keepRequest) abortMaximumReelMetadataRequest(operation);
  cleanupMaximumReelHold(operation);

  if (reelQuality.activeOperation === operation) {
    reelQuality.activeOperation = null;
  }
  logger("[Reel Quality] Abandoned stale player state", reason);
}

/**
 * relinquishMaximumReelPlayback
 * @description Invalidate a standalone operation without restoring its stale
 * native snapshot when Instagram navigates to a recycled Reels feed player.
 *
 * @param {Object} operation
 * @param {String} reason
 * @return {Object|null}
 */
function relinquishMaximumReelPlayback(operation, reason) {
  if (!operation) return;

  const nativeFeed = isMaximumReelFeedRoute(getLocation().href);
  if (
    reason === "manual-reload" &&
    !nativeFeed &&
    isMaximumReelPlaybackRouteEligible(
      operation.video,
      operation.shortcode,
    )
  ) {
    return restoreMaximumReelForManualReload(operation, reason);
  }

  cancelMaximumReelRestoreTime(operation);
  if (operation.relinquished) return;

  operation.relinquished = true;
  operation.finished = true;
  operation.phase = "native";
  if (operation.hardTimeout) clearTimeout(operation.hardTimeout);
  operation.pendingWaitCancel?.();
  operation.pendingWaitCancel = null;
  abortMaximumReelMetadataRequest(operation);
  cleanupMaximumReelHold(operation);

  const video = operation.video;
  const ownsProgressiveSource =
    operation.candidateBound &&
    operation.selectedUrl &&
    maximumReelSourceMatches(video, operation.selectedUrl);
  let releasedSource = false;

  // Once the plural feed owns this recycled node, do not call pause(), play(),
  // load(), or touch src/srcObject. Instagram must be the only player owner on
  // that surface, including during standalone-to-feed navigation.
  if (!nativeFeed && ownsProgressiveSource) {
    try {
      videoOperations.pause(video);
      videoOperations.clearSource(video);
      if ("srcObject" in video) videoOperations.clearSourceObject(video);
      operation.snapshot.sourceElements.forEach(function (source) {
        if (source.element.parentElement === video) {
          source.element.removeAttribute("src");
        }
      });
      videoOperations.load(video);
      releasedSource = true;
    } catch (err) {
      logger(
        "[Reel Quality] Managed source release deferred to Instagram",
        err?.name || "source_release_failure",
      );
    }
  } else if (!nativeFeed && operation.destructive) {
    restoreMaximumReelPlaybackProperties(video, operation.snapshot);
  }

  delete video.dataset.instaLoaderReelQuality;
  reelQuality.videoState.delete(video);
  if (reelQuality.activeOperation === operation) {
    reelQuality.activeOperation = null;
  }

  logger("[Reel Quality] Relinquished standalone player", reason, {
    releasedSource,
  });
}

/**
 * restoreMaximumReelForManualReload
 * @description Return an owned standalone player to its native snapshot,
 * resume the user's playback intent, and transfer a delayed native seek to
 * the replacement controller created by Manual Reload.
 *
 * @param {Object} operation
 * @param {String} reason
 * @return {Object|null}
 */
function restoreMaximumReelForManualReload(operation, reason) {
  if (!operation) return null;
  if (operation.manualReloadRestored) {
    const existingHandoff = operation.manualReloadHandoff;
    if (existingHandoff?.status === "pending") {
      existingHandoff.transferring = true;
      return existingHandoff;
    }
    return null;
  }

  const phaseBeforeReload = operation.phase;
  const shouldResume =
    operation.wantsPlayback &&
    (phaseBeforeReload === "resolving" ||
      phaseBeforeReload === "loading" ||
      !operation.video.paused);
  operation.manualReloadRestored = true;
  operation.finished = true;
  operation.phase = "native";
  if (operation.hardTimeout) clearTimeout(operation.hardTimeout);
  operation.pendingWaitCancel?.();
  operation.pendingWaitCancel = null;
  abortMaximumReelMetadataRequest(operation);
  cancelMaximumReelRestoreTime(operation);
  cleanupMaximumReelHold(operation);

  const ownsProgressiveSource =
    operation.candidateBound &&
    operation.selectedUrl &&
    maximumReelSourceMatches(operation.video, operation.selectedUrl);
  let restored = true;
  if (ownsProgressiveSource) {
    restored = restoreMaximumReelNativeSource(operation, {
      transferRestoreTime: true,
    });
  } else {
    restoreMaximumReelPlaybackProperties(operation.video, operation.snapshot);
  }

  const canResume =
    shouldResume &&
    restored &&
    operation.video.isConnected &&
    isMaximumReelPlaybackRouteEligible(
      operation.video,
      operation.shortcode,
    );
  operation.nativeResumeOnce = canResume;
  reelQuality.videoState.set(operation.video, operation);
  if (reelQuality.activeOperation === operation) {
    reelQuality.activeOperation = null;
  }
  delete operation.video.dataset.instaLoaderReelQuality;

  logger("[Reel Quality] Restored native player for Reload", reason, {
    restored,
  });

  if (canResume) {
    Promise.resolve(videoOperations.play(operation.video))
      .then(function () {
        operation.nativeResumeOnce = false;
      })
      .catch(function (err) {
        operation.nativeResumeOnce = false;
        logger(
          "[Reel Quality] Native playback resume after Reload was blocked",
          err?.name || "play_rejected",
        );
      });
  }

  return operation.manualReloadHandoff || null;
}

/**
 * resumeMaximumReelCurrentSource
 * @description Respect a new source installed by Instagram during the handoff.
 * The old source snapshot is deliberately not restored.
 *
 * @param {Object} operation
 * @param {String} reason
 * @return {void}
 */
function resumeMaximumReelCurrentSource(operation, reason) {
  if (!operation || operation.finished) return;

  if (operation.hardTimeout) clearTimeout(operation.hardTimeout);
  operation.finished = true;
  operation.phase = "native";
  operation.nativeResumeOnce = true;
  operation.pendingWaitCancel?.();
  operation.pendingWaitCancel = null;
  abortMaximumReelMetadataRequest(operation);
  restoreMaximumReelPlaybackProperties(operation.video, operation.snapshot);
  cleanupMaximumReelHold(operation);

  reelQuality.videoState.set(operation.video, operation);
  if (reelQuality.activeOperation === operation) {
    reelQuality.activeOperation = null;
  }

  const canResume =
    operation.wantsPlayback &&
    operation.video.isConnected &&
    getReelShortcodeForVideo(operation.video) === operation.shortcode &&
    isActiveReelVideo(operation.video);
  logger("[Reel Quality] Accepted Instagram source replacement", reason);

  if (canResume) {
    Promise.resolve(videoOperations.play(operation.video))
      .then(function () {
        operation.nativeResumeOnce = false;
      })
      .catch(function (err) {
        operation.nativeResumeOnce = false;
        logger(
          "[Reel Quality] Replacement source resume was blocked",
          err?.name || "play_rejected",
        );
      });
  } else {
    operation.nativeResumeOnce = false;
  }
}

/**
 * abortMaximumReelMetadataRequest
 * @description Keep automatic metadata traffic to one active shortcode.
 *
 * @param {Object} operation
 * @return {void}
 */
function abortMaximumReelMetadataRequest(operation) {
  const request = reelQuality.activeRequest;
  if (!request || (operation && request.shortcode !== operation.shortcode)) {
    return;
  }

  reelQuality.activeRequest = null;
  try {
    request.handle?.abort?.();
  } catch (_err) {
    // A request that completed between the check and abort is already harmless.
  }
}

/**
 * @param {Object} operation
 * @return {void}
 */
function cancelMaximumReelRestoreTime(operation) {
  if (!operation?.pendingRestoreTimeCancel) return;

  const cancel = operation.pendingRestoreTimeCancel;
  operation.pendingRestoreTimeCancel = null;
  cancel();
}

/**
 * restoreMaximumReelNativeSource
 * @description Best-effort restoration after a direct source called load().
 * Instagram may instead remount its player if a blob MediaSource has expired.
 *
 * @param {Object} operation
 * @param {{transferRestoreTime?: boolean}} [options]
 * @return {Boolean}
 */
function restoreMaximumReelNativeSource(operation, options = {}) {
  const video = operation.video;
  const snapshot = operation.snapshot;
  let hasSource = false;

  cancelMaximumReelRestoreTime(operation);

  try {
    videoOperations.pause(video);
    videoOperations.clearSource(video);
    restoreMaximumReelSourceElements(snapshot);

    if (snapshot.srcObject != null && "srcObject" in video) {
      video.srcObject = snapshot.srcObject;
      hasSource = true;
    } else if (snapshot.srcAttribute != null) {
      videoOperations.setSource(video, snapshot.srcAttribute);
      hasSource = true;
    } else if (
      snapshot.sourceElements.some(
        (source) =>
          source.parent === video &&
          source.element.parentElement === video &&
          source.src != null,
      )
    ) {
      hasSource = true;
    } else if (
      snapshot.currentSrc &&
      snapshot.currentSrc !== operation.selectedUrl
    ) {
      videoOperations.setSource(video, snapshot.currentSrc);
      hasSource = true;
    }

    restoreMaximumReelPlaybackProperties(video, snapshot);
    if (hasSource) {
      videoOperations.load(video);
      const restoreTime = function () {
        cancelMaximumReelRestoreTime(operation);
        restoreMaximumReelTime(operation);
      };
      if (video.readyState >= HTMLMediaElement.HAVE_METADATA) {
        restoreTime();
      } else if (options.transferRestoreTime) {
        operation.manualReloadHandoff =
          createMaximumReelManualReloadHandoff(operation);
      } else {
        operation.pendingRestoreTimeCancel = scope.listen(
          video,
          "loadedmetadata",
          restoreTime,
          { once: true },
        );
      }
    }
  } catch (err) {
    logger(
      "[Reel Quality] Native source restoration deferred to Instagram",
      err?.name || "restore_failure",
    );
    return false;
  }

  return hasSource;
}

/**
 * Keep the one delayed native seek alive across the synchronous application
 * teardown/remount performed by Manual Reload. The handoff owns its listener
 * in a dedicated scope until the replacement controller adopts or cancels it.
 *
 * @param {Object} operation
 * @return {Object}
 */
function createMaximumReelManualReloadHandoff(operation) {
  const handoffScope = new DisposableScope(environment, {
    onError: (error) =>
      logger(
        "[Reel Quality] Reload seek cleanup failed",
        error?.name || "cleanup_failure",
      ),
  });
  const handoff = {
    cancel: null,
    operation,
    shortcode: operation.shortcode,
    status: "pending",
    transferring: true,
    video: operation.video,
  };

  const finish = function () {
    if (handoff.status !== "pending") return;
    handoff.status = "completed";
    handoff.transferring = false;
    handoffScope.dispose();
    reelQuality.reloadHandoffs.delete(handoff.video);
    if (operation.manualReloadHandoff === handoff) {
      operation.manualReloadHandoff = null;
    }
    restoreMaximumReelTime(operation);
  };
  handoff.cancel = function () {
    if (handoff.status !== "pending") return;
    handoff.status = "cancelled";
    handoff.transferring = false;
    handoffScope.dispose();
    reelQuality.reloadHandoffs.delete(handoff.video);
    if (operation.manualReloadHandoff === handoff) {
      operation.manualReloadHandoff = null;
    }
  };

  handoffScope.listen(operation.video, "loadedmetadata", finish, {
    once: true,
  });
  reelQuality.reloadHandoffs.set(operation.video, handoff);
  return handoff;
}

/**
 * @param {Object} operation
 * @return {void}
 */
function restoreMaximumReelTime(operation) {
  const video = operation.video;
  if (!isMaximumReelPlaybackRouteEligible(video, operation.shortcode)) return;

  try {
    video.currentTime = maximumReelSeekTime(
      operation.snapshot.currentTime,
      video.duration,
    );
  } catch (_err) {
    // Native playback can continue even when its old position is stale.
  }
}

/**
 * snapshotMaximumReelVideo
 * @description Capture source declarations and user-visible playback state.
 *
 * @param {HTMLVideoElement} video
 * @return {Object}
 */
function snapshotMaximumReelVideo(video) {
  let srcObject = null;
  try {
    srcObject = "srcObject" in video ? video.srcObject : null;
  } catch (_err) {
    // Some WebKit media objects reject inspection while being detached.
  }

  const sourceElements = Array.from(video.children)
    .filter((element) => element.tagName === "SOURCE")
    .map(function (element) {
      return {
        attributes: Array.from(element.attributes).map((attribute) => ({
          name: attribute.name,
          value: attribute.value,
        })),
        element,
        parent: video,
        src: element.getAttribute("src"),
      };
    });

  return {
    autoplayAttribute: video.getAttribute("autoplay"),
    autoplay: video.autoplay,
    controls: video.controls,
    currentSrc: video.currentSrc,
    currentTime: Number.isFinite(video.currentTime) ? video.currentTime : 0,
    defaultMuted: video.defaultMuted,
    defaultPlaybackRate: video.defaultPlaybackRate,
    loop: video.loop,
    muted: video.muted,
    playbackRate: video.playbackRate,
    playsInlineAttribute: video.getAttribute("playsinline"),
    playsInline: video.playsInline,
    preloadAttribute: video.getAttribute("preload"),
    sourceElements,
    srcAttribute: video.getAttribute("src"),
    srcObject,
    volume: video.volume,
    webkitPlaysInlineAttribute: video.getAttribute("webkit-playsinline"),
  };
}

/**
 * restoreMaximumReelPlaybackProperties
 * @description Restore playback behavior without replacing the selected source.
 *
 * @param {HTMLVideoElement} video
 * @param {Object} snapshot
 * @return {void}
 */
function restoreMaximumReelPlaybackProperties(video, snapshot) {
  try {
    restoreMaximumReelAttribute(
      video,
      "autoplay",
      snapshot.autoplayAttribute,
    );
    restoreMaximumReelAttribute(
      video,
      "playsinline",
      snapshot.playsInlineAttribute,
    );
    restoreMaximumReelAttribute(
      video,
      "webkit-playsinline",
      snapshot.webkitPlaysInlineAttribute,
    );
    restoreMaximumReelAttribute(
      video,
      "preload",
      snapshot.preloadAttribute,
    );
    video.autoplay = snapshot.autoplay;
    video.controls = snapshot.controls;
    video.defaultMuted = snapshot.defaultMuted;
    video.defaultPlaybackRate = snapshot.defaultPlaybackRate;
    video.loop = snapshot.loop;
    video.muted = snapshot.muted;
    video.playbackRate = snapshot.playbackRate;
    video.playsInline = snapshot.playsInline;
    video.volume = snapshot.volume;
  } catch (err) {
    logger(
      "[Reel Quality] Some playback properties could not be restored",
      err?.name || "property_restore_failure",
    );
  }
}

/**
 * restoreMaximumReelSourceElements
 * @description Restore exact child source declarations removed for the direct
 * progressive source.
 *
 * @param {Object} snapshot
 * @return {void}
 */
function restoreMaximumReelSourceElements(snapshot) {
  snapshot.sourceElements.forEach(function (source) {
    if (source.element.parentElement !== source.parent) return;

    Array.from(source.element.attributes).forEach((attribute) => {
      source.element.removeAttribute(attribute.name);
    });
    source.attributes.forEach((attribute) => {
      source.element.setAttribute(attribute.name, attribute.value);
    });
  });
}

/**
 * createMaximumReelHold
 * @description Add a viewport-fixed, pointer-transparent poster hold without
 * changing Instagram's player or control positioning.
 *
 * @param {Object} operation
 * @return {Object|null}
 */
function createMaximumReelHold(operation) {
  const video = operation.video;
  const host = document.documentElement;
  if (!host) return null;

  const previousOwner = reelQuality.hostOwners.get(host);
  if (previousOwner && previousOwner !== operation) {
    cleanupMaximumReelHold(previousOwner);
  }

  const overlay = document.createElement("div");
  overlay.className = "insta-loader-reel-quality-hold";
  overlay.setAttribute("aria-hidden", "true");

  const poster = findMaximumReelPoster(video);
  if (poster) {
    const image = document.createElement("img");
    image.alt = "";
    image.src = poster;
    overlay.appendChild(image);
  }

  const spinner = document.createElement("div");
  spinner.className = "insta-loader-reel-quality-spinner";
  overlay.appendChild(spinner);
  host.appendChild(overlay);

  let syncFrame = null;
  const render = function () {
    syncFrame = null;
    if (!video.isConnected) return;
    const rect = video.getBoundingClientRect();
    overlay.style.left = `${rect.left}px`;
    overlay.style.top = `${rect.top}px`;
    overlay.style.width = `${rect.width}px`;
    overlay.style.height = `${rect.height}px`;
  };
  const sync = function () {
    if (syncFrame != null) return;
    syncFrame = requestAnimationFrame(render);
  };
  render();
  window.addEventListener("scroll", sync, true);
  window.addEventListener("resize", sync);

  reelQuality.hostOwners.set(host, operation);
  return {
    cancelSync: function () {
      if (syncFrame != null) cancelAnimationFrame(syncFrame);
      syncFrame = null;
    },
    host,
    overlay,
    sync,
  };
}

/**
 * cleanupMaximumReelHold
 * @description Remove only the hold owned by this operation and undo its exact
 * temporary inline positioning change.
 *
 * @param {Object} operation
 * @return {void}
 */
function cleanupMaximumReelHold(operation) {
  const hold = operation?.hold;
  if (!hold) return;

  const ownsHost =
    reelQuality.hostOwners.get(hold.host) === operation;
  if (ownsHost) {
    hold.overlay.remove();
    hold.cancelSync();
    window.removeEventListener("scroll", hold.sync, true);
    window.removeEventListener("resize", hold.sync);
    reelQuality.hostOwners.delete(hold.host);
  }
  operation.hold = null;
}

/**
 * findMaximumReelPoster
 * @description Prefer the video's poster, then the largest overlapping image
 * in its nearby Reel container.
 *
 * @param {HTMLVideoElement} video
 * @return {String|null}
 */
function findMaximumReelPoster(video) {
  if (video.poster) return video.poster;

  const videoRect = video.getBoundingClientRect();
  let scope = video.parentElement;
  let best = null;
  for (let depth = 0; scope && depth < 5; depth++, scope = scope.parentElement) {
    scope.querySelectorAll("img").forEach(function (image) {
      const rect = image.getBoundingClientRect();
      const overlapWidth = Math.max(
        0,
        Math.min(rect.right, videoRect.right) -
          Math.max(rect.left, videoRect.left),
      );
      const overlapHeight = Math.max(
        0,
        Math.min(rect.bottom, videoRect.bottom) -
          Math.max(rect.top, videoRect.top),
      );
      const score = overlapWidth * overlapHeight;
      const src = image.currentSrc || image.src;
      if (src && score > (best?.score || 0)) best = { score, src };
    });
    if (best?.score > videoRect.width * videoRect.height * 0.5) break;
  }
  return best?.src || null;
}

/**
 * getReelShortcodeForVideo
 * @description Resolve identity from the video's nearest container before the
 * direct Reel route fallback. Ordinary posts and Reels audio pages are ignored.
 *
 * @param {HTMLVideoElement} video
 * @return {String|null}
 */
function getReelShortcodeForVideo(video) {
  const enclosingLink = video.closest(
    'a[href*="/reel/"], a[href*="/reels/"]',
  );
  const enclosingShortcode = parseMaximumReelShortcode(
    enclosingLink?.href,
    false,
  );
  if (enclosingShortcode) return enclosingShortcode;

  const boundary = video.closest(
    'article, div[role="dialog"], [data-pagelet]',
  );
  if (boundary) {
    const shortcodes = [
      ...new Set(
        Array.from(
          boundary.querySelectorAll(
            'a[href*="/reel/"], a[href*="/reels/"]',
          ),
        )
          .map((anchor) => parseMaximumReelShortcode(anchor.href, false))
          .filter(Boolean),
      ),
    ];
    if (shortcodes.length === 1) return shortcodes[0];

    const routeShortcode = parseMaximumReelShortcode(getLocation().href, true);
    if (routeShortcode && shortcodes.includes(routeShortcode)) {
      return routeShortcode;
    }
  }

  return parseMaximumReelShortcode(getLocation().href, true);
}

/**
 * parseMaximumReelShortcode
 * @description Parse exact Reel route segments and reject reserved collections.
 *
 * @param {String} value
 * @param {Boolean} directOnly
 * @return {String|null}
 */
function parseMaximumReelShortcode(value, directOnly) {
  return parseReelShortcode(value, directOnly, getLocation().origin);
}

/**
 * getMaximumReelPlaybackRouteShortcode
 * @description Return a shortcode only for stable singular /reel/ pages.
 * Plural /reels/ routes use Instagram's recycled native feed players.
 *
 * @param {String} value
 * @return {String|null}
 */
function getMaximumReelPlaybackRouteShortcode(value) {
  return getStandaloneReelShortcode(value, getLocation().origin);
}

/**
 * isMaximumReelPlaybackRouteEligible
 * @description Require both the video identity and the stable standalone route
 * to agree before any automatic metadata request or player mutation.
 *
 * @param {HTMLVideoElement} video
 * @param {String} shortcode
 * @return {Boolean}
 */
function isMaximumReelPlaybackRouteEligible(video, shortcode) {
  const routeShortcode = getMaximumReelPlaybackRouteShortcode(getLocation().href);
  return (
    Boolean(routeShortcode) &&
    routeShortcode === shortcode &&
    getReelShortcodeForVideo(video) === shortcode
  );
}

/** @return {Boolean} */
function isMaximumReelFeedRoute(value) {
  return isNativeReelsFeedRoute(value, getLocation().origin);
}

/**
 * isActiveReelVideo
 * @description Synchronously require a substantially visible, connected player.
 *
 * @param {HTMLVideoElement} video
 * @return {Boolean}
 */
function isActiveReelVideo(video) {
  if (!video?.isConnected || document.visibilityState === "hidden") return false;

  const rect = video.getBoundingClientRect();
  if (rect.width < 32 || rect.height < 32) return false;

  let clipLeft = 0;
  let clipTop = 0;
  let clipRight = window.innerWidth;
  let clipBottom = window.innerHeight;
  let element = video;

  while (element && element.nodeType === Node.ELEMENT_NODE) {
    const style = getComputedStyle(element);
    if (
      element.hidden ||
      element.hasAttribute("inert") ||
      element.getAttribute("aria-hidden") === "true" ||
      style.display === "none" ||
      style.visibility === "hidden" ||
      style.visibility === "collapse" ||
      style.contentVisibility === "hidden" ||
      Number(style.opacity) <= 0.01
    ) {
      return false;
    }

    if (element !== video) {
      const clipsX = /^(auto|scroll|hidden|clip)$/.test(style.overflowX);
      const clipsY = /^(auto|scroll|hidden|clip)$/.test(style.overflowY);
      if (clipsX || clipsY) {
        const ancestorRect = element.getBoundingClientRect();
        if (clipsX) {
          clipLeft = Math.max(clipLeft, ancestorRect.left);
          clipRight = Math.min(clipRight, ancestorRect.right);
        }
        if (clipsY) {
          clipTop = Math.max(clipTop, ancestorRect.top);
          clipBottom = Math.min(clipBottom, ancestorRect.bottom);
        }
      }
    }
    element = element.parentElement;
  }

  const visibleWidth = Math.max(
    0,
    Math.min(rect.right, clipRight) - Math.max(rect.left, clipLeft),
  );
  const visibleHeight = Math.max(
    0,
    Math.min(rect.bottom, clipBottom) - Math.max(rect.top, clipTop),
  );
  return (visibleWidth * visibleHeight) / (rect.width * rect.height) >= 0.55;
}

/**
 * assertMaximumReelOperation
 * @description Reject stale work at every asynchronous boundary.
 *
 * @param {Object} operation
 * @return {void}
 */
function assertMaximumReelOperation(operation) {
  if (
    operation.finished ||
    reelQuality.generation !== operation.generation ||
    reelQuality.activeOperation !== operation ||
    reelQuality.videoState.get(operation.video) !== operation ||
    !isEnabled()
  ) {
    throw createMaximumReelError(
      "operation_cancelled",
      "The Reel quality operation is no longer current.",
    );
  }
  if (
    !isMaximumReelPlaybackRouteEligible(
      operation.video,
      operation.shortcode,
    )
  ) {
    throw createMaximumReelError(
      "ineligible_route",
      "Maximum-quality playback is limited to standalone Reel pages.",
    );
  }
  if (
    operation.destructive &&
    operation.candidateBound &&
    operation.selectedUrl &&
    !maximumReelSourceMatches(operation.video, operation.selectedUrl)
  ) {
    throw createMaximumReelError(
      "source_rebound",
      "Instagram replaced the progressive source during the handoff.",
    );
  }

  const currentShortcode = getReelShortcodeForVideo(operation.video);
  if (
    operation.video.isConnected &&
    currentShortcode &&
    currentShortcode !== operation.shortcode
  ) {
    throw createMaximumReelError(
      "video_reused",
      "Instagram reused the player for a different Reel.",
    );
  }
  if (
    !operation.video.isConnected ||
    !isActiveReelVideo(operation.video) ||
    currentShortcode !== operation.shortcode
  ) {
    throw createMaximumReelError(
      "inactive_reel",
      "The original Reel is no longer active.",
    );
  }
  if (maximumReelTimeRemaining(operation) <= 0) {
    throw createMaximumReelError(
      "hold_timeout",
      "The Reel quality hold reached its total deadline.",
    );
  }
}

/** @return {Number} */
function maximumReelTimeRemaining(operation) {
  return Math.max(0, operation.deadline - now());
}

/** @return {Number} */
function maximumReelActivityScore(video) {
  const rect = video.getBoundingClientRect();
  const visibleWidth = Math.max(
    0,
    Math.min(rect.right, window.innerWidth) - Math.max(rect.left, 0),
  );
  const visibleHeight = Math.max(
    0,
    Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0),
  );
  const centerDistance = Math.hypot(
    rect.left + rect.width / 2 - window.innerWidth / 2,
    rect.top + rect.height / 2 - window.innerHeight / 2,
  );
  return visibleWidth * visibleHeight - centerDistance;
}

/** @return {Boolean} */
function maximumReelSourceMatches(video, url) {
  if (!url) return false;
  try {
    if ("srcObject" in video && video.srcObject != null) return false;
  } catch (_err) {
    return false;
  }

  const declaredSource = video.getAttribute("src");
  if (declaredSource != null && declaredSource !== url) return false;
  if (
    video.currentSrc &&
    video.currentSrc !== url &&
    video.readyState > HTMLMediaElement.HAVE_NOTHING
  ) {
    return false;
  }
  return declaredSource === url || video.currentSrc === url;
}

/** @return {Number} */
function maximumReelSeekTime(currentTime, duration) {
  if (!Number.isFinite(currentTime) || currentTime <= 0) return 0;
  if (!Number.isFinite(duration) || duration <= 0) return currentTime;
  return Math.min(currentTime, Math.max(0, duration - 0.05));
}

/** @return {void} */
function restoreMaximumReelAttribute(element, name, value) {
  if (value == null) element.removeAttribute(name);
  else element.setAttribute(name, value);
}

/** @return {Error} */
function createMaximumReelError(code, message, rateLimited = false) {
  const error = new Error(message);
  error.code = code;
  error.rateLimited = rateLimited;
  return error;
}

/**
 * registerMaximumReelBinding
 * @description Cap rapid React/source rebinding so the userscript does not enter
 * a tug-of-war with Instagram's player.
 *
 * @param {String} shortcode
 * @return {Boolean}
 */
function registerMaximumReelBinding(shortcode) {
  const currentTime = now();
  const history = (
    reelQuality.rebindHistory.get(shortcode) || []
  ).filter((timestamp) => currentTime - timestamp < 15000);
  if (history.length >= 3) return false;

  history.push(currentTime);
  reelQuality.rebindHistory.set(shortcode, history);
  return true;
}

  function relinquishController(reason) {
    const operations = new Set();
    const reloadHandoffs = new Set();
    if (reelQuality.activeOperation) {
      operations.add(reelQuality.activeOperation);
    }
    document.querySelectorAll("video").forEach((video) => {
      const operation = reelQuality.videoState.get(video);
      if (operation) operations.add(operation);
    });
    operations.forEach((operation) => {
      const handoff = relinquishMaximumReelPlayback(operation, reason);
      if (handoff?.status === "pending") reloadHandoffs.add(handoff);
    });
    document.querySelectorAll("video").forEach((video) => {
      const handoff = reelQuality.reloadHandoffs.get(video);
      if (handoff?.status !== "pending") {
        reelQuality.reloadHandoffs.delete(video);
        return;
      }

      if (reason === "manual-reload") {
        handoff.transferring = true;
        reloadHandoffs.add(handoff);
      } else if (!(reason === "controller-disposed" && handoff.transferring)) {
        handoff.cancel(reason);
        reelQuality.reloadHandoffs.delete(video);
      }
    });
    abortMaximumReelMetadataRequest();

    if (reloadHandoffs.size === 0) return null;

    const handoffs = [...reloadHandoffs];
    return {
      cancel(cancelReason = "reload-handoff-cancelled") {
        handoffs.forEach((handoff) => handoff.cancel(cancelReason));
      },
      handoffs,
      type: "maximum-reel-manual-reload",
    };
  }

  function adoptManualReloadHandoff(token) {
    if (
      token?.type !== "maximum-reel-manual-reload" ||
      !Array.isArray(token.handoffs)
    ) {
      return false;
    }

    let adopted = false;
    token.handoffs.forEach((handoff) => {
      if (handoff?.status !== "pending") return;
      if (
        !handoff.video?.isConnected ||
        !isMaximumReelPlaybackRouteEligible(
          handoff.video,
          handoff.shortcode,
        )
      ) {
        handoff.cancel("reload-handoff-ineligible");
        return;
      }

      handoff.transferring = false;
      reelQuality.reloadHandoffs.set(handoff.video, handoff);
      adopted = true;
    });
    return adopted;
  }

  function disposeEngine() {
    reelQuality.mutationObserver?.disconnect();
    reelQuality.intersectionObserver?.disconnect();
    reelQuality.mutationObserver = null;
    reelQuality.intersectionObserver = null;
    abortMaximumReelMetadataRequest();
  }

  return {
    adoptManualReloadHandoff,
    cancel: cancelMaximumReelPlayback,
    dispose: disposeEngine,
    init: initMaximumReelPlayback,
    relinquish: relinquishController,
    scan: scanForPlayingReels,
    syncRoute: syncMaximumReelPlaybackRoute,
  };
}

/**
 * All player writes flow through this adapter, making the native-only plural
 * route invariant directly observable in deterministic tests.
 *
 * @param {Object} [overrides]
 * @return {Object}
 */
function createVideoOperations(overrides = {}) {
  return {
    pause: overrides.pause || ((video) => video.pause()),
    play: overrides.play || ((video) => video.play()),
    load: overrides.load || ((video) => video.load()),
    setSource:
      overrides.setSource ||
      ((video, source) => video.setAttribute("src", source)),
    clearSource:
      overrides.clearSource || ((video) => video.removeAttribute("src")),
    clearSourceObject:
      overrides.clearSourceObject || ((video) => {
        video.srcObject = null;
      }),
  };
}
