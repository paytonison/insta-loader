import { JSDOM } from "jsdom";
import { describe, expect, it, vi } from "vitest";

import { VideoBehaviorService } from "../../../../src/controllers/video/video-behavior-service.js";
import { createReelVideoSurfaceAdapter } from "../../../../src/controllers/video/surface-adapters.js";

function createEnvironment(dom) {
  return {
    getDocument: () => dom.window.document,
    setTimeout: dom.window.setTimeout.bind(dom.window),
    clearTimeout: dom.window.clearTimeout.bind(dom.window),
    setInterval: dom.window.setInterval.bind(dom.window),
    clearInterval: dom.window.clearInterval.bind(dom.window),
    requestAnimationFrame: (callback) =>
      dom.window.setTimeout(() => callback(0), 0),
    cancelAnimationFrame: dom.window.clearTimeout.bind(dom.window),
    requestIdleCallback: (callback) =>
      dom.window.setTimeout(
        () => callback({ didTimeout: false, timeRemaining: () => 0 }),
        0,
      ),
    cancelIdleCallback: dom.window.clearTimeout.bind(dom.window),
  };
}

function createAdapter(overrides = {}) {
  return {
    surface: "fixture",
    supportsFullscreen: false,
    supportsLooping: false,
    setVolumeOnPlayback: false,
    controllerPosition: "absolute",
    findVideos: (root) => Array.from(root.querySelectorAll("video")),
    findControllerActivations: () => [],
    findControllerVideos: (_root, _selected, videos) => videos,
    locateControllerLayout: () => ({
      overlay: null,
      layers: [],
      hidden: [],
      draggableLinks: [],
      restoreDraggableOnHide: false,
    }),
    findMuteControls: () => [],
    isMuteControlMuted: () => false,
    findLoopAction: () => ({ button: null, reveal: [] }),
    findNavigationGuard: () => null,
    onControllerVisibilityChange: null,
    ...overrides,
  };
}

function createVolume(value) {
  return {
    get: vi.fn(() => value.current),
    set: vi.fn((next) => {
      value.current = next;
      return next;
    }),
  };
}

