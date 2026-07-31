#!/usr/bin/env node
/* The driver behind `npm run test:a11y` and `npm run test:visual`.
 *
 *   node scripts/storybook-gates.mjs --mode a11y     [--no-build] [-- <test-storybook args>]
 *   node scripts/storybook-gates.mjs --mode visual   [--no-build] [-- <test-storybook args>]
 *
 * THE NAME IS LOAD-BEARING, AND IT USED TO BE `test-storybook.mjs`. Node's
 * default test discovery matches `test-*.?(c|m)js` in ANY directory — the glob
 * is not rooted at `test/` — so a bare `node --test` typed anywhere swept this file
 * up as a test and ran the whole browser harness — a Storybook build and
 * Chromium — inside a gate whose entire contract is offline and dependency-
 * light. `npm test` was made immune separately (an explicit-file runner), but
 * the bare idiom is what a contributor actually types, so the hazard is retired
 * at the source instead: nothing here starts with `test-`. Do not rename it back.
 *
 * It does three things the two gates would otherwise each need a dependency for:
 *
 *   1. builds `storybook-static/` when it is stale (tokens, CSS, stories or the
 *      .storybook config newer than the last build) and skips the build when it
 *      is not — so the two gates back to back cost one build, not two;
 *   2. serves that directory on an EPHEMERAL port with node:http, so nothing
 *      needs `http-server`, `concurrently` or `wait-on`, and two runs on one
 *      machine cannot collide on 6006;
 *   3. hands the runner absolute paths for the snapshot, diff and report
 *      locations, then summarises the report after jest has exited.
 *
 * Zero dependencies of its own is deliberate: every generator in this repo is
 * dependency-free, and a static file server is forty lines.
 *
 * NOT part of the root `npm run check`. That gate is offline, browser-free and
 * heavy-dep-free; these two need Chromium. They run in the path-filtered
 * design-system workflow instead.
 */

import { spawn } from "node:child_process";
import { createReadStream, existsSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { mkdir, readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { dirname, extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");
const STATIC_DIR = join(ROOT, "storybook-static");
const SNAPSHOT_DIR = join(ROOT, "__screenshots__");
const RESULTS_DIR = join(ROOT, "test-results");
const DIFF_DIR = join(RESULTS_DIR, "visual-diff");
const REPORT = join(RESULTS_DIR, "visual-report.jsonl");

const argv = process.argv.slice(2);
const passThrough = argv.includes("--") ? argv.slice(argv.indexOf("--") + 1) : [];
const flags = argv.includes("--") ? argv.slice(0, argv.indexOf("--")) : argv;
const modeIdx = flags.indexOf("--mode");
const MODE = modeIdx === -1 ? "a11y" : flags[modeIdx + 1];
const PLATFORM = process.env.DS_SNAPSHOT_PLATFORM ?? process.platform;

if (MODE !== "a11y" && MODE !== "visual") {
  console.error(`test-storybook: --mode must be "a11y" or "visual" (got ${MODE ?? "nothing"})`);
  process.exit(2);
}

/* ---------- 1. the static build, rebuilt only when it is stale ---------- */

/* Everything the built Storybook is a function of. `dist/tokens.css` is in the
   list because preview.js imports it, so a token edit changes every story. */
const SOURCES = ["tokens", "css", "stories", ".storybook", "dist"];

function newestMtime(path, newest = 0) {
  if (!existsSync(path)) return newest;
  const s = statSync(path);
  if (s.isFile()) return Math.max(newest, s.mtimeMs);
  for (const e of readdirSync(path)) newest = newestMtime(join(path, e), newest);
  return newest;
}

function isStale() {
  if (!existsSync(join(STATIC_DIR, "index.json"))) return true;
  const built = statSync(join(STATIC_DIR, "index.json")).mtimeMs;
  return SOURCES.some((s) => newestMtime(join(ROOT, s)) > built);
}

const run = (cmd, args, opts = {}) =>
  new Promise((res, rej) => {
    const child = spawn(cmd, args, { stdio: "inherit", cwd: ROOT, ...opts });
    child.on("error", rej);
    child.on("close", (code) => res(code ?? 1));
  });

async function buildStorybook() {
  const require_ = createRequire(import.meta.url);
  const tokens = await run(process.execPath, [join(HERE, "build.mjs")]);
  if (tokens !== 0) return tokens;
  const cli = require_.resolve("storybook/bin/index.cjs");
  return run(process.execPath, [cli, "build", "--quiet", "--output-dir", STATIC_DIR]);
}

/* ---------- 2. a static server on an ephemeral port ---------- */

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".woff2": "font/woff2",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
};

function serve(dir) {
  const server = createServer((req, res) => {
    const url = new URL(req.url, "http://localhost");
    let file = join(dir, normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, ""));
    if (!file.startsWith(dir + sep) && file !== dir) return res.writeHead(403).end();
    if (existsSync(file) && statSync(file).isDirectory()) file = join(file, "index.html");
    if (!existsSync(file)) return res.writeHead(404).end("not found");
    res.writeHead(200, {
      "content-type": MIME[extname(file)] ?? "application/octet-stream",
      "cache-control": "no-store",
    });
    createReadStream(file).pipe(res);
  });
  return new Promise((res) => {
    server.listen(0, "127.0.0.1", () => res({ server, port: server.address().port }));
  });
}

/* ---------- 3. the report ---------- */

const dirSize = (path) => {
  if (!existsSync(path)) return { files: 0, bytes: 0 };
  let files = 0;
  let bytes = 0;
  for (const e of readdirSync(path, { withFileTypes: true })) {
    const p = join(path, e.name);
    if (e.isDirectory()) {
      const sub = dirSize(p);
      files += sub.files;
      bytes += sub.bytes;
    } else {
      files += 1;
      bytes += statSync(p).size;
    }
  }
  return { files, bytes };
};

function summarise() {
  if (!existsSync(REPORT)) return;
  const rows = readFileSync(REPORT, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l));
  const by = (s) => rows.filter((r) => r.status === s);
  const baselines = join(SNAPSHOT_DIR, PLATFORM);
  const { files, bytes } = dirSize(baselines);

  /* A baseline no story claimed. Jest calls these obsolete and would fail the
     run for them; this gate overrides jest's exit code, so it has to say so
     itself or a deleted story would leave a PNG in the repo forever. */
  const seen = new Set(rows.map((r) => `${r.story}.png`));
  const orphans = existsSync(baselines)
    ? readdirSync(baselines).filter((f) => f.endsWith(".png") && !seen.has(f))
    : [];

  console.log(`\nvisual regression — ${PLATFORM}`);
  console.log(`  stories captured   ${rows.length}`);
  console.log(`  matched baseline   ${by("match").length}`);
  console.log(`  mismatched         ${by("mismatch").length}`);
  console.log(`  no baseline yet    ${by("no-baseline").length}`);
  console.log(`  orphan baselines   ${orphans.length}`);
  console.log(`  baselines on disk  ${files} files, ${(bytes / 1024 / 1024).toFixed(2)} MB`);
  for (const r of [...by("mismatch"), ...by("no-baseline")]) {
    console.log(`    ${r.status === "mismatch" ? "≠" : "?"} ${r.story}`);
  }
  for (const f of orphans) console.log(`    - ${f} (no story renders this any more)`);
  if (by("mismatch").length || by("no-baseline").length) {
    console.log(
      "\n  REPORT ONLY — these do not fail the job until 2026-09-01." +
        `\n  Diffs: ${join(DIFF_DIR, PLATFORM)}` +
        "\n  If the change is intended, delete the stale PNGs under" +
        `\n  __screenshots__/${PLATFORM}/ and re-run to recapture, then commit them.\n`
    );
  }
}

