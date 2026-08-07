// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MaximumReelPlaybackController } from "../../../src/controllers/maximum-reel-playback-controller.js";
import { normalizeMaximumReelCandidates } from "../../../src/media/progressive-candidates.js";

const STANDALONE_URL = "https://www.instagram.com/reel/Standalone1/";
const mutationObservers = [];
const intersectionObservers = [];

class TestMutationObserver {
  constructor(callback) {
    this.callback = callback;
    this.disconnect = vi.fn();
    this.observe = vi.fn();
    mutationObservers.push(this);
  }

  emit(records) {
    this.callback(records, this);
  }
}

class TestIntersectionObserver {
  constructor(callback) {
    this.callback = callback;
    this.disconnect = vi.fn();
    this.observe = vi.fn();
    intersectionObservers.push(this);
  }

  emit(entries) {
    this.callback(entries, this);
  }
}

function createDeferredRequest() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return {
    abort: vi.fn(),
    promise,
    reject,
    resolve,
  };
}

function installReel(shortcode, route = "reel") {
  document.documentElement.style.cssText =
    "display:block;visibility:visible;opacity:1";
  document.body.style.cssText = "display:block;visibility:visible;opacity:1";
  document.body.innerHTML = `
    <main style="display:block;visibility:visible;opacity:1">
      <article style="display:block;visibility:visible;opacity:1">
        <a href="https://www.instagram.com/${route}/${shortcode}/" style="display:block;visibility:visible;opacity:1">
          <video
            src="blob:https://www.instagram.com/native-${shortcode}"
            style="display:block;visibility:visible;opacity:1"
          ></video>
        </a>
      </article>
    </main>`;

  const video = document.querySelector("video");
  let paused = true;
  let currentTime = 4;
  const currentTimeWrites = [];
  let duration = 30;
  let mediaError = null;
  let readyState = 0;
  let seeking = false;
  let srcObject = null;
  let videoHeight = 0;
  let videoWidth = 0;
  Object.defineProperties(video, {
    currentSrc: {
      configurable: true,
      get: () => video.getAttribute("src") || "",
    },
    currentTime: {
      configurable: true,
      get: () => currentTime,
      set: (value) => {
        currentTime = Number(value);
        currentTimeWrites.push(currentTime);
      },
    },
    duration: { configurable: true, get: () => duration },
    ended: { configurable: true, get: () => false },
    error: { configurable: true, get: () => mediaError },
    paused: { configurable: true, get: () => paused },
    readyState: { configurable: true, get: () => readyState },
    seeking: { configurable: true, get: () => seeking },
    srcObject: {
      configurable: true,
      get: () => srcObject,
      set: (value) => {
        srcObject = value;
      },
    },
    videoHeight: { configurable: true, get: () => videoHeight },
    videoWidth: { configurable: true, get: () => videoWidth },
  });

  const activeRect = {
    bottom: 720,
    height: 640,
    left: 320,
    right: 680,
    top: 80,
    width: 360,
    x: 320,
    y: 80,
  };
  for (let element = video; element; element = element.parentElement) {
    element.getBoundingClientRect = () => activeRect;
  }

  return {
    currentTimeWrites,
    mediaState: {
      fail(message = "media failed") {
        mediaError = { message };
        video.dispatchEvent(new Event("error"));
      },
      metadata() {
        readyState = window.HTMLMediaElement.HAVE_METADATA;
        video.dispatchEvent(new Event("loadedmetadata"));
      },
      ready(width = 1080, height = 1920) {
        seeking = false;
        readyState = window.HTMLMediaElement.HAVE_CURRENT_DATA;
        videoWidth = width;
        videoHeight = height;
        video.dispatchEvent(new Event("loadeddata"));
      },
      reset() {
        mediaError = null;
        readyState = window.HTMLMediaElement.HAVE_NOTHING;
        seeking = false;
        videoHeight = 0;
        videoWidth = 0;
      },
      setDuration(value) {
        duration = value;
      },
      setPaused(value) {
        paused = value;
      },
    },
    play() {
      paused = false;
      video.dispatchEvent(new Event("play"));
    },
    video,
  };
}

