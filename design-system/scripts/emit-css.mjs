#!/usr/bin/env node
/* ============================================================
   THE COMPONENT-CSS EMITTER — definition.json → a block of components.css.
   Zero dependencies, like everything else in this directory.

   `node scripts/emit-css.mjs`          splice the generated regions into
                                        css/components.css and write it
   `node scripts/emit-css.mjs --check`  render and compare, write nothing
                                        (the same comparison build.mjs runs)

   PILOT SCOPE, GROWING. Every id in `PILOT` below has its appearance authored
   as data in components/<id>/definition.json and its CSS block GENERATED from
   it, and the typography layer is generated from tokens/typography.json beside
   them. The rest of css/components.css is hand-authored; PATTERNS.md measures
   which of those can follow and which are page scaffolding that stays. The file
   is therefore an ASSEMBLY: authored source with generated regions bracketed by
   markers, in the
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

   THE DEFINITION FORMAT, extracted from what the real blocks genuinely need
   rather than designed up front (R3 extracted the schema; R4 grows it one block
   at a time, and components/definition.schema.json says which block asked for
   which construct):

     block          the CSS banner: { title, note?: [lines] }
     root           the component's own selector, e.g. ".btn"
     rules[]        EVERY RULE THE BLOCK WRITES, IN STYLESHEET ORDER, each
                    tagged by `kind`. It was five sections — base, variants,
                    sizes, parts, at — rendered in a fixed cascade, and `media`
                    and `profile` are the blocks that proved the cascade was
                    this emitter's opinion rather than the stylesheet's shape:
                    media writes `.ph:has(img)` four rules after `.ph`, with a
                    part in between, and profile writes
                    `.profile > div:nth-child(odd)` after every part, beside the
                    query that undoes it. Source order IS the cascade, so a
                    definition records it rather than being re-sorted into one.

     A RULE IS ONE OF SEVEN KINDS, and each names the rules it depends on:

     base           { declarations, note? } — the rule for `root`, and the one
                    rule whose name is reserved rather than written. OPTIONAL
                    since case-body, whose root is a scope with no appearance:
                    emitting `.case-body { }` would claim a rule it has not got.
     variant        { name, selector, declarations | aliases } — appearance
     size           { name, selector, declarations | aliases } — dimension
     part           a companion selector that is not a modifier of root. Since
                    R4 a part is a FULL rule: it takes states and positions like
                    any other, and is polymorphic on the same terms the root is.
                    It has no variants or sizes — a companion that needs an axis
                    is a component with its own definition. THREE SHAPES:
                      { name, selector, … }              chip's `.chips`
                      { name, within, element[], pseudo?, … }   scoped, to a tag
                      { name, within, class, … }         scoped, to a class
                    The tag-scoped form is `.link-grid a`, `.case-body p strong`,
                    `.entry__list li::before` — a component styling markup that
                    carries no classes, which for case-body is deliberate: its
                    prose is compiled from markdown, and a class per element
                    would put styling inside the content pipeline. The
                    class-scoped form is `.sec--tint .well`: the descendant DOES
                    have a class and the class belongs to another component,
                    which is a rule this component owns about an element it does
                    not. Every half is closed — `within` NAMES an earlier rule of
                    this same definition, `element` is bare tag names, `class` is
                    one class selector — so a descendant is the only relation any
                    of them can say.
     state          { name, of, suffix, declarations } — `suffix` is appended to
                    the selector of the rule `of` names, so `:hover` on
                    `.btn--solid` is a state OF the variant. An ARRAY suffix is a
                    selector list: `[":hover", ":focus-visible"]` is one rule
                    under two selectors.
     position       { name, of, at, declarations } — where a rule sits among its
                    siblings, from a CLOSED enum (`first`, `last`). A position is
                    what the document is; a state is what the user does.
     at             { condition, rules: [{ of, declarations?, positions? }] } — a
                    set of overrides under one NAMED condition, each naming the
                    rule it overrides rather than repeating its selector.
                    `condition` is resolved in tokens.json's `$conditions`:
                    `(max-width: 720px)` appeared in two blocks meaning the same
                    thing with nothing saying so, and a media rule can no longer
                    outlive the rule it overrides.

                    TWO SHAPES USED TO WEAR THIS WORD. A stylesheet writes a
                    media query in two places — gathered in a paragraph at the
                    foot (`fact`, `entry`), or as a one-line footnote directly
                    under the rule it modifies (`section-head`, `ask-fab`) — and
                    while the rules were sections, WHERE was a property of the
                    construct and had to be two constructs. In an ordered list
                    where is where the entry sits, so what is left to record is
                    how it renders: `inline: true`, one override, one group, no
                    positions, no note, no break. NEVER INFERRED — a foot query
                    that happens to hold one rule is not thereby a footnote, and
                    media's `@media (max-width: 640px) { .ph-grid { … } }` sits
                    at the foot and renders inline.

     REFERENCES ARE NAMES, BACKWARDS ONLY. `of`, `within` and an alias's `of`
     name a rule this definition declares ABOVE the one referring to it — a
     stylesheet reads downwards and so does this — and every name is unique in
     its definition, which is what makes a reference checkable and an orphan
     impossible. The build derives `base` / `variants` / `sizes` / `parts` back
     out of the list for the two consumers that want a set rather than a
     sequence (the React axes, the contract projection). That is a query over
     the list, not a second source.

   A RULE'S `note` AND A GROUP'S `note` ARE TWO THINGS. A rule's is emitted above
   it at column 0 and explains the whole rule (`.entry__span`'s "Column 2, both
   rows"); a group's is emitted inside the braces and explains one declaration.
   The stylesheet draws that line — moving one to the other's place changes the
   bytes — and this only records it.

   DECLARATIONS ARE GROUPED, because the authored CSS groups them and the
   grouping carries meaning — `font-size / font-weight / letter-spacing` on one
   line is one decision. Each group is `{ note?: [lines], set: { prop: value } }`
   and the key order inside `set` is the emission order. One group renders on
   one line; more than one renders as a block, one group per line. That rule
   reproduces every authored block it has replaced byte for byte. A group may
   also carry an `aside`, a comment emitted at the END of its line — footer's
   two are the case that added it.

   A VALUE IS ONE OF FOUR THINGS, and the difference is the point:

     "inline-block"                  a structural literal, emitted verbatim
     { "token": "space-3" }          a token binding → var(--space-3)
     { "expr": "calc({space-3} - 2px)" }
                                     computed geometry → calc(var(--space-3) - 2px),
                                     with the binding still a REFERENCE the census
                                     reads rather than a var() the census cannot
     ["1px", "solid", {"token":"…"}] a sequence of those, space-joined

   So `border: 1px solid var(--content-primary)` says, in data, that its width
   and style are structure and its colour is a token. Nothing else in this repo
   could tell you that from the CSS. `expr` is the same claim one level in:
   `calc(var(--space-3) - 2px)` is a token minus a border width, and writing the
   token as `{space-3}` keeps the binding checkable — a name that does not
   resolve fails the build exactly as `{"token": "typoo"}` does, and a literal
   `var(` inside an expr is refused, because that is a binding the census could
   not see.

   WHY THE WRITE LIVES HERE AND NOT IN build.mjs. build.mjs is a generator the
   root `npm run build` runs, and test/drift.test.js recomputes the root drift
   gate's pathspec list from every `writeFileSync` target in every such
   generator — so a write to css/components.css from build.mjs would demand
   that css/components.css join `git diff --exit-code` in the root
   package.json and ci.yml. It should not, yet: components.css is authored
   source with generated regions in it, not a dist artefact, and some of its
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
export const PILOT = ["button", "chip", "stat", "footer", "source", "link-grid", "case-body", "fact", "entry", "section-head"];

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

/** The media conditions tokens.json names, and what each one resolves to.
 *  They live in `$conditions` and are emitted into no artefact: CSS cannot use a
 *  custom property in a media query, so `--below-720: (max-width: 720px)` in
 *  dist/tokens.css would be a value that looks usable and silently is not. They
 *  are still in tokens.json because that is the only file in this system where a
 *  literal may be written, and a breakpoint is a literal. */
