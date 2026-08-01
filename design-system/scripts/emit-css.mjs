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
import { validate, formatErrors } from "./validate-json.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

/** The pilot. Every id here MUST have a definition.json, and its CSS block in
 *  css/components.css MUST be a generated region. Both are gated in build.mjs. */
export const PILOT = ["button", "chip", "stat"];

/** Repo-relative and POSIX, because it is printed in messages and written into
 *  the marker in components.css — a backslash there would differ per platform. */
export const definitionPath = (id) => `components/${id}/definition.json`;

/* ============================================================
   LOAD — schema, then the things a schema cannot see.

   Phase R3. `components/definition.schema.json` is the SHAPE, extracted from
   these three real files rather than designed in front of them, and
   scripts/validate-json.mjs checks it with no dependency. Everything below
   the schema call is a check the schema structurally cannot make: it does not
   know the file's path, it has never read tokens.json, and it cannot resolve
   a reference from one part of the document to another.

   The order matters. Schema first, because a shape failure makes every
   semantic check downstream report noise about a document that was never
   valid; semantics second, in the order a reader can act on them.
   ============================================================ */

const SCHEMA_PATH = "components/definition.schema.json";
let schemaCache = null;
const schema = () => (schemaCache ??= JSON.parse(readFileSync(join(root, SCHEMA_PATH), "utf8")));

/** Every token name tokens.json defines. A binding to anything else is a typo
 *  that would emit `var(--typo)` and render nothing — silently, in both pipelines. */
let tokenCache = null;
function tokenNames() {
  if (tokenCache) return tokenCache;
  const tokens = JSON.parse(readFileSync(join(root, "tokens", "tokens.json"), "utf8"));
  tokenCache = new Set();
  for (const [group, body] of Object.entries(tokens)) {
    if (group.startsWith("$")) continue;
    for (const name of Object.keys(body)) if (!name.startsWith("$")) tokenCache.add(name);
  }
  return tokenCache;
}

/* A structural literal is not an escape hatch. Every family below has a token
   tier, and scripts/check-css.mjs refuses a literal for each of them — in CSS.
   It has never read a definition.json, so without this a raw value could walk
   into the system through the one door the stylesheet gate does not watch.

   R4 FLIPPED TWO OF THESE. `font-weight` and `letter-spacing` were exempt in
   R3 for a stated reason — they had no token tier, so a literal was the honest
   answer rather than a leak. R4 minted both tiers, so the reason expired and
   the exemption with it. `font-variation-settings` joined them for the same
   reason. That is the shape a well-behaved exemption has: a condition, not a
   permission.

   WHAT IS STILL EXEMPT, and why it is not an oversight. `line-height` has
   twelve distinct values across nineteen declarations, which is drift to be
   consolidated before it is tokenised rather than drift to be enshrined in
   tokens.json — a tier of twelve steps with one consumer each fails this
   system's own rule that a semantic tier earns its keep by being consumed. It
   is on the owner's review list. So is `max-width`, which is a measure rather
   than a type property. */
