#!/usr/bin/env node
/* ============================================================
   Component scaffold — zero dependencies.

   `npm run new:component -- <id> [--title "Nice name"] [--dry-run] [--json]`

   WHAT THIS IS FOR. design-system/README.md states the contract — a
   component is a CSS block AND a spec.md AND a story — and
   design-system/scripts/build.mjs enforces it three ways: coverage
   (all three files exist), the `@component` markers (every CSS block
   is owned, every component owns a block), and the contract gate
   (frontmatter is valid, every class the spec claims has a rule, and
   the `## Tokens` list is exactly the set of `var(--…)` the block
   consumes). That is a good contract and none of it is being relaxed
   here. It is simply cheaper to START satisfied than to discover the
   five requirements one error message at a time.

   Everything this emits is derived from the gates themselves — the
   banner shape from build.mjs's BANNER regex, the frontmatter keys
   and their allowed values from its STATUSES/PHASES lists, the token
   list from its consumed-vs-declared cross-check. If a gate changes,
   this scaffold should be changed with it; the failure mode is a loud
   one, because the next `npm run check` says exactly what is wrong.

   WHAT IT DELIBERATELY DOES NOT DO: touch the two hand-written
   READMEs. Adding a component moves a number the site advertises
   about itself, and build.mjs asserts that number in four files. Two
   of them are generated (`npm run build` fixes those). Two are prose
   a person wrote, and a scaffold that silently rewrites the sentences
   making a claim about the system is how a gate stops being trusted.
   So it prints the exact lines instead. See the report at the end.
   ============================================================ */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const ds = join(root, "design-system");

/* ---------- argv ---------- */
const argv = process.argv.slice(2);
const VALUE_FLAGS = new Set(["--title"]);
const flag = (name) => argv.includes(name);
const opt = (name) => {
  const i = argv.indexOf(name);
  return i === -1 ? null : argv[i + 1];
};
const DRY = flag("--dry-run");
const JSON_OUT = flag("--json");
const id = argv.find((a, i) => !a.startsWith("--") && !VALUE_FLAGS.has(argv[i - 1]));

const die = (msg) => {
  console.error(`✗ ${msg}`);
  process.exit(1);
};

if (!id) {
  die(
    `usage: npm run new:component -- <id> [--title "Nice name"] [--dry-run]\n` +
      `  <id> is the directory name, the story file name and the base class: e.g. \`link-grid\` → \`.link-grid\`.`
  );
}
/* The id is a directory name, a file name AND a CSS class, so it has to be
   legal as all three. kebab-case is the house convention (`section-head`,
   `theme-toggle`, `link-grid`) and build.mjs's suffix parser reads `--` as a
   variant separator, so a doubled dash in the id itself would misparse. */
if (!/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(id)) {
  die(`"${id}" is not a valid component id — lower-case, kebab-case, no leading digit, no doubled dash (e.g. link-grid).`);
}

const title = opt("--title") ?? id.replace(/-/g, " ").replace(/^./, (c) => c.toUpperCase());

/* ---------- refuse to collide ---------- */
const compDir = join(ds, "components", id);
const storyPath = join(ds, "stories", `${id}.stories.js`);
const cssPath = join(ds, "css", "components.css");
const css = readFileSync(cssPath, "utf8");

if (existsSync(compDir)) die(`design-system/components/${id}/ already exists.`);
if (existsSync(storyPath)) die(`design-system/stories/${id}.stories.js already exists.`);
if (new RegExp(`@component ${id}\\b`).test(css)) die(`css/components.css already has a block marked \`@component ${id}\`.`);
/* A class that already has a rule somewhere else would make the spec's claim
   true by accident and put two owners on one selector. */
if (new RegExp(`\\.${id}(?![\\w-])`).test(css)) {
  die(`css/components.css already defines \`.${id}\` — pick another id, or the new block and the old one will fight over it.`);
}

/* ---------- the three artefacts ----------
   The token is the single point of coupling between them: the CSS block
   consumes exactly `--content-primary` and the `## Tokens` list declares
   exactly `--content-primary`, which is what build.mjs's cross-check demands
   in both directions. Add a declaration, add the token to the list. */
const TOKEN = "--content-primary";

/* `since` names the BUILD-LOG.md phase a component first shipped in, and
   build.mjs only accepts a phase it knows. If a later phase exists by the time
   you read this, the gate will say so by name — that is the intended failure. */
const SINCE = "phase-3";