function createHarness(
  initialUrl,
  request = createDeferredRequest(),
  overrides = {},
) {
  let currentUrl = new URL(initialUrl);
  let enabled = overrides.enabled ?? true;
  const reel = overrides.reel;
  const sourceAttempts = new Map();
  const loadedSources = [];
  const mediaEvents = [];
  const resolveMediaOutcome = (source) => {
    const attempt = (sourceAttempts.get(source) || 0) + 1;
    sourceAttempts.set(source, attempt);
    const configured = overrides.mediaOutcomes?.[source];
    if (typeof configured === "function") {
      return configured({ attempt, source });
    }
    if (Array.isArray(configured)) {
      return configured[Math.min(attempt - 1, configured.length - 1)];
    }
    return configured || { type: "pending" };
  };
  const videoOperations = {
    clearSource: vi.fn((video) => video.removeAttribute("src")),
    clearSourceObject: vi.fn((video) => {
      video.srcObject = null;
    }),
    load: vi.fn((video) => {
      const source = video.getAttribute("src") || "";
      loadedSources.push(source);
      if (!source.startsWith("https://")) return;

      const outcome = resolveMediaOutcome(source);
      mediaEvents.push({ outcome, source });
      if (outcome?.type === "success") {
        setTimeout(() => reel.mediaState.metadata(), outcome.metadataDelay ?? 5);
        setTimeout(
          () => reel.mediaState.ready(outcome.width, outcome.height),
          outcome.frameDelay ?? 10,
        );
      } else if (outcome?.type === "error") {
        setTimeout(
          () => reel.mediaState.fail(outcome.message),
          outcome.delay ?? 5,
        );
      } else if (outcome?.type === "rebound") {
        setTimeout(() => {
          video.setAttribute("src", outcome.source);
          reel.mediaState.metadata();
        }, outcome.delay ?? 5);
      }
    }),
    pause: vi.fn(() => reel?.mediaState.setPaused(true)),
    play: vi.fn((video) => {
      reel?.mediaState.setPaused(false);
      video.dispatchEvent(new Event("play"));
      return Promise.resolve();
    }),
    setSource: vi.fn((video, source) => {
      reel?.mediaState.reset();
      video.setAttribute("src", source);
    }),
  };
  const requestMetadata =
    overrides.requestMetadata || vi.fn(() => request);
  const environment = {
    cancelAnimationFrame: (handle) => clearTimeout(handle),
    cancelIdleCallback: (handle) => clearTimeout(handle),
    clearInterval,
    clearTimeout,
    getDocument: () => document,
    getLocation: () => currentUrl,
    now: () => Date.now(),
    queueMicrotask,
    requestAnimationFrame: (callback) =>
      setTimeout(() => callback(Date.now()), 16),
    requestIdleCallback: (callback) => setTimeout(callback, 1),
    setInterval,
    setTimeout,
    window,
  };
  const controller = new MaximumReelPlaybackController({
    environment,
    cacheMaxAge: overrides.cacheMaxAge,
    failureRetryDelay: overrides.failureRetryDelay,
    getLocation: () => currentUrl,
    holdTimeout: overrides.holdTimeout,
    isEnabled: () => enabled,
    logger: overrides.logger,
    normalizeCandidates:
      overrides.normalizeCandidates || ((value) => value.candidates || []),
    rateLimitCooldown: overrides.rateLimitCooldown,
    requestMetadata,
    videoOperations,
  });

  return {
    controller,
    loadedSources,
    logger: overrides.logger,
    mediaEvents,
    request,
    requestMetadata,
    setEnabled(value) {
      enabled = value;
    },
    setUrl(value) {
      currentUrl = new URL(value);
    },
    videoOperations,
  };
}

async function flushAsync(rounds = 8) {
  for (let index = 0; index < rounds; index += 1) {
    await Promise.resolve();
  }
  await vi.runAllTicks();
}

async function settleMedia(milliseconds = 25) {
  await flushAsync();
  await vi.advanceTimersByTimeAsync(milliseconds);
  await flushAsync();
}

function setDocumentVisibility(value) {
  Object.defineProperties(document, {
    hidden: { configurable: true, value: value === "hidden" },
    visibilityState: { configurable: true, value },
  });
  document.dispatchEvent(new Event("visibilitychange"));
}

const HIGH_URL = "https://cdn.example.test/reel-1080.mp4";
const LOW_URL = "https://cdn.example.test/reel-720.mp4";
const HIGH_CANDIDATE = Object.freeze({
  bandwidth: 4500000,
  height: 1920,
  url: HIGH_URL,
  width: 1080,
});
const LOW_CANDIDATE = Object.freeze({
  bandwidth: 2200000,
  height: 1280,
  url: LOW_URL,
  width: 720,
});

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-08-06T12:00:00Z"));
  mutationObservers.length = 0;
  intersectionObservers.length = 0;
  Object.defineProperties(document, {
    hidden: { configurable: true, value: false },
    visibilityState: { configurable: true, value: "visible" },
  });
  Object.defineProperties(window, {
    MutationObserver: { configurable: true, value: TestMutationObserver },
    IntersectionObserver: {
      configurable: true,
      value: TestIntersectionObserver,
    },
    innerHeight: { configurable: true, value: 800 },
    innerWidth: { configurable: true, value: 1000 },
  });
});

