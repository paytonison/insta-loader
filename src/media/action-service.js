/** @typedef {import("./types.js").MediaDescriptor} MediaDescriptor */
/** @typedef {import("./types.js").MediaIntent} MediaIntent */

export const MEDIA_INTENT = Object.freeze({
  DOWNLOAD: "download",
  PREVIEW: "preview",
  THUMBNAIL: "thumbnail",
});

export const MEDIA_ACTION_STAGE = Object.freeze({
  CACHE: "cache",
  MEDIA_API: "media-api",
  DASH: "dash",
  OUTPUT: "output",
});

const VALID_INTENTS = new Set(Object.values(MEDIA_INTENT));
const RESOLUTION_FIELDS = Object.freeze([
  "directUrl",
  "thumbnailUrl",
  "rawMediaItem",
  "dashManifest",
]);

/**
 * @typedef {"descriptor" | "cache" | "media-api" | "dash"} MediaActionSource
 */

/**
 * @typedef {object} MediaActionContext
 * @property {Readonly<MediaDescriptor>} descriptor
 * @property {Readonly<MediaDescriptor>} originalDescriptor
 * @property {MediaIntent} intent
 * @property {MediaActionSource} source
 * @property {ReadonlyArray<MediaActionSource>} resolutionPath
 */

/**
 * @typedef {MediaActionContext & {url: string}} MediaOutputContext
 */

/**
 * A resolver may return a URL or the resource-bearing portion of a normalized
 * descriptor. Identity and naming fields remain owned by the original
 * descriptor and cannot be replaced by a resolver.
 *
 * @typedef {string | Pick<Partial<MediaDescriptor>, "directUrl" | "thumbnailUrl" | "rawMediaItem" | "dashManifest">} MediaActionResolution
 */

/**
 * @typedef {object} MediaActionDependencies
 * @property {(context: MediaActionContext) => (string | null | undefined | Promise<string | null | undefined>)} [getCachedImage]
 * @property {(context: MediaActionContext) => (MediaActionResolution | null | undefined | Promise<MediaActionResolution | null | undefined>)} [resolveMedia]
 * @property {(context: MediaActionContext) => (MediaActionResolution | null | undefined | Promise<MediaActionResolution | null | undefined>)} [resolveDash]
 * @property {{download: (context: MediaOutputContext) => *, preview: (context: MediaOutputContext) => *, thumbnail: (context: MediaOutputContext) => *}} outputs
 * @property {(error: *, context: MediaActionContext & {stage: string, willFallback: boolean}) => *} [onStageError]
 */

/**
 * @typedef {boolean | ((context: MediaActionContext) => (boolean | Promise<boolean>))} MediaActionPolicyDecision
 */

/**
 * @typedef {boolean | ((error: *, context: MediaActionContext & {stage: string}) => (boolean | Promise<boolean>))} MediaActionFallbackDecision
 */

/**
 * @typedef {object} MediaActionPolicy
 * @property {MediaActionPolicyDecision} [useImageCache=false]
 * @property {MediaActionPolicyDecision} [useMediaApi=false]
 * @property {MediaActionPolicyDecision} [useDash=false]
 * @property {MediaActionPolicyDecision} [dashBeforeMediaApi=false]
 * @property {MediaActionFallbackDecision} [failOpenOnCacheError=true]
 * @property {MediaActionFallbackDecision} [failOpenOnMediaApiError=false]
 * @property {MediaActionFallbackDecision} [failOpenOnDashError=true]
 */

const DEFAULT_POLICY = Object.freeze({
  useImageCache: false,
  useMediaApi: false,
  useDash: false,
  dashBeforeMediaApi: false,
  failOpenOnCacheError: true,
  failOpenOnMediaApiError: false,
  failOpenOnDashError: true,
});

/**
 * A stage returned a value that cannot be used as media action input.
 */
export class MediaActionError extends Error {
  /**
   * @param {string} stage
   * @param {string} message
   * @param {{cause?: *}} [options]
   */
  constructor(stage, message, options = {}) {
    super(message);
    this.name = "MediaActionError";
    this.stage = stage;
    this.code = `media-action-${stage}`;
    this.cause = options.cause;
  }
}