let conditionCache = null;
export function conditionValues() {
  if (conditionCache) return conditionCache;
  const tokens = JSON.parse(readFileSync(join(root, "tokens", "tokens.json"), "utf8"));
  conditionCache = new Map();
  for (const [name, raw] of Object.entries(tokens.$conditions ?? {})) {
    if (name.startsWith("$")) continue;
    conditionCache.set(name, typeof raw === "string" ? raw : raw.value);
  }
  return conditionCache;
}
const conditionNames = () => new Set(conditionValues().keys());

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

/* ---------- computed geometry, with the bindings still visible ----------
   `{"expr": "calc({space-3} - 2px)"}` is the fourth value form, and the only
   reason it is not the wedge PATTERNS.md refuses is the interpolation: a
   `{name}` is a reference into tokens.json, resolved HERE so both pipelines
   resolve it the same way, and readable by the census exactly as a `{"token"}`
   binding is. Written `var(--space-3)` by hand it would be a binding no gate
   could check and no census could count, which is why that form is refused. */
export const EXPR_REF = /\{([a-z][a-z0-9-]*)\}/g;
export const isExpr = (v) => v !== null && typeof v === "object" && typeof v.expr === "string";
/** `calc({space-3} - 2px)` → `calc(var(--space-3) - 2px)`. */
export const exprCss = (source) => String(source).replace(EXPR_REF, (_, name) => `var(--${name})`);
/** Every token an expr references, in order. */
export const exprTokens = (source) => [...String(source).matchAll(EXPR_REF)].map((m) => m[1]);

