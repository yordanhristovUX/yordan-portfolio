#!/usr/bin/env node
/* ============================================================
   Dev loop — serve the site and re-run the generator an edit
   invalidated. Zero dependencies: node:fs.watch and
   node:child_process, nothing else.

   `npm run dev`   [--no-serve] [--port 3000]

   WHAT THIS IS NOT. It is not a build step. Nothing about what ships
   changes: the site is still static files, the generators still write
   the same bytes, and `npm run build` on its own still produces a
   byte-identical tree. All this removes is the manual re-run between
   saving content/projects/x.md and seeing it in the browser. If this
   file were deleted the repo would be exactly as buildable as before,
   which is the test a dev-only tool has to pass.

   THE RUN ORDER IS THE WHOLE POINT (ARCHITECTURE.md). build.mjs emits
   content/system.generated.json; build-content.mjs consumes it and
   interpolates the counts into the prose that advertises them. So a
   design-system edit means BOTH, in that order, and a content edit
   means only the second. Getting that wrong ships stale numbers,
   which is precisely the class of mistake a watcher is supposed to
   remove rather than automate.

   THE FEEDBACK LOOP. The generators write INTO the trees being
   watched — design-system/dist/, content/system.generated.json,
   content/dist/ — so a naive watcher rebuilds forever. IGNORED below
   is what breaks the loop. Two builds never overlap: a build in
   flight queues later events rather than racing them, and an event
   whose file has not changed since that build began is dropped, which
   is what stops one save producing two identical rebuilds.
   ============================================================ */
