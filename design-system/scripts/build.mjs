#!/usr/bin/env node
/* ============================================================
   Design system build — zero dependencies.

   tokens/tokens.json  →  dist/tokens.css       (:root custom properties,
                                                 consumed by the site + Storybook)
                       →  dist/tokens.flat.json (dotted keys with resolved
                                                 values, consumed by AI agents
                                                 and the Figma push procedure)
                       →  dist/tokens.dtcg.json (W3C Design Tokens format, from
                                                 the UNRESOLVED values — aliases
                                                 stay aliases. For any consumer
                                                 with a DTCG pipeline of its own)
                       →  dist/tokens.d.ts      (the token names as a TypeScript
                                                 union, so a TS consumer is
                                                 checked against the real
                                                 contract rather than a string)
                       →  ../content/system.generated.json
                                                 (the system's own statistics,
                                                 consumed by scripts/build-content.mjs
                                                 so the prose that advertises them
                                                 has exactly one source)

   `node scripts/build.mjs`          build tokens + system stats
   `node scripts/build.mjs --check`  build + six gates:
                                     · assembly — every GENERATED region of
                                       css/components.css byte-compares against
                                       a fresh render of its source, which is
                                       components/<id>/definition.json for a
                                       component and tokens/typography.json for
                                       the type layer. Started as the R1 pilot
                                       and grows with R4; scripts/emit-css.mjs
                                       is the emitter and documents the format.
                                     · package — dist/tokens.dtcg.json and
                                       dist/tokens.d.ts byte-compare against a
                                       fresh generation. These two are a
                                       PUBLISHED package surface, so unlike the
                                       four older dist files they are compared
                                       rather than silently rewritten.
                                     · coverage — every component has spec.md
                                       and a story
                                     · counts — the generated prose still
                                       quotes the current numbers
                                     · contract — each spec.md agrees with the
                                       CSS beside it
                                     · doc arithmetic — every figure in
                                       tokens.json's own prose recomputes from
                                       the values beside it. See its block at
                                       the bottom; it is the one that closes
                                       "the docs matched the code, and nobody
                                       checked they matched the arithmetic".

   The published contract those two files describe is versioned separately by
   scripts/contract-diff.mjs, against the committed snapshot in RELEASED.json.

   Run order for the repo as a whole: this script first (it emits the stats),
   then `node scripts/build-content.mjs` from the repo root (it consumes them).
   ============================================================ */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
/* PIPELINE 1 — the component-CSS emitter. Its header documents the definition
   format and why the WRITE side of it lives there rather than here. */
import { PILOT, definitionPath, loadAll, renderAll, checkRegions } from "./emit-css.mjs";
/* PIPELINE 2 — the same definitions, rendered for a Tailwind + React consumer.
   Both artefact sets are written through `packaged` below, so both are
   byte-compared by --check rather than regenerated in place. */
import { renderThemeCss, themeKeyOf } from "./emit-tailwind.mjs";
import { elementsInSpec, renderComponent, renderIndex } from "./emit-react.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const CHECK = process.argv.includes("--check");

const tokens = JSON.parse(readFileSync(join(root, "tokens", "tokens.json"), "utf8"));

/* ---------- normalize: every entry -> { value, dark?, print?, description? } ---------- */
const categories = [];
for (const [cat, entries] of Object.entries(tokens)) {
  if (cat.startsWith("$")) continue;
  const doc = entries.$doc ?? "";
  const vars = [];
  for (const [name, raw] of Object.entries(entries)) {
    if (name.startsWith("$")) continue;
    const { value, dark, print, wide, description } =
      typeof raw === "string"
        ? { value: raw, dark: undefined, print: undefined, wide: undefined, description: undefined }
        : raw;
    vars.push({ name, value, dark, print, wide, description });
  }
  categories.push({ cat, doc, vars });
}

/* ---------- dist/tokens.css ----------
   Three blocks. :root carries the light theme and every theme-independent
   token. The dark overrides are emitted twice from the same source: once
   behind the OS preference (skipped when the visitor has pinned light) and
   once behind an explicit data-theme, so the control can override the OS in
   either direction. Anything without a `dark` value simply cascades. */
const pick = (key) =>
  categories.flatMap(({ cat, vars }) =>
    vars.filter((v) => v[key] !== undefined).map((v) => ({ ...v, cat }))
  );
const darkVars = pick("dark");
const printVars = pick("print");
const wideVars = pick("wide");

/* ---------- the one breakpoint the token layer knows about ----------
   760px is the site's own grid break — 24 columns to 12 — and it is the number
   components.css already changes the grid at. It was a constant HERE, with a
   comment saying it had to be stated once so a `wide` value and the grid it
   belongs to could not drift apart; R4 gave that sentence somewhere to be true.
   `$conditions` in tokens.json now holds every media condition the system asks
   about, a definition's `at` block names one of them, and this reads the same
   entry — so the token layer and the stylesheet break at one number by
   construction rather than by vigilance. `$conditions` is behind a `$` and is
   emitted into no artefact, because CSS cannot use a custom property in a media
   query and shipping one that looks usable would be a footgun. */
const conditions = tokens.$conditions ?? {};
const conditionOf = (name) => {
  const entry = conditions[name];
  if (!entry) {
    console.error(
      `✗ token check failed — tokens.json's \`$conditions\` has no \`${name}\`. Every media condition this system\n` +
        `  asks about is named there, once, so the token layer and css/components.css cannot break at two numbers.`
    );
    process.exit(1);
  }
  return typeof entry === "string" ? entry : entry.value;
};
const WIDE_AT = conditionOf("from-760");
const WIDE_MIN = WIDE_AT.replace(/^\(min-width:\s*|\)$/g, "");

/* A token carrying both `dark` and `wide` would make source order load-bearing
   between two blocks that answer different questions, and nothing would say so.
   No token needs both — colour does not change at a breakpoint and a type step
   does not change with the theme — so the combination is refused rather than
   ordered. Print is exempt and deliberately emitted last: paper overrides both. */
const bothDarkAndWide = categories
  .flatMap(({ vars }) => vars)
  .filter((v) => v.dark !== undefined && v.wide !== undefined)
  .map((v) => v.name);
if (bothDarkAndWide.length) {
  console.error(
    `✗ token check failed — these carry BOTH \`dark\` and \`wide\`: ${bothDarkAndWide.join(", ")}.\n` +
      `  Those two blocks answer different questions (theme vs viewport) and combining them makes\n` +
      `  the cascade depend on which this script happens to emit first. Split the token, or decide\n` +
      `  the precedence explicitly in build.mjs and delete this check.`
  );
  process.exit(1);
}

let css = `/* GENERATED by scripts/build.mjs from tokens/tokens.json — do not edit.
   Edit tokens/tokens.json and run \`npm run build\`. */\n:root {\n`;
for (const { doc, vars } of categories) {
  if (doc) css += `\n  /* --- ${doc} --- */\n`;
  for (const v of vars) {
    css += `  --${v.name}: ${v.value};${v.description ? ` /* ${v.description} */` : ""}\n`;
  }
}
css += `}\n`;

/* The viewport tier. Emitted before the theme tiers because it answers a
   different question and must not be entangled with them: this is the size a
   step takes once the grid breaks, not a preference. Print stays last of all,
   so a `print` value still beats a `wide` one when both match — which they do,
   whenever a wide page is printed. */
if (wideVars.length) {
  css +=
    `\n/* ============ Wide viewport (>= ${WIDE_MIN}) ============\n` +
    `   ${wideVars.length} tokens step at the site's own grid break, 24 columns to 12.\n` +
    `   A step whose size is set by the LEVEL it occupies wants two chosen values\n` +
    `   with a step between them, not a clamp sliding through every size in\n` +
    `   between. Anything without a \`wide\` value simply cascades. */\n` +
    `@media ${WIDE_AT} {\n  :root {\n` +
    wideVars.map((v) => `    --${v.name}: ${v.wide};\n`).join("") +
    `  }\n}\n`;
}

if (darkVars.length) {
  const decls = (indent) =>
    darkVars.map((v) => `${indent}--${v.name}: ${v.dark};\n`).join("");

  css +=
    `\n/* ============ Dark theme ============\n` +
    `   ${darkVars.length} semantic tokens re-alias; the raw ramps never move.\n` +
    `   Followed automatically unless the visitor has pinned light. */\n` +
    `@media (prefers-color-scheme: dark) {\n  :root:not([data-theme="light"]) {\n` +
    decls("    ") +
    `  }\n}\n` +
    `\n/* Pinned by the visitor — wins over the OS preference either way. */\n` +
    `:root[data-theme="dark"] {\n` +
    decls("  ") +
    `}\n`;
}

/* Paper is a third theme, and it must beat the other two — hence last.
   Screen themes are a preference; print is a physical constraint (no
   backlight, ink costs money, greyscale is likely), so a visitor reading
   in dark still gets ink-on-paper when they hit print. */
if (printVars.length) {
  css +=
    `\n/* ============ Print ============\n` +
    `   ${printVars.length} tokens re-alias for paper. Emitted after the dark\n` +
    `   blocks so it wins regardless of the theme on screen. */\n` +
    `@media print {\n  :root, :root[data-theme="dark"], :root[data-theme="light"] {\n` +
    printVars.map((v) => `    --${v.name}: ${v.print};\n`).join("") +
    `  }\n}\n`;
}

