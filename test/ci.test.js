/* ============================================================
   `npm run check` ≡ CI.

   Audit 03 · m2: `check` ran three of the gates CI runs, so "green
   locally" and "green in CI" were different claims and only one of
   them stopped a merge. The fix is trivial and the regression is
   inevitable — the next gate anyone adds goes into the workflow,
   because that is where it fails, and not into the script, because
   nothing complains. This is the thing that complains.

   ARTEFACT COMPARISON, in the spirit of verifyTokeniser: it does not
   test a function, it recomputes one shipped file's command list from
   the other and demands exact agreement, in order. There is nowhere
   for a discrepancy to hide, and the assertion cannot be satisfied by
   editing the test.

   The YAML is parsed by hand — a workflow file has a fixed, tiny
   shape and CI's whole story is that it needs no dependency to run.
   The parser is deliberately strict: it fails loudly if the shape
   stops being the one it understands, rather than quietly finding
   fewer steps and passing.
   ============================================================ */
import test from "node:test";
import assert from "node:assert/strict";
import { globSync, readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { testFiles } from "./run.mjs";

const root = new URL("../", import.meta.url);
const pkg = JSON.parse(readFileSync(new URL("package.json", root), "utf8"));
const yml = readFileSync(new URL(".github/workflows/ci.yml", root), "utf8");

/* Steps that are not gates: they put Node and node_modules on the box. They
   have no local equivalent because a developer already has both. */
const SETUP = new Set(["npm ci"]);

/**
 * Every command CI executes, flattened in order.
 * `run: cmd` is one command; `run: |` followed by an indented block is one
 * command per non-blank line, which is how the api smoke-import step is written.
 */
function ciCommands(source) {
  const lines = source.split(/\r?\n/);
  const steps = [];
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^(\s*)(-\s+)?run:\s*(.*)$/);
    if (!m) continue;
    const keyCol = m[1].length + (m[2]?.length ?? 0);
    const value = m[3].trim();
    if (!/^[|>]/.test(value)) {
      steps.push(value);
      continue;
    }
    for (let j = i + 1; j < lines.length; j++) {
      const line = lines[j];
      if (line.trim() && line.match(/^\s*/)[0].length <= keyCol) break;
      if (line.trim()) steps.push(line.trim());
      i = j;
    }
  }
  return steps;
}

/** The `check` script, split back into the commands the shell will run. */
const checkCommands = String(pkg.scripts.check)
  .split("&&")
  .map((s) => s.trim())
  .filter(Boolean);

test("npm run check runs exactly the gates CI runs, in CI's order", () => {
  const gates = ciCommands(yml).filter((c) => !SETUP.has(c));

  /* Sanity first. A parser that silently found nothing would make every
     assertion below vacuously true — the exact failure this file exists to
     prevent, one level up. */
  assert.ok(gates.length >= 8, `parsed only ${gates.length} run steps out of ci.yml — the workflow shape changed`);
  assert.ok(checkCommands.length >= 8, `the check script has only ${checkCommands.length} commands`);

  assert.deepEqual(
    checkCommands,
    gates,
    `package.json \`check\` and .github/workflows/ci.yml have drifted.\n` +
      `  CI:    ${gates.join("\n         ")}\n` +
      `  check: ${checkCommands.join("\n         ")}\n` +
      `  Add the gate to BOTH. A gate that only CI runs is a gate contributors discover after pushing.`
  );
});

