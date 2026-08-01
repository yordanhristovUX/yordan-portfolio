#!/usr/bin/env node
/* ============================================================
   THE REACT TIER — components/<id>/definition.json → dist/react/<id>.tsx.
   Zero dependencies; a template string, like scripts/emit-css.mjs.

   Phase R2a, and the second consumer of the SAME definitions pipeline 1
   already renders to CSS. That is the point of the exercise: one file per
   component describes its appearance, and two emitters read it — one produces
   the block in css/components.css that the vanilla site loads, the other
   produces a typed React component the Next app imports. Neither is a
   translation of the other; both are renderings of the definition, which is
   why they cannot drift apart the way two hand-written implementations do.

   ── WHAT IS GENERATED, AND WHAT IS DELIBERATELY NOT ──

   GENERATED: the cva map (base classes, one entry per variant and per size,
   states as Tailwind prefixes), the variant TYPES, the element, the className
   merge, and the HTML props passthrough. Styling is data.

   NOT GENERATED, and not coming: behaviour. There is no focus management, no
   keyboard handling, no ARIA and no state in any file this emitter writes. A
   component that needs those gets them hand-authored by the consumer, on top.
   The one thing here that looks like behaviour is Button rendering <a> or
   <button>, and it is not a decision this emitter makes — see below.

   ── THE ELEMENT COMES FROM THE SPEC, NOT FROM THE DEFINITION ──

   design-system/README.md says the canonical HTML in each spec.md "is not an
   example — it is THE pattern", and build.mjs already parses those fences to
   check that every class named in one has a rule. So the element a component
   renders is READ from that fence rather than restated in the definition:

     button/spec.md    <a class="btn">…  <a class="btn btn--solid">…  <button class="btn btn--small">…
     chip/spec.md      <span class="chip">…      inside <div class="chips">…
     stat/spec.md      <span class="stat">…

   Button is polymorphic because its canonical HTML uses two elements, not
   because anybody decided a button component ought to be. If the fence ever
   shows one element, the generated component stops being polymorphic in the
   same commit — and if it shows a pair this emitter has no rule for, the build
   fails rather than guessing a discriminant.

   ── A CLASS ATTRIBUTE HAS NO ORDER ──

   The one thing about this tier that is NOT a straight transcription of the
   definition, and the reason is worth reading before changing anything here.
   cva concatenates base and variant classes into a single attribute; CSS then
   resolves them by STYLESHEET order, which Tailwind decides by sorting. So an
   override does not win by being listed later — it wins, or loses,
   alphabetically, and on the pilot's first output every single one lost.

   The emitter therefore makes colliding classes DISJOINT rather than trying to
   weight them: a base class whose property an axis overrides moves into that
   axis's `default` branch. See the block above `disjoin` for the full
   argument, including the case it refuses to guess at. Nothing about the
   definitions changed to accommodate this, and pipeline 1 is untouched —
   components.css has a real cascade and needs none of it.

   ── CLASSNAME IS APPENDED, NOT MERGED ──

   `cx` is clsx, re-exported by cva. It concatenates; it does not resolve two
   conflicting Tailwind utilities, because CSS resolves those by STYLESHEET
   order and nothing in a class attribute can change that. A consumer who needs
   last-one-wins override semantics adds tailwind-merge themselves — this
   package will not take the dependency on their behalf, and pretending the
   merge happens would be worse than saying it does not.

   ── THE ONE EXTERNAL IMPORT ──

   `class-variance-authority` is a bare specifier in a published file and is
   the CONSUMER's dependency, declared in apps/next rather than here. This
   package installs nothing: `design-system/package.json` has no `dependencies`
   and gains none. React is likewise the consumer's, and is imported for types
   only.
   ============================================================ */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { utilitiesFor, STATE_PREFIX, selectorFragment, arbitrary } from "./emit-tailwind.mjs";
/* The selector arithmetic, imported rather than re-derived: pipeline 1 and
   pipeline 2 must agree about what `within` + `element` + `pseudo` names, and
   the only way to guarantee that is for one of them to own it. */
import { POSITION_SUFFIX, conditionValues, selectorsByName, containsSuffix, isDeclared } from "./emit-css.mjs";

/* ---------- names ---------- */
const pascal = (s) => s.split(/[^a-z0-9]+/i).filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join("");
const camel = (s) => { const p = pascal(s); return p[0].toLowerCase() + p.slice(1); };

/* ---------- the element, out of the spec's canonical HTML ---------- */
const HTML_FENCE = /```html\r?\n([\s\S]*?)```/g;
const TAG = /<([a-z][\w-]*)\b[^>]*\sclass="([^"]*)"/g;

/**
 * class → the elements the canonical HTML puts it on, in order of appearance.
 * @returns {Map<string, string[]>}
 */
export function elementsInSpec(specText) {
  const out = new Map();
  for (const fence of specText.matchAll(HTML_FENCE)) {
    for (const m of fence[1].matchAll(TAG)) {
      for (const cls of m[2].split(/\s+/).filter(Boolean)) {
        const list = out.get(`.${cls}`) ?? [];
        if (!list.includes(m[1])) list.push(m[1]);
        out.set(`.${cls}`, list);
      }
    }
  }
  return out;
}

/* ---------- declarations → classes ----------
   Every class is carried as `{ cls, keys }`, where a key is the state prefix
   plus one CSS longhand the class writes. Two classes collide exactly when
   their key sets intersect — which is a statement about properties, not about
   class names, and is what the transform below needs. A state prefix is part
   of the key because a hover declaration and a resting one do NOT compete:
   `.x:hover` outspecifies `.y` in Tailwind exactly as it does in
   components.css. */
function entriesOf(declarations, keyOf, where, tally, prefix = "") {
  const out = [];
  for (const group of declarations ?? []) {
    for (const [prop, value] of Object.entries(group.set)) {
      const { classes, arbitrary: isArbitrary } = utilitiesFor(prop, value, keyOf, where);
      if (isArbitrary) tally.arbitrary += classes.length;
      for (const { cls, sets, distribute } of classes) {
        out.push({ cls: prefix + cls, keys: new Set(sets.map((s) => `${prefix}${s}`)), prefix, distribute, where });
      }
    }
  }
  return out;
}

/* ============================================================
   A SCOPED PART IS ONE ARBITRARY VARIANT, NOT A COMPONENT.

   `.link-grid a` and `.case-body p strong` style markup that carries no class,
   so there is nothing for a generated component to put a className on — and for
   case-body there never will be, because its prose is compiled from markdown
   and a class per element would push styling into the content pipeline. What
   React CAN say is exactly what the stylesheet says: the classes go on the
   ROOT, wearing Tailwind's arbitrary variant.

       .link-grid a          →  [&_a]:flex-[1_1_11rem]     on <LinkGrid>
       .case-body p strong   →  [&_p_strong]:text-content-primary
       .case-body li::before →  [&_li::before]:[content:'▪']
       .case-body h3:first-child → [&_h3:first-child]:mt-0
       .link-grid a:hover    →  [&_a:hover]:bg-primary

   THE WHOLE SELECTOR GOES IN ONE VARIANT, and a state on a scoped part rides
   inside it rather than going through STATE_PREFIX. That is not a shortcut past
   the "a state this emitter cannot name" check — it is the same refusal that
   check exists for. Stacking `[&_a]:` with `hover:` would compile the hover half
   to `@media (hover: hover)`, and components.css has no media query there, so
   the two pipelines would disagree about every hover in a scoped part on a
   coarse pointer. One bracket, one selector, no invention. See STATE_PREFIX's
   own banner in scripts/emit-tailwind.mjs for the argument in full.
   ============================================================ */

