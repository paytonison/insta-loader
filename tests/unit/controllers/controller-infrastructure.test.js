import { describe, expect, it, vi } from "vitest";

import {
  FEATURE_CONTROLLER_NAME,
  InjectedFeatureController,
  createApplicationCoordinator,
  createRouteControllerFactory,
} from "../../../src/controllers/index.js";
import { DisposableScope } from "../../../src/core/disposable-scope.js";
import { ROUTE_KIND } from "../../../src/core/routes.js";

function createEnvironment(initialHref = "https://www.instagram.com/") {
  const location = { href: initialHref };
  let nextHandle = 1;
  const intervalCallbacks = new Map();
  return {
    browser: { isSafari: false },
    cancelAnimationFrame: vi.fn(),
    cancelIdleCallback: vi.fn(),
    clearInterval: vi.fn((handle) => intervalCallbacks.delete(handle)),
    clearTimeout: vi.fn(),
    getDocument: () => ({ body: {} }),
    getLocation: () => location,
    intervalCallbacks,
    location,
    requestAnimationFrame: vi.fn(() => nextHandle++),
    requestIdleCallback: vi.fn(() => nextHandle++),
    setInterval: vi.fn((callback) => {
      const handle = nextHandle++;
      intervalCallbacks.set(handle, callback);
      return handle;
    }),
    setTimeout: vi.fn(() => nextHandle++),
  };
}

function routeContext(environment, kind = ROUTE_KIND.POST) {
  return {
    environment,
    previousRoute: null,
    reason: "test",
    route: { href: environment.getLocation().href, kind },
    scope: new DisposableScope(environment),
  };
}

describe("InjectedFeatureController", () => {
  it("mounts and disposes once while adopting scoped resources", () => {
    const environment = createEnvironment();
    const cleanup = vi.fn();
    const adapter = {
      mount: vi.fn((context) => {
        context.scope.setInterval(vi.fn(), 25);
        return cleanup;
      }),
      refresh: vi.fn(),
      dispose: vi.fn(),
    };
    const controller = new InjectedFeatureController({
      adapter,
      environment,
      name: "fixture",
    });
    const context = routeContext(environment);

    expect(controller.mount(context)).toBe(true);
    expect(controller.mount(context)).toBe(false);
    expect(adapter.mount).toHaveBeenCalledOnce();
    expect(controller.refresh({ type: "mutation" })).toBeUndefined();
    expect(adapter.refresh).toHaveBeenCalledOnce();

    expect(controller.dispose()).toEqual([]);
    expect(controller.dispose()).toEqual([]);
    expect(adapter.dispose).toHaveBeenCalledOnce();
    expect(cleanup).toHaveBeenCalledOnce();
    expect(environment.clearInterval).toHaveBeenCalledOnce();
    expect(controller.refresh({ type: "late" })).toBe(false);
  });

  it("immediately releases an asynchronous mount result after disposal", async () => {
    const environment = createEnvironment();
    const resource = { dispose: vi.fn() };
    let resolveMount;
    const controller = new InjectedFeatureController({
      adapter: {
        mount: () =>
          new Promise((resolve) => {
            resolveMount = resolve;
          }),
      },
      environment,
      name: "async-fixture",
    });

    const mounting = controller.mount(routeContext(environment));
    controller.dispose();
    resolveMount(resource);

    await expect(mounting).resolves.toBe(true);
    expect(resource.dispose).toHaveBeenCalledOnce();
  });
});

describe("route controller adapters", () => {
  it.each([
    [ROUTE_KIND.FEED, "posts", FEATURE_CONTROLLER_NAME.POSTS],
    [ROUTE_KIND.POST, "posts", FEATURE_CONTROLLER_NAME.POSTS],
    [ROUTE_KIND.STORY, "stories", FEATURE_CONTROLLER_NAME.STORIES],
    [ROUTE_KIND.HIGHLIGHT, "highlights", FEATURE_CONTROLLER_NAME.HIGHLIGHTS],
    [
      ROUTE_KIND.REEL,
      "reelControls",
      FEATURE_CONTROLLER_NAME.SINGULAR_REEL_CONTROLS,
    ],
    [
      ROUTE_KIND.REELS,
      "reelsControls",
      FEATURE_CONTROLLER_NAME.REELS_CONTROLS,
    ],
    [ROUTE_KIND.PROFILE, "profiles", FEATURE_CONTROLLER_NAME.PROFILES],
  ])("maps %s to the %s adapter", (kind, adapterName, expectedName) => {
    const environment = createEnvironment();
    const adapter = {
      mount: vi.fn(),
      refresh: vi.fn(),
      dispose: vi.fn(),
    };
    const factory = createRouteControllerFactory({
      adapters: { [adapterName]: adapter },
      environment,
    });

    const controllers = factory({ kind });

    expect(controllers).toHaveLength(1);
    expect(controllers[0].name).toBe(expectedName);
    controllers[0].mount(routeContext(environment, kind));
    controllers[0].refresh({ type: "route-poll" });
    controllers[0].dispose();

    expect(adapter.mount).toHaveBeenCalledWith(
      expect.objectContaining({ featureName: expectedName }),
    );
    expect(adapter.refresh).toHaveBeenCalledWith(
      { type: "route-poll" },
      expect.objectContaining({ featureName: expectedName }),
    );
    expect(adapter.dispose).toHaveBeenCalledWith(
      expect.objectContaining({ featureName: expectedName }),
    );
  });

  it("never creates singular-Reel controls for the plural Reels feed", () => {
    const factory = createRouteControllerFactory({
      adapters: { reelControls: { mount: vi.fn() } },
      environment: createEnvironment(),
    });

    expect(factory({ kind: ROUTE_KIND.REELS })).toEqual([]);
  });
});

