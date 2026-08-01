#!/usr/bin/env node
/* ============================================================
   THE COMPONENT-CSS EMITTER — definition.json → a block of components.css.
   Zero dependencies, like everything else in this directory.

   `node scripts/emit-css.mjs`          splice the generated regions into
                                        css/components.css and write it
   `node scripts/emit-css.mjs --check`  render and compare, write nothing
                                        (the same comparison build.mjs runs)

   PHASE R1 — PILOT SCOPE. Three components (button, chip, stat) have their
   appearance authored as data in components/<id>/definition.json and their CSS
   block GENERATED from it. The other twenty blocks in css/components.css are
   hand-authored and untouched. css/components.css is therefore an ASSEMBLY:
   authored source with three generated regions bracketed by markers, in the
   same idiom as the `<!-- content:… -->` regions of index.html. A region opens
   with a marker naming its source and closes with a slashed one — written here
   without their comment terminators, which would end this comment:

       /* ---- generated:button — do not edit, source: components/button/definition.json ----
       …generated…
       /* ---- /generated:button ----

   THE MARKER IS `----` AND NOT `====`, AND THAT IS DELIBERATE. Every banner in
   components.css opens `/* ====…==== @component <id>`, and build.mjs counts
   those banners to prove each one carries an `@component` marker. A region
   marker drawn with `=` would be counted as a banner with no `@component`, so
   the census would have to learn an exception — a gate weakened by a comment
   style. A different rule glyph costs nothing and keeps the census exact.

   THE DEFINITION FORMAT, extracted from what these three blocks genuinely
   need rather than designed up front (R3 extracts the schema from them):

     block          the CSS banner: { title, note?: [lines] }
     root           the component's own selector, e.g. ".btn"
     base           { declarations, states? } — the rule for `root`
     variants[]     { name, selector, declarations, states? } — appearance
     sizes[]        { name, selector, declarations, states? } — dimension
     parts[]        { name, selector, declarations } — a companion selector
                    that is not a modifier of root (chip's `.chips` wrapper)
     states[]       { name, suffix, declarations } — suffix is appended to the
                    owner's selector, so `:hover` on `.btn--solid` is a state
                    OF the variant and is emitted straight after it

   DECLARATIONS ARE GROUPED, because the authored CSS groups them and the
   grouping carries meaning — `font-size / font-weight / letter-spacing` on one
   line is one decision. Each group is `{ note?: [lines], set: { prop: value } }`
   and the key order inside `set` is the emission order. One group renders on
   one line; more than one renders as a block, one group per line. That rule
   reproduces all three authored blocks byte for byte.

   A VALUE IS ONE OF THREE THINGS, and the difference is the point:

     "inline-block"                  a structural literal, emitted verbatim
     { "token": "space-3" }          a token binding → var(--space-3)
     ["1px", "solid", {"token":"…"}] a sequence of the two, space-joined

   So `border: 1px solid var(--content-primary)` says, in data, that its width
   and style are structure and its colour is a token. Nothing else in this repo
   could tell you that from the CSS.

   WHY THE WRITE LIVES HERE AND NOT IN build.mjs. build.mjs is a generator the
   root `npm run build` runs, and test/drift.test.js recomputes the root drift
   gate's pathspec list from every `writeFileSync` target in every such
   generator — so a write to css/components.css from build.mjs would demand
   that css/components.css join `git diff --exit-code` in the root
   package.json and ci.yml. It should not, yet: components.css is authored
   source with three generated regions, not a dist artefact, and twenty of its
   blocks are still hand-written. This script is a source tool in the manner of
   ../../scripts/new-component.mjs — you run it when you change a definition —
   and the regions it writes are guarded by something stricter than the drift
   gate anyway: `build.mjs --check` re-renders them in memory and byte-compares
   before anything is written. R3 decides whether components.css graduates to a
   fully generated artefact, and that is the commit that moves the pathspec.
   ============================================================ */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

/** The pilot. Every id here MUST have a definition.json, and its CSS block in
 *  css/components.css MUST be a generated region. Both are gated in build.mjs. */
export const PILOT = ["button", "chip", "stat"];

/** Repo-relative and POSIX, because it is printed in messages and written into
 *  the marker in components.css — a backslash there would differ per platform. */
export const definitionPath = (id) => `components/${id}/definition.json`;