/** The seven kinds, and the `$def` in the schema that shapes each. The map is
 *  what lets the loader re-report a rejected rule against the ONE form its
 *  `kind` claims, instead of leaving the reader with `oneOf`'s branch count. */
export const RULE_FORM = {
  base: "rule-base",
  variant: "rule-variant",
  size: "rule-size",
  part: "rule-part",
  state: "rule-state",
  position: "rule-position",
  at: "rule-at",
};

/** What the build calls a rule when it reports one: its name, and `base` for
 *  the root's own. One vocabulary — the same names `of` and `within` use. */
const labelOf = (r) => (r.kind === "base" ? "base" : r.kind === "at" ? `at ${r.condition}` : r.name);

/** Walk every declaration in a definition: `fn(prop, value, where)`. Every
 *  declaration, including the ones under a media query — a door the literal
 *  guard and the binding check do not watch is the door a raw value walks in. */
function eachDeclaration(def, fn) {
  for (const r of def.rules ?? []) {
    const label = labelOf(r);
    if (r.kind === "at") {
      for (const o of r.rules) {
        for (const g of o.declarations ?? []) for (const [prop, value] of Object.entries(g.set)) fn(prop, value, `${label} ${o.of}`);
        for (const p of o.positions ?? []) {
          for (const g of p.declarations) for (const [prop, value] of Object.entries(g.set)) fn(prop, value, `${label} ${o.of}@${p.name}`);
        }
      }
      continue;
    }
    for (const g of r.declarations ?? []) for (const [prop, value] of Object.entries(g.set)) fn(prop, value, label);
  }
}

const terms = (value) => (Array.isArray(value) ? value : [value]);

/* ============================================================
   SELECTOR ARITHMETIC — the one place either pipeline is allowed to build a
   selector out of pieces, so the two cannot arrive at different answers.

   A part is one of three shapes. It has a `selector` of its own — `.chips`,
   `.source__link` — or it is SCOPED: `within` NAMES the ancestor rule and the
   target is a path of bare tag names or one class under it. `link-grid` and
   `case-body` are the blocks that forced the scoped form, and neither of them
   could have been written the first way: their children have no classes, and
   case-body's deliberately never will, because its prose is compiled from
   markdown under content/ and a class per element would put styling inside the
   content pipeline.

   The reason this is not the wedge PATTERNS.md refuses is that both halves are
   closed. `within` is checked to be a rule this definition declares ABOVE the
   part, so the set of ancestors is finite and written down in the same file;
   `element` is an array of tag names and the emitter supplies the combinator,
   so a descendant is the ONLY relation expressible. `.case-body p strong` is
   sayable. `.band > .rail--l` is not, and no combination of these keys makes
   it so.

   `within` NAMES A RULE RATHER THAN QUOTING ITS SELECTOR, and that is what the
   ordered list bought: `.ph:has(img) .ph__label` and `.drawer[data-open]
   .drawer__sheet` are scoped to a STATE, which owns no selector of its own for
   an author to quote, so the old key could not have reached them.

   POSITION is a third piece and a closed enum, not a selector: `first` is
   `:first-child`, and the vocabulary grows one member at a time with the block
   that needs it. A state's suffix appends after all of this, exactly as it does
   on a root — `.link-grid a:hover` is the state of a scoped part.
   ============================================================ */

/** The whole positional vocabulary; see the schema's `position`. A member is
 *  minted by the block that needs it — `first` by case-body, `last` by entry
 *  and fact — and the enum in the schema is kept in step with this object. */
export const POSITION_SUFFIX = { first: ":first-child", last: ":last-child" };

/** A part's selector. The loader resolves a scoped part's once, so both
 *  emitters read one string rather than each joining the pieces — the
 *  combinator is supplied THERE and never by an author, in every shape. */