/** `_a`, `_p_strong`, `_li::before`, `_.well`, `>div` — the scoped half of the
 *  variant, or "". A class target rides in exactly the same bracket a tag path
 *  does: `[&_.well]:` compiles to `& .well`, which is the selector pipeline 1
 *  writes. A CHILD is the one step that is not a `_`: `[&>div]:` compiles to
 *  `& > div`, which is again exactly the stylesheet's selector — Tailwind's
 *  arbitrary variant takes the combinator as written, so nothing is translated.
 *
 *  EVERY NAME GOES THROUGH `selectorFragment` AND EVERY COMBINATOR IS WRITTEN
 *  HERE. That split is what makes the underscore escape correct rather than
 *  approximately correct: the `_` separating `p` from `strong` is a space and
 *  stays bare, the `_`s inside `card__title` are letters and become `\_`. An
 *  escape applied to an assembled scope would flatten the two together and
 *  compile `.card__title` to a `<title>` element — which is precisely the
 *  defect this replaced. See selectorFragment's banner in emit-tailwind.mjs. */
const scopeOf = (part) =>
  !part.within ? ""
  : part.child ? `>${selectorFragment(part.child)}`
  /* A pseudo-element of the host itself — no `_`, because `[&::before]:`
     compiles to `&::before` and `[&_::before]:` would compile to a descendant
     of it, which is not a selector at all. */
  : !part.element && !part.class ? selectorFragment(part.pseudo)
  : `_${(part.element ?? [part.class]).map(selectorFragment).join("_")}${part.pseudo ? selectorFragment(part.pseudo) : ""}`;

/** EVERY scope a part contributes — one, or one per member when its `class` is
 *  a selector list. Tailwind has no selector list, so a list emits each class
 *  once per member, which is the same choice `stateEntriesOf` already makes for
 *  a state's list `suffix` and for the same reason: the same cascade, a longer
 *  attribute, and neither half dropped. `card`'s clipped media and note are the
 *  pair that asked. */
const scopesOf = (part) =>
  Array.isArray(part.class) ? part.class.map((c) => `_${selectorFragment(c)}`) : [scopeOf(part)];

/** The variant prefix for a scope and/or a selector suffix; "" when neither.
 *  A `scope` arrives already fragment-escaped (it was assembled out of names
 *  and combinators above); a `suffix` is raw and is escaped here, which is the
 *  one place `[data-state="dark"]` reaches a class attribute when its state is
 *  the HOST of a scoped part rather than the wearer of the utility. */
const variantFor = (scope, suffix = "") => {
  const s = suffix ? selectorFragment(suffix) : "";
  return scope || s ? `[&${scope}${s}]:` : "";
};

/* A state may carry a selector LIST — `:hover, :focus-visible` is one rule under
   two selectors in the stylesheet. Tailwind has no selector list, so each class
   is emitted once per prefix. That is the same cascade and a longer attribute,
   which is the honest trade: the alternative is dropping one of the two. */
function stateEntriesOf(states, keyOf, where, tally, scope = "") {
  const out = [];
  for (const s of states ?? []) {
    for (const suffix of Array.isArray(s.suffix) ? s.suffix : [s.suffix]) {
      const prefix = scope ? variantFor(scope, suffix) : STATE_PREFIX[suffix];
      if (!prefix) {
        throw new Error(
          `${where}: the state \`${s.name}\` appends \`${suffix}\`, which scripts/emit-tailwind.mjs has no Tailwind ` +
            `variant prefix for. Add it to STATE_PREFIX — a state this emitter cannot name is a state the React ` +
            `component would silently drop.`
        );
      }
      out.push(...entriesOf(s.declarations, keyOf, `${where} → ${s.name}`, tally, prefix));
    }
  }
  return out;
}

/* A position is a closed enum on both sides, so there is no table to miss:
   pipeline 1 turns `first` into `:first-child` and this turns the same member
   into the same suffix, out of the same object. */
function positionEntriesOf(positions, keyOf, where, tally, scope = "", at = "") {
  const out = [];
  for (const p of positions ?? []) {
    out.push(...entriesOf(p.declarations, keyOf, `${where} @${p.name}`, tally, at + variantFor(scope, POSITION_SUFFIX[p.at])));
  }
  return out;
}

/* ============================================================
   A CONDITION IS A TAILWIND ARBITRARY VARIANT TOO.

   `@media (max-width: 720px) { .fact { border-right: 0 } }` becomes
   `max-[720px]:border-r-0`? No — it becomes `[@media(max-width:720px)]:border-r-0`,
   and the difference is the same one `[&:hover]:` records. Tailwind's `max-*`
   variants resolve against ITS breakpoint scale, which this system does not
   have and deliberately has not minted: tokens.json's `$conditions` holds
   seventeen distinct max-widths with no ramp between them, and naming them `sm`
   / `md` / `lg` would assert a hierarchy that does not exist. The arbitrary
   at-rule variant compiles to exactly the media query in tokens.json — nothing
   is translated, nothing is rounded to the nearest named breakpoint, and the
   day the owner consolidates the ramp, both pipelines follow the same edit.

   Tailwind's arbitrary variant syntax takes no spaces, so the condition is
   emitted with them stripped: `(max-width: 720px)` → `[@media(max-width:720px)]:`.
   That is a lexical requirement of the class name, not a change to the query.
   ============================================================ */
const conditionVariant = (condition) => `[@media${String(condition).replace(/\s+/g, "")}]:`;

/* An INLINE `at` — a media query the stylesheet writes on one line under the
   rule it modifies — needs no sink lookup at all: the loader has already
   gathered it under its owner, so its classes join that rule's own list wearing
   the same at-rule variant a foot override wears. Pipeline 1 renders the two
   differently because the stylesheet writes them differently; here they are
   genuinely the same thing, which is worth stating rather than looking like an
   omission. */
function atEntriesOf(list, keyOf, where, tally, scope = "") {
  const out = [];
  const conditions = conditionValues();
  for (const a of list ?? []) {
    const at = conditionVariant(conditions.get(a.condition));
    const entries = entriesOf(a.declarations, keyOf, `${where} @${a.condition}`, tally, at + variantFor(scope));
    if (!entries.length) continue;
    entries[0] = {
      ...entries[0],
      lead: `Under \`@media ${conditions.get(a.condition)}\` (\`${a.condition}\`)${a.$doc ? ` — ${a.$doc}` : ""}`,
    };
    out.push(...entries);
  }
  return out;
}

const keySetOf = (entries) => new Set(entries.flatMap((e) => [...e.keys]));
const hits = (entry, keys) => [...entry.keys].some((k) => keys.has(k));

/* ============================================================
   THE COLLISION TRANSFORM — why a variant class cannot simply be added.

   cva concatenates base and variant classes into one class attribute, and a
   class attribute has NO ORDER: the stylesheet decides which wins, and
   Tailwind sorts its utilities. Measured on the pilot's own output, every
   override sorted BEFORE the base class it had to beat — px-space-3 before
   px-space-5, text-content-inverse before text-content-primary,
   hover:bg-action-hover before hover:bg-primary — so every one of them lost.
   A solid Button rendered dark ink on a dark fill; a small Button rendered at
   base metrics. Chip's solid variant worked, and worked only because
   `border-primary` happens to sort after `border-chrome-border-strong`.

   Pipeline 1 has no such problem, and nothing here touches it: in
   components.css `.btn--solid` really does come after `.btn`.

   THE FIX IS DISJOINTNESS, not weight. No !important, no tailwind-merge, and
   no change to the definitions — they stay transcription-faithful. For each
   axis, a base class whose property the axis overrides is MOVED into that
   axis's `default` branch, so exactly one of the two ever applies:

     base            .btn minus the properties an axis overrides
     variant.default the base's colour and hover-background
     variant.solid   the solid colour and hover-background
     size.default    the base's padding and font-size
     size.small      the small padding and font-size

   A branch that does not set every property the axis claims inherits the
   base's class for the rest, so an axis with two unlike variants still
   renders completely. With one variant per axis — which is the pilot — that
   list is always empty, but the rule is written for the general case because
   the failure it prevents is invisible.

   WHAT IT DOES NOT DO: two AXES that override the same property cannot be
   made disjoint this way, because both apply at once and cva has no ordering
   between them. Button's axes are disjoint today (variant sets colour and
   background, size sets padding and font-size). If a definition ever creates
   that overlap the build FAILS and names both branches and the property —
   guessing which should win is exactly the decision an emitter must not make.
   ============================================================ */
