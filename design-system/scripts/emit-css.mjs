#!/usr/bin/env node
/* ============================================================
   THE COMPONENT-CSS EMITTER — definition.json → a block of components.css.
   Zero dependencies, like everything else in this directory.

   `node scripts/emit-css.mjs`          splice the generated regions into
                                        css/components.css and write it
   `node scripts/emit-css.mjs --check`  render and compare, write nothing
                                        (the same comparison build.mjs runs)
   `node scripts/emit-css.mjs --validate <path>`
                                        run the loader over ONE definition
                                        document, wherever it sits. For a
                                        caller outside this directory that has
                                        a definition but no component yet — see
                                        the flag's own note at the foot.

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
     at             { condition, rules: [{ of, declarations }] } — a
                    set of overrides under one NAMED condition, each naming the
                    rule it overrides rather than repeating its selector. An
                    override may name a POSITION, which is why it no longer
                    carries positions of its own: `.fact:last-child` inside a
                    query used to be a clause nested in the override of `.fact`,
                    and in an ordered list it is a rule with a name, so
                    `{"of": "closing"}` says it with the same reference every
                    other rule uses.
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
                    note, no break. NEVER INFERRED — a foot query
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
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { validate, formatErrors } from "./validate-json.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

/** The pilot. Every id here MUST have a definition.json, and its CSS block in
 *  css/components.css MUST be a generated region. Both are gated in build.mjs. */
export const PILOT = ["button", "chip", "stat", "footer", "source", "link-grid", "case-body", "fact", "entry", "section-head", "media", "profile", "ask-fab", "definition-row", "nav"];

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
/* SPACED IS RHYTHM, AND IT WAS RE-DERIVED WHEN THE FIRST BLOCK WITH A FIXED
   POSITION ASKED. `ask-fab` is that block, and it failed this guard three
   times over — which was worth taking seriously rather than routing round,
   because the guard is the one rule here that check-css.mjs does NOT also
   enforce in CSS. Colour, font-size, weight, tracking and width are refused on
   both sides, so this list only closes a door the stylesheet gate already
   watches. Spacing is refused HERE and nowhere else, which means an authored
   block may write a literal its transcription may not — and the block that
   trips over that does not become cleaner, it stays authored. A rule whose only
   effect is to keep blocks out of the format it is defending is the wrong rule.

   So the question was the one PATTERNS.md keeps arriving at: not whether the
   feature is present, but whether the vocabulary is finite. Two answers, each
   forced by a real declaration:

   PLACEMENT IS NOT RHYTHM, so `top` / `right` / `bottom` / `left` / `inset`
   left the set. `--space-*`'s own $doc scopes the ramp to space INSIDE a
   component and space BETWEEN things; where a positioned element sits is
   neither. The file agrees and always has — the eight placement declarations in
   components.css are `inset: 0` (×4), `.peek`'s `top: 0; left: 0`, `.bar`'s
   `top: 1rem; left: 0; right: 0`, `.theme`'s `top: 50%` and
   `left: calc(100% + 0.75rem)`, and `.ask-fab`'s `bottom: 1rem; right: 1rem`.
   ONE of them binds a token: `.card__more`'s `right: var(--pad); bottom:
   var(--space-3)`, and it is the one that is inside a card rather than against
   the viewport. A guard demanding a rhythm step for `top: 50%` was not
   enforcing a decision this system had made.

   A PX BELOW THE RAMP'S FIRST STEP IS STRUCTURE, not a step, and cannot become
   one. The ramp is rem and starts at `space-1`; 1px, 2px and 3px are hairlines
   and rims, which is the same argument the `0` exemption already makes out loud
   ("zero is not a step") and the same one PATTERNS.md makes for the 2px inside
   section-head's `expr` — a border width is structure and has no tier to come
   from. ask-fab's `padding: 2px var(--space-4) 2px 2px` is the pill's rim, its
   own spec.md says so in as many words, and the right-hand side keeps a real
   step in the same declaration. THE BOUND IS READ FROM tokens.json rather than
   written here, so it moves with the ramp instead of pinning a number this file
   would have no way to justify. */
const SPACED = new Set(["padding", "margin", "gap", "row-gap", "column-gap"]);
/** The ramp's first step in px — the line under which a literal is a rim.
 *  `space-1` and nothing else: the fixed ramp's floor is the smallest thing the
 *  ramp can say, so a value below it is one the ramp could not have said. */