export const partSelector = (part) => part.selector;

/** A state's selector: one suffix, or a selector LIST when it carries several. */
export const stateSelector = (owner, suffix) =>
  (Array.isArray(suffix) ? suffix : [suffix]).map((s) => `${owner}${s}`).join(", ");

/** Every selector a definition declares, by the NAME that refers to it —
 *  `base`, `solid`, `span`. One vocabulary, shared by the error messages, by a
 *  scoped part's `within`, by a state's and a position's `of`, and by an `at`
 *  override's. Built by walking the list forwards, which is also what makes a
 *  forward reference unresolvable rather than merely discouraged. */
export function selectorsByName(def) {
  /* `base` is the root, declared or not: case-body styles nothing on
     `.case-body` and scopes seven parts within it. */
  const out = new Map([["base", def.root]]);
  for (const r of def.rules ?? []) {
    if (r.kind === "base") continue;
    else if (r.kind === "variant" || r.kind === "size") out.set(r.name, r.selector);
    else if (r.kind === "part") {
      out.set(
        r.name,
        r.selector ?? `${out.get(r.within)} ${r.element ? r.element.join(" ") : r.class}${r.pseudo ?? ""}`
      );
    } else if (r.kind === "state") out.set(r.name, stateSelector(out.get(r.of), r.suffix));
    else if (r.kind === "position") out.set(r.name, `${out.get(r.of)}${POSITION_SUFFIX[r.at]}`);
  }
  return out;
}

/** The selector a reference names. Throws only where the loader has already
 *  refused the document, so a caller never sees an undefined selector. */
