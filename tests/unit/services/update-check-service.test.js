import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DisposableScope } from "../../../src/core/disposable-scope.js";
import {
  UPDATE_CHECK_REMOTE_SCRIPT_URL,
  UPDATE_NOTIFICATION_IMAGE_URL,
  UpdateCheckService,
} from "../../../src/services/update-check/index.js";

function resolvedRequest(value) {
  const request = Promise.resolve(value);
  request.abort = vi.fn();
  return request;
}

function rejectedRequest(error) {
  const request = Promise.reject(error);
  request.abort = vi.fn();
  return request;
}

function pendingRequest() {
  let rejectRequest;
  const request = new Promise((_resolve, reject) => {
    rejectRequest = reject;
  });
  request.abort = vi.fn(() => rejectRequest({ category: "abort" }));
  return request;
}

function createHarness(overrides = {}) {
  const tab = { close: vi.fn() };
  const environment = {
    now: vi.fn(() => 1_000),
    notify: vi.fn(),
    openInTab: vi.fn(() => tab),
    setTimeout: globalThis.setTimeout.bind(globalThis),
    clearTimeout: globalThis.clearTimeout.bind(globalThis),
    scriptInfo: {
      script: {
        version: "1.3.1",
        downloadURL:
          "https://github.com/paytonison/insta-loader/raw/main/insta-loader.user.js",
      },
    },
    window: {
      console: {
        error: vi.fn(),
      },
    },
    ...overrides.environment,
  };
  const preferencesStore = {
    getCheckTimestamp: vi.fn(() => 1_000),
    setCheckTimestamp: vi.fn(),
    ...overrides.preferencesStore,
  };
  const requestText =
    overrides.requestText ||
    vi.fn(() => resolvedRequest("// @version 1.3.1"));
  const translator =
    overrides.translator || vi.fn((key) => `translated:${key}`);
  const logger = overrides.logger || vi.fn();
  const service = new UpdateCheckService({
    environment,
    preferencesStore,
    requestText,
    translator,
    logger,
    getApplicationScope: overrides.getApplicationScope,
  });

  return {
    environment,
    logger,
    preferencesStore,
    requestText,
    service,
    tab,
    translator,
  };
}

