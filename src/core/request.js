export const REQUEST_ERROR_CATEGORY = Object.freeze({
  NETWORK: "network",
  HTTP: "http",
  LOGIN: "login",
  RATE_LIMIT: "rate-limit",
  PARSE: "parse",
  API: "api",
  TIMEOUT: "timeout",
  ABORT: "abort",
});

const REQUEST_ERROR_CATEGORIES = new Set(
  Object.values(REQUEST_ERROR_CATEGORY),
);
const LOGIN_REDIRECT_PATTERN =
  /\/(accounts\/login|challenge|checkpoint)\b/i;
const RATE_LIMIT_PATTERN =
  /rate|limit|throttl|please wait|try again later/i;

/**
 * A transport-independent request failure. Feature controllers may translate
 * these generic categories into their own retry, cooldown, alert, or fail-open
 * policy without the request layer depending on Reel playback.
 */
export class RequestError extends Error {
  /**
   * @param {string} category
   * @param {string} message
   * @param {{cause?: *, status?: number|null, url?: string, response?: *, details?: *, retryable?: boolean}} [options]
   */
  constructor(category, message, options = {}) {
    if (!REQUEST_ERROR_CATEGORIES.has(category)) {
      throw new RangeError(`Unknown request error category: ${category}`);
    }
    super(message);
    this.name = "RequestError";
    this.category = category;
    // `code` is retained as a convenient migration surface for legacy callers.
    this.code = category;
    this.cause = options.cause;
    this.status = options.status ?? null;
    this.url = options.url || "";
    this.response = options.response;
    this.details = options.details;
    this.rateLimited = category === REQUEST_ERROR_CATEGORY.RATE_LIMIT;
    this.retryable =
      options.retryable ??
      [
        REQUEST_ERROR_CATEGORY.NETWORK,
        REQUEST_ERROR_CATEGORY.RATE_LIMIT,
        REQUEST_ERROR_CATEGORY.TIMEOUT,
      ].includes(category);
  }
}

/**
 * @typedef {Object} CancelableJsonRequest
 * @property {Promise<*>} promise
 * @property {() => *} abort
 * @property {*} handle
 * @property {Promise<*>["then"]} then
 * @property {Promise<*>["catch"]} catch
 * @property {Promise<*>["finally"]} finally
 */

/**
 * Start one cancelable GM JSON request.
 *
 * `requestJson()` returns both an explicit `.promise` and a thenable request
 * record, so callers may either `await request` or retain the record and call
 * `abort()` during controller disposal. The GM handle is surfaced read-only for
 * narrow compatibility adapters.
 *
 * @param {{request: (details: Object) => *}|((details: Object) => *)} environment
 * @param {Object} options
 * @param {string} options.url
 * @param {string} [options.method]
 * @param {Object} [options.headers]
 * @param {*} [options.data]
 * @param {number} [options.timeout]
 * @param {AbortSignal} [options.signal]
 * @param {boolean} [options.detectApiErrors]
 * @param {(data: *, response: *) => (void|boolean)} [options.validate]
 * @param {(data: *, response: *) => *} [options.transform]
 * @param {(handle: *) => void} [options.onRequest]
 * @param {Object} [options.requestDetails]
 * @return {CancelableJsonRequest}
 */
