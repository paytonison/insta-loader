// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApplicationDomLifecycleService } from "../../../src/controllers/application-dom-lifecycle-service.js";
import { DisposableScope } from "../../../src/core/disposable-scope.js";

class FakeMutationObserver {
  static instances = [];

  constructor(callback) {
    this.callback = callback;
    this.disconnect = vi.fn();
    this.observe = vi.fn();
    FakeMutationObserver.instances.push(this);
  }

  emit(records) {
    this.callback(records, this);
  }
}

function createEnvironment() {
  return {
    window: { MutationObserver: FakeMutationObserver },
    clearInterval: vi.fn(),
    clearTimeout: vi.fn(),
    getDocument: () => document,
    setInterval: vi.fn(),
    setTimeout: vi.fn(),
  };
}

describe("ApplicationDomLifecycleService", () => {
  beforeEach(() => {
    FakeMutationObserver.instances.length = 0;
    document.documentElement.innerHTML = "<head></head><body></body>";
  });

  it("owns and disconnects both application-lifetime observers", () => {
    document.body.innerHTML = '<div id="mount_0"></div>';
    const environment = createEnvironment();
    const parentScope = new DisposableScope(environment);
    const performanceObserver = { disconnect: vi.fn() };
    const service = new ApplicationDomLifecycleService({
      environment,
      findMountRoot: () => document.querySelector('div[id^="mount"]'),
      registerPerformanceObserver: () => performanceObserver,
    });

    expect(service.mount(parentScope)).toBe(true);
    expect(service.mount(parentScope)).toBe(false);
    expect(FakeMutationObserver.instances).toHaveLength(1);
    expect(FakeMutationObserver.instances[0].observe).toHaveBeenCalledWith(
      document.querySelector("#mount_0"),
      { childList: true, subtree: true },
    );

    parentScope.dispose();

    expect(performanceObserver.disconnect).toHaveBeenCalledOnce();
    expect(FakeMutationObserver.instances[0].disconnect).toHaveBeenCalled();
  });

  it("waits safely for a missing mount root and scans it when discovered", () => {
    const environment = createEnvironment();
    const onAddedNode = vi.fn();
    const onMountScan = vi.fn();
    const service = new ApplicationDomLifecycleService({
      environment,
      findMountRoot: () => document.querySelector('div[id^="mount"]'),
      onAddedNode,
      onMountScan,
    });

    expect(() =>
      service.mount(new DisposableScope(environment)),
    ).not.toThrow();
    const observer = FakeMutationObserver.instances[0];
    expect(observer.observe).toHaveBeenCalledWith(document.documentElement, {
      childList: true,
      subtree: true,
    });
    expect(onMountScan).not.toHaveBeenCalled();

    const root = document.createElement("div");
    root.id = "mount_0";
    document.body.append(root);
    observer.emit([
      {
        addedNodes: [root],
        type: "childList",
      },
    ]);

    expect(observer.observe).toHaveBeenLastCalledWith(root, {
      childList: true,
      subtree: true,
    });
    expect(onMountScan).toHaveBeenCalledWith(root, {
      reason: "mount-root-discovered",
      type: "mount",
    });
    expect(onAddedNode).not.toHaveBeenCalled();
  });

  it("forwards in-mount additions and synchronously rescans on reload", () => {
    document.body.innerHTML = '<div id="mount_0"><video></video></div>';
    const environment = createEnvironment();
    const root = document.querySelector("#mount_0");
    const onAddedNode = vi.fn();
    const onMountScan = vi.fn();
    const service = new ApplicationDomLifecycleService({
      environment,
      findMountRoot: () => root,
      onAddedNode,
      onMountScan,
    });
    service.mount(new DisposableScope(environment));
    onMountScan.mockClear();

    const added = document.createElement("section");
    root.append(added);
    FakeMutationObserver.instances[0].emit([
      { addedNodes: [added], type: "childList" },
    ]);

    expect(onAddedNode).toHaveBeenCalledOnce();
    expect(onAddedNode).toHaveBeenCalledWith(added, root);

    const change = { reason: "manual-reload", type: "reload" };
    expect(service.refresh(change)).toBe(true);
    expect(onMountScan).toHaveBeenCalledWith(root, change);
  });
});
