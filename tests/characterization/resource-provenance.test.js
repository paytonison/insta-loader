// @vitest-environment node

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const provenance = JSON.parse(
  readFileSync(
    new URL("../../src/resources/upstream-provenance.json", import.meta.url),
    "utf8",
  ),
);

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function assertReviewedResource(path, record, { trimTerminalLf = false } = {}) {
  let bytes = readFileSync(new URL(path, import.meta.url));
  if (trimTerminalLf) {
    expect(bytes.at(-1)).toBe(0x0a);
    bytes = bytes.subarray(0, -1);
  }

  expect(bytes.byteLength).toBe(record.bytes);
  expect(sha256(bytes)).toBe(record.sha256);
}

describe("reviewed upstream resource provenance", () => {
  it("keeps the bundled base CSS byte-identical to the reviewed commit", () => {
    assertReviewedResource(
      "../../src/resources/internal.css",
      provenance.resources.internalCss,
      { trimTerminalLf: true },
    );
  });

  it("keeps the bundled locale manifest byte-identical to the reviewed commit", () => {
    assertReviewedResource(
      "../../src/localization/locale-manifest.json",
      provenance.resources.localeManifest,
    );
  });
});
