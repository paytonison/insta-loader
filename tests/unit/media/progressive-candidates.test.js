import { describe, expect, it } from "vitest";

import fixture from "./fixtures/progressive-candidates.json";
import {
  normalizeMaximumProgressiveCandidates,
  normalizeMaximumReelCandidates,
  rankMaximumProgressiveCandidates,
  toPositiveFiniteNumber,
} from "../../../src/media/progressive-candidates.js";

describe("maximum progressive candidate normalization", () => {
  it("filters, deduplicates, normalizes, and ranks XDT video versions", () => {
    const candidates = normalizeMaximumProgressiveCandidates(fixture);

    expect(candidates).toHaveLength(3);
    expect(candidates.map((candidate) => candidate.url)).toEqual([
      "https://cdn.example.test/square-1080-high.mp4",
      "https://cdn.example.test/square-1080-low.mp4",
      "https://cdn.example.test/tall-720.mp4",
    ]);
    expect(candidates[0]).toEqual({
      area: 1166400,
      bandwidth: 4000000,
      height: 1080,
      index: 2,
      shortSide: 1080,
      url: "https://cdn.example.test/square-1080-high.mp4",
      width: 1080,
    });
  });

  it("uses a single legacy video_url when no versions are available", () => {
    expect(normalizeMaximumProgressiveCandidates({
      shortcode_media: {
        original_width: "1080",
        original_height: 1920,
        video_url: "https://cdn.example.test/legacy-fallback.mp4",
      },
    })).toEqual([{
      area: 2073600,
      bandwidth: 0,
      height: 1920,
      index: 0,
      shortSide: 1080,
      url: "https://cdn.example.test/legacy-fallback.mp4",
      width: 1080,
    }]);
  });

  it("unwraps XIG bootstrap media before ranking progressive versions", () => {
    const candidates = normalizeMaximumProgressiveCandidates({
      xig_polaris_media: {
        if_not_gated_logged_out: {
          original_width: 1080,
          original_height: 1920,
          video_versions: [
            {
              url: "https://cdn.example.test/xig-720.mp4",
              width: 720,
              height: 1280,
            },
            {
              url: "https://cdn.example.test/xig-1080.mp4",
              width: 1080,
              height: 1920,
            },
          ],
        },
      },
    });

    expect(candidates.map((candidate) => candidate.url)).toEqual([
      "https://cdn.example.test/xig-1080.mp4",
      "https://cdn.example.test/xig-720.mp4",
    ]);
  });

  it("does not use video_url after a non-empty versions list is selected", () => {
    expect(normalizeMaximumProgressiveCandidates({
      video_url: "https://cdn.example.test/fallback.mp4",
      video_versions: [{ url: "http://cdn.example.test/rejected.mp4" }],
    })).toEqual([]);
  });

  it("preserves source order after all quality metrics tie", () => {
    const candidates = [
      {
        area: 100,
        bandwidth: 10,
        height: 10,
        index: 4,
        shortSide: 10,
        url: "https://cdn.example.test/first.mp4",
        width: 10,
      },
      {
        area: 100,
        bandwidth: 10,
        height: 10,
        index: 8,
        shortSide: 10,
        url: "https://cdn.example.test/second.mp4",
        width: 10,
      },
    ];

    expect(rankMaximumProgressiveCandidates(candidates)).toEqual(candidates);
    expect(normalizeMaximumReelCandidates).toBe(
      normalizeMaximumProgressiveCandidates,
    );
  });

  it("converts only positive finite numeric values", () => {
    expect(toPositiveFiniteNumber("12.5")).toBe(12.5);
    expect(toPositiveFiniteNumber(0)).toBe(0);
    expect(toPositiveFiniteNumber(-1)).toBe(0);
    expect(toPositiveFiniteNumber(Number.POSITIVE_INFINITY)).toBe(0);
    expect(toPositiveFiniteNumber("not-a-number")).toBe(0);
  });
});