describe("UpdateCheckService", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps update checks disabled without reading the timestamp", () => {
    const { environment, preferencesStore, requestText, service } =
      createHarness();

    service.checkIfDue(300, false);

    expect(preferencesStore.getCheckTimestamp).not.toHaveBeenCalled();
    expect(preferencesStore.setCheckTimestamp).not.toHaveBeenCalled();
    expect(environment.now).not.toHaveBeenCalled();
    expect(requestText).not.toHaveBeenCalled();
  });

  it("uses a strict 300-second boundary and writes before requesting", async () => {
    const equal = createHarness({
      environment: { now: vi.fn(() => 301_000) },
    });
    equal.service.checkIfDue(300, true);
    expect(equal.requestText).not.toHaveBeenCalled();
    expect(equal.preferencesStore.setCheckTimestamp).not.toHaveBeenCalled();

    const due = createHarness({
      environment: {
        now: vi
          .fn()
          .mockReturnValueOnce(301_001)
          .mockReturnValueOnce(301_002),
      },
    });
    due.service.checkIfDue(300, true);
    await Promise.resolve();

    expect(due.preferencesStore.getCheckTimestamp).toHaveBeenCalledOnce();
    expect(due.preferencesStore.setCheckTimestamp).toHaveBeenCalledWith(
      301_002,
    );
    expect(due.environment.now).toHaveBeenCalledTimes(2);
    expect(due.requestText).toHaveBeenCalledWith({
      url: UPDATE_CHECK_REMOTE_SCRIPT_URL,
    });
    expect(
      due.preferencesStore.setCheckTimestamp.mock.invocationCallOrder[0],
    ).toBeLessThan(due.requestText.mock.invocationCallOrder[0]);
  });

  it("retains nullish-store outcomes when the cadence is parsed", () => {
    for (const storedValue of [false, ""]) {
      const harness = createHarness({
        environment: { now: vi.fn(() => 999_999) },
        preferencesStore: {
          getCheckTimestamp: vi.fn(() => storedValue),
        },
      });
      harness.service.checkIfDue(300, true);
      expect(harness.requestText).not.toHaveBeenCalled();
    }

    const zero = createHarness({
      environment: {
        now: vi.fn().mockReturnValueOnce(300_001).mockReturnValueOnce(300_002),
      },
      preferencesStore: { getCheckTimestamp: vi.fn(() => 0) },
    });
    zero.service.checkIfDue(300, true);
    expect(zero.requestText).toHaveBeenCalledOnce();
  });

  it("logs equal versions without notifying", async () => {
    const { environment, logger, service } = createHarness();

    await service.notifyIfUpdateAvailable();

    expect(logger).toHaveBeenNthCalledWith(
      1,
      "Current version: ",
      "1.3.1",
      "|",
      "Remote version: ",
      "1.3.1",
    );
    expect(logger).toHaveBeenNthCalledWith(2, "there is no new update");
    expect(environment.notify).not.toHaveBeenCalled();
  });

  it("shows the unchanged notification and opens the installed download URL", async () => {
    const requestText = vi.fn(() =>
      resolvedRequest("// ==UserScript==\n//   @version   1.4.0-beta"),
    );
    const {
      environment,
      service,
      tab,
      translator,
    } = createHarness({ requestText });

    await service.notifyIfUpdateAvailable();

    expect(environment.notify).toHaveBeenCalledOnce();
    const notification = environment.notify.mock.calls[0][0];
    expect(notification).toMatchObject({
      text: "translated:NOTICE_UPDATE_CONTENT",
      title: "translated:NOTICE_UPDATE_TITLE",
      tag: "insta_loader_notice",
      highlight: true,
      timeout: 5000,
      zombieTimeout: 5000,
      image: UPDATE_NOTIFICATION_IMAGE_URL,
    });
    expect(translator.mock.calls).toEqual([
      ["NOTICE_UPDATE_CONTENT"],
      ["NOTICE_UPDATE_TITLE"],
    ]);

    const event = { preventDefault: vi.fn() };
    notification.onclick(event);
    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(environment.openInTab).toHaveBeenCalledWith(
      environment.scriptInfo.script.downloadURL,
    );
    expect(tab.close).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(249);
    expect(tab.close).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(tab.close).toHaveBeenCalledOnce();
  });

  it("reports malformed metadata without turning it into a request failure", async () => {
    const harness = createHarness({
      requestText: vi.fn(() => resolvedRequest("// no version here")),
    });

    await harness.service.notifyIfUpdateAvailable();

    expect(harness.environment.window.console.error).toHaveBeenCalledWith(
      "Could not find version in the remote script.",
    );
    expect(harness.logger).not.toHaveBeenCalled();
    expect(harness.environment.notify).not.toHaveBeenCalled();
  });

  it("fails open, logs ordinary errors, and suppresses abort logging", async () => {
    const networkError = { category: "network", message: "offline" };
    const failed = createHarness({
      requestText: vi.fn(() => rejectedRequest(networkError)),
    });
    await expect(
      failed.service.notifyIfUpdateAvailable(),
    ).resolves.toBeUndefined();
    expect(failed.logger).toHaveBeenCalledWith(
      "callNotification()",
      "reject",
      networkError,
    );

    const aborted = createHarness({
      requestText: vi.fn(() =>
        rejectedRequest({ category: "abort" }),
      ),
    });
    await expect(
      aborted.service.notifyIfUpdateAvailable(),
    ).resolves.toBeUndefined();
    expect(aborted.logger).not.toHaveBeenCalled();
  });

  it("aborts requests and close timers with the application scope", async () => {
    const request = pendingRequest();
    const harness = createHarness({
      requestText: vi.fn(() => request),
    });
    const scope = new DisposableScope(harness.environment);
    harness.service.mount(scope);

    const completion = harness.service.notifyIfUpdateAvailable();
    scope.dispose();

    expect(request.abort).toHaveBeenCalled();
    await expect(completion).resolves.toBeUndefined();
    expect(harness.logger).not.toHaveBeenCalled();

    const notificationHarness = createHarness({
      requestText: vi.fn(() => resolvedRequest("// @version 2.0.0")),
    });
    const notificationScope = new DisposableScope(
      notificationHarness.environment,
    );
    notificationHarness.service.mount(notificationScope);
    await notificationHarness.service.notifyIfUpdateAvailable();
    notificationHarness.environment.notify.mock.calls[0][0].onclick();

    notificationScope.dispose();
    await vi.advanceTimersByTimeAsync(250);
    expect(notificationHarness.tab.close).not.toHaveBeenCalled();
  });

  it("schedules a surviving notification click in the remounted application", async () => {
    let currentScope = null;
    const harness = createHarness({
      requestText: vi.fn(() => resolvedRequest("// @version 2.0.0")),
      getApplicationScope: () => currentScope,
    });
    const firstScope = new DisposableScope(harness.environment);
    currentScope = firstScope;
    await harness.service.notifyIfUpdateAvailable();
    firstScope.dispose();

    const secondScope = new DisposableScope(harness.environment);
    currentScope = secondScope;
    harness.environment.notify.mock.calls[0][0].onclick();
    secondScope.dispose();

    await vi.advanceTimersByTimeAsync(250);
    expect(harness.tab.close).not.toHaveBeenCalled();
  });
});