/**
 * Validate and freeze a shallow descriptor copy. The raw API item remains the
 * caller's object by design; the action service never mutates it.
 *
 * @param {unknown} descriptor
 * @returns {Readonly<MediaDescriptor>}
 */
export function validateMediaDescriptor(descriptor) {
  if (
    descriptor === null ||
    typeof descriptor !== "object" ||
    Array.isArray(descriptor)
  ) {
    throw new TypeError("MediaActionService requires a MediaDescriptor object.");
  }

  if (
    !(
      (typeof descriptor.mediaId === "string" && descriptor.mediaId.length > 0) ||
      (typeof descriptor.mediaId === "number" && Number.isFinite(descriptor.mediaId))
    )
  ) {
    throw new TypeError(
      "MediaDescriptor.mediaId must be a non-empty string or finite number.",
    );
  }
  if (
    typeof descriptor.directUrl !== "string" ||
    descriptor.directUrl.length === 0
  ) {
    throw new TypeError("MediaDescriptor.directUrl must be a non-empty string.");
  }
  if (
    descriptor.thumbnailUrl != null &&
    (typeof descriptor.thumbnailUrl !== "string" ||
      descriptor.thumbnailUrl.length === 0)
  ) {
    throw new TypeError(
      "MediaDescriptor.thumbnailUrl must be null or a non-empty string.",
    );
  }
  if (descriptor.kind !== "image" && descriptor.kind !== "video") {
    throw new TypeError('MediaDescriptor.kind must be "image" or "video".');
  }
  const expectedExtension = descriptor.kind === "video" ? "mp4" : "jpg";
  if (descriptor.extension !== expectedExtension) {
    throw new TypeError(
      `MediaDescriptor.extension must be "${expectedExtension}" for ${descriptor.kind} media.`,
    );
  }
  if (
    !Number.isInteger(descriptor.carouselIndex) ||
    descriptor.carouselIndex < 1
  ) {
    throw new TypeError(
      "MediaDescriptor.carouselIndex must be a positive integer.",
    );
  }
  if (descriptor.owner != null && typeof descriptor.owner !== "string") {
    throw new TypeError("MediaDescriptor.owner must be null or a string.");
  }
  if (descriptor.shortcode != null && typeof descriptor.shortcode !== "string") {
    throw new TypeError("MediaDescriptor.shortcode must be null or a string.");
  }
  if (
    descriptor.publishTime != null &&
    typeof descriptor.publishTime !== "string" &&
    typeof descriptor.publishTime !== "number"
  ) {
    throw new TypeError(
      "MediaDescriptor.publishTime must be null, a string, or a number.",
    );
  }
  if (
    descriptor.dashManifest != null &&
    typeof descriptor.dashManifest !== "string"
  ) {
    throw new TypeError(
      "MediaDescriptor.dashManifest must be null or a string.",
    );
  }
  if (
    descriptor.rawMediaItem != null &&
    (typeof descriptor.rawMediaItem !== "object" ||
      Array.isArray(descriptor.rawMediaItem))
  ) {
    throw new TypeError(
      "MediaDescriptor.rawMediaItem must be an object when provided.",
    );
  }

  return Object.freeze({ ...descriptor });
}

/**
 * @param {unknown} intent
 * @returns {asserts intent is MediaIntent}
 */
export function validateMediaIntent(intent) {
  if (!VALID_INTENTS.has(intent)) {
    throw new TypeError(
      'Media intent must be "download", "preview", or "thumbnail".',
    );
  }
}

/**
 * Execute media actions from normalized data. This service deliberately knows
 * nothing about elements or `data-*` attributes: every policy decision,
 * resolver, and output receives a MediaDescriptor-based context.
 */
