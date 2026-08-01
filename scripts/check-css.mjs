#!/usr/bin/env node
/* ============================================================
   Stylesheet gate — zero dependencies.

   `node scripts/check-css.mjs`

   Seven rules that the design system states in prose and, until now,
   nothing enforced. Prose does not survive contact with a deadline:
   the colour half of the token layer held for months because every
   colour had a semantic name and no ramp value was reachable outside
   tokens.json, while the TYPE half rotted to 89 font-size declarations
   at 40 distinct values — fourteen of them inside a single 0.34rem
   band, rendering at 1280px as 10.88 / 11.2 / 11.52 / 12.48 / 12.8 /
   13.6 / 14.08 / 14.4 / 14.72px. Nobody chose those. They accumulated,
   because nothing said no.

   WHY THIS LIVES HERE AND NOT IN design-system/scripts/build.mjs.
   The rules span the design system AND the site's four page
   stylesheets and js/. `build.mjs` is the root of the dependency
   graph (ARCHITECTURE.md) and must not read outside its own slice —
   check-boundaries.mjs asserts exactly that. `scripts/` is the layer
   that legitimately sees the whole repo, so a cross-slice assertion
   belongs here. build.mjs keeps what is derivable from its own
   sources: token emission, component coverage, the spec↔CSS contract.

   THE RULES

   1. No literal `font-size` in components.css or a page stylesheet.
      1b. And none for the three type tiers R4 minted —
      `font-weight`, `letter-spacing`, `font-variation-settings`.
      Every size is a `--text-*` step, or the keyword `inherit` — an
      inherited size is a relationship, not a value, and the scale is
      whatever the parent already picked.
      1c. And none for the motion tier: a `transition`'s duration,
      delay and timing function are `--motion-*` / `--ease-*`. Zero
      and `linear` are exempt for the reason zero is exempt on the
      spacing ramp; `animation` is deliberately out of scope; and the
      four surviving one-off durations are REGISTERED with the reason
      each is not a register, so the list cannot grow quietly.

   2. No `prefers-color-scheme` outside design-system/dist/. A colour
      that differs in dark is a token with a `dark` value; the build
      emits the query. js/theme.js is the one sanctioned exception:
      it is the control that READS the preference.

   3. No hex / rgb() / hsl() literal in components.css, css/ or js/.
      Composition through a token — `rgba(var(--accent-rgb), 0.4)` in
      CSS, `rgba(${palette.cell}, ${a})` in JS — is the supported way
      to build a colour at runtime and is allowed.

   4. No `border`, and no px width/height, on a skeleton selector.
      Borders change fr-track math; inset box-shadows do not. See
      design-system/components/skeleton/spec.md.

   5. At most one `.btn--solid` per shipped page. The chat composer's
      submit is exempt: it is the primary action of its own surface
      and the chat spec canonises it as `.btn.btn--solid.chat__send`.

   6. A floor on the automata's lattice step, and a ceiling on its
      off-stage padding. The squares are not divs any more, so there
      is no node weight left to bound — but a rail's SIMULATED cell
      count goes as 1/cell², and `--space-6` is both the lattice and
      the top step of the component spacing ramp. So a change made for
      a chip's padding has a quadratic cost in a canvas on the other
      side of the repo, which is the one change class here whose blast
      radius nobody would predict from reading the diff. See the block
      at the bottom for the arithmetic.

   NOT CHECKED, DELIBERATELY: literal spacing. `mm` in cv.css's print
   block is a physical fact about a sheet of A4, not a step on a
   rhythm ramp, and `padding-bottom: 2px` under a text underline is an
   optical offset. A rule that flagged those would be wrong more often
   than right, and a gate people learn to override is worse than none.
   ============================================================ */
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const rel = (p) => relative(root, p).split(sep).join("/");

/* ---------- what we look at ---------- */
const STYLESHEETS = [
  join(root, "design-system", "css", "components.css"),
  ...(existsSync(join(root, "css"))
    ? readdirSync(join(root, "css"))
        .filter((f) => f.endsWith(".css"))
        .sort()
        .map((f) => join(root, "css", f))
    : []),
];

