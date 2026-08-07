import jquery from "jquery";
import { JSDOM } from "jsdom";
import { describe, expect, it, vi } from "vitest";

import { ProfileController } from "../../../src/controllers/profile-controller.js";
import { DisposableScope } from "../../../src/core/disposable-scope.js";
import { normalizeProfileAvatar } from "../../../src/media/surface-normalizers.js";

const PROFILE_MARKUP = `
  <div id="mount_0">
    <header>
      <div class="profile-outer">
        <div class="profile-inner">
          <a href="/fixture_user/">
            <img alt="fixture_user profile picture" draggable="true"
              src="https://cdn.example.test/profile-small.jpg">
          </a>
        </div>
      </div>
    </header>
  </div>`;

function createHarness({ html = PROFILE_MARKUP, pathname } = {}) {
  const dom = new JSDOM(`<!doctype html><html><body>${html}</body></html>`, {
    url: `https://www.instagram.com${pathname || "/fixture_user/"}`,
  });
  const $ = jquery(dom.window);
  let nextHandle = 1;
  const timeoutCallbacks = new Map();
  const intervalCallbacks = new Map();
  const environment = {
    clearInterval: vi.fn((handle) => intervalCallbacks.delete(handle)),
    clearTimeout: vi.fn((handle) => timeoutCallbacks.delete(handle)),
    getDocument: () => dom.window.document,
    setInterval: vi.fn((callback) => {
      const handle = nextHandle++;
      intervalCallbacks.set(handle, callback);
      return handle;
    }),
    setTimeout: vi.fn((callback) => {
      const handle = nextHandle++;
      timeoutCallbacks.set(handle, callback);
      return handle;
    }),
  };
  const getUserInfo = vi.fn(async () => ({
    user: {
      id: "profile-user-id",
      pk: "profile-user-pk",
      profile_pic_url: "https://cdn.example.test/profile-small.jpg",
      profile_pic_url_hd: "https://cdn.example.test/profile-web-hd.jpg",
      username: "fixture_user",
    },
  }));
  const getHighResolutionProfile = vi.fn(async () =>
    "https://cdn.example.test/profile-api-hd.jpg"
  );
  const executeMediaDescriptor = vi.fn(async () => true);
  const setLoading = vi.fn();
  const logger = vi.fn();
  const onError = vi.fn();
  const controller = new ProfileController({
    $,
    downloadIcon: '<svg data-test-icon="download"></svg>',
    downloadIntent: "download",
    environment,
    executeMediaDescriptor,
    getDownloadTitle: () => "Download",
    getHighResolutionProfile,
    getLocation: () => dom.window.location,
    getUserInfo,
    logger,
    normalizeProfileAvatar,
    now: () => 1_800_000_001_000,
    onError,
    setLoading,
  });
  const routeScope = new DisposableScope(environment);

  return {
    $,
    controller,
    dom,
    environment,
    executeMediaDescriptor,
    getHighResolutionProfile,
    getUserInfo,
    intervalCallbacks,
    logger,
    onError,
    routeScope,
    setLoading,
    timeoutCallbacks,
    runTimeouts() {
      [...timeoutCallbacks.values()].forEach((callback) => callback());
    },
    runIntervals() {
      [...intervalCallbacks.values()].forEach((callback) => callback());
    },
  };
}

async function flushMicrotasks(rounds = 8) {
  for (let index = 0; index < rounds; index += 1) {
    await Promise.resolve();
  }
}

