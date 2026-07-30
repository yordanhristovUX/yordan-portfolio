/* ============================================================
   The drift gate: `npm run build && git diff --exit-code -- <artefacts>`

   THE GAP IT CLOSES. Every generator in this repo writes its outputs
   unconditionally and only some of them compare first. `build.mjs --check`
   byte-compares two files (tokens.dtcg.json, tokens.d.ts) and REGENERATES
   four (tokens.css, tokens.flat.json, components.json,
   ../content/system.generated.json) — ARCHITECTURE.md calls that "the honest
   gap": a hand-edit to dist/tokens.css was silently overwritten rather than
   failing anything. The drift step runs both generators for real and then asks
   git whether the tree still holds what they produced. Anything recorded in
   git — staged or committed — that disagrees with a fresh generation is a
   non-zero exit and a printed diff.

   (The one case it cannot catch, stated so nobody assumes otherwise: an
   UNSTAGED hand-edit is overwritten by the build before git ever sees it. That
   is not the shipping risk. A hand-edit only reaches another reader by being
   committed, and by then it is in the index, which is exactly what this
   compares against. The two --check gates ahead of it catch the unstaged case
   for the eight artefacts they compare in memory — which is why the drift step
   runs after them and not before.)

   WHAT THIS FILE TESTS, and why it is not a unit test. The gate is one shell
   command; the only things that can be wrong with it are the pathspec list and
   its position in the pipeline. So:

     · the pathspec list is recomputed from the generators' own source — every
       writeFileSync target in every script `npm run build` runs — and demanded
       to agree. Adding an output without guarding it fails here.
     · the list is then resolved by git itself, in this repo, and the resulting
       set of tracked files must be EXACTLY the set the generators write.
       Over-broad (`content/dist` instead of the two files in it) fails, because
       vectors.json is not a generator output and needs a Voyage key to rebuild.
     · and the command is mutation-tested against a scratch git repository:
       hand-edit design-system/dist/tokens.css and the diff must go red naming
       it; hand-edit content/dist/vectors.json and it must stay green. No
       network, no key, and the real working tree is never touched.

   `npm run check` ≡ CI is test/ci.test.js's job — everything here is about
   package.json's copy, which that file proves is the same string CI runs.
   ============================================================ */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));

const commandsOf = (script) =>
  String(script).split("&&").map((s) => s.trim()).filter(Boolean);

const git = (cwd, ...args) => spawnSync("git", args, { cwd, encoding: "utf8" });

/* Repo-relative, POSIX, `..` resolved. Everything below is compared as a
   string, and git speaks forward slashes on every platform. */
function norm(p) {
  const out = [];
  for (const seg of p.split(/[\\/]+/)) {
    if (!seg || seg === ".") continue;
    if (seg === "..") out.pop();
    else out.push(seg);
  }
  return out.join("/");
}

/* ============================================================
   1. The gate, read out of package.json
   ============================================================ */
const check = commandsOf(pkg.scripts.check);
const diffAt = check.findIndex((c) => c.startsWith("git diff"));

const DIFF = diffAt === -1 ? null : check[diffAt];
const PATHSPECS = DIFF ? DIFF.replace(/^git diff [^-]*--exit-code\s+--\s+/, "").split(/\s+/) : [];

/* ============================================================
   2. What the generators actually write

   Derived from the source of every script `npm run build` runs, so the list
   cannot be maintained by hand and cannot be right by coincidence. The parser
   is deliberately strict in the manner of test/ci.test.js's YAML reader: a
   shape it does not understand is a loud failure, never a shorter list that
   passes.
   ============================================================ */

/** A spread in an outputs array yields a directory rather than a filename. */
const SPREADS = {
  /* `...buildWorkPages()` — one page per case study, so the number of files is
     the number of case studies. The directory is guarded, not five names. */
  buildWorkPages: "work",
};