const SKIP_JS_DIRS = new Set(["vendor", "node_modules"]);
function jsFiles(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith(".") || SKIP_JS_DIRS.has(e.name)) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) jsFiles(p, out);
    else if (/\.(mjs|js|cjs)$/.test(e.name)) out.push(p);
  }
  return out;
}
/* A generated file is not a place anyone can fix a violation, and its
   content is prose from another slice: js/case-studies.js quotes the
   string "prefers-color-scheme" inside a <code> tag, in a case study
   ABOUT not having one. Gate the sources, not the outputs. */
const isGenerated = (src) => /generated\b[\s\S]{0,60}do not edit|GENERATED by/i.test(src.slice(0, 600));

const SITE_JS = jsFiles(join(root, "js")).filter((f) => !isGenerated(readFileSync(f, "utf8")));
/* js/theme.js is the theme CONTROL: reading the OS preference is its job. */
const PCS_EXEMPT = new Set(["js/theme.js"]);

const HTML_PAGES = readdirSync(root)
  .filter((f) => f.endsWith(".html"))
  .sort()
  .map((f) => join(root, f));

/* ---------- helpers ----------
   Comments are blanked rather than removed, so every offset below still
   maps to a real line in the real file — a gate that reports the wrong
   line number is a gate people stop reading. */
const blankComments = (s) =>
  s.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
   .replace(/(^|[^:])\/\/[^\n]*/g, (m, p1) => p1 + " ".repeat(m.length - p1.length));

const lineAt = (src, index) => src.slice(0, index).split("\n").length;

/* A brace walk, not a regex: a regex cannot tell `@media (…) {` from a rule
   and would report `50%` inside @keyframes as a selector. Yields every
   declaration with the selector that owns it. */
function declarations(src) {
  const out = [];
  const stack = [];
  let buf = "";
  let start = 0;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (ch === "{") {
      const prelude = buf.trim();
      buf = "";
      start = i + 1;
      stack.push(
        prelude.startsWith("@")
          ? { type: prelude.startsWith("@keyframes") ? "keyframes" : "at", sel: prelude }
          : { type: "rule", sel: prelude.replace(/\s+/g, " ") }
      );
    } else if (ch === ";" || ch === "}") {
      const text = buf.trim();
      const top = stack[stack.length - 1];
      if (text && top && top.type === "rule") {
        const c = text.indexOf(":");
        if (c > 0) {
          out.push({
            prop: text.slice(0, c).trim().toLowerCase(),
            value: text.slice(c + 1).trim(),
            sel: top.sel,
            index: start + buf.length - buf.trimStart().length,
          });
        }
      }
      buf = "";
      start = i + 1;
      if (ch === "}") stack.pop();
    } else {
      buf += ch;
    }
  }
  return out;
}

const problems = [];
const at = (file, src, index) => `${rel(file)}:${lineAt(src, index)}`;

/* ============ 1. literal font-size ============ */
const FONT_SIZE_OK = /^(var\(\s*--[a-z0-9-]+\s*(,[^)]*)?\)|inherit|initial|unset|revert|revert-layer)$/i;
let sizedDecls = 0;

for (const file of STYLESHEETS) {
  const raw = readFileSync(file, "utf8");
  const src = blankComments(raw);
  for (const d of declarations(src)) {
    if (d.prop === "font-size") {
      sizedDecls++;
      if (!FONT_SIZE_OK.test(d.value.replace(/\s*!important$/, ""))) {
        problems.push(
          `${at(file, raw, d.index)}  \`${d.sel} { font-size: ${d.value} }\` is a literal size.\n` +
            `      Use a --text-* step from design-system/tokens/tokens.json. If no step fits, add one there — ` +
            `a size that exists in only one place is drift, not a decision.`
        );
      }
    }
    /* The `font` shorthand can smuggle a size in. `font: inherit` cannot. */
    if (d.prop === "font" && /\d/.test(d.value)) {
      problems.push(
        `${at(file, raw, d.index)}  \`${d.sel} { font: ${d.value} }\` sets a size through the shorthand — ` +
          `use \`font-size: var(--text-*)\` so the gate can see it.`
      );
    }
  }
}