describe("VideoBehaviorService", () => {
  it("owns fullscreen, looping, playback-volume, refresh, and teardown behavior", () => {
    const dom = new JSDOM(
      '<div id="root"><video style="object-fit: cover"></video></div>',
    );
    const document = dom.window.document;
    const root = document.querySelector("#root");
    const video = root.querySelector("video");
    const pause = vi.fn();
    Object.defineProperty(video, "pause", { configurable: true, value: pause });

    let fullscreenElement = null;
    Object.defineProperty(document, "fullscreenElement", {
      configurable: true,
      get: () => fullscreenElement,
    });
    const addEventListener = vi.spyOn(video, "addEventListener");
    const value = { current: 0.35 };
    const volume = createVolume(value);
    const service = new VideoBehaviorService({
      environment: createEnvironment(dom),
      settings: {
        DISABLE_VIDEO_LOOPING: true,
        HTML5_VIDEO_CONTROL: false,
        MODIFY_VIDEO_VOLUME: true,
      },
      volume,
    });
    const adapter = createAdapter({
      supportsFullscreen: true,
      supportsLooping: true,
      setVolumeOnPlayback: true,
    });

    service.mount(root, adapter);
    service.refresh();
    service.refresh();

    expect(
      addEventListener.mock.calls.filter(([name]) => name === "play"),
    ).toHaveLength(1);
    video.dispatchEvent(new dom.window.Event("play"));
    expect(video.volume).toBe(0.35);
    expect(video.getAttribute("data-modify")).toBe("true");
    video.volume = 0.8;
    video.dispatchEvent(new dom.window.Event("playing"));
    expect(video.volume).toBe(0.8);

    video.dispatchEvent(new dom.window.Event("ended"));
    video.dispatchEvent(new dom.window.Event("ended"));
    expect(pause).toHaveBeenCalledOnce();
    expect(video.getAttribute("data-loop")).toBe("true");

    fullscreenElement = video;
    video.dispatchEvent(new dom.window.Event("fullscreenchange"));
    expect(video.style.objectFit).toBe("contain");
    fullscreenElement = null;
    video.dispatchEvent(new dom.window.Event("fullscreenchange"));
    expect(video.style.objectFit).toBe("cover");

    root.removeChild(video);
    service.refresh();
    expect(video.hasAttribute("data-modify")).toBe(false);
    expect(video.hasAttribute("data-loop")).toBe(false);
    expect(video.style.objectFit).toBe("cover");
    video.dispatchEvent(new dom.window.Event("ended"));
    expect(pause).toHaveBeenCalledOnce();
    expect(service.dispose()).toEqual([]);
    expect(service.dispose()).toEqual([]);
  });

  it("applies saved volume when mounting after playback has started", () => {
    const dom = new JSDOM('<div id="root"><video></video></div>');
    const root = dom.window.document.querySelector("#root");
    const video = root.querySelector("video");
    Object.defineProperty(video, "paused", {
      configurable: true,
      value: false,
    });
    const volume = createVolume({ current: 0.25 });
    const service = new VideoBehaviorService({
      environment: createEnvironment(dom),
      settings: {
        HTML5_VIDEO_CONTROL: false,
        MODIFY_VIDEO_VOLUME: true,
      },
      volume,
    });

    service.mount(
      root,
      createAdapter({ setVolumeOnPlayback: true }),
    );

    expect(video.volume).toBe(0.25);
    expect(video.hasAttribute("data-modify")).toBe(true);
    service.dispose();
  });

  it("switches native controls, synchronizes mute state, and persists volume", () => {
    const dom = new JSDOM(`
      <div id="root">
        <a id="guard" href="/reels/abc/"><video></video></a>
        <div id="activation"></div>
        <div id="overlay"></div>
        <div id="layer"></div>
        <div id="hidden" style="display: flex"></div>
        <button id="mute" type="button">
          <svg><path d="M16.636 7.028a1.5 rest"></path></svg>
        </button>
      </div>
    `);
    const document = dom.window.document;
    const root = document.querySelector("#root");
    const video = root.querySelector("video");
    const activation = root.querySelector("#activation");
    const overlay = root.querySelector("#overlay");
    const layer = root.querySelector("#layer");
    const hidden = root.querySelector("#hidden");
    const guard = root.querySelector("#guard");
    const mute = root.querySelector("#mute");
    const triggerClick = vi.fn();
    const visibility = vi.fn();
    const value = { current: 0.4 };
    const volume = createVolume(value);
    const adapter = createAdapter({
      findControllerActivations: () => [{ target: activation, video }],
      locateControllerLayout: () => ({
        overlay,
        layers: [layer],
        hidden: [hidden],
        draggableLinks: [guard],
        restoreDraggableOnHide: true,
      }),
      findMuteControls: () => [mute],
      isMuteControlMuted: (control) =>
        control.querySelector('path[d^="M16.636"]') == null,
      findNavigationGuard: () => guard,
      onControllerVisibilityChange: visibility,
    });
    const service = new VideoBehaviorService({
      environment: createEnvironment(dom),
      settings: {
        DISABLE_VIDEO_LOOPING: false,
        HTML5_VIDEO_CONTROL: true,
        MODIFY_VIDEO_VOLUME: true,
      },
      volume,
      triggerClick,
    });

    service.mount(root, adapter);
    expect(video.volume).toBe(0.4);
    expect(video.style.position).toBe("absolute");
    expect(video.getAttribute("data-controls")).toBe("true");

    activation.dispatchEvent(
      new dom.window.MouseEvent("contextmenu", {
        bubbles: true,
        cancelable: true,
      }),
    );
    expect(video.controls).toBe(true);
    expect(video.style.zIndex).toBe("2");
    expect(overlay.style.zIndex).toBe("-10");
    expect(layer.style.zIndex).toBe("-10");
    expect(hidden.style.display).toBe("none");
    expect(guard.getAttribute("draggable")).toBe("false");
    expect(visibility).toHaveBeenLastCalledWith(
      expect.objectContaining({ visible: true, surface: "fixture" }),
    );

    const guardedClick = new dom.window.MouseEvent("click", {
      bubbles: true,
      cancelable: true,
    });
    guard.dispatchEvent(guardedClick);
    expect(guardedClick.defaultPrevented).toBe(true);

    video.muted = true;
    triggerClick.mockClear();
    volume.set.mockClear();
    video.removeAttribute("data-completed");
    service.synchronizeMuteAndVolume(video);
    expect(triggerClick).toHaveBeenCalledOnce();
    expect(triggerClick.mock.calls[0][0]).toBe(mute);
    expect(video.volume).toBe(0.4);
    expect(video.hasAttribute("data-completed")).toBe(true);
    expect(volume.set).not.toHaveBeenCalled();

    video.muted = false;
    video.volume = 0.65;
    volume.set.mockClear();
    video.setAttribute("data-completed", "true");
    service.synchronizeMuteAndVolume(video);
    expect(volume.set).toHaveBeenCalledWith(0.65);
    expect(value.current).toBe(0.65);

    video.dispatchEvent(
      new dom.window.MouseEvent("contextmenu", {
        bubbles: true,
        cancelable: true,
      }),
    );
    expect(video.controls).toBe(false);
    expect(video.style.zIndex).toBe("-1");
    expect(overlay.style.zIndex).toBe("1");
    expect(layer.style.zIndex).toBe("1");
    expect(hidden.style.display).toBe("flex");
    expect(guard.hasAttribute("draggable")).toBe(false);
    expect(visibility).toHaveBeenLastCalledWith(
      expect.objectContaining({ visible: false, surface: "fixture" }),
    );

    service.dispose();
    activation.dispatchEvent(
      new dom.window.MouseEvent("contextmenu", {
        bubbles: true,
        cancelable: true,
      }),
    );
    expect(video.controls).toBe(false);
  });

  it("restores owned DOM state on disposal and remounts a recycled video", () => {
    const dom = new JSDOM(`
      <div id="root">
        <a id="guard" href="/reels/abc/" draggable="true">
          <video style="position: static; z-index: 5"></video>
        </a>
        <div id="activation"></div>
        <div id="overlay" style="z-index: 7"></div>
        <div id="layer" style="z-index: 8"></div>
        <div id="hidden" style="display: grid"></div>
      </div>
    `);
    const document = dom.window.document;
    const root = document.querySelector("#root");
    const video = root.querySelector("video");
    const activation = root.querySelector("#activation");
    const overlay = root.querySelector("#overlay");
    const layer = root.querySelector("#layer");
    const hidden = root.querySelector("#hidden");
    const guard = root.querySelector("#guard");
    const pause = vi.fn();
    Object.defineProperty(video, "pause", { configurable: true, value: pause });

    const value = { current: 0.4 };
    const volume = createVolume(value);
    const adapter = createAdapter({
      supportsLooping: true,
      setVolumeOnPlayback: true,
      findControllerActivations: () => [{ target: activation, video }],
      locateControllerLayout: () => ({
        overlay,
        layers: [layer],
        hidden: [hidden],
        draggableLinks: [guard],
        restoreDraggableOnHide: true,
      }),
      findNavigationGuard: () => guard,
    });
    const createService = () =>
      new VideoBehaviorService({
        environment: createEnvironment(dom),
        settings: {
          DISABLE_VIDEO_LOOPING: true,
          HTML5_VIDEO_CONTROL: true,
          MODIFY_VIDEO_VOLUME: true,
        },
        volume,
      });

    const service = createService();
    service.mount(root, adapter);
    video.dispatchEvent(new dom.window.Event("play"));
    video.dispatchEvent(new dom.window.Event("ended"));
    service.synchronizeMuteAndVolume(video);
    activation.dispatchEvent(
      new dom.window.MouseEvent("contextmenu", {
        bubbles: true,
        cancelable: true,
      }),
    );

    expect(video.hasAttribute("data-controls")).toBe(true);
    expect(video.hasAttribute("data-modify")).toBe(true);
    expect(video.hasAttribute("data-loop")).toBe(true);
    expect(video.hasAttribute("data-completed")).toBe(true);
    expect(video.controls).toBe(true);
    expect(hidden.style.display).toBe("none");
    expect(guard.getAttribute("draggable")).toBe("false");

    expect(service.dispose()).toEqual([]);
    expect(service.dispose()).toEqual([]);
    expect(video.style.position).toBe("static");
    expect(video.style.zIndex).toBe("5");
    expect(video.hasAttribute("controls")).toBe(false);
    expect(video.hasAttribute("data-controls")).toBe(false);
    expect(video.hasAttribute("data-modify")).toBe(false);
    expect(video.hasAttribute("data-loop")).toBe(false);
    expect(video.hasAttribute("data-completed")).toBe(false);
    expect(overlay.style.zIndex).toBe("7");
    expect(layer.style.zIndex).toBe("8");
    expect(hidden.style.display).toBe("grid");
    expect(guard.getAttribute("draggable")).toBe("true");

    video.volume = 0.8;
    video.dispatchEvent(new dom.window.Event("play"));
    expect(video.volume).toBe(0.8);

    const remountedService = createService();
    remountedService.mount(root, adapter);
    video.dispatchEvent(new dom.window.Event("play"));
    expect(video.volume).toBe(0.4);
    expect(video.hasAttribute("data-modify")).toBe(true);
    expect(remountedService.dispose()).toEqual([]);
  });

  it("uses a native Reel loop action before falling back to pause", () => {
    const dom = new JSDOM('<div id="root"><video></video></div>');
    const root = dom.window.document.querySelector("#root");
    const video = root.querySelector("video");
    const nativeButton = dom.window.document.createElement("button");
    const click = vi.fn();
    Object.defineProperty(nativeButton, "click", {
      configurable: true,
      value: click,
    });
    const pause = vi.fn();
    Object.defineProperty(video, "pause", { configurable: true, value: pause });
    const service = new VideoBehaviorService({
      environment: createEnvironment(dom),
      settings: { DISABLE_VIDEO_LOOPING: true },
      volume: createVolume({ current: 1 }),
    });

    service.mount(
      root,
      createAdapter({
        supportsLooping: true,
        findLoopAction: () => ({ button: nativeButton, reveal: [] }),
      }),
    );
    video.dispatchEvent(new dom.window.Event("ended"));

    expect(click).toHaveBeenCalledOnce();
    expect(pause).not.toHaveBeenCalled();
  });

  it("does not own ended or pause behavior when Reel looping is disabled", () => {
    const dom = new JSDOM('<div id="root"><video></video></div>');
    const root = dom.window.document.querySelector("#root");
    const video = root.querySelector("video");
    const pause = vi.fn();
    const addEventListener = vi.spyOn(video, "addEventListener");
    Object.defineProperty(video, "pause", { configurable: true, value: pause });
    const service = new VideoBehaviorService({
      environment: createEnvironment(dom),
      settings: {
        DISABLE_VIDEO_LOOPING: true,
        HTML5_VIDEO_CONTROL: false,
        MODIFY_VIDEO_VOLUME: false,
      },
      volume: createVolume({ current: 1 }),
    });

    service.mount(
      root,
      createReelVideoSurfaceAdapter({ supportsLooping: false }),
    );
    video.dispatchEvent(new dom.window.Event("ended"));

    expect(
      addEventListener.mock.calls.some(([type]) => type === "ended"),
    ).toBe(false);
    expect(pause).not.toHaveBeenCalled();
    service.dispose();
  });

  it("validates mount dependencies and adapter completeness", () => {
    const dom = new JSDOM('<div id="root"></div>');
    const root = dom.window.document.querySelector("#root");

    expect(
      () =>
        new VideoBehaviorService({
          environment: {},
          settings: {},
          volume: createVolume({ current: 1 }),
        }),
    ).toThrow(TypeError);

    const service = new VideoBehaviorService({
      environment: createEnvironment(dom),
      settings: {},
      volume: createVolume({ current: 1 }),
    });
    expect(() => service.mount(root, {})).toThrow(TypeError);
  });
});