/* ---------- dist/tokens.flat.json (aliases resolved) ----------
   Resolved twice, through a light and a dark alias map. A token with no
   `dark` of its own can still land on a different colour in dark mode by
   pointing at one that does (content-primary → primary), so darkResolved is
   computed for every token and emitted whenever it actually differs. That is
   what makes this file enough on its own for the Figma push and for agents. */
const byName = new Map();
const byNameDark = new Map();
const byNamePrint = new Map();
for (const { vars } of categories) {
  for (const v of vars) {
    byName.set(v.name, v.value);
    byNameDark.set(v.name, v.dark ?? v.value);
    byNamePrint.set(v.name, v.print ?? v.value);
  }
}

function resolveWith(map, value, seen = new Set()) {
  return value.replace(/var\(--([a-z0-9-]+)\)/gi, (m, name) => {
    if (seen.has(name) || !map.has(name)) return m;
    seen.add(name);
    return resolveWith(map, map.get(name), seen);
  });
}
const resolve = (value) => resolveWith(byName, value);
const resolveDark = (value) => resolveWith(byNameDark, value);
const resolvePrint = (value) => resolveWith(byNamePrint, value);

const flat = {};
for (const { cat, vars } of categories) {
  for (const v of vars) {
    const resolved = resolve(v.value);
    const darkResolved = resolveDark(v.dark ?? v.value);
    const printResolved = resolvePrint(v.print ?? v.value);
    flat[`${cat}.${v.name}`] = {
      cssVar: `--${v.name}`,
      value: v.value,
      ...(resolved !== v.value ? { resolved } : {}),
      ...(v.dark !== undefined ? { dark: v.dark } : {}),
      ...(darkResolved !== resolved ? { darkResolved } : {}),
      ...(v.print !== undefined ? { print: v.print } : {}),
      ...(printResolved !== resolved ? { printResolved } : {}),
      ...(v.wide !== undefined ? { wide: v.wide } : {}),
      ...(v.description ? { description: v.description } : {}),
    };
  }
}

mkdirSync(join(root, "dist"), { recursive: true });
writeFileSync(join(root, "dist", "tokens.css"), css);
writeFileSync(join(root, "dist", "tokens.flat.json"), JSON.stringify(flat, null, 2) + "\n");
console.log(
  `✓ dist/tokens.css        (${categories.reduce((n, c) => n + c.vars.length, 0)} variables, ` +
    `${darkVars.length} dark, ${printVars.length} print, ${wideVars.length} wide)`
);
console.log(`✓ dist/tokens.flat.json  (${Object.keys(flat).length} entries)`);

/* ============================================================
   THE PACKAGE SURFACE — dist/tokens.dtcg.json + dist/tokens.d.ts

   tokens.flat.json exists for THIS repo's agents and the Figma push, and it
   resolves aliases because both of those want the answer rather than the
   graph. A second consumer with a token pipeline of its own wants the
   opposite: the graph, in the format its tooling already reads. So the DTCG
   file is emitted from the UNRESOLVED values — `var(--stone-100)` becomes
   `{color-stone.stone-100}` and stays a reference. Retheme by editing one raw
   ramp and every alias downstream still points at it, which is the property
   resolution destroys.

   These two are the first files here that `--check` BYTE-COMPARES. The four
   older outputs are regenerated in place and merely asserted to exist —
   ARCHITECTURE.md calls that "the honest gap" — and that is tolerable while
   the only consumer is this repo, which rebuilds them on every run. It stops
   being tolerable the moment another repo installs this directory: a
   hand-edit that survives in the workspace is then a hand-edit that ships.
   ============================================================ */

/* One stable extension key for the whole mode tier. DTCG has no concept of a
   theme, and inventing one as a sibling group would fork every token name;
   $extensions is the spec's own escape hatch and the key is namespaced so it
   cannot collide with another producer's. */
const MODES_KEY = "com.yordan.modes";

const groupOf = new Map();
for (const { cat, vars } of categories) for (const v of vars) groupOf.set(v.name, cat);

/** `var(--x)` → `{group.x}`. A name this file does not own is left alone. */
const toRefs = (value) =>
  String(value).replace(/var\(\s*--([a-z0-9-]+)\s*\)/gi, (m, name) =>
    groupOf.has(name) ? `{${groupOf.get(name)}.${name}}` : m
  );

/* $type is classified from the FORM of the resolved value, never from the
   group name — a group is an editorial heading and would silently mistype a
   token that moved between two of them. The four forms DTCG defines that this
   system actually produces are color, dimension, fontFamily and border.
   Everything else is `other`, which is NOT a DTCG type and is documented as
   such in the banner: three tokens here are a CSS keyword or a raw rgb
   channel triplet, which are values a design-token type system has no name
   for because they exist to be recomposed at runtime by js/automata.js. */