test("the gate order is the documented one", () => {
  /* ARCHITECTURE.md's run order is load-bearing in one direction — build.mjs
     emits the counts build-content.mjs interpolates — so tokens must precede
     content. The rest of the order is cheapest-first, which is why the two
     slowest (evals, then the behavioural suite) are last.

     Two positions are load-bearing for a reason of their own:

       contract-diff reads design-system/dist/, so it follows the step that
       writes it.

       The drift pair (`npm run build`, then `git diff`) FOLLOWS both --check
       gates rather than leading. It regenerates the working tree, so first
       place would leave `build.mjs --check` byte-comparing two files it had
       just written and `build-content.mjs --check` comparing six of them —
       every staleness assertion above would become a tautology. Last place
       among the artefact gates costs one extra build and keeps them honest.

     A RegExp entry asserts the shape of a command whose exact text lives in
     package.json — the pathspec list is checked, path by path, against what
     the generators actually write, in test/drift.test.js. */
  const gates = ciCommands(yml).filter((c) => !SETUP.has(c));
  const expected = [
    "node design-system/scripts/build.mjs --check",
    "node design-system/scripts/contract-diff.mjs --check",
    "node scripts/build-content.mjs --check",
    "npm run build",
    /^git diff --exit-code -- \S/,
    "node scripts/check-css.mjs",
    "node scripts/build-vectors.mjs --check",
    "node scripts/check-boundaries.mjs",
    "node evals/run.mjs --check",
    "npm test",
  ];
  expected.forEach((want, i) => {
    const got = gates[i];
    const why = "the gate order changed — if that is deliberate, change this list and say why in the commit";
    if (want instanceof RegExp) assert.match(String(got), want, `step ${i + 1}: ${why}`);
    else assert.equal(got, want, `step ${i + 1}: ${why}`);
  });
});

test("every CI gate carries a name", () => {
  /* An unnamed step shows up in the GitHub UI as its own command, which is how
     a failing gate becomes hard to read at exactly the moment it matters. */
  const steps = yml
    .split(/^ {6}- /m)
    .slice(1)
    .filter((s) => /(^|\n)\s*run:/.test(`\n${s}`));
  const unnamed = steps
    .filter((s) => !/(^|\n)\s*name:/.test(`\n${s}`))
    .map((s) => s.split("\n")[0].replace(/^run:\s*/, "").trim())
    .filter((c) => !SETUP.has(c));
  assert.deepEqual(unnamed, [], `CI steps without a name: ${unnamed.join(", ")}`);
});

test("the test script runs the scoped runner, not bare discovery", () => {
  /* This line has now been wrong in both directions, so both are written down.

     It used to be a bare `node --test`, because `node --test test/` exits 1 on
     Node 24 — 24 reads a positional as a glob, `test/` matches no file, and it
     tries to execute a module named `test`, running ZERO tests — while passing
     on 20 and 22. That much is still true and still measured.

     What made bare wrong is that "the built-in discovery pattern already
     includes everything under test/" was only half of it: the pattern is not
     rooted at test/. `**​/test-*.?(c|m)js` matches anywhere in the repo, so
     design-system/scripts/test-storybook.mjs joined the suite the day it was
     written and `npm run check` started building Storybook and launching
     Chromium — inside the gate whose entire promise is that it does neither.

     A glob argument would fix the scope on 24 and break Node 20, which is what
     CI pins. An explicit list of files is the one form every version accepts,
     so test/run.mjs reads the directory and passes the files by name. */
  assert.equal(
    pkg.scripts.test,
    "node test/run.mjs",
    "keep `npm test` on the scoped runner — see the comment in test/ci.test.js"
  );
});

test("the runner runs every test file, and only test files", () => {
  /* ARTEFACT COMPARISON. The runner builds its list by reading the directory;
     this rebuilds it from the directory independently and demands exact
     agreement. A test file that stops being run is the quietest possible
     regression — the suite still passes, with less behind it. */
  const dir = fileURLToPath(new URL("./", import.meta.url));
  const onDisk = readdirSync(dir, { withFileTypes: true, recursive: true })
    .filter((e) => e.isFile() && e.name.endsWith(".test.js"))
    .map((e) => `test/${e.name}`)
    .sort();

  assert.ok(onDisk.length >= 11, `found only ${onDisk.length} test files — the directory shape changed`);
  assert.deepEqual(testFiles().sort(), onDisk, "test/run.mjs and the directory disagree about what the suite is");

  /* And this file is in it — the cheapest possible proof the list is not just
     internally consistent but actually the thing being executed right now. */
  assert.ok(onDisk.includes("test/ci.test.js"), "sanity: the running file should be in the list");
});

/* Node's documented default discovery patterns — what a bare `node --test`
   would sweep up. None of them is rooted anywhere; every one is `**​/`. */
