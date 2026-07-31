#!/usr/bin/env node
/* The entry point behind `npm test`.
 *
 * It exists for one reason: to hand `node --test` an EXPLICIT list of files, so
 * discovery cannot wander out of this directory.
 *
 * Bare `node --test` uses Node's built-in discovery patterns, and one of them is
 * `**​/test-*.?(c|m)js` — which matches every file in the repo whose name starts
 * with `test-`, anywhere, at any depth. When the design system landed its
 * Storybook gates it added `design-system/scripts/test-storybook.mjs`, and from
 * that moment `npm test` — and therefore `npm run check`, which is supposed to
 * be offline, browser-free and a few seconds long — was booting a Storybook
 * build and a Chromium harness. Nothing said so; the suite just got slower and
 * started failing for a reason that had nothing to do with any test.
 *
 * Why a script rather than an argument to `node --test`:
 *
 *   node --test test/                 works on 20 and 22, and on 24 runs ZERO
 *                                     tests and exits 1 — 24 reads a positional
 *                                     as a glob, and `test/` matches no file, so
 *                                     it tries to execute a module called `test`.
 *   node --test 'test/**​/*.test.js'   works on 24; glob positionals only arrived
 *                                     in Node 21, and CI pins 20.
 *   node --test <file> <file> …       works on all of them.
 *
 * The last one is the only portable form, and a list nobody maintains by hand is
 * the only kind worth having — so it is read off the directory here, and
 * test/ci.test.js checks the result against the directory again from the outside.
 *
 * Extra arguments are forwarded, and deliberately placed BEFORE the file list:
 * `node --test a.test.js --test-reporter=tap` reads the reporter flag as another
 * file pattern and silently matches nothing.
 */

import { spawn } from "node:child_process";
import { readdirSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");

/** Every test file under test/, depth-first and sorted, as repo-relative paths. */
export function testFiles(dir = HERE) {
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...testFiles(p));
    else if (e.name.endsWith(".test.js")) out.push(relative(ROOT, p).split("\\").join("/"));
  }
  return out;
}

/* Only run when invoked as a script.
 *
 * Two things must not trigger it. ci.test.js imports `testFiles` from here, and
 * an import must not spawn a copy of the suite. And this file lives under test/,
 * so it matches Node's `**​/test/**​/*.mjs` pattern itself: anyone who still types
 * a bare `node --test` would otherwise have the runner execute the runner.
 * `process.argv[1]` is the same in both cases — it is the path of this file
 * either way — so the check that actually separates them is NODE_TEST_CONTEXT,
 * which Node sets ("child-v8") only when a file is being run AS a test. */
const invokedDirectly =
  !process.env.NODE_TEST_CONTEXT && process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];

if (invokedDirectly) {
  const files = testFiles();

  /* A runner that finds nothing must never exit 0. This is the failure mode that
     makes a scoped invocation more dangerous than an unscoped one: every glob
     form that matched no file in testing still reported success, which is a
     green suite that ran nothing at all. */
  if (files.length === 0) {
    console.error("test/run.mjs found no *.test.js files under test/ — refusing to report success.");
    process.exit(1);
  }

  const child = spawn(process.execPath, ["--test", ...process.argv.slice(2), ...files], {
    cwd: ROOT,
    stdio: "inherit",
  });
  child.on("error", (err) => {
    console.error(`test/run.mjs could not start node: ${err.message}`);
    process.exit(1);
  });
  child.on("close", (code, signal) => process.exit(signal ? 1 : (code ?? 1)));
}
