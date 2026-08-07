import jquery from "jquery";
import { JSDOM } from "jsdom";
import { describe, expect, it, vi } from "vitest";

import { DisposableScope } from "../../../src/core/disposable-scope.js";
import { ImageViewerController } from "../../../src/controllers/image-viewer-controller.js";

const ICONS = {
  close: '<svg data-test-icon="close"><path /></svg>',
  rotate: '<svg data-test-icon="rotate"><path /></svg>',
};

function createHarness() {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", {
    url: "https://www.instagram.com/p/example/",
  });
  const $ = jquery(dom.window);
  const intervalCallbacks = new Map();
  let nextInterval = 1;
  const environment = {
    getDocument: () => dom.window.document,
    setInterval: vi.fn((callback) => {
      const handle = nextInterval;
      nextInterval += 1;
      intervalCallbacks.set(handle, callback);
      return handle;
    }),
    clearInterval: vi.fn((handle) => {
      intervalCallbacks.delete(handle);
    }),
  };
  const routeScope = new DisposableScope(environment);
  const controller = new ImageViewerController({
    environment,
    $,
    icons: ICONS,
  });

  return {
    $,
    controller,
    dom,
    environment,
    intervalCallbacks,
    routeScope,
  };
}

describe("ImageViewerController", () => {
  it("preserves the viewer DOM, zoom, drag, wheel, rotation, and close behavior", () => {
    const {
      $,
      controller,
      dom,
      intervalCallbacks,
      routeScope,
    } = createHarness();
    const root = controller.open(
      "https://cdn.example/image.jpg",
      routeScope,
    );
    const document = dom.window.document;
    const image = document.querySelector("#iv_image");
    const section = document.querySelector("#imageViewer > section");
    const transform = document.querySelector("#iv_transform");
    const rotate = document.querySelector("#iv_rotate");

    expect(root).toBe(document.querySelector("#imageViewer"));
    expect(root.style.display).toBe("flex");
    expect(root.querySelector("#iv_header > .iv_title").textContent).toBe(
      "Image Viewer",
    );
    expect(root.querySelector("#iv_header > .iv_actions > #rotate_left")).not
      .toBeNull();
    expect(root.querySelector("#iv_header > .iv_actions > #rotate_right")).not
      .toBeNull();
    expect(root.querySelector("#iv_header > #iv_close")).not.toBeNull();
    expect(
      root.querySelector(
        ":scope > section > #iv_transform > #iv_rotate > #iv_image",
      ),
    ).toBe(image);
    expect(
      root.querySelector("#rotate_left > svg[data-test-icon='rotate']"),
    ).not.toBeNull();
    expect(
      root.querySelector("#rotate_right > svg[data-test-icon='rotate']"),
    ).not.toBeNull();
    expect(
      root.querySelector("#iv_close > svg[data-test-icon='close']"),
    ).not.toBeNull();
    expect(image.getAttribute("src")).toBe("https://cdn.example/image.jpg");
    expect(transform.style.transformOrigin).toBe("0 0");
    expect(transform.style.transition).toBe("transform 0.15s ease");
    expect(transform.style.willChange).toBe("transform");
    expect(rotate.style.transformOrigin).toBe("center");
    expect(rotate.style.transition).toBe("transform 0.15s ease");
    expect(rotate.style.willChange).toBe("transform");

    $(image).trigger("load");
    expect(transform.style.transform).toBe(
      "translate(0px, 0px) scale(1)",
    );
    expect(rotate.style.transform).toBe("rotate(0deg)");
    expect(image.style.cursor).toBe("zoom-in");

    const imageClick = new dom.window.MouseEvent("click", {
      bubbles: true,
      cancelable: true,
      clientX: 0,
      clientY: 0,
    });
    image.dispatchEvent(imageClick);
    expect(imageClick.defaultPrevented).toBe(true);
    expect(document.querySelector("#imageViewer")).toBe(root);
    expect(transform.style.transform).toBe(
      "translate(0px, 0px) scale(2.25)",
    );
    expect(image.style.cursor).toBe("grabbing");

    $(image).trigger($.Event("mousedown", { pageX: 10, pageY: 20 }));
    $(document).trigger($.Event("mousemove", { pageX: 30, pageY: 50 }));
    expect(transform.style.transform).toBe(
      "translate(20px, 30px) scale(2.25)",
    );

    const [movementTimer] = intervalCallbacks.values();
    movementTimer();
    image.dispatchEvent(
      new dom.window.MouseEvent("click", {
        bubbles: true,
        cancelable: true,
      }),
    );
    expect(transform.style.transform).toBe(
      "translate(20px, 30px) scale(2.25)",
    );

    movementTimer();
    image.dispatchEvent(
      new dom.window.MouseEvent("click", {
        bubbles: true,
        cancelable: true,
      }),
    );
    expect(transform.style.transform).toBe(
      "translate(0px, 0px) scale(1)",
    );
    expect(transform.style.transition).toBe("transform 0.15s ease");

    $("#rotate_left").trigger("click");
    expect(rotate.style.transform).toBe("rotate(-90deg)");
    $("#rotate_right").trigger("click");
    expect(rotate.style.transform).toBe("rotate(0deg)");

    section.getBoundingClientRect = () => ({ left: 0, top: 0 });
    const wheel = new dom.window.WheelEvent("wheel", {
      bubbles: true,
      cancelable: true,
      clientX: 0,
      clientY: 0,
      deltaY: -1,
    });
    section.dispatchEvent(wheel);
    expect(wheel.defaultPrevented).toBe(true);
    expect(transform.style.transform).toBe(
      "translate(0px, 0px) scale(1.1)",
    );

    $("#iv_header").trigger("click");
    expect(document.querySelector("#imageViewer")).toBe(root);
    $("#iv_close").trigger("click");
    expect(document.querySelector("#imageViewer")).toBeNull();
    expect(controller.opened).toBe(false);
  });

  it("replaces an open viewer and disposes every timer and listener with its route", () => {
    const {
      $,
      controller,
      dom,
      environment,
      intervalCallbacks,
      routeScope,
    } = createHarness();
    const document = dom.window.document;
    const firstRoot = controller.open("https://cdn.example/first.jpg", routeScope);
    const firstImage = firstRoot.querySelector("#iv_image");
    const firstTransform = firstRoot.querySelector("#iv_transform");

    expect(environment.setInterval).toHaveBeenLastCalledWith(
      expect.any(Function),
      100,
    );
    expect(intervalCallbacks.size).toBe(1);

    $(firstImage).trigger("load");
    firstImage.dispatchEvent(
      new dom.window.MouseEvent("click", {
        bubbles: true,
        cancelable: true,
      }),
    );
    $(firstImage).trigger($.Event("mousedown", { pageX: 10, pageY: 20 }));
    const firstTransformBeforeReplacement = firstTransform.style.transform;

    const secondRoot = controller.open(
      "https://cdn.example/second.jpg",
      routeScope,
    );
    expect(firstRoot.isConnected).toBe(false);
    expect(document.querySelectorAll("#imageViewer")).toHaveLength(1);
    expect(secondRoot.querySelector("#iv_image").getAttribute("src")).toBe(
      "https://cdn.example/second.jpg",
    );
    expect(environment.clearInterval).toHaveBeenCalledTimes(1);
    expect(intervalCallbacks.size).toBe(1);

    $(document).trigger($.Event("mousemove", { pageX: 100, pageY: 100 }));
    expect(firstTransform.style.transform).toBe(
      firstTransformBeforeReplacement,
    );

    expect(routeScope.dispose()).toEqual([]);
    expect(document.querySelector("#imageViewer")).toBeNull();
    expect(environment.clearInterval).toHaveBeenCalledTimes(2);
    expect(intervalCallbacks.size).toBe(0);
    expect(controller.opened).toBe(false);
    expect(controller.dispose()).toEqual([]);
    expect(controller.dispose()).toEqual([]);
    expect(environment.clearInterval).toHaveBeenCalledTimes(2);
  });
});