const NODE_DEFAULT_PATTERNS = [
  "**/*.test.?(c|m)js",
  "**/*-test.?(c|m)js",
  "**/*_test.?(c|m)js",
  "**/test-*.?(c|m)js",
  "**/test.?(c|m)js",
  "**/test/**/*.?(c|m)js",
];

/* Files outside test/ that match a default pattern by name but are NOT tests.
   Each one is a live trip-hazard: `npm test` is safe because the runner passes
   explicit paths, but a bare `node --test` — the documented Node idiom, and
   what a contributor types without thinking — still executes these.
   The fix is a rename in the owning slice, not another entry here. */
const NOT_A_TEST_DESPITE_THE_NAME = {
  "design-system/scripts/test-storybook.mjs":
    "the Storybook a11y/visual harness. Matches `**/test-*.mjs`, builds storybook-static and drives Chromium. " +
    "Owned by design-system; wants renaming to something outside the pattern (storybook-gates.mjs), after which this entry goes.",
};

test("nothing outside test/ can rejoin the suite by being named like one", () => {
  /* The guard for the next one. A file called `test-anything.mjs`, or any
     `.mjs` under a directory called `test/` in another slice, is one bare
     `node --test` away from running inside a gate that promises to be offline.
     Known cases are listed above with an owner; a new one fails here. */
  const root = fileURLToPath(new URL("../", import.meta.url));
  const found = new Set();
  for (const pattern of NODE_DEFAULT_PATTERNS) {
    for (const hit of globSync(pattern, { cwd: root, exclude: (n) => n === "node_modules" })) {
      const rel = hit.split("\\").join("/");
      if (!rel.startsWith("test/") && !rel.includes("node_modules/")) found.add(rel);
    }
  }

  const unexplained = [...found].filter((f) => !NOT_A_TEST_DESPITE_THE_NAME[f]).sort();
  assert.deepEqual(
    unexplained,
    [],
    `these match Node's default test discovery but are not tests: ${unexplained.join(", ")}.\n` +
      `  A bare \`node --test\` executes them. Rename the file out of the pattern, or — if it really is a ` +
      `test — move it under test/ so the runner picks it up.`
  );

  /* The other direction, so an entry cannot outlive the file it excuses. */
  const stale = Object.keys(NOT_A_TEST_DESPITE_THE_NAME).filter((f) => !found.has(f));
  assert.deepEqual(stale, [], `NOT_A_TEST_DESPITE_THE_NAME still lists ${stale.join(", ")}, which no longer matches — delete the entry.`);
});

test("every script the docs and the scaffolds invoke exists", () => {
  /* `npm run <name>` on a missing script fails with a usage dump that says
     nothing about what was meant. These are the names the READMEs, the
     scaffolds' closing instructions and scripts/dev.mjs hand to a human. */
  for (const name of ["dev", "build", "build:all", "check", "test", "serve", "new:component", "new:project"]) {
    assert.ok(pkg.scripts[name], `package.json has no \`${name}\` script`);
  }
});

test("the scripts that need a key load .env, and the offline ones do not", () => {
  /* Finding T3. Both keys are in .env and Node does not read .env on its own,
     so the documented `node evals/run.mjs` saw no key, printed
     `skipped (no VOYAGE_API_KEY)` and republished the table without the
     embeddings arms — deleting the strongest genuine number in the repo
     without a single error message.

     The other direction matters just as much: no gate may load .env. CI has
     no .env, and a gate whose behaviour depends on one is a gate that means
     something different locally than it does in CI. */
  for (const name of ["build:all", "evals"]) {
    assert.match(pkg.scripts[name], /--env-file=\.env/, `\`${name}\` builds or publishes with a key and must load .env`);
  }
  for (const name of ["check", "build", "test", "dev", "serve"]) {
    assert.doesNotMatch(pkg.scripts[name], /--env-file/, `\`${name}\` must run identically with and without .env`);
  }
});