/* ---------- load ---------- */

/** @returns {{def: object|null, error: string|null}} — never throws, so the
 *  caller can report every broken definition at once rather than the first. */
export function loadDefinition(id) {
  const rel = definitionPath(id);
  const abs = join(root, "components", id, "definition.json");
  if (!existsSync(abs)) {
    return {
      def: null,
      error:
        `${rel} is missing — \`${id}\` is a pilot component, and its CSS block in css/components.css is ` +
        `GENERATED from that file. Restore it, or take \`${id}\` out of PILOT in scripts/emit-css.mjs and ` +
        `hand-author the block again.`,
    };
  }
  let def;
  try {
    def = JSON.parse(readFileSync(abs, "utf8"));
  } catch (e) {
    return { def: null, error: `${rel} is not valid JSON — ${e.message}` };
  }
  if (def.id !== id) return { def: null, error: `${rel}: its \`id\` is ${JSON.stringify(def.id)}, and it sits in components/${id}/` };
  if (!def.block?.title) return { def: null, error: `${rel}: \`block.title\` is missing — it is the banner text` };
  if (typeof def.root !== "string") return { def: null, error: `${rel}: \`root\` must be the component's own selector, e.g. ".btn"` };
  if (!Array.isArray(def.base?.declarations)) return { def: null, error: `${rel}: \`base.declarations\` must be an array of groups` };
  return { def, error: null };
}

/* ---------- render ---------- */

/** Twelve, on both sides, in every banner of components.css. */
const BAR = "=".repeat(12);

/** A comment at `indent`, continuation lines aligned under the text after `/*`. */
function comment(lines, indent) {
  const head = `${indent}/* ${lines[0]}`;
  if (lines.length === 1) return `${head} */\n`;
  return `${head}\n${lines.slice(1).map((l) => `${indent}   ${l}`).join("\n")} */\n`;
}

/** A declaration value → CSS. The three forms are documented in the header. */
function value(v, where) {
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v.map((t) => value(t, where)).join(" ");
  if (v && typeof v === "object" && typeof v.token === "string") return `var(--${v.token})`;
  throw new Error(
    `${where}: a declaration value must be a string (a structural literal), {"token":"name"} (a token ` +
      `binding) or an array of those — got ${JSON.stringify(v)}`
  );
}

/** One rule. One declaration group → one line; more than one → a block. */
function rule(selector, declarations, where) {
  const groups = (declarations ?? []).map((g, i) => {
    if (!g?.set || typeof g.set !== "object") throw new Error(`${where}: group ${i} of \`${selector}\` has no \`set\``);
    return {
      note: Array.isArray(g.note) && g.note.length ? g.note : null,
      text: Object.entries(g.set).map(([p, v]) => `${p}: ${value(v, `${where} → ${selector} { ${p} }`)};`).join(" "),
    };
  });
  if (!groups.length) throw new Error(`${where}: \`${selector}\` declares nothing`);
  if (groups.length === 1 && !groups[0].note) return `${selector} { ${groups[0].text} }\n`;
  let out = `${selector} {\n`;
  for (const g of groups) {
    if (g.note) out += comment(g.note, "  ");
    out += `  ${g.text}\n`;
  }
  return `${out}}\n`;
}

/** The banner, whose first line carries the `@component <id>` marker build.mjs reads. */
function banner(def) {
  const head = `/* ${BAR} ${def.block.title} ${BAR} @component ${def.id}`;
  const note = def.block.note ?? [];
  return note.length ? `${head}\n${note.map((l) => `   ${l}`).join("\n")} */\n` : `${head} */\n`;
}

/** A whole block: banner, base, base states, variants (+ their states), sizes, parts.
 *  That order is the cascade — a variant must be able to beat the base, and a
 *  state of a variant must be able to beat the variant. */
export function renderBlock(def) {
  const where = definitionPath(def.id);
  const states = (owner, list) => (list ?? []).map((s) => rule(`${owner}${s.suffix}`, s.declarations, where)).join("");

  let out = banner(def);
  out += rule(def.root, def.base.declarations, where);
  out += states(def.root, def.base.states);
  for (const v of def.variants ?? []) {
    out += rule(v.selector, v.declarations, where);
    out += states(v.selector, v.states);
  }
  for (const z of def.sizes ?? []) {
    out += rule(z.selector, z.declarations, where);
    out += states(z.selector, z.states);
  }
  for (const p of def.parts ?? []) out += rule(p.selector, p.declarations, where);
  return out;
}

