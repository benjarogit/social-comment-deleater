#!/usr/bin/env node
/**
 * Build Firefox (.xpi) and/or Chromium (.zip) extension packages into dist/.
 * Uses only Node stdlib + system `zip` (available on GitHub Actions ubuntu).
 */
import {
  cpSync,
  mkdirSync,
  rmSync,
  readFileSync,
  writeFileSync,
  existsSync,
  readdirSync,
  statSync,
} from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const DIST = join(ROOT, "dist");

const SHARED = [
  "background",
  "content",
  "icons",
  "lib",
  "panel",
  "popup",
];

function readVersion() {
  const mf = JSON.parse(readFileSync(join(ROOT, "manifest.json"), "utf8"));
  return mf.version || "0.0.0";
}

function copyShared(dest) {
  mkdirSync(dest, { recursive: true });
  for (const name of SHARED) {
    const src = join(ROOT, name);
    if (!existsSync(src)) throw new Error(`Missing ${name}/`);
    cpSync(src, join(dest, name), { recursive: true });
  }
}

function zipFolder(folder, outFile) {
  rmSync(outFile, { force: true });
  const result = spawnSync("zip", ["-r", "-q", outFile, "."], {
    cwd: folder,
    stdio: "inherit",
  });
  if (result.status !== 0) {
    throw new Error(`zip failed for ${outFile} (is 'zip' installed?)`);
  }
}

function buildFirefox(version) {
  const dest = join(DIST, "firefox-src");
  rmSync(dest, { recursive: true, force: true });
  copyShared(dest);
  cpSync(join(ROOT, "manifest.json"), join(dest, "manifest.json"));

  const out = join(DIST, `social-comment-cleaner-${version}-firefox.xpi`);
  zipFolder(dest, out);
  console.log("Firefox XPI:", out);
  return out;
}

function buildChromium(version) {
  const dest = join(DIST, "chromium-src");
  rmSync(dest, { recursive: true, force: true });
  copyShared(dest);
  cpSync(join(ROOT, "manifests", "chromium.json"), join(dest, "manifest.json"));

  // Keep version in sync with root manifest
  const mf = JSON.parse(readFileSync(join(dest, "manifest.json"), "utf8"));
  mf.version = version;
  writeFileSync(join(dest, "manifest.json"), JSON.stringify(mf, null, 2) + "\n");

  const out = join(DIST, `social-comment-cleaner-${version}-chromium.zip`);
  zipFolder(dest, out);
  console.log("Chromium ZIP:", out);
  return out;
}

function main() {
  const target = (process.argv[2] || "all").toLowerCase();
  const version = readVersion();
  mkdirSync(DIST, { recursive: true });

  const built = [];
  if (target === "all" || target === "firefox") built.push(buildFirefox(version));
  if (target === "all" || target === "chromium") built.push(buildChromium(version));

  const listing = readdirSync(DIST)
    .filter((f) => f.endsWith(".xpi") || f.endsWith(".zip"))
    .map((f) => {
      const p = join(DIST, f);
      return `  ${f}  (${Math.round(statSync(p).size / 1024)} KiB)`;
    });
  console.log("\nArtifacts:\n" + listing.join("\n"));
  writeFileSync(join(DIST, "version.txt"), version + "\n");
}

main();