test("engines.node covers the --env-file flag those scripts use", () => {
  /* `node --env-file` landed in 20.6. While `engines` said `>=20`, a contributor
     on 20.0–20.5 running the documented `npm run evals` got `bad option:
     --env-file` — which reads as "the eval is broken", not "your Node is too
     old", and the two send you to completely different files.

     This was a diagnostic for one wave, because the field belonged to another
     owner and a red gate over a metadata line is a gate people learn to step
     over. The field is now `>=20.6.0`, so it is an assertion: the failure it
     describes costs an afternoon and the check costs nothing.

     Derived, not hard-coded. It reads which scripts actually carry --env-file,
     so adding the flag to a third script re-arms it automatically, and dropping
     it everywhere retires the floor rather than leaving a number nobody can
     explain. */
  const FLAG = { name: "--env-file", major: 20, minor: 6 };
  const using = Object.entries(pkg.scripts).filter(([, v]) => v.includes(FLAG.name)).map(([k]) => k);
  assert.ok(using.length, "sanity: something should be loading .env");

  const min = String(pkg.engines?.node ?? "").match(/(\d+)(?:\.(\d+))?/);
  const major = Number(min?.[1] ?? 0);
  const minor = Number(min?.[2] ?? 0);

  assert.ok(
    major > FLAG.major || (major === FLAG.major && minor >= FLAG.minor),
    `engines.node is "${pkg.engines?.node}" but ${using.join(", ")} use ${FLAG.name}, which needs ` +
      `>=${FLAG.major}.${FLAG.minor}. Raise engines.node, or stop using the flag.`
  );
});

/* ============================================================
   The design system's own workflow

   The two Storybook gates (axe over every story, and the screenshot
   regression) need Chromium and a Storybook build, so they cannot
   join the job above without breaking the one promise it makes:
   everything in `check` runs offline, browser-free and with no heavy
   dependency. They live in .github/workflows/design-system.yml
   instead, path-filtered so they only fire on design-system/**.

   That separation is the thing worth guarding. The obvious "tidy-up"
   is to merge the two workflows, and it would pass every other test
   in this file while making `npm run check` either impossible to run
   offline or no longer equal to CI. These assertions are what makes
   that a red build rather than a discovery.

   Parsed by hand, for the reason in the header — but scoped to the
   `steps:` block, because unlike ci.yml this file has a `paths:` list
   at the same indent as a step and a naive split would read a glob as
   a step and find no `run:` in it.
   ============================================================ */
const dsYml = readFileSync(new URL(".github/workflows/design-system.yml", root), "utf8");

/** The steps of the one job, each as its raw YAML block. */
function jobSteps(source) {
  const at = source.indexOf("\n    steps:\n");
  assert.notEqual(at, -1, "design-system.yml has no `steps:` — the workflow shape changed");
  const blocks = source.slice(at).split(/^ {6}- /m).slice(1);
  assert.ok(blocks.length >= 5, `parsed only ${blocks.length} steps — the workflow shape changed`);
  return blocks.map((b) => ({
    run: b.match(/(?:^|\n)\s*run: (.*)/)?.[1]?.trim() ?? null,
    uses: b.match(/(?:^|\n)\s*uses: (.*)/)?.[1]?.trim() ?? null,
    dir: /(?:^|\n)\s*working-directory: design-system\s*$/m.test(b),
    named: /(?:^|\n)\s*name: /.test(b),
  }));
}

test("the browser gates stay out of the root check and out of ci.yml", () => {
  for (const [what, source] of [["package.json `check`", pkg.scripts.check], ["ci.yml", yml]]) {
    assert.doesNotMatch(
      source,
      /test:(a11y|visual)|playwright|storybook/i,
      `${what} reaches for a browser. The root gate is offline, browser-free and dependency-light — ` +
        `that is why a contributor can run it. These two gates belong in design-system.yml.`
    );
  }
  /* And the other direction, so the separation cannot be resolved by deletion. */
  assert.match(dsYml, /npm run test:a11y/, "design-system.yml no longer runs the a11y gate");
  assert.match(dsYml, /npm run test:visual/, "design-system.yml no longer runs the visual gate");
});

