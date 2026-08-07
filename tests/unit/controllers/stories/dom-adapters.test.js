// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from "vitest";

import {
  readHighlightDomState,
  readStoryDomState,
} from "../../../../src/controllers/stories/index.js";

function progressMarkup(username) {
  return `
    <div>
      <div style="height:4px">
        <div></div>
        <div><span></span></div>
        <div></div>
      </div>
      <a href="/${username}/"><span>${username}</span></a>
      <span>viewer chrome</span>
    </div>
  `;
}

describe("Story and Highlight DOM adapters", () => {
  beforeEach(() => {
    document.documentElement.setAttribute(
      "style",
      "display:block;visibility:visible;opacity:1",
    );
    document.body.replaceChildren();
    document.body.setAttribute(
      "style",
      "display:block;visibility:visible;opacity:1",
    );
  });

  it("reads Story identity hints without mixing them with Highlight selectors", () => {
    document.body.innerHTML = `
      <div>
        <section class="_ac0a">
          <header class="_ac0k">
            <div class="_ac0l">
              <a href="/"></a><div><a href="/dom_owner/">dom_owner</a></div>
            </div>
            ${progressMarkup("dom_owner")}
            <time datetime="2023-11-14T22:13:20.000Z"></time>
            <div class="_ac3r">
              <div></div>
              <div><span class="_ac3q"></span></div>
            </div>
          </header>
          <video playsinline poster="https://cdn.example/story-poster.jpg"></video>
        </section>
      </div>
    `;

    const state = readStoryDomState(document, {
      pathname: "/stories/route_owner/300000000000000102/",
      isVisible: () => true,
    });

    expect(state).toMatchObject({
      surface: "stories",
      username: "dom_owner",
      highlightId: null,
      identity: {
        explicitMediaId: "300000000000000102",
        visibleTimestamp: 1_700_000_000,
        progressIndex: 1,
        layoutIndex: 1,
        routeMediaId: "300000000000000102",
      },
      progress: { current: 2, total: 3 },
      thumbnail: {
        available: true,
        posterUrl: "https://cdn.example/story-poster.jpg",
      },
    });
  });

  it("maps Highlight trailing progress to the existing reverse item index", () => {
    document.body.innerHTML = `
      <div>
        <section class="_ac0a">
          <a href="/fixture_user/">fixture_user</a>
          <header class="_ac0k">
            <div class="_ac3r">
              <div class="_ac3n"><div class="_ac3p" style="width:50%"></div></div>
            </div>
          </header>
          <video class="xh8yej3" poster="https://cdn.example/highlight-poster.jpg"></video>
        </section>
      </div>
    `;

    const state = readHighlightDomState(document, {
      pathname: "/stories/highlights/Highlight1/",
      itemCount: 2,
      isVisible: () => true,
    });

    expect(state).toMatchObject({
      surface: "highlights",
      username: "fixture_user",
      highlightId: "Highlight1",
      identity: {
        progressIndex: 1,
        visibleTimestamp: null,
        routeMediaId: null,
      },
      thumbnail: {
        available: true,
        posterUrl: "https://cdn.example/highlight-poster.jpg",
      },
    });
  });

  it("uses the home layout after the profile layout when both are active", () => {
    document.body.innerHTML = `
      <div>
        <section>
          <div class="x1ned7t2 x78zum5">
            <div></div>
            <div class="x1lix1fw"><span></span></div>
          </div>
          <header class="_ac0k">
            <div class="_ac3r">
              <div><span class="_ac3q"></span></div>
              <div></div>
              <div><span class="_ac3q"></span></div>
            </div>
          </header>
        </section>
      </div>
    `;

    const state = readStoryDomState(document, {
      pathname: "/stories/fixture_user/",
      isVisible: () => true,
    });

    expect(state.identity.layoutIndex).toBe(2);
  });

  it("ignores Highlight navigation and button timestamps", () => {
    document.body.innerHTML = `
      <div>
        <section>
          <a href="/stories/highlights/Highlight1/"><time datetime="2020-01-01T00:00:00Z"></time></a>
          <div role="button"><time datetime="2021-01-01T00:00:00Z"></time></div>
          <time datetime="2023-11-14T22:14:20.000Z"></time>
        </section>
      </div>
    `;

    const state = readStoryDomState(document, {
      pathname: "/stories/fixture_user/",
      isVisible: () => true,
    });

    expect(state.identity.visibleTimestamp).toBe(1_700_000_060);
  });
});
