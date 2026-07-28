#!/usr/bin/env node
/* ============================================================
   Module boundary gate — zero dependencies.

   Every boundary in every repo erodes within a month of being drawn, usually
   via one innocent convenience import. This asserts the direction of the graph
   in ARCHITECTURE.md: dependencies flow design-system → content → lib/knowledge
   → {api, evals}, and every crossing is a GENERATED ARTEFACT, never a code
   import of another slice's source.

   `node scripts/check-boundaries.mjs [root]`

   `root` defaults to the repo. It exists so test/boundaries.test.js can point
   the real checker at a fixture tree containing one deliberate violation of
   each form — a gate whose failure path is never exercised is a gate that
   quietly stops finding things.

   WHAT COUNTS AS A DEPENDENCY (and what does not)

   For two years this file looked only for a quote immediately after `import`,
   `from` or `require(`. Three things walked straight past it:

     1. `await import("../api/mcp.js")`   — `import` then `(`, not a quote.
     2. `readFileSync(new URL("../../api/chat.js", import.meta.url))`
        — no import keyword anywhere. This is not a hypothetical evasion: it
        is exactly how lib/knowledge/tools.js legitimately reaches
        content/dist/content.json. The mechanism the whole architecture is
        built on was the one mechanism the checker could not see, so it could
        not see an illegitimate use of it either.
     3. js/ had no rule at all, so js/main.js could import lib/knowledge and
        pass.

   So four forms are read now: static import/export/require, dynamic
   `import()`, `new URL("…", import.meta.url)`, and a direct string path
   handed to an fs read. Two of them are module specifiers (a bare name is a
   package, and is skipped); two of them are path references (a string with no
   `/` cannot leave a directory, and is skipped).

   NOT CHECKED, DELIBERATELY. Three things look like crossings and are not:

   - `fetch()`. js/chat.js POSTs to `/api/chat` and js/answer-render.js GETs
     `content/dist/content.json`. Those are the architecture, not a violation
     of it — the browser talking to a published route and a published file.
     A rule that read string literals rather than reference sites would flag
     `"/api/chat"` on the ban pattern `(^|/)api/` and be wrong.

   - Writes. scripts/build-content.mjs writes js/case-studies.js and the
     generated regions of index.html; scripts/new-component.mjs scaffolds
     design-system/components/<id>/. A generator's OUTPUT is not its
     dependency; the arrow points the other way. Only reads are checked.

   - `join(base, "a", "b")`. Resolving one needs the value of `base`, which is
     `root` in some files, `ds` or `here` in others. Half-resolving it would
     produce both false positives and false negatives, and every such chain in
     the tree today is anchored at the repo root inside `scripts/` or a
     generator — the layer that legitimately sees the whole repo. The four
     forms above are the ones that express *this module depends on that file*
     and that resolve from the text alone.

   Comments are blanked before scanning (offsets preserved, so reported line
   numbers stay true). A path quoted in a comment is documentation, not a
   dependency — the same call scripts/check-css.mjs makes.
   ============================================================ */
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const arg = process.argv[2];
if (arg && arg.startsWith("-")) {
  console.error(`✗ usage: node scripts/check-boundaries.mjs [root]\n  \`${arg}\` is not a flag this gate takes.`);
  process.exit(1);
}
const root = arg ? resolve(arg) : join(here, "..");
if (arg && !(existsSync(root) && statSync(root).isDirectory())) {
  console.error(`✗ ${root} is not a directory.`);
  process.exit(1);
}

/* Each rule: files under `slice` may not reference anything matching `banned`.
   `why` names what the legitimate way across is. What a rule does NOT ban is
   as load-bearing as what it does — the gaps are the published artefacts, and
   CROSSINGS below pins them so that tightening a rule until a real crossing
   fails is caught here rather than by a red gate on the whole repo. */
