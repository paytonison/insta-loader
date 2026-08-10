import jquery from "jquery";
import { JSDOM } from "jsdom";
import { describe, expect, it, vi } from "vitest";

import {
  DebugController,
  HOTKEY_CONFIGS,
  HotkeyController,
  MenuController,
  SettingsController,
} from "../../../src/controllers/index.js";
import { DisposableScope } from "../../../src/core/disposable-scope.js";
import {
  USER_SETTING_DEFAULTS,
  USER_SETTING_HIERARCHY,
} from "../../../src/core/settings-store.js";

function createHarness(url = "https://www.instagram.com/") {
  const dom = new JSDOM(
    '<!doctype html><html><body><div id="mount_0"><main>fixture</main></div></body></html>',
    { url },
  );
  const $ = jquery(dom.window);
  const menus = new Map();
  let nextMenuId = 1;
  const environment = {
    window: dom.window,
    getDocument: () => dom.window.document,
    getLocation: () => dom.window.location,
    registerMenuCommand: vi.fn((label, callback, options) => {
      const id = nextMenuId++;
      menus.set(id, { callback, label, options });
      return id;
    }),
    unregisterMenuCommand: vi.fn((id) => menus.delete(id)),
    openInTab: vi.fn(),
  };
  const createDialog = vi.fn(() => {
    $("body").append(`
      <div class="IG_POPUP_DIG">
        <div class="IG_POPUP_DIG_BG"></div>
        <div class="IG_POPUP_DIG_MAIN">
          <div class="IG_POPUP_DIG_TITLE"><div id="post_info"></div></div>
          <div class="IG_POPUP_DIG_BODY"></div>
        </div>
      </div>`);
  });

  return { $, createDialog, dom, environment, menus };
}

function mount(controller, environment) {
  const parentScope = new DisposableScope(environment);
  expect(controller.mount({ scope: parentScope })).toBe(true);
  environment
    .getDocument()
    .dispatchEvent(new environment.window.Event("DOMContentLoaded"));
  return parentScope;
}

describe("MenuController", () => {
  it("owns the exact translated command set across refresh and remount", () => {
    const { environment, menus } = createHarness();
    const actions = {
      checkForUpdate: vi.fn(),
      reload: vi.fn(),
      showDebug: vi.fn(),
      showFeedback: vi.fn(),
      showHotkeySettings: vi.fn(),
      showSettings: vi.fn(),
    };
    const controller = new MenuController({
      environment,
      translate: (key) => `translated:${key}`,
      ...actions,
    });

    expect(controller.mount()).toBe(true);
    expect(controller.mount()).toBe(false);
    expect(
      [...menus.values()].map(({ label, options }) => [
        label,
        options.accessKey,
      ]),
    ).toEqual([
      ["translated:SETTING", "w"],
      ["translated:HOTKEY_KEY_SETTINGS_KEY", "q"],
      ["translated:DONATE", "d"],
      ["translated:DEBUG", "z"],
      ["translated:FEEDBACK", "f"],
      ["translated:CHECK_FOR_UPDATE", "c"],
      ["translated:RELOAD_SCRIPT", "r"],
    ]);

    [...menus.values()].find(({ options }) => options.accessKey === "w").callback();
    [...menus.values()].find(({ options }) => options.accessKey === "q").callback();
    [...menus.values()].find(({ options }) => options.accessKey === "z").callback();
    [...menus.values()].find(({ options }) => options.accessKey === "f").callback();
    [...menus.values()].find(({ options }) => options.accessKey === "c").callback();
    [...menus.values()].find(({ options }) => options.accessKey === "r").callback();
    [...menus.values()].find(({ options }) => options.accessKey === "d").callback();
    expect(actions.showSettings).toHaveBeenCalledOnce();
    expect(actions.showHotkeySettings).toHaveBeenCalledOnce();
    expect(actions.showDebug).toHaveBeenCalledOnce();
    expect(actions.showFeedback).toHaveBeenCalledOnce();
    expect(actions.checkForUpdate).toHaveBeenCalledOnce();
    expect(actions.reload).toHaveBeenCalledOnce();
    expect(environment.openInTab).toHaveBeenCalledWith(
      "https://ko-fi.com/paytonison",
      { active: true },
    );

    const firstIds = [...menus.keys()];
    expect(controller.refresh()).toBe(true);
    expect(menus).toHaveLength(7);
    expect(environment.unregisterMenuCommand).toHaveBeenCalledTimes(7);
    expect(firstIds.every((id) => !menus.has(id))).toBe(true);

    expect(controller.dispose()).toEqual([]);
    expect(controller.dispose()).toEqual([]);
    expect(menus).toHaveLength(0);
    expect(controller.mount()).toBe(true);
    expect(menus).toHaveLength(7);
  });
});