/** The `on:` block, split into one chunk per trigger name. */
function triggers(source) {
  const region = source.slice(source.indexOf("\non:\n"), source.indexOf("\njobs:"));
  const out = {};
  let name = null;
  for (const line of region.split("\n")) {
    const m = line.match(/^ {2}(\w+):/);
    if (m) name = m[1];
    else if (name) out[name] += `\n${line}`;
    if (m) out[m[1]] = "";
  }
  return out;
}

test("the design-system workflow only fires on design-system changes", () => {
  const on = triggers(dsYml);
  assert.deepEqual(
    Object.keys(on).sort(),
    ["pull_request", "push", "workflow_dispatch"],
    "the trigger set changed"
  );
  for (const name of ["push", "pull_request"]) {
    const block = on[name];
    assert.match(block, /paths:/, `the \`${name}\` trigger has no path filter — every commit would install Chromium`);
    assert.match(block, /- "design-system\/\*\*"/, `the \`${name}\` trigger does not watch design-system/**`);
    assert.match(
      block,
      /- "\.github\/workflows\/design-system\.yml"/,
      `the \`${name}\` trigger does not watch its own file — an edit to the workflow would not re-run it`
    );
  }
  /* Unfiltered by design: the manual trigger is how a baseline set gets
     collected without pushing a no-op commit into design-system/. */
  assert.doesNotMatch(on.workflow_dispatch, /paths:/, "workflow_dispatch takes no path filter");
});

test("every design-system step runs in design-system/", () => {
  /* npm ci, the Playwright install and both gates resolve against
     design-system/package.json and its own lockfile. A step that forgets
     `working-directory` runs against the ROOT package.json, where none of
     these scripts exist — and `npm run test:a11y` there fails with a usage
     dump about a missing script, which reads as "the gate is broken". */
  const missing = jobSteps(dsYml).filter((s) => s.run && !s.dir).map((s) => s.run);
  assert.deepEqual(missing, [], `design-system.yml steps without \`working-directory: design-system\`: ${missing.join(", ")}`);

  const unnamed = jobSteps(dsYml).filter((s) => s.run && !s.named).map((s) => s.run);
  assert.deepEqual(unnamed, [], `design-system.yml steps without a name: ${unnamed.join(", ")}`);
});

test("a11y runs before visual, because it is what builds storybook-static", () => {
  /* scripts/test-storybook.mjs rebuilds only when the static build is stale.
     a11y first means the pair costs one build; reversed, the report-only gate
     pays for the build that the gate which can actually fail then reuses —
     and a build failure would surface under the step allowed to exit 0. */
  const runs = jobSteps(dsYml).filter((s) => s.run).map((s) => s.run);
  const a11y = runs.findIndex((c) => c.includes("test:a11y"));
  const visual = runs.findIndex((c) => c.includes("test:visual"));
  assert.ok(a11y !== -1 && visual !== -1, `both gates should be present, got: ${runs.join(", ")}`);
  assert.ok(a11y < visual, "test:a11y must precede test:visual — see the comment above this assertion");

  /* The diffs are gitignored, so the artifact is the only way to read them,
     and `always()` is the only way to get it off a red run. */
  const upload = jobSteps(dsYml).find((s) => s.uses?.startsWith("actions/upload-artifact"));
  assert.ok(upload, "design-system.yml no longer uploads the visual diff");
});

test("the workflow states the report-only window the runner actually enforces", () => {
  /* Derived, not hard-coded. test-runner.cjs holds the date as a constant, and
     the workflow header tells a reader why a green run can list mismatches. On
     the day someone flips the gate to enforcing, this fails until the prose
     agrees with the code — which is the cheapest possible way to stop a
     workflow comment from outliving the policy it describes. */
  const runner = readFileSync(new URL("design-system/.storybook/test-runner.cjs", root), "utf8");
  const date = runner.match(/ENFORCE_FROM\s*=\s*"([\d-]+)"/)?.[1];
  assert.ok(date, "test-runner.cjs no longer declares ENFORCE_FROM — update this test with it");
  assert.ok(
    dsYml.includes(date),
    `design-system.yml never mentions ${date}, the date test-runner.cjs flips the visual gate to enforcing. ` +
      `A reader seeing a green run full of mismatches has nothing to tell them that is deliberate.`
  );
});

