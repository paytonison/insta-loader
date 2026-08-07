export const DEFAULT_OBJECT_URL_REVOKE_DELAY = 60_000;
export const DEFAULT_GM_OBJECT_URL_TIMEOUT = 30_000;
export const DEFAULT_ANCHOR_SETTLE_DELAY = 125;

/**
 * @typedef {object} DownloadTransportDependencies
 * @property {Function} [gmDownload]
 * @property {Function} [fetch]
 * @property {Function} [gmRequest]
 * @property {Document} [document]
 * @property {{createObjectURL: (blob: Blob) => string, revokeObjectURL: (url: string) => void}} [urlApi]
 * @property {typeof setTimeout} setTimeout
 * @property {typeof clearTimeout} clearTimeout
 * @property {(error: *, context: {stage: string, fallback: string | null}) => *} [onFallback]
 */

/**
 * @typedef {object} DownloadTransportOptions
 * @property {number} [objectUrlRevokeDelay=60000]
 * @property {number} [gmObjectUrlTimeout=30000]
 * @property {number} [directGmTimeout=0]
 * @property {number} [anchorSettleDelay=125]
 */

/**
 * @typedef {object} DownloadOperationOptions
 * @property {AbortSignal} [signal]
 */

/** @returns {Error} */
function createAbortError() {
  const error = new Error("Download operation was aborted.");
  error.name = "AbortError";
  return error;
}

/**
 * @param {AbortSignal|undefined} signal
 * @returns {void}
 */
function throwIfAborted(signal) {
  if (signal?.aborted) throw createAbortError();
}

/**
 * @param {*} error
 * @param {AbortSignal|undefined} signal
 * @returns {boolean}
 */
function isAbort(error, signal) {
  return signal?.aborted === true || error?.name === "AbortError";
}

/**
 * @param {AbortSignal|undefined} signal
 * @param {() => void} callback
 * @returns {() => void}
 */
function listenForAbort(signal, callback) {
  if (!signal) return () => {};
  if (
    typeof signal.addEventListener !== "function" ||
    typeof signal.removeEventListener !== "function"
  ) {
    throw new TypeError("Download operation signal must be an AbortSignal.");
  }
  if (signal.aborted) {
    callback();
    return () => {};
  }

  signal.addEventListener("abort", callback, { once: true });
  return () => signal.removeEventListener("abort", callback);
}

/** @param {{abort?: () => *}|null|undefined} task */
function abortTask(task) {
  try {
    task?.abort?.();
  } catch (_abortError) {
    // Disposal is terminal even when a userscript bridge rejects abort().
  }
}

/**
 * @param {*} error
 * @returns {string}
 */
export function getDownloadErrorMessage(error) {
  return error?.error ||
    error?.message ||
    error?.details ||
    String(error);
}

/**
 * @param {*} error
 * @param {string} fallbackMessage
 * @returns {Error}
 */
function toError(error, fallbackMessage) {
  if (error instanceof Error) return error;
  return new Error(getDownloadErrorMessage(error) || fallbackMessage);
}

/**
 * Dependency-injected transport chain for direct URLs and Blob downloads.
 */
export class DownloadTransport {
  /**
   * @param {DownloadTransportDependencies} dependencies
   * @param {DownloadTransportOptions} [options]
   */
  constructor(dependencies, options = {}) {
    if (dependencies === null || typeof dependencies !== "object") {
      throw new TypeError("DownloadTransport requires injected dependencies.");
    }
    for (const timer of ["setTimeout", "clearTimeout"]) {
      if (typeof dependencies[timer] !== "function") {
        throw new TypeError(`DownloadTransport requires ${timer}().`);
      }
    }
    for (const name of [
      "gmDownload",
      "fetch",
      "gmRequest",
      "onFallback",
    ]) {
      if (
        dependencies[name] != null &&
        typeof dependencies[name] !== "function"
      ) {
        throw new TypeError(`DownloadTransport ${name} must be a function.`);
      }
    }

    this.dependencies = Object.freeze({ ...dependencies });
    this.options = Object.freeze({
      objectUrlRevokeDelay:
        options.objectUrlRevokeDelay ?? DEFAULT_OBJECT_URL_REVOKE_DELAY,
      gmObjectUrlTimeout:
        options.gmObjectUrlTimeout ?? DEFAULT_GM_OBJECT_URL_TIMEOUT,
      directGmTimeout: options.directGmTimeout ?? 0,
      anchorSettleDelay:
        options.anchorSettleDelay ?? DEFAULT_ANCHOR_SETTLE_DELAY,
    });
  }

  /** @returns {boolean} */
  isGmDownloadAvailable() {
    return typeof this.dependencies.gmDownload === "function";
  }