describe("SettingsController", () => {
  function createSettingsController() {
    const harness = createHarness();
    const settings = { ...USER_SETTING_DEFAULTS };
    const state = {
      language: "en-US",
      locales: { "en-US": {} },
      renameFormat: "%USERNAME%-%SHORTCODE%",
      videoVolume: 1,
    };
    const calls = {
      clearTranslationCache: vi.fn(),
      loadTranslation: vi.fn(async () => ({ SETTING: "Configuración" })),
      onSettingChanged: vi.fn(),
      repaintTranslations: vi.fn(),
      refreshMenus: vi.fn(),
      reportAsync: vi.fn((action) => Promise.resolve(action()).catch(() => {})),
      setLanguage: vi.fn((value) => {
        state.language = value;
        return value;
      }),
      setRenameFormat: vi.fn((value) => {
        state.renameFormat = value;
        return value;
      }),
      setSetting: vi.fn((name, value) => {
        settings[name] = value;
      }),
      setVideoVolume: vi.fn((value) => {
        state.videoVolume = value;
        return value;
      }),
    };
    const controller = new SettingsController({
      $: harness.$,
      environment: harness.environment,
      settings,
      localeManifest: { "en-US": "English", es: "Español" },
      parentChildMapping: USER_SETTING_HIERARCHY,
      icons: { close: '<svg data-icon="close"></svg>' },
      createDialog: harness.createDialog,
      translate: (key) => key,
      translateHtml: (key) => `translated:${key}`,
      model: {
        getLanguage: () => state.language,
        setLanguage: calls.setLanguage,
        hasLocale: (language) => state.locales[language] != null,
        setLocale: (language, dictionary) => {
          state.locales[language] = dictionary;
        },
        clearTranslationCache: calls.clearTranslationCache,
        getVideoVolume: () => state.videoVolume,
        setVideoVolume: calls.setVideoVolume,
        getRenameFormat: () => state.renameFormat,
        setRenameFormat: calls.setRenameFormat,
        setSetting: calls.setSetting,
      },
      loadTranslation: calls.loadTranslation,
      repaintTranslations: calls.repaintTranslations,
      refreshMenus: calls.refreshMenus,
      reportAsync: calls.reportAsync,
      onSettingChanged: calls.onSettingChanged,
    });
    return { ...harness, calls, controller, settings, state };
  }

  it("preserves the 21-key order, checked state, and visual-only hierarchy", () => {
    const harness = createSettingsController();
    mount(harness.controller, harness.environment);
    expect(harness.controller.show()).toBe(true);

    const ids = [...harness.dom.window.document.querySelectorAll(
      '.IG_POPUP_DIG_SETTINGS input[value="box"]',
    )].map((input) => input.id);
    expect(ids).toEqual([
      "CHECK_FOR_UPDATE",
      "AUTO_RENAME",
      "RENAME_PUBLISH_DATE",
      "CAPTURE_IMAGE_VIA_MEDIA_CACHE",
      "DIRECT_DOWNLOAD_ALL",
      "DIRECT_DOWNLOAD_STORY",
      "DIRECT_DOWNLOAD_VISIBLE_RESOURCE",
      "DISABLE_VIDEO_LOOPING",
      "FORCE_FETCH_ALL_RESOURCES",
      "FORCE_RESOURCE_VIA_MEDIA",
      "FALLBACK_TO_BLOB_FETCH_IF_MEDIA_API_THROTTLED",
      "NEW_TAB_ALWAYS_FORCE_MEDIA_IN_POST",
      "PREFER_DASH_MANIFEST",
      "HTML5_VIDEO_CONTROL",
      "MAX_REEL_PLAYBACK_QUALITY",
      "MODIFY_RESOURCE_EXIF",
      "MODIFY_VIDEO_VOLUME",
      "REDIRECT_CLICK_USER_STORY_PICTURE",
      "SCROLL_BUTTON",
      "SKIP_VIEW_STORY_CONFIRM",
      "SKIP_SHARED_WITH_YOU_DIALOG",
    ]);
    expect(
      harness.dom.window.document.querySelector("#RENAME_PUBLISH_DATE").closest(
        "label",
      ).classList,
    ).toContain("child");
    expect(
      harness.dom.window.document
        .querySelector("#FALLBACK_TO_BLOB_FETCH_IF_MEDIA_API_THROTTLED")
        .closest("label").classList,
    ).toContain("child");
    expect(
      harness.dom.window.document.querySelector("#AUTO_RENAME").checked,
    ).toBe(true);
  });

  it("persists boolean, volume, rename, and locale changes exactly once", async () => {
    const harness = createSettingsController();
    mount(harness.controller, harness.environment);
    harness.controller.show();
    const { document, Event, MouseEvent } = harness.dom.window;

    const child = document.querySelector("#RENAME_PUBLISH_DATE");
    child.checked = false;
    child.dispatchEvent(new Event("change", { bubbles: true }));
    expect(harness.calls.setSetting).toHaveBeenCalledWith(
      "RENAME_PUBLISH_DATE",
      false,
    );
    expect(harness.settings.AUTO_RENAME).toBe(true);

    const maxQuality = document.querySelector("#MAX_REEL_PLAYBACK_QUALITY");
    maxQuality.checked = false;
    maxQuality.dispatchEvent(new Event("change", { bubbles: true }));
    expect(harness.calls.onSettingChanged).toHaveBeenLastCalledWith(
      "MAX_REEL_PLAYBACK_QUALITY",
      false,
    );

    const volumeLabel = document.querySelector("#MODIFY_VIDEO_VOLUME").closest(
      "label",
    );
    volumeLabel.dispatchEvent(
      new MouseEvent("contextmenu", { bubbles: true, cancelable: true }),
    );
    const range = volumeLabel.querySelector('input[type="range"]');
    const number = volumeLabel.querySelector('input[type="number"]');
    range.value = "0";
    range.dispatchEvent(new Event("change", { bubbles: true }));
    expect(harness.calls.setVideoVolume).toHaveBeenLastCalledWith("0");
    number.value = "-1";
    number.dispatchEvent(new Event("input", { bubbles: true }));
    expect(number.value).toBe("0");

    const renameLabel = document.querySelector("#AUTO_RENAME").closest("label");
    renameLabel.dispatchEvent(
      new MouseEvent("contextmenu", { bubbles: true, cancelable: true }),
    );
    const rename = renameLabel.querySelector("#date_format");
    rename.value = "%SHORTCODE%-fixture";
    rename.dispatchEvent(new Event("input", { bubbles: true }));
    expect(harness.calls.setRenameFormat).toHaveBeenLastCalledWith(
      "%SHORTCODE%-fixture",
    );

    const language = document.querySelector("#langSelect");
    language.value = "es";
    language.dispatchEvent(new Event("change", { bubbles: true }));
    await Promise.resolve();
    await Promise.resolve();
    expect(harness.calls.loadTranslation).toHaveBeenCalledWith("es");
    expect(harness.calls.repaintTranslations).toHaveBeenCalledOnce();
    expect(harness.calls.refreshMenus).toHaveBeenCalledOnce();
  });

  it("removes its dialog/listeners on idempotent disposal and remounts cleanly", () => {
    const harness = createSettingsController();
    const firstScope = mount(harness.controller, harness.environment);
    harness.controller.show();
    const oldRoot = harness.dom.window.document.querySelector(
      ".IG_POPUP_DIG_SETTINGS",
    );

    expect(harness.controller.dispose()).toEqual([]);
    expect(harness.controller.dispose()).toEqual([]);
    expect(oldRoot.isConnected).toBe(false);
    const detachedInput = harness.dom.window.document.createElement("input");
    detachedInput.id = "SCROLL_BUTTON";
    harness.dom.window.document.body.appendChild(detachedInput);
    detachedInput.dispatchEvent(
      new harness.dom.window.Event("change", { bubbles: true }),
    );
    expect(harness.calls.setSetting).not.toHaveBeenCalledWith(
      "SCROLL_BUTTON",
      expect.anything(),
    );
    detachedInput.remove();
    firstScope.dispose();

    mount(harness.controller, harness.environment);
    harness.controller.show();
    const setting = harness.dom.window.document.querySelector(
      ".IG_POPUP_DIG_SETTINGS #SCROLL_BUTTON",
    );
    setting.checked = true;
    setting.dispatchEvent(
      new harness.dom.window.Event("change", { bubbles: true }),
    );
    expect(
      harness.calls.setSetting.mock.calls.filter(([name]) => name === "SCROLL_BUTTON"),
    ).toHaveLength(1);
  });
});

