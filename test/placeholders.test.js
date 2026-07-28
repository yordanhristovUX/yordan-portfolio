/* ============================================================
   No scaffold placeholder ever ships.

   The scaffolds do everything a machine can be responsible for and
   then stop, because what is left is the words — and on this site the
   words are the product. content/CLAUDE.md's one rule is that copy is
   the owner's, extracted verbatim and never written by an agent; a
   component's spec is the contract an AI reads before touching the
   markup. Neither can be generated, so both are marked `TODO(scaffold)`
   and this test fails while a single marker survives.

   That makes `npm run check` RED immediately after scaffolding, ON
   PURPOSE. It is the difference between the two kinds of friction this
   repo cares about: the mechanical five-files-and-a-banner ceremony is
   accidental and the scaffold removes it; "you have not written the
   sentence yet" is essential, and a half-written project must not be
   able to reach index.html, content.json, llms.txt or /cv by being
   forgotten about.

   The marker is assembled at runtime so this file does not trip its
   own check, and scripts/ is excluded because that is where the
   templates legitimately live.
   ============================================================ */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, relative, sep } from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
const MARK = "TODO" + "(scaffold)";

/* `generated/` is the read-only reference system this one simplifies; `scripts/`
   holds the templates the marker is born in; `test/` is this file. */
const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  ".vercel",
  ".claude",
  "generated",
  "storybook-static",
  "scripts",
  "test",
  "vendor",
]);
const TEXT = /\.(md|json|jsonld|js|mjs|cjs|css|html|txt|yml|yaml)$/;

function walk(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith(".") || SKIP_DIRS.has(e.name)) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (TEXT.test(e.name)) out.push(p);
  }
  return out;
}

test("no scaffold placeholder survives anywhere that ships or is gated", () => {
  const hits = [];
  for (const file of walk(root)) {
    const src = readFileSync(file, "utf8");
    if (!src.includes(MARK)) continue;
    const rel = relative(root, file).split(sep).join("/");
    src.split("\n").forEach((line, i) => {
      if (line.includes(MARK)) hits.push(`${rel}:${i + 1}  ${line.trim()}`);
    });
  }

  assert.deepEqual(
    hits,
    [],
    `${hits.length} scaffold placeholder(s) left to fill:\n  ${hits.join("\n  ")}\n` +
      `\n  These are the parts no generator can do for you: the copy, the a11y line, the AI notes.\n` +
      `  Write them and this goes green. Deleting the marker without writing the sentence is the\n` +
      `  one move that defeats the point.`
  );
});