export class MediaActionService {
  /**
   * @param {MediaActionDependencies} dependencies
   * @param {MediaActionPolicy} [policy]
   */
  constructor(dependencies, policy = {}) {
    if (dependencies === null || typeof dependencies !== "object") {
      throw new TypeError("MediaActionService requires injected dependencies.");
    }
    if (
      dependencies.outputs === null ||
      typeof dependencies.outputs !== "object"
    ) {
      throw new TypeError("MediaActionService requires an outputs object.");
    }

    for (const intent of VALID_INTENTS) {
      if (typeof dependencies.outputs[intent] !== "function") {
        throw new TypeError(`MediaActionService requires outputs.${intent}().`);
      }
    }
    for (const name of [
      "getCachedImage",
      "resolveMedia",
      "resolveDash",
      "onStageError",
    ]) {
      if (
        dependencies[name] != null &&
        typeof dependencies[name] !== "function"
      ) {
        throw new TypeError(
          `MediaActionService dependency ${name} must be a function.`,
        );
      }
    }

    const normalizedPolicy = { ...DEFAULT_POLICY, ...policy };
    for (const [name, value] of Object.entries(normalizedPolicy)) {
      if (typeof value !== "boolean" && typeof value !== "function") {
        throw new TypeError(
          `MediaActionService policy ${name} must be a boolean or function.`,
        );
      }
    }

    this.dependencies = Object.freeze({ ...dependencies });
    this.policy = Object.freeze(normalizedPolicy);
  }

  /**
   * Resolve and execute one normalized action.
   *
   * Cache hits short-circuit Media API resolution. By default, Media API
   * resolution may enrich a video with raw/DASH data before DASH resolution.
   * Callers that historically own an already-cached DASH item may opt into one
   * DASH attempt before Media API resolution instead. DASH is only eligible for
   * video downloads; previews and thumbnail actions remain on their direct
   * resource paths.
   *
   * @param {MediaDescriptor} descriptor
   * @param {MediaIntent} intent
   * @returns {Promise<*>}
   */
  async execute(descriptor, intent) {
    validateMediaIntent(intent);
    const originalDescriptor = validateMediaDescriptor(descriptor);
    let currentDescriptor = originalDescriptor;
    let source = "descriptor";
    let resolutionPath = Object.freeze([source]);
    let cacheHit = false;
    let dashAppliedBeforeMediaApi = false;
    let dashBeforeMediaApi = false;

    if (
      (currentDescriptor.kind === "image" ||
        intent === MEDIA_INTENT.THUMBNAIL) &&
      await this._usePolicy(
        "useImageCache",
        this._context(
          currentDescriptor,
          originalDescriptor,
          intent,
          source,
          resolutionPath,
        ),
      )
    ) {
      const result = await this._resolveStage({
        stage: MEDIA_ACTION_STAGE.CACHE,
        resolverName: "getCachedImage",
        fallbackPolicy: "failOpenOnCacheError",
        descriptor: currentDescriptor,
        originalDescriptor,
        intent,
        source,
        resolutionPath,
      });
      if (result.applied) {
        currentDescriptor = result.descriptor;
        source = "cache";
        resolutionPath = Object.freeze([...resolutionPath, source]);
        cacheHit = true;
      }
    }

    if (
      currentDescriptor.kind === "video" &&
      intent === MEDIA_INTENT.DOWNLOAD
    ) {
      dashBeforeMediaApi = await this._usePolicy(
        "dashBeforeMediaApi",
        this._context(
          currentDescriptor,
          originalDescriptor,
          intent,
          source,
          resolutionPath,
        ),
      );
    }

    if (
      dashBeforeMediaApi &&
      await this._usePolicy(
        "useDash",
        this._context(
          currentDescriptor,
          originalDescriptor,
          intent,
          source,
          resolutionPath,
        ),
      )
    ) {
      const result = await this._resolveStage({
        stage: MEDIA_ACTION_STAGE.DASH,
        resolverName: "resolveDash",
        fallbackPolicy: "failOpenOnDashError",
        descriptor: currentDescriptor,
        originalDescriptor,
        intent,
        source,
        resolutionPath,
      });
      if (result.applied) {
        currentDescriptor = result.descriptor;
        source = "dash";
        resolutionPath = Object.freeze([...resolutionPath, source]);
        dashAppliedBeforeMediaApi = true;
      }
    }

    if (
      !cacheHit &&
      !dashAppliedBeforeMediaApi &&
      await this._usePolicy(
        "useMediaApi",
        this._context(
          currentDescriptor,
          originalDescriptor,
          intent,
          source,
          resolutionPath,
        ),
      )
    ) {
      const result = await this._resolveStage({
        stage: MEDIA_ACTION_STAGE.MEDIA_API,
        resolverName: "resolveMedia",
        fallbackPolicy: "failOpenOnMediaApiError",
        descriptor: currentDescriptor,
        originalDescriptor,
        intent,
        source,
        resolutionPath,
      });
      if (result.applied) {
        currentDescriptor = result.descriptor;
        source = "media-api";
        resolutionPath = Object.freeze([...resolutionPath, source]);
      }
    }

    if (
      currentDescriptor.kind === "video" &&
      intent === MEDIA_INTENT.DOWNLOAD &&
      !dashBeforeMediaApi &&
      await this._usePolicy(
        "useDash",
        this._context(
          currentDescriptor,
          originalDescriptor,
          intent,
          source,
          resolutionPath,
        ),
      )
    ) {
      const result = await this._resolveStage({
        stage: MEDIA_ACTION_STAGE.DASH,
        resolverName: "resolveDash",
        fallbackPolicy: "failOpenOnDashError",
        descriptor: currentDescriptor,
        originalDescriptor,
        intent,
        source,
        resolutionPath,
      });
      if (result.applied) {
        currentDescriptor = result.descriptor;
        source = "dash";
        resolutionPath = Object.freeze([...resolutionPath, source]);
      }
    }

    const context = this._context(
      currentDescriptor,
      originalDescriptor,
      intent,
      source,
      resolutionPath,
    );
    const output = this.dependencies.outputs[intent];

    try {
      const outputContext = Object.freeze({
        ...context,
        url: this._outputUrl(currentDescriptor, intent),
      });
      return await output.call(this.dependencies.outputs, outputContext);
    } catch (error) {
      await this._reportStageError(
        error,
        context,
        MEDIA_ACTION_STAGE.OUTPUT,
        false,
      );
      throw error;
    }
  }

