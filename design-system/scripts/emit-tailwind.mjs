#!/usr/bin/env node
/* ============================================================
   THE TAILWIND TIER — tokens/tokens.json → dist/tokens.tailwind.css,
   and the token→utility translation the React emitter shares with it.
   Zero dependencies; a template string, like scripts/emit-css.mjs.

   Phase R2a. This file holds ONE decision table (THEME_MAP + PLAIN) and
   everything else is derived from it, so the `@theme` block, the utility a
   generated component emits, and the mapping table printed in the artefact's
   own header can never disagree — they are three renderings of one object.

   ── THE RULE THAT SHAPES EVERYTHING: REFERENCE, NEVER RESTATE ──

   dist/tokens.css already emits every token four times over: the light value
   on :root, the dark values twice (media query + pinned [data-theme]), the
   print values under @media print and the wide values at the grid break. That
   file is the runtime. This one must not become a second copy of it, because a
   second copy is a second thing to keep in step — and the FIRST thing that
   would fall out of step is the theme, which is the half of the token layer
   this system is proudest of.

   So a theme entry is a REFERENCE:

       @theme { --color-content-primary: var(--content-primary); }

   Tailwind then emits `color: var(--color-content-primary)` for
   `text-content-primary`, which resolves through to `--content-primary`, which
   is whatever tokens.css says it is on this element — light, dark, pinned or
   printed. Dark mode reaches a Tailwind utility through exactly the mechanism
   it already reaches a hand-written CSS rule through, and this file contains no
   colour to fork. It contains no colour AT ALL: the only literal values in the
   whole artefact are the three font stacks, for the reason below.

   ── THE ONE EXCEPTION, AND WHY IT IS SAFE ──

   Tailwind derives the utility name from the variable name: to get `font-mono`
   you must declare `--font-mono`. Three of this system's tokens are ALREADY
   named for the namespace they belong in — `font-display`, `font-body`,
   `font-mono` — so `--font-mono: var(--font-mono)` would be a self-reference,
   which is a cycle and invalid at computed-value time. Those three restate
   their value instead. That is admissible for exactly one reason, and it is
   checked below rather than remembered: none of them carries a `dark`, `print`
   or `wide` value, so there is one value to copy, and both copies come out of
   this build from this source in the same run. `assertRestatable` fails the
   build the day one of them grows a mode.

   It also does the right thing on purpose: Tailwind ships its own default
   `--font-mono`, and a design system that did not override it would hand the
   consumer a different monospace stack from the one the vanilla site uses.

   ── WHY SOME TOKENS GET NO NAMESPACE AT ALL ──

   Three refusals, each of which would otherwise be a leak:

   1. THE RAW RAMPS. `color-stone`, `color-slate` and `color-ink` are 25 tokens
      and none of them enters `--color-*`. This system's first rule is that
      components may use only the semantic tier; `scripts/check-css.mjs` rule 3
      enforces it on the vanilla side by refusing a hex literal. Minting
      `bg-stone-500` would hand every consumer of this package the raw ramp as a
      first-class, autocompleted utility — the same leak, wearing Tailwind's
      clothes, and past a gate that only reads CSS. They stay plain custom
      properties in dist/tokens.css, where the semantic aliases still resolve
      through them.

   2. THE THINGS THAT ARE NOT VALUES OF THEIR NAMESPACE. `color-scheme` lands
      inside `--color-*` by pure coincidence of naming and is a CSS keyword
      (`light` / `dark`); admitting it would mint `bg-scheme`, whose value is
      the word "light". `accent-rgb` and `automata-cell-rgb` are bare channel
      triplets that exist to be recomposed at runtime. `text-code` and
      `text-unit` are `em` RATIOS — tokens.json calls them "ratios, not steps",
      meaning "a fraction of whatever set me", which no fixed utility can say.

   3. THE SHORTHANDS. `rule` and `rule-strong` are whole `border` values (width
      + style + colour, and `rule-strong` re-aliases in all three modes).
      Tailwind has no namespace for a border shorthand, so a component reaches
      one as the arbitrary property `[border:var(--rule-strong)]` — which keeps
      the token, and therefore keeps the mode behaviour.

   ── WHAT THE CONSUMER MUST DO ──

   Written here because it is not discoverable from the artefact:

     · `@import "tailwindcss"` FIRST, then dist/tokens.css, then this file.
     · dist/tokens.css is not optional. Every entry here is a reference into
       it; without it the utilities resolve to nothing.
     · `@source` must name this package's dist/react, or Tailwind will not scan
       it — node_modules is excluded from its default scan, and the generated
       components' classes would simply never be built.

   design-system/README.md, "The Tailwind tier", is the consumer-facing copy of
   that list.
   ============================================================ */