describe("ProfileController lifecycle", () => {
  it("mounts the exact legacy control once after the two 150 ms discovery stages", () => {
    const harness = createHarness();
    const {
      controller,
      dom,
      environment,
      intervalCallbacks,
      routeScope,
      timeoutCallbacks,
    } = harness;

    expect(controller.mount({ scope: routeScope })).toBe(true);
    expect(controller.mount({ scope: routeScope })).toBe(false);
    expect(controller.refresh({ type: "poll" })).toBe(true);
    expect(environment.setTimeout).toHaveBeenCalledOnce();
    expect(environment.setTimeout).toHaveBeenCalledWith(expect.any(Function), 150);
    expect(timeoutCallbacks).toHaveLength(1);
    expect(dom.window.document.querySelector(".IG_DWPROFILE")).toBeNull();

    harness.runTimeouts();
    expect(environment.setInterval).toHaveBeenCalledOnce();
    expect(environment.setInterval).toHaveBeenCalledWith(
      expect.any(Function),
      150,
    );
    expect(intervalCallbacks).toHaveLength(1);

    harness.runIntervals();
    const control = dom.window.document.querySelector(".IG_DWPROFILE");
    expect(control).not.toBeNull();
    expect(control.getAttribute("data-ih-locale-title")).toBe("DW");
    expect(control.getAttribute("title")).toBe("Download");
    expect(control.querySelector('svg[data-test-icon="download"]')).not.toBeNull();
    expect(control.parentElement.className).toBe("profile-inner");
    expect(control.parentElement.style.position).toBe("relative");

    controller.refresh({ type: "repeat" });
    harness.runIntervals();
    expect(dom.window.document.querySelectorAll(".IG_DWPROFILE")).toHaveLength(1);
    expect(intervalCallbacks).toHaveLength(0);
  });

  it("discovers a profile header that appears after mount", () => {
    const harness = createHarness({ html: '<div id="mount_0"></div>' });
    const { controller, dom, environment, routeScope } = harness;

    expect(controller.mount({ scope: routeScope })).toBe(true);
    expect(controller.refresh({ type: "empty" })).toBe(false);
    expect(environment.setTimeout).not.toHaveBeenCalled();

    dom.window.document.querySelector("#mount_0").innerHTML = PROFILE_MARKUP;
    expect(controller.refresh({ type: "mutation" })).toBe(true);
    expect(environment.setTimeout).toHaveBeenCalledOnce();
    harness.runTimeouts();
    harness.runIntervals();
    expect(dom.window.document.querySelectorAll(".IG_DWPROFILE")).toHaveLength(1);
  });

  it("retains the non-draggable avatar parent traversal", () => {
    const harness = createHarness({
      html: PROFILE_MARKUP.replace(' draggable="true"', ""),
    });
    const { controller, dom, routeScope } = harness;

    controller.mount({ scope: routeScope });
    harness.runTimeouts();
    harness.runIntervals();

    const control = dom.window.document.querySelector(".IG_DWPROFILE");
    expect(control.parentElement.className).toBe("profile-outer");
    expect(control.parentElement.style.position).toBe("relative");
  });

  it("removes controls, timers, and delegated actions exactly once", async () => {
    let resolveUser;
    const harness = createHarness();
    const {
      controller,
      dom,
      executeMediaDescriptor,
      getHighResolutionProfile,
      getUserInfo,
      routeScope,
      setLoading,
    } = harness;
    getUserInfo.mockImplementation(() =>
      new Promise((resolve) => {
        resolveUser = resolve;
      })
    );

    controller.mount({ scope: routeScope });
    harness.runTimeouts();
    harness.runIntervals();
    dom.window.document.querySelector(".IG_DWPROFILE").dispatchEvent(
      new dom.window.MouseEvent("click", { bubbles: true }),
    );
    await flushMicrotasks();
    expect(setLoading).toHaveBeenLastCalledWith(true);

    expect(controller.dispose()).toEqual([]);
    expect(controller.dispose()).toEqual([]);
    expect(setLoading).toHaveBeenLastCalledWith(false);
    expect(dom.window.document.querySelector(".IG_DWPROFILE")).toBeNull();

    resolveUser({
      user: {
        id: "late-id",
        pk: "late-pk",
        profile_pic_url: "https://cdn.example.test/late.jpg",
      },
    });
    await flushMicrotasks();
    expect(getHighResolutionProfile).not.toHaveBeenCalled();
    expect(executeMediaDescriptor).not.toHaveBeenCalled();

    dom.window.document.body.insertAdjacentHTML(
      "beforeend",
      '<button class="IG_DWPROFILE">late</button>',
    );
    dom.window.document.querySelector(".IG_DWPROFILE").dispatchEvent(
      new dom.window.MouseEvent("click", { bubbles: true }),
    );
    await flushMicrotasks();
    expect(getUserInfo).toHaveBeenCalledOnce();
  });
});

describe("ProfileController avatar actions", () => {
  it("normalizes the high-resolution response and executes with legacy filename policy", async () => {
    const harness = createHarness({ pathname: "/fixture_user/tagged/" });
    const {
      controller,
      dom,
      executeMediaDescriptor,
      getHighResolutionProfile,
      getUserInfo,
      routeScope,
      setLoading,
    } = harness;
    const documentClick = vi.fn();
    dom.window.document.addEventListener("click", documentClick);

    controller.mount({ scope: routeScope });
    harness.runTimeouts();
    harness.runIntervals();
    dom.window.document.querySelector(".IG_DWPROFILE").dispatchEvent(
      new dom.window.MouseEvent("click", { bubbles: true }),
    );
    await flushMicrotasks();

    expect(documentClick).not.toHaveBeenCalled();
    expect(getUserInfo).toHaveBeenCalledWith("fixture_user");
    expect(getHighResolutionProfile).toHaveBeenCalledWith("profile-user-pk");
    expect(executeMediaDescriptor).toHaveBeenCalledWith(
      expect.objectContaining({
        directUrl: "https://cdn.example.test/profile-api-hd.jpg",
        mediaId: "profile-user-pk",
        owner: "fixture_user",
        publishTime: 1_800_000_001,
        sourceType: "avatar",
      }),
      "download",
      {
        includeIndex: false,
        uid: "profile-user-id",
        useDash: false,
        useImageCache: false,
        useMediaApi: false,
      },
    );
    expect(setLoading.mock.calls).toEqual([[true], [false]]);
  });

  it("falls back to the web-profile HD URL when the separate request fails", async () => {
    const harness = createHarness();
    const {
      controller,
      executeMediaDescriptor,
      getHighResolutionProfile,
      logger,
      routeScope,
    } = harness;
    getHighResolutionProfile.mockRejectedValue(new Error("high-res failed"));

    controller.mount({ scope: routeScope });
    await controller.downloadAvatar();

    expect(executeMediaDescriptor).toHaveBeenCalledWith(
      expect.objectContaining({
        directUrl: "https://cdn.example.test/profile-web-hd.jpg",
      }),
      "download",
      expect.any(Object),
    );
    expect(logger).toHaveBeenCalledWith(
      "ProfileController",
      "high-resolution fallback",
      "high-res failed",
    );
  });
});
