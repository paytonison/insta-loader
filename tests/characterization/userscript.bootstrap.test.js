// @vitest-environment node

import { afterEach, beforeAll, describe, expect, it } from "vitest";

import { buildUserscript } from "../../scripts/build.mjs";
import { createUserscriptRuntime } from "./helpers/userscript-runtime.js";

const settingKeys = [
  "AUTO_RENAME",
  "CAPTURE_IMAGE_VIA_MEDIA_CACHE",
  "CHECK_FOR_UPDATE",
  "DIRECT_DOWNLOAD_ALL",
  "DIRECT_DOWNLOAD_STORY",
  "DIRECT_DOWNLOAD_VISIBLE_RESOURCE",
  "DISABLE_VIDEO_LOOPING",
  "FALLBACK_TO_BLOB_FETCH_IF_MEDIA_API_THROTTLED",
  "FORCE_FETCH_ALL_RESOURCES",
  "FORCE_RESOURCE_VIA_MEDIA",
  "HTML5_VIDEO_CONTROL",
  "MAX_REEL_PLAYBACK_QUALITY",
  "MODIFY_RESOURCE_EXIF",
  "MODIFY_VIDEO_VOLUME",
  "NEW_TAB_ALWAYS_FORCE_MEDIA_IN_POST",
  "PREFER_DASH_MANIFEST",
  "REDIRECT_CLICK_USER_STORY_PICTURE",
  "RENAME_PUBLISH_DATE",
  "SCROLL_BUTTON",
  "SKIP_SHARED_WITH_YOU_DIALOG",
  "SKIP_VIEW_STORY_CONFIRM",
];

const runtimes = [];
let currentUserscriptSource;

beforeAll(async () => {
  const contents = await buildUserscript({ write: false });
  currentUserscriptSource = new TextDecoder().decode(contents);
});

afterEach(() => {
  while (runtimes.length) runtimes.pop().dispose();
});

async function runtime(options = {}) {
  const value = await createUserscriptRuntime({
    userscriptSource: currentUserscriptSource,
    ...options,
  });
  runtimes.push(value);
  return value;
}