/* ============================================================
   THE INTRA-LIST CASCADE — a shorthand against its OWN longhand, in ONE list.

   `disjoin` below solves the ordering problem BETWEEN a base list and a
   variant axis. This solves the same problem INSIDE one list, which the
   transform above cannot see because there is no second branch to move
   anything into. components.css writes

       .chat__input { font: inherit; font-size: var(--text-md); … }

   — an ordinary stylesheet sentence: reset the form control's font, then set
   the size. Two declarations of one rule, and the cascade inside a rule is
   SOURCE ORDER, so the size wins. cva concatenates both classes into one
   attribute, which has no order; Tailwind sorts `[font:inherit]` after
   `text-step-md`; the shorthand wins and the composer renders at the inherited
   16px instead of 14.72px, and 4.09px taller. Measured by the R5 cutover
   against the vanilla page.

   THE RESOLUTION IS THE ONE THE STYLESHEET ALREADY STATES. Walk the list
   backwards; a class keeps only the longhands no LATER class in the same list
   writes. That is not a policy, it is what the cascade did — the emitter is
   only making the outcome independent of Tailwind's sort. Three outcomes:

     · nothing lost                    → the class is emitted unchanged
     · everything lost                 → the class is DROPPED, because a
                                         declaration wholly overridden by a
                                         later one contributes nothing
     · some lost, and the class is a   → it is DISTRIBUTED: re-emitted as one
       shorthand whose value is a        arbitrary property per surviving
       CSS-wide keyword                  longhand, with the same value

   AND NOTHING ELSE. A partially-overridden shorthand carrying a real value —
   `background: red url(x)` under a later `background-color` — cannot be split
   without deciding which part of the value belongs to which longhand, and that
   decision is the shorthand's grammar rather than this emitter's. So the build
   FAILS naming both declarations, the property and the rule, exactly as the
   axes clash below does. `emit-tailwind.mjs` marks the distributable case with
   `distribute`, and marks only that case: a CSS-wide keyword MEANS "each of my
   longhands takes this value", so distributing it is a restatement.

   WHY NOT SIMPLY REORDER. Because there is no order to write into. This is the
   same sentence design-system/README.md's "A class attribute has no order"
   makes about variants, and the same refusal to reach for `!important` or
   `tailwind-merge`: disjointness, not weight.

   PIPELINE 1 IS UNTOUCHED. `.chat__input` still carries both declarations in
   the order the definition lists them, and components.css has a real cascade.
   ============================================================ */
/* ---- the pairs this pass cannot order, declared one line at a time ----

   A collision the pass can resolve is resolved and never appears here. This is
   the residue: a shorthand carrying a TOKEN, partially overridden by a later
   longhand in the same rule. `border: var(--rule)` is width AND style AND
   colour in one custom property, and CSS has no way to take two of the three
   out of it — `border-style: var(--rule)` is not a declaration. So the pair
   ships to pipeline 2 in whatever order Tailwind picks, components.css remains
   the surface that delivers the rule, and BOTH ends keep their class.

   It is a census rather than a silence, and it is two-sided: an undeclared
   pair fails the build, and a declared pair that is no longer found fails it
   too, so the day the shape leaves nobody has to remember to delete the line.

   THE FIX IS A TOKEN DECISION AND IT IS THE OWNER'S. PATTERNS.md's review list
   already carries the border-token question (`--rule-chrome-strong`, item 6);
   this is the same question from the other side — a `--rule` split into a
   width, a style and a colour would make both of these expressible, and
   splitting it is an appearance-source change no emitter may make. Reported to
   the review list rather than worked around. */
export const UNORDERABLE = [
  {
    id: "link-grid",
    rule: ".link-grid",
    prefix: "",
    shorthand: "border",
    overridden: "border-width",
    why: "`border: var(--rule); border-width: 1px 0 0 1px` — the outer frame draws only its top and left edge, and the widths are a longhand override of a shorthand TOKEN.",
  },
  {
    id: "link-grid",
    rule: ".link-grid a",
    prefix: "[&_a]:",
    shorthand: "border",
    overridden: "border-width",
    why: "the same idiom on the cell — `border-width: 0 1px 1px 0` — which is what makes the grid one hairline between cells rather than two.",
  },
];

