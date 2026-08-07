export const DEFAULT_RENAME_FORMAT =
  "%USERNAME%-%SOURCE_TYPE%-%SHORTCODE%-%YEAR%%MONTH%%DAY%_%HOUR%%MINUTE%%SECOND%_%ORIGINAL_NAME_FIRST%";

/**
 * @typedef {object} DownloadMetadata
 * @property {string} username
 * @property {string} sourceType
 * @property {string | number} timestamp
 * @property {string} filetype
 * @property {string} [shortcode]
 * @property {string | number | null} [index]
 * @property {string | number | null} [uid]
 */

/**
 * Convert the userscript's seconds-or-milliseconds value to milliseconds.
 * This deliberately preserves the existing right-padding behavior for values
 * between ten and thirteen digits.
 *
 * @param {string | number} timestamp
 * @returns {number}
 */
export function normalizeFilenameTimestamp(timestamp) {
  return parseInt(timestamp.toString().padEnd(13, "0"));
}

/**
 * Extract the original CDN basename without its final extension. Query strings
 * are ignored by URL parsing; embedded dots and underscores remain intact.
 *
 * @param {string} downloadUrl
 * @returns {string}
 */
export function getOriginalMediaName(downloadUrl) {
  return new URL(downloadUrl).pathname
    .split("/")
    .at(-1)
    .split(".")
    .slice(0, -1)
    .join(".");
}

/**
 * Build the exact token map consumed by the legacy rename template.
 * Date tokens use the browser's local timezone, matching `Date` in the
 * published userscript.
 *
 * @param {string} downloadUrl
 * @param {DownloadMetadata} metadata
 * @returns {Record<string, string | number | undefined>}
 */
export function createFilenameTokens(downloadUrl, metadata) {
  let {
    username,
    sourceType,
    timestamp,
    shortcode,
    index,
    uid,
  } = metadata;
  timestamp = normalizeFilenameTimestamp(timestamp);
  index = index != null ? index : 0;

  const date = new Date(timestamp);
  const originalName = getOriginalMediaName(downloadUrl);
  const year = date.getFullYear().toString();
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const day = date.getDate().toString().padStart(2, "0");
  const hour = date.getHours().toString().padStart(2, "0");
  const minute = date.getMinutes().toString().padStart(2, "0");
  const second = date.getSeconds().toString().padStart(2, "0");

  return {
    "%USERNAME%": username,
    "%SOURCE_TYPE%": sourceType,
    "%SHORTCODE%": shortcode || "",
    "%YEAR%": year,
    "%2-YEAR%": year.substr(-2),
    "%MONTH%": month,
    "%DAY%": day,
    "%HOUR%": hour,
    "%MINUTE%": minute,
    "%SECOND%": second,
    "%ORIGINAL_NAME%": originalName,
    "%ORIGINAL_NAME_FIRST%": originalName.split("_").at(0),
    "%INDEX%": index.toString(),
    "%UID%": uid || "",
  };
}

/**
 * Replace supported tokens while preserving unknown tokens verbatim. Token
 * names are case-insensitive, but their surrounding text is untouched.
 *
 * @param {string} template
 * @param {Record<string, string | number | undefined>} tokens
 * @returns {string}
 */
export function formatFilenameTemplate(template, tokens) {
  let filename = template.replace(/%([^%]+)%/g, (_match, content) => {
    return `%${content.toUpperCase()}%`;
  });

  filename = filename.replace(/%[\w-]+%/g, (token) => {
    if (tokens[token] == null) return token;
    return String(tokens[token]);
  });

  return filename;
}

/**
 * Create the final download name without accessing userscript settings.
 *
 * Rename-off intentionally retains the historical
 * `<username>_<original CDN name>.<extension>` contract rather than applying
 * template tokens.
 *
 * @param {string} downloadUrl
 * @param {DownloadMetadata} metadata
 * @param {{autoRename?: boolean, renameFormat?: string}} [options]
 * @returns {string}
 */
export function createDownloadFilename(
  downloadUrl,
  metadata,
  options = {},
) {
  const autoRename = options.autoRename ?? true;
  const renameFormat = options.renameFormat ?? DEFAULT_RENAME_FORMAT;
  const tokens = createFilenameTokens(downloadUrl, metadata);
  const filename = formatFilenameTemplate(renameFormat, tokens);
  const originalName = tokens["%ORIGINAL_NAME%"];
  const originalFilename =
    `${metadata.username}_${originalName}.${metadata.filetype}`;

  return autoRename
    ? `${filename}.${metadata.filetype}`
    : originalFilename;
}

export const getDownloadFilename = createDownloadFilename;
