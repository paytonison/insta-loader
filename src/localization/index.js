import englishDictionarySource from "./en-US.json";
import localeManifestSource from "./locale-manifest.json";
import upstreamProvenance from "../resources/upstream-provenance.json";

const hasOwn = (object, key) =>
  Object.prototype.hasOwnProperty.call(object, key);

/**
 * @typedef {Readonly<Record<string, string>>} TranslationDictionary
 */

export const DEFAULT_LOCALE = "en-US";
export const LOCALE_MANIFEST = Object.freeze({ ...localeManifestSource });
export const UPSTREAM_LOCALE_COMMIT = upstreamProvenance.commit;
export const TRANSLATION_BASE_URL =
  upstreamProvenance.translations.immutableBaseUrl;

/**
 * Return true only for ordinary JSON-style records.
 *
 * @param {unknown} value
 * @returns {boolean}
 */
function isPlainRecord(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

/**
 * Parse and normalize a translation payload. Every accepted value becomes
 * plain text; arrays retain the legacy newline-joined behavior.
 *
 * @param {unknown} payload
 * @returns {TranslationDictionary | null}
 */
export function normalizeTranslationDictionary(payload) {
  let candidate = payload;

  if (typeof candidate === "string") {
    try {
      candidate = JSON.parse(candidate);
    } catch {
      return null;
    }
  }

  if (!isPlainRecord(candidate)) {
    return null;
  }

  const normalized = Object.create(null);

  for (const [key, value] of Object.entries(candidate)) {
    if (key.length === 0) {
      return null;
    }

    if (typeof value === "string") {
      normalized[key] = value;
      continue;
    }

    if (Array.isArray(value) && value.every((line) => typeof line === "string")) {
      normalized[key] = value.join("\n");
      continue;
    }

    return null;
  }

  return Object.freeze(normalized);
}

/**
 * @param {unknown} payload
 * @returns {boolean}
 */
export function isTranslationDictionary(payload) {
  return normalizeTranslationDictionary(payload) !== null;
}

const normalizedEnglishDictionary = normalizeTranslationDictionary(
  englishDictionarySource,
);

if (normalizedEnglishDictionary === null) {
  throw new TypeError("The bundled English translation dictionary is invalid.");
}

export const ENGLISH_DICTIONARY = normalizedEnglishDictionary;

/**
 * Treat all English language variants as the bundled English locale.
 *
 * @param {unknown} locale
 * @returns {boolean}
 */
export function isEnglishLocale(locale) {
  return (
    typeof locale === "string" &&
    /^en(?:-|$)/i.test(locale.trim())
  );
}

/**
 * @param {unknown} locale
 * @returns {boolean}
 */
export function isSupportedLocale(locale) {
  return (
    typeof locale === "string" &&
    hasOwn(LOCALE_MANIFEST, locale.trim())
  );
}

/**
 * Construct the immutable URL for a supported non-English locale. English
 * returns null because its dictionary is bundled locally.
 *
 * @param {unknown} locale
 * @returns {string | null}
 */
export function getTranslationUrl(locale) {
  if (typeof locale !== "string") {
    return null;
  }

  const requestedLocale = locale.trim();

  if (
    isEnglishLocale(requestedLocale) ||
    !hasOwn(LOCALE_MANIFEST, requestedLocale)
  ) {
    return null;
  }

  return `${TRANSLATION_BASE_URL}/${encodeURIComponent(requestedLocale)}.json`;
}

/**
 * Load a supported locale with an injected JSON request function. English,
 * unsupported locales, request failures, and malformed payloads all use the
 * bundled English dictionary without making an English request.
 *
 * @param {unknown} locale
 * @param {(url: string) => Promise<unknown>} requestJson
 * @returns {Promise<TranslationDictionary>}
 */
export async function loadTranslationDictionary(locale, requestJson) {
  const url = getTranslationUrl(locale);

  if (url === null) {
    return ENGLISH_DICTIONARY;
  }

  if (typeof requestJson !== "function") {
    throw new TypeError("requestJson must be a function.");
  }

  try {
    const dictionary = normalizeTranslationDictionary(await requestJson(url));
    return dictionary || ENGLISH_DICTIONARY;
  } catch {
    return ENGLISH_DICTIONARY;
  }
}

/**
 * Resolve a key to plain text, preferring the selected dictionary and then
 * bundled English. Unknown keys become an empty string instead of undefined
 * or executable markup.
 *
 * @param {TranslationDictionary | null | undefined} dictionary
 * @param {unknown} key
 * @returns {string}
 */
export function getTranslationText(dictionary, key) {
  if (typeof key !== "string") {
    return "";
  }

  if (dictionary && hasOwn(dictionary, key)) {
    const translatedValue = dictionary[key];
    if (typeof translatedValue === "string") {
      return translatedValue;
    }
  }

  if (hasOwn(ENGLISH_DICTIONARY, key)) {
    return ENGLISH_DICTIONARY[key];
  }

  return "";
}

/**
 * @param {TranslationDictionary | null | undefined} dictionary
 * @returns {(key: string) => string}
 */
export function createTranslator(dictionary) {
  return (key) => getTranslationText(dictionary, key);
}

/**
 * Apply translations using textContent and title attributes only. Translation
 * values are never interpreted as HTML.
 *
 * @param {ParentNode} root
 * @param {(key: string) => string} translate
 * @returns {void}
 */
export function applyTranslations(root, translate) {
  if (!root || typeof root.querySelectorAll !== "function") {
    return;
  }

  root.querySelectorAll("[data-ih-locale]").forEach((element) => {
    const key = element.getAttribute("data-ih-locale");
    if (key !== null) {
      element.textContent = translate(key);
    }
  });

  root.querySelectorAll("[data-ih-locale-title]").forEach((element) => {
    const key = element.getAttribute("data-ih-locale-title");
    if (key !== null) {
      element.setAttribute("title", translate(key));
    }
  });
}
