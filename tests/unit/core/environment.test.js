import { describe, expect, it, vi } from "vitest";

import {
  createUserscriptEnvironment,
  isSafariUserAgent,
} from "../../../src/core/environment.js";

describe("UserscriptEnvironment", () => {
  it("detects Safari without treating iOS Chrome or Firefox as Safari", () => {
    expect(
      isSafariUserAgent(
        "Mozilla/5.0 (Macintosh) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15",
      ),
    ).toBe(true);
    expect(
      isSafariUserAgent(
        "Mozilla/5.0 (iPhone) AppleWebKit/605.1.15 CriOS/126 Mobile Safari/604.1",
      ),
    ).toBe(false);
  });

  it("wraps injected GM and browser dependencies without requiring globals", () => {
    const getValue = vi.fn(() => false);
    const setValue = vi.fn();
    const request = vi.fn();
    const location = { href: "https://www.instagram.com/" };
    const window = {
      document: { body: {} },
      location,
      navigator: { userAgent: "Test Browser" },
      setTimeout,
      clearTimeout,
      setInterval,
      clearInterval,
    };
    const environment = createUserscriptEnvironment({
      window,
      getValue,
      setValue,
      request,
      now: () => 42,
    });

    expect(environment.getValue("AUTO_RENAME")).toBe(false);
    environment.setValue("AUTO_RENAME", true);
    environment.request({ url: "https://example.test" });
    expect(setValue).toHaveBeenCalledWith("AUTO_RENAME", true);
    expect(request).toHaveBeenCalledOnce();
    expect(environment.getLocation()).toBe(location);
    expect(environment.now()).toBe(42);
    expect(environment.browser.isSafari).toBe(false);
    expect(environment.browser.supports("requestIdleCallback")).toBe(false);
  });
});
