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

   WHERE A REFERENCE POINTS IS NOT WHAT IT SAYS. `../../lib/x` is the repo's
   lib/ when it is written in apps/next/foo.ts and apps/next/src/lib/x when it
   is written in apps/next/src/app/page.tsx. Same eleven characters, two
   different files, and no regex over the text can tell them apart: the
   difference is the DEPTH of the file that wrote it, which the text does not
   carry. That was harmless while every slice sat at the repo root and shared no
   directory names with it. apps/next has its own scripts/, its own lib/ and its
   own port of js/, so it stopped being harmless.

   So every relative reference is resolved against its own file's directory into
   a repo-relative path before any rule sees it, and a rule that anchors at `^`
   then means the repo root and nothing else. Non-relative specifiers are left
   alone — a bare name is a package (already skipped), and a plain
   `content/dist/content.json` handed to readFileSync is already root-relative,
   because the generator holding it runs from the root. The MESSAGE still quotes
   what the author wrote, because that is the string they will search for.

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
    /* apps/next — the second site. ARCHITECTURE.md ranks it with the site root,
       one level below js/: a pure consumer, whose entire point is to prove "one
       source, many surfaces". It stops proving that the instant it reaches a
       source instead of an artefact, so the four inputs its charter names are
       the four it gets — the design system as a PACKAGE (a bare specifier, so
       the module form skips it before any rule runs), content/dist, evals/dist,
       and /api/chat over HTTP. css/ and content/dist arrive by copy at build
       time via its own scripts/sync-artifacts.mjs, which is why neither is here.

       js/ is banned as CODE, and that is the interesting one. Its components
       are PORTS of js/menu.js, js/fab.js, js/chat.js — copies carrying a
       provenance header that names the source file and the commit it was taken
       at. A copy you can re-take from upstream is a boundary you can audit; an
       import is a second consumer of a file that was never written to have one,
       and a browser-global-dependent one at that.

       These patterns anchor at `^` where the older rules above do not, and the
       anchor is load-bearing rather than tidy. References are resolved against
       their own file first (see the header), so `^scripts/` is the repo's
       generators while `./scripts/sync-artifacts.mjs` — this app's own, and a
       file that will exist — resolves to apps/next/scripts/… and matches
       nothing. Unanchored, it would ban the app from itself. */
    slice: "apps/next",
    banned: [
      /^lib\//,
      /^api\//,
      /^js\//,
      /^scripts\//,
      /^evals\/(?!dist\/)/,
      /^content\/[^"']*\.md/,
      /^content\/(projects|experience)\//,
    ],
    why: "the second site consumes content/dist, evals/dist, css/ and the design-system package — never another slice's source",
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
   other slice consume dist/ and css/, which are its published surface.

   Anchored at `^`, and only able to be since references are resolved first. It
   used to float, which meant it read any path with `design-system/tokens/` in
   it as THE design system — and a consumer that keeps its React ports in
   src/design-system/, which is what you would call that folder, would have been
   told its own components/ directory was private to a package it does not
   contain. The rule is about one directory at the repo root; now it says so. */
const DS_INTERNALS = [/^design-system\/(tokens|components|stories|scripts|figma)\//];
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

  /* evals/generation.mjs reads the component contract out of design-system/dist
     directly, and its own header spends a section on why: the `evals` rule bans
     the design system's SOURCE dirs — tokens, components, stories, scripts,
     figma — and says nothing about dist/, which is the published artefact every
     consumer is meant to read. That silence is the permission, and silence is
     exactly what this table exists to make audible. The alternative route,
     content.json's folded-in `content.designSystem`, carries components.json and
     NOT tokens.flat.json, so reading one gate's input from the corpus and the
     other from dist/ would leave two sources that drift by one build; both are
     read from dist/ so the gate is measured against what the design system
     actually published.

     Two lines because it is two files. This is a CENSUS — the reads are
     `join(root, "design-system", "dist", …)` rather than one relative literal,
     and a census that summarised them as "design-system/dist" would not notice
     the day a third one arrives.

     What is NOT here, deliberately, is evals/generation.json. Its header says so
     in as many words: it is committed evidence covered by nothing, changeable
     only by a human spending money, so a pin naming it would be a staleness
     claim only a billed run could satisfy. The INPUTS are pinned; the output is
     dated evidence. */
  [
    "evals/generation.mjs",
    "design-system/dist/components.json",
    "the published class contract gate 1 measures generated markup against",
  ],
  [
    "evals/generation.mjs",
    "design-system/dist/tokens.flat.json",
    "the published token table gate 2 measures generated markup against",
  ],

  /* apps/next, pinned before the app exists. Section 3 pattern-tests these
     against the rules and never touches the disk, so a pin can precede its
     file — and pinning first is the point: the rule above and these four lines
     are what the scaffold is built AGAINST, rather than what gets retrofitted
     around whatever it happened to import. What is pinned is the class of
     crossing, a consumer climbing out of apps/next onto a published surface.
     The depths are counted from the paths in .claude/agents/next-app.md, not
     observed; if the scaffold lands a file elsewhere, correct the spec here —
     and the surface check below is what will tell you that you must. */
  [
    "apps/next/src/lib/content.ts",
    "../../../../content/dist/content.json",
    "the corpus, read at build time by the second site",
  ],
  [
    "apps/next/scripts/sync-artifacts.mjs",
    "../../../content/dist/content.json",
    "the published corpus, copied into public/ for the client",
  ],

  /* The sync script's remaining reads, listed one per file even though the four
     stylesheets are one crossing spelled four times. This table is a CENSUS —
     "each real crossing is written down here" — and a census that summarises is
     a census you cannot audit against the source. Open sync-artifacts.mjs's
     SOURCES map beside these lines and they correspond, which is the only way to
     notice that a sixth stylesheet arrived unpinned.

     `css/fonts` is a directory, not a file, and is the one of these that asserts
     something the others do not: the surface pattern below has to admit a bare
     directory under a published surface, because what is copied is fonts.css
     TOGETHER with the woff2 files it names by relative url(). */
  ["apps/next/scripts/sync-artifacts.mjs", "../../../css/style.css", "the page stylesheets, synced not imported"],
  ["apps/next/scripts/sync-artifacts.mjs", "../../../css/cv.css", "the CV stylesheet, same copy, same reason"],
  ["apps/next/scripts/sync-artifacts.mjs", "../../../css/mcp.css", "the /mcp stylesheet"],
  ["apps/next/scripts/sync-artifacts.mjs", "../../../css/evals.css", "the /evals stylesheet"],
  [
    "apps/next/scripts/sync-artifacts.mjs",
    "../../../css/fonts",
    "fonts.css and its woff2 files, copied whole so the relative url()s still resolve",
  ],

  /* content/assets/ — the one pin that needed a new surface, and the argument
     for it is that index.html has been doing this for longer than apps/next has
     existed: `<img src="content/assets/notable/spetema.svg">`, served straight
     off the repo root, and content.json names those plates by derivation rather
     than by URL. So the directory is published in practice whatever it is
     called, and a second surface fetching the same bytes is copying what the
     first one links. What is NOT pinned, deliberately, is the same script's
     `../node_modules/@yordan/design-system/assets/avatar.svg`: that resolves
     inside apps/next's own node_modules, it is the package's `files` surface
     reached through the resolver rather than a path across the repo, and pinning
     a node_modules path would assert that a directory nobody commits is a
     boundary. test/fixtures/boundary-cases.json holds a control proving the
     gate stays quiet about it. */
  [
    "apps/next/scripts/sync-artifacts.mjs",
    "../../../content/assets/notable",
    "the Notable Projects plates the cards reference, copied into public/",
  ],
  [
    "apps/next/scripts/sync-artifacts.mjs",
    "../../../content/assets/pipeline.svg",
    "the pipeline diagram the portfolio-system case study shows",
  ],
  [
    "apps/next/src/app/evals/page.tsx",
    "../../../../../evals/dist/page.json",
    "the eval page data, one more serialization of the same numbers",
  ],
];

/* The surfaces a resolved crossing is allowed to land on. Every line above
   reaches a generated artefact or a slice's published files; check-css.mjs
   reading js/automata.js is the one that is neither dist/ nor css/, and it is
   there because the DOM-budget rule measures the site script it governs.

   This exists to catch a pin whose `../` count is wrong, which is the failure
   mode of writing a pin before its file: a miscounted spec resolves somewhere
   harmless, matches no ban, and sails through section 3 having asserted
   nothing at all. A pin that proves nothing is worse than no pin, because it
   reads like coverage.

   `content/assets` is here for the sync script and is the only entry that is
   not a dist/, a stylesheet or a script — see the pin above for why the plates
   count as published: the vanilla pages serve them by URL off the repo root.
   Note the shape of this pattern rather than its contents: a surface is a
   DIRECTORY PREFIX, so admitting content/assets admits the plates and the
   diagram and nothing in content/ that is a source. */
const CROSSING_SURFACES = /^(content\/(dist|assets)|design-system\/(dist|css)|evals\/dist|css|js)\//;

/* The generated artefacts that make those crossings possible must exist, or the
   graph is a diagram rather than an architecture.

   These are existence checks, not walk results, which is why `dist` sitting in
   SKIP_DIRS below does not hide them: SKIP_DIRS governs which SOURCES get
   scanned for references — a bundle under a dist/ mentions every path it ever
   inlined — while this loop stats one named path each. content/dist/content.json
   has been listed here since the first version of this gate, which skipped `dist`
   in the walk for just as long; the two have never been in each other's way. */
const ARTEFACTS = [
  "design-system/dist/tokens.css",
  "design-system/dist/tokens.flat.json",
  "design-system/dist/components.json",
  "content/system.generated.json",
  "content/dist/content.json",
  /* The eval page's data, committed and re-derived by `evals/run.mjs --check`.
     It is the second serialization of numbers evals.html already carries, and
     the moment apps/next/src/app/evals/page.tsx reads it, its absence stops
     being a missing convenience and becomes a page that cannot render. */
  "evals/dist/page.json",
];

/* `out` is `next build`'s static export — apps/next/out/, bundled JS whose
   string literals are every path any dependency ever mentioned. `.next` and the
   app's own node_modules are already covered, the first by the dot rule below,
   the second by name. */
const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "out",
  "generated",
  "storybook-static",
  ".claude",
  "vendor",
]);