  /**
   * @param {string} name
   * @param {MediaActionContext} context
   * @returns {Promise<boolean>}
   * @private
   */
  async _usePolicy(name, context) {
    const decision = this.policy[name];
    return typeof decision === "function"
      ? Boolean(await decision(context))
      : decision;
  }

  /**
   * @param {string} name
   * @param {*} error
   * @param {MediaActionContext} context
   * @param {string} stage
   * @returns {Promise<boolean>}
   * @private
   */
  async _useFallbackPolicy(name, error, context, stage) {
    const decision = this.policy[name];
    const errorContext = Object.freeze({ ...context, stage });
    return typeof decision === "function"
      ? Boolean(await decision(error, errorContext))
      : decision;
  }

  /**
   * @param {object} options
   * @returns {Promise<{applied: boolean, descriptor: Readonly<MediaDescriptor>}>}
   * @private
   */
  async _resolveStage(options) {
    const resolver = this.dependencies[options.resolverName];
    if (typeof resolver !== "function") {
      throw new TypeError(
        `MediaActionService policy enabled ${options.stage} without a ${options.resolverName} dependency.`,
      );
    }

    const context = this._context(
      options.descriptor,
      options.originalDescriptor,
      options.intent,
      options.source,
      options.resolutionPath,
    );

    try {
      const resolution = await resolver.call(this.dependencies, context);
      if (resolution == null) {
        return { applied: false, descriptor: options.descriptor };
      }
      const resolvedDescriptor = this._applyResolution(
        options.descriptor,
        resolution,
        options.intent,
        options.stage,
      );
      return { applied: true, descriptor: resolvedDescriptor };
    } catch (error) {
      const willFallback = await this._useFallbackPolicy(
        options.fallbackPolicy,
        error,
        context,
        options.stage,
      );
      await this._reportStageError(
        error,
        context,
        options.stage,
        willFallback,
      );
      if (!willFallback) throw error;
      return { applied: false, descriptor: options.descriptor };
    }
  }