const specText = `---
{
  "id": "${id}",
  "status": "experimental",
  "since": "${SINCE}",
  "a11y": "TODO(scaffold) — one line: what a screen reader or a keyboard gets here, or why it needs nothing."
}
---

# ${title}

TODO(scaffold) — one paragraph: what this is, and what it is NOT (the sibling
component it would otherwise be confused with).

## Pattern

This is not an example, it is THE pattern. Copy it verbatim.

\`\`\`html
<div class="${id}">TODO(scaffold)</div>
\`\`\`

## Tokens

\`${TOKEN}\`

## AI notes

- TODO(scaffold) — when to reach for this, and when not to.
`;

const storyText = `export default { title: "Components/${title}" };

export const Default = {
  render: () => \`<div class="${id}">TODO(scaffold)</div>\`,
};
`;

const cssBlock = `/* ============ ${title} ============ @component ${id}
   TODO(scaffold) — why this block exists: the decision it records, not what the
   declarations do. Anything obvious from the CSS does not belong here. */
.${id} {
  color: var(${TOKEN});
}

`;

/* Reduced motion stays last: it is a block of overrides, and the cascade is
   the only thing that makes them overrides. */
const ANCHOR = "/* ============ Reduced motion ============ @component none */";
const anchorAt = css.indexOf(ANCHOR);
const nextCss = anchorAt === -1 ? css.replace(/\s*$/, "\n\n") + cssBlock : css.slice(0, anchorAt) + cssBlock + css.slice(anchorAt);

const plan = [
  { path: `design-system/components/${id}/spec.md`, op: "create", contents: specText },
  { path: `design-system/stories/${id}.stories.js`, op: "create", contents: storyText },
  {
    path: "design-system/css/components.css",
    op: anchorAt === -1 ? "append" : "insert-before-reduced-motion",
    contents: cssBlock,
  },
];

if (JSON_OUT) {
  console.log(JSON.stringify({ id, title, token: TOKEN, files: plan }, null, 2));
  process.exit(0);
}

if (DRY) {
  console.log(`— dry run, nothing written —\n`);
  for (const f of plan) console.log(`${f.op} ${f.path}\n${"-".repeat(60)}\n${f.contents}`);
  process.exit(0);
}

/* ---------- write ---------- */
mkdirSync(compDir, { recursive: true });
writeFileSync(join(compDir, "spec.md"), specText);
writeFileSync(storyPath, storyText);
writeFileSync(cssPath, nextCss);

for (const f of plan) console.log(`✓ ${f.op.padEnd(30)} ${f.path}`);

/* ---------- what the gates will say next ----------
   The count is a claim the site makes about itself, asserted by build.mjs in
   four files. Two are generated and `npm run build` fixes them. Two are prose,
   and are printed here with their line numbers rather than rewritten. */
const count = readdirSync(join(ds, "components"), { withFileTypes: true }).filter((d) => d.isDirectory()).length;
const was = count - 1;

const advertised = [
  ["README.md", `${was} components`],
  ["design-system/README.md", `(${was})`],
];
const hits = [];
for (const [rel, needle] of advertised) {
  const path = join(root, rel);
  if (!existsSync(path)) continue;
  readFileSync(path, "utf8")
    .split("\n")
    .forEach((line, i) => {
      if (line.includes(needle)) hits.push(`${rel}:${i + 1}  ${line.trim()}`);
    });
}

const placeholders = plan.reduce((n, f) => n + (f.contents.match(/TODO\(scaffold\)/g) ?? []).length, 0);

console.log(
  `\nCoverage, the \`@component\` marker and the spec↔CSS contract are already satisfied.\n` +
    `Three things are not, and none of them is a machine's to do:\n` +
    `\n  1. The component count moved ${was} → ${count}, and build.mjs --check asserts it in four files.\n` +
    `     Two are GENERATED — \`npm run build\` rewrites cv.html and js/case-studies.js.\n` +
    `     Two are prose somebody wrote, so change ${was} to ${count} by hand:\n` +
    (hits.length ? hits.map((h) => `       ${h}`).join("\n") : `       README.md and design-system/README.md`) +
    `\n\n  2. ${placeholders} \`TODO(scaffold)\` placeholders. test/placeholders.test.js fails while any survive:\n` +
    `       design-system/components/${id}/spec.md   (a11y line, description, AI notes)\n` +
    `       design-system/css/components.css         (the ${title} block's banner)\n` +
    `       design-system/stories/${id}.stories.js\n` +
    `\n  3. The component itself. One class, one token — grow it from there.\n` +
    `\nThen:  npm run build   &&   npm run check\n`
);