const AS_COLOUR = /^(#[0-9a-f]{3,8}$|rgba?\(|hsla?\(|color\(|transparent$)/i;
const AS_DIMENSION = /^(-?[\d.]+(rem|em|px|pt|vh|vw|ch|%)$|0$|clamp\(|calc\()/;
const AS_FONT_FAMILY = /^["'][^"']+["']\s*,/;
const AS_BORDER = /^-?[\d.]+(px|rem|em)\s+(solid|dashed|dotted|double|none)\b/;

function dtcgType(value) {
  const r = resolve(value).trim();
  if (AS_COLOUR.test(r)) return "color";
  if (AS_BORDER.test(r)) return "border";
  if (AS_FONT_FAMILY.test(r)) return "fontFamily";
  if (AS_DIMENSION.test(r)) return "dimension";
  return "other";
}

const dtcgBanner =
  "GENERATED by scripts/build.mjs from tokens/tokens.json — do not edit. " +
  "W3C Design Tokens (DTCG) export of the blueprint portfolio's token layer, published as " +
  "@yordan/design-system/tokens.dtcg.json. " +
  "ALIASES ARE NOT RESOLVED: a value of the form var(--x) is emitted as the DTCG reference " +
  "{group.x}, so the alias graph survives the export — that is the whole difference between " +
  "this file and tokens.flat.json, which resolves. " +
  `MODES: a token that changes with the theme, the printer or the viewport carries its other ` +
  `values under $extensions["${MODES_KEY}"] as { dark?, print?, wide? }, with references written ` +
  "the same way. DTCG has no theme concept and a sibling group per mode would fork every token " +
  "name, so the spec's own escape hatch is used and the key is namespaced. " +
  "$VALUE IS THE AUTHORED CSS STRING, including clamp() and em ratios. The dimension type's " +
  "{value,unit} object form cannot express either, and this scale is built on both. " +
  '$TYPE "other" is not a DTCG type. It marks every token whose value is a CSS keyword, a raw rgb ' +
  "channel triplet, a bare font-weight number or a variable-font axis setting — color-scheme, " +
  "accent-rgb, automata-cell-rgb, the six weight steps and the six width steps. DTCG has a " +
  "fontWeight type but only for the named keywords, and no type at all for an axis tag plus a " +
  "number; all of these exist to be consumed as-is rather than as a typed design value. Treat " +
  "them as opaque strings.";

const dtcg = {
  $description: dtcgBanner,
  $extensions: {
    "com.yordan.build": {
      generatedBy: "design-system/scripts/build.mjs",
      source: "design-system/tokens/tokens.json",
      modesKey: MODES_KEY,
    },
  },
};
for (const { cat, doc, vars } of categories) {
  const group = doc ? { $description: doc } : {};
  for (const v of vars) {
    const modes = {
      ...(v.dark !== undefined ? { dark: toRefs(v.dark) } : {}),
      ...(v.print !== undefined ? { print: toRefs(v.print) } : {}),
      ...(v.wide !== undefined ? { wide: toRefs(v.wide) } : {}),
    };
    group[v.name] = {
      $value: toRefs(v.value),
      $type: dtcgType(v.value),
      ...(v.description ? { $description: v.description } : {}),
      ...(Object.keys(modes).length ? { $extensions: { [MODES_KEY]: modes } } : {}),
    };
  }
  dtcg[cat] = group;
}
const dtcgOut = JSON.stringify(dtcg, null, 2) + "\n";

/* ---------- dist/tokens.d.ts ----------
   A union of the custom-property names, so a TS consumer writing
   `var("--surface-page")` is checked against the contract rather than against
   the set of all strings. Types only — there is no runtime module behind this
   file, and there deliberately is not: the values live in CSS, and a JS mirror
   of them would be a second source for the thing this system exists to have
   one of. */
const dtsNames = categories.flatMap(({ vars }) => vars.map((v) => `--${v.name}`)).sort();
const dtsGroups = categories.map((c) => c.cat);
const union = (list) => list.map((n) => `  | "${n}"`).join("\n");

const dtsOut =
  `/* GENERATED by scripts/build.mjs from tokens/tokens.json — do not edit.\n` +
  `   Edit tokens/tokens.json and run \`npm run build\`.\n\n` +
  `   Published as @yordan/design-system/tokens.d.ts. Types only: the values live in\n` +
  `   dist/tokens.css and dist/tokens.dtcg.json, and a JS mirror of them would be a second\n` +
  `   source for the one thing this system exists to have one of. \`--check\` byte-compares\n` +
  `   this file, so a hand-edit fails the build rather than being silently overwritten. */\n\n` +
  `/** Every custom property \`dist/tokens.css\` defines on \`:root\` (${dtsNames.length}). */\n` +
  `export type DesignTokenName =\n${union(dtsNames)};\n\n` +
  `/** The editorial groups of \`tokens/tokens.json\`, as \`tokens.dtcg.json\` nests them. */\n` +
  `export type DesignTokenGroup =\n${union(dtsGroups)};\n\n` +
  `/** A \`var()\` reference to a token that exists — usable wherever a CSS string is taken. */\n` +
  `export type DesignTokenVar = \`var(\${DesignTokenName})\`;\n`;

/* ============================================================
   PIPELINE 2 — dist/tokens.tailwind.css + dist/react/

   Phase R2a. The same three definitions pipeline 1 renders into
   css/components.css are rendered again here, for a Next.js consumer: a
   Tailwind v4 @theme file that binds Tailwind's namespaces to the custom
   properties dist/tokens.css already defines, and one typed React component
   per definition. Neither is a translation of the other — both are renderings
   of the same data, which is the property two hand-written front ends cannot
   have.

   THE DEFINITIONS ARE LOADED HERE, EARLY, because both pipelines need them and
   a missing one is a coverage failure rather than a rendering failure. For a
   pilot id the trinity of CSS block + spec.md + story is a QUARTET, and this
   is the leg that enforces it — unconditionally, not only under --check,
   because neither emitter can render without it.

   THEMING IS NOT FORKED, and that is structural rather than promised: every
   entry in the @theme block is a `var()` reference to the runtime token, so a
   Tailwind utility lands on whatever dist/tokens.css says that token is — light,
   dark, pinned, printed or stepped at the grid break. See the header of
   scripts/emit-tailwind.mjs for the one exception and why it is safe.
   ============================================================ */
const { defs: definitions, errors: definitionErrors } = loadAll();
if (definitionErrors.length) {
  console.error(
    `✗ coverage check failed — a pilot component's appearance source is missing or unreadable:\n  - ${definitionErrors.join("\n  - ")}\n` +
      `  ${PILOT.length} components (${PILOT.join(", ")}) are rendered from\n` +
      `  ${PILOT.map(definitionPath).join(", ")} — into css/components.css by scripts/emit-css.mjs,\n` +
      `  and into dist/react/ by scripts/emit-react.mjs. For those three the trinity is a quartet:\n` +
      `  CSS block + spec.md + story + definition.json.`
  );
  process.exit(1);
}
if (CHECK) {
  const modifiers = definitions.flatMap((d) => [...(d.variants ?? []), ...(d.sizes ?? [])]);
  console.log(
    `✓ definition check       (${definitions.length} definitions valid against components/definition.schema.json; ` +
      `${definitions.filter((d) => d.axes).length} declaring an orthogonal matrix, ` +
      `${modifiers.filter((m) => m.aliases).length} of ${modifiers.length} modifiers aliasing another rule)`
  );
}

/** A token name → the Tailwind @theme variable it becomes, or null if it stays plain. */
const themeKey = (name) => themeKeyOf(name, groupOf.get(name));

/* Both emitters refuse rather than guess — an unclassified token group, a
   restated token that grew a mode, a state with no Tailwind prefix, a spec
   whose canonical HTML names no element. Each of those is a real decision
   somebody has to make, so they surface as a named failure here rather than as
   a stack trace: the message IS the instruction. */
const fatal = (what, e) => {
  console.error(`✗ ${what}:\n  ${String(e.message).split("\n").join("\n  ")}`);
  process.exit(1);
};

let tailwindOut;
try {
  tailwindOut = renderThemeCss(categories);
} catch (e) {
  fatal("tailwind theme check — tokens.json and the @theme map disagree", e);
}

const reactSources = new Map();
let arbitraryClasses = 0;
for (const def of definitions) {
  try {
    const specText = readFileSync(join(root, "components", def.id, "spec.md"), "utf8");
    const { source, tally } = renderComponent(def, elementsInSpec(specText), themeKey);
    arbitraryClasses += tally.arbitrary;
    reactSources.set(def.id, source);
  } catch (e) {
    fatal(`react check — components/${def.id}/definition.json cannot be rendered to a component`, e);
  }
}
const reactSource = (id) => {
  const source = reactSources.get(id);
  if (!source) throw new Error(`packaged names dist/react/${id}.tsx and no definition rendered it — PILOT and the packaged list disagree`);
  return source;
};

/* --check compares; a plain build writes. Comparing BEFORE writing is the
   point: writing first would erase the evidence and turn every hand-edit into
   a pass.

   THE PATHS ARE LITERALS ON PURPOSE, one line each. test/drift.test.js reads
   this array out of this file's source to recompute the root drift gate's
   pathspec list, so a fourth generated component has to be typed here — where
   it is visible in a diff — rather than appearing from a loop. */
const packaged = [
  ["dist/tokens.dtcg.json", dtcgOut],
  ["dist/tokens.d.ts", dtsOut],
  ["dist/tokens.tailwind.css", tailwindOut],
  ["dist/react/index.ts", renderIndex(definitions)],
  ["dist/react/button.tsx", reactSource("button")],
  ["dist/react/chip.tsx", reactSource("chip")],
  ["dist/react/stat.tsx", reactSource("stat")],
  ["dist/react/footer.tsx", reactSource("footer")],
  ["dist/react/source.tsx", reactSource("source")],
  ["dist/react/link-grid.tsx", reactSource("link-grid")],
  ["dist/react/case-body.tsx", reactSource("case-body")],
  ["dist/react/fact.tsx", reactSource("fact")],
  ["dist/react/entry.tsx", reactSource("entry")],
  ["dist/react/section-head.tsx", reactSource("section-head")],
];
mkdirSync(join(root, "dist", "react"), { recursive: true });
/* Every rendered component must have a line above; the reverse is checked by
   reactSource. Together they make PILOT and the published surface agree. */
for (const id of reactSources.keys()) {
  if (!packaged.some(([rel]) => rel === `dist/react/${id}.tsx`)) {
    console.error(
      `✗ dist/react/${id}.tsx is rendered and is not in the \`packaged\` list in scripts/build.mjs, so it would be\n` +
        `  written by nothing and compared by nothing. Add the line — the paths there are literals deliberately.`
    );
    process.exit(1);
  }
}
if (CHECK) {
  const drift = [];
  for (const [rel, want] of packaged) {
    const path = join(root, rel);
    if (!existsSync(path)) {
      drift.push(`${rel} is missing — it is part of the published package surface. Run \`npm run build\`.`);
      continue;
    }
    const got = readFileSync(path, "utf8");
    if (got === want) continue;
    /* Name the first differing line. "they differ" sends you to a diff tool;
       a line number sends you to the edit. */
    const g = got.split("\n"), w = want.split("\n");
    let i = 0;
    while (i < Math.min(g.length, w.length) && g[i] === w[i]) i++;
    drift.push(
      `${rel} differs from a fresh generation at line ${i + 1}:\n` +
        `      on disk: ${JSON.stringify(g[i] ?? "<end of file>")}\n` +
        `      built:   ${JSON.stringify(w[i] ?? "<end of file>")}`
    );
  }
  if (drift.length) {
    console.error(
      `✗ package check failed — a published artefact was hand-edited or is stale:\n  - ${drift.join("\n  - ")}\n` +
        `  These ${packaged.length} files are the package surface another repo installs, so they are byte-compared\n` +
        `  rather than regenerated in place. Edit tokens/tokens.json or the component's definition.json\n` +
        `  and run \`npm run build\`.`
    );
    process.exit(1);
  }
  console.log(
    `✓ package check          (${packaged.length} published artefacts byte-identical to a fresh build: ` +
      `tokens.dtcg.json, tokens.d.ts, tokens.tailwind.css, react/ ×${reactSources.size + 1})`
  );
} else {
  for (const [rel, out] of packaged) writeFileSync(join(root, rel), out);
  const types = {};
  for (const { vars } of categories) for (const v of vars) {
    const t = dtcgType(v.value);
    types[t] = (types[t] ?? 0) + 1;
  }
  console.log(
    `✓ dist/tokens.dtcg.json  (${Object.keys(flat).length} tokens in ${categories.length} groups; ` +
      `${Object.entries(types).sort((a, b) => b[1] - a[1]).map(([t, n]) => `${n} ${t}`).join(", ")})`
  );
  console.log(`✓ dist/tokens.d.ts       (${dtsNames.length} names, ${dtsGroups.length} groups)`);
  const themed = (tailwindOut.match(/^ {2}--/gm) ?? []).length;
  const referenced = (tailwindOut.match(/^ {2}--[\w-]+: var\(--/gm) ?? []).length;
  console.log(
    `✓ dist/tokens.tailwind.css (${themed} of ${Object.keys(flat).length} tokens in @theme, ` +
      `${referenced} as var() references, ${themed - referenced} restated)`
  );
  console.log(
    `✓ dist/react/            (${reactSources.size} components + index, ` +
      `${arbitraryClasses} arbitrary-property classes)`
  );
}

/* ---------- ../content/system.generated.json ----------
   The system's statistics, emitted rather than asserted. The site and the CV
   advertise these numbers in prose; build-content.mjs interpolates them from
   here, so a token or a component landing updates every sentence that quotes
   it. The counts gate below then only has to catch a hand-edit of a generated
   file — it can no longer be the thing that keeps the numbers honest, because
   nothing types them by hand any more. */
const compDir = join(root, "components");
const storyDir = join(root, "stories");
const components = existsSync(compDir)
  ? readdirSync(compDir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name)
  : [];
const tokenCount = categories.reduce((n, c) => n + c.vars.length, 0);
/* Every AUTHORED value, which is what the prose means when it advertises a
   value count: one per token, plus each theme override, plus each viewport
   step. It is not the number of declarations in dist/tokens.css — the dark
   block is emitted twice, once for the media query and once for the pinned
   override — and design-system/README.md says so. */
const valueCount = tokenCount + darkVars.length + printVars.length + wideVars.length;

mkdirSync(join(root, "..", "content"), { recursive: true });
writeFileSync(
  join(root, "..", "content", "system.generated.json"),
  JSON.stringify(
    {
      $generatedBy: "design-system/scripts/build.mjs — do not edit",
      tokens: tokenCount,
      values: valueCount,
      light: tokenCount,
      dark: darkVars.length,
      print: printVars.length,
      wide: wideVars.length,
      components: components.length,
      componentNames: components,
    },
    null,
    2
  ) + "\n"
);
console.log(`✓ ../content/system.generated.json (${tokenCount} tokens, ${valueCount} values, ${components.length} components)`);

/* ============================================================
   The component tier — derived contract + spec cross-check.

   The token tier above is generated, so a claim about a token cannot be
   true and unenforced at the same time. Everything below exists because
   the component tier had no such property: `spec.md` was hand-typed prose
   that nothing verified, and four classes named in canonical HTML that
   agents are told to copy verbatim had no CSS rule anywhere.

   Two tiers, deliberately:

     DERIVED — selectors, elements, variants and the consumed token set,
     read straight out of css/components.css. Emitted as
     dist/components.json, the machine-readable counterpart to
     dist/tokens.flat.json.

     DECLARED — the residue a parser cannot reach: which component a CSS
     block belongs to (`@component` on the banner), and each spec's JSON
     frontmatter (id / status / since / a11y). Hand-written, and therefore
     drift-tested below rather than trusted.

   What is NOT generated: the prose. The a11y rationale, the AI notes and
   the `contain: size` feedback-loop explanation in skeleton/spec.md are
   irreducible judgement and stay in spec.md where a human wrote them.
   ============================================================ */

const STATUSES = ["stable", "experimental", "deprecated"];
/* `since` names the BUILD-LOG.md phase a component first shipped in.
   "initial" is the design system that predates the content pipeline
   ("What existed before"). Anything else must be a phase recorded there. */
const PHASES = ["initial", "phase-0", "phase-1", "phase-2", "phase-3"];

const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "");
const uniq = (a) => [...new Set(a)].sort();

/* ---------- components.css → banner-delimited blocks ----------
   The file is banner-organised, and each banner's first line carries
   `@component <id>` — the one fact about this file no parser can derive
   ("Row — definition (skills)" is the `row` component; "Facts" is `fact`).
   `@component none` marks a block that belongs to no single component
   (the foundation reset, the reduced-motion block). */
const componentsCssPath = join(root, "css", "components.css");
const componentsCss = readFileSync(componentsCssPath, "utf8");

/* ============================================================
   THE ASSEMBLY — started as the R1 pilot, now the R4 migration.

   A block in PILOT is no longer authored. Its appearance is data in
   components/<id>/definition.json — variants, sizes, states, parts, and the
   token each property binds to — and scripts/emit-css.mjs renders that data
   into the generated regions of css/components.css. The blocks that are not in
   PILOT are authored source and are untouched by any of this.

   The definitions themselves were loaded and coverage-checked further up,
   where pipeline 2 first needs them. What is left here is the DRIFT half: the
   regions are re-rendered IN MEMORY and byte-compared against what is on disk,
   which is the same discipline the published artefacts get, and for the same
   reason — comparing after writing turns every hand-edit into a pass. Under
   --check a difference is fatal and names the region, its definition source
   and the first differing line. On a plain build it is a warning, because
   `npm run build` in this directory runs emit-css.mjs first and a plain
   build's job is dist/.

   WHAT DOES NOT CHANGE THIS PHASE: dist/components.json is still DERIVED by
   parsing css/components.css and each spec's frontmatter, exactly as before.
   The generated blocks parse identically to the authored ones they replaced —
   that is the pilot's whole claim — so the contract, the class census and the
   counts are untouched. R3 decides whether components.json starts reading the
   definitions instead.
   ============================================================ */
const { rendered: generatedRegions, errors: renderErrors } = renderAll(definitions);
if (renderErrors.length) {
  console.error(`✗ a definition failed to render to CSS:\n  - ${renderErrors.join("\n  - ")}`);
  process.exit(1);
}
{
  const { drift, errors } = checkRegions(componentsCss, generatedRegions);
  const all = [...errors, ...drift];
  if (CHECK) {
    if (all.length) {
      console.error(
        `✗ assembly check failed — css/components.css disagrees with the definitions it is generated from:\n  - ${all.join("\n  - ")}\n` +
          `  Those regions are generated. Edit the definition.json the marker names and run\n` +
          `  \`node scripts/emit-css.mjs\` (or \`npm run build\` in design-system/); never edit inside a region.`
      );
      process.exit(1);
    }
    console.log(
      `✓ assembly check         (${generatedRegions.size} generated regions in css/components.css byte-identical to a fresh render)`
    );
  } else if (all.length) {
    console.warn(
      `! css/components.css is behind its definitions (${all.length}) — run \`node scripts/emit-css.mjs\`:\n  - ${all.join("\n  - ")}`
    );
  }
}

const BANNER = /^\/\* =+ (.+?) =+ @component (\S+)/gm;
const blocks = [];
{
  const marks = [];
  for (const m of componentsCss.matchAll(BANNER)) {
    marks.push({ title: m[1].trim(), owner: m[2], start: m.index });
  }
  marks.forEach((mk, i) => {
    const end = i + 1 < marks.length ? marks[i + 1].start : componentsCss.length;
    blocks.push({ ...mk, body: componentsCss.slice(mk.start, end) });
  });
}

/* Selector preludes, brace-walked rather than regexed: a regex cannot tell
   `@media (…) {` from a rule, and would happily report `50%` inside
   @keyframes as a selector. */
function selectorsIn(text) {
  const src = stripComments(text);
  const out = [];
  const stack = [];
  let buf = "";
  for (const ch of src) {
    if (ch === "{") {
      const prelude = buf.trim();
      buf = "";
      if (prelude.startsWith("@")) {
        stack.push(prelude.startsWith("@keyframes") ? "keyframes" : "at");
      } else {
        if (stack[stack.length - 1] !== "keyframes") {
          prelude.split(",").forEach((s) => s.trim() && out.push(s.trim().replace(/\s+/g, " ")));
        }
        stack.push("rule");
      }
    } else if (ch === "}") {
      stack.pop();
      buf = "";
    } else {
      buf += ch;
    }
  }
  return out;
}

const CLASS_IN_SELECTOR = /\.(-?[_a-zA-Z][\w-]*)/g;
const VAR_USE = /var\(\s*(--[a-z0-9-]+)/gi;

for (const b of blocks) {
  b.selectors = selectorsIn(b.body);
  b.classes = uniq(b.selectors.flatMap((s) => [...s.matchAll(CLASS_IN_SELECTOR)].map((m) => "." + m[1])));
  b.tokens = uniq([...stripComments(b.body).matchAll(VAR_USE)].map((m) => m[1]));
}

/** Every class with at least one rule anywhere in components.css. */
const definedClasses = new Set(blocks.flatMap((b) => b.classes));

/** What the foundation blocks apply to everything (`body`, `.mono`, the focus ring). */
const foundationTokens = new Set(blocks.filter((b) => b.owner === "none").flatMap((b) => b.tokens));

/* ---------- spec.md → frontmatter + claimed classes + declared tokens ----------
   "Claimed" is exactly what design-system/README.md tells an agent to copy:
   the class attributes of the canonical HTML, plus any `.class` written in
   backticks in the prose. The negative lookbehind is what keeps `main.js`,
   `tokens.json` and `0.78rem` out of the class list. */
const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/;
const HTML_FENCE = /```html\r?\n([\s\S]*?)```/g;
const CLASS_ATTR = /class="([^"]*)"/g;
const BACKTICKED = /`([^`\n]+)`/g;
const CLASS_IN_PROSE = /(?<![\w.])\.([a-z][a-z0-9_-]*)/g;

function readSpec(id) {
  const path = join(compDir, id, "spec.md");
  const text = readFileSync(path, "utf8");

  let front = null;
  let frontError = null;
  const fm = text.match(FRONTMATTER);
  if (fm) {
    try {
      front = JSON.parse(fm[1]);
    } catch (e) {
      frontError = e.message;
    }
  }

  const claimed = new Set();
  for (const fence of text.matchAll(HTML_FENCE)) {
    for (const attr of fence[1].matchAll(CLASS_ATTR)) {
      attr[1].split(/\s+/).forEach((c) => c && claimed.add("." + c));
    }
  }
  for (const span of text.matchAll(BACKTICKED)) {
    for (const m of span[1].matchAll(CLASS_IN_PROSE)) claimed.add("." + m[1]);
  }

  /* Only a backticked span that is EXACTLY a token counts as a declaration.
     A bare regex for `--x` also matches the modifier half of `.sec--tint`,
     which would report `--tint` as an undeclared token forever. */
  const tokenSection = (text.split(/^## +Tokens *$/m)[1] ?? "").split(/^## /m)[0];
  const declaredTokens = uniq(
    [...tokenSection.matchAll(BACKTICKED)].map((m) => m[1]).filter((s) => /^--[a-z0-9-]+$/.test(s))
  );

  return { path, text, front, frontError, claimed: [...claimed].sort(), declaredTokens };
}

const specs = Object.fromEntries(components.map((id) => [id, readSpec(id)]));

/* ---------- dist/components.json ----------
   The derived contract dist/tokens.flat.json has had all along and the
   component tier has not: what an agent may branch on instead of parsing
   19 markdown files of inconsistent shape.

   R3 DECISION — THIS STAYS PARSED FROM THE SHIPPED CSS, and the reason is not
   inertia. A growing share of the twenty-three components now have a
   definition, which is a richer source, and deriving their entries from it was
   the obvious move. It is the wrong one, twice over.

   FIRST, IT WOULD DESTROY THE PROOF. This file is currently byte-identical to
   what it was when all twenty-three blocks were hand-authored — which is the
   entire evidence that the definition pipeline is faithful. It is an
   INDEPENDENT reading of the stylesheet the site actually loads. Derive it
   from the definitions instead and the two sides of the comparison become the
   same side: the artefact would agree with the definitions by construction,
   including on the day the emitter is wrong.

   SECOND, IT ANSWERS A DIFFERENT QUESTION. Its consumers — `get_component`
   and `get_design_system` through content.json, the content fold, and
   evals/generation.mjs — ask "what classes and tokens does this component
   SHIP?". Parsing the shipped file answers that. Reading the definitions
   answers "what did we intend?", and those two diverge precisely when
   something is broken. The parse is the half that notices.

   And a mixed derivation — definitions for three, CSS for twenty — would make
   the file's meaning depend on which component you looked up, which is worse
   than either.

   THE R4 CONSEQUENCE, so this is a decision rather than a deferral. When every
   generatable block is a definition, the parse stops being the source and
   becomes a CROSS-CHECK: emit components.json from the CSS exactly as now, and
   additionally assert it agrees with a projection built from the definitions.
   Two independent readings of one fact, which is worth more than either alone
   and is the shape `contract-diff.mjs` already uses. The definitions are also
   not published today (`components/` is private and in no `exports` subpath);
   if a consumer ever needs the richer data, that is a new `dist/` artefact and
   a new subpath, not a change to this one. See PATTERNS.md. */
const owned = (id) => blocks.filter((b) => b.owner === id);
const suffixes = (classes, sep) =>
  uniq(
    classes
      .map((c) => {
        const i = c.indexOf(sep, 1);
        return i === -1 ? null : c.slice(i);
      })
      .filter(Boolean)
  );

const componentContract = components.map((id) => {
  const mine = owned(id);
  const classes = uniq(mine.flatMap((b) => b.classes));
  const s = specs[id];
  return {
    id,
    status: s.front?.status ?? null,
    since: s.front?.since ?? null,
    a11y: s.front?.a11y ?? null,
    spec: `components/${id}/spec.md`,
    story: `stories/${id}.stories.js`,
    blocks: mine.map((b) => b.title),
    classes,
    elements: suffixes(classes, "__"),
    variants: suffixes(classes, "--"),
    selectors: uniq(mine.flatMap((b) => b.selectors)),
    tokens: uniq(mine.flatMap((b) => b.tokens)),
  };
});

writeFileSync(
  join(root, "dist", "components.json"),
  JSON.stringify(
    {
      $generatedBy: "design-system/scripts/build.mjs — do not edit",
      $doc:
        "Derived component contract. selectors/classes/elements/variants/tokens are parsed out of css/components.css and are true by construction. status/since/a11y are DECLARED in each spec.md's JSON frontmatter and drift-tested by `build.mjs --check`. The prose — a11y rationale, AI notes, the reasoning behind a rule — is deliberately not here; it lives in spec.md because it is judgement, not fact.",
      $derivedFrom: ["css/components.css", "components/*/spec.md (frontmatter only)"],
      count: componentContract.length,
      components: componentContract,
    },
    null,
    2
  ) + "\n"
);
console.log(
  `✓ dist/components.json   (${componentContract.length} components, ` +
    `${uniq(componentContract.flatMap((c) => c.classes)).length} classes, ` +
    `${blocks.length} css blocks)`
);

/* ---------- coverage gate: every component = spec.md + story ----------
   Still all 23, still the trinity. The fourth leg — definition.json for the
   three pilot ids — is asserted at the assembly block above, unconditionally,
   because the emitter needs it on a plain build too. */
if (CHECK) {
  const problems = [];
  for (const c of components) {
    if (!existsSync(join(compDir, c, "spec.md"))) problems.push(`components/${c}/ has no spec.md`);
    if (!existsSync(join(storyDir, `${c}.stories.js`))) problems.push(`components/${c}/ has no stories/${c}.stories.js`);
  }
  if (problems.length) {
    console.error(`✗ coverage check failed:\n  - ${problems.join("\n  - ")}`);
    process.exit(1);
  }
  console.log(
    `✓ coverage check         (${components.length} components, each with spec.md + story; ` +
      `${definitions.length} of them also with definition.json, and typography from its levels table)`
  );

  /* ---------- counts gate: the generated prose must still quote the truth ----------
     These figures are a claim the site makes about itself. They are no longer
     typed by hand — build-content.mjs interpolates them from
     content/system.generated.json — so this is no longer the mechanism that
     keeps them true. It is the guard against someone hand-editing a generated
     file, which is the one way drift can still get in. Positive assertions, not
     a scan: each file must contain the current number, which is unambiguous and
     cannot false-positive on unrelated figures in the prose.

     A missing file is a FAILURE, not a pass. The old `existsSync → continue`
     meant relocating content silently disabled the check. */
  const counts = [`${tokenCount} tokens`, `${valueCount} values`, `${components.length} components`];
  /* The dark count is the OTHER hand-typed statistic, and it is the one that
     went stale silently when `surface-inverse` was deleted: nothing asserted
     it, so "the entire dark theme is 24 re-aliased tokens" survived becoming
     23 in four places. It is only asserted against the two READMEs, which are
     hand-authored and in this system's own hands. The same sentence in
     content/profile.json is the content pipeline's to interpolate — it needs a
     `{{dark}}` substitution first, which is why it is not asserted here yet. */
  const advertised = [
    ["../README.md", [...counts, `${darkVars.length} re-aliased`]],
    /* This system's own README states the three counts parenthetically, in the
       bullet list that documents this very gate. */
    ["README.md", [`(${tokenCount})`, `(${valueCount})`, `(${components.length})`, `${darkVars.length} re-aliased`]],
    ["../cv.html", counts],
    /* Was `../js/case-studies.js`. That file rendered the case studies inside a
       modal and is gone — the five are pages now — so the prose advertising
       these counts moved with the "Portfolio as a Product" study to its own
       page. The gate follows the prose, not the filename. */
    ["../work/portfolio-system.html", counts],
  ];
  const stale = [];
  // Prose wraps: "106\n  values" is the same claim as "106 values", so match on
  // whitespace-collapsed text rather than forcing docs to avoid line breaks.
  const flatten = (s) => s.replace(/\s+/g, " ");
  for (const [rel, needles] of advertised) {
    const path = join(root, rel);
    if (!existsSync(path)) {
      stale.push(`${rel} is missing — it advertises the counts and must exist`);
      continue;
    }
    const text = flatten(readFileSync(path, "utf8"));
    for (const needle of needles) {
      if (!text.includes(needle)) stale.push(`${rel} does not say "${needle}"`);
    }
  }
  if (stale.length) {
    console.error(
      `✗ counts check failed — the docs advertise numbers that are no longer true:\n  - ${stale.join("\n  - ")}\n` +
        `  Current: ${tokenCount} tokens, ${valueCount} values (${tokenCount} light + ${darkVars.length} dark + ${printVars.length} print + ${wideVars.length} wide), ${components.length} components.\n` +
        `  cv.html and work/*.html are GENERATED — do not edit them. Run:\n` +
        `    node design-system/scripts/build.mjs && node scripts/build-content.mjs`
    );
    process.exit(1);
  }
  console.log(`✓ counts check           (${tokenCount} tokens, ${valueCount} values, ${components.length} components — as advertised)`);

  /* ---------- contract gate: spec.md must be TRUE, not merely present ----------
     The coverage gate above checks that a spec and a story EXIST. It never
     checked that they were true, and they were not: four classes named in
     canonical HTML had no rule anywhere, and several `## Tokens` lists had
     drifted from the CSS beside them. design-system/README.md tells agents
     the canonical HTML "is not an example — it is THE pattern. Copy it," so
     a class named there that means nothing is a defect, not a nit.

     Three assertions, in the order a failure is easiest to act on:
       1. the `@component` markers are complete and resolve  (DECLARED tier)
       2. every spec carries valid JSON frontmatter           (DECLARED tier)
       3. spec ↔ CSS agree on classes and tokens             (the cross-check)

     Direction matters on tokens. Consumed-but-undeclared is a FAILURE: the
     spec is lying about what the component costs. Declared-but-unconsumed is
     a WARNING only, because a component can legitimately name a token it gets
     through a utility class in its markup (`source` wears `--font-mono` via
     `.mono`) rather than through its own block. */
  const broken = [];
  const warnings = [];

  /* 1. @component markers */
  const bannerCount = (componentsCss.match(/^\/\* =+ .+? =+/gm) ?? []).length;
  if (bannerCount !== blocks.length) {
    broken.push(
      `css/components.css: ${bannerCount - blocks.length} banner(s) carry no \`@component <id>\` marker. ` +
        `Every banner needs one; use \`@component none\` for a block that belongs to no single component.`
    );
  }
  const knownOwners = new Set([...components, "none"]);
  for (const b of blocks) {
    if (!knownOwners.has(b.owner)) {
      broken.push(`css/components.css: block "${b.title}" is marked \`@component ${b.owner}\`, which is not a directory under components/`);
    }
  }
  for (const id of components) {
    if (!owned(id).length) broken.push(`components/${id}/ is claimed by no CSS block — no banner in components.css says \`@component ${id}\``);
  }

  /* 2. spec frontmatter */
  for (const id of components) {
    const s = specs[id];
    const where = `components/${id}/spec.md`;
    if (s.frontError) { broken.push(`${where}: frontmatter is not valid JSON — ${s.frontError}`); continue; }
    if (!s.front) { broken.push(`${where}: no JSON frontmatter. Needs a \`---\` block with { id, status, since, a11y }, matching the content/*.md convention.`); continue; }
    if (s.front.id !== id) broken.push(`${where}: frontmatter id is "${s.front.id}", directory is "${id}"`);
    if (!STATUSES.includes(s.front.status)) broken.push(`${where}: status "${s.front.status}" is not one of ${STATUSES.join(" | ")}`);
    if (!PHASES.includes(s.front.since)) broken.push(`${where}: since "${s.front.since}" is not one of ${PHASES.join(" | ")}`);
    if (typeof s.front.a11y !== "string" || !s.front.a11y.trim()) broken.push(`${where}: a11y must be a non-empty one-line string`);
  }

  /* 3. the cross-check */
  for (const id of components) {
    const s = specs[id];
    const where = `components/${id}/spec.md`;

    for (const cls of s.claimed) {
      if (!definedClasses.has(cls)) {
        broken.push(`${where} claims \`${cls}\` but no rule in css/components.css defines it — define the rule or drop the class from the spec`);
      }
    }

    const consumed = uniq(owned(id).flatMap((b) => b.tokens));
    const declared = new Set(s.declaredTokens);
    for (const t of consumed) {
      if (!declared.has(t)) broken.push(`${where}: its CSS consumes \`${t}\` and the \`## Tokens\` list omits it`);
    }
    /* A component may legitimately name a token it inherits from the
       foundation rather than sets itself — `source` wears `--font-mono`
       through the `.mono` utility, `typography` documents `--font-body`
       which `body` applies. Those are not drift. A token in neither its own
       block nor the foundation is. */
    for (const t of s.declaredTokens) {
      if (!consumed.includes(t) && !foundationTokens.has(t)) {
        warnings.push(`${where}: \`## Tokens\` lists \`${t}\`, which neither its own CSS block nor the foundation consumes`);
      }
    }
  }

  if (broken.length) {
    console.error(`✗ contract check failed — spec.md and components.css disagree:\n  - ${broken.join("\n  - ")}`);
    process.exit(1);
  }
  if (warnings.length) {
    console.warn(`! contract warnings (not fatal):\n  - ${warnings.join("\n  - ")}`);
  }
  const claimedTotal = components.reduce((n, id) => n + specs[id].claimed.length, 0);
  console.log(`✓ contract check         (${claimedTotal} spec-claimed classes all defined, ${blocks.length} css blocks owned, token lists match)`);
}