  /**
   * @param {Readonly<MediaDescriptor>} descriptor
   * @param {MediaActionResolution} resolution
   * @param {MediaIntent} intent
   * @param {string} stage
   * @returns {Readonly<MediaDescriptor>}
   * @private
   */
  _applyResolution(descriptor, resolution, intent, stage) {
    if (typeof resolution === "string") {
      if (resolution.length === 0) {
        throw new MediaActionError(
          stage,
          `${stage} returned an empty media URL.`,
        );
      }
      if (stage === MEDIA_ACTION_STAGE.CACHE) {
        return validateMediaDescriptor({
          ...descriptor,
          directUrl: resolution,
          thumbnailUrl: resolution,
        });
      }
      if (intent === MEDIA_INTENT.THUMBNAIL) {
        return validateMediaDescriptor({
          ...descriptor,
          thumbnailUrl: resolution,
        });
      }
      return validateMediaDescriptor({
        ...descriptor,
        directUrl: resolution,
      });
    }

    if (
      resolution === null ||
      typeof resolution !== "object" ||
      Array.isArray(resolution)
    ) {
      throw new MediaActionError(
        stage,
        `${stage} must return a URL, descriptor patch, or null.`,
      );
    }

    const patch = {};
    for (const field of RESOLUTION_FIELDS) {
      if (Object.prototype.hasOwnProperty.call(resolution, field)) {
        patch[field] = resolution[field];
      }
    }
    if (Object.keys(patch).length === 0) {
      throw new MediaActionError(
        stage,
        `${stage} returned no resource-bearing descriptor fields.`,
      );
    }

    return validateMediaDescriptor({ ...descriptor, ...patch });
  }

  /**
   * @param {Readonly<MediaDescriptor>} descriptor
   * @param {Readonly<MediaDescriptor>} originalDescriptor
   * @param {MediaIntent} intent
   * @param {MediaActionSource} source
   * @param {ReadonlyArray<MediaActionSource>} resolutionPath
   * @returns {MediaActionContext}
   * @private
   */
  _context(
    descriptor,
    originalDescriptor,
    intent,
    source,
    resolutionPath,
  ) {
    return Object.freeze({
      descriptor,
      originalDescriptor,
      intent,
      source,
      resolutionPath,
    });
  }

  /**
   * @param {Readonly<MediaDescriptor>} descriptor
   * @param {MediaIntent} intent
   * @returns {string}
   * @private
   */
  _outputUrl(descriptor, intent) {
    if (intent !== MEDIA_INTENT.THUMBNAIL) return descriptor.directUrl;
    if (descriptor.thumbnailUrl) return descriptor.thumbnailUrl;
    if (descriptor.kind === "image") return descriptor.directUrl;
    throw new MediaActionError(
      MEDIA_ACTION_STAGE.OUTPUT,
      "Video thumbnail actions require MediaDescriptor.thumbnailUrl.",
    );
  }

  /**
   * @param {*} error
   * @param {MediaActionContext} context
   * @param {string} stage
   * @param {boolean} willFallback
   * @returns {Promise<void>}
   * @private
   */
  async _reportStageError(error, context, stage, willFallback) {
    if (typeof this.dependencies.onStageError !== "function") return;
    try {
      await this.dependencies.onStageError(
        error,
        Object.freeze({
          ...context,
          stage,
          willFallback,
        }),
      );
    } catch (_reportingError) {
      // Error reporting must not replace the action's canonical result.
    }
  }
}

/**
 * @param {MediaActionDependencies} dependencies
 * @param {MediaActionPolicy} [policy]
 * @returns {MediaActionService}
 */
export function createMediaActionService(dependencies, policy) {
  return new MediaActionService(dependencies, policy);
}
