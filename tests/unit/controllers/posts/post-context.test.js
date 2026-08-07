// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";

import { resolvePostContext } from "../../../../src/controllers/posts/post-context.js";

function installPostMarkup({ includeMainLink = true } = {}) {
  document.body.innerHTML = `
    <article id="post" data-username="fixture_owner">
      ${includeMainLink ? '<a href="/p/MainCode/">main post</a>' : ""}
    </article>
    <div id="action-host">
      <div class="action-layer">
        <div class="button-wrapper">
          <button id="action" type="button">Download</button>
        </div>
      </div>
      <div class="fallback-root">
        <div class="fallback-middle">
          <div class="fallback-terminal">
            <a href="/p/FirstActionCode/">first fallback</a>
            <a href="/p/LastActionCode/">last fallback</a>
          </div>
        </div>
      </div>
    </div>
  `;

  return {
    mainElement: document.querySelector("#post"),
    actionElement: document.querySelector("#action"),
    actionHost: document.querySelector("#action-host"),
  };
}

describe("resolvePostContext", () => {
  beforeEach(() => {
    document.body.replaceChildren();
  });

  it("prefers the final route segment and resolves owner, index, and action host", () => {
    const { mainElement, actionElement, actionHost } = installPostMarkup();
    const resolveVisibleIndex = vi.fn(() => 2);

    const context = resolvePostContext({
      mainElement,
      actionElement,
      pathname: "/p/RouteCode/",
      resolveVisibleIndex,
    });

    expect(context.shortcode).toBe("RouteCode");
    expect(context.owner).toBe("fixture_owner");
    expect(context.actionHost).toBe(actionHost);
    expect(resolveVisibleIndex).not.toHaveBeenCalled();
    expect(context.visibleIndex).toBe(2);
    expect(resolveVisibleIndex).toHaveBeenCalledOnce();
    expect(resolveVisibleIndex).toHaveBeenCalledWith(mainElement);
  });

  it("uses the first post link in the main root when the route has no segment", () => {
    const { mainElement, actionElement } = installPostMarkup();

    const context = resolvePostContext({
      mainElement,
      actionElement,
      pathname: "/",
      resolveVisibleIndex: () => 0,
    });

    expect(context.shortcode).toBe("MainCode");
  });

  it("uses the last matching action-host link after the exact child traversal", () => {
    const { mainElement, actionElement } = installPostMarkup({
      includeMainLink: false,
    });

    const context = resolvePostContext({
      mainElement,
      actionElement,
      pathname: "/",
      resolveVisibleIndex: () => 0,
    });

    expect(context.shortcode).toBe("LastActionCode");
  });

  it("can preserve the download handler's action-host index lookup", () => {
    const { mainElement, actionElement, actionHost } = installPostMarkup();
    const resolveVisibleIndex = vi.fn(() => 1);

    const context = resolvePostContext({
      mainElement,
      actionElement,
      pathname: "/p/RouteCode/",
      resolveVisibleIndex,
      visibleIndexSource: "action",
    });

    expect(context.visibleIndex).toBe(1);
    expect(resolveVisibleIndex).toHaveBeenCalledWith(actionHost);
  });

  it("returns undefined identity values without changing the zero-index fallback", () => {
    document.body.innerHTML = `
      <article id="post"></article>
      <div><div><div><button id="action">Download</button></div></div></div>
    `;
    const mainElement = document.querySelector("#post");
    const actionElement = document.querySelector("#action");

    const context = resolvePostContext({
      mainElement,
      actionElement,
      pathname: "/",
      resolveVisibleIndex: () => 0,
    });

    expect(context.shortcode).toBeUndefined();
    expect(context.owner).toBeUndefined();
    expect(context.visibleIndex).toBe(0);
  });
});
