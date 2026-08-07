import { createHash } from "node:crypto";

import { buildUserscript } from "./build.mjs";

function digest(contents) {
  return createHash("sha256").update(contents).digest("hex");
}

const first = Buffer.from(await buildUserscript({ write: false }));
const second = Buffer.from(await buildUserscript({ write: false }));

if (!first.equals(second)) {
  console.error(
    [
      "Repeated builds are not byte-identical.",
      `  first:  ${digest(first)}`,
      `  second: ${digest(second)}`,
    ].join("\n"),
  );
  process.exitCode = 1;
} else {
  console.log(`Repeated builds are byte-identical (${digest(first)}).`);
}
