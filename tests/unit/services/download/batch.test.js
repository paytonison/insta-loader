import { describe, expect, it, vi } from "vitest";

import {
  DEFAULT_DOWNLOAD_BATCH_POLICY,
  SAFARI_DOWNLOAD_BATCH_POLICY,
  getDownloadBatchPolicy,
  runDownloadBatch,
} from "../../../../src/services/download/batch.js";

describe("download batch policy", () => {
  it("uses the current Safari and non-Safari limits", () => {
    expect(getDownloadBatchPolicy(true)).toEqual({
      batchSize: 2,
      batchDelay: 700,
    });
    expect(getDownloadBatchPolicy(false)).toEqual({
      batchSize: 5,
      batchDelay: 350,
    });
    expect(SAFARI_DOWNLOAD_BATCH_POLICY.batchSize).toBe(2);
    expect(DEFAULT_DOWNLOAD_BATCH_POLICY.batchSize).toBe(5);
  });

  it("does not emit progress or delays for an empty batch", async () => {
    const download = vi.fn();
    const onProgress = vi.fn();
    const sleep = vi.fn();

    await expect(runDownloadBatch([], download, {
      onProgress,
      sleep,
    })).resolves.toEqual({ total: 0, completed: 0, failures: [] });
    expect(download).not.toHaveBeenCalled();
    expect(onProgress).not.toHaveBeenCalled();
    expect(sleep).not.toHaveBeenCalled();
  });

  it("runs Safari downloads two at a time with a 700ms inter-batch delay", async () => {
    const calls = [];
    const sleep = vi.fn(async (delay) => calls.push(`sleep:${delay}`));
    const download = vi.fn(async (item) => calls.push(`download:${item}`));

    const result = await runDownloadBatch(["a", "b", "c"], download, {
      isSafari: true,
      sleep,
    });

    expect(calls).toEqual([
      "download:a",
      "download:b",
      "sleep:700",
      "download:c",
    ]);
    expect(result).toEqual({ total: 3, completed: 3, failures: [] });
  });

  it("runs non-Safari downloads five at a time with a 350ms delay", async () => {
    const sleep = vi.fn(async () => {});
    const download = vi.fn(async () => true);

    await runDownloadBatch([0, 1, 2, 3, 4, 5], download, { sleep });

    expect(download).toHaveBeenCalledTimes(6);
    expect(sleep).toHaveBeenCalledOnce();
    expect(sleep).toHaveBeenCalledWith(350);
  });
});

describe("download batch progress and failures", () => {
  it("reports initial and per-item progress through successful batches", async () => {
    const progress = [];

    await runDownloadBatch(["a", "b", "c"], async () => true, {
      batchSize: 2,
      batchDelay: 0,
      sleep: async () => {},
      onProgress: (completed, total) => progress.push([completed, total]),
    });

    expect(progress).toEqual([
      [0, 3],
      [1, 3],
      [2, 3],
      [3, 3],
    ]);
  });

  it("records a rejected item, reports it, and completes later items", async () => {
    const failure = new Error("item b failed");
    const onError = vi.fn();
    const progress = [];
    const download = vi.fn(async (item) => {
      if (item === "b") throw failure;
      return true;
    });

    const result = await runDownloadBatch(["a", "b", "c"], download, {
      batchSize: 2,
      batchDelay: 0,
      sleep: async () => {},
      onError,
      onProgress: (completed) => progress.push(completed),
    });

    expect(download).toHaveBeenCalledTimes(3);
    expect(result.completed).toBe(3);
    expect(result.failures).toEqual([{ error: failure, item: "b", index: 1 }]);
    expect(onError).toHaveBeenCalledWith(failure, "b", 1);
    expect(progress.at(-1)).toBe(3);
  });

  it("continues even when failure reporting itself throws", async () => {
    const download = vi.fn(async (item) => {
      if (item === 1) throw new Error("failed");
    });

    const result = await runDownloadBatch([1, 2], download, {
      onError: () => { throw new Error("logger failed"); },
    });

    expect(result.completed).toBe(2);
    expect(result.failures).toHaveLength(1);
    expect(download).toHaveBeenCalledTimes(2);
  });
});
