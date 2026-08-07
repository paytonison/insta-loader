import { describe, expect, it, vi } from "vitest";

import {
  REQUEST_ERROR_CATEGORY,
  RequestError,
  requestJson,
  requestText,
} from "../../../src/core/request.js";

function responseRequest(response) {
  return vi.fn((details) => {
    queueMicrotask(() => details.onload(response));
    return { abort: vi.fn() };
  });
}

describe("requestJson", () => {
  it("returns parsed JSON and surfaces the GM handle", async () => {
    const handle = { abort: vi.fn() };
    const request = vi.fn((details) => {
      queueMicrotask(() =>
        details.onload({ status: 200, responseText: '{"ok":true}' }),
      );
      return handle;
    });
    const task = requestJson({ request }, { url: "https://example.test/api" });

    await expect(task.promise).resolves.toEqual({ ok: true });
    expect(task.handle).toBe(handle);
  });

  it.each([
    [
      { status: 429, responseText: "{}" },
      REQUEST_ERROR_CATEGORY.RATE_LIMIT,
    ],
    [{ status: 500, responseText: "{}" }, REQUEST_ERROR_CATEGORY.HTTP],
    [
      {
        status: 200,
        finalUrl: "https://www.instagram.com/accounts/login/",
        responseText: "{}",
      },
      REQUEST_ERROR_CATEGORY.LOGIN,
    ],
    [
      { status: 200, responseText: "<html>login</html>" },
      REQUEST_ERROR_CATEGORY.PARSE,
    ],
    [
      { status: 200, responseText: "not json" },
      REQUEST_ERROR_CATEGORY.PARSE,
    ],
    [
      {
        status: 200,
        responseText: '{"status":"fail","message":"bad request"}',
      },
      REQUEST_ERROR_CATEGORY.API,
    ],
    [
      {
        status: 200,
        responseText:
          '{"errors":[{"message":"Please wait, rate limit reached"}]}',
      },
      REQUEST_ERROR_CATEGORY.RATE_LIMIT,
    ],
  ])("classifies response failures as %s", async (response, category) => {
    const task = requestJson(
      { request: responseRequest(response) },
      { url: "https://example.test/api" },
    );

    await expect(task.promise).rejects.toMatchObject({
      name: "RequestError",
      category,
    });
  });

  it("classifies network, timeout, and explicit cancellation separately", async () => {
    const networkTask = requestJson(
      {
        request(details) {
          queueMicrotask(() => details.onerror({ error: "offline" }));
          return { abort: vi.fn() };
        },
      },
      { url: "https://example.test/network" },
    );
    const timeoutTask = requestJson(
      {
        request(details) {
          queueMicrotask(() => details.ontimeout());
          return { abort: vi.fn() };
        },
      },
      { url: "https://example.test/timeout", timeout: 10 },
    );
    const handle = { abort: vi.fn() };
    const abortTask = requestJson(
      { request: () => handle },
      { url: "https://example.test/abort" },
    );
    abortTask.abort();

    await expect(networkTask).rejects.toMatchObject({ category: "network" });
    await expect(timeoutTask).rejects.toMatchObject({ category: "timeout" });
    await expect(abortTask).rejects.toMatchObject({ category: "abort" });
    expect(handle.abort).toHaveBeenCalledOnce();
  });

  it("rejects unknown RequestError categories", () => {
    expect(() => new RequestError("reel-specific", "nope")).toThrow(
      RangeError,
    );
  });
});

describe("requestText", () => {
  it("returns text without attempting JSON parsing", async () => {
    const task = requestText(
      {
        request: responseRequest({
          status: 200,
          responseText: "// ==UserScript==\n// @version 1.2.3",
        }),
      },
      { url: "https://example.test/script.user.js" },
    );

    await expect(task).resolves.toContain("@version 1.2.3");
  });

  it.each([
    [{ status: 429, responseText: "slow down" }, "rate-limit"],
    [{ status: 503, responseText: "unavailable" }, "http"],
    [
      {
        status: 200,
        finalUrl: "https://www.instagram.com/accounts/login/",
        responseText: "login",
      },
      "login",
    ],
  ])("classifies text response failures", async (response, category) => {
    const task = requestText(
      { request: responseRequest(response) },
      { url: "https://example.test/script.user.js" },
    );

    await expect(task).rejects.toMatchObject({ category });
  });

  it("is explicitly abortable", async () => {
    const handle = { abort: vi.fn() };
    const task = requestText(
      { request: () => handle },
      { url: "https://example.test/script.user.js" },
    );

    task.abort();

    await expect(task).rejects.toMatchObject({ category: "abort" });
    expect(handle.abort).toHaveBeenCalledOnce();
  });
});