/* ============ 1b. the other three type tiers ============
   R4 minted `--weight-*`, `--tracking-*` and `--width-*`, so three more
   properties joined `font-size` in having a token tier — and a tier that is
   not enforced is a suggestion. The file carried 33 bare `font-weight`
   numbers at six values, 28 `letter-spacing` values at nine, and 13
   `font-variation-settings` axis settings at six: the same shape the type
   scale had at 89 declarations and 40 values, one tier down.

   `line-height` is deliberately NOT here, and the reason is a condition
   rather than a preference: twelve distinct values across nineteen
   declarations is drift to be consolidated before it is tokenised, not drift
   to be enshrined in tokens.json. A tier of twelve steps with one consumer
   each fails the rule that retired `action`. When it is consolidated it gets a
   tier, and this list gets a fourth row on the same day. */
let tieredDecls = 0;
const TIERS = [
  { prop: "font-weight", tier: "--weight-*", what: "six weight steps" },
  { prop: "letter-spacing", tier: "--tracking-*", what: "two tracking families" },
  { prop: "font-variation-settings", tier: "--width-*", what: "six display-width steps" },
];
/* `0` and `normal` are the same exemption zero gets on the spacing side: they
   are not steps on a ramp, they are the absence of one. `.tools__row dt`
   cancelling the tracking it inherits is a relationship, not a value. */
const TIER_OK = /^(var\(\s*--[a-z0-9-]+\s*(,[^)]*)?\)|inherit|initial|unset|revert|revert-layer|normal|none|0|0em)$/i;

for (const file of STYLESHEETS) {
  const raw = readFileSync(file, "utf8");
  const src = blankComments(raw);
  for (const d of declarations(src)) {
    const tier = TIERS.find((t) => t.prop === d.prop);
    if (!tier) continue;
    tieredDecls++;
    if (TIER_OK.test(d.value.replace(/\s*!important$/, ""))) continue;
    problems.push(
      `${at(file, raw, d.index)}  \`${d.sel} { ${d.prop}: ${d.value} }\` is a literal. ` +
        `R4 gave this property a token tier — pick a \`${tier.tier}\` step (${tier.what}) from ` +
        `design-system/tokens/tokens.json, or add one there if none fits. A value that exists in only ` +
        `one place is drift, not a decision.`
    );
  }
}

/* ============ 1c. the motion tier ============
   The fourth row of the same table, and it arrived the same way the other
   three did: a tier was minted, so the reason a literal was the honest answer
   expired and the exemption with it. Before the tier, components.css carried
   every duration and every curve as a number — `0.2s` twenty-five times as a
   transition duration, `0.28s` twelve, `cubic-bezier(0.22, 1, 0.36, 1)` five,
   `ease` four — which is the shape the type scale had at 40 sizes, one tier
   down. `--motion-state`, `--motion-arrive`, `--ease-arrive` and `--ease-fade`
   are the four names the owner approved for it.

   WHAT IS ALLOWED LITERALLY, and each is a condition rather than a taste:

   · `0s` / `0ms` — the same exemption zero gets on the spacing ramp. Zero is
     not a step, it is the absence of one, and `.menu[data-open] {
     transition-delay: 0s }` is cancelling a delay rather than choosing a
     duration.
   · `linear` — a straight line is the absence of a curve. It is also load
     bearing in `transition: visibility 0s linear var(--motion-arrive)`, where
     the only reason a timing function is written at all is that the DELAY is
     the fourth position of the shorthand and cannot be reached past it.
   · `none`, and the CSS-wide keywords.

   WHAT THIS DELIBERATELY DOES NOT COVER, said out loud because a gate's
   silence reads as permission. `animation` — its duration, its delay and its
   `steps()`. A keyframe loop's period is the animation's own rhythm and not a
   step on any ramp: `blink` is 2.4s because that is how long a caret is dark,
   `chat-life` is 1.6s because that is the pulse, `theme-dial` is 9s because
   that is how slowly the lamp should turn. And `.chat__cell`'s 0.2 / 0.4 / 0.6
   `animation-delay`s are a STAGGER — three steps of one sequence, of which the
   first coincides with the state register by arithmetic rather than by
   meaning. Rebinding it would assert that the third square waits for the same
   reason a hover ink changes. If a motion tier for loops is ever wanted it is
   a different tier, minted against a different measurement.

   THE FOUR SURVIVING LITERALS ARE REGISTERED, NOT TOLERATED. Each is a
   duration with one consumer, which is the drift this system's own rule
   retires rather than enshrines — the same argument that keeps `line-height`
   out of a tier. Consolidating them into the registers is an APPEARANCE
   decision and therefore the owner's, so each sits below with the reason it
   survived, and the register is two-sided: an unregistered literal fails, and
   a registered one that is no longer found fails too. They are on
   design-system/PATTERNS.md's review list. */
