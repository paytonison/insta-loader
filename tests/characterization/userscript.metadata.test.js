// @vitest-environment node

import { describe, expect, it } from "vitest";

import { USER_SETTING_KEYS } from "../../src/core/settings-store.js";
import { readUserscriptSource } from "./helpers/userscript-runtime.js";

const source = readUserscriptSource();
const metadataEnd = "// ==/UserScript==";
const metadata = source.slice(0, source.indexOf(metadataEnd) + metadataEnd.length);

function metadataValues(name) {
  const pattern = new RegExp(`^//\\s+@${name}\\s+(.+)$`, "gm");
  return [...metadata.matchAll(pattern)].map((match) => match[1].trim());
}

describe("committed userscript metadata", () => {
  it("is the first content in the distributable artifact", () => {
    expect(source.startsWith("// ==UserScript==\n")).toBe(true);
    expect(metadata).toContain("// ==/UserScript==");
  });

  it("keeps the install and update contract", () => {
    expect(metadataValues("name")).toEqual(["insta-loader"]);
    expect(metadataValues("version")).toEqual(["v1.3.3"]);
    expect(metadataValues("match")).toEqual(["https://*.instagram.com/*"]);
    expect(metadataValues("run-at")).toEqual(["document-start"]);
    expect(metadataValues("downloadURL")).toEqual([
      "https://raw.githubusercontent.com/paytonison/insta-loader/main/insta-loader.user.js",
    ]);
    expect(metadataValues("updateURL")).toEqual(metadataValues("downloadURL"));
  });

  it("allows privileged requests to the exact Instagram API hosts", () => {
    expect(metadataValues("connect")).toEqual([
      "cdn.jsdelivr.net",
      "*.cdninstagram.com",
      "*.fbcdn.net",
      "i.instagram.com",
      "raw.githubusercontent.com",
      "scontent.cdninstagram.com",
      "www.instagram.com",
    ]);
  });

  it("keeps the pinned runtime dependencies", () => {
    expect(metadataValues("require")).toEqual([
      "https://cdn.jsdelivr.net/npm/mediabunny@1.34.5/dist/bundles/mediabunny.min.cjs#sha256-wUFR+x2bDvpqgMAVGy2CvGvULyjTGvGy4UUAm8rae5U=",
      "https://code.jquery.com/jquery-3.7.1.min.js#sha256-/JqT3SQfawRcv/BIHPThkBvs0OEvtFFmqPF/lYI/Cxo=",
    ]);
  });

  it("does not depend on moving userscript resources at runtime", () => {
    expect(metadataValues("resource")).toEqual([]);
    expect(metadataValues("grant")).not.toContain("GM_getResourceText");
    expect(metadata).not.toContain("@master");
  });

  it("declares a Safari floor compatible with the refactored source", () => {
    const safari = metadataValues("compatible").find((entry) =>
      entry.startsWith("safari "),
    );
    const version = Number(safari?.match(/>=\s*([0-9.]+)/)?.[1]);

    expect(version).toBeGreaterThanOrEqual(15.4);
  });

  it("publishes exactly the established 21 boolean setting keys", () => {
    expect([...USER_SETTING_KEYS].sort()).toEqual(
      [
        "AUTO_RENAME",
        "CAPTURE_IMAGE_VIA_MEDIA_CACHE",
        "CHECK_FOR_UPDATE",
        "DIRECT_DOWNLOAD_ALL",
        "DIRECT_DOWNLOAD_STORY",
        "DIRECT_DOWNLOAD_VISIBLE_RESOURCE",
        "DISABLE_VIDEO_LOOPING",
        "FALLBACK_TO_BLOB_FETCH_IF_MEDIA_API_THROTTLED",
        "FORCE_FETCH_ALL_RESOURCES",
        "FORCE_RESOURCE_VIA_MEDIA",
        "HTML5_VIDEO_CONTROL",
        "MAX_REEL_PLAYBACK_QUALITY",
        "MODIFY_RESOURCE_EXIF",
        "MODIFY_VIDEO_VOLUME",
        "NEW_TAB_ALWAYS_FORCE_MEDIA_IN_POST",
        "PREFER_DASH_MANIFEST",
        "REDIRECT_CLICK_USER_STORY_PICTURE",
        "RENAME_PUBLISH_DATE",
        "SCROLL_BUTTON",
        "SKIP_SHARED_WITH_YOU_DIALOG",
        "SKIP_VIEW_STORY_CONFIRM",
      ].sort(),
    );

    for (const key of USER_SETTING_KEYS) {
      expect(source).toContain(`${key}:`);
    }
  });
});
