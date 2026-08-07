import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  buildUserscript,
  defaultOutputPath,
  projectRoot,
} from "./build.mjs";

function digest(contents) {
  return createHash("sha256").update(contents).digest("hex");
}

const expected = Buffer.from(await buildUserscript({ write: false }));
let actual;

try {
  actual = await readFile(defaultOutputPath);
} catch (error) {
  if (error.code === "ENOENT") {
    console.error(
      `${path.relative(projectRoot, defaultOutputPath)} is missing; run npm run build.`,
    );
    process.exitCode = 1;
  } else {
    throw error;
  }
}

if (actual) {
  if (!actual.equals(expected)) {
    console.error(
      [
        `${path.relative(projectRoot, defaultOutputPath)} is stale; run npm run build.`,
        `  committed: ${digest(actual)}`,
        `  generated: ${digest(expected)}`,
      ].join("\n"),
    );
    process.exitCode = 1;
  } else {
    console.log(
      `${path.relative(projectRoot, defaultOutputPath)} matches the modular source.`,
    );
  }
}
