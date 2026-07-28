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
import { readFileSync } from "node:fs";

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
     slowest (evals, then the behavioural suite) are last. */
  const gates = ciCommands(yml).filter((c) => !SETUP.has(c));
  const expected = [
    "node design-system/scripts/build.mjs --check",
    "node scripts/build-content.mjs --check",
    "node scripts/check-css.mjs",
    "node scripts/build-vectors.mjs --check",
    "node scripts/check-boundaries.mjs",
    "node evals/run.mjs --check",
    "npm test",
  ];
  assert.deepEqual(
    gates.slice(0, expected.length),
    expected,
    "the gate order changed — if that is deliberate, change this list and say why in the commit"
  );
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

test("engines.node covers the --env-file flag those scripts use", (t) => {
  /* Reported, not enforced, and deliberately so. `node --env-file` landed in
     20.6 while `engines` says >=20, so a contributor on 20.0–20.5 gets
     `bad option: --env-file` from `npm run evals` — which reads as "the eval
     is broken", not "your Node is too old". The fix is one field in
     package.json that this suite's owner may not edit, and failing here would
     put a red gate in front of every commit over a metadata line. A gate
     people learn to step over is worse than none; a diagnostic in every run
     is the honest weight for this. */
  const min = String(pkg.engines?.node ?? "").match(/(\d+)(?:\.(\d+))?/);
  const major = Number(min?.[1] ?? 0);
  const minor = Number(min?.[2] ?? 0);
  const covered = major > 20 || (major === 20 && minor >= 6);
  const using = Object.entries(pkg.scripts).filter(([, v]) => v.includes("--env-file")).map(([k]) => k);

  if (!covered && using.length) {
    t.diagnostic(
      `engines.node is "${pkg.engines?.node}" but ${using.join(", ")} use --env-file, which needs >=20.6. ` +
        `Bump engines.node to ">=20.6.0".`
    );
  }
  assert.ok(using.length, "sanity: something should be loading .env");
});