/* ============================================================
   4. DOC ARITHMETIC — does tokens.json's prose recompute?

   THE GAP THIS CLOSES. Four separate audits verified that this repo's
   documentation matched its code, and it did. Nothing verified that the
   documentation matched the ARITHMETIC, and that is where the remaining
   problems were: a type scale with a gate enforcing "every size is a token"
   and no gate enforcing "the tokens form a scale". The mechanism, which is
   worth stating because it is not carelessness:

     Consolidation produces a value by averaging what was already there, and
     an average has no author — so the rationale gets written afterwards,
     describing the result. The prose is most confident exactly where the
     value was least chosen.

   A $doc is the most load-bearing prose in the system: it is what a
   contributor reads instead of recomputing, and `get_design_system` serves it
   to a model that will repeat it. So every figure in it that CAN be
   recomputed from the values beside it, is.

   PRECISION IS THE CLAIM'S OWN. A figure written "6.94:1" asserts two
   decimals and is checked to two; "1.9:1" asserts one and is checked to one.
   That is not pedantry, it is the only non-arbitrary rule available — any
   fixed tolerance is a number nobody chose, and a gate that tolerates 0.02
   silently licenses being wrong by 0.02.

   WHAT THIS DELIBERATELY DOES NOT DO, stated because a gate's silence reads
   as permission:

   · It does not require a clamp's `vw` term to be live at the viewports the
     $doc argues from. `text` argues a display line "has to survive both a
     375px phone and a 1600px sheet", and clamp() achieves that BY pinning at
     the extremes — every one of the seven fluid steps is pinned at both. A
     gate demanding otherwise would demand the clamp not work. What it does
     assert is the defensible half: a `vw` term must be active SOMEWHERE, or
     the clamp is a constant wearing a clamp's clothes.
   · It does not flag a value for being the arithmetic mean of the two it
     replaced. Several are, and the `description` fields say so. Consolidating
     two near-identical ramps into their midpoint is legitimate; a gate that
     failed on it would block the cleanup this system was built by.
   · It does not police prose with no arithmetic in it. "Blueprint blue, used
     scarcely" is judgement, and judgement is what a $doc is for.
   ============================================================ */
