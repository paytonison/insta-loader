import { describe, expect, it, vi } from "vitest";

import {
  RouteCoordinator,
  routePollIntervalFor,
} from "../../../src/core/route-coordinator.js";

function createController() {
  return {
    mount: vi.fn(),
    refresh: vi.fn(),
    dispose: vi.fn(),
  };
}

describe("RouteCoordinator", () => {
  it("mounts once per route, refreshes explicitly, and fully reloads", () => {
    const location = { href: "https://www.instagram.com/" };
    const intervals = [];
    const environment = {
      browser: { isSafari: false },
      getLocation: () => location,
      setInterval: vi.fn((callback) => {
        intervals.push(callback);
        return 7;
      }),
      clearInterval: vi.fn(),
      setTimeout,
      clearTimeout,
      requestAnimationFrame: vi.fn(() => 8),
      cancelAnimationFrame: vi.fn(),
      requestIdleCallback: (callback) => setTimeout(callback, 0),
      cancelIdleCallback: clearTimeout,
    };
    const controllers = [];
    const coordinator = new RouteCoordinator({
      environment,
      isReady: () => true,
      controllerFactory: () => {
        const controller = createController();
        controllers.push(controller);
        return controller;
      },
    });

    coordinator.start();
    intervals[0]();
    expect(controllers).toHaveLength(1);
    expect(controllers[0].mount).toHaveBeenCalledOnce();

    coordinator.refresh({ type: "mutation" });
    expect(controllers[0].refresh).toHaveBeenCalledWith({ type: "mutation" });

    location.href = "https://www.instagram.com/p/ABCde123/";
    intervals[0]();
    expect(controllers[0].dispose).toHaveBeenCalledOnce();
    expect(controllers).toHaveLength(2);

    coordinator.reload();
    expect(controllers[1].dispose).toHaveBeenCalledOnce();
    expect(controllers).toHaveLength(3);

    coordinator.dispose();
    coordinator.dispose();
    expect(controllers[2].dispose).toHaveBeenCalledOnce();
    expect(environment.clearInterval).toHaveBeenCalledWith(7);
  });

  it("retains the existing Safari and non-Safari polling intervals", () => {
    expect(routePollIntervalFor({ browser: { isSafari: true } })).toBe(750);
    expect(routePollIntervalFor({ browser: { isSafari: false } })).toBe(500);
  });

  it("can refresh a legacy controller on an unchanged compatibility poll", () => {
    const location = { href: "https://www.instagram.com/" };
    const intervals = [];
    const environment = {
      browser: { isSafari: false },
      getLocation: () => location,
      setInterval: (callback) => {
        intervals.push(callback);
        return 1;
      },
      clearInterval: vi.fn(),
      setTimeout,
      clearTimeout,
      requestAnimationFrame: vi.fn(),
      cancelAnimationFrame: vi.fn(),
      requestIdleCallback: vi.fn(),
      cancelIdleCallback: vi.fn(),
    };
    const controller = createController();
    const coordinator = new RouteCoordinator({
      environment,
      isReady: () => true,
      refreshOnUnchanged: true,
      controllerFactory: () => controller,
    });

    coordinator.start();
    intervals[0]();

    expect(controller.mount).toHaveBeenCalledOnce();
    expect(controller.refresh).toHaveBeenCalledWith({
      reason: "poll",
      route: coordinator.currentRoute,
      type: "route-poll",
    });
    coordinator.dispose();
  });
});
