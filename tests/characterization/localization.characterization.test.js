// @vitest-environment node

import { JSDOM } from "jsdom";
import { describe, expect, it, vi } from "vitest";

import {
  ENGLISH_DICTIONARY,
  TRANSLATION_BASE_URL,
  UPSTREAM_LOCALE_COMMIT,
  applyTranslations,
  createTranslator,
  loadTranslationDictionary,
  normalizeTranslationDictionary,
} from "../../src/localization/index.js";

describe("deterministic localization resources", () => {
  it.each(["en", "en-US", "en-GB", "EN-us"])(
    "uses bundled English for %s without a network request",
    async (locale) => {
      const requestJson = vi.fn();

      const dictionary = await loadTranslationDictionary(locale, requestJson);

      expect(dictionary).toBe(ENGLISH_DICTIONARY);
      expect(requestJson).not.toHaveBeenCalled();
    },
  );

  it("loads supported non-English dictionaries from the immutable commit", async () => {
    const requestJson = vi.fn(async () => ({
      DOWNLOAD: "Descargar",
    }));

    const dictionary = await loadTranslationDictionary("es", requestJson);

    expect(UPSTREAM_LOCALE_COMMIT).toMatch(/^[0-9a-f]{40}$/);
    expect(TRANSLATION_BASE_URL).toContain(`@${UPSTREAM_LOCALE_COMMIT}/`);
    expect(TRANSLATION_BASE_URL).not.toContain("@master/");
    expect(requestJson).toHaveBeenCalledWith(`${TRANSLATION_BASE_URL}/es.json`);
    expect(dictionary.DOWNLOAD).toBe("Descargar");
  });

  it.each([
    ["unsupported locale", "xx-INVALID", { DOWNLOAD: "ignored" }],
    ["malformed object", "es", { DOWNLOAD: 7 }],
    ["malformed JSON", "es", "{not-json"],
  ])("falls back to bundled English for a %s", async (_label, locale, response) => {
    const requestJson = vi.fn(async () => response);

    const dictionary = await loadTranslationDictionary(locale, requestJson);

    expect(dictionary).toBe(ENGLISH_DICTIONARY);
  });

  it("falls back to bundled English after a translation request failure", async () => {
    const requestJson = vi.fn(async () => {
      throw new Error("fixture translation failure");
    });

    await expect(loadTranslationDictionary("es", requestJson)).resolves.toBe(
      ENGLISH_DICTIONARY,
    );
  });

  it("retains legacy newline joining while rejecting mixed-type arrays", () => {
    expect(
      normalizeTranslationDictionary({ INTRO: ["Line one", "Line two"] }),
    ).toEqual({ INTRO: "Line one\nLine two" });
    expect(
      normalizeTranslationDictionary({ INTRO: ["Line one", 2] }),
    ).toBeNull();
  });

  it("renders HTML-like translations as literal text and title attributes", () => {
    const dom = new JSDOM(`<!doctype html><body>
      <span data-ih-locale="DOWNLOAD"></span>
      <button data-ih-locale-title="NEW_TAB"></button>
    </body>`);
    const dictionary = normalizeTranslationDictionary({
      DOWNLOAD: '<img src=x onerror="alert(1)">Download',
      NEW_TAB: 'Open <script>throw new Error("executed")</script>',
    });

    applyTranslations(dom.window.document, createTranslator(dictionary));

    const label = dom.window.document.querySelector("[data-ih-locale]");
    const button = dom.window.document.querySelector("[data-ih-locale-title]");
    expect(label.textContent).toBe('<img src=x onerror="alert(1)">Download');
    expect(label.querySelector("img")).toBeNull();
    expect(button.title).toBe(
      'Open <script>throw new Error("executed")</script>',
    );
    expect(button.querySelector("script")).toBeNull();
    dom.window.close();
  });
});