let rampFloorCache = null;
function rampFloorPx() {
  if (rampFloorCache !== null) return rampFloorCache;
  const tokens = JSON.parse(readFileSync(join(root, "tokens", "tokens.json"), "utf8"));
  const first = tokens.space?.["space-1"];
  const m = typeof first === "string" ? /^([\d.]+)rem$/.exec(first) : null;
  if (!m) {
    throw new Error(
      `scripts/emit-css.mjs cannot read \`space.space-1\` from tokens/tokens.json as a rem value (got ${JSON.stringify(first)}). ` +
        `The spacing guard's floor is derived from the ramp's first step; if the ramp changed units, re-derive it there rather ` +
        `than pinning a number here.`
    );
  }
  rampFloorCache = Number(m[1]) * 16;
  return rampFloorCache;
}
/** `2px` under a 4px floor → a rim. Anything in rem is speaking the ramp's own
 *  unit and gets no exemption, whatever its size. */
const isRim = (t) => {
  const m = /^(-?[\d.]+)px$/.exec(t.trim());
  return m !== null && Math.abs(Number(m[1])) < rampFloorPx();
};
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
  contains: "rule-contains",
  position: "rule-position",
  at: "rule-at",
  keyframes: "rule-keyframes",
};

/** What the build calls a rule when it reports one: its name, and `base` for
 *  the root's own. One vocabulary — the same names `of` and `within` use. */
const labelOf = (r) => (r.kind === "base" ? "base" : r.kind === "at" ? `at ${r.condition}` : r.kind === "keyframes" ? `keyframes ${r.name}` : r.name);

/** The entries of an `at` block, told apart. An OVERRIDE restates a rule
 *  declared outside the query; a DECLARED rule exists only inside it and is the
 *  ordinary vocabulary nested one level, so `kind` is the discriminant. */
export const isDeclared = (entry) => typeof entry.kind === "string";

/** Walk every declaration in a definition: `fn(prop, value, where)`. Every
 *  declaration, including the ones under a media query and the ones inside a
 *  keyframe — a door the literal guard and the binding check do not watch is the
 *  door a raw value walks in. */