describe("HotkeyController", () => {
  function createHotkeyController(url) {
    const harness = createHarness(url);
    const bindings = {
      debugHotkeyKeyCode: 90,
      downloadStoryHotkeyKeyCode: 83,
      keySettingsHotkeyKeyCode: 67,
      settingsHotkeyKeyCode: 87,
    };
    const writes = [];
    const actions = {
      reload: vi.fn(),
      showDebug: vi.fn(),
      showSettings: vi.fn(),
    };
    const controller = new HotkeyController({
      $: harness.$,
      environment: harness.environment,
      createDialog: harness.createDialog,
      translateHtml: (key) => `translated:${key}`,
      model: {
        get: (stateKey) => bindings[stateKey],
        set(preferenceName, stateKey, value) {
          bindings[stateKey] = value;
          writes.push({ preferenceName, stateKey, value });
        },
      },
      ...actions,
    });
    return { ...harness, actions, bindings, controller, writes };
  }

  it("preserves row attributes, option order, strict conflicts, and reset fallback", () => {
    const harness = createHotkeyController();
    mount(harness.controller, harness.environment);
    harness.controller.show();

    const rows = [...harness.dom.window.document.querySelectorAll(
      ".hotkey-setting-item",
    )];
    expect(rows.map((row) => row.dataset.hotkey)).toEqual(
      HOTKEY_CONFIGS.map(({ name }) => name),
    );
    const settingsSelect = rows[0].querySelector(".hotkey-preset");
    expect(settingsSelect.dataset.storage).toBe("G_HOTKEY_SETTINGS_KEYCODE");
    expect(settingsSelect.dataset.state).toBe("settingsHotkeyKeyCode");
    expect(settingsSelect.dataset.default).toBe("87");
    expect([...settingsSelect.options].map(({ value }) => value).at(-1)).toBe(
      "87",
    );

    harness.bindings.debugHotkeyKeyCode = "75";
    expect(harness.controller.hasConflict(75, "settingsHotkeyKeyCode")).toBe(
      false,
    );
    harness.bindings.debugHotkeyKeyCode = 75;
    expect(harness.controller.hasConflict(75, "settingsHotkeyKeyCode")).toBe(
      true,
    );
    settingsSelect.value = "75";
    settingsSelect.dispatchEvent(
      new harness.dom.window.Event("change", { bubbles: true }),
    );
    expect(harness.writes.at(-1)).toEqual({
      preferenceName: "settings",
      stateKey: "settingsHotkeyKeyCode",
      value: 87,
    });
    expect(settingsSelect.value).toBe("87");

    rows[0].querySelector(".hotkey-reset").dispatchEvent(
      new harness.dom.window.MouseEvent("click", { bubbles: true }),
    );
    expect(harness.writes.at(-1).value).toBe(87);
  });

  it("keeps independent duplicate shortcut dispatch order and Story triggering", () => {
    const harness = createHotkeyController(
      "https://www.instagram.com/stories/fixture/123/",
    );
    mount(harness.controller, harness.environment);
    const order = [];
    harness.actions.showSettings.mockImplementation(() => order.push("settings"));
    vi.spyOn(harness.controller, "show").mockImplementation(() => {
      order.push("hotkeys");
      return true;
    });
    harness.actions.showDebug.mockImplementation(() => order.push("debug"));
    harness.bindings.settingsHotkeyKeyCode = 75;
    harness.bindings.keySettingsHotkeyKeyCode = 75;
    harness.bindings.debugHotkeyKeyCode = 75;

    harness.$(harness.environment.window).trigger(
      harness.$.Event("keydown", { altKey: true, which: 75 }),
    );
    expect(order).toEqual(["settings", "hotkeys", "debug"]);

    const story = harness.dom.window.document.createElement("button");
    story.className = "IG_DWSTORY";
    const storyClick = vi.fn();
    story.addEventListener("click", storyClick);
    harness.dom.window.document.body.appendChild(story);
    harness.$(harness.environment.window).trigger(
      harness.$.Event("keydown", { altKey: true, which: 83 }),
    );
    expect(storyClick).toHaveBeenCalledOnce();

    harness.$(harness.environment.window).trigger(
      harness.$.Event("keydown", { altKey: true, which: 82 }),
    );
    expect(harness.actions.reload).toHaveBeenCalledOnce();
  });

  it("removes its dialog and key listener on dispose, then remounts once", () => {
    const harness = createHotkeyController();
    mount(harness.controller, harness.environment);
    harness.controller.show();
    expect(harness.controller.dispose()).toEqual([]);
    expect(harness.controller.dispose()).toEqual([]);
    expect(
      harness.dom.window.document.querySelector(".IG_POPUP_DIG_HOTKEYS"),
    ).toBeNull();
    harness.$(harness.environment.window).trigger(
      harness.$.Event("keydown", { altKey: true, which: 90 }),
    );
    expect(harness.actions.showDebug).not.toHaveBeenCalled();

    mount(harness.controller, harness.environment);
    harness.$(harness.environment.window).trigger(
      harness.$.Event("keydown", { altKey: true, which: 90 }),
    );
    expect(harness.actions.showDebug).toHaveBeenCalledOnce();
  });
});

