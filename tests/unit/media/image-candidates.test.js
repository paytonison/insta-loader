import { describe, expect, it } from "vitest";

import {
  compareImageCandidates,
  getImageTransformation,
  orderImageCandidates,
  selectBestImageCandidate,
} from "../../../src/media/image-candidates.js";

describe("image candidate ordering", () => {
  it("prefers the shorter stp transformation when both URLs provide one", () => {
    const long = {
      width: 1080,
      url: "https://cdn.example.test/long.jpg?stp=dst-jpg_e35_s1080x1080",
    };
    const short = {
      width: 640,
      url: "https://cdn.example.test/short.jpg?stp=dst-jpg",
    };

    expect(compareImageCandidates(long, short)).toBeGreaterThan(0);
    expect(selectBestImageCandidate([long, short])).toBe(short);
  });

  it("uses descending width when either URL has no stp transformation", () => {
    const transformed = {
      width: 640,
      url: "https://cdn.example.test/transformed.jpg?stp=dst-jpg",
    };
    const wide = {
      width: 1440,
      url: "https://cdn.example.test/wide.jpg",
    };

    expect(selectBestImageCandidate([transformed, wide])).toBe(wide);
  });

  it("keeps API order for ties and does not mutate the source array", () => {
    const first = { width: 1080, url: "https://cdn.example.test/first.jpg" };
    const second = { width: 1080, url: "https://cdn.example.test/second.jpg" };
    const candidates = [first, second];

    expect(orderImageCandidates(candidates)).toEqual([first, second]);
    expect(candidates).toEqual([first, second]);
  });

  it("handles invalid candidate collections and URLs", () => {
    expect(getImageTransformation("relative/image.jpg?stp=value")).toBeNull();
    expect(orderImageCandidates(null)).toEqual([]);
    expect(selectBestImageCandidate([])).toBeNull();
  });
});