function eachDeclaration(def, fn) {
  const groups = (list, where) => {
    for (const g of list ?? []) for (const [prop, value] of Object.entries(g.set)) fn(prop, value, where);
  };
  for (const r of def.rules ?? []) {
    const label = labelOf(r);
    if (r.kind === "at") {
      for (const o of r.rules) groups(o.declarations, `${label} ${isDeclared(o) ? o.name : o.of}`);
      continue;
    }
    if (r.kind === "keyframes") {
      for (const s of r.steps) groups(s.declarations, `${label} ${s.at}`);
      continue;
    }
    groups(r.declarations, label);
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
export const POSITION_SUFFIX = { first: ":first-child", last: ":last-child", odd: ":nth-child(odd)" };

/** What a `contains` rule looks for, as a selector: one bare tag or one class.
 *  Both halves are closed, which is why `:has()` is a member of this vocabulary
 *  and not a door into arbitrary relational CSS. */
export const containsArg = (r) => r.element ?? r.class;

/** A part's selector. The loader resolves a scoped part's once, so both
 *  emitters read one string rather than each joining the pieces — the
 *  combinator is supplied THERE and never by an author, in every shape. */
export const partSelector = (part) => part.selector;

/** A state's selector: one suffix, or a selector LIST when it carries several.
 *  `wrap` puts the list one selector per line, which is a fact about the
 *  stylesheet's text and not this function's opinion — see the schema. */
export const stateSelector = (owner, suffix, wrap = false) =>
  (Array.isArray(suffix) ? suffix : [suffix]).map((s) => `${owner}${s}`).join(wrap ? ",\n" : ", ");

/** Every selector a definition declares, by the NAME that refers to it —
 *  `base`, `solid`, `span`. One vocabulary, shared by the error messages, by a
 *  scoped part's `within`, by a state's and a position's `of`, and by an `at`
 *  override's. Built by walking the list forwards, which is also what makes a
 *  forward reference unresolvable rather than merely discouraged. */
export function selectorsByName(def) {
  /* `base` is the root, declared or not: case-body styles nothing on
     `.case-body` and scopes seven parts within it. */
  const out = new Map([["base", def.root]]);
  const put = (r) => {
    if (r.kind === "base" || r.kind === "at" || r.kind === "keyframes") return;
    else if (r.kind === "variant" || r.kind === "size") out.set(r.name, r.selector);
    else if (r.kind === "part") {
      /* A CHILD combinator reaches a bare tag; everything else is a descendant.
         The two are separate keys so that `> .class` — the one combination this
         format refuses — cannot be assembled out of the pieces. */
      const step = r.child ? `> ${r.child}` : `${r.element ? r.element.join(" ") : r.class}${r.pseudo ?? ""}`;
      out.set(r.name, r.selector ?? `${out.get(r.within)} ${step}`);
    } else if (r.kind === "state") out.set(r.name, stateSelector(out.get(r.of), r.suffix, r.wrap === true));
    else if (r.kind === "contains") out.set(r.name, `${out.get(r.of)}:has(${containsArg(r)})`);
    else if (r.kind === "position") out.set(r.name, `${out.get(r.of)}${POSITION_SUFFIX[r.at]}`);
  };
  /* TWO PASSES, AND THE SECOND IS WHY A QUERY-ONLY RULE MAY POINT FORWARDS.
     Every top-level rule resolves in list order, which is the backwards-only
     rule doing its own work. A rule DECLARED INSIDE an `at` resolves afterwards,
     because the query is a set of modifications rather than a step in the
     cascade — `nav`'s docked paragraph hides `.bar__action[data-ask]` forty
     rules before `.bar__action` is described, and the paragraph is not the
     emitter's to reorder. The loader refuses the two shapes this ordering
     cannot answer for: a top-level rule naming a query-only one, and a
     query-only rule naming one declared after it. */
  for (const r of def.rules ?? []) put(r);
  for (const r of def.rules ?? []) {
    if (r.kind !== "at") continue;
    for (const entry of r.rules) if (isDeclared(entry)) put(entry);
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
  return checkDefinition(def, id, rel);
}

/**
 * Everything `loadDefinition` does once the bytes are a document: the schema,
 * then the checks a schema structurally cannot make. Split out from the read so
 * that a definition which is not (yet) a file in components/<id>/ can be held to
 * exactly the same standard — `--validate` below is the one caller that needs
 * that, and it exists because test/scaffold.test.js has to prove the scaffold
 * emits a definition this loader accepts. Sharing the function is the point: a
 * second implementation of "is this valid" would agree with the wrong one.
 *
 * @param {object} def parsed definition document
 * @param {string} id the directory name it must claim
 * @param {string} rel what to call it in messages
 * @returns {{def: object|null, errors: string[]}}
 */
export function checkDefinition(def, id, rel) {
  /* THE PRE-MIGRATION SHAPE IS NAMED RATHER THAN MERELY REJECTED. `base` and
     `parts` were top-level sections until the rules became one ordered list,
     and the schema's verdict on a file still written that way — "missing
     `rules`, unknown property `base`" — is true and tells a reader nothing
     about what happened. ../../scripts/new-component.mjs scaffolded exactly that
     shape for one release, and no gate caught it, which is why the message names
     the migration rather than the keys: a gate that knows why it failed should
     say so, and this one is now also asserted from the scaffold's own test. */
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
      } else if (SPACED.has(prop) && t.trim() !== "0" && !isRim(t)) {
        bad(
          `\`${where}\` writes \`${t}\` on \`${prop}\` as a structural literal. Every rhythm step is a --space-* token; the two ` +
            `literals this allows are \`0\`, because zero is not a step, and a px under ${rampFloorPx()}px, because the ramp starts ` +
            `at \`space-1\` and a rim below its first step is structure the ramp could not have said`
        );
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
  /* THE RESOLUTION ORDER, and it is the list's own except for one step. Every
     top-level rule resolves where it sits; every rule DECLARED INSIDE an `at`
     resolves after all of them, in the order the queries write them. That is
     what lets `nav`'s docked paragraph hide `.bar__action[data-ask]` before
     `.bar__action` is described — a query is a set of modifications, not a step
     in the cascade — and the two shapes it cannot answer for are refused below:
     a top-level rule naming a query-only one, and a query-only rule naming one
     declared after it. Order is checked for acyclicity, not for tidiness. */
  const declaredAt = new Map([["base", { i: -1, order: -1, inAt: false }]]);
  const bases = (def.rules ?? []).filter((r) => r.kind === "base");
  if (bases.length > 1) {
    bad(`it declares ${bases.length} \`base\` rules, and a component has one root. Everything else is a variant, a size or a part`);
  }
  const declare = (r, i, order, inAt, where) => {
    const name = r.name;
    if (name === undefined) return; /* an `at` block names nothing and is named by nothing */
    if (name === "base") {
      bad(`${where} is called \`base\`, which is the reserved name of the root — every \`of\` and \`within\` naming \`base\` means \`${def.root}\``);
      return;
    }
    if (declaredAt.has(name)) {
      bad(
        `two rules are called \`${name}\` — rules[${declaredAt.get(name).i}] and ${where}. A name is the handle every ` +
          `\`of\` and \`within\` uses, so it is unique across the whole list; button's two hover states are \`hover\` and ` +
          `\`solid-hover\` for exactly this reason, and a state's name reaches no artefact, so renaming one is free`
      );
      return;
    }
    declaredAt.set(name, { i, order, inAt, rule: r });
  };
  (def.rules ?? []).forEach((r, i) => {
    if (r.kind === "base") return;
    declare(r, i, i, false, `rules[${i}]`);
  });
  let tail = (def.rules ?? []).length;
  (def.rules ?? []).forEach((r, i) => {
    if (r.kind !== "at") return;
    r.rules.forEach((entry, k) => {
      if (isDeclared(entry)) declare(entry, i, tail++, true, `rules[${i}].rules[${k}]`);
    });
  });

  /** Every reference in the document: who refers, to what, from where. */
  const references = [];
  const refsOf = (r, order, inAt, label) => {
    if (r.kind === "part" && r.within !== undefined) references.push([order, inAt, r.within, `${label} is scoped \`within\``]);
    if (r.kind === "state" || r.kind === "position" || r.kind === "contains") references.push([order, inAt, r.of, `${label} is a ${r.kind} \`of\``]);
    if ((r.kind === "variant" || r.kind === "size") && r.aliases) references.push([order, inAt, r.aliases.of, `${label} aliases`]);
  };
  (def.rules ?? []).forEach((r, i) => {
    if (r.kind === "at") {
      for (const entry of r.rules) {
        /* An override's order is unconstrained — it restates a rule, and the
           query may sit anywhere relative to the rule it modifies. What it
           still cannot do is name something this definition never declares. */
        if (!isDeclared(entry)) references.push([Infinity, true, entry.of, `an \`at ${r.condition}\` override names`]);
      }
      return;
    }
    refsOf(r, i, false, `\`${r.name}\``);
  });
  (def.rules ?? []).forEach((r) => {
    if (r.kind !== "at") return;
    for (const entry of r.rules) {
      if (!isDeclared(entry)) continue;
      const me = declaredAt.get(entry.name);
      refsOf(entry, me?.order ?? Infinity, true, `\`${entry.name}\`, declared under \`at ${r.condition}\`,`);
    }
  });
  for (const [order, inAt, name, who] of references) {
    const at = declaredAt.get(name);
    if (at === undefined) {
      bad(
        `${who} \`${name}\`, and this definition declares no such rule. A reference is a NAME rather than a selector ` +
          `so that a renamed rule cannot leave an orphan pointing at an element that is gone — the names here are ` +
          `${[...declaredAt.keys()].map((n) => `\`${n}\``).join(", ")}`
      );
    } else if (at.inAt && !inAt) {
      bad(
        `${who} \`${name}\`, which is declared INSIDE an \`at\` block. A query-only rule exists only under its ` +
          `condition, so a rule outside the query cannot be scoped to it — the reference would resolve to a selector ` +
          `that is only sometimes written, which is a different statement from the one the stylesheet makes`
      );
    } else if (at.order >= order) {
      bad(
        `${who} \`${name}\`, which is declared ${at.order === order ? "by that same rule" : "later"}. A reference ` +
          `points BACKWARDS: a stylesheet reads downwards, and the rule being named has to have a selector by the ` +
          `time the one naming it is emitted. The one exemption is a reference made from inside an \`at\` block, ` +
          `which resolves against every top-level rule — and this one is not that, or names a query-only rule the ` +
          `queries write after it`
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
  /* Every rule with a name, top-level and query-only alike — the query-only ones
     are the same vocabulary one level in, so every check below reads them. */
  const everyRule = [...def.rules, ...def.rules.filter((r) => r.kind === "at").flatMap((r) => r.rules.filter(isDeclared))];
  for (const r of everyRule) {
    if (r.kind === "variant" || r.kind === "size") {
      const want = `${def.root}--${r.name}`;
      if (r.selector !== want) bad(`\`${r.name}\` has the selector \`${r.selector}\`, and a ${r.kind} of \`${def.root}\` named \`${r.name}\` is \`${want}\``);
    }
    if (r.kind === "state" && r.wrap && !Array.isArray(r.suffix)) {
      bad(
        `\`${r.name}\` is a state with \`wrap\` and a single \`suffix\`. \`wrap\` records that the stylesheet writes the ` +
          `selector LIST one selector per line, and a state with one suffix has no list and nothing to break at`
      );
    }
    if (r.kind === "part" && r.within !== undefined) {
      /* A state whose suffix is a selector LIST has no single selector to
         descend from, so it cannot host a scoped part. The block that needs one
         is the block that decides what `.a:hover, .a:focus-visible .x` means. */
      const host = declaredAt.get(r.within)?.rule;
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
    /* A `note` and a `break` are NOT in this list, and `nav` is why: both render
       outside the line — the note above it at column 0, the break as a blank
       line before that — so refusing them was refusing a shape the one-line rule
       never covered. What is refused is anything that would have to go INSIDE
       the braces, because that is what cannot fit on one line. */
    const why =
      block.rules.length !== 1 ? `${block.rules.length} overrides`
      : groups.length !== 1 ? `${groups.length} declaration groups`
      : groups[0].note || groups[0].aside ? "a comment inside its braces"
      : groups[0].break ? "a paragraph break inside its braces"
      : groups[0].wrap ? "a value the stylesheet writes across lines"
      : null;
    if (why) {
      bad(
        `its \`at ${block.condition}\` is \`inline\` and carries ${why}. The inline form renders on ONE line — ` +
          `\`@media … { .sel { … } }\` — because that is how the stylesheet writes it, so it is one override and one ` +
          `group with nothing inside the braces but the declaration. Drop \`inline\` and it renders as a block; the ` +
          `emitter will not choose between two renderings of the same data`
      );
    }
  }

  /* ---- @keyframes: a name and a set of offsets, both finite ----
     A keyframes name is a GLOBAL CSS identifier rather than a class the
     component owns, so the only thing a definition can honestly claim about one
     is that it animates it. That is checked here; uniqueness ACROSS definitions
     is checked in scripts/build.mjs, which is the only place that sees them all. */
  for (const kf of def.rules.filter((r) => r.kind === "keyframes")) {
    if (kf.inline && (kf.steps.length !== 1 || kf.steps[0].declarations.length !== 1 || kf.steps[0].declarations[0].note || kf.steps[0].declarations[0].aside)) {
      bad(
        `its \`@keyframes ${kf.name}\` is \`inline\` and would not fit on one line. The inline form is one step, one ` +
          `group and no comment — \`@keyframes ${kf.name} { 50% { … } }\` — which is how both blocks that write one write it`
      );
    }
    let animated = false;
    eachDeclaration(def, (prop, v) => {
      if (prop !== "animation" && prop !== "animation-name") return;
      for (const t of terms(v)) if (typeof t === "string" && new RegExp(`(^|\\s)${kf.name}(\\s|$)`).test(t)) animated = true;
    });
    if (!animated) {
      bad(
        `it declares \`@keyframes ${kf.name}\` and no \`animation\` in it names \`${kf.name}\`. A keyframes name is a ` +
          `global CSS identifier, so the closest a definition can come to owning one is using it — an unused ` +
          `\`@keyframes\` is a name published into every consumer's stylesheet on behalf of nobody`
      );
    }
  }

  /* ---- a wrapped declaration is a fact about the text, and it is checked ----
     `wrap` records that the stylesheet breaks a value at its commas. A group
     with no comma to break at would be the key CHOOSING a rendering instead of
     recording one, which is the line every formatting key here is on the right
     side of. */
  for (const r of everyRule) {
    for (const g of r.declarations ?? []) {
      if (!g.wrap) continue;
      const props = Object.entries(g.set);
      if (props.length !== 1) {
        bad(`a \`wrap\`ped group of \`${labelOf(r)}\` sets ${props.length} properties. A wrapped declaration is ONE declaration written across lines; two of them on one wrapped group would be a paragraph, which is what a group already is`);
        continue;
      }
      const [prop, v] = props[0];
      if (!Array.isArray(v) || !v.includes(",")) {
        bad(
          `\`${labelOf(r)}\` marks \`${prop}\` as \`wrap\` and its value has no \`","\` term to break at. A wrapped ` +
            `value is a comma-separated list written one item per line; without a comma the key would be choosing ` +
            `where to break rather than recording where the stylesheet breaks`
        );
      }
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
  def.keyframes = [];
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
      case "contains":
      case "position": {
        const owner = byName.get(r.of);
        if (!["base", "variant", "size", "part"].includes(owner?.kind)) {
          bad(
            `\`${r.name}\` is a ${r.kind} \`of\` \`${r.of}\`, which is ${owner ? `a ${owner.kind}` : "the root and not a rule"} ` +
              `and so has no rule of its own for it to hang off. Both other emitters read a state, a contains and a ` +
              `position through their owner, so the owner is a base, a variant, a size or a part${r.of === "base" ? " — and this definition declares no `base` rule above it" : ""}`
          );
          break;
        }
        (owner[{ state: "states", contains: "contains", position: "positions" }[r.kind]] ??= []).push(r);
        byName.set(r.name, r);
        break;
      }
      case "at":
        /* A QUERY-ONLY RULE DOES NOT GATHER UNDER ITS OWNER, and that is the
           whole of what makes it a different thing from a state. `.bar__action`
           has a `[data-ask]` rule only below 699px, so filing it under the
           action's `states` would publish it as a rule that always applies —
           the contract would say the segment hides whenever it carries the
           attribute, which is false at every width the bar is floating. It
           stays where the stylesheet puts it: inside the query. Its SELECTOR is
           resolved here for the same reason a scoped part's is, so both
           emitters and the contract read one string. */
        for (const entry of r.rules) {
          if (!isDeclared(entry)) continue;
          if (entry.kind === "part") entry.selector = selectors.get(entry.name);
          byName.set(entry.name, entry);
        }
        /* An INLINE at is a footnote on one rule, which is how both other
           consumers already see it: a `{condition, declarations}` hanging off
           its owner. A block one is a paragraph of overrides and stays one. */
        if (r.inline && !isDeclared(r.rules[0])) (byName.get(r.rules[0].of).at ??= []).push({ condition: r.condition, $doc: r.$doc, declarations: r.rules[0].declarations });
        else def.at.push(r);
        break;
      case "keyframes":
        def.keyframes.push(r);
        byName.set(r.name, r);
        break;
    }
  }
  for (const key of ["variants", "sizes", "parts", "at", "keyframes"]) if (!def[key].length) delete def[key];

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

/** A `note`: one comment, or SEVERAL when its elements are themselves arrays.
 *  `nav`'s `.bar__action` is the rule that has two — a paragraph about the
 *  segment and then the banner about the row it sits in, which the stylesheet
 *  keeps apart because they are about two things. */
const comments = (note, indent) => (Array.isArray(note[0]) ? note.map((c) => comment(c, indent)).join("") : comment(note, indent));

/** A declaration value → CSS. The forms are documented in the header. A term
 *  that is exactly `","` is the separator of a comma-separated value and joins
 *  to the term on its left; it is the only punctuation rule in the value forms,
 *  and it exists because a comma cannot be appended to a `{"token"}` object. */
function value(v, where) {
  if (typeof v === "string") return v;
  if (Array.isArray(v)) {
    return v.reduce((acc, t, i) => {
      const s = value(t, where);
      return i === 0 ? s : s === "," ? `${acc},` : `${acc} ${s}`;
    }, "");
  }
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
    /* A WRAPPED group is one declaration the stylesheet writes across lines,
       breaking at the commas of its value: the value leaves the property's line
       and each comma-item is indented one step further in. The loader has
       already refused a wrap with nothing to break at, so this only unfolds. */
    const text = g.wrap
      ? Object.entries(g.set)
          .map(([p, v]) => {
            const lines = [];
            let cur = "";
            for (const t of v) {
              const s = value(t, `${where} → ${selector} { ${p} }`);
              if (s === ",") { lines.push(`${cur},`); cur = ""; continue; }
              cur = cur ? `${cur} ${s}` : s;
            }
            lines.push(`${cur};`);
            return `${p}:\n${lines.map((l) => `${pad}    ${l}`).join("\n")}`;
          })
          .join(" ")
      : Object.entries(g.set).map(([p, v]) => `${p}: ${value(v, `${where} → ${selector} { ${p} }`)};`).join(" ");
    return {
      note: Array.isArray(g.note) && g.note.length ? g.note : null,
      aside: typeof g.aside === "string" && g.aside ? g.aside : null,
      break: g.break === true,
      text,
    };
  });
  if (!groups.length) throw new Error(`${where}: \`${selector}\` declares nothing`);
  if (groups.length === 1 && !groups[0].note && !groups[0].aside && !groups[0].break && !declarations[0].wrap) {
    return `${pad}${selector} { ${groups[0].text} }\n`;
  }
  let out = `${pad}${selector} {\n`;
  for (const g of groups) {
    /* A rule has paragraphs too — `nav`'s `.bar__id` puts a blank line between
       the segment's shape and the pair that decides which segment gives way. */
    if (g.break) out += "\n";
    if (g.note) out += comments(g.note, `${pad}  `);
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
  /* A rule's own note sits above it at column 0; a group's note sits inside the
     braces. The stylesheet draws that line and this only records it. */
  const lead = (r, pad) => (r.note?.length ? comments(r.note, pad) : "");

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
        out += rule(sel(r.name), r.declarations, where);
        break;
      /* A state, a contains and a position are one relation each on the rule
         `of` names, and all three resolve through the same map — the suffix
         arithmetic is done once, where the vocabulary lives. */
      case "state":
      case "contains":
      case "position":
        out += lead(r, "");
        out += rule(sel(r.name), r.declarations, where);
        break;
      /* An INLINE at renders on one line, because that is how the stylesheet
         writes a footnote on one rule. The loader has already refused anything
         that would not fit, so this only unwraps a single-line rule. */
      case "at": {
        /* An entry of a query is an OVERRIDE of a rule declared outside it, or a
           rule DECLARED INSIDE it and existing nowhere else — `nav`'s
           `.bar__action[data-ask]`, `.bar .theme` and `.bar__action-label` are
           the three that forced the second. Either way the selector comes out of
           the same map, so a query says nothing a rule outside one could not. */
        const entrySelector = (e) => sel(isDeclared(e) ? e.name : e.of);
        if (r.break) out += "\n";
        out += lead(r, "");
        if (r.inline) {
          out += `@media ${conditions[r.condition]} { ${rule(entrySelector(r.rules[0]), r.rules[0].declarations, where).trimEnd()} }\n`;
          break;
        }
        out += `@media ${conditions[r.condition]} {\n`;
        /* Each override is one rule, and a POSITION is a rule — `.fact:last-child`
           inside the query is an override naming `closing`, not a clause nested
           in the override of `.fact`. Same selector, resolved through the same
           map as every other reference. */
        for (const o of r.rules) {
          out += lead(o, "  ");
          out += rule(entrySelector(o), o.declarations, where, "  ");
        }
        out += `}\n`;
        break;
      }
      /* @keyframes has a NAME and a set of offsets and no condition at all,
         which is why it is a construct rather than the unnameable at-rule
         PATTERNS.md took it for. Both blocks that write one write it inline. */
      case "keyframes":
        if (r.break) out += "\n";
        out += lead(r, "");
        if (r.inline) {
          out += `@keyframes ${r.name} { ${rule(r.steps[0].at, r.steps[0].declarations, where).trimEnd()} }\n`;
          break;
        }
        out += `@keyframes ${r.name} {\n`;
        for (const s of r.steps) out += rule(s.at, s.declarations, where, "  ");
        out += `}\n`;
        break;
    }
  }
  return out;
}

/* ============================================================
   THE KEYFRAMES SIDE-FILE — every `@keyframes` any definition declares, in one
   published stylesheet.

   PIPELINE 2'S HONEST ANSWER, and it is a file rather than a class because an
   animation's NAME is a global CSS identifier. A class attribute holds
   declarations; `@keyframes blink { … }` is not a declaration and there is no
   arbitrary variant, no `[&…]:` and no `@theme` entry that can carry one
   without restating it. `.bar__dot`'s `animation: blink 2.4s steps(2) infinite`
   emits as an arbitrary property in the React tier exactly as it renders in
   components.css — the same bytes, the same name — and this file is what makes
   that name resolve on the consumer's side.

   So it joins `tokens.css` in the short list of things a consumer must import
   rather than being smuggled into a `.tsx` as a CSS module import: a module
   import would put a bundler requirement inside a source file this package
   deliberately ships untranspiled, and it would fire once per component rather
   than once per document. One stylesheet, one `@import`, documented in
   design-system/README.md's "What a consumer must provide".
   ============================================================ */

/** Every keyframes rule across every definition, with the component that owns
 *  it — the ONE place that can see them all, which is why the global-uniqueness
 *  check lives with the caller (scripts/build.mjs) rather than in the loader. */
export function keyframesOf(defs) {
  return defs.flatMap((def) => (def.keyframes ?? []).map((kf) => ({ id: def.id, kf })));
}

export function renderKeyframes(defs) {
  const all = keyframesOf(defs);
  let out = `/* ============================================================\n`;
  out += `   GENERATED — every @keyframes declared by a component definition.\n`;
  out += `   Source: components/<id>/definition.json. Do not edit.\n\n`;
  out += `   An animation's name is a GLOBAL CSS identifier, so it cannot ride in a\n`;
  out += `   class attribute the way a declaration can. Import this beside\n`;
  out += `   @yordan/design-system/tokens.css and the generated React components'\n`;
  out += `   animations resolve; leave it out and they are named animations with no\n`;
  out += `   keyframes, which browsers ignore silently.\n`;
  out += `   ============================================================ */\n`;
  for (const { id, kf } of all) {
    out += `\n/* ${id} */\n`;
    out += kf.inline
      ? `@keyframes ${kf.name} { ${rule(kf.steps[0].at, kf.steps[0].declarations, definitionPath(id)).trimEnd()} }\n`
      : `@keyframes ${kf.name} {\n${kf.steps.map((s) => rule(s.at, s.declarations, definitionPath(id), "  ")).join("")}}\n`;
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
if (isMain && process.argv.includes("--validate")) {
  /* `node scripts/emit-css.mjs --validate <path/to/<id>/definition.json>`
     — the loader, over one document that does not have to live in components/.

     IT EXISTS FOR A CALLER OUTSIDE THIS DIRECTORY, and that is the whole reason
     it is a flag rather than an import. ../../scripts/new-component.mjs scaffolds
     a definition, and for one release it scaffolded the shape this format left
     behind: `base: {…}` instead of `rules: [{kind: "base", …}]`. Every gate that
     could have caught it was on the far side of the scaffold actually being run
     — the block only becomes real when somebody writes the files — so
     test/scaffold.test.js checks the emitted BYTES, and it can only do that
     against this loader. scripts/check-boundaries.mjs refuses a root script
     importing design-system/scripts/, and it is right to; spawning a slice's
     entry point is how every other consumer of this one already works.

     The id comes from the parent DIRECTORY name, exactly as it does in
     components/<id>/, so `id` disagreeing with its folder still fails here. */
  const at = process.argv[process.argv.indexOf("--validate") + 1];
  if (!at) {
    console.error(`✗ --validate needs a path to a definition.json`);
    process.exit(1);
  }
  const abs = resolve(at);
  const id = basename(dirname(abs));
  let doc;
  try {
    doc = JSON.parse(readFileSync(abs, "utf8"));
  } catch (e) {
    console.error(`✗ ${at} is not readable as JSON — ${e.message}`);
    process.exit(1);
  }
  const { errors } = checkDefinition(doc, id, at);
  if (errors.length) {
    console.error(`✗ ${at} is not a definition this system accepts:\n  - ${errors.join("\n  - ")}`);
    process.exit(1);
  }
  console.log(`✓ definition valid       (${at}, as component \`${id}\`)`);
  process.exit(0);
}
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