/* ---------- the assembly ---------- */

export const openMarker = (id) => `/* ---- generated:${id} — do not edit, source: ${definitionPath(id)} ---- */`;
export const closeMarker = (id) => `/* ---- /generated:${id} ---- */`;

/**
 * Locate one generated region in components.css.
 * @returns {{start:number,end:number,body:string}|{error:string}}
 *   `start`/`end` bracket the region BODY — everything between the open
 *   marker's newline and the close marker.
 */
export function regionOf(css, id) {
  const open = openMarker(id);
  const close = closeMarker(id);
  const o = css.indexOf(open);
  if (o === -1) return { error: `css/components.css has no \`${open}\` — the generated region for \`${id}\` is gone` };
  if (css.indexOf(open, o + 1) !== -1) return { error: `css/components.css opens the \`${id}\` region more than once` };
  const start = o + open.length + 1; // past the marker's own newline
  const c = css.indexOf(close, start);
  if (c === -1) return { error: `css/components.css opens the \`${id}\` region but never closes it with \`${close}\`` };
  return { start, end: c, body: css.slice(start, c) };
}

/** Every pilot region re-rendered from its definition. */
export function renderAll() {
  const rendered = new Map();
  const errors = [];
  for (const id of PILOT) {
    const { def, error } = loadDefinition(id);
    if (error) { errors.push(error); continue; }
    try {
      rendered.set(id, renderBlock(def));
    } catch (e) {
      errors.push(e.message);
    }
  }
  return { rendered, errors };
}

/**
 * Compare each region on disk against a fresh render.
 * @returns {{drift: string[], errors: string[]}} — `drift` names the region,
 *   its definition source and the first differing line.
 */
export function checkRegions(css, rendered) {
  const drift = [];
  const errors = [];
  for (const [id, want] of rendered) {
    const r = regionOf(css, id);
    if (r.error) { errors.push(r.error); continue; }
    if (r.body === want) continue;
    const g = r.body.split("\n");
    const w = want.split("\n");
    let i = 0;
    while (i < Math.min(g.length, w.length) && g[i] === w[i]) i++;
    drift.push(
      `generated:${id} (source: ${definitionPath(id)}) differs from a fresh render at line ${i + 1} of the region:\n` +
        `      in components.css: ${JSON.stringify(g[i] ?? "<end of region>")}\n` +
        `      from the definition: ${JSON.stringify(w[i] ?? "<end of region>")}`
    );
  }
  return { drift, errors };
}

/** Splice every rendered region into `css`, back to front so offsets hold. */
export function spliceRegions(css, rendered) {
  const spans = [];
  for (const [id, body] of rendered) {
    const r = regionOf(css, id);
    if (r.error) throw new Error(r.error);
    spans.push({ ...r, body });
  }
  spans.sort((a, b) => b.start - a.start);
  let out = css;
  for (const s of spans) out = out.slice(0, s.start) + s.body + out.slice(s.end);
  return out;
}

/* ---------- run directly: write ---------- */
const isMain = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;
if (isMain) {
  const CHECK = process.argv.includes("--check");
  const path = join(root, "css", "components.css");
  const css = readFileSync(path, "utf8");
  const { rendered, errors } = renderAll();
  if (errors.length) {
    console.error(`✗ component definitions failed to render:\n  - ${errors.join("\n  - ")}`);
    process.exit(1);
  }
  if (CHECK) {
    const { drift, errors: missing } = checkRegions(css, rendered);
    const all = [...missing, ...drift];
    if (all.length) {
      console.error(`✗ components.css assembly check failed:\n  - ${all.join("\n  - ")}`);
      process.exit(1);
    }
    console.log(`✓ components.css assembly (${rendered.size} generated regions match their definitions)`);
  } else {
    const out = spliceRegions(css, rendered);
    if (out === css) {
      console.log(`✓ css/components.css     (${rendered.size} generated regions already current)`);
    } else {
      writeFileSync(path, out);
      console.log(`✓ css/components.css     (${rendered.size} generated regions rewritten from components/*/definition.json)`);
    }
  }
}