/** Text of the first argument of the call whose `(` is at `from - 1`. */
function firstArg(src, from) {
  let depth = 0;
  let str = null;
  let i = from;
  for (; i < src.length; i++) {
    const c = src[i];
    if (str) {
      if (c === "\\") i++;
      else if (c === str) str = null;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") str = c;
    else if ("([{".includes(c)) depth++;
    else if (")]}".includes(c)) {
      if (depth === 0) break;
      depth--;
    } else if (c === "," && depth === 0) break;
  }
  return src.slice(from, i);
}

/** `const NAME = [` … `];` → one trimmed line per element, comments removed. */
function arrayElements(src, name) {
  const m = new RegExp(`^const ${name} = \\[\\r?\\n([\\s\\S]*?)\\r?\\n\\];`, "m").exec(src);
  if (!m) return null;
  return m[1]
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

/**
 * Every path a generator writes.
 * @returns {{files: string[], dirs: string[], problems: string[]}}
 */
function writesOf(rel) {
  const src = readFileSync(join(root, rel), "utf8");
  /* `root` inside every one of these scripts is the script's parent directory:
     `join(dirname(fileURLToPath(import.meta.url)), "..")`. */
  const genRoot = norm(join(dirname(rel), ".."));
  const files = [];
  const dirs = [];
  const problems = [];
  const at = (i) => `${rel}:${src.slice(0, i).split("\n").length}`;

  const CALL = "writeFileSync(";
  for (let i = src.indexOf(CALL); i !== -1; i = src.indexOf(CALL, i + 1)) {
    const arg = firstArg(src, i + CALL.length).trim();
    const inner = arg.match(/^join\(\s*root\s*,\s*([\s\S]*)\)$/);
    if (!inner) {
      problems.push(`${at(i)}: writeFileSync target \`${arg}\` is not join(root, …) — this test cannot tell what it writes`);
      continue;
    }
    const parts = inner[1].split(",").map((s) => s.trim());
    if (parts.every((p) => /^"[^"]*"$/.test(p))) {
      files.push(norm([genRoot, ...parts.map((p) => p.slice(1, -1))].join("/")));
      continue;
    }

    /* Indirect: `for (const [rel, out] of packaged) writeFileSync(join(root, rel), …)`.
       Resolve the array it loops over and read its literal first columns. */
    if (parts.length !== 1 || !/^[A-Za-z_$][\w$]*$/.test(parts[0])) {
      problems.push(`${at(i)}: writeFileSync target join(root, ${inner[1]}) is neither literal nor a single loop variable`);
      continue;
    }
    let source = null;
    for (const m of src.matchAll(/for \(const \[(\w+)[^\]]*\] of (\w+)\)/g)) {
      if (m.index < i && m[1] === parts[0]) source = m[2];
    }
    if (!source) {
      problems.push(`${at(i)}: writeFileSync writes to \`${parts[0]}\`, which no \`for (const [${parts[0]}, …] of …)\` above it binds`);
      continue;
    }
    const elements = arrayElements(src, source);
    if (!elements) {
      problems.push(`${at(i)}: cannot read \`const ${source} = [ … ];\` — the outputs array is not in the one-element-per-line form this test parses`);
      continue;
    }
    for (const line of elements) {
      const literal = line.match(/^\[\s*"([^"]+)"/);
      if (literal) {
        files.push(norm([genRoot, literal[1]].join("/")));
        continue;
      }
      const spread = line.match(/^\.\.\.\s*(\w+)\s*\(/);
      if (spread && SPREADS[spread[1]]) {
        dirs.push(norm([genRoot, SPREADS[spread[1]]].join("/")));
        continue;
      }
      if (spread) {
        problems.push(`${rel}: \`${source}\` spreads ${spread[1]}(), which SPREADS in this file does not map to a directory — add it, and guard whatever it writes`);
        continue;
      }
      problems.push(`${rel}: cannot read the outputs entry \`${line}\``);
    }
  }
  return { files, dirs, problems };
}

const GENERATORS = commandsOf(pkg.scripts.build).map((c) => {
  const m = c.match(/^node\s+(\S+\.mjs)$/);
  assert.ok(m, `\`npm run build\` runs \`${c}\`, which is not a plain \`node <script>.mjs\` — the drift test reads each generator's source to derive what it writes`);
  return m[1];
});

/* Generated artefacts that must stay OUT of the gate: rebuilding any of them
   costs a Voyage or Anthropic key, and `npm run check` is offline by design.
   Each has a digest-based check of its own — build-vectors.mjs and
   evals/run.mjs compare a corpus hash rather than bytes. */
const KEY_REQUIRING = [
  "content/dist/vectors.json",
  "evals/vectors.json",
  "evals/results.json",
  "evals.html",
];

/* ============================================================
   3. Tests
   ============================================================ */

test("the check script runs the generators and then diffs what they wrote", () => {
  assert.ok(
    diffAt !== -1,
    "`npm run check` has no `git diff --exit-code` step. Four of the design system's dist outputs " +
      "are written unconditionally and compared against nothing; this is the step that notices."
  );
  assert.equal(
    check[diffAt - 1],
    "npm run build",
    "the `git diff` step must be immediately preceded by `npm run build` — diffing without regenerating first " +
      "asks whether the tree is dirty, not whether the generators still produce it"
  );
  assert.match(
    DIFF,
    /^git diff --exit-code -- \S/,
    "the diff must carry --exit-code (or it reports drift and exits 0) and an explicit `--` pathspec list " +
      "(or a developer's in-progress edits anywhere else fail the gate)"
  );
  assert.ok(PATHSPECS.length, "the diff names no paths");

  /* Position. Both --check gates compare files they build IN MEMORY against
     what is on disk; the drift step overwrites what is on disk. Ahead of them
     it would turn eight byte-comparisons into comparisons against files
     written moments earlier — green by construction. */
  for (const gate of ["node design-system/scripts/build.mjs --check", "node scripts/build-content.mjs --check"]) {
    const i = check.indexOf(gate);
    assert.ok(i !== -1, `\`${gate}\` is no longer in the check script`);
    assert.ok(
      i < diffAt,
      `\`${gate}\` must run BEFORE the drift step: the drift step regenerates the tree, and a --check gate ` +
        `that compares against files it has just written cannot fail`
    );
  }
});

test("every file the generators write is guarded by a pathspec", () => {
  const covers = (spec, path) => path === spec || path.startsWith(`${spec}/`);
  const problems = [];
  const guarded = [];

  for (const gen of GENERATORS) {
    const { files, dirs, problems: parse } = writesOf(gen);
    problems.push(...parse);
    assert.ok(
      files.length || dirs.length,
      `parsed no write targets at all out of ${gen} — the parser stopped understanding it, which would make ` +
        `every assertion in this test vacuously true`
    );
    for (const target of [...files, ...dirs]) {
      guarded.push(target);
      if (!PATHSPECS.some((s) => covers(s, target))) {
        problems.push(
          `${gen} writes \`${target}\` and no pathspec in the drift step covers it — ` +
            `add it to the \`git diff\` list in package.json AND .github/workflows/ci.yml`
        );
      }
    }
  }

  assert.deepEqual(problems, [], `\n  - ${problems.join("\n  - ")}\n`);

  /* And nothing in the list is dead: a pathspec that matches no generated
     artefact is either a typo or a widening, and a widening is how a
     developer's own work starts failing someone else's gate. */
  for (const spec of PATHSPECS) {
    assert.ok(
      guarded.some((t) => covers(spec, t) || covers(t, spec)),
      `the drift step guards \`${spec}\`, which no generator writes — remove it, or the gate fails on edits it has no opinion about`
    );
  }
});

test("git resolves the pathspecs to exactly the generated files, and to nothing that needs a key", () => {
  /* The list as git itself expands it, in this repo. This is the assertion
     that catches a widening — `content/dist` for the two files inside it —
     which no amount of reading the string can. */
  const ls = git(root, "ls-files", "--", ...PATHSPECS);
  assert.equal(ls.status, 0, `git ls-files failed: ${ls.stderr}`);
  const matched = ls.stdout.split("\n").map((s) => s.trim()).filter(Boolean).sort();
  assert.ok(matched.length, "the pathspecs match no tracked file at all");

  /* Expected = every literal target, plus every tracked file inside a guarded
     directory (five work pages today, six the day a sixth case study lands). */
  const expected = new Set();
  for (const gen of GENERATORS) {
    const { files, dirs } = writesOf(gen);
    for (const f of files) expected.add(f);
    for (const d of dirs) {
      const inside = git(root, "ls-files", "--", d);
      assert.equal(inside.status, 0, `git ls-files ${d} failed: ${inside.stderr}`);
      const found = inside.stdout.split("\n").map((s) => s.trim()).filter(Boolean);
      assert.ok(found.length, `${gen} writes into \`${d}/\` and git tracks nothing there`);
      for (const f of found) expected.add(f);
    }
  }

  assert.deepEqual(
    matched,
    [...expected].sort(),
    "the drift step guards a set of files that is not the set the generators write.\n" +
      "  Extra files are the dangerous direction: a guarded artefact that `npm run build` does not\n" +
      `  rebuild fails the gate for everyone. Never guard: ${KEY_REQUIRING.join(", ")} — each needs an\n` +
      "  API key to regenerate and has a digest check of its own."
  );

  for (const path of KEY_REQUIRING) {
    assert.ok(
      !matched.includes(path),
      `${path} is inside the drift gate's pathspecs. It cannot be rebuilt without an API key, so \`npm run check\` ` +
        `would stop being runnable offline — which is the one property the whole gate story rests on.`
    );
  }
});

test("[mutation] a hand-edited artefact fails the diff; a key-requiring one does not", (t) => {
  /* The gate exercised end to end, against a scratch repository that stands in
     for this one: the same command string from package.json, the same pathspec
     list, real files, real commits. Nothing here touches the working tree, and
     the generators are never run — a byte-identical copy of a committed
     artefact is exactly what a successful `npm run build` leaves behind. */
  const ls = git(root, "ls-files", "--", ...PATHSPECS);
  assert.equal(ls.status, 0, `git ls-files failed: ${ls.stderr}`);
  const artefacts = ls.stdout.split("\n").map((s) => s.trim()).filter(Boolean);

  const dir = mkdtempSync(join(tmpdir(), "drift-"));
  t.after(() => {
    try {
      rmSync(dir, { recursive: true, force: true, maxRetries: 3 });
    } catch {
      /* a temp directory git left read-only objects in — not this test's problem */
    }
  });

  const body = (rel) => `${rel}\nthis file stands in for the generator's output\n`;
  for (const rel of [...artefacts, ...KEY_REQUIRING]) {
    mkdirSync(join(dir, dirname(rel)), { recursive: true });
    writeFileSync(join(dir, rel), body(rel));
  }
  assert.equal(git(dir, "-c", "init.defaultBranch=main", "init", "-q").status, 0);
  for (const [k, v] of [["user.email", "drift@test.invalid"], ["user.name", "drift test"], ["commit.gpgsign", "false"], ["core.autocrlf", "false"]]) {
    assert.equal(git(dir, "config", k, v).status, 0);
  }
  assert.equal(git(dir, "add", "-A").status, 0);
  const committed = git(dir, "commit", "-qm", "the artefacts, as generated");
  assert.equal(committed.status, 0, `scratch commit failed: ${committed.stderr}`);

  const [cmd, ...args] = DIFF.split(/\s+/);
  const run = () => spawnSync(cmd, args, { cwd: dir, encoding: "utf8" });

  const clean = run();
  assert.equal(clean.status, 0, `sanity: an untouched tree must pass, got:\n${clean.stdout}${clean.stderr}`);

  /* THE HONEST GAP, first. design-system/dist/tokens.css is the file
     ARCHITECTURE.md names: written unconditionally by build.mjs, compared by
     nothing until this gate existed. */
  const first = artefacts.includes("design-system/dist/tokens.css")
    ? ["design-system/dist/tokens.css"]
    : [];
  assert.deepEqual(first, ["design-system/dist/tokens.css"], "design-system/dist/tokens.css is no longer guarded — it is the file the honest gap is about");

  for (const rel of artefacts) {
    writeFileSync(join(dir, rel), `${body(rel)}/* hand-edited */\n`);
    const red = run();
    assert.notEqual(red.status, 0, `a hand-edit to ${rel} left the drift gate green`);
    assert.match(red.stdout, new RegExp(rel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `the drift gate went red for ${rel} without naming it in the diff`);
    writeFileSync(join(dir, rel), body(rel));
    assert.equal(run().status, 0, `restoring ${rel} did not clear the gate`);
  }

  for (const rel of KEY_REQUIRING) {
    writeFileSync(join(dir, rel), `${body(rel)}/* rebuilt with a key */\n`);
    const still = run();
    assert.equal(
      still.status,
      0,
      `${rel} changed and the drift gate went red. It cannot be regenerated without an API key, so this gate ` +
        `would be unrunnable offline:\n${still.stdout}`
    );
    writeFileSync(join(dir, rel), body(rel));
  }
});