/* `.tsx` is here for apps/next, and it applies everywhere, including the
   repo-wide design-system-internals walk in section 2. That is intended: a
   React component reaching into design-system/components/ is the same
   violation as a script doing it, and there is no reason the file extension
   should decide. `.ts$` does not match `.tsx`, hence the separate alternative. */
const CODE = /\.(mjs|js|cjs|ts|tsx)$/;

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

/** Where a reference written in `fileRel` actually points, repo-relative. */
const resolveFrom = (fileRel, spec) => (spec.startsWith(".") ? posix(join(dirname(fileRel), spec)) : spec);

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
      const target = resolveFrom(rel, spec);
      if (rule.banned.some((banned) => banned.test(target))) {
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
    if (DS_INTERNALS.some((re) => re.test(resolveFrom(rel, spec)))) {
      problems.push(
        `${rel}:${line}  ${verb} "${spec}" — the design system publishes dist/ and css/; its internals are private`
      );
    }
  }
}

/* ---------- 3. the rules still permit the real crossings ---------- */
for (const [from, spec, what] of CROSSINGS) {
  const target = resolveFrom(from, spec);
  const rule = RULES.filter((r) => from === r.slice || from.startsWith(r.slice + "/"))
    .sort((a, b) => b.slice.length - a.slice.length)[0];
  const hit = [
    ...(rule?.banned ?? []).filter((b) => b.test(target)).map(() => `the \`${rule.slice}\` rule`),
    ...DS_INTERNALS.filter((b) => b.test(target) && !DS_INTERNAL_ALLOWED.some((p) => from.startsWith(p))).map(
      () => "the design-system internals rule"
    ),
  ];
  if (!CROSSING_SURFACES.test(target)) {
    problems.push(
      `the pinned crossing ${from} → "${spec}" resolves to "${target}", which is not a surface a crossing may land on. ` +
        `A crossing reaches a published artefact; if this one does not, the \`../\` depth in the pin is wrong and the ` +
        `pin has been asserting nothing. Fix the spec in scripts/check-boundaries.mjs.`
    );
  }
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