/* ============================================================
   1. THE DECISION TABLE
   ============================================================ */

/**
 * One entry per editorial group in tokens.json. `ns` is the Tailwind theme
 * namespace the group's tokens land in, or null to keep them plain custom
 * properties. `why` is required when `ns` is null, because a refusal that does
 * not say why reads as an oversight — and `renderThemeCss` prints it into the
 * artefact, so the reasoning ships with the file rather than only living here.
 *
 * `mode` is "reference" (the default and the rule) or "restate" (the font
 * exception, asserted below).
 */
export const THEME_MAP = {
  "color-stone": { ns: null, why: "raw ramp — the semantic tier is the only tier a component may use, and `bg-stone-500` would be that rule leaking past a gate that only reads CSS" },
  "color-slate": { ns: null, why: "raw ramp, same reason" },
  "color-ink": { ns: null, why: "raw ramp, same reason" },
  scheme: { ns: null, why: "`color-scheme` is a CSS keyword, not a colour; its name lands in --color-* by coincidence and `bg-scheme` would set a background to the word \"light\"" },
  surface: { ns: "color" },
  primary: { ns: "color" },
  content: { ns: "color" },
  chrome: { ns: "color" },
  action: { ns: "color" },
  accent: { ns: "color" },
  effect: { ns: "color" },
  automata: { ns: null, why: "an rgb channel triplet read by js/automata.js through getComputedStyle — a value with no CSS property to belong to" },
  font: { ns: "font", mode: "restate" },
  text: { ns: "text-step" },
  space: { ns: "spacing" },
  border: { ns: null, why: "whole `border` shorthands (width + style + colour). Tailwind has no namespace for one; a component reaches them as [border:var(--rule-strong)], which keeps the token and therefore keeps the theme" },
};

/**
 * Tokens held out of a group that IS mapped. Every one is a value that is not
 * a value of its namespace, which is a different refusal from the group-level
 * ones and is why it is a separate table.
 */
export const PLAIN = {
  "accent-rgb": "an rgb channel triplet for rgba() composition at runtime, not a colour",
  "text-code": "an em RATIO, not a step — \"a fraction of whatever set me\", which a fixed utility cannot express",
  "text-unit": "the same, for the unit suffix riding on a display number",
};

/* ============================================================
   2. NAMES

   The utility name IS the variable name minus its namespace, so these three
   functions are the whole public naming decision of this phase.
   ============================================================ */

/**
 * The `@theme` variable a token becomes, or null if it stays plain.
 *
 * `--color-*`   key is the token's own name         → bg-surface-page
 * `--spacing-*` key is the token's own name         → px-space-5, p-pad
 * `--text-*`    key is `step-` + the name minus `text-` → text-step-xs
 * `--font-*`    key IS the token name (restated)    → font-mono
 *
 * The spacing and type keys keep a word the namespace does not supply, and
 * that is deliberate rather than clumsy. `--spacing-3` would generate `p-3`
 * and SHADOW Tailwind's own numeric scale, silently redefining a class the
 * ecosystem already defines; `p-space-3` cannot be confused with it and names
 * the token it came from. `--text-xs` would shadow Tailwind's `text-xs` the
 * same way, and would additionally collide with this system's own `--text-xs`,
 * which carries `print` and `wide` values a restated copy could not follow.
 * "step" is tokens.json's own word for these thirteen.
 */
export function themeKeyOf(name, group) {
  if (PLAIN[name]) return null;
  const entry = THEME_MAP[group];
  if (!entry || entry.ns === null) return null;
  switch (entry.ns) {
    case "color":
      return `--color-${name}`;
    case "spacing":
      return `--spacing-${name}`;
    case "text-step":
      return `--text-step-${name.replace(/^text-/, "")}`;
    case "font":
      return `--${name}`;
    default:
      throw new Error(`THEME_MAP["${group}"].ns is "${entry.ns}", which emit-tailwind.mjs has no naming rule for`);
  }
}

/** The suffix a utility carries — the theme key minus its namespace prefix. */
export const utilitySuffix = (key) =>
  key.replace(/^--color-/, "").replace(/^--spacing-/, "").replace(/^--text-/, "").replace(/^--/, "");

/* ============================================================
   3. THE ARTEFACT
   ============================================================ */