afterEach(() => {
  document
    .querySelectorAll(".insta-loader-reel-quality-hold")
    .forEach((element) => element.remove());
  document.body.innerHTML = "";
  vi.useRealTimers();
});

describe("MaximumReelPlaybackController", () => {
  it.each([
    "https://www.instagram.com/reels/",
    "https://www.instagram.com/reels/FeedReel1/",
    "https://www.instagram.com/fixture_user/reels/FeedReel1/",
  ])("never owns a plural-feed player on %s", async (url) => {
    const reel = installReel("FeedReel1", "reels");
    const harness = createHarness(url);
    harness.controller.mount();

    reel.play();
    await vi.runAllTicks();
    await vi.advanceTimersByTimeAsync(1000);

    expect(harness.requestMetadata).not.toHaveBeenCalled();
    expect(harness.videoOperations.pause).not.toHaveBeenCalled();
    expect(harness.videoOperations.play).not.toHaveBeenCalled();
    expect(harness.videoOperations.setSource).not.toHaveBeenCalled();
    expect(harness.videoOperations.clearSource).not.toHaveBeenCalled();
    expect(harness.videoOperations.clearSourceObject).not.toHaveBeenCalled();
    expect(harness.videoOperations.load).not.toHaveBeenCalled();
    expect(document.querySelector(".insta-loader-reel-quality-hold")).toBeNull();

    harness.controller.dispose();
  });

  it("aborts stale metadata without mutating the recycled feed player", async () => {
    const reel = installReel("Standalone1");
    const harness = createHarness(STANDALONE_URL);
    harness.controller.mount();
    reel.play();
    await vi.runAllTicks();

    expect(harness.requestMetadata).toHaveBeenCalledOnce();
    expect(harness.videoOperations.pause).toHaveBeenCalledOnce();
    expect(document.querySelector(".insta-loader-reel-quality-hold")).not.toBeNull();
    const playbackWritesAtNavigation = Object.values(
      harness.videoOperations,
    ).reduce((count, spy) => count + spy.mock.calls.length, 0);

    harness.setUrl("https://www.instagram.com/reels/FeedReel1/");
    expect(harness.controller.refresh()).toBe(true);

    expect(harness.request.abort).toHaveBeenCalledOnce();
    expect(document.querySelector(".insta-loader-reel-quality-hold")).toBeNull();
    expect(
      Object.values(harness.videoOperations).reduce(
        (count, spy) => count + spy.mock.calls.length,
        0,
      ),
    ).toBe(playbackWritesAtNavigation);

    harness.request.resolve({
      candidates: [{ height: 1920, url: "https://cdn.example/stale.mp4", width: 1080 }],
    });
    await vi.runAllTicks();

    expect(harness.videoOperations.setSource).not.toHaveBeenCalled();
    expect(harness.videoOperations.load).not.toHaveBeenCalled();
    harness.controller.dispose();
  });

  it("removes a delayed native seek before a fallback player is recycled into the feed", async () => {
    const request = createDeferredRequest();
    const reel = installReel("Standalone1");
    const harness = createHarness(STANDALONE_URL, request, {
      mediaOutcomes: {
        [HIGH_URL]: { type: "error" },
      },
      reel,
    });
    harness.controller.mount();
    reel.play();
    request.resolve({ candidates: [HIGH_CANDIDATE] });
    await settleMedia(30);

    expect(reel.video.getAttribute("src")).toBe(
      "blob:https://www.instagram.com/native-Standalone1",
    );
    expect(reel.currentTimeWrites).toEqual([]);
    const playbackWritesAtNavigation = Object.values(
      harness.videoOperations,
    ).reduce((count, spy) => count + spy.mock.calls.length, 0);

    reel.video.closest("a").href =
      "https://www.instagram.com/reels/FeedReel1/";
    harness.setUrl("https://www.instagram.com/reels/FeedReel1/");
    reel.mediaState.metadata();
    await flushAsync();

    expect(reel.currentTimeWrites).toEqual([]);
    expect(harness.controller.refresh()).toBe(true);
    expect(
      Object.values(harness.videoOperations).reduce(
        (count, spy) => count + spy.mock.calls.length,
        0,
      ),
    ).toBe(playbackWritesAtNavigation);
    harness.controller.dispose();
  });

  it("fails open to the native source at the shared five-second deadline", async () => {
    const reel = installReel("Standalone1");
    const harness = createHarness(STANDALONE_URL);
    harness.controller.mount();
    reel.play();
    await vi.runAllTicks();

    expect(document.querySelector(".insta-loader-reel-quality-hold")).not.toBeNull();
    await vi.advanceTimersByTimeAsync(5000);

    expect(harness.request.abort).toHaveBeenCalledOnce();
    expect(harness.videoOperations.play).toHaveBeenCalledOnce();
    expect(harness.videoOperations.setSource).not.toHaveBeenCalled();
    expect(harness.videoOperations.load).not.toHaveBeenCalled();
    expect(reel.video.getAttribute("src")).toBe(
      "blob:https://www.instagram.com/native-Standalone1",
    );
    expect(document.querySelector(".insta-loader-reel-quality-hold")).toBeNull();

    harness.controller.dispose();
    harness.controller.dispose();
  });

  it("removes capture listeners and schedulers on idempotent disposal", async () => {
    const reel = installReel("Standalone1");
    const harness = createHarness(STANDALONE_URL);
    harness.controller.mount();
    harness.controller.dispose();
    harness.controller.dispose();

    reel.play();
    await vi.runAllTicks();
    await vi.advanceTimersByTimeAsync(1000);

    expect(harness.requestMetadata).not.toHaveBeenCalled();
    expect(harness.videoOperations.pause).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("resumes the untouched native source when Reload interrupts metadata resolution", async () => {
    const reel = installReel("Standalone1");
    const harness = createHarness(STANDALONE_URL, createDeferredRequest(), {
      reel,
    });
    harness.controller.mount();
    reel.play();
    await flushAsync();

    harness.controller.relinquish("manual-reload");
    await flushAsync();

    expect(harness.request.abort).toHaveBeenCalledOnce();
    expect(reel.video.getAttribute("src")).toBe(
      "blob:https://www.instagram.com/native-Standalone1",
    );
    expect(harness.videoOperations.play).toHaveBeenCalledOnce();
    expect(harness.videoOperations.setSource).not.toHaveBeenCalled();
    expect(harness.videoOperations.clearSource).not.toHaveBeenCalled();
    expect(harness.videoOperations.load).not.toHaveBeenCalled();
    expect(document.querySelector(".insta-loader-reel-quality-hold")).toBeNull();

    const playbackWritesAfterReload = Object.values(
      harness.videoOperations,
    ).reduce((count, spy) => count + spy.mock.calls.length, 0);
    harness.controller.relinquish("manual-reload");
    await flushAsync();
    expect(
      Object.values(harness.videoOperations).reduce(
        (count, spy) => count + spy.mock.calls.length,
        0,
      ),
    ).toBe(playbackWritesAfterReload);
    harness.controller.dispose();
  });

  it("restores and resumes the native source when Reload interrupts candidate loading", async () => {
    const request = createDeferredRequest();
    const reel = installReel("Standalone1");
    const nativeSource = reel.video.getAttribute("src");
    const harness = createHarness(STANDALONE_URL, request, {
      mediaOutcomes: {
        [HIGH_URL]: { type: "pending" },
      },
      reel,
    });
    harness.controller.mount();
    reel.play();
    request.resolve({ candidates: [HIGH_CANDIDATE] });
    await flushAsync();
    expect(reel.video.getAttribute("src")).toBe(HIGH_URL);

    const reloadHandoff =
      harness.controller.relinquish("manual-reload");
    await flushAsync();

    expect(reel.video.getAttribute("src")).toBe(nativeSource);
    expect(
      harness.videoOperations.setSource.mock.calls.map((call) => call[1]),
    ).toEqual([HIGH_URL, nativeSource]);
    expect(harness.loadedSources).toEqual([HIGH_URL, nativeSource]);
    expect(harness.videoOperations.clearSource).toHaveBeenCalledOnce();
    expect(harness.videoOperations.play).toHaveBeenCalledOnce();
    expect(document.querySelector(".insta-loader-reel-quality-hold")).toBeNull();
    reloadHandoff.cancel("test-complete");
    harness.controller.dispose();
  });

  it("restores a ready direct source to native playback on Reload", async () => {
    const request = createDeferredRequest();
    const reel = installReel("Standalone1");
    const nativeSource = reel.video.getAttribute("src");
    const harness = createHarness(STANDALONE_URL, request, {
      mediaOutcomes: {
        [HIGH_URL]: {
          height: 1920,
          type: "success",
          width: 1080,
        },
      },
      reel,
    });
    harness.controller.mount();
    reel.play();
    request.resolve({ candidates: [HIGH_CANDIDATE] });
    await settleMedia();
    expect(reel.video.getAttribute("src")).toBe(HIGH_URL);

    const seekWritesBeforeReloadMetadata = reel.currentTimeWrites.length;
    harness.controller.relinquish("manual-reload");
    await flushAsync();

    expect(reel.video.getAttribute("src")).toBe(nativeSource);
    expect(
      harness.videoOperations.setSource.mock.calls.map((call) => call[1]),
    ).toEqual([HIGH_URL, nativeSource]);
    expect(harness.loadedSources).toEqual([HIGH_URL, nativeSource]);
    expect(harness.videoOperations.play).toHaveBeenCalledTimes(2);
    expect(reel.video.dataset.instaLoaderReelQuality).toBeUndefined();

    reel.mediaState.metadata();
    await flushAsync();
    expect(reel.currentTimeWrites).toHaveLength(
      seekWritesBeforeReloadMetadata + 1,
    );
    expect(reel.currentTimeWrites.at(-1)).toBe(4);
    harness.controller.dispose();
  });

  it("transfers a delayed native seek through the full Reload disposal and remount", async () => {
    const request = createDeferredRequest();
    const reel = installReel("Standalone1");
    const nativeSource = reel.video.getAttribute("src");
    const harness = createHarness(STANDALONE_URL, request, {
      mediaOutcomes: {
        [HIGH_URL]: {
          height: 1920,
          type: "success",
          width: 1080,
        },
      },
      reel,
    });
    harness.controller.mount();
    reel.play();
    request.resolve({ candidates: [HIGH_CANDIDATE] });
    await settleMedia();
    expect(reel.video.getAttribute("src")).toBe(HIGH_URL);

    const seekWritesBeforeReloadMetadata = reel.currentTimeWrites.length;
    const reloadHandoff = harness.controller.relinquish("manual-reload");
    await flushAsync();
    harness.controller.dispose();

    const remounted = createHarness(
      STANDALONE_URL,
      createDeferredRequest(),
      { reel },
    );
    remounted.controller.mount();
    expect(
      remounted.controller.adoptManualReloadHandoff(reloadHandoff),
    ).toBe(true);

    await vi.advanceTimersByTimeAsync(100);
    expect(reel.video.getAttribute("src")).toBe(nativeSource);
    expect(reel.currentTimeWrites).toHaveLength(
      seekWritesBeforeReloadMetadata,
    );
    expect(remounted.requestMetadata).not.toHaveBeenCalled();

    reel.mediaState.metadata();
    await flushAsync();
    expect(reel.currentTimeWrites).toHaveLength(
      seekWritesBeforeReloadMetadata + 1,
    );
    expect(reel.currentTimeWrites.at(-1)).toBe(4);

    reel.play();
    await flushAsync();
    expect(remounted.requestMetadata).toHaveBeenCalledOnce();
    remounted.controller.dispose();
  });

  it("keeps a user-paused ready Reel paused while Reload restores its native source", async () => {
    const request = createDeferredRequest();
    const reel = installReel("Standalone1");
    const harness = createHarness(STANDALONE_URL, request, {
      mediaOutcomes: {
        [HIGH_URL]: {
          height: 1920,
          type: "success",
          width: 1080,
        },
      },
      reel,
    });
    harness.controller.mount();
    reel.play();
    request.resolve({ candidates: [HIGH_CANDIDATE] });
    await settleMedia();
    reel.mediaState.setPaused(true);

    const playCallsBeforeReload = harness.videoOperations.play.mock.calls.length;
    const reloadHandoff = harness.controller.relinquish("manual-reload");
    await flushAsync();
    harness.controller.dispose();

    const remounted = createHarness(
      STANDALONE_URL,
      createDeferredRequest(),
      { reel },
    );
    remounted.controller.mount();
    expect(
      remounted.controller.adoptManualReloadHandoff(reloadHandoff),
    ).toBe(true);
    reel.mediaState.metadata();
    await flushAsync();

    expect(harness.videoOperations.play).toHaveBeenCalledTimes(
      playCallsBeforeReload,
    );
    expect(reel.video.paused).toBe(true);
    remounted.controller.dispose();
  });

  it("drops a transferred Reload seek without touching a plural-feed player", async () => {
    const request = createDeferredRequest();
    const reel = installReel("Standalone1");
    const harness = createHarness(STANDALONE_URL, request, {
      mediaOutcomes: {
        [HIGH_URL]: {
          height: 1920,
          type: "success",
          width: 1080,
        },
      },
      reel,
    });
    harness.controller.mount();
    reel.play();
    request.resolve({ candidates: [HIGH_CANDIDATE] });
    await settleMedia();

    const reloadHandoff = harness.controller.relinquish("manual-reload");
    await flushAsync();
    harness.controller.dispose();
    const playbackWritesAtNavigation = Object.values(
      harness.videoOperations,
    ).reduce((count, spy) => count + spy.mock.calls.length, 0);
    const seekWritesAtNavigation = reel.currentTimeWrites.length;

    reel.video.closest("a").href =
      "https://www.instagram.com/reels/FeedReel1/";
    const remounted = createHarness(
      "https://www.instagram.com/reels/FeedReel1/",
      createDeferredRequest(),
      { reel },
    );
    remounted.controller.mount();
    expect(
      remounted.controller.adoptManualReloadHandoff(reloadHandoff),
    ).toBe(false);
    reel.mediaState.metadata();
    await vi.advanceTimersByTimeAsync(1000);

    expect(
      Object.values(harness.videoOperations).reduce(
        (count, spy) => count + spy.mock.calls.length,
        0,
      ),
    ).toBe(playbackWritesAtNavigation);
    expect(reel.currentTimeWrites).toHaveLength(seekWritesAtNavigation);
    expect(remounted.requestMetadata).not.toHaveBeenCalled();
    expect(remounted.videoOperations.pause).not.toHaveBeenCalled();
    expect(remounted.videoOperations.play).not.toHaveBeenCalled();
    expect(remounted.videoOperations.setSource).not.toHaveBeenCalled();
    expect(remounted.videoOperations.clearSource).not.toHaveBeenCalled();
    expect(remounted.videoOperations.load).not.toHaveBeenCalled();
    remounted.controller.dispose();
  });

  it("selects and completes the highest-ranked progressive candidate", async () => {
    const request = createDeferredRequest();
    const reel = installReel("Standalone1");
    const harness = createHarness(STANDALONE_URL, request, {
      mediaOutcomes: {
        [HIGH_URL]: {
          height: 1920,
          type: "success",
          width: 1080,
        },
      },
      normalizeCandidates: normalizeMaximumReelCandidates,
      reel,
    });
    harness.controller.mount();
    reel.play();
    request.resolve({
      video_versions: [LOW_CANDIDATE, HIGH_CANDIDATE],
    });

    await settleMedia();

    expect(
      harness.videoOperations.setSource.mock.calls.map((call) => call[1]),
    ).toEqual([HIGH_URL]);
    expect(reel.video.getAttribute("src")).toBe(HIGH_URL);
    expect(reel.video.dataset.instaLoaderReelQuality).toBe("1080x1920");
    expect(harness.videoOperations.play).toHaveBeenCalledOnce();
    expect(document.querySelector(".insta-loader-reel-quality-hold")).toBeNull();
    harness.controller.dispose();
  });

  it("tries the next ranked candidate after the first candidate fails", async () => {
    const request = createDeferredRequest();
    const reel = installReel("Standalone1");
    const harness = createHarness(STANDALONE_URL, request, {
      mediaOutcomes: {
        [HIGH_URL]: { message: "decoder rejected source", type: "error" },
        [LOW_URL]: {
          height: 1280,
          type: "success",
          width: 720,
        },
      },
      reel,
    });
    harness.controller.mount();
    reel.play();
    request.resolve({ candidates: [HIGH_CANDIDATE, LOW_CANDIDATE] });

    await settleMedia(40);

    expect(
      harness.videoOperations.setSource.mock.calls.map((call) => call[1]),
    ).toEqual([HIGH_URL, LOW_URL]);
    expect(reel.video.getAttribute("src")).toBe(LOW_URL);
    expect(reel.video.dataset.instaLoaderReelQuality).toBe("720x1280");
    expect(harness.videoOperations.play).toHaveBeenCalledOnce();
    harness.controller.dispose();
  });

  it("restores the exact native source when every bound candidate fails", async () => {
    const request = createDeferredRequest();
    const reel = installReel("Standalone1");
    const nativeSource = reel.video.getAttribute("src");
    const harness = createHarness(STANDALONE_URL, request, {
      mediaOutcomes: {
        [HIGH_URL]: { type: "error" },
      },
      reel,
    });
    harness.controller.mount();
    reel.play();
    request.resolve({ candidates: [HIGH_CANDIDATE] });

    await settleMedia(30);

    expect(
      harness.videoOperations.setSource.mock.calls.map((call) => call[1]),
    ).toEqual([HIGH_URL, nativeSource]);
    expect(reel.video.getAttribute("src")).toBe(nativeSource);
    expect(harness.loadedSources).toEqual([HIGH_URL, nativeSource]);
    expect(harness.videoOperations.play).toHaveBeenCalledOnce();
    expect(document.querySelector(".insta-loader-reel-quality-hold")).toBeNull();
    harness.controller.dispose();
  });

  it("accepts an Instagram source rebound without restoring the stale snapshot", async () => {
    const request = createDeferredRequest();
    const reel = installReel("Standalone1");
    const reboundSource = "blob:https://www.instagram.com/rebound-source";
    const harness = createHarness(STANDALONE_URL, request, {
      mediaOutcomes: {
        [HIGH_URL]: { source: reboundSource, type: "rebound" },
      },
      reel,
    });
    harness.controller.mount();
    reel.play();
    request.resolve({ candidates: [HIGH_CANDIDATE] });

    // Assert the accepted rebound before the controller's independent
    // background scan is due to consider another native playback handoff.
    await settleMedia(10);

    expect(harness.mediaEvents).toEqual([
      {
        outcome: { source: reboundSource, type: "rebound" },
        source: HIGH_URL,
      },
    ]);
    expect(reel.video.getAttribute("src")).toBe(reboundSource);
    expect(
      harness.videoOperations.setSource.mock.calls.map((call) => call[1]),
    ).toEqual([HIGH_URL]);
    expect(harness.videoOperations.clearSource).not.toHaveBeenCalled();
    expect(harness.videoOperations.load).toHaveBeenCalledOnce();
    expect(harness.videoOperations.play).toHaveBeenCalledOnce();
    expect(document.querySelector(".insta-loader-reel-quality-hold")).toBeNull();
    harness.controller.dispose();
  });

  it("enforces the rate-limit cooldown after the ordinary failure retry window", async () => {
    const firstRequest = createDeferredRequest();
    const secondRequest = createDeferredRequest();
    const requestMetadata = vi
      .fn()
      .mockReturnValueOnce(firstRequest)
      .mockReturnValue(secondRequest);
    const reel = installReel("Standalone1");
    const harness = createHarness(STANDALONE_URL, firstRequest, {
      reel,
      requestMetadata,
    });
    harness.controller.mount();
    reel.play();

    const rateLimitError = new Error("rate limited");
    rateLimitError.code = "rate-limit";
    rateLimitError.rateLimited = true;
    firstRequest.reject(rateLimitError);
    await flushAsync();

    expect(requestMetadata).toHaveBeenCalledOnce();
    reel.play();
    await flushAsync();
    expect(requestMetadata).toHaveBeenCalledOnce();

    await vi.advanceTimersByTimeAsync(60_001);
    reel.play();
    await flushAsync();
    expect(requestMetadata).toHaveBeenCalledOnce();

    await vi.advanceTimersByTimeAsync(240_001);
    reel.play();
    await flushAsync();
    expect(requestMetadata).toHaveBeenCalledTimes(2);
    harness.controller.dispose();
    expect(secondRequest.abort).toHaveBeenCalledOnce();
  });

  it("caps rapid source rebindings and retries only after the failure delay", async () => {
    const request = createDeferredRequest();
    const logger = vi.fn();
    const reel = installReel("Standalone1");
    const harness = createHarness(STANDALONE_URL, request, {
      logger,
      mediaOutcomes: {
        [HIGH_URL]: ({ attempt }) => ({
          source: `blob:https://www.instagram.com/rebound-${attempt}`,
          type: "rebound",
        }),
      },
      reel,
    });
    harness.controller.mount();
    reel.play();
    request.resolve({ candidates: [HIGH_CANDIDATE] });

    await settleMedia(15);
    for (let attempt = 2; attempt <= 3; attempt += 1) {
      reel.play();
      await settleMedia(15);
    }
    expect(harness.videoOperations.setSource).toHaveBeenCalledTimes(3);

    reel.play();
    await flushAsync();
    expect(harness.videoOperations.setSource).toHaveBeenCalledTimes(3);
    expect(
      logger.mock.calls.some((call) =>
        call.includes("[Reel Quality] Native playback; source rebind limit reached"),
      ),
    ).toBe(true);

    await vi.advanceTimersByTimeAsync(60_001);
    reel.play();
    await settleMedia(15);
    expect(harness.videoOperations.setSource).toHaveBeenCalledTimes(4);
    expect(harness.requestMetadata).toHaveBeenCalledOnce();
    harness.controller.dispose();
  });

  it("abandons a removed player and aborts its pending metadata", async () => {
    const request = createDeferredRequest();
    const reel = installReel("Standalone1");
    const harness = createHarness(STANDALONE_URL, request, { reel });
    harness.controller.mount();
    reel.play();
    await flushAsync();

    reel.video.remove();
    mutationObservers[0].emit([
      { addedNodes: [], removedNodes: [reel.video] },
    ]);
    await flushAsync();

    expect(request.abort).toHaveBeenCalledOnce();
    expect(harness.videoOperations.play).not.toHaveBeenCalled();
    expect(harness.videoOperations.clearSource).not.toHaveBeenCalled();
    expect(document.querySelector(".insta-loader-reel-quality-hold")).toBeNull();
    harness.controller.dispose();
  });

  it("cancels while hidden and resumes the native source exactly once", async () => {
    const request = createDeferredRequest();
    const reel = installReel("Standalone1");
    const harness = createHarness(STANDALONE_URL, request, { reel });
    harness.controller.mount();
    reel.play();
    await flushAsync();

    setDocumentVisibility("hidden");
    await flushAsync();
    expect(request.abort).toHaveBeenCalledOnce();
    expect(harness.videoOperations.play).not.toHaveBeenCalled();
    expect(document.querySelector(".insta-loader-reel-quality-hold")).toBeNull();

    setDocumentVisibility("visible");
    await flushAsync();
    expect(harness.videoOperations.play).toHaveBeenCalledOnce();
    expect(harness.requestMetadata).toHaveBeenCalledOnce();
    harness.controller.dispose();
  });

  it("restores native playback when the setting is disabled mid-handoff", async () => {
    const request = createDeferredRequest();
    const reel = installReel("Standalone1");
    const nativeSource = reel.video.getAttribute("src");
    const harness = createHarness(STANDALONE_URL, request, {
      mediaOutcomes: {
        [HIGH_URL]: { type: "pending" },
      },
      reel,
    });
    harness.controller.mount();
    reel.play();
    request.resolve({ candidates: [HIGH_CANDIDATE] });
    await flushAsync();
    expect(reel.video.getAttribute("src")).toBe(HIGH_URL);

    harness.setEnabled(false);
    expect(harness.controller.refresh({ settingChanged: true })).toBe(true);
    await flushAsync();

    expect(reel.video.getAttribute("src")).toBe(nativeSource);
    expect(
      harness.videoOperations.setSource.mock.calls.map((call) => call[1]),
    ).toEqual([HIGH_URL, nativeSource]);
    expect(harness.loadedSources).toEqual([HIGH_URL, nativeSource]);
    expect(harness.videoOperations.play).toHaveBeenCalledOnce();
    expect(document.querySelector(".insta-loader-reel-quality-hold")).toBeNull();
    harness.controller.dispose();
  });

  it("releases a ready standalone source into the feed without restoring its stale snapshot", async () => {
    const request = createDeferredRequest();
    const reel = installReel("Standalone1");
    const nativeSource = reel.video.getAttribute("src");
    const harness = createHarness(STANDALONE_URL, request, {
      mediaOutcomes: {
        [HIGH_URL]: {
          height: 1920,
          type: "success",
          width: 1080,
        },
      },
      reel,
    });
    harness.controller.mount();
    reel.play();
    request.resolve({ candidates: [HIGH_CANDIDATE] });
    await settleMedia();
    expect(reel.video.getAttribute("src")).toBe(HIGH_URL);

    const actionCount = Object.values(harness.videoOperations).reduce(
      (count, spy) => count + spy.mock.calls.length,
      0,
    );
    harness.setUrl("https://www.instagram.com/reels/FeedReel1/");
    expect(harness.controller.refresh()).toBe(true);

    expect(reel.video.getAttribute("src")).toBe(HIGH_URL);
    expect(reel.video.getAttribute("src")).not.toBe(nativeSource);
    expect(reel.video.dataset.instaLoaderReelQuality).toBeUndefined();
    expect(
      Object.values(harness.videoOperations).reduce(
        (count, spy) => count + spy.mock.calls.length,
        0,
      ),
    ).toBe(actionCount);

    reel.video.closest("a").href =
      "https://www.instagram.com/reels/FeedReel1/";
    reel.video.setAttribute(
      "src",
      "blob:https://www.instagram.com/native-feed-source",
    );
    reel.play();
    await flushAsync();
    expect(harness.requestMetadata).toHaveBeenCalledOnce();
    expect(
      Object.values(harness.videoOperations).reduce(
        (count, spy) => count + spy.mock.calls.length,
        0,
      ),
    ).toBe(actionCount);
    harness.controller.dispose();
  });

  it("keeps plural-feed playback native when Reload follows a standalone handoff", async () => {
    const request = createDeferredRequest();
    const reel = installReel("Standalone1");
    const harness = createHarness(STANDALONE_URL, request, {
      mediaOutcomes: {
        [HIGH_URL]: {
          height: 1920,
          type: "success",
          width: 1080,
        },
      },
      reel,
    });
    harness.controller.mount();
    reel.play();
    request.resolve({ candidates: [HIGH_CANDIDATE] });
    await settleMedia();

    const playbackWritesAtNavigation = Object.values(
      harness.videoOperations,
    ).reduce((count, spy) => count + spy.mock.calls.length, 0);
    reel.video.closest("a").href =
      "https://www.instagram.com/reels/FeedReel1/";
    harness.setUrl("https://www.instagram.com/reels/FeedReel1/");
    harness.controller.relinquish("manual-reload");

    expect(reel.video.getAttribute("src")).toBe(HIGH_URL);
    expect(
      Object.values(harness.videoOperations).reduce(
        (count, spy) => count + spy.mock.calls.length,
        0,
      ),
    ).toBe(playbackWritesAtNavigation);
    expect(reel.video.dataset.instaLoaderReelQuality).toBeUndefined();
    harness.controller.dispose();
  });
});