function cascade(entries, rule, tally, unorderable) {
  const claimed = new Set();
  const out = [];
  let carried = null; // a `lead` whose entry did not survive
  for (let i = entries.length - 1; i >= 0; i--) {
    const e = entries[i];
    const lost = [...e.keys].filter((k) => claimed.has(k));
    for (const k of e.keys) claimed.add(k);
    if (!lost.length) {
      out.unshift(carried && !e.lead ? { ...e, lead: carried } : e);
      if (carried && !e.lead) carried = null;
      continue;
    }
    const survivors = [...e.keys].filter((k) => !lost.includes(k));
    if (!survivors.length) {
      tally.cascaded++;
      if (e.lead) carried = carried ?? e.lead;
      continue;
    }
    if (!e.distribute) {
      const shorthand = e.cls.slice(e.prefix.length).replace(/^\[([a-z-]+):[\s\S]*$/, "$1");
      const overridden = lost.map((k) => k.slice(e.prefix.length)).sort().join(" ");
      /* Keyed by the VARIANT PREFIX rather than by the prose selector: the
         prefix is what the emitter computed and what the class wears, so a
         declaration cannot be satisfied by a rule that merely reads alike. */
      const declared = unorderable.find((u) => u.prefix === e.prefix && u.shorthand === shorthand && u.overridden === overridden);
      if (!declared) {
        throw new Error(
          `${e.where}: \`${rule}${e.prefix ? ` (${e.prefix})` : ""}\` holds \`${e.cls}\` and, later in the same list, ` +
            `a class writing ${overridden} — ` +
            `which the shorthand also writes. In components.css the later declaration wins by source order; in a ` +
            `class attribute there IS no order, so Tailwind's sort decides instead, and it decided wrong for the ` +
            `two cases the R5 cutover measured.\n` +
            `  This one cannot be resolved faithfully. \`${e.cls}\`'s value is not a CSS-wide keyword, so it cannot ` +
            `be distributed over the longhands it keeps, and splitting it would mean deciding which part of the ` +
            `value belongs to which longhand — that is the shorthand's grammar, not this emitter's.\n` +
            `  Either write the rule as the longhands it means, or declare the pair in \`UNORDERABLE\` in ` +
            `scripts/emit-react.mjs with the reason it cannot be written that way. A declaration is not a silencer: ` +
            `the pair still ships to pipeline 2 in whatever order Tailwind picks, which is why the component keeps ` +
            `its class and components.css stays the surface that delivers the rule.`
        );
      }
      declared.$found = true;
      tally.unorderable++;
      out.unshift(carried && !e.lead ? { ...e, lead: carried } : e);
      if (carried && !e.lead) carried = null;
      continue;
    }
    tally.cascaded++;
    const { prop, value } = e.distribute;
    const made = survivors.map((k, n) => ({
      cls: `${e.prefix}[${k.slice(e.prefix.length)}:${arbitrary(value)}]`,
      keys: new Set([k]),
      prefix: e.prefix,
      where: e.where,
      ...(n === 0
        ? {
            lead:
              (e.lead ? `${e.lead} — ` : "") +
              `\`${prop}: ${value}\`, distributed over the longhands this rule does not set again. The class ` +
              `attribute has no order, so the shorthand cannot be allowed to claim a property a later declaration ` +
              `takes back — see the cascade pass in scripts/emit-react.mjs.`,
          }
        : {}),
    }));
    out.unshift(...made);
    carried = null;
  }
  return out;
}

function disjoin(base, axes, where, declared) {
  for (const axis of axes) {
    const axisKeys = new Set();
    for (const branch of axis.branches) for (const k of keySetOf(branch.entries)) axisKeys.add(k);

    const moved = base.filter((e) => hits(e, axisKeys));
    if (!moved.length) continue;
    base = base.filter((e) => !moved.includes(e));
    axis.fallback = moved;
    for (const branch of axis.branches) {
      const own = keySetOf(branch.entries);
      branch.entries = [...branch.entries, ...moved.filter((e) => !hits(e, own))];
    }
  }

  /* Every combination that can apply at once, checked on the FINAL contents —
     including each axis's `default`, because two defaults apply together. */
  const clashes = [];
  for (let i = 0; i < axes.length; i++) {
    for (let j = i + 1; j < axes.length; j++) {
      const left = [{ name: "default", entries: axes[i].fallback ?? [] }, ...axes[i].branches];
      const right = [{ name: "default", entries: axes[j].fallback ?? [] }, ...axes[j].branches];
      for (const a of left) {
        for (const b of right) {
          const shared = [...keySetOf(a.entries)].filter((k) => keySetOf(b.entries).has(k));
          if (shared.length) {
            clashes.push(
              `${axes[i].prop}="${a.name}" and ${axes[j].prop}="${b.name}" both set ${shared.join(", ")}`
            );
          }
        }
      }
    }
  }
  if (clashes.length) {
    throw new Error(
      `\`axes.orthogonal\` claims ${JSON.stringify(declared ?? axes.map((a) => a.prop))} is a deliberate matrix, and two of ` +
        `those axes override the same property while both apply at once:\n  - ${clashes.join("\n  - ")}\n` +
        `  cva concatenates them into one class attribute, which has no order, so which one wins would be decided ` +
        `by Tailwind's alphabetical sort rather than by ${where}. Moving the base class into a \`default\` branch ` +
        `cannot help — neither axis is the base. Split the property onto one axis, or express the combination as a ` +
        `single variant. The claim is the thing to fix or the shape is; this emitter will not guess which.`
    );
  }
  return base;
}

/* ---------- prose ---------- */
const wrap = (text, width, indent) => {
  const words = String(text).split(/\s+/);
  const lines = [];
  let line = "";
  for (const w of words) {
    if (line && (line + " " + w).length > width) { lines.push(line); line = w; }
    else line = line ? `${line} ${w}` : w;
  }
  if (line) lines.push(line);
  return lines.map((l, i) => (i ? `${indent}${l}` : l));
};
const tsdoc = (text, indent) => {
  const lines = wrap(text, 92 - indent.length, "");
  if (lines.length === 1) return `${indent}/** ${lines[0]} */\n`;
  return `${indent}/**\n${lines.map((l) => `${indent} * ${l}`).join("\n")}\n${indent} */\n`;
};
/** A block comment for a class list, wrapped to the same width a tsdoc is. */
const remark = (text, indent) => {
  const lines = wrap(text, 89 - indent.length, "");
  if (lines.length === 1) return [`${indent}/* ${lines[0]} */`];
  return [
    `${indent}/* ${lines[0]}`,
    ...lines.slice(1, -1).map((l) => `${indent}   ${l}`),
    `${indent}   ${lines[lines.length - 1]} */`,
  ];
};
/* ============================================================
   HOW A CLASS BECOMES A LITERAL — and why one of the two forms is raw.

   Tailwind's scanner reads the SOURCE TEXT of this file and generates a rule
   whose escaped selector matches the class attribute the browser will hold at
   runtime. Those two are the same characters for every class this emitter
   wrote until the underscore escape landed, and a backslash breaks the
   identity in both directions:

     "[&_.card\_\_title]:…"    the scanner reads `\_`; JS drops it, so the
                               runtime class has a bare `_` — no match
     "[&_.card\\_\\_title]:…"  the runtime class has `\_`; the scanner reads
                               `\\_` and builds a rule for that — no match

   `String.raw` is the one literal form whose text and value are the same
   characters, so it is what an escaped class is emitted as. Measured with
   Tailwind 4.3.3's own scanner and compiler: the raw form yields the candidate
   `[&_.card\_\_title]:…`, which compiles to `… .card__title` and to a class
   name that unescapes back to the runtime string.

   The quoted form stays for everything else, because it is what a reader
   expects and because most classes have no backslash. Both forms REFUSE a
   character they cannot carry, which is the gate behind defect 3: a `"` inside
   a quoted literal is TS1005 and shipped once, and a backtick or a `${` inside
   a raw one would be worse than a parse error — it would be a template
   substitution. Neither can arrive from a definition today; both are checked
   because "cannot arrive" is exactly what was believed about the quote. */
const classLiteral = (cls, where) => {
  if (cls.includes("`") || cls.includes("${")) {
    throw new Error(
      `${where}: the class \`${cls}\` holds a backtick or a \`\${\`, which cannot be emitted as a literal — a raw ` +
        `template would substitute it and a quoted one would need an escape the Tailwind scanner cannot read back. ` +
        `Whatever put it there is naming something this tier has no spelling for.`
    );
  }
  /* THE QUOTE IS REFUSED BEFORE THE FORM IS CHOSEN, and the order matters:
     a raw literal would happily CARRY a `"`, so testing it second would let
     the raw branch swallow exactly the defect this guard exists for. A double
     quote in a class name is not only TS1005 — it is a broken `class="…"`
     attribute in the rendered HTML, on every surface, whatever quoted the
     source. There is no literal form in which it is admissible. */
  if (cls.includes('"')) {
    throw new Error(
      `${where}: the class \`${cls}\` holds a double quote. It cannot sit inside the double-quoted string literal ` +
        `this file emits — that is TS1005, and dist/react/theme-toggle.tsx shipped it six times over at 2.6.0 — and ` +
        `it could not be rendered into a \`class="…"\` attribute even if it did parse. Every selector fragment must ` +
        `go through \`selectorFragment\` in scripts/emit-tailwind.mjs, which spells an attribute value with single ` +
        `quotes; the two are the same selector after the CSS lexer.`
    );
  }
  if (cls.includes("\\")) return `String.raw\`${cls}\``;
  return `"${cls}"`;
};

/** An entry may carry a `lead`: the prose of the scoped part its classes came
 *  from. A cva base is the only place that prose can live once the part has
 *  stopped being a component — dropping it would leave a reader of the file
 *  with `[&_li::before]:[content:'▪']` and no account of why. */
const list = (entries, indent, where) =>
  entries
    .map((e) => `${e.lead ? remark(e.lead, indent).join("\n") + "\n" : ""}${indent}${classLiteral(e.cls, where)},`)
    .join("\n");

/* ---------- one component file ---------- */

/**
 * @param {object} def          the parsed definition.json
 * @param {Map<string,string[]>} elements  from elementsInSpec
 * @param {(name:string)=>string|null} keyOf  token name → @theme key
 */
export function renderComponent(def, elements, keyOf) {
  const where = `components/${def.id}/definition.json`;
  const tally = { arbitrary: 0, cascaded: 0, unorderable: 0 };
  const unorderable = UNORDERABLE.filter((u) => u.id === def.id);
  const Name = pascal(def.id);
  const fn = camel(def.id);

  /* The element(s) a selector renders on, read from the spec's canonical HTML —
     for a root and, since R4, for a part on exactly the same terms. */
  const elementsFor = (selector, label) => {
    const list = elements.get(selector);
    if (!list || !list.length) {
      throw new Error(
        `components/${def.id}/spec.md: its canonical HTML never puts \`${selector}\` (${label}) on an element, so this ` +
          `emitter cannot know what to render. The fence in a spec is THE pattern — add the class to it.`
      );
    }
    if (list.length > 1 && !(list.length === 2 && list.includes("a") && list.includes("button"))) {
      throw new Error(
        `components/${def.id}/spec.md: its canonical HTML puts \`${selector}\` on ${list.map((e) => `<${e}>`).join(" and ")}. ` +
          `The only polymorphic pair this emitter has a discriminant for is <a> / <button>, which it tells apart by ` +
          `\`href\`. Decide the discriminant and add it here rather than letting the generator pick one.`
      );
    }
    return list;
  };
  const els = elementsFor(def.root, "the root");
  const polymorphic = els.length > 1;

  /* Two kinds of part. One has a class and becomes a component of its own; the
     other is SCOPED and cannot, because the element it styles carries no class
     — its rules land on the root as arbitrary variants instead. */
  const queryOnlyNames = new Set(queryOnlyOf(def).map(({ entry }) => entry.name));
  const classParts = classPartsOf(def);
  /* Every selector the definition declares, resolved once by the loader's own
     arithmetic — so this tier names the selector that actually ships. */
  const selectors = selectorsByName(def);

  let base = [
    /* `base` is optional since case-body, whose root is a scope rather than an
       appearance. Its class list is entirely what it does to the prose inside it. */
    ...entriesOf(def.base?.declarations, keyOf, where, tally),
    ...atEntriesOf(def.base?.at, keyOf, where, tally),
    ...stateEntriesOf(def.base?.states, keyOf, where, tally),
    ...positionEntriesOf(def.base?.positions, keyOf, where, tally),
  ];
  /* Every class part's own list, computed HERE rather than in the emission loop
     below, because two other things write into one: a scoped part hosted by it,
     and an `at` override that names it. Which list a class lands in is decided
     by the selector it is a descendant of — never by which component it is in. */
  const partEntries = new Map(
    classParts.map((part) => [
      part.name,
      [
        ...(queryOnlyNames.has(part.name) ? [] : entriesOf(part.declarations, keyOf, `${where} → ${part.selector}`, tally)),
        ...atEntriesOf(part.at, keyOf, `${where} → ${part.selector}`, tally),
        ...stateEntriesOf(part.states, keyOf, `${where} → ${part.selector}`, tally),
        ...positionEntriesOf(part.positions, keyOf, `${where} → ${part.selector}`, tally),
      ],
    ])
  );

  /* THE AXES ARE BUILT BEFORE THE SCOPED PARTS, and the order is load-bearing
     rather than tidy. `.sec--tint .well` is a scoped part whose host is a
     VARIANT — the tint declares nothing itself and its whole effect is that
     descendant — so the class list a scoped part writes into may be a branch's,
     which has to exist before anything can be pushed into it. `disjoin` still
     runs last, on the final contents. */
  const axes = [];
  const branchesOf = (items) =>
    items.map((item) => ({
      name: item.name,
      $doc: item.$doc,
      entries: [
        ...entriesOf(item.declarations, keyOf, `${where} → ${item.selector}`, tally),
        ...atEntriesOf(item.at, keyOf, `${where} → ${item.selector}`, tally),
        ...stateEntriesOf(item.states, keyOf, `${where} → ${item.selector}`, tally),
      ],
    }));
  if (def.variants?.length) axes.push({ prop: "variant", branches: branchesOf(def.variants) });
  if (def.sizes?.length) axes.push({ prop: "size", branches: branchesOf(def.sizes) });
  const branchNamed = (kind, name) =>
    axes.find((a) => a.prop === (kind === "variants" ? "variant" : "size"))?.branches.find((b) => b.name === name);

  /* ---- where a rule with no class of its own puts its classes ----
     `[&_small]:` compiles to "a <small> anywhere inside the element wearing this
     class". `.fact__num small` is a <small> inside `.fact__num` — so the class
     belongs on `.fact__num`, and putting it on `.facts` would style every
     <small> in the block. That is not a smaller mistake than dropping the rule;
     it is a wider one. So a rule that owns no class list rides in an arbitrary
     variant on the nearest ancestor that does, and `within` / `of` name the
     ancestor. Pipeline 1 has the same fact written as a selector and needs no
     rule for it, which is exactly the asymmetry this absorbs.

     THE WALK IS IN LIST ORDER, so an ancestor is always anchored before the
     rule naming it — the same guarantee the loader's backwards-only reference
     rule gives — and a chain composes: `.ph:has(img) .ph__label` is a scoped
     part whose host is a CONTAINS whose host is the base, and it emits
     `[&:has(img)_.ph__label]:hidden` on the root. */

  /** The class list a rule's utilities belong in, by the NAME that names it —
   *  the root's own, a class part's cva, or an axis branch's. */
  const branchOf = (name) => axes.flatMap((a) => a.branches).find((b) => b.name === name);
  const sinkFor = (name) =>
    name === "base" ? base : partEntries.get(name) ?? branchOf(name)?.entries ?? null;

  const scopeByName = new Map();
  /** The anchor of a rule: which class list, and the selector suffix to wear.
   *  A MODIFIER CAN BE ONE, and `.sec--tint .well` is why — the tint's class is
   *  on the root, so the descendant's utilities go on the root too, but only
   *  when the variant is chosen, which in cva means they belong to that BRANCH
   *  rather than to the base list. Putting them in the base would tint every
   *  section; putting them anywhere else would need a component for an element
   *  skeleton owns. */
  const anchor = (r, name) => {
    const known = scopeByName.get(name);
    if (known) return known;
    if (sinkFor(name)) return { scope: "", host: name };
    throw new Error(
      `${where}: \`${r.name}\` names \`${name}\`, which is neither the root, a part with a class of its own, nor a ` +
        `variant or size. Pipeline 1 renders it as a selector; this tier needs a class list to put the utilities ON, ` +
        `and a rule with no host would be emitted against the root — which is a WIDER selector than the stylesheet's, ` +
        `not a narrower one.`
    );
  };

  for (const r of def.rules) {
    /* A STATE IS AN ANCHOR TOO, and it emits nothing here. Its own classes are
       already gathered under the rule it hangs off — `stateEntriesOf` above —
       so all this records is the SUFFIX a descendant of it would have to wear.
       `ask-fab` is the block that needed it: `.ask-fab[data-collapsed]
       .ask-fab__label` is a part scoped to a state, which the format has
       described since the ordered list landed (a state owns no selector for an
       author to quote, so a NAME is the only way to reach one) and which no
       definition had yet written. The scope composes exactly as a `contains`
       does — `[&[data-collapsed]_.ask-fab__label]:` compiles to the selector
       components.css writes, and nothing here decides anything else.

       A LIST SUFFIX REGISTERS NOTHING, and it does not have to: the loader
       already refuses a part scoped within a state whose `suffix` is a selector
       list, because a list has no single selector to descend from. If that ever
       gains an answer, this is the second place that has to learn it. */
    if (r.kind === "state") {
      if (!Array.isArray(r.suffix)) {
        const parent = anchor(r, r.of);
        scopeByName.set(r.name, { scope: parent.scope + selectorFragment(r.suffix), host: parent.host });
      }
      continue;
    }
    /* A POSITION IS AN ANCHOR FOR THE SAME REASON, and it became one when
       `override.positions` retired. `.fact:last-child` inside a media query used
       to arrive here as a clause nested in the override of `.fact`; it arrives
       as an override naming `closing`, so the sink lookup at the foot has to be
       able to resolve a position's name to a class list and a suffix. The string
       it composes is the one `positionEntriesOf` was already building —
       `[&:last-child]:`, `[&>div:nth-child(odd)]:` — so the emitted classes are
       byte-identical and the flattening is invisible on this side. */
    if (r.kind === "position") {
      const parent = anchor(r, r.of);
      scopeByName.set(r.name, { scope: parent.scope + selectorFragment(POSITION_SUFFIX[r.at]), host: parent.host });
      continue;
    }
    const owner = r.kind === "contains" ? r.of : r.kind === "part" && r.within ? r.within : null;
    if (owner === null) continue;
    const parent = anchor(r, owner);
    /* USUALLY ONE SCOPE, AND SOMETIMES A LIST. A part whose `class` is an array
       is one rule under several selectors, so it contributes one variant per
       member and REGISTERS NONE — the loader already refuses a part scoped
       within it, exactly as it refuses one scoped within a list-suffix state,
       because a list has no single selector to descend from. */
    const scopes = (r.kind === "contains" ? [selectorFragment(containsSuffix(r))] : scopesOf(r)).map((s) => parent.scope + s);
    if (scopes.length === 1) scopeByName.set(r.name, { scope: scopes[0], host: parent.host });
    const sel = selectors.get(r.name);
    const entries = scopes.flatMap((scope) => [
      ...entriesOf(r.declarations, keyOf, `${where} → ${sel}`, tally, variantFor(scope)),
      ...stateEntriesOf(r.states, keyOf, `${where} → ${sel}`, tally, scope),
      ...positionEntriesOf(r.positions, keyOf, `${where} → ${sel}`, tally, scope),
    ]);
    if (!entries.length) continue;
    entries[0] = { ...entries[0], lead: `\`${sel}\`${r.$doc ? ` — ${r.$doc}` : ""}` };
    sinkFor(parent.host).push(...entries);
  }

  /* The at-rules at the FOOT. An override names a rule, so its classes go
     wherever that rule's classes went — the root's base, a class part's own
     list, or an axis branch — wearing the condition as an arbitrary at-rule
     variant. Every axis carries a `default` branch, so the unmodified component
     is a value of the type rather than the absence of one — and, since the
     transform below, the branch that holds the base's own value for anything
     the axis overrides. */
  const conditions = conditionValues();
  for (const block of def.at ?? []) {
    const at = conditionVariant(conditions.get(block.condition));
    for (const o of block.rules) {
      /* A RULE DECLARED INSIDE THE QUERY, rather than an override of one
         declared outside it. It is the ordinary vocabulary one level in, so it
         anchors exactly as its top-level twin would — the only difference is
         that every class it produces wears the condition as well as its scope.
         `nav` writes three: a state of a part described further down the file,
         a part scoped to a class another component owns, and a class part with
         no unconditional rule at all. */
      if (isDeclared(o)) {
        const lead = `Under \`@media ${conditions.get(block.condition)}\` (\`${block.condition}\`), declared there and nowhere else — \`${selectors.get(o.name)}\`${o.$doc ? ` — ${o.$doc}` : ""}`;
        if (o.kind === "part" && !o.within) {
          const entries = entriesOf(o.declarations, keyOf, `${where} @${block.condition} ${o.name}`, tally, at);
          if (entries.length) {
            entries[0] = { ...entries[0], lead };
            partEntries.get(o.name).push(...entries);
          }
          continue;
        }
        const parent = anchor(o, o.kind === "part" ? o.within : o.of);
        /* One scope, or one per member of a class LIST — the same widening the
           top-level walk above takes, so nothing is sayable inside a query that
           is not sayable outside one. A list registers no scope, for the reason
           given there. */
        const scopes = (
          o.kind === "part" ? scopesOf(o)
          : o.kind === "contains" ? [selectorFragment(containsSuffix(o))]
          : o.kind === "position" ? [selectorFragment(POSITION_SUFFIX[o.at])]
          : [""]
        ).map((s) => parent.scope + s);
        if (scopes.length === 1) scopeByName.set(o.name, { scope: scopes[0], host: parent.host });
        const suffixes = o.kind === "state" ? (Array.isArray(o.suffix) ? o.suffix : [o.suffix]) : [null];
        const entries = scopes.flatMap((scope) => suffixes.flatMap((suffix) => {
          /* The same choice `stateEntriesOf` makes, for the same reason: an
             unscoped state wears the table's idiomatic prefix, a scoped one
             wears the whole selector in one bracket. */
          const prefix = suffix === null ? variantFor(scope) : scope ? variantFor(scope, suffix) : STATE_PREFIX[suffix];
          if (!prefix) {
            throw new Error(
              `${where}: the query-only state \`${o.name}\` appends \`${suffix}\`, which scripts/emit-tailwind.mjs has ` +
                `no Tailwind variant prefix for. Add it to STATE_PREFIX — a state this emitter cannot name is a state ` +
                `the React component would silently drop.`
            );
          }
          return entriesOf(o.declarations, keyOf, `${where} @${block.condition} ${o.name}`, tally, at + prefix);
        }));
        if (!entries.length) continue;
        entries[0] = { ...entries[0], lead };
        sinkFor(parent.host).push(...entries);
        continue;
      }
      /* A scoped part, a state or a position overridden under a condition keeps
         BOTH its scope and its host: the classes wear `[@media…]:[&_span]:` and
         land on the host's list. */
      const scoped = scopeByName.get(o.of);
      const target = scoped?.host ?? o.of;
      const scope = scoped?.scope ?? "";
      const entries = entriesOf(o.declarations, keyOf, `${where} @${block.condition} ${o.of}`, tally, at + variantFor(scope));
      if (!entries.length) continue;
      entries[0] = { ...entries[0], lead: `Under \`@media ${conditions.get(block.condition)}\` (\`${block.condition}\`)${block.$doc ? ` — ${block.$doc}` : ""}` };
      const sink = sinkFor(target);
      if (!sink) {
        throw new Error(
          `${where}: the \`at\` override \`${o.of}\` names a rule this emitter cannot find a class list for. ` +
            `Pipeline 1 resolved it, so the two emitters disagree about what a definition declares.`
        );
      }
      sink.push(...entries);
    }
  }

  /* THE INTRA-LIST CASCADE RUNS BEFORE `disjoin`, ON EVERY LIST. Each of these
     is one rule's declarations in stylesheet order, so each is a place a
     shorthand can shadow its own longhand; running it first also means
     `disjoin` sees the properties a class actually still writes rather than
     the ones a superseded shorthand claimed. */
  base = cascade(base, def.root, tally, unorderable);
  for (const [name, entries] of partEntries) partEntries.set(name, cascade(entries, selectors.get(name) ?? `.${name}`, tally, unorderable));
  for (const axis of axes) {
    for (const branch of axis.branches) {
      branch.entries = cascade(branch.entries, selectors.get(branch.name) ?? `.${branch.name}`, tally, unorderable);
    }
  }
  const stale = unorderable.filter((u) => !u.$found);
  if (stale.length) {
    throw new Error(
      `UNORDERABLE in scripts/emit-react.mjs declares ${stale.length} pair(s) this definition no longer writes:\n` +
        stale.map((u) => `    ${u.rule} — \`${u.shorthand}\` vs \`${u.overridden}\``).join("\n") +
        `\n  A declared limitation that has stopped being true is a limitation somebody should be told has gone. ` +
        `Delete the line, and check whether the class the consumer keeps for it can go too.`
    );
  }

  base = disjoin(base, axes, where, def.axes?.orthogonal);

  let out = header(def, `dist/react/${def.id}.tsx`);
  out += `import { cva, cx, type VariantProps } from "class-variance-authority";\n`;
  out += `import type { ComponentPropsWithRef } from "react";\n\n`;

  /* the cva map */
  out += tsdoc(
    `The class map for \`${def.root}\`, rendered from its definition. The base carries only what no ` +
      `variant or size overrides; anything one of them does override sits in that axis's \`default\` branch instead, ` +
      `so exactly one of the two classes is ever in the attribute.`,
    ""
  );
  if (!axes.length) {
    /* No variants and no sizes: the same one-argument shape a part gets, so a
       component with one appearance does not look like one whose axes went
       missing. */
    out += `export const ${fn} = cva([\n${list(base, "  ", where)}\n]);\n\n`;
  } else {
    out += `export const ${fn} = cva(\n  [\n${list(base, "    ", where)}\n  ]`;
    out += `,\n  {\n    variants: {\n`;
    for (const axis of axes) {
      out += `      ${axis.prop}: {\n`;
      const fallback = axis.fallback ?? [];
      if (!fallback.length) {
        out += `        default: "",\n`;
      } else {
        out += tsdoc(
          `The base's own value for every property this axis overrides. It lives here rather than in the base list ` +
            `because a class attribute has no order — see the transform in scripts/emit-react.mjs.`,
          "        "
        );
        out += `        default: [\n${list(fallback, "          ", where)}\n        ],\n`;
      }
      for (const branch of axis.branches) {
        if (branch.$doc) out += tsdoc(branch.$doc, "        ");
        out += `        ${branch.name}: [\n${list(branch.entries, "          ", where)}\n        ],\n`;
      }
      out += `      },\n`;
    }
    out += `    },\n    defaultVariants: { ${axes.map((a) => `${a.prop}: "default"`).join(", ")} },\n  }`;
    out += `\n);\n\n`;
  }

  out += `export type ${Name}Variants = VariantProps<typeof ${fn}>;\n\n`;

  /* props + component */
  const own = `${Name}Variants & { className?: string }`;
  const args = axes.map((a) => a.prop);
  const call = args.length ? `${fn}({ ${args.join(", ")} })` : `${fn}()`;
  const destructure = [...args, "className"].join(", ");

  if (polymorphic) {
    out += tsdoc(
      `The props of \`<${Name} />\`. A union rather than one type, because the canonical HTML in ` +
        `components/${def.id}/spec.md renders this on <a> AND on <button>: pass \`href\` and it is a link, omit it ` +
        `and it is a button, and the element's own attributes follow the branch you chose.`,
      ""
    );
    out += `export type ${Name}Props =\n`;
    out += `  | (${own} & { href: string } & Omit<ComponentPropsWithRef<"a">, "className" | "href">)\n`;
    out += `  | (${own} & { href?: undefined } & Omit<ComponentPropsWithRef<"button">, "className">);\n\n`;
    out += tsdoc(`Renders the canonical pattern of components/${def.id}/spec.md. Styling only — behaviour is the consumer's.`, "");
    out += `export function ${Name}(props: ${Name}Props) {\n`;
    out += `  if (props.href !== undefined) {\n`;
    out += `    const { ${destructure}, ...rest } = props;\n`;
    out += `    return <a className={cx(${call}, className)} {...rest} />;\n`;
    out += `  }\n`;
    out += `  const { ${destructure}, ...rest } = props;\n`;
    out += `  return <button className={cx(${call}, className)} {...rest} />;\n`;
    out += `}\n`;
  } else {
    const el = els[0];
    out += `export type ${Name}Props = ${own} & Omit<ComponentPropsWithRef<"${el}">, "className">;\n\n`;
    out += tsdoc(`Renders the canonical pattern of components/${def.id}/spec.md: a <${el}>. Styling only — behaviour is the consumer's.`, "");
    out += `export function ${Name}({ ${destructure}, ...rest }: ${Name}Props) {\n`;
    out += `  return <${el} className={cx(${call}, className)} {...rest} />;\n`;
    out += `}\n`;
  }

  /* parts — a companion selector that is not a modifier of the root. Since R4 a
     part is a FULL rule: it may carry states, and it may be polymorphic on the
     same terms the root is, because `.source__link` is a <button> and an <a> in
     its own canonical HTML. It still has no variants and no sizes — a companion
     selector that needs an axis is a component with its own definition. */
  for (const part of classParts) {
    const PartName = pascal(`${def.id}-${part.name}`);
    const partFn = camel(`${def.id}-${part.name}`);
    const partEls = elementsFor(part.selector, `part \`${part.name}\``);
    const partPoly = partEls.length > 1;
    const classes = partEntries.get(part.name);
    out += `\n`;
    if (part.$doc) out += tsdoc(part.$doc, "");
    out += `export const ${partFn} = cva([\n${list(classes, "  ", where)}\n]);\n\n`;
    if (partPoly) {
      out += tsdoc(
        `The props of \`<${PartName} />\`. A union, because the canonical HTML in components/${def.id}/spec.md ` +
          `renders \`${part.selector}\` on <a> AND on <button>: pass \`href\` and it is a link, omit it and it is a button.`,
        ""
      );
      out += `export type ${PartName}Props =\n`;
      out += `  | ({ className?: string; href: string } & Omit<ComponentPropsWithRef<"a">, "className" | "href">)\n`;
      out += `  | ({ className?: string; href?: undefined } & Omit<ComponentPropsWithRef<"button">, "className">);\n\n`;
      out += tsdoc(`The \`${part.selector}\` half of the pattern in components/${def.id}/spec.md.`, "");
      out += `export function ${PartName}(props: ${PartName}Props) {\n`;
      out += `  if (props.href !== undefined) {\n`;
      out += `    const { className, ...rest } = props;\n`;
      out += `    return <a className={cx(${partFn}(), className)} {...rest} />;\n`;
      out += `  }\n`;
      out += `  const { className, ...rest } = props;\n`;
      out += `  return <button className={cx(${partFn}(), className)} {...rest} />;\n`;
      out += `}\n`;
    } else {
      const el = partEls[0];
      out += `export type ${PartName}Props = { className?: string } & Omit<ComponentPropsWithRef<"${el}">, "className">;\n\n`;
      out += tsdoc(`The \`${part.selector}\` half of the pattern in components/${def.id}/spec.md: a <${el}>.`, "");
      out += `export function ${PartName}({ className, ...rest }: ${PartName}Props) {\n`;
      out += `  return <${el} className={cx(${partFn}(), className)} {...rest} />;\n`;
      out += `}\n`;
    }
  }

  return { source: out, tally, elements: els, exports: exportsOf(def) };
}

/** Every name a component's file exports, in emission order. A SCOPED part
 *  exports nothing: it has no class to hang a className on, so its rules ship
 *  as arbitrary variants in the root's own class list. */
/** Every rule a query DECLARES rather than overrides, with the block declaring
 *  it. `nav` writes three; every other definition writes none. */
export const queryOnlyOf = (def) => (def.at ?? []).flatMap((block) => block.rules.filter(isDeclared).map((entry) => ({ block, entry })));

/** Every part with a class of its own — the ones that become components.
 *  A QUERY-ONLY RULE IS STILL ONE OF THEM when it has a class: `.bar__action-label`
 *  is a class the markup wears with no unconditional appearance at all, because
 *  the label is a plain span until the viewport narrows and it folds away. Its
 *  cva is filled from the at-rule pass rather than from `declarations`, which
 *  under a query is not what the element looks like at rest — and dropping it
 *  would be exactly the silent divergence this tier exists to make impossible.
 *  Shared with `exportsOf` so the barrel and the module cannot disagree. */
export const classPartsOf = (def) => [
  ...(def.parts ?? []).filter((p) => !p.within),
  ...queryOnlyOf(def).filter(({ entry }) => entry.kind === "part" && !entry.within).map(({ entry }) => entry),
];

export function exportsOf(def) {
  const Name = pascal(def.id);
  const values = [camel(def.id), Name];
  const types = [`${Name}Props`, `${Name}Variants`];
  for (const part of classPartsOf(def)) {
    const PartName = pascal(`${def.id}-${part.name}`);
    values.push(camel(`${def.id}-${part.name}`), PartName);
    types.push(`${PartName}Props`);
  }
  return { values, types };
}

/* ---------- the barrel ---------- */
export function renderIndex(defs) {
  let out = header(null, "dist/react/index.ts");
  for (const def of defs) {
    const { values, types } = exportsOf(def);
    out += `export { ${values.join(", ")} } from "./${def.id}";\n`;
    out += `export type { ${types.join(", ")} } from "./${def.id}";\n`;
  }
  return out;
}

/* ============================================================
   THE STRUCTURAL SANITY PASS — the gate behind defect 3.

   `build.mjs --check` byte-compares every generated .tsx against a fresh
   render, which catches a hand-edit and catches nothing else: if the EMITTER
   writes a file that does not parse, the bytes match perfectly and the gate is
   green. That is not hypothetical. `dist/react/theme-toggle.tsx` shipped at
   2.6.0 with three class strings carrying an unescaped `"` inside a
   double-quoted literal — TS1005 six times over — and every gate on this side
   of the boundary passed. The consumer found it, which is the wrong end.

   TWO GATES CLOSE IT, at two different prices.

   · THIS ONE, offline and dependency-free, runs on every build and every
     `--check`. It is a lexer, not a parser: it walks the generated source
     tracking strings, template literals and comments, and asserts four things
     that no output of this emitter may violate. It cannot typecheck and does
     not pretend to.

   · `npm run typecheck:react` in design-system.yml runs the real thing —
     `tsc --noEmit` over dist/react with react and cva types present. It costs
     a dependency tier and a CI minute, which is exactly why it is there and
     not in the root `npm run check`.

   THE FOUR ASSERTIONS, and why each is a real invariant rather than a shape
   this generator happens to have today:

   1. Every string literal terminates, on its line. A JS string may not contain
      a raw newline, so an unterminated one is a syntax error wherever it ends.
   2. Every template literal and every block comment terminates.
   3. NOTHING IS JUXTAPOSED WITH A STRING LITERAL. In JavaScript a string
      literal can be followed by an operator, a separator, a closing bracket or
      end-of-statement — never by an identifier, a number or another string.
      This is the assertion that catches the shipped defect: the lexer reads
      `"[&[data-state="` as a complete literal and then finds `dark`, and says
      so with the line and column. It is also the one that generalises, because
      every way of leaking a quote into a quoted literal produces exactly this.
   4. Brackets balance in code position. A stray one is a syntax error, and a
      count is the cheapest true statement about it.
   ============================================================ */
const FOLLOWS_STRING = /^[,;)\]}:+=<>?&|.\n]/;