describe("DebugController", () => {
  it("owns exact Debug/Feedback actions, DOM export, and disposal", () => {
    const harness = createHarness("https://www.instagram.com/p/FixturePost/");
    const createObjectURL = vi.fn(() => "blob:debug-fixture");
    const revokeObjectURL = vi.fn();
    Object.defineProperty(harness.environment.window.URL, "createObjectURL", {
      configurable: true,
      value: createObjectURL,
    });
    Object.defineProperty(harness.environment.window.URL, "revokeObjectURL", {
      configurable: true,
      value: revokeObjectURL,
    });
    harness.dom.window.document.execCommand = vi.fn();
    const anchorClick = vi
      .spyOn(harness.environment.window.HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});
    const jqueryValue = harness.$('<div id="logged" class="fixture"></div>');
    const controller = new DebugController({
      $: harness.$,
      environment: harness.environment,
      createDialog: harness.createDialog,
      translateHtml: (key) => `translated:${key}`,
      getLogs: () => [{ time: 0, content: [jqueryValue] }],
      isJQuery: (value) => value instanceof harness.$,
    });
    mount(controller, harness.environment);

    expect(controller.showDebug()).toBe(true);
    const document = harness.dom.window.document;
    expect(document.querySelector("#post_info").textContent).toBe(
      "IG Debug DOM Tree",
    );
    expect(
      document.querySelector(".IG_REPORT_GITHUB a").getAttribute("href"),
    ).toBe("https://github.com/paytonison/insta-loader/issues");
    document.querySelector(".IG_DISPLAY_DOM_TREE").dispatchEvent(
      new harness.dom.window.MouseEvent("click", { bubbles: true }),
    );
    const debugText = document.querySelector("textarea").textContent;
    expect(debugText).toContain("1970-01-01T00:00:00.000Z");
    expect(debugText).toContain('"tagName": "DIV"');
    expect(debugText).toContain("Location: /p/FixturePost/");

    document.querySelector(".IG_SELECT_DOM_TREE").dispatchEvent(
      new harness.dom.window.MouseEvent("click", { bubbles: true }),
    );
    expect(document.execCommand).toHaveBeenCalledWith("copy");
    document.querySelector(".IG_DOWNLOAD_DOM_TREE").dispatchEvent(
      new harness.dom.window.MouseEvent("click", { bubbles: true }),
    );
    expect(createObjectURL).toHaveBeenCalledOnce();
    expect(anchorClick).toHaveBeenCalledOnce();

    expect(controller.showFeedback()).toBe(true);
    expect(document.querySelector("#post_info").textContent).toBe(
      "Feedback Options",
    );
    expect(document.querySelector(".IG_REPORT_FORK")).not.toBeNull();

    expect(controller.dispose()).toEqual([]);
    expect(controller.dispose()).toEqual([]);
    expect(document.querySelector(".IG_POPUP_DIG_FEEDBACK")).toBeNull();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:debug-fixture");
  });
});