const MOTION_PROPS = /^transition(-duration|-timing-function|-delay)?$/;
const DURATION = /(?<![\w.])-?[\d.]+m?s(?![\w])/g;
const TIMING = /\b(ease(-in|-out|-in-out)?|cubic-bezier\([^)]*\)|steps\([^)]*\))/g;
const MOTION_OK = /^(0m?s|linear|none|inherit|initial|unset|revert|revert-layer)$/i;

/* One line per surviving literal: where it is, what it is, and why it is not a
   register. `value` is matched against the LITERAL, not the declaration, so a
   second `0.25s` arriving on another selector is a new decision and fails. */
const MOTION_EXEMPT = [
  {
    where: "design-system/css/components.css",
    sel: ".theme__lamp",
    literal: "0.3s",
    why: "the lamp's own fill cross-fades slower than a control changes state, because it is reading as a dial turning rather than as a button acknowledging a press. One consumer; folding it into `--motion-arrive` would be a look decision.",
  },
  {
    where: "design-system/css/components.css",
    sel: ".peek",
    literal: "0.18s",
    why: "the cursor panel follows the pointer, so its fade is deliberately faster than the state register — a panel chasing a mouse at 0.2s reads as lag. One consumer.",
  },
  {
    where: "design-system/css/components.css",
    sel: ".idx__row::before",
    literal: "0.25s",
    why: "the ink bar wipes across the row rather than changing state, so it travels on `--ease-arrive` at a duration between the two registers. One consumer.",
  },
  {
    where: "css/style.css",
    sel: ".tx__big",
    literal: "0.25s",
    why: "the contact line's hover, the one place on the site where a colour change is the size of a headline. One consumer, and the same number as the ink bar by coincidence rather than by decision — which is exactly why neither is a register.",
  },
];

let motionDecls = 0;
for (const file of STYLESHEETS) {
  const raw = readFileSync(file, "utf8");
  const src = blankComments(raw);
  for (const d of declarations(src)) {
    if (!MOTION_PROPS.test(d.prop)) continue;
    motionDecls++;
    /* A `var()` is blanked before the scan, and it has to be: `--ease-fade` is
       a token name that contains the word this rule is looking for, so a
       correctly bound declaration would report itself as a literal `ease`. */
    const scrubbed = d.value.replace(/var\(\s*--[a-z0-9-]+\s*(,[^)]*)?\)/gi, " ");
    const literals = [...(scrubbed.match(DURATION) ?? []), ...(scrubbed.match(TIMING) ?? [])];
    for (const lit of literals) {
      if (MOTION_OK.test(lit)) continue;
      const exempt = MOTION_EXEMPT.find((e) => e.where === rel(file) && e.sel === d.sel && e.literal === lit);
      if (exempt) {
        exempt.$found = true;
        continue;
      }
      problems.push(
        `${at(file, raw, d.index)}  \`${d.sel} { ${d.prop}: ${d.value} }\` writes \`${lit}\` literally. ` +
          `Motion has a token tier — \`--motion-state\` for a control acknowledging you, \`--motion-arrive\` for a ` +
          `surface arriving or leaving, \`--ease-arrive\` for travel and \`--ease-fade\` for an opacity. Pick one, ` +
          `or add a register to design-system/tokens/tokens.json if neither event is what this is. A duration that ` +
          `exists in only one place is drift, not a decision — and if it IS deliberate, register it in ` +
          `MOTION_EXEMPT in the rule-1c block of scripts/check-css.mjs with the reason, in the same commit.`
      );
    }
  }
}
for (const e of MOTION_EXEMPT.filter((e) => !e.$found)) {
  problems.push(
    `rule 1c registers \`${e.literal}\` on \`${e.sel}\` in ${e.where} as a surviving motion literal, and it is no ` +
      `longer there. A registered exemption that has stopped being true is one somebody should be told has gone: ` +
      `prune the line in the same commit, and check whether the owner's review list still needs the entry.`
  );
}