/** Tailwind arbitrary values take `_` for a space; a real `_` would need escaping. */
export const arbitrary = (value) => String(value).replace(/"/g, "'").replace(/ /g, "_");

/**
 * Fail loudly if a restated group grows a mode. The restatement is only
 * defensible while there is exactly one value to copy; the day `font-mono`
 * gains a `dark`, this file would be shipping a value the theme cannot reach
 * and nothing else in the repo would notice.
 */
function assertRestatable(categories) {
  const bad = [];
  for (const { cat, vars } of categories) {
    if (THEME_MAP[cat]?.mode !== "restate") continue;
    for (const v of vars) {
      const modes = ["dark", "print", "wide"].filter((m) => v[m] !== undefined);
      if (modes.length) bad.push(`${cat}.${v.name} now carries ${modes.join(" + ")}`);
    }
  }
  if (bad.length) {
    throw new Error(
      `tokens.tailwind.css restates the \`${Object.entries(THEME_MAP).filter(([, e]) => e.mode === "restate").map(([c]) => c).join(", ")}\` ` +
        `group because its token names already occupy the Tailwind namespace and a reference would be a cycle. ` +
        `That is only safe while those tokens have ONE value: ${bad.join("; ")}. A restated copy cannot follow a ` +
        `mode, so either give the namespace a different key (as the type scale does with \`step\`) or take the group ` +
        `out of @theme. See the header of scripts/emit-tailwind.mjs.`
    );
  }
}

/** Every category in tokens.json must have a decision, and every decision a category. */
function assertCensus(categories) {
  const groups = categories.map((c) => c.cat);
  const problems = [];
  for (const g of groups) {
    if (!THEME_MAP[g]) problems.push(`tokens.json has a group \`${g}\` that THEME_MAP does not classify — decide its namespace, or give it \`ns: null\` with a \`why\``);
  }
  for (const g of Object.keys(THEME_MAP)) {
    if (!groups.includes(g)) problems.push(`THEME_MAP classifies \`${g}\`, which is no longer a group in tokens.json — prune it in the same commit`);
  }
  for (const [g, e] of Object.entries(THEME_MAP)) {
    if (e.ns === null && !e.why) problems.push(`THEME_MAP["${g}"] refuses a namespace and says nothing about why — a refusal with no reason reads as an oversight`);
  }
  const names = new Set(categories.flatMap((c) => c.vars.map((v) => v.name)));
  for (const n of Object.keys(PLAIN)) {
    if (!names.has(n)) problems.push(`PLAIN holds \`${n}\` out of @theme, and no token of that name exists any more`);
  }
  if (problems.length) {
    throw new Error(`the Tailwind theme map and tokens.json disagree:\n  - ${problems.join("\n  - ")}`);
  }
}

/**
 * dist/tokens.tailwind.css.
 * @param {{cat: string, doc: string, vars: {name: string, value: string, dark?: string, print?: string, wide?: string}[]}[]} categories
 */
export function renderThemeCss(categories) {
  assertCensus(categories);
  assertRestatable(categories);

  const rows = [];
  const held = [];
  for (const { cat, vars } of categories) {
    const entry = THEME_MAP[cat];
    if (entry.ns === null) {
      held.push(`${cat} (${vars.length}) — ${entry.why}`);
      continue;
    }
    const lines = [];
    for (const v of vars) {
      const key = themeKeyOf(v.name, cat);
      if (!key) continue;
      lines.push(`  ${key}: ${entry.mode === "restate" ? v.value : `var(--${v.name})`};`);
    }
    const skipped = vars.filter((v) => PLAIN[v.name]);
    rows.push({ cat, ns: entry.ns, mode: entry.mode ?? "reference", lines, skipped });
  }

  const mapped = rows.reduce((n, r) => n + r.lines.length, 0);
  const total = categories.reduce((n, c) => n + c.vars.length, 0);

  /* The mapping table is GENERATED from the same object the emission is, so it
     cannot describe a mapping the file does not have. */
  const table = [
    `   | group | namespace | how |`,
    `   | --- | --- | --- |`,
    ...categories.map(({ cat, vars }) => {
      const e = THEME_MAP[cat];
      if (e.ns === null) return `   | ${cat} (${vars.length}) | — stays a plain custom property | ${e.why} |`;
      const n = vars.filter((v) => themeKeyOf(v.name, cat)).length;
      const ns = e.ns === "text-step" ? "--text-step-*" : `--${e.ns}-*`;
      return `   | ${cat} (${n} of ${vars.length}) | ${ns} | ${e.mode === "restate" ? "restated — the key IS the token name, so a reference would be a cycle" : "var() reference to the runtime token"} |`;
    }),
  ].join("\n");

  const heldOut = Object.entries(PLAIN).map(([n, why]) => `   · ${n} — ${why}`).join("\n");

  let out =
    `/* GENERATED by scripts/build.mjs from tokens/tokens.json — do not edit.\n` +
    `   Edit tokens/tokens.json and run \`npm run build\`.\n\n` +
    `   Published as @yordan/design-system/tokens.tailwind.css. The Tailwind v4 half of\n` +
    `   this system's token layer: it binds Tailwind's @theme namespaces to the custom\n` +
    `   properties dist/tokens.css already defines. \`--check\` byte-compares this file.\n\n` +
    `   IT CONTAINS NO COLOUR, SIZE OR SPACING VALUE. ${mapped} of ${total} tokens are mapped, and all\n` +
    `   but the three font stacks are a \`var()\` REFERENCE rather than a copy. That is the\n` +
    `   whole design: dark, pinned-theme, print and wide-viewport values are emitted by\n` +
    `   dist/tokens.css and reach a Tailwind utility through the same cascade they reach a\n` +
    `   hand-written rule through. There is nothing here to fork, because there is nothing\n` +
    `   here to copy.\n\n` +
    `   THE THREE FONT FAMILIES ARE THE EXCEPTION, and it is a naming one. Tailwind takes\n` +
    `   the utility name from the variable name, so \`font-mono\` requires \`--font-mono\` —\n` +
    `   which is already this system's token name, making a reference a self-cycle. Those\n` +
    `   three restate their value, which is safe only because none carries a dark, print or\n` +
    `   wide value; the build fails the day one does.\n\n` +
    `   THE MAPPING:\n\n${table}\n\n` +
    `   HELD OUT OF A MAPPED GROUP, because they are not values of their namespace:\n\n${heldOut}\n\n` +
    `   WHAT A CONSUMER MUST DO:\n` +
    `     1. @import "tailwindcss";           (first — it declares the layers)\n` +
    `     2. @import "@yordan/design-system/tokens.css";      (the runtime values — NOT optional)\n` +
    `     3. @import "@yordan/design-system/tokens.tailwind.css";  (this file)\n` +
    `     4. @source "…/@yordan/design-system/dist/react";    (Tailwind does not scan node_modules,\n` +
    `        and without this the generated components' classes are never built)\n` +
    ` */\n@theme {\n`;

  rows.forEach((r, i) => {
    out += `${i ? "\n" : ""}  /* --- ${r.cat} → ${r.ns === "text-step" ? "--text-step-*" : `--${r.ns}-*`}, ${r.mode} --- */\n`;
    out += r.lines.join("\n") + "\n";
    for (const v of r.skipped) out += `  /* ${v.name}: held out — ${PLAIN[v.name]} */\n`;
  });
  out += `}\n`;
  return out;
}

/* ============================================================
   4. THE TRANSLATOR — a definition's declarations → Tailwind classes.

   Shared with scripts/emit-react.mjs so a token binding becomes the same
   utility in a component as the one this file's @theme block defines. Every
   property the three pilot definitions use is named here; anything else falls
   through to Tailwind's arbitrary-property form, which is faithful by
   construction, and the build REPORTS how many did so rather than letting the
   fallback quietly become the rule.
   ============================================================ */

/** Structural keywords whose Tailwind utility is a fixed word. */
const KEYWORD = {
  display: { "inline-block": "inline-block", flex: "flex", block: "block", grid: "grid", "inline-flex": "inline-flex" },
  "text-align": { center: "text-center", left: "text-left", right: "text-right" },
  "white-space": { nowrap: "whitespace-nowrap", normal: "whitespace-normal" },
  cursor: { pointer: "cursor-pointer", default: "cursor-default" },
  "text-transform": { uppercase: "uppercase", lowercase: "lowercase", capitalize: "capitalize", none: "normal-case" },
  "flex-wrap": { wrap: "flex-wrap", nowrap: "flex-nowrap" },
  "font-weight": { 400: "font-normal", 500: "font-medium", 600: "font-semibold", 700: "font-bold", 800: "font-extrabold", 900: "font-black" },
  "font-style": { italic: "italic", normal: "not-italic" },
};

/** Which Tailwind prefix a colour property wears. */
const COLOUR_PROP = { color: "text", background: "bg", "background-color": "bg", "border-color": "border" };

/** A box property, and its per-edge prefixes for 1/2/3/4-value shorthands. */
const BOX_PROP = { padding: "p", margin: "m" };
const EDGES = { 1: [""], 2: ["y", "x"], 3: ["t", "x", "b"], 4: ["t", "r", "b", "l"] };

const isToken = (v) => v && typeof v === "object" && typeof v.token === "string";

/**
 * One declaration → the Tailwind classes that express it.
 * @param {string} prop
 * @param {string|object|Array} value  the three definition value forms
 * @param {(name: string) => string|null} keyOf  token name → its @theme key
 * @param {string} where  for error messages
 * @returns {{classes: string[], arbitrary: boolean}}
 */
export function utilitiesFor(prop, value, keyOf, where) {
  const suffix = (name) => {
    const key = keyOf(name);
    if (!key) {
      throw new Error(
        `${where}: \`${prop}\` binds \`--${name}\`, which is deliberately NOT in the Tailwind @theme — see PLAIN / ` +
          `THEME_MAP in scripts/emit-tailwind.mjs. Reach it as an arbitrary value, or give it a namespace there.`
      );
    }
    return utilitySuffix(key);
  };
  const one = (classes) => ({ classes, arbitrary: false });

  /* A keyword with a known utility. */
  if (KEYWORD[prop] && typeof value === "string" && KEYWORD[prop][value] !== undefined) {
    return one([KEYWORD[prop][value]]);
  }

  /* A colour. */
  if (COLOUR_PROP[prop] && isToken(value)) return one([`${COLOUR_PROP[prop]}-${suffix(value.token)}`]);

  /* A family and a size, each of which has its own namespace. */
  if (prop === "font-family" && isToken(value)) return one([`font-${value.token.replace(/^font-/, "")}`]);
  if (prop === "font-size" && isToken(value)) return one([`text-${suffix(value.token)}`]);

  /* Padding and margin, per edge. `0` is Tailwind's own zero rather than a token. */
  if (BOX_PROP[prop]) {
    const parts = Array.isArray(value) ? value : [value];
    const edges = EDGES[parts.length];
    if (!edges) throw new Error(`${where}: \`${prop}\` has ${parts.length} values, and only 1..4 are a CSS shorthand`);
    return one(
      parts.map((p, i) => {
        const head = `${BOX_PROP[prop]}${edges[i]}`;
        if (isToken(p)) return `${head}-${suffix(p.token)}`;
        if (String(p) === "0") return `${head}-0`;
        return `${head}-[${arbitrary(p)}]`;
      })
    );
  }

  if (prop === "gap" && isToken(value)) return one([`gap-${suffix(value.token)}`]);

  /* `border` in both of its forms: composed from parts, or a whole shorthand token. */
  if (prop === "border") {
    if (isToken(value)) return { classes: [`[border:var(--${value.token})]`], arbitrary: true };
    if (Array.isArray(value)) {
      const out = [];
      for (const part of value) {
        if (isToken(part)) { out.push(`border-${suffix(part.token)}`); continue; }
        const s = String(part);
        if (/^(solid|dashed|dotted|double|none|hidden)$/.test(s)) { out.push(`border-${s}`); continue; }
        out.push(s === "1px" ? "border" : `border-[${arbitrary(s)}]`);
      }
      return one(out);
    }
  }

  /* Tracking has a namespace of its own and takes the value verbatim. */
  if (prop === "letter-spacing" && typeof value === "string") return one([`tracking-[${arbitrary(value)}]`]);

  /* Everything else, faithfully. Tailwind's arbitrary PROPERTY form emits the
     declaration exactly as authored — which is why `transition` uses it rather
     than `transition-[…] duration-200`: that pair would also apply Tailwind's
     default timing function, and the authored rule has none. A shorter class
     that changes a curve is not a translation. */
  const flat = Array.isArray(value)
    ? value.map((v) => (isToken(v) ? `var(--${v.token})` : String(v))).join(" ")
    : isToken(value)
      ? `var(--${value.token})`
      : String(value);
  return { classes: [`[${prop}:${arbitrary(flat)}]`], arbitrary: true };
}

/** `:hover` → `hover:`. Named rather than derived, so an unknown state is loud. */
export const STATE_PREFIX = {
  ":hover": "hover:",
  ":focus": "focus:",
  ":focus-visible": "focus-visible:",
  ":active": "active:",
  ":disabled": "disabled:",
  "[disabled]": "disabled:",
};