describe("ApplicationCoordinator", () => {
  it("prevents duplicates and fully recycles application and route scopes", () => {
    const environment = createEnvironment(
      "https://www.instagram.com/p/Post12345/",
    );
    const routeEvents = [];
    const activeApplicationListeners = new Set();
    const applicationTarget = {
      addEventListener: vi.fn((_type, listener) => {
        activeApplicationListeners.add(listener);
      }),
      removeEventListener: vi.fn((_type, listener) => {
        activeApplicationListeners.delete(listener);
      }),
    };
    const applicationAbortables = [];
    let applicationServiceMounts = 0;
    const settings = {
      mount: vi.fn(),
      refresh: vi.fn(),
      dispose: vi.fn(),
    };
    let postMounts = 0;
    let storyMounts = 0;
    const postAdapter = {
      mount(context) {
        postMounts += 1;
        routeEvents.push("post:mount");
        context.scope.setInterval(vi.fn(), 10);
        context.scope.trackAbortable({
          abort: () => routeEvents.push("post:abort"),
        });
        return () => routeEvents.push("post:cleanup");
      },
      dispose: () => routeEvents.push("post:dispose"),
    };
    const storyAdapter = {
      mount(context) {
        storyMounts += 1;
        routeEvents.push("story:mount");
        routeEvents.push(`story:reason:${context.reason}`);
        context.scope.trackAbortable({
          abort: () => routeEvents.push("story:abort"),
        });
      },
      refresh: (_change, context) =>
        routeEvents.push(`${context.featureName}:refresh`),
      dispose: () => routeEvents.push("story:dispose"),
    };
    const coordinator = createApplicationCoordinator({
      environment,
      isReady: () => true,
      routeAdapters: {
        posts: postAdapter,
        stories: storyAdapter,
      },
      settingsAdapter: settings,
      globalServiceAdapters: [
        {
          name: "application-events",
          adapter: {
            mount(context) {
              applicationServiceMounts += 1;
              const abortable = { abort: vi.fn() };
              applicationAbortables.push(abortable);
              context.scope.trackAbortable(abortable);
              context.scope.listen(
                applicationTarget,
                "fixture-event",
                vi.fn(),
              );
              context.scope.setTimeout(vi.fn(), 25);
            },
          },
        },
      ],
    });

    expect(coordinator.start()).toBe(true);
    expect(coordinator.start()).toBe(false);
    expect(environment.setInterval).toHaveBeenCalledTimes(2);
    expect(settings.mount).toHaveBeenCalledOnce();
    expect(postMounts).toBe(1);
    expect(applicationServiceMounts).toBe(1);
    expect(activeApplicationListeners.size).toBe(1);

    const poll = environment.setInterval.mock.calls[1][0];
    poll();
    expect(postMounts).toBe(1);

    environment.location.href =
      "https://www.instagram.com/stories/fixture_user/Story123/";
    poll();

    expect(postMounts).toBe(1);
    expect(storyMounts).toBe(1);
    expect(routeEvents).toEqual(
      expect.arrayContaining([
        "post:dispose",
        "post:abort",
        "post:cleanup",
        "story:mount",
      ]),
    );

    coordinator.refresh({ type: "mutation" });
    expect(settings.refresh).toHaveBeenCalledWith(
      { type: "mutation" },
      expect.objectContaining({ featureName: FEATURE_CONTROLLER_NAME.SETTINGS }),
    );
    expect(routeEvents).toContain("stories:refresh");

    coordinator.reload("manual-reload");
    expect(storyMounts).toBe(2);
    expect(settings.dispose).toHaveBeenCalledOnce();
    expect(settings.mount).toHaveBeenCalledTimes(2);
    expect(settings.refresh).toHaveBeenCalledTimes(1);
    expect(applicationServiceMounts).toBe(2);
    expect(routeEvents).toContain("story:reason:manual-reload");
    expect(applicationAbortables[0].abort).toHaveBeenCalledOnce();
    expect(applicationAbortables[1].abort).not.toHaveBeenCalled();
    expect(applicationTarget.removeEventListener).toHaveBeenCalledOnce();
    expect(applicationTarget.addEventListener).toHaveBeenCalledTimes(2);
    expect(activeApplicationListeners.size).toBe(1);
    expect(environment.clearTimeout).toHaveBeenCalledOnce();
    expect(coordinator.currentRoute).toEqual(
      expect.objectContaining({ kind: ROUTE_KIND.STORY }),
    );

    coordinator.dispose();
    coordinator.dispose();
    expect(settings.dispose).toHaveBeenCalledTimes(2);
    expect(applicationAbortables[1].abort).toHaveBeenCalledOnce();
    expect(applicationTarget.removeEventListener).toHaveBeenCalledTimes(2);
    expect(activeApplicationListeners.size).toBe(0);
    expect(routeEvents.filter((event) => event === "story:dispose")).toHaveLength(2);
    expect(environment.clearInterval).toHaveBeenCalled();
  });
});