const RULES = [
  {
    slice: "lib/knowledge",
    banned: [/(^|\/)api\//, /(^|\/)js\//, /content\/[^"']*\.md/, /content\/(projects|experience)\//],
    why: "retrieval reads content/dist/content.json — never content/ source or a consumer",
  },
  {
    slice: "content",
    banned: [/(^|\/)lib\//, /(^|\/)api\//, /(^|\/)evals\//, /(^|\/)js\//],
    why: "content is a leaf: it emits artefacts, it never reads its consumers",
  },
  {
    slice: "api",
    banned: [/(^|\/)evals\//, /content\/[^"']*\.md/],
    why: "the API consumes lib/knowledge and content/dist, nothing else",
  },
  {
    /* evals/ sits beside api/ under lib/knowledge: it measures the tool core
       and may import it, but it is not a route and must never reach into one.
       Nor may it read content/ source — the retriever's input is the generated
       index, so an eval that read the .md files would be measuring something
       the retriever never sees. */
    slice: "evals",
    banned: [/(^|\/)api\//, /(^|\/)js\//, /content\/[^"']*\.md/, /content\/(projects|experience)\//],
    why: "evals measures lib/knowledge against the generated index — never a consumer, never content source",
  },
  {
    /* The site's client JS. ARCHITECTURE.md puts it at the bottom of the
       graph: it consumes design-system/dist, css/, the generated page regions
       and api/ OVER HTTP. Every server slice is off-limits as CODE — nothing
       in lib/, api/ or evals/ runs in a browser, so an import of one is either
       a mistake or the first step of moving retrieval into the client, and
       both should stop here.

       Note what is absent. css/ and design-system/ are NOT banned: the pages
       load design-system/dist/tokens.css and design-system/css/components.css,
       and scripts/check-css.mjs asserts rules that span js/ and both. Banning
       either would break the pages and the css gate at once. content/dist/ is
       not banned either — js/answer-render.js renders answers straight out of
       content.json, which is the published corpus and the whole point of it. */
    slice: "js",
    banned: [
      /(^|\/)lib\//,
      /(^|\/)api\//,
      /(^|\/)evals\//,
      /(^|\/)scripts\//,
      /content\/[^"']*\.md/,
      /content\/(projects|experience)\//,
    ],
    why: "the site consumes design-system/dist, css/, generated regions and api/ over HTTP — never a server slice's source",
  },
  {
    slice: "scripts",
    banned: [/(^|\/)lib\//, /(^|\/)api\//, /(^|\/)evals\//],
    why: "the generators run before those slices exist and must not depend on them",
  },
  {
    /* The design system is the root of the graph and knows about nothing else.
       `..` escapes are the exception the counts gate and the stats emit need. */
    slice: "design-system/scripts",
    banned: [/(^|\/)lib\//, /(^|\/)api\//, /(^|\/)evals\//, /content\/(projects|experience|dist)\//],
    why: "the design system is the root of the graph — it knows about none of them",
  },
];

/* Nothing outside design-system/ may reach into its internals: the site and every
   other slice consume dist/ and css/, which are its published surface. */
const DS_INTERNALS = [/design-system\/(tokens|components|stories|scripts|figma)\//];
const DS_INTERNAL_ALLOWED = ["design-system", "ARCHITECTURE.md", "CLAUDE.md", "README.md", "content/CLAUDE.md"];

/* ---------- the crossings the architecture is built on ----------
   Published artefact vs another slice's internals is the whole distinction this
   gate encodes, and it is encoded by ABSENCE — a rule bans a slice's source and
   stays silent about its dist/. Absence is invisible in review, so each real
   crossing is written down here and asserted to still be legal. Tighten a rule
   until one of these fails and the gate says which line of THIS file is wrong,
   instead of turning red against a repo that is behaving correctly. */
const CROSSINGS = [
  ["lib/knowledge/tools.js", "../../content/dist/content.json", "the corpus — retrieval's only input"],
  ["lib/knowledge/embed.js", "../../content/dist/vectors.json", "the committed embeddings, read when present"],
  ["scripts/build-vectors.mjs", "content/dist/content.json", "the chunk text the vectors are built from"],
  ["scripts/build-content.mjs", "design-system/dist/components.json", "the component counts the copy interpolates"],
  ["scripts/check-css.mjs", "design-system/css/components.css", "the published stylesheet the css gate reads"],
  ["scripts/check-css.mjs", "js/automata.js", "the site script the DOM-budget rule measures"],
  ["js/answer-render.js", "content/dist/content.json", "the published corpus the client renders from"],
  ["evals/run.mjs", "content/dist/content.json", "the generated index the eval measures against"],
];

/* The generated artefacts that make those crossings possible must exist, or the
   graph is a diagram rather than an architecture. */
const ARTEFACTS = [
  "design-system/dist/tokens.css",
  "design-system/dist/tokens.flat.json",
  "design-system/dist/components.json",
  "content/system.generated.json",
  "content/dist/content.json",
];

const SKIP_DIRS = new Set(["node_modules", ".git", "dist", "generated", "storybook-static", ".claude", "vendor"]);
const CODE = /\.(mjs|js|cjs|ts)$/;

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith(".") && e.name !== ".gitattributes") continue;
    if (SKIP_DIRS.has(e.name)) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

/* Blank comments in place — same length, same newlines — so every offset below
   still maps to a real line. `[^:\\]` keeps `https://` and an escaped `\/` in a
   regex literal from being read as the start of a line comment. */
const blankComments = (s) =>
  s
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/(^|[^:\\])\/\/[^\n]*/g, (m, p1) => p1 + " ".repeat(m.length - p1.length));

const lineAt = (src, index) => src.slice(0, index).split("\n").length;
const posix = (p) => p.split(sep).join("/");

/* ---------- the four reference forms ----------
   `module` specifiers go through Node's resolver, so a bare name is a package
   and is skipped. `path` references are strings resolved against a directory,
   so a string with no `/` cannot leave one and is skipped; a URL scheme is a
   network address, not a file. */
const FORMS = [
  {
    kind: "module",
    verb: "imports",
    re: /(?<![\w$.])(?:import\s[\s\S]*?from\s*|export\s[\s\S]*?from\s*|import\s*|require\s*\(\s*)(["'])([^"']+)\1/g,
  },
  {
    kind: "module",
    verb: "dynamically imports",
    re: /(?<![\w$.])import\s*\(\s*(["'`])([^"'`]*)\1/g,
  },
  {
    kind: "path",
    verb: "resolves a path to",
    re: /(?<![\w$.])new\s+URL\s*\(\s*(["'`])([^"'`]*)\1/g,
  },
  {
    kind: "path",
    verb: "reads",
    re: /(?<![\w$.])(?:readFileSync|readFile|readdirSync|createReadStream|existsSync|statSync|openSync|opendirSync)\s*\(\s*(["'`])([^"'`]*)\1/g,
  },
];

const SCHEME = /^[a-z][a-z0-9+.-]*:/i;

/** Every cross-file reference in one source, as {spec, verb, line}. */
function references(src) {
  const out = [];
  const clean = blankComments(src);
  for (const form of FORMS) {
    for (const m of clean.matchAll(form.re)) {
      const spec = posix(m[2]);
      if (form.kind === "module" && !spec.startsWith(".") && !spec.startsWith("/")) continue;
      if (form.kind === "path" && (!spec.includes("/") || SCHEME.test(spec))) continue;
      out.push({ spec, verb: form.verb, line: lineAt(clean, m.index) });
    }
  }
  return out;
}

const problems = [];

/* ---------- 1. slice rules ---------- */
let scanned = 0;
for (const rule of RULES) {
  const dir = join(root, rule.slice);
  for (const file of walk(dir).filter((f) => CODE.test(f))) {
    scanned++;
    const rel = posix(relative(root, file));
    for (const { spec, verb, line } of references(readFileSync(file, "utf8"))) {
      if (rule.banned.some((banned) => banned.test(spec))) {
        problems.push(`${rel}:${line}  ${verb} "${spec}" — ${rule.why}`);
      }
    }
  }
}

/* ---------- 2. design-system internals, from anywhere else ---------- */
for (const file of walk(root).filter((f) => CODE.test(f))) {
  const rel = posix(relative(root, file));
  if (DS_INTERNAL_ALLOWED.some((p) => rel === p || rel.startsWith(p + "/"))) continue;
  for (const { spec, verb, line } of references(readFileSync(file, "utf8"))) {
    if (DS_INTERNALS.some((re) => re.test(spec))) {
      problems.push(
        `${rel}:${line}  ${verb} "${spec}" — the design system publishes dist/ and css/; its internals are private`
      );
    }
  }
}

/* ---------- 3. the rules still permit the real crossings ---------- */
for (const [from, spec, what] of CROSSINGS) {
  const rule = RULES.filter((r) => from === r.slice || from.startsWith(r.slice + "/"))
    .sort((a, b) => b.slice.length - a.slice.length)[0];
  const hit = [
    ...(rule?.banned ?? []).filter((b) => b.test(spec)).map(() => `the \`${rule.slice}\` rule`),
    ...DS_INTERNALS.filter((b) => b.test(spec) && !DS_INTERNAL_ALLOWED.some((p) => from.startsWith(p))).map(
      () => "the design-system internals rule"
    ),
  ];
  if (hit.length) {
    problems.push(
      `${hit[0]} now bans "${spec}", which ${from} needs — ${what}. ` +
        `That crossing is the architecture (ARCHITECTURE.md, "every boundary crossing is a generated artefact"): ` +
        `the rule is wrong, not the file. Loosen it in scripts/check-boundaries.mjs, or retire the crossing first.`
    );
  }
}

/* ---------- 4. the artefacts exist ---------- */
for (const artefact of ARTEFACTS) {
  const p = join(root, artefact);
  if (!existsSync(p) || !statSync(p).isFile()) {
    problems.push(`${artefact} is missing — it is the schema-bearing artefact for a boundary crossing`);
  }
}

if (problems.length) {
  console.error(
    `✗ boundary check failed:\n  - ${problems.join("\n  - ")}\n` +
      `  The fix is never to import across a boundary: publish an artefact and read that. See ARCHITECTURE.md.`
  );
  process.exit(1);
}
console.log(
  `✓ boundary check         (${RULES.length} slice rules over ${scanned} files, ` +
    `${FORMS.length} reference forms, ${CROSSINGS.length} crossings pinned, dependency direction intact)`
);
