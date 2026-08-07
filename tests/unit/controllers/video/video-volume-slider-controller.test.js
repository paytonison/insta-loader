import { JSDOM } from "jsdom";
import { describe, expect, it, vi } from "vitest";

import { DisposableScope } from "../../../../src/core/disposable-scope.js";
import { VideoVolumeSliderController } from "../../../../src/controllers/video/video-volume-slider-controller.js";
import { VideoVolumeStore } from "../../../../src/controllers/video/video-volume-store.js";

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

function createVolume(value) {
  return {
    get: vi.fn(() => value.current),
    set: vi.fn((next) => {
      value.current = next;
      return next;
    }),
  };
}

describe("VideoVolumeSliderController", () => {
  it("preserves slider markup, placement classes, and all three handlers", () => {
    const dom = new JSDOM(`
      <div id="surface">
        <video id="first"></video>
        <div id="host"></div>
      </div>
    `);
    const document = dom.window.document;
    const surface = document.querySelector("#surface");
    const host = document.querySelector("#host");
    const first = document.querySelector("#first");
    const value = { current: 0.35 };
    const volume = createVolume(value);
    const logger = vi.fn();
    const controller = new VideoVolumeSliderController({
      environment: createEnvironment(dom),
      volume,
      logger,
    });

    const slider = controller.toggle({
      host,
      resolveVideos: () => surface.querySelectorAll("video"),
      loggerType: "post",
      customClass: "bottom",
    });
    const input = slider.querySelector('input[type="range"]');

    expect(host.lastElementChild).toBe(slider);
    expect(slider.className).toBe("volume_slider bottom");
    expect(input.max).toBe("1");
    expect(input.min).toBe("0");
    expect(input.step).toBe("0.05");
    expect(input.value).toBe("0.35");
    expect(input.getAttribute("value")).toBe("0.35");
    expect(input.defaultValue).toBe("0.35");
    expect(input.getAttribute("style")).toBe(
      "--ig-track-progress: 35%",
    );

    input.value = "0.6";
    input.dispatchEvent(new dom.window.Event("input"));
    expect(volume.set).toHaveBeenCalledWith("0.6");
    expect(first.volume).toBe(0.6);
    expect(input.getAttribute("style")).toBe(
      "--ig-track-progress: 60%",
    );
    expect(logger).toHaveBeenLastCalledWith(
      "(post)",
      "video volume changed #slider",
    );

    value.current = 0.45;
    first.volume = 0.8;
    input.dispatchEvent(new dom.window.MouseEvent("mouseenter"));
    expect(input.value).toBe("0.45");
    expect(first.volume).toBe(0.45);
    expect(input.getAttribute("style")).toBe(
      "--ig-track-progress: 45%",
    );

    const click = new dom.window.MouseEvent("click", {
      bubbles: true,
      cancelable: true,
    });
    const parentClick = vi.fn();
    host.addEventListener("click", parentClick);
    slider.dispatchEvent(click);
    expect(click.defaultPrevented).toBe(true);
    expect(parentClick).not.toHaveBeenCalled();

    host.insertAdjacentHTML(
      "beforeend",
      '<div class="volume_slider stale"></div>',
    );
    expect(controller.toggle({
      host,
      resolveVideos: () => surface.querySelectorAll("video"),
      loggerType: "post",
      customClass: "bottom",
    })).toBe(null);
    expect(host.querySelector(".volume_slider")).toBe(null);
    expect(controller.dispose()).toEqual([]);
  });

  it("resolves current videos for every event instead of retaining stale nodes", () => {
    const dom = new JSDOM(`
      <div id="surface">
        <video id="old"></video>
        <div id="host"></div>
      </div>
    `);
    const document = dom.window.document;
    const surface = document.querySelector("#surface");
    const host = document.querySelector("#host");
    const oldVideo = document.querySelector("#old");
    const value = { current: 0.5 };
    const controller = new VideoVolumeSliderController({
      environment: createEnvironment(dom),
      volume: createVolume(value),
    });
    const slider = controller.toggle({
      host,
      resolveVideos: () => ({
        get: () => Array.from(surface.querySelectorAll("video")),
      }),
      loggerType: "reel",
    });
    const input = slider.querySelector("input");

    const currentVideo = document.createElement("video");
    oldVideo.replaceWith(currentVideo);
    oldVideo.volume = 0.9;
    input.value = "0.2";
    input.dispatchEvent(new dom.window.Event("input"));

    expect(oldVideo.volume).toBe(0.9);
    expect(currentVideo.volume).toBe(0.2);
    controller.dispose();
  });

  it("removes owned roots and listeners with the parent route scope", () => {
    const dom = new JSDOM(`
      <div id="host"><video></video></div>
      <div id="second-host"><video></video></div>
    `);
    const document = dom.window.document;
    const host = document.querySelector("#host");
    const secondHost = document.querySelector("#second-host");
    const video = document.querySelector("video");
    const environment = createEnvironment(dom);
    const routeScope = new DisposableScope(environment);
    const value = { current: 0.4 };
    const volume = createVolume(value);
    const controller = new VideoVolumeSliderController({
      environment,
      volume,
      scope: routeScope,
    });
    const slider = controller.toggle({
      host,
      resolveVideos: () => host.querySelectorAll("video"),
      loggerType: "story",
      customClass: "vertical",
    });
    const input = slider.querySelector("input");
    const secondSlider = controller.toggle({
      host: secondHost,
      resolveVideos: () => secondHost.querySelectorAll("video"),
      loggerType: "highlight",
      customClass: "vertical",
    });
    const secondInput = secondSlider.querySelector("input");

    expect(slider.className).toBe("volume_slider vertical");
    expect(routeScope.dispose()).toEqual([]);
    expect(host.querySelector(".volume_slider")).toBe(null);
    expect(secondHost.querySelector(".volume_slider")).toBe(null);

    video.volume = 0.8;
    input.value = "0.1";
    input.dispatchEvent(new dom.window.Event("input"));
    secondInput.dispatchEvent(new dom.window.Event("input"));
    expect(video.volume).toBe(0.8);
    expect(volume.set).not.toHaveBeenCalled();
    expect(controller.dispose()).toEqual([]);
  });

  it("inherits the stored-zero reload rule while retaining slider string writes", () => {
    const dom = new JSDOM('<div id="host"><video></video></div>');
    const document = dom.window.document;
    const host = document.querySelector("#host");
    const storage = {
      getValue: vi.fn(() => 0),
      setValue: vi.fn(),
    };
    const volume = new VideoVolumeStore(storage);
    const controller = new VideoVolumeSliderController({
      environment: createEnvironment(dom),
      volume,
    });
    const slider = controller.toggle({
      host,
      resolveVideos: () => host.querySelectorAll("video"),
      loggerType: "highlight",
    });
    const input = slider.querySelector("input");

    expect(input.value).toBe("1");
    input.value = "0";
    input.dispatchEvent(new dom.window.Event("input"));
    expect(storage.setValue).toHaveBeenCalledWith("G_VIDEO_VOLUME", "0");
    controller.dispose();
  });

  it("validates dependencies and refuses work after disposal", () => {
    const dom = new JSDOM('<div id="host"></div>');
    const environment = createEnvironment(dom);
    const volume = createVolume({ current: 1 });

    expect(
      () =>
        new VideoVolumeSliderController({ environment: {}, volume }),
    ).toThrow(TypeError);
    expect(
      () =>
        new VideoVolumeSliderController({ environment, volume: {} }),
    ).toThrow(TypeError);

    const controller = new VideoVolumeSliderController({
      environment,
      volume,
    });
    controller.dispose();
    expect(() =>
      controller.toggle({
        host: dom.window.document.querySelector("#host"),
        resolveVideos: () => [],
        loggerType: "post",
      }),
    ).toThrow(Error);
  });
});
