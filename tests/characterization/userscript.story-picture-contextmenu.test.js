// @vitest-environment node

import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { buildUserscript } from "../../scripts/build.mjs";
import { createUserscriptRuntime } from "./helpers/userscript-runtime.js";

const runtimes = [];
let currentUserscriptSource;

beforeAll(async () => {
  const contents = await buildUserscript({ write: false });
  currentUserscriptSource = new TextDecoder().decode(contents);
});

afterEach(() => {
  while (runtimes.length) runtimes.pop().dispose();
});

async function runtime() {
  const value = await createUserscriptRuntime({
    storage: { REDIRECT_CLICK_USER_STORY_PICTURE: true },
    userscriptSource: currentUserscriptSource,
    url: "https://www.instagram.com/",
  });
  runtimes.push(value);
  return value;
}

function appendStoryMenuItem(app) {
  const menuItem = app.document.createElement("button");
  menuItem.setAttribute("role", "menuitem");
  menuItem.innerHTML = `
    <canvas class="_aarh"></canvas>
    <img alt="fixture story profile">
    <div>fixture_user</div>
  `;
  app.document.body.append(menuItem);
  return {
    image: menuItem.querySelector("img"),
    menuItem,
  };
}

function triggerMiddleMouseDown(app, target) {
  const event = app.window.jQuery.Event("mousedown", { which: 2 });
  app.window.jQuery(target).trigger(event);
  return event;
}

function dispatchContextMenu(app, target) {
  const event = new app.window.MouseEvent("contextmenu", {
    bubbles: true,
    cancelable: true,
  });
  target.dispatchEvent(event);
  return event;
}

describe("Story profile-picture context-menu lifecycle", () => {
  it("releases the direct listener and marker on reload, then binds once in the new application scope", async () => {
    const app = await runtime();
    const { image, menuItem } = appendStoryMenuItem(app);
    const addEventListener = vi.spyOn(image, "addEventListener");
    const removeEventListener = vi.spyOn(image, "removeEventListener");

    const initialMouseDown = triggerMiddleMouseDown(app, menuItem);
    expect(initialMouseDown.isDefaultPrevented()).toBe(true);
    expect(app.openedTabs).toEqual([
      {
        options: undefined,
        url: "https://www.instagram.com/fixture_user",
      },
    ]);
    expect(app.window.jQuery(image).data("contextmenu")).toBe(true);
    expect(dispatchContextMenu(app, image).defaultPrevented).toBe(true);
    expect(
      addEventListener.mock.calls.filter(([type]) => type === "contextmenu"),
    ).toHaveLength(1);

    app.menuByAccessKey("r").callback();

    expect(app.window.jQuery(image).data("contextmenu")).toBeUndefined();
    expect(dispatchContextMenu(app, image).defaultPrevented).toBe(false);
    expect(
      removeEventListener.mock.calls.filter(([type]) => type === "contextmenu"),
    ).toHaveLength(1);

    const reloadedMouseDown = triggerMiddleMouseDown(app, menuItem);
    expect(reloadedMouseDown.isDefaultPrevented()).toBe(true);
    expect(app.window.jQuery(image).data("contextmenu")).toBe(true);
    expect(dispatchContextMenu(app, image).defaultPrevented).toBe(true);
    expect(
      addEventListener.mock.calls.filter(([type]) => type === "contextmenu"),
    ).toHaveLength(2);
    expect(app.openedTabs).toHaveLength(2);
  });

  it("restores the native context menu immediately when the setting is disabled", async () => {
    const app = await runtime();
    const { image, menuItem } = appendStoryMenuItem(app);
    const removeEventListener = vi.spyOn(image, "removeEventListener");

    triggerMiddleMouseDown(app, menuItem);
    expect(app.window.jQuery(image).data("contextmenu")).toBe(true);
    expect(dispatchContextMenu(app, image).defaultPrevented).toBe(true);
    expect(app.openedTabs).toHaveLength(1);

    app.menuByAccessKey("w").callback();
    const setting = app.document.querySelector(
      "#REDIRECT_CLICK_USER_STORY_PICTURE",
    );
    setting.checked = false;
    setting.dispatchEvent(new app.window.Event("change", { bubbles: true }));

    expect(app.storage.get("REDIRECT_CLICK_USER_STORY_PICTURE")).toBe(false);
    expect(app.window.jQuery(image).data("contextmenu")).toBeUndefined();
    expect(dispatchContextMenu(app, image).defaultPrevented).toBe(false);
    expect(
      removeEventListener.mock.calls.filter(([type]) => type === "contextmenu"),
    ).toHaveLength(1);

    const disabledMouseDown = triggerMiddleMouseDown(app, menuItem);
    expect(disabledMouseDown.isDefaultPrevented()).toBe(false);
    expect(app.openedTabs).toHaveLength(1);
  });
});
