import { readFile, writeFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

import { build } from "esbuild";

export const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
export const defaultEntryPath = path.join(projectRoot, "src", "index.js");
export const defaultMetadataPath = path.join(
  projectRoot,
  "src",
  "userscript.meta.txt",
);
export const defaultOutputPath = path.join(
  projectRoot,
  "insta-loader.user.js",
);

function resolveProjectPath(candidate, fallback) {
  return candidate ? path.resolve(projectRoot, candidate) : fallback;
}

export async function readUserscriptMetadata(
  metadataPath = defaultMetadataPath,
) {
  const metadata = (await readFile(metadataPath, "utf8"))
    .replace(/\r\n?/gu, "\n")
    .trimEnd();

  if (!metadata.startsWith("// ==UserScript==\n")) {
    throw new Error("Userscript metadata must begin with // ==UserScript==.");
  }
  if (!metadata.endsWith("// ==/UserScript==")) {
    throw new Error("Userscript metadata must end with // ==/UserScript==.");
  }
  if (!/^\/\/ @compatible\s+safari >= 15\.4$/mu.test(metadata)) {
    throw new Error("Userscript metadata must declare Safari >= 15.4.");
  }

  return metadata;
}

/**
 * Bundle the modular source into a metadata-first classic userscript.
 *
 * @param {object} [options]
 * @param {string} [options.entryPath]
 * @param {string} [options.metadataPath]
 * @param {string} [options.outputPath]
 * @param {boolean} [options.write]
 * @returns {Promise<Uint8Array>}
 */
export async function buildUserscript({
  entryPath = defaultEntryPath,
  metadataPath = defaultMetadataPath,
  outputPath = defaultOutputPath,
  write = true,
} = {}) {
  const metadata = await readUserscriptMetadata(metadataPath);
  const result = await build({
    absWorkingDir: projectRoot,
    banner: {
      js: `${metadata}\n`,
    },
    bundle: true,
    charset: "utf8",
    entryPoints: [entryPath],
    format: "iife",
    legalComments: "inline",
    loader: {
      ".css": "text",
      ".json": "json",
    },
    logLevel: "silent",
    outfile: outputPath,
    platform: "browser",
    sourcemap: false,
    target: ["safari15.4"],
    write: false,
  });

  if (result.outputFiles.length !== 1) {
    throw new Error(
      `Expected one generated userscript, received ${result.outputFiles.length}.`,
    );
  }

  const contents = result.outputFiles[0].contents;
  const prefix = new TextEncoder().encode(`${metadata}\n`);
  if (
    contents.length < prefix.length ||
    !prefix.every((byte, index) => byte === contents[index])
  ) {
    throw new Error("Generated userscript is not metadata-first.");
  }

  if (write) {
    await writeFile(outputPath, contents);
  }

  return contents;
}

async function main() {
  const { values } = parseArgs({
    options: {
      entry: { type: "string" },
      metadata: { type: "string" },
      outfile: { type: "string" },
    },
    strict: true,
  });
  const entryPath = resolveProjectPath(values.entry, defaultEntryPath);
  const metadataPath = resolveProjectPath(values.metadata, defaultMetadataPath);
  const outputPath = resolveProjectPath(values.outfile, defaultOutputPath);
  const contents = await buildUserscript({
    entryPath,
    metadataPath,
    outputPath,
  });

  console.log(
    `Built ${path.relative(projectRoot, outputPath)} (${contents.byteLength} bytes).`,
  );
}

const isMain =
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isMain) {
  await main();
}