if (CHECK) {
  const varByName = new Map();
  for (const { vars } of categories) for (const v of vars) varByName.set(v.name, v);

  const colourOf = (name, field = "value") => {
    const v = varByName.get(name);
    if (!v) return null;
    if (field === "dark") return resolveDark(v.dark ?? v.value);
    if (field === "print") return resolvePrint(v.print ?? v.value);
    return resolve(v.value);
  };

  /* WCAG 2.x relative luminance. The 0.03928 threshold is the one in the
     published formula; using 0.04045 instead shifts ratios in the third
     decimal, which is exactly the size of error this check exists to find, so
     it is spelled out rather than imported from memory. */
  const hslToRgb = (h, s, l) => {
    s /= 100; l /= 100;
    const k = (n) => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = (n) => l - a * Math.max(-1, Math.min(Math.min(k(n) - 3, 9 - k(n)), 1));
    return [f(0), f(8), f(4)].map((x) => Math.round(x * 255));
  };
  const toRgb = (c) => {
    if (!c) return null;
    const s = String(c).trim();
    let m = s.match(/^#([0-9a-f]{6})$/i);
    if (m) return [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16));
    m = s.match(/^#([0-9a-f]{3})$/i);
    if (m) return [...m[1]].map((h) => parseInt(h + h, 16));
    m = s.match(/^hsl\(\s*([\d.]+)\s+([\d.]+)%\s+([\d.]+)%\s*\)$/i);
    if (m) return hslToRgb(+m[1], +m[2], +m[3]);
    m = s.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i);
    if (m) return [+m[1], +m[2], +m[3]];
    m = s.match(/^(\d+)\s*,\s*(\d+)\s*,\s*(\d+)$/);
    if (m) return [+m[1], +m[2], +m[3]];
    return null;
  };
  const chan = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  const lumi = (rgb) => 0.2126 * chan(rgb[0]) + 0.7152 * chan(rgb[1]) + 0.0722 * chan(rgb[2]);
  const contrast = (a, b) => {
    const [x, y] = [lumi(toRgb(a)), lumi(toRgb(b))].sort((p, q) => q - p);
    return (x + 0.05) / (y + 0.05);
  };
  const alphaOf = (c) => { const m = String(c).match(/^rgba?\([^)]*,\s*([\d.]+)\s*\)$/); return m ? Number(m[1]) : null; };
  const px = (rem) => parseFloat(rem) * 16;   // nothing in the repo sets html { font-size }

  /* ---------- the prose corpus, and its census ---------- */
  const prose = [];
  for (const [group, body] of Object.entries(tokens)) {
    if (group === "$meta") { for (const [k, v] of Object.entries(body)) prose.push([`$meta.${k}`, String(v)]); continue; }
    for (const [k, v] of Object.entries(body)) {
      if (k === "$doc") prose.push([`${group}.$doc`, String(v)]);
      else if (v && typeof v === "object" && v.description) prose.push([`${k}.description`, String(v.description)]);
    }
  }
  const proseOf = (where) => prose.find(([w]) => w === where)?.[1] ?? null;

  const bad = [];

  /* ---------- contrast figures ---------- */
  const CONTRAST = [
    { where: "content.$doc", claimed: "4.4", fg: ["stone-500"], bg: ["surface-page"], of: "stone-500 on the page background" },
    { where: "content.$doc", claimed: "6.99", fg: ["stone-600"], bg: ["surface-page"], of: "stone-600 on the page background" },
    { where: "content.$doc", claimed: "6.93", fg: ["stone-400"], bg: ["stone-900"], of: "stone-400 on stone-900" },
    { where: "chrome-label-on-strong.description", claimed: "6.96", fg: ["slate-400"], bg: ["slate-900"], of: "the footer label on slate-900" },
    { where: "chrome-label-on-strong.description", claimed: "7.87", fg: ["slate-400"], bg: ["slate-950"], of: "the footer label on slate-950" },
    { where: "accent.$doc", claimed: "2.42", fg: ["accent"], bg: ["surface-page", "dark"], of: "the light accent on the dark page" },
    { where: "accent.$doc", claimed: "5.21", fg: ["accent", "dark"], bg: ["surface-page", "dark"], of: "the dark accent on the dark page" },
    { where: "accent.$doc", claimed: "5.32", fg: ["accent", "dark"], bg: ["chrome-bg", "dark"], of: "the dark accent on dark chrome" },
  ];
  /* Figures that are constants rather than measurements. Registered so the
     census below balances, and asserted so a typo in the AA minimum cannot
     hide behind "it's just prose". */
  const CONSTANTS = [{ where: "content.$doc", figure: "4.5", is: "the WCAG AA minimum for body text" }];

  for (const c of CONTRAST) {
    const text = proseOf(c.where);
    if (text === null) { bad.push(`${c.where} no longer exists — this check cannot find the prose it verifies. Re-point it or remove the claim.`); continue; }
    if (!text.includes(`${c.claimed}:1`)) {
      bad.push(`${c.where} no longer contains the figure \`${c.claimed}:1\` (${c.of}). Either it was reworded — re-point this claim — or the number moved without the arithmetic being redone.`);
      continue;
    }
    const fg = colourOf(...c.fg), bg = colourOf(...c.bg);
    if (!toRgb(fg) || !toRgb(bg)) { bad.push(`${c.where}: cannot resolve the colours behind \`${c.claimed}:1\` (${c.of}) — got fg=${fg} bg=${bg}.`); continue; }
    const dp = (c.claimed.split(".")[1] ?? "").length;
    const got = contrast(fg, bg).toFixed(dp);
    if (got !== c.claimed) {
      bad.push(
        `${c.where} claims \`${c.claimed}:1\` for ${c.of} — it recomputes to \`${got}:1\` (${fg} on ${bg}, exact ${contrast(fg, bg).toFixed(4)}). ` +
          `Fix the prose, or if the VALUE is what is wrong say so: this gate does not know which of the two you meant.`
      );
    }
  }
  for (const k of CONSTANTS) {
    const text = proseOf(k.where);
    if (!text || !text.includes(`${k.figure}:1`)) bad.push(`${k.where} no longer states \`${k.figure}:1\`, ${k.is}.`);
  }

  /* The census is the anti-rot mechanism, and it is the reason this gate
     should still be honest in a year. Every contrast-shaped figure anywhere in
     the prose must be one this file knows about — so ADDING a claim without
     registering it turns the build red, rather than being silently unchecked
     forever. Rule 6 of check-css.mjs rotted precisely because it could stop
     finding its subject and still report success. */
  const found = [];
  for (const [where, text] of prose) for (const m of text.matchAll(/\d+(?:\.\d+)?:1/g)) found.push([where, m[0].replace(":1", "")]);
  const registered = [...CONTRAST.map((c) => `${c.where}|${c.claimed}`), ...CONSTANTS.map((k) => `${k.where}|${k.figure}`)];
  for (const [where, fig] of found) {
    if (!registered.includes(`${where}|${fig}`)) {
      bad.push(
        `${where} states \`${fig}:1\`, which no claim in build.mjs's doc-arithmetic check recomputes. ` +
          `A contrast figure in a $doc is a measurement; register it in CONTRAST (or in CONSTANTS if it is a standard, not a measurement) so it cannot drift unchecked.`
      );
    }
  }
  if (found.length < registered.length) {
    bad.push(`the prose carries ${found.length} contrast figures but ${registered.length} are registered — a claim was deleted or reworded. Prune the register in the same commit.`);
  }

  /* ---------- structural claims: an exact quote, and the arithmetic under it ----------
     The quote is half the check. If a $doc is rewritten, the quote stops
     matching and this goes red rather than quietly verifying nothing. */
  const textGroup = tokens.text ?? {};
  const textKeys = Object.keys(textGroup).filter((k) => k !== "$doc");
  const valOf = (k) => (typeof textGroup[k] === "string" ? textGroup[k] : textGroup[k].value);
  const printOf = (k) => (typeof textGroup[k] === "string" ? undefined : textGroup[k].print);
  /* `(?<![a-z])` so `rem` is not read as `em` — the distinction IS the claim. */
  const isRatio = (k) => /(?<![a-z])[\d.]+em$/.test(valOf(k));
  const isClamp = (k) => /^clamp\(/.test(valOf(k));
  const isStatic = (k) => /^[\d.]+rem$/.test(valOf(k));
  const wideOf = (k) => (typeof textGroup[k] === "string" ? undefined : textGroup[k].wide);
  /* The five chrome steps are NAMED rather than detected by form. Since the
     ramp landed, ten of the thirteen steps are plain rem at their base value,
     so "is it a bare rem" no longer identifies the fixed-ratio tier — it would
     silently pull `lead` through `display` into the 1.085 check they were never
     on. A list that has to be edited by hand when the tier changes is the point:
     the previous version of this check was wrong in exactly this way and passed. */
  const CHROME_STEPS = ["text-2xs", "text-xs", "text-sm", "text-md", "text-base"];
  const spaceGroup = tokens.space ?? {};

  const STRUCTURAL = [
    {
      where: "space.$doc",
      quote: "a fixed 4px-based ramp (4/8/12/16/20/24/32)",
      check: () => {
        const claimed = proseOf("space.$doc").match(/ramp \(([\d/]+)\)/)[1].split("/").map(Number);
        const actual = claimed.map((_, i) => px(spaceGroup[`space-${i + 1}`]));
        return claimed.join("/") === actual.join("/")
          ? null
          : `the ramp is stated as ${claimed.join("/")} and space-1..${claimed.length} resolve to ${actual.join("/")} at a 16px root`;
      },
    },
    {
      where: "space.$doc",
      quote: "`space-nav` is the only spacing token with a `print` value, and it is 0",
      check: () => {
        const withPrint = Object.entries(spaceGroup).filter(([k, v]) => k !== "$doc" && v && typeof v === "object" && v.print !== undefined);
        if (withPrint.length !== 1 || withPrint[0][0] !== "space-nav") return `spacing tokens carrying a print value: ${withPrint.map(([k]) => k).join(", ") || "none"}`;
        if (String(withPrint[0][1].print) !== "0") return `space-nav's print value is ${JSON.stringify(withPrint[0][1].print)}, not 0`;
        return null;
      },
    },
    {
      where: "text.$doc",
      quote: "one ramp of thirteen steps",
      check: () => {
        const steps = textKeys.filter((k) => !isRatio(k)).length;
        return steps === 13 ? null : `the scale has ${steps} steps (${textKeys.length} entries, ${textKeys.length - steps} of them em ratios)`;
      },
    },
    {
      where: "text.$doc",
      quote: "Three are set by their box and stay `clamp(min, vw, max)`",
      check: () => {
        const c = textKeys.filter(isClamp);
        return c.length === 3 ? null : `${c.length} steps are clamps, not three (${c.join(", ")})`;
      },
    },
    {
      where: "text.$doc",
      quote: "the five above it (lead, sub, heading, title, display) carry a second chosen value at the grid break",
      check: () => {
        const stepped = textKeys.filter((k) => wideOf(k) !== undefined);
        const want = ["text-lead", "text-sub", "text-heading", "text-title", "text-display"];
        if (stepped.length !== 5) return `${stepped.length} steps carry a \`wide\` value, not five (${stepped.join(", ") || "none"})`;
        const missing = want.filter((w) => !stepped.includes(w));
        if (missing.length) return `the stepped steps are ${stepped.join(", ")}, and the doc names ${want.join(", ")} — missing ${missing.join(", ")}`;
        /* A step that steps DOWN at the grid break would be a mistake nobody
           would look for, so the direction is asserted rather than assumed. */
        const backwards = want.filter((k) => parseFloat(wideOf(k)) <= parseFloat(valOf(k)));
        return backwards.length ? `these do not grow at the break: ${backwards.join(", ")}` : null;
      },
    },
    {
      where: "text.$doc",
      quote: "the five chrome steps up to body sit on a fixed ~1.085 ratio",
      check: () => {
        const s = CHROME_STEPS.filter((k) => textKeys.includes(k));
        if (s.length !== 5) return `expected the five named chrome steps and found ${s.length} (${s.join(", ")})`;
        const notPlain = s.filter((k) => !isStatic(k));
        if (notPlain.length) return `these are not a plain rem value: ${notPlain.join(", ")}`;
        const v = s.map((k) => parseFloat(valOf(k)));
        const claimed = proseOf("text.$doc").match(/~([\d.]+) ratio/)[1];
        const want = Number(claimed);
        const geo = Math.pow(v.at(-1) / v[0], 1 / (v.length - 1));

        /* TWO CHECKS, AND THE SECOND IS THE ONE THAT MATTERS.
           The geometric mean depends only on the endpoints, so on its own it
           says nothing about the steps between them: moving text-sm from
           0.85rem to 0.88rem leaves (1/0.72)^(1/4) bit-identical and a
           mean-only check waves it through. That is the exact shape of the
           failure this whole gate exists for — the old system had a check
           that every size is a token and none that the tokens form a SCALE.
           So every adjacent ratio is tested too.

           THE TILDE IS PART OF THE HEADLINE CLAIM. "~1.085" asserts less than
           a bare "6.94:1" does, so the mean is held to one unit in its last
           stated place rather than to exact agreement.

           THE PER-STEP TEST NEEDS NO TOLERANCE, which is why it is done this
           way rather than with a fudge factor nobody chose. The rem values
           are written to a fixed number of decimals, so each one stands for
           an interval of width one last-place unit. Propagating that gives
           the band of ratios the pair could REALLY be, and the claimed ratio
           either lies in it or the two disagree. On the current ramp the four
           bands are about [1.069,1.098], [1.076,1.103], [1.070,1.095] and
           [1.076,1.098]; 1.085 is comfortably inside all four, and a step
           moved by 0.03rem lands outside. */
        const ulp = Math.pow(10, -(claimed.split(".")[1] ?? "").length);
        if (Math.abs(geo - want) > ulp) {
          return `the stated ratio is ~${claimed}; the geometric ratio across ${s.join(" → ")} is ${geo.toFixed(4)}, ${(Math.abs(geo - want) / ulp).toFixed(1)} units of the last stated digit away`;
        }
        const dp = Math.max(...s.map((k) => (String(parseFloat(valOf(k))).split(".")[1] ?? "").length));
        const h = Math.pow(10, -dp) / 2;
        const off = [];
        for (let i = 1; i < v.length; i++) {
          const lo = (v[i] - h) / (v[i - 1] + h);
          const hi = (v[i] + h) / (v[i - 1] - h);
          if (want < lo || want > hi) {
            off.push(`${s[i - 1]}→${s[i]} is ${(v[i] / v[i - 1]).toFixed(4)} (possible range ${lo.toFixed(4)}..${hi.toFixed(4)} at ${dp}dp)`);
          }
        }
        return off.length
          ? `the ramp claims a ~${claimed} ratio but is not one at every step: ${off.join("; ")}. The mean can be right while the steps are wrong — that is what this half of the check is for.`
          : null;
      },
    },
    {
      where: "text.$doc",
      quote: "Every step also carries a `print` value in pt",
      check: () => {
        const missing = textKeys.filter((k) => !isRatio(k) && !/pt$/.test(String(printOf(k))));
        return missing.length ? `these steps have no pt print value: ${missing.join(", ")}` : null;
      },
    },
    {
      where: "text.$doc",
      quote: "The two `em` entries at the end are ratios",
      check: () => {
        const r = textKeys.filter(isRatio);
        if (r.length !== 2) return `${r.length} entries are em ratios, not two`;
        return JSON.stringify(textKeys.slice(-2)) === JSON.stringify(r) ? null : `the em entries are ${r.join(", ")}, which are not the last two (${textKeys.slice(-2).join(", ")})`;
      },
    },
    {
      /* The defensible half of the fluid-type finding — see the block comment
         above for why the inert-at-375-and-1600 half is NOT asserted. */
      where: "text.$doc",
      quote: "clamp(min, vw, max)",
      label: "every fluid step's vw term is live somewhere",
      check: () => {
        const dead = [];
        for (const k of textKeys.filter(isClamp)) {
          /* Two middle forms, because the ramp introduced the second. `Bvw`
             alone passes through the origin, so its crossover widths are
             min/B and max/B. `Arem + Bvw` is the anchored form — it lets both
             ends be chosen widths rather than falling out of one slope — and
             its crossovers solve A + B·W/100 = min and = max. */
          const v = valOf(k);
          let m = v.match(/^clamp\(\s*([\d.]+)rem\s*,\s*([\d.]+)vw\s*,\s*([\d.]+)rem\s*\)$/);
          let a = 0, b, lo, hi;
          if (m) { b = parseFloat(m[2]); }
          else {
            m = v.match(/^clamp\(\s*([\d.]+)rem\s*,\s*([\d.]+)rem\s*\+\s*([\d.]+)vw\s*,\s*([\d.]+)rem\s*\)$/);
            if (!m) { dead.push(`${k} (unparsed: ${v})`); continue; }
            a = px(m[2]);
            b = parseFloat(m[3]);
            m = [m[0], m[1], null, m[4]];   // normalise to [ , min, , max ]
          }
          if (!(b > 0)) { dead.push(`${k} has no positive vw term`); continue; }
          lo = ((px(m[1]) - a) / b) * 100;
          hi = ((px(m[3]) - a) / b) * 100;
          if (!(hi > lo)) dead.push(`${k} is pinned at every width — min ${m[1]}rem and max ${m[3]}rem cross at ${lo.toFixed(0)}px`);
        }
        return dead.length ? `these clamps never scale: ${dead.join("; ")}` : null;
      },
    },
    {
      where: "content.$doc",
      quote: "content-muted is stone-600, not -500",
      check: () => (varByName.get("content-muted")?.value === "var(--stone-600)" ? null : `content-muted is ${varByName.get("content-muted")?.value}`),
    },
    {
      where: "chrome.$doc",
      quote: "chrome-label is slate-600, not -500",
      check: () => (varByName.get("chrome-label")?.value === "var(--slate-600)" ? null : `chrome-label is ${varByName.get("chrome-label")?.value}`),
    },
    {
      where: "surface.$doc",
      quote: "On paper every surface collapses to one",
      check: () => {
        const prints = Object.entries(tokens.surface).filter(([k, v]) => k !== "$doc" && v && typeof v === "object" && v.print !== undefined);
        const distinct = new Set(prints.map(([, v]) => resolvePrint(v.print)));
        return distinct.size === 1 ? null : `the surfaces that print resolve to ${distinct.size} different colours: ${[...distinct].join(", ")}`;
      },
    },
    {
      where: "action.$doc",
      quote: "`action` itself was deleted",
      check: () => (varByName.has("action") ? `an \`action\` token exists again, with value ${varByName.get("action").value}` : null),
    },
    {
      where: "accent.$doc",
      quote: "The dark value is the same hue lifted to 68% lightness",
      check: () => {
        const a = varByName.get("accent");
        const p = (c) => String(c).match(/^hsl\(\s*([\d.]+)\s+([\d.]+)%\s+([\d.]+)%\s*\)$/);
        const l = p(a?.value), d = p(a?.dark);
        if (!l || !d) return `accent is not a plain hsl() pair — light ${a?.value}, dark ${a?.dark}`;
        if (l[1] !== d[1] || l[2] !== d[2]) return `the hue/saturation are not the same: light ${l[1]} ${l[2]}%, dark ${d[1]} ${d[2]}%`;
        return d[3] === "68" ? null : `the dark lightness is ${d[3]}%, not 68%`;
      },
    },
    {
      where: "accent-rgb.description",
      quote: "It has no CSS consumer any more",
      check: () => {
        const n = (stripComments(componentsCss).match(/var\(\s*--accent-rgb/g) || []).length;
        return n === 0 ? null : `components.css uses var(--accent-rgb) ${n} time(s)`;
      },
    },
    {
      where: "automata-cell-rgb.description",
      quote: "stone-500 on paper, stone-400 on dark",
      check: () => {
        const t = varByName.get("automata-cell-rgb");
        const want = (name) => toRgb(colourOf(name)).join(", ");
        if (t.value !== want("stone-500")) return `the light triplet is ${t.value}; stone-500 is ${want("stone-500")}`;
        if (t.dark !== want("stone-400")) return `the dark triplet is ${t.dark}; stone-400 is ${want("stone-400")}`;
        return null;
      },
    },
    {
      where: "chrome-grid.description",
      quote: "slate-500 at 16% on paper, slate-400 at 14% on dark",
      check: () => {
        const t = varByName.get("chrome-grid");
        const rgbOf = (c) => toRgb(c)?.join(", ");
        if (rgbOf(t.value) !== toRgb(colourOf("slate-500")).join(", ")) return `the light grid is ${t.value}, which is not slate-500`;
        if (alphaOf(t.value) !== 0.16) return `the light grid's alpha is ${alphaOf(t.value)}, not 16%`;
        if (rgbOf(t.dark) !== toRgb(colourOf("slate-400")).join(", ")) return `the dark grid is ${t.dark}, which is not slate-400`;
        if (alphaOf(t.dark) !== 0.14) return `the dark grid's alpha is ${alphaOf(t.dark)}, not 14%`;
        return null;
      },
    },
    {
      where: "shadow-drop.description",
      quote: "a 15% veil",
      check: () => {
        const a = alphaOf(varByName.get("shadow-drop").value);
        return a === 0.15 ? null : `shadow-drop's light alpha is ${a}, not 15%`;
      },
    },
  ];

  for (const s of STRUCTURAL) {
    const text = proseOf(s.where);
    const what = s.label ? `${s.where} (${s.label})` : s.where;
    if (text === null) { bad.push(`${what}: the prose this claim verifies no longer exists. Re-point it or remove it.`); continue; }
    if (!text.includes(s.quote)) {
      bad.push(`${what} no longer says "${s.quote}". If the wording changed, re-point this claim in build.mjs; the check is only meaningful while it is verifying a sentence that is actually there.`);
      continue;
    }
    let why = null;
    try { why = s.check(); } catch (e) { why = `the check threw (${e.message}) — the shape it assumes has changed`; }
    if (why) bad.push(`${what} says "${s.quote}" — ${why}`);
  }

  if (bad.length) {
    console.error(
      `✗ doc arithmetic check failed — tokens.json's prose does not recompute (${bad.length}):\n  - ${bad.join("\n  - ")}\n` +
        `  Every figure in a $doc is a measurement of the values beside it. If one disagrees, either the prose is stale or the value moved;\n` +
        `  this gate deliberately does not guess which. Fix the one that is wrong, in the same commit.`
    );
    process.exit(1);
  }
  console.log(
    `✓ doc arithmetic check   (${CONTRAST.length} contrast figures recomputed to their own precision, ` +
      `${CONSTANTS.length} constant, ${STRUCTURAL.length} structural claims, ${found.length} prose figures all registered)`
  );
}