export function assertStructure(source, rel) {
  const fail = (line, col, what) => {
    throw new Error(
      `${rel}:${line}:${col} — ${what}\n` +
        `  This file is GENERATED, so the edit is in scripts/emit-react.mjs (or in the definition it read), never ` +
        `here. \`build.mjs --check\` byte-compares this artefact and would not have noticed: a file the emitter ` +
        `writes wrong is byte-identical to a fresh render of the same wrongness.`
    );
  };
  let line = 1;
  let col = 1;
  const stack = [];
  const PAIR = { ")": "(", "]": "[", "}": "{" };
  for (let i = 0; i < source.length; i++) {
    const c = source[i];
    const at = [line, col];
    const step = (n) => {
      for (let k = 0; k < n; k++) {
        if (source[i + k] === "\n") { line++; col = 1; } else col++;
      }
      i += n - 1;
    };
    if (c === "\n") { line++; col = 1; continue; }
    if (c === "/" && source[i + 1] === "*") {
      const end = source.indexOf("*/", i + 2);
      if (end === -1) fail(...at, "a block comment is never closed.");
      step(end + 2 - i);
      continue;
    }
    if (c === "/" && source[i + 1] === "/") {
      const end = source.indexOf("\n", i);
      step((end === -1 ? source.length : end) - i);
      continue;
    }
    if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < source.length && source[j] !== c && source[j] !== "\n") j += source[j] === "\\" ? 2 : 1;
      if (j >= source.length || source[j] === "\n") fail(...at, `a ${c === '"' ? "double" : "single"}-quoted string is never closed on its line.`);
      const after = source.slice(j + 1).match(/^[ \t]*/)[0].length;
      const next = source.slice(j + 1 + after, j + 2 + after);
      if (next && !FOLLOWS_STRING.test(next)) {
        fail(
          line,
          col + (j - i) + 1 + after,
          `the string literal ${JSON.stringify(source.slice(i, j + 1))} is followed by \`${next}\`, which is not ` +
            `something a string literal may be followed by. The usual cause is a quote INSIDE the string that ` +
            `closed it early — which is exactly how dist/react/theme-toggle.tsx failed to parse at 2.6.0.`
        );
      }
      step(j + 1 - i);
      continue;
    }
    if (c === "`") {
      /* No substitutions are ever emitted (classLiteral refuses `${`), so a
         raw scan to the closing backtick is the whole grammar here. */
      let j = i + 1;
      while (j < source.length && source[j] !== "`") j += source[j] === "\\" ? 2 : 1;
      if (j >= source.length) fail(...at, "a template literal is never closed.");
      step(j + 1 - i);
      continue;
    }
    if (c === "(" || c === "[" || c === "{") { stack.push({ c, line, col }); col++; continue; }
    if (PAIR[c]) {
      const open = stack.pop();
      if (!open) fail(line, col, `a \`${c}\` closes a bracket that was never opened.`);
      if (open.c !== PAIR[c]) fail(line, col, `a \`${c}\` closes the \`${open.c}\` opened at ${open.line}:${open.col}.`);
      col++;
      continue;
    }
    col++;
  }
  if (stack.length) {
    const open = stack[stack.length - 1];
    fail(open.line, open.col, `a \`${open.c}\` is never closed.`);
  }
}

