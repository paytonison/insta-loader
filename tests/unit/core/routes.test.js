import { describe, expect, it } from "vitest";

import {
  ROUTE_KIND,
  classifyInstagramRoute,
  getMaximumReelPlaybackRouteShortcode,
  isMaximumReelFeedRoute,
  parseMaximumReelShortcode,
} from "../../../src/core/routes.js";

describe("Instagram route classification", () => {
  it.each([
    ["https://www.instagram.com/", ROUTE_KIND.FEED],
    ["https://www.instagram.com/p/ABCde123/", ROUTE_KIND.POST],
    ["https://www.instagram.com/fixture_user/p/ABCde123/", ROUTE_KIND.POST],
    ["https://www.instagram.com/stories/fixture_user/123/", ROUTE_KIND.STORY],
    [
      "https://www.instagram.com/stories/highlights/123/",
      ROUTE_KIND.HIGHLIGHT,
    ],
    ["https://www.instagram.com/reel/ABCde123/", ROUTE_KIND.REEL],
    [
      "https://www.instagram.com/fixture_user/reel/ABCde123/",
      ROUTE_KIND.REEL,
    ],
    ["https://www.instagram.com/reels/", ROUTE_KIND.REELS],
    ["https://www.instagram.com/fixture_user/", ROUTE_KIND.PROFILE],
    ["https://www.instagram.com/fixture_user/tagged/", ROUTE_KIND.PROFILE],
    ["https://www.instagram.com/explore/", ROUTE_KIND.IGNORED],
    ["https://instagram.com/p/ABCde123/", ROUTE_KIND.IGNORED],
  ])("classifies %s as %s", (url, kind) => {
    expect(classifyInstagramRoute(url).kind).toBe(kind);
  });

  it("marks supported embed forms without treating plural feeds as managed playback", () => {
    const reelEmbed = classifyInstagramRoute(
      "https://www.instagram.com/reel/ABCde123/embed/",
    );
    const postEmbed = classifyInstagramRoute(
      "https://www.instagram.com/p/ABCde123/embed/",
    );

    expect(reelEmbed).toMatchObject({
      kind: ROUTE_KIND.REEL,
      isEmbed: true,
      playbackEligible: true,
    });
    expect(postEmbed).toMatchObject({
      kind: ROUTE_KIND.POST,
      isEmbed: true,
      playbackEligible: false,
    });
    expect(
      getMaximumReelPlaybackRouteShortcode(
        "https://www.instagram.com/reels/ABCde123/",
      ),
    ).toBeNull();
  });

  it("retains the exact singular parser and native plural-feed guard", () => {
    expect(
      parseMaximumReelShortcode(
        "https://www.instagram.com/reels/ABCde123/",
      ),
    ).toBe("ABCde123");
    expect(
      parseMaximumReelShortcode(
        "https://www.instagram.com/reels/audio/",
      ),
    ).toBeNull();
    expect(
      getMaximumReelPlaybackRouteShortcode(
        "https://www.instagram.com/reel/ABCde123/",
      ),
    ).toBe("ABCde123");

    for (const url of [
      "https://www.instagram.com/reels/",
      "https://www.instagram.com/reels/ABCde123/",
      "https://www.instagram.com/fixture_user/reels/",
      "https://www.instagram.com/fixture_user/reels/ABCde123/",
    ]) {
      expect(isMaximumReelFeedRoute(url)).toBe(true);
      expect(classifyInstagramRoute(url).nativeReelsFeed).toBe(true);
    }

    expect(
      classifyInstagramRoute(
        "https://www.instagram.com/fixture_user/reels/ABCde123/",
      ).kind,
    ).toBe(ROUTE_KIND.UNSUPPORTED);
  });

  it("accepts DOM-only blockers explicitly", () => {
    expect(
      classifyInstagramRoute("https://www.instagram.com/", {
        splashVisible: true,
      }),
    ).toMatchObject({ kind: ROUTE_KIND.IGNORED, ignoredReason: "splash-screen" });
    expect(
      classifyInstagramRoute(
        "https://www.instagram.com/fixture_user/followers/",
        { followersDialogOpen: true },
      ),
    ).toMatchObject({
      kind: ROUTE_KIND.IGNORED,
      ignoredReason: "relationship-dialog",
    });
  });
});
