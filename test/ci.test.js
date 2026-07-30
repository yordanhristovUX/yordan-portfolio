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
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

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

test("the test script takes no path argument", () => {
  /* `node --test test/` exits 1 on Node 24 — it resolves the argument as a
     test named `test` rather than as a directory — while passing on 20 and 22.
     Bare `node --test` uses the built-in discovery pattern, which already
     includes everything under test/, and behaves the same on all three.
     Pinned because the failure looks like a broken test, not a broken flag. */
  assert.equal(
    pkg.scripts.test,
    "node --test",
    "keep the test script argument-free — see the comment in test/ci.test.js"
  );
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