/* ============ 2. prefers-color-scheme ============ */
for (const file of [...STYLESHEETS, ...SITE_JS]) {
  if (PCS_EXEMPT.has(rel(file))) continue;
  const raw = readFileSync(file, "utf8");
  const src = blankComments(raw);
  const i = src.indexOf("prefers-color-scheme");
  if (i !== -1) {
    problems.push(
      `${at(file, raw, i)}  mentions \`prefers-color-scheme\`. Dark is a token, not a query: ` +
        `add a \`dark\` value beside the light one in tokens.json and the build emits both the media query ` +
        `and the pinned-theme override. (design-system/dist/ and js/theme.js are the only places it may appear.)`
    );
  }
}

/* ============ 3. colour literals ============ */
const HEX = /#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3,4})(?![0-9a-z_-])/gi;
const FUNC = /\b(rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\((?:[^()]|\([^()]*\))*\)/gi;

for (const file of [...STYLESHEETS, ...SITE_JS]) {
  const raw = readFileSync(file, "utf8");
  const src = blankComments(raw);
  for (const m of src.matchAll(HEX)) {
    problems.push(
      `${at(file, raw, m.index)}  hex literal \`${m[0]}\`. Colours are born in tokens.json and reach here as \`var(--…)\`.`
    );
  }
  for (const m of src.matchAll(FUNC)) {
    const composed = m[0].includes("var(") || m[0].includes("${");
    if (!composed && /\d/.test(m[0])) {
      problems.push(
        `${at(file, raw, m.index)}  colour literal \`${m[0]}\`. Compose from a token — ` +
          `\`rgba(var(--accent-rgb), 0.4)\` — or add the colour to tokens.json.`
      );
    }
  }
}

/* ============ 4. skeleton: no borders, no px sizes ============ */
const SKELETON = /\.(sheet|band|rail|well|strip|sq)\b/;
const ZEROISH = /^(0|none|0\s+none|unset|initial)$/i;

for (const file of STYLESHEETS) {
  const raw = readFileSync(file, "utf8");
  const src = blankComments(raw);
  for (const d of declarations(src)) {
    if (!SKELETON.test(d.sel)) continue;
    if (/^border(-(top|right|bottom|left|block|inline|width|style|color))?$/.test(d.prop) && !ZEROISH.test(d.value)) {
      problems.push(
        `${at(file, raw, d.index)}  \`${d.sel} { ${d.prop}: ${d.value} }\` — the skeleton never uses borders. ` +
          `A border changes the fr-track math; an inset box-shadow does not. See design-system/components/skeleton/spec.md.`
      );
    }
    if (/^(min-|max-)?(width|height)$/.test(d.prop) && /\d\s*px/.test(d.value)) {
      problems.push(
        `${at(file, raw, d.index)}  \`${d.sel} { ${d.prop}: ${d.value} }\` — skeleton elements derive every ` +
          `dimension from the band's fr tracks. A px size here desynchronises the squares from the layout.`
      );
    }
  }
}

/* ============ 5. one .btn--solid per page ============ */
const CLASS_ATTR = /class="([^"]*)"/g;
const solidCounts = [];
for (const file of HTML_PAGES) {
  const raw = readFileSync(file, "utf8");
  let n = 0;
  for (const m of raw.matchAll(CLASS_ATTR)) {
    const cls = m[1].split(/\s+/);
    if (cls.includes("btn--solid") && !cls.includes("chat__send")) n++;
  }
  solidCounts.push([rel(file), n]);
  if (n > 1) {
    problems.push(
      `${rel(file)} has ${n} \`.btn--solid\` outside the chat composer. One primary action per view — ` +
        `demote the others to \`.btn\`. (design-system/components/button/spec.md)`
    );
  }
}