describe("userscript bootstrap and storage contract", () => {
  it("boots with browser and userscript APIs mocked", async () => {
    const app = await runtime();

    expect(app.styles).toHaveLength(2);
    expect(app.styles[0]).toContain("[data-ih-locale-title] svg");
    expect(app.styles[1]).toContain("--insta-loader-font");
    expect(app.menuByAccessKey("w")).toBeDefined();
    expect(app.menuByAccessKey("r")).toBeDefined();
    expect(
      app.requests.some((request) =>
        request.url.includes("/locale/translations/en-US.json"),
      ),
    ).toBe(false);
    expect(app.observers.mutationObservers.length).toBeGreaterThanOrEqual(3);
    expect(app.observers.intersectionObservers).toHaveLength(1);
  });

  it("owns one translated menu set across reloads without retaining stale IDs", async () => {
    const app = await runtime();
    const expectedMenus = [
      ["c", "Check for Script Updates"],
      ["d", "Donate"],
      ["f", "Feedback"],
      ["q", "Hotkey Settings"],
      ["r", "Reload Script"],
      ["w", "Settings"],
      ["z", "Debug Window"],
    ];
    const readMenus = () =>
      [...app.menuCommands.values()]
        .map((command) => [command.options.accessKey, command.label])
        .sort(([left], [right]) => left.localeCompare(right));

    expect(readMenus()).toEqual(expectedMenus);

    const firstOwnedIds = [...app.menuCommands.keys()];
    app.menuByAccessKey("w").callback();
    const settingsBeforeReload = app.document.querySelector(
      ".IG_POPUP_DIG_SETTINGS",
    );
    expect(settingsBeforeReload).not.toBeNull();
    const reload = app.menuByAccessKey("r").callback;
    reload();
    expect(settingsBeforeReload.isConnected).toBe(false);
    expect(app.document.querySelectorAll(".IG_POPUP_DIG_SETTINGS")).toHaveLength(
      0,
    );
    reload();

    expect(readMenus()).toEqual(expectedMenus);
    expect(firstOwnedIds.every((id) => app.unregisteredMenuIds.includes(id))).toBe(
      true,
    );
    expect(new Set(app.unregisteredMenuIds).size).toBe(
      app.unregisteredMenuIds.length,
    );

    const writesBeforeHotkey = app.storageWrites.filter(
      ({ key }) => key === "SCROLL_BUTTON",
    ).length;
    app.window.jQuery(app.window).trigger(
      app.window.jQuery.Event("keydown", { altKey: true, which: 87 }),
    );
    expect(app.document.querySelectorAll(".IG_POPUP_DIG")).toHaveLength(1);

    const scrollSetting = app.document.querySelector("#SCROLL_BUTTON");
    scrollSetting.checked = !scrollSetting.checked;
    scrollSetting.dispatchEvent(
      new app.window.Event("change", { bubbles: true }),
    );
    expect(
      app.storageWrites.filter(({ key }) => key === "SCROLL_BUTTON"),
    ).toHaveLength(writesBeforeHotkey + 1);

    const idsBeforeTranslationRepaint = [...app.menuCommands.keys()];
    app.menuByAccessKey("w").callback();
    const language = app.document.querySelector("#langSelect");
    language.value = "en-US";
    language.dispatchEvent(new app.window.Event("change", { bubbles: true }));

    expect(readMenus()).toEqual(expectedMenus);
    expect(
      idsBeforeTranslationRepaint.every((id) =>
        app.unregisteredMenuIds.includes(id),
      ),
    ).toBe(true);
    expect(new Set(app.unregisteredMenuIds).size).toBe(
      app.unregisteredMenuIds.length,
    );
  });

  it("recycles source application work and retries an aborted current locale", async () => {
    const app = await runtime({
      network: [
        {
          match: "/es.json",
          response: {
            body: {
              AUTO_RENAME: "Renombrar archivos automáticamente",
              SETTING: "Configuración",
            },
            defer: true,
          },
        },
      ],
      storage: { UI_LANGUAGE: "es" },
      userscriptSource: currentUserscriptSource,
    });
    const localeRequests = () =>
      app.requests.filter((request) => request.url.endsWith("/es.json"));
    const firstLocaleRequest = localeRequests()[0];
    const firstMenuIds = [...app.menuCommands.keys()];

    expect(firstLocaleRequest).toBeDefined();
    expect(app.deferredRequests).toHaveLength(1);

    app.menuByAccessKey("r").callback();
    await app.flushMicrotasks(12);

    expect(app.abortedRequests).toContain(firstLocaleRequest);
    expect(localeRequests()).toHaveLength(2);
    expect(app.deferredRequests).toHaveLength(1);
    expect(firstMenuIds.every((id) => app.unregisteredMenuIds.includes(id))).toBe(
      true,
    );
    expect(app.menuCommands.size).toBe(7);

    const writesBeforeHotkey = app.storageWrites.filter(
      ({ key }) => key === "SCROLL_BUTTON",
    ).length;
    app.window.jQuery(app.window).trigger(
      app.window.jQuery.Event("keydown", { altKey: true, which: 87 }),
    );
    expect(app.document.querySelectorAll(".IG_POPUP_DIG")).toHaveLength(1);
    const scrollSetting = app.document.querySelector("#SCROLL_BUTTON");
    scrollSetting.checked = !scrollSetting.checked;
    scrollSetting.dispatchEvent(
      new app.window.Event("change", { bubbles: true }),
    );
    expect(
      app.storageWrites.filter(({ key }) => key === "SCROLL_BUTTON"),
    ).toHaveLength(writesBeforeHotkey + 1);

    expect(app.resolveDeferredRequests("/es.json")).toBe(1);
    await app.flushMicrotasks(12);
    expect(app.menuByAccessKey("w").label).toBe("Configuración");
  });

  it("aborts a source update request when the application reloads", async () => {
    const app = await runtime({
      network: [
        {
          match: "raw.githubusercontent.com/paytonison/insta-loader",
          response: { body: "// @version 9.9.9", defer: true },
        },
      ],
      userscriptSource: currentUserscriptSource,
    });

    app.menuByAccessKey("c").callback();
    await app.flushMicrotasks();
    const updateRequest = app.requests.find((request) =>
      request.url.includes("raw.githubusercontent.com/paytonison/insta-loader"),
    );
    expect(updateRequest).toBeDefined();
    expect(
      app.deferredRequests.some(({ request }) => request === updateRequest),
    ).toBe(true);

    app.menuByAccessKey("r").callback();
    await app.flushMicrotasks();

    expect(app.abortedRequests).toContain(updateRequest);
    expect(
      app.deferredRequests.some(({ request }) => request === updateRequest),
    ).toBe(false);
    expect(app.menuCommands.size).toBe(7);
  });

  it("reads every established setting and storage key without renaming them", async () => {
    const app = await runtime();
    const reads = new Set(app.storageReads);

    settingKeys.forEach((key) => expect(reads.has(key), key).toBe(true));
    [
      "G_VIDEO_VOLUME",
      "G_RENAME_FORMAT",
      "UI_LANGUAGE",
      "G_HOTKEY_DEBUG_KEYCODE",
      "G_HOTKEY_SETTINGS_KEYCODE",
      "G_HOTKEY_KEY_SETTINGS_KEYCODE",
      "G_HOTKEY_DOWNLOAD_STORY_KEYCODE",
      "URLS_OF_IMAGES_TEMPORARILY_STORED",
    ].forEach((key) => expect(reads.has(key), key).toBe(true));
  });

  it("honors only stored booleans when applying boolean preferences", async () => {
    const app = await runtime({
      storage: {
        AUTO_RENAME: "false",
        DIRECT_DOWNLOAD_ALL: false,
        MAX_REEL_PLAYBACK_QUALITY: false,
      },
    });

    app.menuByAccessKey("w").callback();

    expect(app.document.querySelector("#AUTO_RENAME").checked).toBe(true);
    expect(app.document.querySelector("#DIRECT_DOWNLOAD_ALL").checked).toBe(false);
    expect(app.document.querySelector("#MAX_REEL_PLAYBACK_QUALITY").checked).toBe(false);
  });

  it("persists a changed setting under its existing key", async () => {
    const app = await runtime();
    app.menuByAccessKey("w").callback();
    const checkbox = app.document.querySelector("#SCROLL_BUTTON");

    checkbox.checked = true;
    checkbox.dispatchEvent(new app.window.Event("change", { bubbles: true }));

    expect(app.storage.get("SCROLL_BUTTON")).toBe(true);
    expect(app.storageWrites).toContainEqual({ key: "SCROLL_BUTTON", value: true });
  });

  it("round-trips hotkey, language, and rename preferences through their established keys", async () => {
    const app = await runtime();
    app.menuByAccessKey("q").callback();

    const hotkey = app.document.querySelector(
      '.hotkey-preset[data-storage="G_HOTKEY_SETTINGS_KEYCODE"]',
    );
    hotkey.value = "75";
    hotkey.dispatchEvent(new app.window.Event("change", { bubbles: true }));

    app.menuByAccessKey("w").callback();
    const language = app.document.querySelector("#langSelect");
    language.value = "es";
    language.dispatchEvent(new app.window.Event("change", { bubbles: true }));

    const renameLabel = app.document
      .querySelector("#AUTO_RENAME")
      .closest("label");
    renameLabel.dispatchEvent(
      new app.window.MouseEvent("contextmenu", {
        bubbles: true,
        cancelable: true,
      }),
    );
    const rename = renameLabel.querySelector("#date_format");
    const renameFormat =
      "%USERNAME%-%SHORTCODE%-%YEAR%%MONTH%%DAY%-%ORIGINAL_NAME_FIRST%";
    rename.value = renameFormat;
    rename.dispatchEvent(new app.window.Event("input", { bubbles: true }));
    await app.flushMicrotasks();

    expect(app.storage.get("G_HOTKEY_SETTINGS_KEYCODE")).toBe(75);
    expect(app.storage.get("UI_LANGUAGE")).toBe("es");
    expect(app.storage.get("G_RENAME_FORMAT")).toBe(renameFormat);
    expect(app.storageWrites).toEqual(
      expect.arrayContaining([
        { key: "G_HOTKEY_SETTINGS_KEYCODE", value: 75 },
        { key: "UI_LANGUAGE", value: "es" },
        { key: "G_RENAME_FORMAT", value: renameFormat },
      ]),
    );

    const restored = await runtime({
      storage: Object.fromEntries(app.storage),
    });
    restored.menuByAccessKey("q").callback();
    expect(
      restored.document.querySelector(
        '.hotkey-preset[data-storage="G_HOTKEY_SETTINGS_KEYCODE"]',
      ).value,
    ).toBe("75");

    restored.menuByAccessKey("w").callback();
    expect(restored.document.querySelector("#langSelect").value).toBe("es");
    const restoredRenameLabel = restored.document
      .querySelector("#AUTO_RENAME")
      .closest("label");
    restoredRenameLabel.dispatchEvent(
      new restored.window.MouseEvent("contextmenu", {
        bubbles: true,
        cancelable: true,
      }),
    );
    expect(restoredRenameLabel.querySelector("#date_format").value).toBe(
      renameFormat,
    );
  });

  it("keeps a locale request alive across navigation and ignores its stale repaint", async () => {
    const app = await runtime({
      network: [
        {
          match: "/es.json",
          response: {
            body: {
              AUTO_RENAME: "Renombrar archivos automáticamente",
              SETTING: "Configuración",
            },
            defer: true,
          },
        },
      ],
    });
    app.menuByAccessKey("w").callback();
    const language = app.document.querySelector("#langSelect");
    language.value = "es";
    language.dispatchEvent(new app.window.Event("change", { bubbles: true }));
    await app.flushMicrotasks();

    const localeRequest = app.requests.find((request) =>
      request.url.endsWith("/es.json"),
    );
    expect(localeRequest).toBeDefined();
    expect(app.deferredRequests).toHaveLength(1);

    app.window.history.pushState({}, "", "/reels/FeedReel1/");
    app.clock.runIntervalsOnce();
    await app.flushMicrotasks();

    expect(app.abortedRequests).not.toContain(localeRequest);
    expect(app.deferredRequests).toHaveLength(1);

    language.value = "en-US";
    language.dispatchEvent(new app.window.Event("change", { bubbles: true }));
    await app.flushMicrotasks();
    expect(app.storage.get("UI_LANGUAGE")).toBe("en-US");
    expect(app.menuByAccessKey("w").label).toBe("Settings");
    expect(
      app.document.querySelector('[data-ih-locale="AUTO_RENAME"]').textContent,
    ).toBe("Automatically Rename Files (Right-Click to Set)");

    expect(app.resolveDeferredRequests("/es.json")).toBe(1);
    await app.flushMicrotasks(12);

    expect(app.abortedRequests).not.toContain(localeRequest);
    expect(app.menuByAccessKey("w").label).toBe("Settings");
    expect(
      app.document.querySelector('[data-ih-locale="AUTO_RENAME"]').textContent,
    ).toBe("Automatically Rename Files (Right-Click to Set)");

    language.value = "es";
    language.dispatchEvent(new app.window.Event("change", { bubbles: true }));
    await app.flushMicrotasks();

    expect(
      app.requests.filter((request) => request.url.endsWith("/es.json")),
    ).toHaveLength(1);
    expect(app.menuByAccessKey("w").label).toBe("Configuración");
    expect(
      app.document.querySelector('[data-ih-locale="AUTO_RENAME"]').textContent,
    ).toBe("Renombrar archivos automáticamente");
  });
});