/* ---------- drive ---------- */

if (!flags.includes("--no-build") && isStale()) {
  console.log("storybook-static is stale — building…");
  const code = await buildStorybook();
  if (code !== 0) process.exit(code);
} else {
  console.log("storybook-static is current — skipping the build");
}

const index = JSON.parse(await readFile(join(STATIC_DIR, "index.json"), "utf8"));
const stories = Object.values(index.entries).filter((e) => e.type !== "docs").length;

if (MODE === "visual") {
  rmSync(REPORT, { force: true });
  await mkdir(join(SNAPSHOT_DIR, PLATFORM), { recursive: true });
}

const { server, port } = await serve(STATIC_DIR);
const url = `http://127.0.0.1:${port}`;
console.log(`serving ${STATIC_DIR} at ${url}`);
console.log(`running the ${MODE} gate over ${stories} stories\n`);

const require_ = createRequire(import.meta.url);
const bin = require_.resolve("@storybook/test-runner/dist/test-storybook.js");
const JEST_JSON = join(RESULTS_DIR, "jest.json");

const code = await run(
  process.execPath,
  [
    bin,
    "--url",
    url,
    "--maxWorkers",
    "2",
    /* Visual mode reads jest's own tally back, because it has to override the
       exit code and must not override more than it means to. See below. */
    ...(MODE === "visual" ? ["--json", "--outputFile", JEST_JSON] : []),
    ...passThrough,
  ],
  {
    env: {
      ...process.env,
      DS_TEST_MODE: MODE,
      DS_SNAPSHOT_DIR: SNAPSHOT_DIR,
      DS_DIFF_DIR: DIFF_DIR,
      DS_VISUAL_REPORT: REPORT,
      DS_SNAPSHOT_PLATFORM: PLATFORM,
    },
  }
);

server.close();

if (MODE !== "visual") process.exit(code);

summarise();

/* ---------- report-only, precisely ----------
 * The matcher's throw is already swallowed in postVisit, so every test passes —
 * but jest fails the RUN anyway when its snapshot state has unmatched entries,
 * and that is the exit code npm would report. So the tally is read back and the
 * exit code is recomputed from the one thing report-only is about: a failed
 * TEST is still a failure (a page that would not load, a story that threw, a
 * browser that died); a mismatched IMAGE is not, yet.
 *
 * FLIP TO ENFORCING ON 2026-09-01 together with the try/catch in
 * .storybook/test-runner.js. After that, delete this block and pass `code`
 * straight through — jest's own verdict becomes the right one again.
 */
if (!existsSync(JEST_JSON)) process.exit(code); /* the runner never got that far */

const jest = JSON.parse(readFileSync(JEST_JSON, "utf8"));
const realFailures = jest.numFailedTests + jest.numFailedTestSuites;
if (realFailures > 0) {
  console.error(
    `\n${realFailures} test failure(s) that are NOT image mismatches — see above. Failing.`
  );
  process.exit(code || 1);
}
process.exit(0);
