/** @typedef {import("./types.js").MediaDescriptor} MediaDescriptor */

/**
 * Render one compatibility media link from application data. The returned
 * element retains the published attributes consumed by delegated handlers,
 * while callers keep the descriptor itself in a WeakMap.
 *
 * @param {Document} document
 * @param {MediaDescriptor} descriptor
 * @param {(key: string) => string} translate
 * @param {Object} [options]
 * @param {string} [options.sourceType]
 * @param {number} [options.displayIndex]
 * @param {"data-ih-locale" | "data-ih-locale-title"} [options.labelTranslationAttribute]
 * @return {HTMLAnchorElement}
 */
export function renderMediaRow(document, descriptor, translate, options = {}) {
  if (typeof document?.createElement !== "function") {
    throw new TypeError("renderMediaRow requires a Document.");
  }
  if (!descriptor || typeof descriptor !== "object") {
    throw new TypeError("renderMediaRow requires a MediaDescriptor.");
  }

  const isVideo = descriptor.kind === "video";
  const sourceType = options.sourceType || (isVideo ? "video" : "photo");
  const localeKey = isVideo ? "VID" : "IMG";
  const thumbnailUrl = descriptor.thumbnailUrl || descriptor.directUrl;
  const anchor = document.createElement("a");

  anchor.setAttribute("media-id", String(descriptor.mediaId));
  anchor.setAttribute("datetime", String(descriptor.publishTime ?? ""));
  anchor.setAttribute("data-blob", "true");
  anchor.setAttribute("data-needed", "direct");
  anchor.setAttribute("data-path", descriptor.shortcode ?? "");
  anchor.setAttribute("data-name", sourceType);
  anchor.setAttribute("data-type", descriptor.extension);
  anchor.setAttribute("data-username", descriptor.owner ?? "");
  anchor.setAttribute("data-globalIndex", String(descriptor.carouselIndex));
  anchor.setAttribute("href", "javascript:;");
  anchor.setAttribute("data-href", descriptor.directUrl);

  const image = document.createElement("img");
  image.width = 100;
  image.src = thumbnailUrl;
  anchor.append(image, document.createElement("br"), "- ");

  const label = document.createElement("span");
  label.setAttribute(
    options.labelTranslationAttribute ||
      descriptor.labelTranslationAttribute ||
      "data-ih-locale",
    localeKey,
  );
  label.textContent = translate(localeKey);
  anchor.append(label, ` ${options.displayIndex ?? descriptor.carouselIndex} -`);

  return anchor;
}
