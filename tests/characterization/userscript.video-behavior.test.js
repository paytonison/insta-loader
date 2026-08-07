// @vitest-environment node

import { readFileSync } from "node:fs";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createUserscriptRuntime,
  readUserscriptSource,
} from "./helpers/userscript-runtime.js";

const storyHtml = readFileSync(
  new URL("../fixtures/html/story.html", import.meta.url),
  "utf8",
);
const runtimes = [];

afterEach(() => {
  while (runtimes.length) runtimes.pop().dispose();
});

async function runtime(options) {
  const value = await createUserscriptRuntime(options);
  runtimes.push(value);
  return value;
}

function findMountObserver(app, mount) {
  return app.observers.mutationObservers.find((observer) =>
    observer.observations.some(
      ({ options, target }) => target === mount && options?.subtree === true,
    ),
  );
}

describe("generated userscript video behavior integration", () => {
  it("bundles the shared service and no longer carries the duplicated weak cache", () => {
    const source = readUserscriptSource();

    expect(source).toContain("var VideoBehaviorService = class");
    expect(source).toContain("createPostVideoSurfaceAdapter");
    expect(source).toContain("createReelVideoSurfaceAdapter");
    expect(source).toContain("createStoryVideoSurfaceAdapter");
    expect(source).not.toContain("GL_weakCache");
    expect(source).not.toContain("fullscreenchange.IG_videoControl");
  });

  it("mounts Story video behavior once and synchronously remounts retained DOM on reload", async () => {
    const app = await runtime({
      html: storyHtml,
      storage: {
        G_VIDEO_VOLUME: 0.35,
        MODIFY_VIDEO_VOLUME: true,
      },
      url: "https://www.instagram.com/stories/fixture_user/",
    });
    const mount = app.document.querySelector('div[id^="mount"]');
    const addedRoot = app.document.createElement("div");
    addedRoot.innerHTML = "<div><video></video></div>";
    mount.append(addedRoot);
    const video = addedRoot.querySelector("video");
    const addEventListener = vi.spyOn(video, "addEventListener");
    const removeAttribute = vi.spyOn(video, "removeAttribute");
    const removeEventListener = vi.spyOn(video, "removeEventListener");
    const storyObserver = findMountObserver(app, mount);
    expect(storyObserver).toBeDefined();
    const mutation = {
      type: "childList",
      addedNodes: [addedRoot],
    };

    storyObserver.emit([mutation]);
    storyObserver.emit([mutation]);
    video.dispatchEvent(new app.window.Event("play"));

    expect(video.volume).toBe(0.35);
    expect(video.getAttribute("data-modify")).toBe("true");
    expect(
      addEventListener.mock.calls.filter(([type]) => type === "play"),
    ).toHaveLength(1);
    expect(
      addEventListener.mock.calls.filter(([type]) => type === "timeupdate"),
    ).toHaveLength(1);
    expect(video.getAttribute("data-insta-loader-story-thumbnail-bound"))
      .toBe("true");

    app.menuByAccessKey("r").callback();
    const reloadedStoryObserver = findMountObserver(app, mount);
    expect(storyObserver.disconnected).toBe(true);
    expect(reloadedStoryObserver).toBeDefined();
    expect(reloadedStoryObserver).not.toBe(storyObserver);
    video.removeAttribute("data-modify");
    video.volume = 0.8;
    video.dispatchEvent(new app.window.Event("play"));
    expect(video.volume).toBe(0.35);
    expect(video.getAttribute("data-insta-loader-story-thumbnail-bound"))
      .toBe("true");
    expect(
      addEventListener.mock.calls.filter(([type]) => type === "timeupdate"),
    ).toHaveLength(2);
    expect(removeAttribute).toHaveBeenCalledWith(
      "data-insta-loader-story-thumbnail-bound",
    );
    expect(
      removeEventListener.mock.calls.filter(
        ([type]) => type === "timeupdate",
      ),
    ).toHaveLength(1);
  });

  it("keeps the saved-volume fallback idempotent for videos outside a managed surface", async () => {
    const app = await runtime({
      storage: {
        G_VIDEO_VOLUME: 0.42,
        MODIFY_VIDEO_VOLUME: true,
      },
      url: "https://www.instagram.com/",
    });
    const mount = app.document.querySelector('div[id^="mount"]');
    const video = app.document.createElement("video");
    const addEventListener = vi.spyOn(video, "addEventListener");
    mount.append(video);
    const observer = findMountObserver(app, mount);
    const mutation = { addedNodes: [video], type: "childList" };

    observer.emit([mutation]);
    observer.emit([mutation]);

    expect(
      addEventListener.mock.calls.filter(([type]) => type === "play"),
    ).toHaveLength(1);
    expect(
      addEventListener.mock.calls.filter(([type]) => type === "playing"),
    ).toHaveLength(1);
    video.dispatchEvent(new app.window.Event("playing"));
    expect(video.volume).toBe(0.42);
    expect(video.getAttribute("data-modify")).toBe("true");
  });

  it("rechecks the thumbnail host when a Story video is recycled", async () => {
    const app = await runtime({
      html: storyHtml,
      url: "https://www.instagram.com/stories/fixture_user/",
    });
    const mount = app.document.querySelector('div[id^="mount"]');
    const observer = findMountObserver(app, mount);
    const host = app.document.createElement("div");
    host.className = "fixture-story-host";
    host.style.width = "0px";
    const video = app.document.createElement("video");
    const addEventListener = vi.spyOn(video, "addEventListener");
    host.append(video);
    mount.append(host);

    observer.emit([{ addedNodes: [host], type: "childList" }]);
    video.dispatchEvent(new app.window.Event("timeupdate"));
    expect(video.getAttribute("data-modify-thumbnail")).toBe("true");

    const replacementHost = app.document.createElement("div");
    replacementHost.className = "fixture-story-host-recycled";
    replacementHost.style.width = "0px";
    replacementHost.append(video);
    mount.append(replacementHost);
    observer.emit([{ addedNodes: [video], type: "childList" }]);

    expect(video.hasAttribute("data-modify-thumbnail")).toBe(false);
    expect(
      addEventListener.mock.calls.filter(([type]) => type === "timeupdate"),
    ).toHaveLength(1);
    video.dispatchEvent(new app.window.Event("timeupdate"));
    expect(video.getAttribute("data-modify-thumbnail")).toBe("true");
  });
});
