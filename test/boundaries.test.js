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
  assert.ok(failing.length >= 6, `only ${failing.length} failing cases — one per reference form, plus the artefacts`);
  assert.ok(passing.length >= 5, `only ${passing.length} passing cases — the controls are what stop over-blocking`);

  const text = JSON.stringify(MATRIX.cases);
  for (const form of ["await import(", "new URL(", "readFileSync(", "import {"]) {
    assert.ok(text.includes(form), `no case exercises \`${form}\``);
  }
});

test("boundaries: the gate covers js/, and reports how many slices it covers", () => {
  /* Two things pinned in one assertion, because they change together.

     js/ had no rule until Wave 3: RULES named six slices and the site's client
     JS was not one of them, so js/main.js could import lib/knowledge/tools.js
     and the gate would applaud. The count is quoted in ARCHITECTURE.md and in
     the audits, so adding the seventh rule is a documentation edit as well as a
     code one — this is the thing that says so. If you add a rule, change the
     number here and in ARCHITECTURE.md in the same commit. */
  const r = spawnSync(process.execPath, [CHECKER], { encoding: "utf8" });
  const out = `${r.stdout}${r.stderr}`;
  assert.equal(r.status, 0, `the repo does not pass its own boundary gate:\n${out}`);

  const m = out.match(/\((\d+) slice rules/);
  assert.ok(m, `the gate no longer reports its slice-rule count: ${out}`);
  assert.equal(
    Number(m[1]),
    7,
    "the slice-rule count changed — update ARCHITECTURE.md's quoted number in the same commit"
  );
});
