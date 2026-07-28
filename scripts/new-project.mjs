#!/usr/bin/env node
/* ============================================================
   Project scaffold — zero dependencies.

   `npm run new:project -- <id> [--title "Nice name"] [--case-study]
                              [--client "Acme"] [--dry-run] [--json]`

   Writes content/projects/<id>.md with the frontmatter
   scripts/build-content.mjs actually requires, and a body whose
   section slugs are in the closed set it enforces. Nothing here
   invents a field: every key below is one build-content.mjs reads or
   asserts, and the two shapes differ because the pipeline treats them
   as different things —

     card project   (hasCaseStudy: false)  sorted by `order`, rendered
                    as a card in "More projects"; needs `cardType` and
                    a {#summary} whose FIRST block is a paragraph,
                    because the card body is `blocks[0].text`.

     case study     (hasCaseStudy: true)   sorted by `index`, rendered
                    as a row in the work index AND as a dialog; needs
                    `index`, `client`, `tags`, `indexTags`, a
                    {#summary} (the index row) and a {#subtitle} (the
                    case header) — which content/CLAUDE.md is explicit
                    are DIFFERENT sentences, not a duplicate.

   `order` / `index` are read off the existing files, so a new project
   lands after the last one instead of colliding with it.

   THE PLACEHOLDERS ARE DELIBERATE AND THEY ARE RED. Everything a
   machine can be responsible for is done. What is left is the words,
   and on this site the words are the product: content/CLAUDE.md's one
   rule is that copy is the owner's, extracted verbatim and never
   written by an agent. So the scaffold marks every spot it cannot
   fill with `TODO(scaffold)`, and test/placeholders.test.js fails
   while any of them survive — a half-written project cannot reach
   llms.txt, content.json or the page by being forgotten.
   ============================================================ */
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const projectsDir = join(root, "content", "projects");

/* ---------- argv ---------- */
const argv = process.argv.slice(2);
const VALUE_FLAGS = new Set(["--title", "--client"]);
const flag = (name) => argv.includes(name);
const opt = (name) => {
  const i = argv.indexOf(name);
  return i === -1 ? null : argv[i + 1];
};
const DRY = flag("--dry-run");
const JSON_OUT = flag("--json");
const CASE = flag("--case-study");
const id = argv.find((a, i) => !a.startsWith("--") && !VALUE_FLAGS.has(argv[i - 1]));

const die = (msg) => {
  console.error(`✗ ${msg}`);
  process.exit(1);
};

if (!id) {
  die(
    `usage: npm run new:project -- <id> [--title "Nice name"] [--case-study] [--client "Acme"]\n` +
      `  <id> is the file name and the stable key retrieval cites: content/projects/<id>.md.`
  );
}
/* The id is a file name, a chunk-id prefix (`project:<id>#summary`) and a
   `data-project` attribute, so it has to survive all three. */
if (!/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(id)) {
  die(`"${id}" is not a valid project id — lower-case, kebab-case, no leading digit (e.g. malko-tarnovo).`);
}

const outPath = join(projectsDir, `${id}.md`);
if (existsSync(outPath)) die(`content/projects/${id}.md already exists.`);

const title = opt("--title") ?? id.replace(/-/g, " ").replace(/\b[a-z]/g, (c) => c.toUpperCase());
const client = opt("--client") ?? "TODO(scaffold) client";

/* ---------- where does it go in the ordering? ----------
   Read, never guessed. `order` and `index` are two separate sequences and a
   duplicate in either silently reorders somebody else's project. */
const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---/;
const existing = [];
if (existsSync(projectsDir)) {
  for (const f of readdirSync(projectsDir).filter((f) => f.endsWith(".md"))) {
    const m = readFileSync(join(projectsDir, f), "utf8").match(FRONTMATTER);
    if (!m) continue;
    try {
      existing.push(JSON.parse(m[1]));
    } catch {
      /* A file that does not parse is build-content.mjs's error to report, not
         this script's. Skipping it can only make the next number too low, and
         a collision is loud. */
    }
  }
}
const next = (key, only) =>
  existing.filter(only).reduce((n, p) => (typeof p[key] === "number" ? Math.max(n, p[key]) : n), 0) + 1;

const seq = CASE
  ? { index: next("index", (p) => p.hasCaseStudy) }
  : { order: next("order", (p) => !p.hasCaseStudy) };

/* ---------- the file ----------
   Frontmatter is structural data only — JSON forbids a literal newline in a
   string, which is exactly why content/CLAUDE.md chose it: "no paragraphs in
   frontmatter" is the parser's rule, not a convention anyone has to remember. */
const frontmatter = CASE
  ? {
      id,
      index: seq.index,
      client,
      title,
      hasCaseStudy: true,
      /* tags are the case-study header's; indexTags are the work-index row's.
         They differ on purpose — see the divergence table in content/CLAUDE.md.
         accentTag must be a member of tags, indexAccentTag of indexTags; the
         build asserts both. */
      tags: ["TODO(scaffold) role", "TODO(scaffold) discipline"],
      accentTag: "TODO(scaffold) discipline",
      indexTags: ["TODO(scaffold) index tag"],
      indexAccentTag: "TODO(scaffold) index tag",
    }
  : {
      id,
      order: seq.order,
      title,
      cardType: "TODO(scaffold) — the kind of thing this is, e.g. Corporate website",
      hasCaseStudy: false,
    };

const body = CASE
  ? `
## Summary {#summary}

TODO(scaffold) — the WORK INDEX row description, in your own words. One sentence.
This is not the subtitle below; content/CLAUDE.md keeps both because they differ.

## TODO(scaffold) header line {#subtitle}

TODO(scaffold) — the line under the title inside the case study. One sentence.

## Why it matters here {#context}

TODO(scaffold) — replace this heading with your own words; only the {#context}
slug is fixed. Prose here is yours, extracted verbatim from what you wrote —
never drafted by an agent.

## What I did {#approach}

TODO(scaffold) — or delete this section. Allowed slugs: summary · subtitle ·
context · problem · approach · system · outcome · status. A slug may repeat.
`
  : `
## Summary {#summary}

TODO(scaffold) — one or two sentences, in your own words. This paragraph is the
card body verbatim, so it must be a paragraph and it must come first.
`;

const contents = `---\n${JSON.stringify(frontmatter, null, 2)}\n---\n${body}`;

const plan = [{ path: `content/projects/${id}.md`, op: "create", contents }];

if (JSON_OUT) {
  console.log(JSON.stringify({ id, title, caseStudy: CASE, frontmatter, files: plan }, null, 2));
  process.exit(0);
}
if (DRY) {
  console.log(`— dry run, nothing written —\n`);
  for (const f of plan) console.log(`${f.op} ${f.path}\n${"-".repeat(60)}\n${f.contents}`);
  process.exit(0);
}

writeFileSync(outPath, contents);
console.log(`✓ create   content/projects/${id}.md   (${CASE ? `case study, index ${seq.index}` : `card, order ${seq.order}`})`);

const placeholders = (contents.match(/TODO\(scaffold\)/g) ?? []).length;
console.log(
  `\n${placeholders} \`TODO(scaffold)\` placeholders — \`npm run check\` is RED until every one is gone.\n` +
    `That is the point: this file becomes the page, js/case-studies.js, content/dist/content.json\n` +
    `and llms.txt, and a placeholder that reached any of those would be a sentence the site\n` +
    `claims he wrote. The words are yours to write; nothing else is left.\n` +
    `\nThen:  npm run build   &&   npm run check\n`
);