/* ============================================================
   Declared dependencies

   Audit m4: "zod is in `dependencies` with zero imports anywhere in the repo —
   it is a transitive of the MCP SDK, remove it." Half right. Nothing imports
   it, and it is still not removable, because a root dependency does two jobs
   and only one of them is "I import this".

     $ npm explain zod
     zod@3.25.76
       zod@"^3.25.76" from the root project              ← the only ^3 constraint
       peerOptional zod@"^3.25.0 || ^4.0.0" from @anthropic-ai/sdk@0.71.2
       zod@"^3.25 || ^4.0" from @modelcontextprotocol/sdk@1.29.0
       peer zod@"^3.25.28 || ^4" from zod-to-json-schema@3.25.2

   Every other constraint admits v4. Delete the root line and the next lockfile
   regeneration resolves zod 4, whose `ZodError.issues` shape is not v3's — and
   the code that reads that shape is `api/mcp.js`'s sanitiser, whose entire job
   is stopping validation internals from reaching a public unauthenticated
   endpoint (`test/tools.test.js` asserts nothing matching /ZodError|zod/ ever
   escapes). A silent major bump under a sanitiser is not a dependency cleanup.

   It is also the SDK's non-optional peer (`peerDependenciesMeta.zod.optional:
   false`). npm hoists it either way; pnpm and `--legacy-peer-deps` do not.

   So the rule is not "every dependency must be imported" — it is "every
   dependency must have a reason, and the reason must be written down". This is
   where it is written down.
   ============================================================ */
const UNIMPORTED_BY_DESIGN = {
  zod: "a major-version pin, not a library: the only ^3 constraint on a package every other consumer would take at ^4. See the block above before deleting.",
};

const CODE = /\.(mjs|js|cjs)$/;
const SKIP = new Set(["node_modules", ".git", "vendor", "generated", "dist", "storybook-static", ".claude", ".vercel"]);

function sources(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith(".") || SKIP.has(e.name)) continue;
    const p = `${dir}/${e.name}`;
    if (e.isDirectory()) sources(p, out);
    else if (CODE.test(e.name)) out.push(p);
  }
  return out;
}

/** Bare specifiers only — a relative path is a file, and `node:` is the runtime. */
const BARE = /(?:^|[^\w$.])(?:import\s[\s\S]*?from\s*|export\s[\s\S]*?from\s*|import\s*|import\s*\(\s*|require\s*\(\s*)["']([^"'./][^"']*)["']/g;

test("every declared dependency is imported, or carries a written reason not to be", () => {
  const imported = new Set();
  for (const file of sources(fileURLToPath(root))) {
    for (const [, spec] of readFileSync(file, "utf8").matchAll(BARE)) {
      if (spec.startsWith("node:")) continue;
      imported.add(spec.startsWith("@") ? spec.split("/").slice(0, 2).join("/") : spec.split("/")[0]);
    }
  }

  const declared = Object.keys(pkg.dependencies ?? {});
  assert.ok(declared.length, "sanity: the project should declare dependencies");

  const unexplained = declared.filter((d) => !imported.has(d) && !UNIMPORTED_BY_DESIGN[d]);
  assert.deepEqual(
    unexplained,
    [],
    `declared but never imported, and no reason given: ${unexplained.join(", ")}. ` +
      `Either remove it, or add it to UNIMPORTED_BY_DESIGN with the evidence — a dependency ` +
      `nobody can justify is one somebody eventually removes for the wrong reason.`
  );

  /* The other direction, so the note cannot outlive the situation it describes. */
  const stale = Object.keys(UNIMPORTED_BY_DESIGN).filter((d) => imported.has(d) || !declared.includes(d));
  assert.deepEqual(
    stale,
    [],
    `UNIMPORTED_BY_DESIGN still explains ${stale.join(", ")}, which is now imported or no longer declared — delete the note.`
  );
});