/* ---------- the provenance banner ---------- */
function header(def, rel) {
  /* Never `components/*` + `/definition.json` for the barrel: that substring
     closes the comment this string is inside, and the file stops parsing. The
     generated artefact is the only place that would have shown it. */
  const source = def ? `components/${def.id}/definition.json` : "the pilot definitions, components/<id>/definition.json";
  return (
    `/* GENERATED by scripts/build.mjs from ${source} — do not edit.\n` +
    `   Edit the definition and run \`npm run build\`; \`build.mjs --check\` byte-compares this file,\n` +
    `   so a hand-edit fails the build rather than being silently overwritten.\n\n` +
    `   Published as @yordan/design-system/react${def ? `/${def.id}` : ""} (${rel}).\n` +
    (def
      ? `   The element comes from the canonical HTML in components/${def.id}/spec.md, which\n` +
        `   design-system/README.md calls THE pattern rather than an example.\n`
      : `   The barrel. Every name below is generated; nothing is re-exported by hand.\n`) +
    `\n` +
    `   STYLING IS DATA, BEHAVIOUR IS CODE. There is no state, no effect, no event handler and\n` +
    `   no ARIA here, and none is coming — those are the consumer's, written by hand. This file\n` +
    `   is a class map, a type and an element.\n\n` +
    `   REQUIRES, from the consumer: tailwindcss v4 with @yordan/design-system/tokens.css and\n` +
    `   tokens.tailwind.css imported and this directory named in an @source; the peer packages\n` +
    `   class-variance-authority and react; and a build that transpiles TSX out of node_modules\n` +
    `   (Next: \`transpilePackages: ["@yordan/design-system"]\`). This package declares no\n` +
    `   dependencies of its own and installs nothing. */\n`
  );
}