/* ============ 6. the automata's simulation budget ============
   This rule replaces a ceiling on `vc`, the automata's visible column count.
   That constant no longer exists, and neither does the thing it was standing
   in for. The squares were 508 real divs, 58.9% of index.html's nodes, and
   `vc` was a usable proxy for that node weight. They are one canvas per
   region now, so the proxy has nothing left to proxy — but the simulation
   did not get smaller, it got FINER, and its two inputs are still static.

   WHAT THE COST IS A FUNCTION OF, from js/automata.js `build()`:

     cell = the lattice step, read off the lattice root's background-size,
            which is --space-6 and nothing else
     cols = ceil((width  + phaseX) / cell)
     rows = ceil((height + phaseY) / cell)

     rail    simC = cols + HIDDEN,  simR = max(rows, MIN_SIM)
     strip   simC = cols,           simR = rows + HIDDEN

   Substituting what the CSS makes those widths (components/skeleton/spec.md):

     rail    width  = round(down, band/12, cell)     →  cols = band/(12·cell)
             height = the band row, set by the well  →  rows = bandHeight/cell
             cells  = (band/(12·cell) + HIDDEN) · bandHeight/cell     ∝ 1/cell²

     strip   width  = the sheet, a whole number of cells → cols = sheet/cell
             height = calc(var(--space-6) * 4)            → rows = 4, ALWAYS
             cells  = sheet/cell · (4 + HIDDEN)                       ∝ 1/cell

   So a rail is quadratic in 1/cell and a strip is linear — the same split the
   old rule had, for a completely different reason. The strip is linear because
   its height is a stated multiple of the cell, so shrinking the cell shrinks
   the strip too; only its width survives the division. The rail's height is
   its content's, which does not shrink, so both of its terms move.

   Per sim cell the engine holds six Uint8Arrays (a, b, age, blue, blueB,
   wall) and per VISIBLE cell one Int32Array entry — 6 bytes and 4 bytes. The
   cost is arithmetic and backing store, both linear in the cell counts above,
   which is why bounding the two inputs bounds the whole thing without this
   gate needing to run a browser. It cannot run one: every cell is created at
   runtime and appears in no shipped artefact.

   No total is quoted here on purpose. A total needs band heights, which are
   the content's and move whenever a word is added; the two proportionalities
   above are arithmetic and cannot be falsified by a re-measure. That is the
   distinction this programme learned the expensive way.

   WHY A FLOOR ON --space-6 IS THE HIGHER-VALUE HALF. It has two audiences.
   It is the lattice, and it is the top step of the fixed 4px spacing ramp for
   space INSIDE a component — the token's own $doc says so. Nothing about
   tightening a chip's padding suggests you are also about to quadruple a
   simulation in a canvas, and the old rule could not have caught it: `vc` was
   read by the automata alone. This one guards a token whose two readers have
   no reason to know about each other. */
const AUTOMATA = join(root, "js", "automata.js");
const TOKENS = join(root, "design-system", "tokens", "tokens.json");

/* Both bounds are one deliberate step from where the repo sits, so that a
   one-character edit cannot pass but a considered change is still available:
   raise the number here, in the same commit, with the arithmetic redone.

   LATTICE_FLOOR_REM — 1.25rem is `space-5`, the next step DOWN the same ramp.
   1.5 → 1.25 costs every rail ×(1.5/1.25)² = 1.44. One halving, 1.5 → 0.75,
   costs ×4. A floor rather than a window because the risk is one-directional:
   a bigger cell is strictly cheaper.

   HIDDEN_MAX — off-stage padding is pure cost; it appears in no picture. Its
   share of a rail's simulation is HIDDEN/(cols + HIDDEN), and a rail's
   visible columns are 1 / 2 / 3 / 4 / 5 at 375 / 768 / 1024 / 1280 / 1440+
   (the measured table in components/skeleton/spec.md). At HIDDEN = 4 that
   share is 4/8 = 50% at 1280 and 4/9 = 44% at 1440. At 5 it is 5/9 = 56% at
   1280 — past half at the commonest desktop width, which is precisely the
   regression that took this constant from 6 down to 3. So 4 is the largest
   value that keeps off-stage at or below half on desktop, and 3, the value in
   the file, is the geometric floor derived in automata.js above it: a
   glider's bounding box is 3×3, and at 2 the off-stage band cannot hold one
   without it touching both visible edges at once.

   WHAT THIS RULE DELIBERATELY DOES NOT BOUND, said out loud because a gate's
   silence reads as permission and permission is invisible in review:

   · The strip's `* 4` height multiple in components.css. It is linear, and it
     is a stated beat between sections rather than a derived quantity.
   · The reader's root font size. The lattice is rem, so a 12px root shrinks
     it and raises the cost — not gateable, and a second reason to hold
     headroom instead of sitting on the bound.
   · MIN_SIM. It is a torus-correctness floor (a grid under 3 makes a cell its
     own neighbour twice), not a cost knob. */
