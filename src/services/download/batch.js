export const SAFARI_DOWNLOAD_BATCH_POLICY = Object.freeze({
  batchSize: 2,
  batchDelay: 700,
});

export const DEFAULT_DOWNLOAD_BATCH_POLICY = Object.freeze({
  batchSize: 5,
  batchDelay: 350,
});

/**
 * @param {boolean} isSafari
 * @returns {{batchSize: number, batchDelay: number}}
 */
export function getDownloadBatchPolicy(isSafari) {
  return isSafari
    ? SAFARI_DOWNLOAD_BATCH_POLICY
    : DEFAULT_DOWNLOAD_BATCH_POLICY;
}

/**
 * Run downloads in browser-sensitive batches. Individual failures are
 * recorded and reported, while remaining items and progress continue.
 *
 * @template T
 * @param {Iterable<T> | ArrayLike<T> | null | undefined} items
 * @param {(item: T, index: number) => *} downloadItem
 * @param {object} [options]
 * @param {boolean} [options.isSafari=false]
 * @param {number} [options.batchSize]
 * @param {number} [options.batchDelay]
 * @param {(completed: number, total: number) => *} [options.onProgress]
 * @param {(error: *, item: T, index: number) => *} [options.onError]
 * @param {(delay: number) => Promise<*>} [options.sleep]
 * @returns {Promise<{total: number, completed: number, failures: Array<{error: *, item: T, index: number}>}>}
 */
export async function runDownloadBatch(
  items,
  downloadItem,
  options = {},
) {
  if (typeof downloadItem !== "function") {
    throw new TypeError("runDownloadBatch requires a download function.");
  }

  const source = items == null ? [] : Array.from(items);
  const policy = getDownloadBatchPolicy(options.isSafari === true);
  const batchSize = options.batchSize ?? policy.batchSize;
  const batchDelay = options.batchDelay ?? policy.batchDelay;
  const onProgress = options.onProgress || (() => {});
  const onError = options.onError || (() => {});
  const sleep = options.sleep ||
    ((delay) => new Promise((resolve) => setTimeout(resolve, delay)));

  if (!Number.isInteger(batchSize) || batchSize < 1) {
    throw new TypeError("Download batch size must be a positive integer.");
  }
  if (!Number.isFinite(batchDelay) || batchDelay < 0) {
    throw new TypeError("Download batch delay must be a non-negative number.");
  }
  if (
    typeof onProgress !== "function" ||
    typeof onError !== "function" ||
    typeof sleep !== "function"
  ) {
    throw new TypeError("Download batch callbacks must be functions.");
  }

  const total = source.length;
  const failures = [];
  let completed = 0;

  if (total === 0) return { total, completed, failures };
  onProgress(0, total);

  for (let start = 0; start < total; start += batchSize) {
    const currentBatch = source.slice(start, start + batchSize);
    await Promise.all(
      currentBatch.map((item, offset) => {
        const index = start + offset;
        return Promise.resolve()
          .then(() => downloadItem(item, index))
          .catch((error) => {
            const failure = { error, item, index };
            failures.push(failure);
            try {
              onError(error, item, index);
            } catch (_reportingError) {
              // Diagnostics cannot prevent the rest of the batch.
            }
          })
          .finally(() => {
            completed += 1;
            onProgress(completed, total);
          });
      }),
    );

    if (start + batchSize < total) {
      await sleep(batchDelay);
    }
  }

  return { total, completed, failures };
}
