import { describe, expect, it } from "vitest";

import {
  CURRENT_ITEM_SOURCE,
  resolveCurrentStoryItem,
} from "../../../../src/controllers/stories/current-item.js";

const items = [
  { id: "300000000000000101", taken_at_timestamp: 1_700_000_000 },
  { id: "300000000000000102", taken_at_timestamp: 1_700_000_060 },
  { id: "300000000000000103", taken_at_timestamp: 1_700_000_120 },
];

describe("resolveCurrentStoryItem", () => {
  it("prefers a matching explicit URL ID over every other hint", () => {
    const result = resolveCurrentStoryItem(items, {
      explicitMediaId: "300000000000000103",
      visibleTimestamp: 1_700_000_000,
      progressIndex: 1,
      layoutIndex: 0,
      routeMediaId: "300000000000000101",
    });

    expect(result).toMatchObject({
      item: items[2],
      mediaId: "300000000000000103",
      itemIndex: 2,
      source: CURRENT_ITEM_SOURCE.EXPLICIT_URL,
    });
  });

  it("uses the closest timestamp when the route ID is not an API item", () => {
    const result = resolveCurrentStoryItem(items, {
      explicitMediaId: "999999999999999999",
      visibleTimestamp: 1_700_000_055,
      progressIndex: 2,
      layoutIndex: 0,
      routeMediaId: "999999999999999999",
    });

    expect(result).toMatchObject({
      item: items[1],
      itemIndex: 1,
      source: CURRENT_ITEM_SOURCE.TIMESTAMP,
    });
  });

  it("uses progress before layout and layout when progress is unavailable", () => {
    expect(
      resolveCurrentStoryItem(items, {
        progressIndex: 2,
        layoutIndex: 1,
      }),
    ).toMatchObject({
      item: items[2],
      source: CURRENT_ITEM_SOURCE.PROGRESS,
    });

    expect(
      resolveCurrentStoryItem(items, {
        progressIndex: null,
        layoutIndex: 1,
      }),
    ).toMatchObject({
      item: items[1],
      source: CURRENT_ITEM_SOURCE.LAYOUT,
    });
  });

  it("retains an unmatched final route ID only as the last fallback", () => {
    const result = resolveCurrentStoryItem(items, {
      explicitMediaId: "999999999999999999",
      routeMediaId: "999999999999999999",
    });

    expect(result).toEqual({
      item: null,
      mediaId: "999999999999999999",
      itemIndex: null,
      source: CURRENT_ITEM_SOURCE.ROUTE_FALLBACK,
    });
  });

  it("returns an explicit unresolved result for empty hints", () => {
    expect(resolveCurrentStoryItem(items)).toEqual({
      item: null,
      mediaId: null,
      itemIndex: null,
      source: CURRENT_ITEM_SOURCE.UNRESOLVED,
    });
  });
});