const AS_COLOUR = /^(#[0-9a-f]{3,8}|(rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\()/i;
const SIZED = new Set(["font-size"]);
const SPACED = new Set(["padding", "margin", "gap", "row-gap", "column-gap", "inset", "top", "right", "bottom", "left"]);
/** prop → the tier a literal should have come from. */
const TIERED = {
  "font-weight": ["--weight-*", "the six steps of the weight tier"],
  "letter-spacing": ["--tracking-*", "the two families of the tracking ramp"],
  "font-variation-settings": ["--width-*", "the six steps of the display width axis"],
};

/** Walk every declaration in a definition: `fn(prop, value, where)`. */
function eachDeclaration(def, fn) {
  const rules = [["base", def.base]];
  for (const kind of ["variants", "sizes"]) for (const m of def[kind] ?? []) rules.push([`${kind}.${m.name}`, m]);
  for (const p of def.parts ?? []) rules.push([`parts.${p.name}`, p]);
  for (const [label, rule] of rules) {
    for (const g of rule.declarations ?? []) for (const [prop, value] of Object.entries(g.set)) fn(prop, value, label);
    for (const s of rule.states ?? []) {
      for (const g of s.declarations) for (const [prop, value] of Object.entries(g.set)) fn(prop, value, `${label}:${s.name}`);
    }
  }
}

const terms = (value) => (Array.isArray(value) ? value : [value]);

/**
 * @returns {{def: object|null, errors: string[]}} — never throws, so the caller
 *   can report every broken definition at once rather than only the first.
 */
export function loadDefinition(id) {
  const rel = definitionPath(id);
  const abs = join(root, "components", id, "definition.json");
  if (!existsSync(abs)) {
    return {
      def: null,
      errors: [
        `${rel} is missing — \`${id}\` is a pilot component, and its CSS block in css/components.css is ` +
          `GENERATED from that file. Restore it, or take \`${id}\` out of PILOT in scripts/emit-css.mjs and ` +
          `hand-author the block again.`,
      ],
    };
  }
  let def;
  try {
    def = JSON.parse(readFileSync(abs, "utf8"));
  } catch (e) {
    return { def: null, errors: [`${rel} is not valid JSON — ${e.message}`] };
  }

  /* ---- 1. the shape ----
     A throw here is the SCHEMA being wrong, not the definition: validate-json
     refuses a keyword it does not implement rather than ignoring it. Reported
     as such, because "components/chip/definition.json is invalid" would send
     the reader to the wrong file. */
  let shape;
  try {
    shape = validate(schema(), def);
  } catch (e) {
    return {
      def: null,
      errors: [
        `${SCHEMA_PATH} cannot be used to validate ${rel} — ${e.message}\n` +
          `      The schema is what is wrong here, not the definition.`,
      ],
    };
  }
  if (shape.length) return { def: null, errors: formatErrors(shape, rel) };

  /* ---- 2. what the schema cannot see ---- */
  const errors = [];
  const bad = (msg) => errors.push(`${rel}: ${msg}`);

  if (def.id !== id) bad(`its \`id\` is ${JSON.stringify(def.id)}, and it sits in components/${id}/`);

  /* Bindings resolve. */
  const known = tokenNames();
  eachDeclaration(def, (prop, value, where) => {
    for (const t of terms(value)) {
      if (t && typeof t === "object" && !known.has(t.token)) {
        bad(`\`${where}\` binds \`{"token": "${t.token}"}\` on \`${prop}\`, and tokens.json defines no such token — it would emit \`var(--${t.token})\` and render nothing`);
      }
    }
  });

  /* Structural literals stay structural. */
  eachDeclaration(def, (prop, value, where) => {
    for (const t of terms(value)) {
      if (typeof t !== "string") continue;
      if (AS_COLOUR.test(t.trim())) {
        bad(`\`${where}\` writes the colour literal \`${t}\` on \`${prop}\`. Colours are born in tokens.json and reach a definition as {"token": "…"} — scripts/check-css.mjs refuses this in CSS and cannot see it here`);
      } else if (TIERED[prop]) {
        const [tier, what] = TIERED[prop];
        bad(`\`${where}\` writes \`${prop}: ${t}\` as a structural literal. R4 minted ${tier} — ${what} — so bind one; this was legal until the tier existed and stopped being legal the day it did`);
      } else if (SIZED.has(prop)) {
        bad(`\`${where}\` writes \`${prop}: ${t}\` as a structural literal. Every size is a --text-* step; bind one, or add a step to tokens.json if none fits`);
      } else if (SPACED.has(prop) && t.trim() !== "0") {
        bad(`\`${where}\` writes \`${t}\` on \`${prop}\` as a structural literal. Every spacing step is a --space-* token; \`0\` is the one literal this allows, because zero is not a step`);
      }
    }
  });

  /* A modifier's selector is its root plus its name — stated in the file so the
     CSS is transcribed rather than assembled, and checked so the two agree. */
  const seen = new Map([[def.root, "root"]]);
  for (const kind of ["variants", "sizes"]) {
    for (const m of def[kind] ?? []) {
      const want = `${def.root}--${m.name}`;
      if (m.selector !== want) bad(`\`${kind}.${m.name}\` has the selector \`${m.selector}\`, and a modifier of \`${def.root}\` named \`${m.name}\` is \`${want}\``);
      if (seen.has(m.selector)) bad(`\`${m.selector}\` is declared twice — by \`${seen.get(m.selector)}\` and by \`${kind}.${m.name}\``);
      seen.set(m.selector, `${kind}.${m.name}`);
    }
  }
  for (const p of def.parts ?? []) {
    if (seen.has(p.selector)) bad(`\`${p.selector}\` is declared twice — by \`${seen.get(p.selector)}\` and by \`parts.${p.name}\``);
    seen.set(p.selector, `parts.${p.name}`);
  }

  /* The matrix claim: required exactly when there is a matrix to claim. */
  const axes = ["variants", "sizes"].filter((k) => def[k]?.length).map((k) => (k === "variants" ? "variant" : "size"));
  if (axes.length >= 2 && !def.axes) {
    bad(
      `it has ${axes.length} axes (${axes.join(", ")}) and no \`axes\` block. Two axes apply at once, and in the React ` +
        `tier they land in one class attribute, which has no order — so either every combination is deliberate and the ` +
        `two touch disjoint properties, or somebody has to say which wins. Declare \`"axes": {"orthogonal": ${JSON.stringify(axes)}}\` ` +
        `and the emitter will check it, or restructure. An emitter must not be the one to decide.`
    );
  }
  if (axes.length < 2 && def.axes) {
    bad(`it declares \`axes\` and has ${axes.length === 1 ? "one axis" : "no axes"} — there is no matrix to have an opinion about`);
  }
  if (def.axes && axes.length >= 2) {
    const declared = [...def.axes.orthogonal].sort().join(",");
    if (declared !== [...axes].sort().join(",")) {
      bad(`\`axes.orthogonal\` names ${JSON.stringify(def.axes.orthogonal)} and its axes are ${JSON.stringify(axes)} — every axis that applies has to be in the claim`);
    }
  }

  /* ---- 3. resolve aliases, so neither emitter has to know about them ---- */
  for (const kind of ["variants", "sizes"]) {
    for (const m of def[kind] ?? []) {
      if (!m.aliases) continue;
      const state = m.aliases.state;
      const source = state ? (def.base.states ?? []).find((s) => s.name === state) : def.base;
      if (!source) {
        bad(`\`${kind}.${m.name}\` aliases the base's \`${state}\` state, and the base declares no such state`);
        continue;
      }
      /* A deep copy, because the two rules are now one statement and an emitter
         must not be able to mutate one of them into disagreeing with the other. */
      m.declarations = JSON.parse(JSON.stringify(source.declarations));
    }
  }

  return errors.length ? { def: null, errors } : { def, errors: [] };
}

/* ---------- render ---------- */

/** Twelve, on both sides, in every banner of components.css. */
const BAR = "=".repeat(12);

/** A comment at `indent`, continuation lines aligned under the text after `/*`.
 *  An empty line stays empty rather than becoming indent-plus-nothing: a
 *  paragraph break inside a note is a blank line, not five spaces. */
function comment(lines, indent) {
  const head = `${indent}/* ${lines[0]}`;
  if (lines.length === 1) return `${head} */\n`;
  return `${head}\n${lines.slice(1).map((l) => (l === "" ? "" : `${indent}   ${l}`)).join("\n")} */\n`;
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
  /* An empty line stays empty — a paragraph break is a blank line, not three spaces. */
  return note.length ? `${head}\n${note.map((l) => (l === "" ? "" : `   ${l}`)).join("\n")} */\n` : `${head} */\n`;
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

/* ============================================================
   THE TYPOGRAPHY LAYER — tokens/typography.json → the `generated:typography`
   region of css/components.css.

   Phase R4. The type scale's PRESENTATION tier, as a table: one row per level
   of the hierarchy, and every family, size, weight, width and tracking in it is
   a token binding. It is generated for the reason the owner gave in one line —
   typography should not be authored — and it is generated by THIS emitter
   rather than through the component pipeline, for two reasons that are worth
   keeping straight.

   A LEVEL IS NOT A COMPONENT. A definition describes one element's appearance
   and produces a React component with props; a typographic level is a utility
   class applied to whatever element a page already has. Nothing about `.t-lead`
   wants a `<TLead>`.

   AND ONE OF THEM COULD NOT SURVIVE THE OTHER PIPELINE ANYWAY. `.t-title` sets
   `line-height` twice — a modern `round()` value behind a plain fallback — and
   a fallback pair cannot be expressed in a class attribute, which has no order.
   Making typography a definition would have meant either dropping the fallback
   on one surface or teaching the component schema a construct only one surface
   could honour. A CSS-only layer is the honest shape.

   The levels are validated against the SAME `$defs` the component schema uses
   — value forms, groups, notes, selectors — assembled at load rather than
   copied, so the two shapes cannot drift into disagreeing about what a value is.
   ============================================================ */

const TYPOGRAPHY_PATH = "tokens/typography.json";

/** The component schema's shared definitions, wrapped in the levels shape. */
function typographySchema() {
  const base = schema();
  return {
    $doc: `Assembled at load from ${SCHEMA_PATH}'s $defs — never copied, so a change to what a value is reaches both files.`,
    type: "object",
    required: ["block", "levels"],
    additionalProperties: false,
    properties: {
      $doc: { type: "string" },
      $schema: { type: "string" },
      block: { $ref: "#/$defs/block" },
      levels: {
        type: "array",
        minItems: 1,
        items: {
          type: "object",
          required: ["name", "selector", "declarations"],
          additionalProperties: false,
          properties: {
            name: { type: "string", pattern: "^[a-z][a-z0-9-]*$" },
            selector: { $ref: "#/$defs/selector" },
            $doc: { type: "string" },
            declarations: { $ref: "#/$defs/declarations" },
            variants: {
              type: "array",
              minItems: 1,
              items: {
                type: "object",
                required: ["name", "selector", "declarations"],
                additionalProperties: false,
                properties: {
                  name: { type: "string", pattern: "^[a-z][a-z0-9-]*$" },
                  selector: { $ref: "#/$defs/selector" },
                  $doc: { type: "string" },
                  declarations: { $ref: "#/$defs/declarations" },
                },
              },
            },
          },
        },
      },
    },
    $defs: base.$defs,
  };
}

/** @returns {{table: object|null, errors: string[]}} */
export function loadTypography() {
  const abs = join(root, "tokens", "typography.json");
  if (!existsSync(abs)) return { table: null, errors: [`${TYPOGRAPHY_PATH} is missing — the typography block of css/components.css is generated from it`] };
  let table;
  try {
    table = JSON.parse(readFileSync(abs, "utf8"));
  } catch (e) {
    return { table: null, errors: [`${TYPOGRAPHY_PATH} is not valid JSON — ${e.message}`] };
  }
  let shape;
  try {
    shape = validate(typographySchema(), table);
  } catch (e) {
    return { table: null, errors: [`${SCHEMA_PATH} cannot be used to validate ${TYPOGRAPHY_PATH} — ${e.message}`] };
  }
  if (shape.length) return { table: null, errors: formatErrors(shape, TYPOGRAPHY_PATH) };

  const errors = [];
  const known = tokenNames();
  const seen = new Set();
  for (const level of table.levels) {
    for (const rule of [level, ...(level.variants ?? [])]) {
      if (seen.has(rule.selector)) errors.push(`${TYPOGRAPHY_PATH}: \`${rule.selector}\` is declared twice`);
      seen.add(rule.selector);
      for (const g of rule.declarations) {
        for (const [prop, v] of Object.entries(g.set)) {
          for (const t of terms(v)) {
            if (t && typeof t === "object" && !known.has(t.token)) {
              errors.push(`${TYPOGRAPHY_PATH}: level \`${level.name}\` binds \`{"token": "${t.token}"}\` on \`${prop}\`, and tokens.json defines no such token`);
            } else if (typeof t === "string" && (AS_COLOUR.test(t.trim()) || TIERED[prop] || SIZED.has(prop))) {
              errors.push(`${TYPOGRAPHY_PATH}: level \`${level.name}\` writes \`${prop}: ${t}\` as a literal, and that property has a token tier`);
            }
          }
        }
      }
    }
    for (const v of level.variants ?? []) {
      const want = `${level.selector}--${v.name}`;
      if (v.selector !== want) errors.push(`${TYPOGRAPHY_PATH}: level \`${level.name}\` variant \`${v.name}\` has the selector \`${v.selector}\`, and a variant of \`${level.selector}\` named \`${v.name}\` is \`${want}\``);
    }
  }
  return errors.length ? { table: null, errors } : { table, errors: [] };
}

/** One blank line between levels, none between a level and its own variants —
 *  the paragraph in the stylesheet is the row in the table. */
export function renderTypography(table) {
  const where = TYPOGRAPHY_PATH;
  let out = banner({ block: table.block, id: "typography" });
  table.levels.forEach((level, i) => {
    if (i) out += "\n";
    out += rule(level.selector, level.declarations, where);
    for (const v of level.variants ?? []) out += rule(v.selector, v.declarations, where);
  });
  return out;
}

/* ---------- the assembly ---------- */

/** Which file a generated region comes from. The three components come from
 *  their definitions; the typography layer comes from the levels table, which
 *  is not a component and does not pretend to be one. */
export const sourceOf = (id) => (id === "typography" ? TYPOGRAPHY_PATH : definitionPath(id));

export const openMarker = (id) => `/* ---- generated:${id} — do not edit, source: ${sourceOf(id)} ---- */`;
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

/**
 * Every pilot definition, in PILOT order. Both emitters start here — pipeline 1
 * renders these to css/components.css, pipeline 2 to dist/react/ — so the load
 * and its error reporting live in one place rather than once per consumer.
 * @returns {{defs: object[], errors: string[]}}
 */
export function loadAll() {
  const defs = [];
  const errors = [];
  for (const id of PILOT) {
    const { def, errors: bad } = loadDefinition(id);
    if (bad.length) errors.push(...bad);
    else defs.push(def);
  }
  return { defs, errors };
}

/** Every generated region re-rendered from its source — the three component
 *  definitions, and the typography layer. */
export function renderAll(defs) {
  const rendered = new Map();
  const errors = [];
  for (const def of defs ?? loadAll().defs) {
    try {
      rendered.set(def.id, renderBlock(def));
    } catch (e) {
      errors.push(e.message);
    }
  }
  const { table, errors: typoErrors } = loadTypography();
  if (typoErrors.length) errors.push(...typoErrors);
  else {
    try {
      rendered.set("typography", renderTypography(table));
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
      `generated:${id} (source: ${sourceOf(id)}) differs from a fresh render at line ${i + 1} of the region:\n` +
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
  const { defs, errors: loadErrors } = loadAll();
  const { rendered, errors: renderErrors } = renderAll(defs);
  const errors = [...loadErrors, ...renderErrors];
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