const LATTICE_FLOOR_REM = 1.25;
const HIDDEN_MAX = 4;
const ROOT_PX = 16;   // nothing in the repo sets html { font-size }, so this is the browser default

let latticeRem = null;
let hidden = null;

/* Fail loudly rather than pass silently, in every branch below. A gate that
   quietly stops finding the thing it guards is worse than no gate: it reports
   success forever. That is not hypothetical here — this rule's predecessor
   went red the day the constants it read were deleted, which is the only
   reason the budget got re-derived instead of disappearing. */
if (!existsSync(TOKENS)) {
  problems.push(`design-system/tokens/tokens.json is missing — rule 6 cannot read the lattice step. Update scripts/check-css.mjs.`);
} else {
  let space6;
  try {
    const t = JSON.parse(readFileSync(TOKENS, "utf8"));
    space6 = t?.space?.["space-6"];
  } catch (e) {
    problems.push(`design-system/tokens/tokens.json did not parse (${e.message}) — rule 6 cannot read the lattice step.`);
  }
  /* A token is either a bare string or an object with a `value` — the same
     two shapes build.mjs accepts, so this reads whichever one it grows into. */
  const v = typeof space6 === "string" ? space6 : space6?.value;
  const m = typeof v === "string" ? v.match(/^([\d.]+)rem$/) : null;
  if (!m) {
    problems.push(
      `rule 6 could not read \`space.space-6\` from design-system/tokens/tokens.json as a rem value ` +
        `(got ${JSON.stringify(space6 ?? null)}). That token IS the automata's lattice — the graph paper's ` +
        `background-size, the rail width's rounding step, the strip's height and the engine's cell are all it. ` +
        `If it moved or changed units, re-derive the simulation budget and update rule 6 in scripts/check-css.mjs ` +
        `rather than deleting it.`
    );
  } else {
    latticeRem = Number(m[1]);
    if (latticeRem < LATTICE_FLOOR_REM) {
      const factor = ((1.5 / latticeRem) ** 2).toFixed(2);
      problems.push(
        `design-system/tokens/tokens.json  \`space-6: ${v}\` is below the lattice floor of ${LATTICE_FLOOR_REM}rem. ` +
          `--space-6 is the automata's cell, and a rail's simulated cell count goes as 1/cell² — so this is ` +
          `${factor}× the simulation in every rail on every page that ships a sheet, against the 1.5rem this ` +
          `bound was derived at. It is also the top step of the component spacing ramp, which is how a padding ` +
          `change reaches a canvas. If the new step is deliberate, redo the arithmetic in the rule-6 block of ` +
          `scripts/check-css.mjs and move the floor in the same commit — this bound is arithmetic, not taste.`
      );
    }
  }
}