  /**
   * Wrap callback-based GM_download with single-settlement and optional abort.
   *
   * @param {string} url
   * @param {string} filename
   * @param {{timeout?: number, signal?: AbortSignal}} [options]
   * @returns {Promise<true>}
   */
  downloadWithGm(url, filename, options = {}) {
    return new Promise((resolve, reject) => {
      const signal = options.signal;
      if (signal?.aborted) {
        reject(createAbortError());
        return;
      }
      if (!this.isGmDownloadAvailable()) {
        reject(new Error("GM_download is not available."));
        return;
      }

      let settled = false;
      let timeoutId = null;
      let downloadTask = null;
      let releaseAbort = () => {};

      const settle = (handler, value) => {
        if (settled) return;
        settled = true;
        releaseAbort();
        if (timeoutId != null) {
          this.dependencies.clearTimeout(timeoutId);
          timeoutId = null;
        }
        handler(value);
      };
      const rejectCallback = (error) => {
        settle(
          reject,
          signal?.aborted
            ? createAbortError()
            : new Error(getDownloadErrorMessage(error)),
        );
      };
      const abortDownload = () => {
        abortTask(downloadTask);
        settle(reject, createAbortError());
      };

      try {
        releaseAbort = listenForAbort(signal, abortDownload);
        if (settled) return;
        downloadTask = this.dependencies.gmDownload({
          url,
          name: filename,
          saveAs: false,
          onload: () => settle(resolve, true),
          onerror: rejectCallback,
          ontimeout: rejectCallback,
        });

        if (signal?.aborted) {
          abortTask(downloadTask);
          settle(reject, createAbortError());
          return;
        }

        const timeout = Number(options.timeout);
        if (!settled && Number.isFinite(timeout) && timeout > 0) {
          timeoutId = this.dependencies.setTimeout(() => {
            abortTask(downloadTask);
            settle(reject, new Error("GM_download timed out."));
          }, timeout);
        }
      } catch (error) {
        settle(reject, error);
      }
    });
  }

  /**
   * @param {string} url
   * @param {DownloadOperationOptions} [options]
   * @returns {Promise<Blob>}
   */
  fetchBlobWithGm(url, options = {}) {
    if (typeof this.dependencies.gmRequest !== "function") {
      return Promise.reject(new Error("GM_xmlhttpRequest is not available."));
    }

    return new Promise((resolve, reject) => {
      const signal = options.signal;
      if (signal?.aborted) {
        reject(createAbortError());
        return;
      }

      let requestTask = null;
      let settled = false;
      let releaseAbort = () => {};
      const settle = (handler, value) => {
        if (settled) return;
        settled = true;
        releaseAbort();
        handler(value);
      };
      const rejectRequest = (error, fallbackMessage) => {
        settle(
          reject,
          signal?.aborted
            ? createAbortError()
            : toError(error, fallbackMessage),
        );
      };
      const abortRequest = () => {
        abortTask(requestTask);
        settle(reject, createAbortError());
      };

      try {
        releaseAbort = listenForAbort(signal, abortRequest);
        if (settled) return;
        requestTask = this.dependencies.gmRequest({
          method: "GET",
          url,
          responseType: "blob",
          onload: (response) => {
            if (
              response?.status >= 200 &&
              response.status < 300 &&
              response.response
            ) {
              settle(resolve, response.response);
            } else {
              settle(
                reject,
                new Error(`HTTP ${response?.status || "unknown"}`),
              );
            }
          },
          onerror: (error) => rejectRequest(error, "GM request failed."),
          ontimeout: (error) =>
            rejectRequest(error, "GM request timed out."),
          onabort: () => settle(reject, createAbortError()),
        });

        if (signal?.aborted) {
          abortTask(requestTask);
          settle(reject, createAbortError());
        }
      } catch (error) {
        settle(reject, error);
      }
    });
  }

  /**
   * Fetch with same-session credentials, then fail open to GM request access.
   *
   * @param {string} url
   * @param {DownloadOperationOptions} [options]
   * @returns {Promise<Blob>}
   */
  async fetchMediaBlob(url, options = {}) {
    const signal = options.signal;
    throwIfAborted(signal);
    try {
      if (typeof this.dependencies.fetch !== "function") {
        throw new Error("fetch is not available.");
      }
      const response = await this.dependencies.fetch(url, {
        credentials: "include",
        ...(signal ? { signal } : {}),
      });
      throwIfAborted(signal);
      if (!response?.ok) throw new Error(`HTTP ${response?.status}`);
      const blob = await response.blob();
      throwIfAborted(signal);
      return blob;
    } catch (error) {
      if (isAbort(error, signal)) throw createAbortError();
      await this._reportFallback(error, "credentialed-fetch", "gm-request");
      throwIfAborted(signal);
      return await this.fetchBlobWithGm(url, { signal });
    }
  }