export const selectorOf = (def, name) => {
  const sel = selectorsByName(def).get(name);
  if (!sel) throw new Error(`${definitionPath(def.id)}: a reference names \`${name}\`, which this definition does not declare`);
  return sel;
};

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

  /* THE PRE-MIGRATION SHAPE IS NAMED RATHER THAN MERELY REJECTED. `base` and
     `parts` were top-level sections until the rules became one ordered list,
     and the schema's verdict on a file still written that way — "missing
     `rules`, unknown property `base`" — is true and tells a reader nothing
     about what happened. It also has a live source: ../../scripts/new-component.mjs
     scaffolds the old shape, and that file is outside this directory's
     ownership, so this message is what a scaffolded component gets until it is
     updated. A gate that knows why it failed should say so. */
  if (!def.rules && ["base", "variants", "sizes", "parts", "at"].some((k) => k in def)) {
    return {
      def: null,
      errors: [
        `${rel} is written in the pre-migration shape — the top-level sections ` +
          `${["base", "variants", "sizes", "parts", "at"].filter((k) => k in def).map((k) => `\`${k}\``).join(", ")} ` +
          `became ONE ordered \`rules\` list, each entry tagged by \`kind\` and naming the rules it depends on. See the ` +
          `\`rules\` $doc in ${SCHEMA_PATH} for the shape and for the two blocks that forced it.\n` +
          `      If this file was just scaffolded, ../../scripts/new-component.mjs still writes the old shape and is the ` +
          `thing to fix: its \`base: { declarations: […] }\` is now \`rules: [{ kind: "base", declarations: […] }]\`.`,
      ],
    };
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
  /* A REJECTED RULE IS RE-REPORTED AGAINST THE ONE FORM ITS `kind` CLAIMS.
     `rules` is a discriminated union, so a `part` with a stray `suffix` fails
     all seven branches and validate-json says exactly that: "matches none of
     the 7 permitted forms". That is deliberate over there — a branch's own
     errors are noise when the reader meant a different branch — and it is the
     wrong answer here, because `kind` says which branch was meant. So the
     union's verdict is replaced by the errors of the named form, resolved
     through the same $defs so nothing is re-implemented. Doing this in the
     LOADER rather than teaching validate-json `if`/`then` keeps the closed
     keyword list closed: the discrimination is a fact about this document,
     not a gap in the validator. */
  if (shape.length) {
    const detailed = shape.flatMap((e) => {
      const at = /^rules\[(\d+)\]$/.exec(e.path);
      const form = at && RULE_FORM[def.rules?.[Number(at[1])]?.kind];
      if (e.keyword !== "oneOf" || !form) return [e];
      const sub = validate({ $defs: schema().$defs, $ref: `#/$defs/${form}` }, def.rules[Number(at[1])], e.path);
      return sub.length ? sub : [e];
    });
    return { def: null, errors: formatErrors(detailed, rel) };
  }

  /* ---- 2. what the schema cannot see ---- */
  const errors = [];
  const bad = (msg) => errors.push(`${rel}: ${msg}`);

  if (def.id !== id) bad(`its \`id\` is ${JSON.stringify(def.id)}, and it sits in components/${id}/`);

  /* Bindings resolve — including the ones INSIDE a computed expression, which
     is the whole reason an expr interpolates a name instead of writing var(). */
  const known = tokenNames();
  eachDeclaration(def, (prop, value, where) => {
    for (const t of terms(value)) {
      if (t === null || typeof t !== "object") continue;
      if (isExpr(t)) {
        const refs = exprTokens(t.expr);
        if (!refs.length) {
          bad(
            `\`${where}\` writes \`${prop}: {"expr": "${t.expr}"}\` with no \`{token}\` reference in it. An expr exists to keep a ` +
              `BINDING visible inside computed geometry; a computed value with nothing bound is a structural literal, and should be ` +
              `written as the plain string it is`
          );
        }
        if (/var\s*\(/.test(t.expr)) {
          bad(
            `\`${where}\` writes \`var(\` inside \`${prop}: {"expr": "${t.expr}"}\`. Inside an expr a token is written \`{name}\` and ` +
              `resolved by the emitter — that is the entire point of the key, because a hand-written var() is a binding this build ` +
              `cannot check and the token census cannot count`
          );
        }
        for (const name of refs) {
          if (!known.has(name)) {
            bad(`\`${where}\` interpolates \`{${name}}\` into \`${prop}\`, and tokens.json defines no such token — it would emit \`var(--${name})\` and render nothing`);
          }
        }
        continue;
      }
      if (!known.has(t.token)) {
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

  /* ---- the list is a namespace, and every reference is backwards ----
     A name is the handle `of`, `within` and an alias use, so two rules sharing
     one would make a reference ambiguous rather than merely confusing; and a
     name may only point at a rule ABOVE the one using it, because a stylesheet
     reads downwards and a rule cannot be scoped to a selector that does not
     exist yet. Both were free when the rules were sections — a section is a
     namespace and a fixed cascade is an order — and both have to be checked now
     that neither is. */
  /* `base` is seeded, and BEFORE the list rather than at the base rule's index,
     because it names the ROOT — which is a fact about the component whether or
     not the component styles it. `case-body` is the proof: it has no base rule
     at all and every one of its parts is still scoped within `.case-body`. */
  const declaredAt = new Map([["base", -1]]);
  const bases = (def.rules ?? []).filter((r) => r.kind === "base");
  if (bases.length > 1) {
    bad(`it declares ${bases.length} \`base\` rules, and a component has one root. Everything else is a variant, a size or a part`);
  }
  (def.rules ?? []).forEach((r, i) => {
    if (r.kind === "base") return;
    const name = r.name;
    if (name === undefined) return; /* an `at` block names nothing and is named by nothing */
    if (name === "base") {
      bad(`rules[${i}] is called \`base\`, which is the reserved name of the root — every \`of\` and \`within\` naming \`base\` means \`${def.root}\``);
      return;
    }
    if (declaredAt.has(name)) {
      bad(
        `two rules are called \`${name}\` — rules[${declaredAt.get(name)}] and rules[${i}]. A name is the handle every ` +
          `\`of\` and \`within\` uses, so it is unique across the whole list; button's two hover states are \`hover\` and ` +
          `\`solid-hover\` for exactly this reason, and a state's name reaches no artefact, so renaming one is free`
      );
      return;
    }
    declaredAt.set(name, i);
  });

  /** Every reference in the document: who refers, to what, from where. */
  const references = [];
  (def.rules ?? []).forEach((r, i) => {
    if (r.kind === "part" && r.within !== undefined) references.push([i, r.within, `\`${r.name}\` is scoped \`within\``]);
    if (r.kind === "state" || r.kind === "position") references.push([i, r.of, `\`${r.name}\` is a ${r.kind} \`of\``]);
    if ((r.kind === "variant" || r.kind === "size") && r.aliases) references.push([i, r.aliases.of, `\`${r.name}\` aliases`]);
    if (r.kind === "at") for (const o of r.rules) references.push([i, o.of, `an \`at ${r.condition}\` override names`]);
  });
  for (const [i, name, who] of references) {
    const at = declaredAt.get(name);
    if (at === undefined) {
      bad(
        `${who} \`${name}\`, and this definition declares no such rule. A reference is a NAME rather than a selector ` +
          `so that a renamed rule cannot leave an orphan pointing at an element that is gone — the names here are ` +
          `${[...declaredAt.keys()].map((n) => `\`${n}\``).join(", ")}`
      );
    } else if (at >= i) {
      bad(
        `${who} \`${name}\`, which rules[${i}] declares ${at === i ? "itself" : `later, at rules[${at}]`}. A reference ` +
          `points BACKWARDS only: a stylesheet reads downwards, and the rule being named has to have a selector by the ` +
          `time the one naming it is emitted`
      );
    }
  }
  if (errors.length) return { def: null, errors };

  /* From here the graph resolves, so every selector can be built once. */
  const selectors = selectorsByName(def);

  /* A modifier's selector is its root plus its name — stated in the file so the
     CSS is transcribed rather than assembled, and checked so the two agree. A
     scoped part's is BUILT, from a name and a target, which is the difference
     between a rule this component owns and a relation it declares. */
  const seen = new Map([[def.root, "root"]]);
  for (const r of def.rules) {
    if (r.kind === "variant" || r.kind === "size") {
      const want = `${def.root}--${r.name}`;
      if (r.selector !== want) bad(`\`${r.name}\` has the selector \`${r.selector}\`, and a ${r.kind} of \`${def.root}\` named \`${r.name}\` is \`${want}\``);
    }
    if (r.kind === "part" && r.within !== undefined) {
      /* A state whose suffix is a selector LIST has no single selector to
         descend from, so it cannot host a scoped part. The block that needs one
         is the block that decides what `.a:hover, .a:focus-visible .x` means. */
      const host = def.rules[declaredAt.get(r.within)];
      if (host?.kind === "state" && Array.isArray(host.suffix)) {
        bad(
          `\`${r.name}\` is scoped \`within\` \`${r.within}\`, a state whose \`suffix\` is a selector LIST. A list is two ` +
            `selectors, so a descendant of it is two rules or one with a comma in the middle, and neither is a choice ` +
            `this emitter may make. Split the state, or add the shape in the commit that needs it`
        );
      }
    }
    if (!["base", "variant", "size", "part"].includes(r.kind)) continue;
    const sel = r.kind === "base" ? def.root : selectors.get(r.name);
    if (r.kind !== "base" && seen.has(sel)) bad(`\`${sel}\` is declared twice — by \`${seen.get(sel)}\` and by \`${r.name}\``);
    seen.set(sel, r.kind === "base" ? "base" : r.name);
  }

  /* An `at` block names a condition tokens.json declares — a cross-reference a
     schema cannot follow, and the whole reason the key is a name rather than a
     string. An INLINE one is refused if it could not render on one line: the
     inline shape is not a formatting preference, it is what section-head,
     ask-fab and media actually write, and this migration transcribes rather
     than reformats. A query that needs a paragraph does not carry the key. */
  for (const block of def.rules.filter((r) => r.kind === "at")) {
    if (!conditionNames().has(block.condition)) {
      bad(
        `its \`at\` block names the condition \`${block.condition}\`, and tokens.json's \`$conditions\` has no such ` +
          `entry. A breakpoint is a literal, and this system has exactly one file where a literal may be written — ` +
          `add it there, with a description, beside the ones that already exist`
      );
    }
    if (!block.inline) continue;
    const groups = block.rules[0]?.declarations ?? [];
    const why =
      block.rules.length !== 1 ? `${block.rules.length} overrides`
      : block.rules[0].positions ? "a position"
      : groups.length !== 1 ? `${groups.length} declaration groups`
      : groups[0].note || groups[0].aside ? "a comment"
      : block.note ? "a note"
      : block.break ? "a break"
      : null;
    if (why) {
      bad(
        `its \`at ${block.condition}\` is \`inline\` and carries ${why}. The inline form renders on ONE line — ` +
          `\`@media … { .sel { … } }\` — because that is how the stylesheet writes it, so it is one override, one group ` +
          `and no ornament. Drop \`inline\` and it renders as a block; the emitter will not choose between two ` +
          `renderings of the same data`
      );
    }
  }

  /* ---- 3. the derived view ----
     The list is the source and stays the source; this is a QUERY over it, for
     the two consumers that want a set rather than a sequence. scripts/
     emit-react.mjs needs the variants of an axis (a cva branch list has no
     order to have), and scripts/contract-diff.mjs needs each rule with its
     states and positions gathered (the snapshot is keyed by selector). Neither
     of those questions is about where a rule sits, which is exactly why the
     answer is computed here rather than being a second thing the file says. */
  const byName = new Map();
  def.variants = [];
  def.sizes = [];
  def.parts = [];
  def.at = [];
  for (const r of def.rules) {
    switch (r.kind) {
      case "base":
        def.base = r;
        byName.set("base", r);
        break;
      case "variant":
      case "size":
        (r.kind === "variant" ? def.variants : def.sizes).push(r);
        byName.set(r.name, r);
        break;
      case "part":
        /* A scoped part's selector is resolved ONCE, here, so both emitters and
           the contract read one string rather than each joining the pieces. */
        r.selector = selectors.get(r.name);
        def.parts.push(r);
        byName.set(r.name, r);
        break;
      /* A state or a position GATHERS UNDER the rule it hangs off, which is the
         shape both other consumers ask for — and that is a narrower demand than
         a selector: `.btn:hover:last-child` resolves perfectly well and would
         be a position gathered under a state, which contract-diff walks past
         and would therefore drop from the published contract. So the owner has
         to be a rule with a body of its own, and the block that writes a
         position of a state is the block that decides what the contract calls
         it. A state IS still nameable — an alias names one — just not owned. */
      case "state":
      case "position": {
        const owner = byName.get(r.of);
        if (!["base", "variant", "size", "part"].includes(owner?.kind)) {
          bad(
            `\`${r.name}\` is a ${r.kind} \`of\` \`${r.of}\`, which is ${owner ? `a ${owner.kind}` : "the root and not a rule"} ` +
              `and so has no rule of its own for it to hang off. Both other emitters read a state and a position through ` +
              `their owner, so the owner is a base, a variant, a size or a part${r.of === "base" ? " — and this definition declares no `base` rule above it" : ""}`
          );
          break;
        }
        (owner[r.kind === "state" ? "states" : "positions"] ??= []).push(r);
        byName.set(r.name, r);
        break;
      }
      case "at":
        /* An INLINE at is a footnote on one rule, which is how both other
           consumers already see it: a `{condition, declarations}` hanging off
           its owner. A block one is a paragraph of overrides and stays one. */
        if (r.inline) (byName.get(r.rules[0].of).at ??= []).push({ condition: r.condition, $doc: r.$doc, declarations: r.rules[0].declarations });
        else def.at.push(r);
        break;
    }
  }
  for (const key of ["variants", "sizes", "parts", "at"]) if (!def[key].length) delete def[key];

  /* A definition renders a banner and whatever is under it. With `base` optional
     since case-body, "whatever" can be nothing at all — which is a block that
     claims a component and styles none of it. */
  if (!def.base && !def.parts?.length) {
    bad(
      `it declares neither a \`base\` rule nor a \`part\`, so it would render a banner with no rule under it. \`base\` is ` +
        `optional because case-body's root is a scope rather than an appearance, not because a definition may be empty`
    );
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

  /* ---- 4. resolve aliases, so neither emitter has to know about them ---- */
  for (const m of [...(def.variants ?? []), ...(def.sizes ?? [])]) {
    if (!m.aliases) continue;
    const source = byName.get(m.aliases.of);
    if (!source?.declarations) {
      bad(`\`${m.name}\` aliases \`${m.aliases.of}\`, which declares nothing of its own to be identical to`);
      continue;
    }
    /* A deep copy, because the two rules are now one statement and an emitter
       must not be able to mutate one of them into disagreeing with the other. */
    m.declarations = JSON.parse(JSON.stringify(source.declarations));
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
  if (isExpr(v)) return exprCss(v.expr);
  if (v && typeof v === "object" && typeof v.token === "string") return `var(--${v.token})`;
  throw new Error(
    `${where}: a declaration value must be a string (a structural literal), {"token":"name"} (a token ` +
      `binding), {"expr":"calc({token} …)"} (computed geometry) or an array of those — got ${JSON.stringify(v)}`
  );
}

/** One rule. One declaration group → one line; more than one → a block.
 *  `pad` is the rule's own indent — everything inside an `@media` block is one
 *  level in, and a rule that did not know that would have to be re-indented by
 *  the caller, which is a string edit over generated CSS. */
function rule(selector, declarations, where, pad = "") {
  const groups = (declarations ?? []).map((g, i) => {
    if (!g?.set || typeof g.set !== "object") throw new Error(`${where}: group ${i} of \`${selector}\` has no \`set\``);
    return {
      note: Array.isArray(g.note) && g.note.length ? g.note : null,
      aside: typeof g.aside === "string" && g.aside ? g.aside : null,
      text: Object.entries(g.set).map(([p, v]) => `${p}: ${value(v, `${where} → ${selector} { ${p} }`)};`).join(" "),
    };
  });
  if (!groups.length) throw new Error(`${where}: \`${selector}\` declares nothing`);
  if (groups.length === 1 && !groups[0].note && !groups[0].aside) return `${pad}${selector} { ${groups[0].text} }\n`;
  let out = `${pad}${selector} {\n`;
  for (const g of groups) {
    if (g.note) out += comment(g.note, `${pad}  `);
    out += `${pad}  ${g.text}${g.aside ? ` /* ${g.aside} */` : ""}\n`;
  }
  return `${out}${pad}}\n`;
}

/** The banner, whose first line carries the `@component <id>` marker build.mjs reads. */
function banner(def) {
  const head = `/* ${BAR} ${def.block.title} ${BAR} @component ${def.id}`;
  const note = def.block.note ?? [];
  /* An empty line stays empty — a paragraph break is a blank line, not three spaces. */
  return note.length ? `${head}\n${note.map((l) => (l === "" ? "" : `   ${l}`)).join("\n")} */\n` : `${head} */\n`;
}

/** A whole block: the banner, then every rule in the order the list gives them.
 *  THE ORDER IS THE FILE'S, NOT THIS FUNCTION'S, and that is the change `media`
 *  and `profile` forced — a fixed cascade (base, variants, sizes, parts, foot)
 *  cannot say `.ph:has(img)` four rules after `.ph` or
 *  `.profile > div:nth-child(odd)` after every part, and both of those are the
 *  stylesheet grouping its rules by topic rather than by kind. Source order IS
 *  the cascade, so an emitter that re-sorted was asserting something the file
 *  had not said. Every selector here is resolved from a NAME the list declares
 *  earlier, so a rule cannot end up pointing at an element another rule does not. */
export function renderBlock(def, conditions = {}) {
  const where = definitionPath(def.id);
  const selectors = selectorsByName(def);
  const sel = (name) => selectors.get(name);
  const positions = (owner, list, pad) =>
    (list ?? []).map((p) => rule(`${owner}${POSITION_SUFFIX[p.at]}`, p.declarations, where, pad)).join("");
  /* A rule's own note sits above it at column 0; a group's note sits inside the
     braces. The stylesheet draws that line and this only records it. */
  const lead = (r, pad) => (r.note?.length ? comment(r.note, pad) : "");

  let out = banner(def);
  for (const r of def.rules) {
    switch (r.kind) {
      /* `base` is optional: case-body's root is a scope with no appearance of
         its own, and `.case-body { }` would claim a rule the file has not got. */
      case "base":
        out += lead(r, "");
        out += rule(def.root, r.declarations, where);
        break;
      /* A modifier that declares nothing emits nothing. `.sec--tint { }` would
         claim an appearance the stylesheet has not got — the same refusal
         `base` being optional records — and the tint's whole effect is the
         scoped part `.sec--tint .well`, which is a rule further down the list. */
      case "variant":
      case "size":
        if (r.declarations) out += rule(r.selector, r.declarations, where);
        break;
      case "part":
        if (r.break) out += "\n";
        out += lead(r, "");
        out += rule(r.selector ?? sel(r.name), r.declarations, where);
        break;
      case "state":
        out += rule(stateSelector(sel(r.of), r.suffix), r.declarations, where);
        break;
      case "position":
        out += rule(`${sel(r.of)}${POSITION_SUFFIX[r.at]}`, r.declarations, where);
        break;
      /* An INLINE at renders on one line, because that is how the stylesheet
         writes a footnote on one rule. The loader has already refused anything
         that would not fit, so this only unwraps a single-line rule. */
      case "at":
        if (r.inline) {
          out += `@media ${conditions[r.condition]} { ${rule(sel(r.rules[0].of), r.rules[0].declarations, where).trimEnd()} }\n`;
          break;
        }
        if (r.break) out += "\n";
        out += lead(r, "");
        out += `@media ${conditions[r.condition]} {\n`;
        for (const o of r.rules) {
          const owner = sel(o.of);
          if (o.declarations) out += rule(owner, o.declarations, where, "  ");
          out += positions(owner, o.positions, "  ");
        }
        out += `}\n`;
        break;
    }
  }
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

/** Which file a generated region comes from. A component comes from its own
 *  definition; the typography layer comes from the levels table, which is not a
 *  component and does not pretend to be one. */
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
  const conditions = Object.fromEntries(conditionValues());
  for (const def of defs ?? loadAll().defs) {
    try {
      rendered.set(def.id, renderBlock(def, conditions));
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