import { watch, readFileSync, statSync } from "node:fs";
import { spawn } from "node:child_process";
import { dirname, join, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const SERVE = !argv.includes("--no-serve");
const PORT = argv.includes("--port") ? argv[argv.indexOf("--port") + 1] : null;

/* ---------- the two generators, in dependency order ----------
   Read out of `npm run build` rather than restated here. The run order has
   exactly one source in this repo and it is that script; a watcher carrying
   its own copy is a second source, and the two would disagree the first time
   a step was added to one of them. */
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const chain = String(pkg.scripts?.build ?? "")
  .split("&&")
  .map((s) => s.trim())
  .filter(Boolean);

if (chain.length !== 2 || !chain[0].includes("design-system") || !chain[1].includes("build-content")) {
  console.error(
    `✗ scripts/dev.mjs cannot read the build chain out of package.json.\n` +
      `  Expected \`build\` to be exactly: <design-system build> && <content build>\n` +
      `  Found: ${pkg.scripts?.build ?? "(nothing)"}\n` +
      `  The watcher maps a watched tree to the generators it feeds, so it has to know which\n` +
      `  step is which. Update the WATCHED table below in the same commit that changed the chain.`
  );
  process.exit(1);
}

const TOKENS = { key: "tokens", label: "tokens", cmd: chain[0] };
const CONTENT = { key: "content", label: "content", cmd: chain[1] };

/* ---------- what an event means ----------
   A watched root maps to the generators its files feed. design-system/ feeds
   both because its output is content's input; content/ feeds only content. */
const WATCHED = [
  { dir: "design-system", runs: [TOKENS, CONTENT] },
  { dir: "content", runs: [CONTENT] },
];

/* Generator OUTPUTS. Every path here is written by a generator into a watched
   tree; reacting to one is how a watcher loops forever. Matched as a path
   prefix against the repo-relative, forward-slashed path. */
const IGNORED = [
  "design-system/dist/",
  "design-system/storybook-static/",
  "design-system/node_modules/",
  "content/dist/",
  "content/system.generated.json",
];
const IGNORED_NAME = /^(\.|~)|(\.tmp|\.swp|\.swx|~)$/; /* editor scratch files */

const posix = (p) => p.split(sep).join("/");
const ignored = (relPath) =>
  IGNORED.some((p) => relPath === p || relPath.startsWith(p)) ||
  relPath.split("/").some((seg) => IGNORED_NAME.test(seg));

/* ---------- run one generator, never two at once ---------- */
function run(cmd) {
  return new Promise((resolve) => {
    const child = spawn(cmd, { cwd: root, shell: true, stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (out += d));
    child.on("close", (code) => resolve({ code, out }));
  });
}

const ms = (t) => `${Math.round(t)}ms`;
const stamp = () => new Date().toTimeString().slice(0, 8);

let building = false;
let pending = new Set(); /* generator keys queued while a build was running */
let reasons = new Set();

/* Did this path actually change since the moment the last build started?
   Windows and macOS both emit more than one event per save (the write, then
   the close, then an attribute touch), and the trailing ones land AFTER the
   build has begun — where the debounce can no longer absorb them, so they
   queue a second, identical build. mtime settles the question: a duplicate
   event carries the save's mtime, which predates the build by at least the
   debounce window; a genuine edit made while the build was running does not.
   An unstatable path (deleted, renamed) counts as changed. */
function changedSince(rel, t) {
  try {
    return statSync(join(root, rel)).mtimeMs >= t;
  } catch {
    return true;
  }
}

async function build() {
  if (building) return;
  building = true;
  try {
    while (pending.size) {
      /* Order is fixed by the graph, not by the order events arrived: tokens
         first whenever tokens is queued at all. */
      const queue = [TOKENS, CONTENT].filter((g) => pending.has(g.key));
      const why = [...reasons].sort();
      pending = new Set();
      reasons = new Set();

      const startedAt = Date.now();
      const started = performance.now();
      const ran = [];
      let failed = null;

      for (const g of queue) {
        const t0 = performance.now();
        const { code, out } = await run(g.cmd);
        ran.push(`${g.label} ${ms(performance.now() - t0)}`);
        if (code !== 0) {
          failed = { g, out };
          break;
        }
      }

      if (failed) {
        /* A gate failing is information, not a reason to stop watching: the
           next save is usually the fix, and a watcher that exits on the first
           red is a watcher nobody leaves running. */
        console.error(
          `\n✗ ${stamp()}  ${failed.g.label} failed after ${why.join(", ")}\n` +
            failed.out.replace(/^/gm, "    ") +
            `\n  still watching — save again when it is fixed.\n`
        );
      } else {
        const shown = why.slice(0, 3).join(", ") + (why.length > 3 ? ` +${why.length - 3} more` : "");
        console.log(`✓ ${stamp()}  ${ran.join(" · ")}  (${ms(performance.now() - started)} total) ← ${shown}`);
      }

      /* Anything queued while that ran: keep it only if it is a real edit. */
      if (pending.size && ![...reasons].some((rel) => changedSince(rel, startedAt))) {
        pending = new Set();
        reasons = new Set();
      }
    }
  } finally {
    building = false;
  }
}

/* ---------- debounce ----------
   Editors fire several events per save (write, rename, attribute change), and
   a "save all" fires them across both trees. One timer, reset on every event,
   so a burst becomes one build with both trees' work in the right order. */
let timer = null;
function schedule(generators, why) {
  for (const g of generators) pending.add(g.key);
  reasons.add(why);
  clearTimeout(timer);
  timer = setTimeout(build, 120);
}

/* ---------- watch ---------- */
for (const { dir, runs } of WATCHED) {
  const abs = join(root, dir);
  try {
    watch(abs, { recursive: true }, (_event, filename) => {
      if (!filename) return;
      const rel = `${dir}/${posix(String(filename))}`;
      if (ignored(rel)) return;
      schedule(runs, rel);
    });
  } catch (e) {
    console.error(
      `✗ cannot watch ${dir}/ — ${e.message}\n` +
        `  Recursive fs.watch needs Node >= 20 on Linux. Everything else still works; ` +
        `run \`npm run build\` by hand after an edit.`
    );
  }
}

/* ---------- serve ---------- */
let server = null;
if (SERVE) {
  const args = PORT ? ["run", "serve", "--", "-l", PORT] : ["run", "serve"];
  server = spawn("npm", args, { cwd: root, stdio: "inherit", shell: true });
  server.on("close", (code) => {
    if (code !== 0 && code !== null) console.error(`✗ serve exited (${code})`);
  });
}

const stop = () => {
  if (server && !server.killed) server.kill();
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);

console.log(
  `watching  ${WATCHED.map((w) => `${w.dir}/`).join("  ")}\n` +
    `  design-system/ → build.mjs then build-content.mjs   (the counts flow one way)\n` +
    `  content/       → build-content.mjs\n` +
    `  ignoring generated output: ${IGNORED.join(" ")}\n` +
    (SERVE ? `serving   http://localhost:${PORT ?? 3000}\n` : `not serving (--no-serve)\n`) +
    `\nNothing here changes what ships — it only saves you the manual re-run.\n` +
    `Ctrl-C to stop.\n`
);
