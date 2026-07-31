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
  assert.ok(failing.length >= 13, `only ${failing.length} failing cases — one per reference form, plus the artefacts`);
  assert.ok(passing.length >= 13, `only ${passing.length} passing cases — the controls are what stop over-blocking`);

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
