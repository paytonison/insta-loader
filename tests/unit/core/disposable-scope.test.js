import { describe, expect, it, vi } from "vitest";

import { DisposableScope } from "../../../src/core/disposable-scope.js";

function createEnvironment() {
  return {
    setTimeout: vi.fn(() => 11),
    clearTimeout: vi.fn(),
    setInterval: vi.fn(() => 12),
    clearInterval: vi.fn(),
    requestAnimationFrame: vi.fn(() => 13),
    cancelAnimationFrame: vi.fn(),
    requestIdleCallback: vi.fn(() => 14),
    cancelIdleCallback: vi.fn(),
  };
}

describe("DisposableScope", () => {
  it("owns browser resources and disposes them once in reverse order", () => {
    const environment = createEnvironment();
    const target = new EventTarget();
    const removeListener = vi.spyOn(target, "removeEventListener");
    const observer = { observe: vi.fn(), disconnect: vi.fn() };
    const request = { abort: vi.fn() };
    const listener = vi.fn();
    const scope = new DisposableScope(environment);

    scope.setTimeout(vi.fn(), 20);
    scope.setInterval(vi.fn(), 20);
    scope.requestAnimationFrame(vi.fn());
    scope.requestIdleCallback(vi.fn());
    scope.listen(target, "play", listener, true);
    scope.observe(observer, {}, { childList: true });
    scope.trackAbortable(request);

    expect(scope.dispose()).toEqual([]);
    expect(scope.dispose()).toEqual([]);
    expect(environment.clearTimeout).toHaveBeenCalledOnce();
    expect(environment.clearInterval).toHaveBeenCalledOnce();
    expect(environment.cancelAnimationFrame).toHaveBeenCalledOnce();
    expect(environment.cancelIdleCallback).toHaveBeenCalledOnce();
    expect(removeListener).toHaveBeenCalledWith("play", listener, true);
    expect(observer.disconnect).toHaveBeenCalledOnce();
    expect(request.abort).toHaveBeenCalledOnce();
  });

  it("continues cleanup after an error and disposes late resources immediately", () => {
    const errors = [];
    const order = [];
    const scope = new DisposableScope(createEnvironment(), {
      onError: (error) => errors.push(error.message),
    });
    scope.defer(() => order.push("first"));
    scope.defer(() => {
      throw new Error("broken cleanup");
    });
    scope.defer(() => order.push("last"));

    expect(scope.dispose()).toHaveLength(1);
    scope.defer(() => order.push("late"));

    expect(order).toEqual(["last", "first", "late"]);
    expect(errors).toEqual(["broken cleanup"]);
  });

  it("removes direct and delegated jQuery listeners with their exact registration", () => {
    const target = {
      on: vi.fn(),
      off: vi.fn(),
    };
    const directHandler = vi.fn();
    const delegatedHandler = vi.fn();
    const scope = new DisposableScope(createEnvironment());

    scope.listenJQuery(target, "keydown", directHandler);
    scope.listenJQuery(
      target,
      "click change",
      ".injected-control",
      delegatedHandler,
    );

    expect(target.on).toHaveBeenNthCalledWith(1, "keydown", directHandler);
    expect(target.on).toHaveBeenNthCalledWith(
      2,
      "click change",
      ".injected-control",
      delegatedHandler,
    );

    scope.dispose();

    expect(target.off).toHaveBeenNthCalledWith(
      1,
      "click change",
      ".injected-control",
      delegatedHandler,
    );
    expect(target.off).toHaveBeenNthCalledWith(2, "keydown", directHandler);
  });
});
