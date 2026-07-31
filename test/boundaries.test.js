/* ============================================================
   scripts/check-boundaries.mjs — the gate's own failure path.

   The boundary checker is the only invariant in this repo that has a
   checker rather than a paragraph, which makes it the one gate whose
   silence has to mean something. It passed the repo before this file
   existed too — while being blind to `await import("../api/mcp.js")`,
   blind to `readFileSync(new URL("../../api/chat.js", …))`, and having
   no rule for js/ at all. Green told you nothing about any of them.

   So: run the SHIPPED gate, as a child process, against a miniature
   repo carrying one deliberate violation of each form, and require it
   to fail at the right file, the right LINE, and with the sentence
   that says what to do instead. Then run it against the same repo with
   the legitimate crossings in place and require it to pass.

   The matrix is test/fixtures/boundary-cases.json — data, not code,
   because sources containing deliberate violations would otherwise be
   scanned by the very gate under test.
   ============================================================ */
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const CHECKER = fileURLToPath(new URL("../scripts/check-boundaries.mjs", import.meta.url));
const MATRIX = JSON.parse(readFileSync(new URL("./fixtures/boundary-cases.json", import.meta.url), "utf8"));

/** Materialise one case as a throwaway repo and run the real gate over it. */
function runCase(kase) {
  const dir = mkdtempSync(join(tmpdir(), "bounds-"));
  try {
    const files = { ...MATRIX.base, ...(kase.files ?? {}) };
    for (const path of kase.remove ?? []) delete files[path];
    for (const [rel, body] of Object.entries(files)) {
      const abs = join(dir, ...rel.split("/"));
      mkdirSync(dirname(abs), { recursive: true });
      writeFileSync(abs, body);
    }
    const r = spawnSync(process.execPath, [CHECKER, dir], { encoding: "utf8" });
    return { status: r.status, out: `${r.stdout}${r.stderr}` };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

for (const kase of MATRIX.cases) {
  test(`boundaries: ${kase.name}`, () => {
    const { status, out } = runCase(kase);

    assert.equal(
      status,
      kase.expect.exit,
      `expected exit ${kase.expect.exit} (${kase.form}) but got ${status}.\n${out}`
    );

    /* A gate that reports the wrong line is a gate people stop reading, and one
       that reports no line at all is a search across the slice. */
    if (kase.expect.at) {
      assert.ok(
        out.includes(kase.expect.at),
        `expected the failure to name ${kase.expect.at}. Got:\n${out}`
      );
    }
    /* The message has to say what to do instead, not only that something is
       wrong — that sentence is the only part a contributor acts on. */
    for (const fragment of kase.expect.contains ?? []) {
      assert.ok(out.includes(fragment), `expected the message to contain ${JSON.stringify(fragment)}. Got:\n${out}`);
    }
    if (kase.expect.exit === 1) {
      assert.match(out, /See ARCHITECTURE\.md/, `a failure must point at the document it is enforcing.\n${out}`);
    }
  });
}

test("boundaries: every reference form in the matrix is exercised in both directions", () => {
  /* The matrix is only worth what it covers. A form with no failing case is an
     unproven regex; a form with no passing case is a rule nobody has shown to be
     survivable. Both halves are asserted here so that deleting a case is louder
     than deleting an assertion inside one. */
  const failing = MATRIX.cases.filter((c) => c.expect.exit === 1);
  const passing = MATRIX.cases.filter((c) => c.expect.exit === 0);
  assert.ok(failing.length >= 14, `only ${failing.length} failing cases — one per reference form, plus the artefacts`);
  assert.ok(passing.length >= 16, `only ${passing.length} passing cases — the controls are what stop over-blocking`);

  const text = JSON.stringify(MATRIX.cases);
  for (const form of ["await import(", "new URL(", "readFileSync(", "import {"]) {
    assert.ok(text.includes(form), `no case exercises \`${form}\``);
  }

  /* And every slice with a rule has at least one case of each colour standing
     over it. A rule with no failing case is an unproven regex; a rule with no
     passing case is one nobody has shown a real file can live under. apps/next
     arrived with seven bans and would otherwise have arrived untested, because
     the slice it governs does not exist yet. */
  for (const slice of ["js/", "lib/knowledge/", "api/", "evals/", "apps/next/"]) {
    for (const [colour, group] of [
      ["failing", failing],
      ["passing", passing],
    ]) {
      assert.ok(
        group.some((c) => Object.keys(c.files ?? {}).some((f) => f.startsWith(slice))),
        `no ${colour} case puts a file under ${slice} — that slice's rule is half-proven`
      );
    }
  }
});

test("boundaries: the gate covers js/ and apps/next, and reports how many slices it covers", () => {
  /* Two things pinned in one assertion, because they change together.

     js/ had no rule until Wave 3: RULES named six slices and the site's client
     JS was not one of them, so js/main.js could import lib/knowledge/tools.js
     and the gate would applaud. apps/next is the eighth, and it landed BEFORE
     the app did — a slice whose rule is written after its first import is a
     rule negotiated with the code it is supposed to govern.

     A slice rule is a statement about the shape of the repo, so adding one is a
     documentation edit as well as a code one. This number is the thing that
     makes you notice. If it changes, walk ARCHITECTURE.md and the owning
     agent's charter in the same commit and make them agree. */
  const r = spawnSync(process.execPath, [CHECKER], { encoding: "utf8" });
  const out = `${r.stdout}${r.stderr}`;
  assert.equal(r.status, 0, `the repo does not pass its own boundary gate:\n${out}`);

  const m = out.match(/\((\d+) slice rules/);
  assert.ok(m, `the gate no longer reports its slice-rule count: ${out}`);
  assert.equal(Number(m[1]), 8, "the slice-rule count changed — walk the docs and the charters in the same commit");
});

test("boundaries: a pinned crossing with the wrong ../ depth is rejected, not silently ignored", () => {
  /* The apps/next crossings were pinned before the app existed, which is the
     point of them and also their one failure mode: section 3 pattern-tests a
     pin and never touches the disk, so a spec with one `../` too few resolves
     to apps/content/dist/content.json, matches no ban, and passes — a green
     line asserting nothing about a boundary nobody has drawn yet. The gate
     carries CROSSING_SURFACES to catch exactly that, and this is the only way
     to watch it work, because the pin table is code and cannot be injected.

     So: the shipped gate, copied byte-for-byte to a temp path with one `../`
     removed from one pin, run against the same fixture. The copy is the whole
     file; the diff is four characters. If the guard goes, this goes red. */
  const src = readFileSync(CHECKER, "utf8");
  const good = '"../../../../content/dist/content.json"';
  assert.ok(src.includes(good), `the apps/next corpus pin is no longer spelled ${good} — retarget this test`);

  const dir = mkdtempSync(join(tmpdir(), "bounds-pin-"));
  try {
    for (const [rel, body] of Object.entries(MATRIX.base)) {
      const abs = join(dir, ...rel.split("/"));
      mkdirSync(dirname(abs), { recursive: true });
      writeFileSync(abs, body);
    }
    const miscounted = join(dir, "gate.mjs");
    writeFileSync(miscounted, src.replace(good, '"../../../content/dist/content.json"'));

    const r = spawnSync(process.execPath, [miscounted, dir], { encoding: "utf8" });
    const out = `${r.stdout}${r.stderr}`;
    assert.equal(r.status, 1, `a pin that resolves outside every published surface must fail the gate.\n${out}`);
    assert.match(out, /apps\/next\/src\/lib\/content\.ts/, `the failure must name the pin that is wrong.\n${out}`);
    assert.match(out, /resolves to "apps\/content\/dist\/content\.json"/, `and where it actually points.\n${out}`);
    assert.match(out, /depth in the pin is wrong/, `and what to do about it.\n${out}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("boundaries: every read that leaves apps/next is pinned in CROSSINGS", () => {
  /* The pin table is a CENSUS, and a census is only worth the thing it was
     counted against. Section 3 asserts that each pin is still legal; nothing
     asserted that each real crossing is still pinned — so the sync script could
     grow a sixth stylesheet, a second asset directory, a read of anything else
     published, and the gate would go on cheerfully proving five old lines.
     That is the same silence CROSSINGS exists to break, one level up.

     So: read the source of truth — apps/next/scripts/sync-artifacts.mjs, the
     one file whose whole job is reaching out of the app — resolve each of its
     quoted `new URL(…, import.meta.url)` specs the way the gate would, and
     require every one that LEAVES apps/next to appear in the table. The
     leaving test is what exempts `../node_modules/@yordan/design-system/…`
     without naming it: that resolves to apps/next's own node_modules, is the
     package's published `files` surface reached through the resolver, and is
     not a path across the repo. It is asserted below to still resolve inward,
     because the day it does not it is a crossing and belongs in the table. */
  const gate = readFileSync(CHECKER, "utf8");
  const syncRel = "apps/next/scripts/sync-artifacts.mjs";
  const sync = readFileSync(new URL(`../${syncRel}`, import.meta.url), "utf8");

  const block = gate.match(/const CROSSINGS = \[([\s\S]*?)\n\];/);
  assert.ok(block, "the CROSSINGS table is no longer recognisable in scripts/check-boundaries.mjs");
  const pinned = new Set(
    [...block[1].matchAll(/"apps\/next\/scripts\/sync-artifacts\.mjs",\s*"([^"]+)"/g)].map((m) => m[1])
  );

  /* Same resolution rule as the gate: a spec is relative to its own file's
     directory. Only double-quoted literals — the template forms in that script
     build DESTINATIONS out of variables, and a write is not a dependency. */
  const specs = [...sync.matchAll(/new URL\(\s*"(\.[^"]*)"\s*,\s*import\.meta\.url\s*\)/g)].map((m) => m[1]);
  assert.ok(specs.length >= 8, `only ${specs.length} literal sources in ${syncRel} — has it stopped writing them out?`);

  const resolve = (spec) => join(dirname(syncRel), spec).split("\\").join("/");
  const leaving = specs.filter((s) => !resolve(s).startsWith("apps/next/"));
  const inward = specs.filter((s) => resolve(s).startsWith("apps/next/"));

  for (const spec of leaving) {
    assert.ok(
      pinned.has(spec),
      `${syncRel} reads "${spec}" (→ ${resolve(spec)}), which leaves the app, and no line of CROSSINGS says so. ` +
        `Add it to scripts/check-boundaries.mjs — an unpinned crossing is one nobody has agreed to.`
    );
  }
  assert.ok(leaving.length >= 8, `only ${leaving.length} crossings found in ${syncRel} — this test has lost its subject`);
  assert.ok(
    inward.some((s) => s.includes("node_modules")),
    "the avatar no longer resolves inside apps/next/node_modules — if it now reaches across the repo, pin it"
  );
});

test("boundaries: every design-system read in evals/generation.mjs is pinned in CROSSINGS", () => {
  /* The same census, one slice over. evals/generation.mjs reads the component
     contract straight out of design-system/dist, and it PASSES the gate today
     by silence — the `evals` rule bans the design system's source directories
     and says nothing about dist/. Silence is what CROSSINGS exists to make
     audible: without a pin, tightening that rule to `^design-system/` (which
     reads as a tidy-up) would turn the eval red and the gate would blame the
     eval rather than the line that changed.

     Derived from the source, not hard-coded, so a third read cannot arrive
     unpinned. These are `join(root, "design-system", "dist", …)` calls — a form
     the checker deliberately does not resolve (see its header on `join`), which
     is precisely why nothing else would ever notice them.

     What is asserted is the INPUTS. evals/generation.json — the output — is
     covered by nothing on purpose, and the assertion below is that it stays
     that way: a pin naming it would be a staleness claim only a billed run
     could satisfy. */
  const gate = readFileSync(CHECKER, "utf8");
  const genRel = "evals/generation.mjs";
  const gen = readFileSync(new URL(`../${genRel}`, import.meta.url), "utf8");

  /* Comments stripped on both sides. Both tables explain in prose what they
     deliberately leave out — this pin's own note quotes generation.json in
     order to say it is NOT pinned — so a reader that could not tell an entry
     from the sentence about the absence of one would forbid the explanation.
     Same call the gate itself makes before scanning a source. */
  const code = (s) => (s ?? "").replace(/\/\*[\s\S]*?\*\//g, "");

  const block = gate.match(/const CROSSINGS = \[([\s\S]*?)\n\];/);
  assert.ok(block, "the CROSSINGS table is no longer recognisable in scripts/check-boundaries.mjs");
  const pinned = new Set(
    [...code(block[1]).matchAll(/"evals\/generation\.mjs",\s*"([^"]+)"/g)].map((m) => m[1])
  );

  const reads = [
    ...code(gen).matchAll(/join\(\s*root\s*,\s*"design-system"\s*,\s*"dist"\s*,\s*"([^"]+)"\s*\)/g),
  ].map((m) => `design-system/dist/${m[1]}`);
  assert.ok(
    reads.length >= 2,
    `only ${reads.length} design-system/dist reads found in ${genRel} — this test has lost its subject, ` +
      `or the file now reaches the contract some other way. Retarget it before deleting it.`
  );

  for (const target of reads) {
    assert.ok(
      pinned.has(target),
      `${genRel} reads "${target}", which leaves evals/ for another slice's published surface, and no line of ` +
        `CROSSINGS says so. Add it to scripts/check-boundaries.mjs — an unpinned crossing is one nobody has agreed to.`
    );
  }

  /* The other direction, so a pin cannot outlive the read it describes. */
  const stale = [...pinned].filter((p) => !reads.includes(p));
  assert.deepEqual(stale, [], `CROSSINGS still pins ${genRel} → ${stale.join(", ")}, which it no longer reads.`);

  /* And the output stays outside every gate, which is the file's own stated
     position: "covered by NOTHING … no boundary pin names it". */
  assert.ok(
    !code(block[1]).includes("generation.json"),
    "generation.json is committed evidence from a billed manual run, not an artefact a gate can reproduce — " +
      "pinning it would assert a freshness nobody can restore without spending money. See its header."
  );
  assert.ok(
    !code(gate.match(/const ARTEFACTS = \[([\s\S]*?)\n\];/)?.[1]).includes("generation.json"),
    "generation.json must not join ARTEFACTS either — same reason"
  );
});

test("boundaries: the apps/next rule and the charter that promises it say the same thing", () => {
  /* The gate is written before the app, so for one whole phase
     .claude/agents/next-app.md is the ONLY thing the scaffolding agent reads
     about its own boundary. A charter that lists a ban the gate does not hold
     is a promise the repo will not keep; a gate holding a ban the charter never
     mentions is a red build with no warning. They are two renderings of one
     decision and this is the seam between them.

     Text comparison, deliberately — the charter is prose and the gate is
     regexes, and there is no artefact between them to compare instead. What is
     asserted is that every banned slice is named in the charter's own sentence
     about the gate, and that the exception is spelled out there too. */
  const gate = readFileSync(new URL("../scripts/check-boundaries.mjs", import.meta.url), "utf8");
  const charter = readFileSync(new URL("../.claude/agents/next-app.md", import.meta.url), "utf8");

  const rule = gate.match(/slice: "apps\/next",\s*banned: \[([\s\S]*?)\n\s*\],/);
  assert.ok(rule, "the apps/next rule is no longer recognisable in scripts/check-boundaries.mjs");
  const banned = [...rule[1].matchAll(/\/\^([a-z-]+)\\\//g)].map((m) => m[1]);
  assert.deepEqual(
    [...new Set(banned)].sort(),
    ["api", "content", "evals", "js", "lib", "scripts"],
    "the apps/next rule bans a different set of slices than the charter was written against"
  );

  const claim = charter.match(/\(banned:[\s\S]*?\)/);
  assert.ok(claim, "next-app.md no longer states which slices its gate bans");
  for (const slice of banned) {
    assert.ok(
      claim[0].includes(`\`${slice}/\``) || claim[0].includes(`${slice} sources`),
      `the gate bans \`${slice}/\` from apps/next and the charter does not say so: ${claim[0]}`
    );
  }
  assert.match(
    claim[0],
    /evals\/` except\s+`?evals\/dist\/`?/,
    "the charter must name the one exception inside a banned slice, or the app will not know it may read evals/dist/"
  );
});