  /**
   * @param {string} url
   * @param {string} filename
   * @param {DownloadOperationOptions} [options]
   * @returns {Promise<true>}
   */
  triggerAnchorDownload(url, filename, options = {}) {
    return new Promise((resolve, reject) => {
      const signal = options.signal;
      if (signal?.aborted) {
        reject(createAbortError());
        return;
      }

      let link = null;
      let settleTimer = null;
      let settled = false;
      let releaseAbort = () => {};
      const removeLink = () => {
        link?.remove?.();
        link = null;
      };
      const settle = (handler, value) => {
        if (settled) return;
        settled = true;
        releaseAbort();
        if (settleTimer != null) {
          this.dependencies.clearTimeout(settleTimer);
          settleTimer = null;
        }
        removeLink();
        handler(value);
      };

      try {
        releaseAbort = listenForAbort(signal, () =>
          settle(reject, createAbortError()),
        );
        if (settled) return;
        const document = this.dependencies.document;
        if (typeof document?.createElement !== "function" || !document.body) {
          throw new Error("Anchor download requires a document body.");
        }
        link = document.createElement("a");
        link.href = url;
        link.download = filename;
        link.style.display = "none";
        document.body.appendChild(link);
        link.click();
        removeLink();
        settleTimer = this.dependencies.setTimeout(
          () => settle(resolve, true),
          this.options.anchorSettleDelay,
        );
      } catch (error) {
        settle(reject, error);
      }
    });
  }

  /**
   * @param {Blob} blob
   * @param {string} filename
   * @param {DownloadOperationOptions} [options]
   * @returns {Promise<true>}
   */
  async downloadBlob(blob, filename, options = {}) {
    const signal = options.signal;
    throwIfAborted(signal);
    const urlApi = this.dependencies.urlApi;
    if (
      typeof urlApi?.createObjectURL !== "function" ||
      typeof urlApi?.revokeObjectURL !== "function"
    ) {
      throw new Error("Blob download requires createObjectURL and revokeObjectURL.");
    }

    const objectUrl = urlApi.createObjectURL(blob);
    let revoked = false;
    const revoke = () => {
      if (revoked) return;
      revoked = true;
      urlApi.revokeObjectURL(objectUrl);
    };

    try {
      if (this.isGmDownloadAvailable()) {
        try {
          await this.downloadWithGm(objectUrl, filename, {
            timeout: this.options.gmObjectUrlTimeout,
            signal,
          });
          revoke();
          return true;
        } catch (error) {
          if (isAbort(error, signal)) throw createAbortError();
          await this._reportFallback(error, "gm-blob-download", "anchor");
          throwIfAborted(signal);
        }
      }

      await this.triggerAnchorDownload(objectUrl, filename, { signal });
      this._scheduleObjectUrlRevocation(revoke, signal);
      return true;
    } catch (error) {
      revoke();
      throw error;
    }
  }

  /**
   * Prefer a direct GM download. Any unavailable or failed GM path falls back
   * through credentialed fetch, GM request, Blob URL, and finally an anchor.
   *
   * @param {string} url
   * @param {string} filename
   * @param {DownloadOperationOptions} [options]
   * @returns {Promise<true>}
   */
  async downloadUrl(url, filename, options = {}) {
    if (typeof url !== "string" || url.length === 0) {
      throw new TypeError("downloadUrl requires a non-empty URL.");
    }
    if (typeof filename !== "string" || filename.length === 0) {
      throw new TypeError("downloadUrl requires a non-empty filename.");
    }
    const signal = options.signal;
    throwIfAborted(signal);

    if (this.isGmDownloadAvailable()) {
      try {
        await this.downloadWithGm(url, filename, {
          timeout: this.options.directGmTimeout,
          signal,
        });
        return true;
      } catch (error) {
        if (isAbort(error, signal)) throw createAbortError();
        await this._reportFallback(error, "gm-direct-download", "blob");
        throwIfAborted(signal);
      }
    }

    const blob = await this.fetchMediaBlob(url, { signal });
    return await this.downloadBlob(blob, filename, { signal });
  }

  /**
   * Preserve the legacy 60-second object URL lifetime while allowing route
   * teardown to revoke it early and clear the pending timer.
   *
   * @param {() => void} revoke
   * @param {AbortSignal|undefined} signal
   * @returns {void}
   * @private
   */
  _scheduleObjectUrlRevocation(revoke, signal) {
    let timerId = null;
    let finished = false;
    let releaseAbort = () => {};
    const finish = (clearTimer) => {
      if (finished) return;
      finished = true;
      releaseAbort();
      if (clearTimer && timerId != null) {
        this.dependencies.clearTimeout(timerId);
      }
      timerId = null;
      revoke();
    };

    releaseAbort = listenForAbort(signal, () => finish(true));
    if (finished) return;
    try {
      timerId = this.dependencies.setTimeout(
        () => finish(false),
        this.options.objectUrlRevokeDelay,
      );
    } catch (error) {
      finish(false);
      throw error;
    }
  }

  /**
   * @param {*} error
   * @param {string} stage
   * @param {string | null} fallback
   * @returns {Promise<void>}
   * @private
   */
  async _reportFallback(error, stage, fallback) {
    if (typeof this.dependencies.onFallback !== "function") return;
    try {
      await this.dependencies.onFallback(error, { stage, fallback });
    } catch (_reportingError) {
      // Transport fallback must not be blocked by diagnostics.
    }
  }
}

/**
 * @param {DownloadTransportDependencies} dependencies
 * @param {DownloadTransportOptions} [options]
 * @returns {DownloadTransport}
 */
export function createDownloadTransport(dependencies, options) {
  return new DownloadTransport(dependencies, options);
}
