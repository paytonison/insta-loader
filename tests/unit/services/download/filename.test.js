import { describe, expect, it } from "vitest";

import {
  DEFAULT_RENAME_FORMAT,
  createDownloadFilename,
  createFilenameTokens,
  formatFilenameTemplate,
  getOriginalMediaName,
  normalizeFilenameTimestamp,
} from "../../../../src/services/download/filename.js";

function metadata(overrides = {}) {
  return {
    username: "alice",
    sourceType: "photo",
    timestamp: Math.floor(new Date(2024, 0, 2, 3, 4, 5).getTime() / 1000),
    filetype: "jpg",
    shortcode: "POST123",
    index: 7,
    uid: "42",
    ...overrides,
  };
}

const CDN_URL =
  "https://scontent.cdninstagram.com/v/t51.2885-15/12345_67890_abc.def.jpg?stp=dst-jpg&_nc_cat=1";

describe("download filename formatting", () => {
  it("formats the default template with local timestamp tokens", () => {
    const value = createDownloadFilename(CDN_URL, metadata());

    expect(value).toBe(
      "alice-photo-POST123-20240102_030405_12345.jpg",
    );
    expect(DEFAULT_RENAME_FORMAT).toContain("%ORIGINAL_NAME_FIRST%");
  });

  it("normalizes seconds and milliseconds to the same legacy timestamp", () => {
    const milliseconds = new Date(2024, 5, 6, 7, 8, 9).getTime();
    const seconds = Math.floor(milliseconds / 1000);

    expect(normalizeFilenameTimestamp(seconds)).toBe(seconds * 1000);
    expect(normalizeFilenameTimestamp(milliseconds)).toBe(milliseconds);
  });

  it("supports every timestamp, index, UID, and original-name token", () => {
    const data = metadata();
    const tokens = createFilenameTokens(CDN_URL, data);
    const value = formatFilenameTemplate(
      "%username%_%2-year%%month%%day%_%hour%%minute%%second%_" +
        "%index%_%uid%_%original_name%_%original_name_first%",
      tokens,
    );

    expect(value).toBe(
      "alice_240102_030405_7_42_12345_67890_abc.def_12345",
    );
  });

  it("preserves unknown tokens and missing required token values", () => {
    const tokens = createFilenameTokens(CDN_URL, metadata({
      username: undefined,
      sourceType: undefined,
    }));

    expect(formatFilenameTemplate(
      "%username%-%source_type%-%unknown%",
      tokens,
    )).toBe("%USERNAME%-%SOURCE_TYPE%-%UNKNOWN%");
  });

  it("uses legacy defaults for missing optional metadata", () => {
    const tokens = createFilenameTokens(CDN_URL, metadata({
      shortcode: undefined,
      index: null,
      uid: null,
    }));

    expect(tokens["%SHORTCODE%"] ?? "missing").toBe("");
    expect(tokens["%INDEX%"] ?? "missing").toBe("0");
    expect(tokens["%UID%"] ?? "missing").toBe("");
    expect(formatFilenameTemplate(
      "%SHORTCODE%:%INDEX%:%UID%",
      tokens,
    )).toBe(":0:");
  });

  it("preserves the rename-off username and original CDN basename contract", () => {
    const value = createDownloadFilename(CDN_URL, metadata(), {
      autoRename: false,
      renameFormat: "%THIS_TEMPLATE_IS_IGNORED%",
    });

    expect(value).toBe("alice_12345_67890_abc.def.jpg");
  });

  it("extracts dotted CDN basenames without query strings", () => {
    expect(getOriginalMediaName(CDN_URL)).toBe("12345_67890_abc.def");
    expect(getOriginalMediaName("https://cdn.example.test/no-extension")).toBe(
      "",
    );
  });

  it("preserves falsey UID and explicit index behavior", () => {
    const tokens = createFilenameTokens(CDN_URL, metadata({
      uid: 0,
      index: "03",
    }));

    expect(tokens["%UID%"] ?? "missing").toBe("");
    expect(tokens["%INDEX%"] ?? "missing").toBe("03");
  });
});
