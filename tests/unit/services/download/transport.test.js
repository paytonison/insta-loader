import { afterEach, describe, expect, it, vi } from "vitest";

import {
  DEFAULT_OBJECT_URL_REVOKE_DELAY,
  DownloadTransport,
  createDownloadTransport,
} from "../../../../src/services/download/transport.js";

function createDocument() {
  const link = {
    href: "",
    download: "",
    style: {},
    click: vi.fn(),
    remove: vi.fn(),
  };
  return {
    link,
    document: {
      body: { appendChild: vi.fn() },
      createElement: vi.fn(() => link),
    },
  };
}

function createDependencies(overrides = {}) {
  const { document, link } = createDocument();
  const urlApi = {
    createObjectURL: vi.fn(() => "blob:https://example.test/object-url"),
    revokeObjectURL: vi.fn(),
  };
  return {
    dependencies: {
      document,
      urlApi,
      setTimeout: globalThis.setTimeout,
      clearTimeout: globalThis.clearTimeout,
      ...overrides,
    },
    link,
    urlApi,
  };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("GM download transport", () => {
  it("resolves a successful callback-based GM_download", async () => {
    const gmDownload = vi.fn((details) => {
      details.onload();
      return { abort: vi.fn() };
    });
    const { dependencies } = createDependencies({ gmDownload });
    const transport = createDownloadTransport(dependencies);

    await expect(transport.downloadWithGm(
      "https://cdn.example.test/file.jpg",
      "file.jpg",
    )).resolves.toBe(true);
    expect(gmDownload).toHaveBeenCalledWith(expect.objectContaining({
      url: "https://cdn.example.test/file.jpg",
      name: "file.jpg",
      saveAs: false,
    }));
  });

  it("rejects when GM_download is unavailable or throws synchronously", async () => {
    const unavailable = new DownloadTransport(createDependencies().dependencies);
    await expect(unavailable.downloadWithGm("https://x.test/a", "a"))
      .rejects.toThrow("not available");

    const failure = new Error("GM bridge unavailable");
    const { dependencies } = createDependencies({
      gmDownload: vi.fn(() => { throw failure; }),
    });
    await expect(new DownloadTransport(dependencies).downloadWithGm(
      "https://x.test/a",
      "a",
    )).rejects.toBe(failure);
  });

  it.each(["onerror", "ontimeout"])(
    "rejects a GM_download %s callback failure",
    async (callback) => {
      const gmDownload = vi.fn((details) => {
        details[callback]({ error: `${callback} failure` });
      });
      const { dependencies } = createDependencies({ gmDownload });

      await expect(new DownloadTransport(dependencies).downloadWithGm(
        "https://x.test/a",
        "a",
      )).rejects.toThrow(`${callback} failure`);
    },
  );

  it("aborts and rejects when the GM_download deadline expires", async () => {
    vi.useFakeTimers();
    const abort = vi.fn();
    const gmDownload = vi.fn(() => ({ abort }));
    const { dependencies } = createDependencies({ gmDownload });
    const promise = new DownloadTransport(dependencies).downloadWithGm(
      "blob:https://example.test/media",
      "media.mp4",
      { timeout: 30_000 },
    );
    const assertion = expect(promise).rejects.toThrow("timed out");

    await vi.advanceTimersByTimeAsync(30_000);

    await assertion;
    expect(abort).toHaveBeenCalledOnce();
  });

  it("aborts a pending GM_download and clears its deadline with the operation signal", async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const abort = vi.fn();
    const gmDownload = vi.fn(() => ({ abort }));
    const { dependencies } = createDependencies({ gmDownload });
    const promise = new DownloadTransport(dependencies).downloadWithGm(
      "blob:https://example.test/media",
      "media.mp4",
      { signal: controller.signal, timeout: 30_000 },
    );
    const assertion = expect(promise).rejects.toMatchObject({
      name: "AbortError",
    });

    expect(vi.getTimerCount()).toBe(1);
    controller.abort();

    await assertion;
    expect(abort).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("Blob acquisition and fallback", () => {
  it("uses credentialed fetch for media blobs", async () => {
    const blob = new Blob(["image"], { type: "image/jpeg" });
    const fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      blob: async () => blob,
    }));
    const { dependencies } = createDependencies({ fetch });

    await expect(new DownloadTransport(dependencies).fetchMediaBlob(
      "https://cdn.example.test/image.jpg",
    )).resolves.toBe(blob);
    expect(fetch).toHaveBeenCalledWith(
      "https://cdn.example.test/image.jpg",
      { credentials: "include" },
    );
  });

  it("falls back from credentialed fetch to a GM blob request", async () => {
    const blob = new Blob(["video"], { type: "video/mp4" });
    const fetch = vi.fn(async () => { throw new Error("CORS"); });
    const gmRequest = vi.fn((details) => details.onload({
      status: 200,
      response: blob,
    }));
    const onFallback = vi.fn();
    const { dependencies } = createDependencies({
      fetch,
      gmRequest,
      onFallback,
    });

    await expect(new DownloadTransport(dependencies).fetchMediaBlob(
      "https://cdn.example.test/video.mp4",
    )).resolves.toBe(blob);
    expect(gmRequest).toHaveBeenCalledWith(expect.objectContaining({
      method: "GET",
      responseType: "blob",
    }));
    expect(onFallback).toHaveBeenCalledWith(
      expect.any(Error),
      { stage: "credentialed-fetch", fallback: "gm-request" },
    );
  });

  it("rejects unsuccessful GM response status", async () => {
    const gmRequest = vi.fn((details) => details.onload({
      status: 403,
      response: null,
    }));
    const { dependencies } = createDependencies({ gmRequest });

    await expect(new DownloadTransport(dependencies).fetchBlobWithGm(
      "https://cdn.example.test/blocked.jpg",
    )).rejects.toThrow("HTTP 403");
  });

  it("passes the operation signal to fetch and does not fail open after abort", async () => {
    const controller = new AbortController();
    const gmRequest = vi.fn();
    const fetch = vi.fn((_url, options) =>
      new Promise((_resolve, reject) => {
        options.signal.addEventListener("abort", () => {
          const error = new Error("fetch aborted");
          error.name = "AbortError";
          reject(error);
        });
      }));
    const { dependencies } = createDependencies({ fetch, gmRequest });
    const promise = new DownloadTransport(dependencies).fetchMediaBlob(
      "https://cdn.example.test/pending.jpg",
      { signal: controller.signal },
    );
    const assertion = expect(promise).rejects.toMatchObject({
      name: "AbortError",
    });

    controller.abort();

    await assertion;
    expect(fetch).toHaveBeenCalledWith(
      "https://cdn.example.test/pending.jpg",
      { credentials: "include", signal: controller.signal },
    );
    expect(gmRequest).not.toHaveBeenCalled();
  });

  it("aborts a pending GM blob request with the operation signal", async () => {
    const controller = new AbortController();
    const abort = vi.fn();
    const gmRequest = vi.fn(() => ({ abort }));
    const { dependencies } = createDependencies({ gmRequest });
    const promise = new DownloadTransport(dependencies).fetchBlobWithGm(
      "https://cdn.example.test/pending.jpg",
      { signal: controller.signal },
    );
    const assertion = expect(promise).rejects.toMatchObject({
      name: "AbortError",
    });

    controller.abort();

    await assertion;
    expect(abort).toHaveBeenCalledOnce();
  });
});

describe("direct, Blob URL, and anchor output", () => {
  it("finishes at direct GM_download without fetching", async () => {
    const gmDownload = vi.fn((details) => details.onload());
    const fetch = vi.fn();
    const { dependencies, urlApi } = createDependencies({ gmDownload, fetch });

    await expect(new DownloadTransport(dependencies).downloadUrl(
      "https://cdn.example.test/direct.jpg",
      "direct.jpg",
    )).resolves.toBe(true);
    expect(fetch).not.toHaveBeenCalled();
    expect(urlApi.createObjectURL).not.toHaveBeenCalled();
  });

  it("falls back after direct GM failure and revokes a successful GM Blob URL immediately", async () => {
    const blob = new Blob(["image"]);
    const gmDownload = vi.fn((details) => {
      if (gmDownload.mock.calls.length === 1) {
        details.onerror({ error: "direct failed" });
      } else {
        details.onload();
      }
      return { abort: vi.fn() };
    });
    const fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      blob: async () => blob,
    }));
    const { dependencies, urlApi } = createDependencies({ gmDownload, fetch });

    await expect(new DownloadTransport(dependencies).downloadUrl(
      "https://cdn.example.test/fallback.jpg",
      "fallback.jpg",
    )).resolves.toBe(true);
    expect(gmDownload).toHaveBeenCalledTimes(2);
    expect(urlApi.revokeObjectURL).toHaveBeenCalledWith(
      "blob:https://example.test/object-url",
    );
  });

  it("uses an anchor when GM is unavailable and revokes the URL after 60 seconds", async () => {
    vi.useFakeTimers();
    const { dependencies, link, urlApi } = createDependencies();
    const transport = new DownloadTransport(dependencies);
    const promise = transport.downloadBlob(new Blob(["image"]), "image.jpg");

    await vi.advanceTimersByTimeAsync(125);
    await expect(promise).resolves.toBe(true);

    expect(link.click).toHaveBeenCalledOnce();
    expect(link.remove).toHaveBeenCalledOnce();
    expect(urlApi.revokeObjectURL).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(DEFAULT_OBJECT_URL_REVOKE_DELAY - 1);
    expect(urlApi.revokeObjectURL).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(urlApi.revokeObjectURL).toHaveBeenCalledOnce();
  });

  it("revokes the object URL immediately if anchor output fails", async () => {
    const { dependencies, link, urlApi } = createDependencies();
    link.click.mockImplementation(() => { throw new Error("blocked"); });

    await expect(new DownloadTransport(dependencies).downloadBlob(
      new Blob(["image"]),
      "image.jpg",
    )).rejects.toThrow("blocked");
    expect(urlApi.revokeObjectURL).toHaveBeenCalledOnce();
  });

  it("cancels the anchor settle timer when the operation is aborted", async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const { dependencies, link } = createDependencies();
    const promise = new DownloadTransport(dependencies).triggerAnchorDownload(
      "blob:https://example.test/pending",
      "pending.jpg",
      { signal: controller.signal },
    );
    const assertion = expect(promise).rejects.toMatchObject({
      name: "AbortError",
    });

    expect(link.click).toHaveBeenCalledOnce();
    expect(link.remove).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(1);
    controller.abort();

    await assertion;
    expect(vi.getTimerCount()).toBe(0);
    expect(link.remove).toHaveBeenCalledOnce();
  });

  it("revokes an anchor Blob URL early and clears the 60-second timer on abort", async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const { dependencies, urlApi } = createDependencies();
    const promise = new DownloadTransport(dependencies).downloadBlob(
      new Blob(["image"]),
      "image.jpg",
      { signal: controller.signal },
    );

    await vi.advanceTimersByTimeAsync(125);
    await expect(promise).resolves.toBe(true);
    expect(urlApi.revokeObjectURL).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(1);

    controller.abort();

    expect(urlApi.revokeObjectURL).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
    await vi.advanceTimersByTimeAsync(DEFAULT_OBJECT_URL_REVOKE_DELAY);
    expect(urlApi.revokeObjectURL).toHaveBeenCalledOnce();
  });
});