if (!existsSync(AUTOMATA)) {
  problems.push(`js/automata.js is missing — rule 6 has nothing to measure. Update scripts/check-css.mjs.`);
} else {
  const raw = readFileSync(AUTOMATA, "utf8");
  const src = blankComments(raw);
  const hits = [...src.matchAll(/const\s+HIDDEN\s*=\s*(\d+)\s*;/g)];
  if (hits.length !== 1) {
    problems.push(
      `js/automata.js: rule 6 expected exactly one \`const HIDDEN = n;\` and found ${hits.length}. ` +
        `That constant is the automata's off-stage padding — the part of the simulation that appears in no ` +
        `picture — and it is the only unbounded cost input left besides the lattice step. The engine was ` +
        `refactored: re-derive the simulation budget and update rule 6 in scripts/check-css.mjs rather than ` +
        `deleting it.`
    );
  } else {
    hidden = Number(hits[0][1]);

    /* AND THE COST MODEL ITSELF, not just its two numbers. Bounding `HIDDEN`
       bounds the simulation only while `HIDDEN` is the whole off-stage term.
       If the engine grows a second one — separate padding for rails and
       strips, say — this rule would keep passing with half its input
       unguarded, which is the silent-rot failure the branch above exists to
       prevent and would walk straight past. So: every identifier the sim
       dimensions are built from must be one this rule knows about. Adding a
       term is completely legitimate; doing it without re-deriving the budget
       is not, and this is what makes the difference visible. */
    const SIM_TERMS = new Set(["cols", "rows", "HIDDEN", "MIN_SIM", "Math", "max", "this", "simC", "simR"]);
    /* Four, and the number is the shape rather than a tally: two dimensions
       (simC, simR) for each of the two region kinds (rail, strip). An exact
       count is what catches a PARTIAL rename — three surviving assignments
       would satisfy "some exist" while the fourth quietly left the model. */
    const SIM_ASSIGNMENTS = 4;
    const simExprs = [...src.matchAll(/this\.(simC|simR)\s*=\s*([^;]+);/g)];
    if (simExprs.length !== SIM_ASSIGNMENTS) {
      problems.push(
        `js/automata.js: rule 6 expected ${SIM_ASSIGNMENTS} \`this.simC =\` / \`this.simR =\` assignments — two ` +
          `dimensions for each of the two region kinds — and found ${simExprs.length}, so it can no longer confirm ` +
          `what the simulation's dimensions are built from. The geometry was refactored: re-derive the budget and ` +
          `update rule 6 in scripts/check-css.mjs rather than deleting it.`
      );
    }
    for (const [, which, expr] of simExprs) {
      for (const id of expr.match(/[A-Za-z_$][\w$]*/g) ?? []) {
        if (SIM_TERMS.has(id)) continue;
        problems.push(
          `js/automata.js  \`this.${which} = ${expr.trim()}\` brings in \`${id}\`, which rule 6's cost model does ` +
            `not know about. The simulated cell count is what this rule bounds, and it bounds it by bounding the ` +
            `lattice step and the off-stage padding — a third term means that arithmetic is now incomplete. ` +
            `Re-derive it in the rule-6 block of scripts/check-css.mjs and add \`${id}\` to SIM_TERMS in the same ` +
            `commit.`
        );
      }
    }

    if (hidden > HIDDEN_MAX) {
      problems.push(
        `${at(AUTOMATA, raw, hits[0].index)}  off-stage padding HIDDEN = ${hidden}, ceiling ${HIDDEN_MAX}. ` +
          `A rail is ${hidden + 4} simulated columns at 1280px of which ${hidden} are off-stage — ` +
          `${((hidden / (hidden + 4)) * 100).toFixed(0)}% of the work, drawn nowhere. This constant was 6 and ` +
          `came down to 3 for exactly that reason. If it needs to go back up, raise the ceiling in the rule-6 ` +
          `block of scripts/check-css.mjs in the same commit, with the share recomputed.`
      );
    }
  }
}

/* ---------- report ---------- */
if (problems.length) {
  console.error(`✗ css check failed (${problems.length}):\n  - ${problems.join("\n  - ")}`);
  process.exit(1);
}
console.log(
  `✓ css check              (${STYLESHEETS.length} stylesheets, ${SITE_JS.length} site scripts, ` +
    `${HTML_PAGES.length} pages · ${sizedDecls} font-size, ${tieredDecls} weight/tracking/width and ` +
    `${motionDecls} transition declarations, all tokens bar ${MOTION_EXEMPT.length} registered · ` +
    `0 colour literals · 0 prefers-color-scheme · skeleton clean · ` +
    `${solidCounts.map(([f, n]) => `${f.replace(/\.html$/, "")}:${n}`).join(" ")} solid buttons · ` +
    `automata lattice ${latticeRem}rem (${latticeRem * ROOT_PX}px) ≥ ${LATTICE_FLOOR_REM}rem, ` +
    `off-stage ${hidden} ≤ ${HIDDEN_MAX})`
);