export function requestJson(environment, options) {
  if (!options || typeof options.url !== "string" || options.url === "") {
    throw new TypeError("requestJson() requires a non-empty URL.");
  }

  const send =
    typeof environment === "function"
      ? environment
      : environment?.request?.bind(environment);
  if (typeof send !== "function") {
    throw new TypeError("requestJson() requires a request function.");
  }

  let handle = null;
  let settled = false;
  let rejectPromise;
  let removeSignalListener = () => {};

  const promise = new Promise((resolve, reject) => {
    rejectPromise = reject;

    const settle = (callback, value) => {
      if (settled) return;
      settled = true;
      removeSignalListener();
      callback(value);
    };

    const rejectWith = (error) => settle(reject, error);
    const abortFromSignal = () => {
      const reason = options.signal?.reason;
      rejectWith(
        new RequestError(
          REQUEST_ERROR_CATEGORY.ABORT,
          typeof reason === "string" ? reason : "The request was cancelled.",
          { cause: reason, url: options.url },
        ),
      );
      try {
        handle?.abort?.();
      } catch (_error) {
        // The promise has already reached its canonical abort result.
      }
    };

    if (options.signal?.aborted) {
      abortFromSignal();
      return;
    }
    if (options.signal) {
      options.signal.addEventListener("abort", abortFromSignal, { once: true });
      removeSignalListener = () =>
        options.signal.removeEventListener("abort", abortFromSignal);
    }

    const timeout = Number(options.timeout);
    const details = {
      ...(options.requestDetails || {}),
      method: options.method || "GET",
      url: options.url,
      headers: options.headers,
      data: options.data,
      timeout:
        Number.isFinite(timeout) && timeout > 0
          ? Math.floor(timeout)
          : undefined,
      onload(response) {
        try {
          const status = Number(response?.status) || 200;
          if (status === 429) {
            throw new RequestError(
              REQUEST_ERROR_CATEGORY.RATE_LIMIT,
              "The server rate-limited the request.",
              { status, url: options.url, response },
            );
          }
          if (status < 200 || status >= 300) {
            throw new RequestError(
              REQUEST_ERROR_CATEGORY.HTTP,
              `The request returned HTTP ${status}.`,
              { status, url: options.url, response },
            );
          }

          const finalUrl = String(response?.finalUrl || "");
          if (LOGIN_REDIRECT_PATTERN.test(finalUrl)) {
            throw new RequestError(
              REQUEST_ERROR_CATEGORY.LOGIN,
              "The request was redirected to a login or checkpoint page.",
              { status, url: finalUrl || options.url, response },
            );
          }

          const body =
            response?.response != null && response.response !== ""
              ? response.response
              : response?.responseText;
          if (typeof body === "string" && /^\s*</.test(body)) {
            throw new RequestError(
              REQUEST_ERROR_CATEGORY.PARSE,
              "The server returned HTML instead of JSON.",
              { status, url: options.url, response },
            );
          }

          let data;
          try {
            data = typeof body === "string" ? JSON.parse(body) : body;
          } catch (error) {
            throw new RequestError(
              REQUEST_ERROR_CATEGORY.PARSE,
              "The response could not be parsed as JSON.",
              { cause: error, status, url: options.url, response },
            );
          }

          if (options.detectApiErrors !== false) {
            const apiError = findApiError(data, options.url, status, response);
            if (apiError) throw apiError;
          }

          if (options.validate) {
            let valid;
            try {
              valid = options.validate(data, response);
            } catch (error) {
              if (error instanceof RequestError) throw error;
              throw new RequestError(
                REQUEST_ERROR_CATEGORY.API,
                error?.message || "The response failed API validation.",
                { cause: error, status, url: options.url, response },
              );
            }
            if (valid === false) {
              throw new RequestError(
                REQUEST_ERROR_CATEGORY.API,
                "The response failed API validation.",
                { status, url: options.url, response },
              );
            }
          }

          const result = options.transform
            ? options.transform(data, response)
            : data;
          settle(resolve, result);
        } catch (error) {
          rejectWith(
            error instanceof RequestError
              ? error
              : new RequestError(
                  REQUEST_ERROR_CATEGORY.PARSE,
                  error?.message || "The JSON response could not be processed.",
                  { cause: error, url: options.url, response },
                ),
          );
        }
      },
      onerror(error) {
        rejectWith(
          new RequestError(
            REQUEST_ERROR_CATEGORY.NETWORK,
            error?.error || error?.message || "The network request failed.",
            { cause: error, url: options.url },
          ),
        );
      },
      ontimeout() {
        rejectWith(
          new RequestError(
            REQUEST_ERROR_CATEGORY.TIMEOUT,
            "The request timed out.",
            { url: options.url },
          ),
        );
      },
      onabort() {
        rejectWith(
          new RequestError(
            REQUEST_ERROR_CATEGORY.ABORT,
            "The request was cancelled.",
            { url: options.url },
          ),
        );
      },
    };

    try {
      handle = send(details);
      options.onRequest?.(handle);
    } catch (error) {
      rejectWith(
        new RequestError(
          REQUEST_ERROR_CATEGORY.NETWORK,
          error?.message || "The request could not be started.",
          { cause: error, url: options.url },
        ),
      );
    }
  });

  const abort = () => {
    if (settled) return;
    settled = true;
    removeSignalListener();
    rejectPromise(
      new RequestError(
        REQUEST_ERROR_CATEGORY.ABORT,
        "The request was cancelled.",
        { url: options.url },
      ),
    );
    try {
      handle?.abort?.();
    } catch (_error) {
      // The exposed promise already has its canonical abort result.
    }
  };

  return {
    promise,
    abort,
    get handle() {
      return handle;
    },
    then: promise.then.bind(promise),
    catch: promise.catch.bind(promise),
    finally: promise.finally.bind(promise),
  };
}

