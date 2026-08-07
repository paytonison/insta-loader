import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";

import {
  VIDEO_SURFACE,
  createPostVideoSurfaceAdapter,
  createReelVideoSurfaceAdapter,
  createStoryVideoSurfaceAdapter,
  isInstagramMuteControlMuted,
} from "../../../../src/controllers/video/surface-adapters.js";

describe("video surface adapters", () => {
  it("locates post videos, overlays, mute controls, and navigation guards", () => {
    const dom = new JSDOM(`
      <article id="root">
        <a id="reel-link" href="/reels/abc/">
          <div class="media">
            <video></video>
            <div><div id="controller-target">
              <button id="mute" type="button">
                <svg><path d="M16.636 7.028a1.5 rest"></path></svg>
              </button>
            </div></div>
          </div>
        </a>
        <div aria-label="post overlay" data-visualcompletion="ignore">
          <span id="event-target"></span>
        </div>
      </article>
    `);
    const document = dom.window.document;
    const root = document.querySelector("#root");
    const video = root.querySelector("video");
    const target = root.querySelector("#controller-target");
    const mute = root.querySelector("#mute");
    mute.style.width = "60px";
    mute.style.height = "60px";
    mute.style.padding = "8px";
    mute.getBoundingClientRect = () => ({ width: 76, height: 76 });
    const adapter = createPostVideoSurfaceAdapter();

    expect(adapter.findVideos(root)).toEqual([video]);
    expect(adapter.findControllerActivations(root, [video])).toEqual([
      { target: root, video },
      { target, video },
    ]);
    expect(adapter.findMuteControls(root, video)).toEqual([mute]);
    expect(adapter.findNavigationGuard(root, video)).toBe(
      root.querySelector("#reel-link"),
    );

    const layout = adapter.locateControllerLayout(root, video, {
      target: root.querySelector("#event-target"),
    });
    expect(layout.overlay).toBe(
      root.querySelector('[data-visualcompletion="ignore"]'),
    );
    expect(
      adapter.locateControllerLayout(root, video, {
        target: root.querySelector('[data-visualcompletion="ignore"]'),
      }).overlay,
    ).toBe(null);
    expect(layout.layers).toEqual([target]);
    expect(layout.restoreDraggableOnHide).toBe(true);
    expect(isInstagramMuteControlMuted(mute)).toBe(false);
    mute.querySelector("path").setAttribute("d", "muted-icon");
    expect(isInstagramMuteControlMuted(mute)).toBe(true);
  });

  it("locates Reel controller and native replay actions", () => {
    const dom = new JSDOM(`
      <main id="root">
        <a href="/reels/abc/"></a>
        <div class="media">
          <video></video>
          <div>
            <div role="presentation"><div>
              <button id="play" role="button">
                <svg><path d="M5.888 replay"></path></svg>
              </button>
            </div></div>
            <div role="presentation">
              <div id="controller-target" role="button" style="cursor: pointer">
                <button id="mute" type="button">
                  <svg><path d="M16.636 7.028a1.5 rest"></path></svg>
                </button>
              </div>
            </div>
            <div class="xpgaw4o" style="display: none"></div>
          </div>
        </div>
      </main>
    `);
    const document = dom.window.document;
    const root = document.querySelector("#root");
    const video = root.querySelector("video");
    const adapter = createReelVideoSurfaceAdapter();
    const activations = adapter.findControllerActivations(root, [video]);
    const action = adapter.findLoopAction(root, video);

    expect(activations).toContainEqual({
      target: root.querySelector("#controller-target"),
      video,
    });
    expect(action.button).toBe(root.querySelector("#play"));
    expect(action.reveal).toEqual([root.querySelector(".xpgaw4o")]);
    expect(adapter.controllerPosition).toBe("relative");
    expect(adapter.setVolumeOnPlayback).toBe(true);
    expect(adapter.supportsLooping).toBe(true);
    expect(
      createReelVideoSurfaceAdapter({ supportsLooping: false })
        .supportsLooping,
    ).toBe(false);
  });

  it("keeps Story and Highlight layout lookup surface-specific", () => {
    const dom = new JSDOM(`
      <section id="root" class="story-root">
        <div class="wrapper">
          <button id="mute" role="button">
            <svg><path d="M1.5 13.3c-.8 0-1.5.7-1.5 1.5v18.4c0 rest"></path></svg>
          </button>
          <div id="video-parent">
            <video></video>
            <div id="layer">
              <div aria-label="story overlay" data-visualcompletion="ignore"></div>
              <span id="event-target"></span>
            </div>
            <div id="read-more" class="read-more" role="button"></div>
          </div>
          <div id="bottom-bar"></div>
        </div>
      </section>
    `);
    const document = dom.window.document;
    const root = document.querySelector("#root");
    const video = root.querySelector("video");
    const adapter = createStoryVideoSurfaceAdapter({
      surface: VIDEO_SURFACE.HIGHLIGHT,
    });
    const activations = adapter.findControllerActivations(root, [video]);
    const layout = adapter.locateControllerLayout(root, video, {
      target: root.querySelector("#event-target"),
    });

    expect(adapter.surface).toBe(VIDEO_SURFACE.HIGHLIGHT);
    expect(adapter.supportsFullscreen).toBe(false);
    expect(adapter.supportsLooping).toBe(false);
    expect(activations.map(({ target }) => target)).toEqual(
      expect.arrayContaining([
        root.querySelector("#layer"),
        root.querySelector("#read-more"),
        root.querySelector("#bottom-bar"),
        root.querySelector("#video-parent"),
      ]),
    );
    expect(layout.overlay).toBe(
      root.querySelector('[data-visualcompletion="ignore"]'),
    );
    expect(layout.layers).toEqual([root.querySelector("#layer")]);
    expect(layout.hidden).toEqual([
      root.querySelector("#read-more"),
      root.querySelector("#bottom-bar"),
    ]);
    expect(adapter.findMuteControls(root, video)).toEqual([
      root.querySelector("#mute"),
    ]);
    expect(adapter.findControllerVideos(root, video, [])).toEqual([video]);
  });
});