export const createJsonRequest = requestJson;

/**
 * Start one cancelable GM text request using the same transport categories as
 * requestJson(). This is intentionally narrow: update checks need the remote
 * userscript source as text, while feature endpoints continue through the JSON
 * parser and validation path above.
 *
 * @param {{request: (details: Object) => *}|((details: Object) => *)} environment
 * @param {Object} options
 * @param {string} options.url
 * @param {string} [options.method]
 * @param {Object} [options.headers]
 * @param {*} [options.data]
 * @param {number} [options.timeout]
 * @param {AbortSignal} [options.signal]
 * @param {(text: string, response: *) => *} [options.transform]
 * @param {(handle: *) => void} [options.onRequest]
 * @param {Object} [options.requestDetails]
 * @return {CancelableJsonRequest}
 */
export function requestText(environment, options) {
  if (!options || typeof options.url !== "string" || options.url === "") {
    throw new TypeError("requestText() requires a non-empty URL.");
  }

  const send =
    typeof environment === "function"
      ? environment
      : environment?.request?.bind(environment);
  if (typeof send !== "function") {
    throw new TypeError("requestText() requires a request function.");
  }

  let handle = null;
  let settled = false;
  let rejectPromise;
  let removeSignalListener = () => {};

  const promise = new Promise((resolve, reject) => {
    rejectPromise = reject;

    const settle = (callback, value) => {
      if (settled) return;
      settled = true;
      removeSignalListener();
      callback(value);
    };
    const rejectWith = (error) => settle(reject, error);
    const abortFromSignal = () => {
      const reason = options.signal?.reason;
      rejectWith(
        new RequestError(
          REQUEST_ERROR_CATEGORY.ABORT,
          typeof reason === "string" ? reason : "The request was cancelled.",
          { cause: reason, url: options.url },
        ),
      );
      try {
        handle?.abort?.();
      } catch (_error) {
        // The promise has already reached its canonical abort result.
      }
    };

    if (options.signal?.aborted) {
      abortFromSignal();
      return;
    }
    if (options.signal) {
      options.signal.addEventListener("abort", abortFromSignal, { once: true });
      removeSignalListener = () =>
        options.signal.removeEventListener("abort", abortFromSignal);
    }

    const timeout = Number(options.timeout);
    const details = {
      ...(options.requestDetails || {}),
      method: options.method || "GET",
      url: options.url,
      headers: options.headers,
      data: options.data,
      timeout:
        Number.isFinite(timeout) && timeout > 0
          ? Math.floor(timeout)
          : undefined,
      onload(response) {
        try {
          const status = Number(response?.status) || 200;
          if (status === 429) {
            throw new RequestError(
              REQUEST_ERROR_CATEGORY.RATE_LIMIT,
              "The server rate-limited the request.",
              { status, url: options.url, response },
            );
          }
          if (status < 200 || status >= 300) {
            throw new RequestError(
              REQUEST_ERROR_CATEGORY.HTTP,
              `The request returned HTTP ${status}.`,
              { status, url: options.url, response },
            );
          }

          const finalUrl = String(response?.finalUrl || "");
          if (LOGIN_REDIRECT_PATTERN.test(finalUrl)) {
            throw new RequestError(
              REQUEST_ERROR_CATEGORY.LOGIN,
              "The request was redirected to a login or checkpoint page.",
              { status, url: finalUrl || options.url, response },
            );
          }

          const body =
            response?.responseText ?? response?.response ?? "";
          const text = typeof body === "string" ? body : String(body ?? "");
          const result = options.transform
            ? options.transform(text, response)
            : text;
          settle(resolve, result);
        } catch (error) {
          rejectWith(
            error instanceof RequestError
              ? error
              : new RequestError(
                  REQUEST_ERROR_CATEGORY.API,
                  error?.message || "The text response could not be processed.",
                  { cause: error, url: options.url, response },
                ),
          );
        }
      },
      onerror(error) {
        rejectWith(
          new RequestError(
            REQUEST_ERROR_CATEGORY.NETWORK,
            error?.error || error?.message || "The network request failed.",
            { cause: error, url: options.url },
          ),
        );
      },
      ontimeout() {
        rejectWith(
          new RequestError(
            REQUEST_ERROR_CATEGORY.TIMEOUT,
            "The request timed out.",
            { url: options.url },
          ),
        );
      },
      onabort() {
        rejectWith(
          new RequestError(
            REQUEST_ERROR_CATEGORY.ABORT,
            "The request was cancelled.",
            { url: options.url },
          ),
        );
      },
    };

    try {
      handle = send(details);
      options.onRequest?.(handle);
    } catch (error) {
      rejectWith(
        new RequestError(
          REQUEST_ERROR_CATEGORY.NETWORK,
          error?.message || "The request could not be started.",
          { cause: error, url: options.url },
        ),
      );
    }
  });

  const abort = () => {
    if (settled) return;
    settled = true;
    removeSignalListener();
    rejectPromise(
      new RequestError(
        REQUEST_ERROR_CATEGORY.ABORT,
        "The request was cancelled.",
        { url: options.url },
      ),
    );
    try {
      handle?.abort?.();
    } catch (_error) {
      // The exposed promise already has its canonical abort result.
    }
  };

  return {
    promise,
    abort,
    get handle() {
      return handle;
    },
    then: promise.then.bind(promise),
    catch: promise.catch.bind(promise),
    finally: promise.finally.bind(promise),
  };
}

export const createTextRequest = requestText;

/**
 * @param {*} data
 * @param {string} url
 * @param {number} status
 * @param {*} response
 * @return {RequestError|null}
 */
function findApiError(data, url, status, response) {
  let message = "";
  let details = null;

  if (Array.isArray(data?.errors) && data.errors.length > 0) {
    details = data.errors;
    message = data.errors
      .map((error) =>
        [error?.message, error?.description, error?.code]
          .filter(Boolean)
          .join(" "),
      )
      .join(" ");
  } else if (data?.status === "fail") {
    details = data;
    message = [data.message, data.feedback_message]
      .filter(Boolean)
      .join(": ");
  } else {
    return null;
  }

  const rateLimited = RATE_LIMIT_PATTERN.test(message);
  return new RequestError(
    rateLimited
      ? REQUEST_ERROR_CATEGORY.RATE_LIMIT
      : REQUEST_ERROR_CATEGORY.API,
    message || "The server rejected the API request.",
    { details, status, url, response },
  );
}
