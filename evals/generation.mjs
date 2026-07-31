#!/usr/bin/env node
/* ============================================================
   generation.mjs — can a model build ON this design system?

   `evals/run.mjs` measures the retriever. `evals/groundedness.mjs` measures
   whether the assistant's prose follows from what it cited. Neither touches the
   other half of the tool surface: `get_design_system` and `get_component`
   publish a machine-readable component contract, api/mcp.js serves that contract
   to somebody else's agent, and nothing measured whether an agent handed it can
   actually produce markup that obeys it.

   That gap is not academic. The contract is the repo's argument that a design
   system can be consumed by a model rather than only read by a person. An
   argument with no measurement behind it is a claim.

   ── HOW IT IS QUARANTINED — the same treatment groundedness.mjs gets ─────────

     run.mjs                     generation.mjs
     free, offline, in CI        billed, networked, NEVER in CI
     deterministic               the model is not; the GATES are
     needs no key                needs ANTHROPIC_API_KEY via --env-file=.env
     imported by run.mjs? n/a    imported by NOTHING, and must stay that way

   It is a separate file rather than a flag for the same reason groundedness.mjs
   is: so that no accident can put a model call on the commit path. It refuses
   to run when `$CI` is set, and that guard is the mechanism, not a convention.

   ── NO LLM JUDGE. THIS IS THE POINT ─────────────────────────────────────────

   groundedness.mjs has to use a model as a judge, and says so at length,
   because "does this sentence follow from that passage" has no closed form.
   "Is this class published" does. Every gate here is a set membership test or a
   regex over the model's markup, so the only non-determinism in the file is the
   model's own output. Two runs can disagree about the markup; they cannot
   disagree about whether a given fragment passed.

   That is also why there is no baseline and no `--check`. The measured object
   is a MODEL, which moves under you without a commit; a floor over it would be
   a floor over somebody else's release schedule.

   ── THE FOUR GATES ──────────────────────────────────────────────────────────

     1. classes   every class attribute token is one components.json publishes
     2. tokens    every var(--x) is a published token, or one of the two
                  component-local custom properties components.css defines for
                  itself (see ALLOWED_VARS — a gate that rejected --rail-track
                  would reject the shipped stylesheet)
     3. literals  no raw colour, font-size or spacing literal in the markup
     4. a11y      the per-brief expectations below, derived by hand from each
                  component's `a11y` sentence in components.json

   Gate 4 is a FIXED TABLE and not derived, because `a11y` in components.json is
   one authored English sentence per component — true, load-bearing, and not
   machine-readable. Deriving a check from it would mean parsing prose, which is
   the LLM judge this file exists without. The table is written once, in this
   file, and hashed into the artefact with the briefs.

   ── WHY IT READS design-system/dist/ DIRECTLY ───────────────────────────────

   check-boundaries.mjs bans `evals/` from the design system's SOURCE dirs —
   tokens, components, stories, scripts, figma — and says nothing about `dist/`,
   which is the published artefact every consumer is meant to read. So this is
   the sanctioned direction, not a hole.

   The alternative was content/dist/content.json, which is how lib/knowledge
   reaches the same contract (`content.designSystem`, folded in verbatim by
   build-content.mjs). It carries components.json and NOT tokens.flat.json — the
   token table is not in the corpus at all, because nothing about retrieval
   needs it. Reading one of the two gates' inputs from the corpus and the other
   from dist/ would mean two sources that can drift apart by one build; reading
   both from dist/ means the gate is measured against exactly the files the
   design system published. Both digests are stamped into the artefact so a
   contract change invalidates the numbers rather than silently moving them.

   ── WHAT THE NUMBER IS ABOUT, said before anyone quotes it ──────────────────

   It is about ONE model reading THIS tool surface on TEN briefs. n=10 carries a
   95% Wilson interval wider than 30 percentage points, and every rate below is
   published with that interval attached for exactly that reason. The model
   under test is `claude-sonnet-4-5` by default — NOT `claude-haiku-4-5`, which
   is what api/chat.js runs. This measures the contract's legibility to a
   capable agent; it is not a statement about the site's own assistant, and it
   must not be quoted as one.

   ── NOT A GATE, DELIBERATELY ────────────────────────────────────────────────

   `evals/generation.json` is committed evidence and is covered by NOTHING.
   `npm run check` does not look at it, `run.mjs --check` does not know it
   exists, and no boundary pin names it. It can only change when a human runs
   this file and spends money, so a staleness check would fire on every commit
   that touched the design system and could only be silenced by a billed run.
   Read it as dated: `contract.componentsDigest` and `contract.tokensDigest`
   tell you which contract it was measured against, and `briefs.briefsHash`
   tells you whether the briefs have moved since. A later wave may pin it; today
   nothing does, and that is a choice rather than an oversight.

   ── USAGE ───────────────────────────────────────────────────────────────────

     node evals/generation.mjs --self-test        # prove the GATES, spend nothing
     node evals/generation.mjs --dry-run          # print the plan, spend nothing
     node --env-file=.env evals/generation.mjs    # billed, manual, writes the artefact
     node --env-file=.env evals/generation.mjs --only card-grid
   ============================================================ */
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
/* TOOLS is the SHIPPED tool surface — the same array api/mcp.js maps into MCP
   descriptors and api/chat.js spreads into its request. Enumerating the design
   system tools here instead would measure a lookalike surface, which is the
   mistake run.mjs's `buildNameSurfaces` note exists to prevent. */
import { TOOLS, callTool } from "../lib/knowledge/index.js";
import { wilson } from "./stats.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const OUT = join(here, "generation.json");

/* ============================================================
   Options
   ============================================================ */
const argv = process.argv.slice(2);
const flag = (name) => argv.includes(`--${name}`);
const opt = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i !== -1 && argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : fallback;
};

const MODEL = opt("model", "claude-sonnet-4-5");
/* Generous enough that a fragment is never truncated mid-tool-use: a cut-off
   `submit_markup` call would be scored as bad markup when it is actually a
   budget artefact, and that is a measurement of this harness, not of the model. */
const MAX_TOKENS = 6000;
const MAX_TURNS = 8;
const ONLY = opt("only", null);
const SELF_TEST = flag("self-test");
const DRY_RUN = flag("dry-run");

/* NEVER IN CI. Identical guard to groundedness.mjs, for identical reasons: this
   is the second file in evals/ that spends money, and the suite's contract says
   nothing here calls a model on the commit path. */
if (process.env.CI) {
  console.error(
    `✗ generation.mjs will not run under CI.\n` +
      `  It bills a model API. evals/run.mjs is the CI gate; this is a manual measurement\n` +
      `  whose output is committed evidence, not a check.`
  );
  process.exit(1);
}

/* ============================================================
   1. The contract the markup is measured against
   ============================================================ */
const components = JSON.parse(readFileSync(join(root, "design-system", "dist", "components.json"), "utf8"));
const tokensFlat = JSON.parse(readFileSync(join(root, "design-system", "dist", "tokens.flat.json"), "utf8"));

/** Every class the component contract publishes, without the leading dot. */
const PUBLISHED_CLASSES = new Set(
  components.components.flatMap((c) => c.classes).map((s) => s.replace(/^\./, ""))
);

/** Every design token's CSS custom property name. */
const PUBLISHED_TOKENS = new Set(Object.values(tokensFlat).map((t) => t.cssVar));

/* Two custom properties are consumed by components.css and are NOT tokens:
   `--rail-track` and `--term-slack` are defined inside components.css itself,
   as component-local plumbing. They appear in components.json's per-component
   `tokens` arrays because that array is parsed out of the stylesheet, so they
   are part of the PUBLISHED contract even though they are not in the token
   table. A gate that rejected them would reject the shipped stylesheet, so the
   allowed set is the union — and the two are reported separately in the
   artefact so nobody reads them as tokens. This was settled by reading the
   contract, before any model output existed. */
const COMPONENT_LOCAL_VARS = [
  ...new Set(components.components.flatMap((c) => c.tokens).filter((v) => !PUBLISHED_TOKENS.has(v))),
].sort();
const ALLOWED_VARS = new Set([...PUBLISHED_TOKENS, ...COMPONENT_LOCAL_VARS]);

/* THE SEPARATOR IS A NUL BYTE, written as an escape on purpose. run.mjs's
   header explains why at length: a literal one renders as a space in every
   editor and in `git diff`, so a digest reimplemented from what the line
   appears to say is a different digest. Same construction, same warning. */
const SEP = "\u0000"; /* NUL, written as an ESCAPE on purpose — a literal one renders as a space in
                            every editor and in `git diff`, which is how a reimplemented digest silently
                            becomes a different digest. run.mjs's section 0c is the long version. */
const sha16 = (s) => createHash("sha256").update(s).digest("hex").slice(0, 16);
const componentsDigest = sha16([...PUBLISHED_CLASSES].sort().join(SEP));
const tokensDigest = sha16([...ALLOWED_VARS].sort().join(SEP));

/* ============================================================
   2. The briefs — fixed in this file so the eval is reproducible

   Ten realistic component-composition asks, written the way somebody would ask
   for a piece of this site. Nine name work the contract COVERS. One —
   `form-row` — deliberately does not: this design system publishes no form
   component, and the honest answers are to compose from what exists or to say
   the system has none. Inventing `.form-row` fails gate 1 by naming it, which
   is the gate doing its job rather than the brief being unfair. The two groups
   are reported separately for the same reason run.mjs splits abstention
   questions out of hit@k: they measure different things.

   The briefs describe the OUTCOME and never the markup. None of them names a
   class, a token, an element or an attribute — if a brief said "use an <h3>"
   it would be testing whether the model can follow an instruction, not whether
   it can read a contract.
   ============================================================ */
const BRIEFS = [
  {
    id: "card-grid",
    coverage: "published",
    brief:
      "A grid of three project cards for the work index. Each card shows the kind of project it is, " +
      "its name, and a one-line note underneath. The cards sit in a section of their own.",
    a11y: ["heading-order-h2-h3", "card-title-is-h3"],
  },
  {
    id: "stat-band",
    coverage: "published",
    brief:
      "A band of four figures for the top of a results page: a big number, what it is called, and a " +
      "sentence of context under each. One of the four is a percentage.",
    a11y: ["fact-has-all-three-parts"],
  },
  {
    id: "chip-row",
    coverage: "published",
    brief:
      "A row of seven small metric readouts under a heading — each one a short label and its value. " +
      "One of the seven is the leader and should read as emphasised; the rest are plain.",
    a11y: ["chip-is-a-span", "one-emphasised-chip"],
  },
  {
    id: "section-shell",
    coverage: "published",
    brief:
      "The shell of a new page section: its title, a short note beside the title that is not essential " +
      "to understanding the section, and an empty content area ready to take content.",
    a11y: ["section-title-is-h2"],
  },
  {
    id: "experience-entry",
    coverage: "published",
    brief:
      "One role in an employment history: the job title, the employer, the dates it ran, a sentence " +
      "introducing it, and three bullet points of what was done.",
    a11y: ["entry-role-is-h3", "bullets-are-a-list"],
  },
  {
    id: "profile-pairs",
    coverage: "published",
    brief: "A compact profile block listing four labelled details about a person — location, availability, focus, contact.",
    a11y: ["profile-is-a-definition-list"],
  },
  {
    id: "link-grid-external",
    coverage: "published",
    brief:
      "A grid of three links out to other sites — a repository, a published article, and a live demo. " +
      "They open away from this page.",
    a11y: ["external-links-safe", "links-are-named"],
  },
  {
    id: "sources-list",
    coverage: "published",
    brief:
      "A numbered list of three cited sources under a small heading, each with its identifier and a " +
      "link to the passage it came from.",
    a11y: ["sources-are-an-ordered-list"],
  },
  {
    id: "media-figure",
    coverage: "published",
    brief:
      "A pair of images side by side for a case study — one wide, one tall — each with a caption strip " +
      "naming what it shows.",
    a11y: ["images-have-meaningful-alt"],
  },
  {
    id: "form-row",
    coverage: "unpublished",
    brief:
      "A single row of a settings form: a text field with its label, and a button that saves it. " +
      "The button is the primary action of the row.",
    a11y: ["button-is-a-button-or-link"],
  },
];

const briefsHash = sha16(
  BRIEFS.map((b) => [b.id, b.coverage, b.brief, b.a11y.join(",")].join(SEP)).join("")
);

/* ============================================================
   3. A minimal HTML reader

   Enough to see elements, their attributes and their nesting order. Not a
   parser and not trying to be: every check below is "does an element carrying
   X have property Y", which needs a tag list and nothing more.
   ============================================================ */
const TAG = /<\/?([a-zA-Z][\w-]*)((?:\s+[^\s"'>/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'`=<>]+))?)*)\s*\/?>/g;
const ATTR = /([^\s"'>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'`=<>]+)))?/g;

function attrsOf(s) {
  const out = {};
  for (const m of (s ?? "").matchAll(ATTR)) out[m[1].toLowerCase()] = m[2] ?? m[3] ?? m[4] ?? "";
  return out;
}

function elementsOf(html) {
  const out = [];
  for (const m of html.matchAll(TAG)) {
    if (m[0].startsWith("</")) {
      out.push({ tag: m[1].toLowerCase(), close: true, attrs: {}, classes: [], index: m.index });
      continue;
    }
    const attrs = attrsOf(m[2]);
    out.push({
      tag: m[1].toLowerCase(),
      close: false,
      attrs,
      classes: (attrs.class ?? "").split(/\s+/).filter(Boolean),
      index: m.index,
    });
  }
  return out;
}

/** Every element carrying `cls`. */
const withClass = (els, cls) => els.filter((e) => !e.close && e.classes.includes(cls));
const hasTag = (els, tag) => els.some((e) => !e.close && e.tag === tag);

/* ============================================================
   4. Gate 1 — classes, and Gate 2 — tokens
   ============================================================ */
function gateClasses(els) {
  const used = [...new Set(els.flatMap((e) => e.classes))].sort();
  const offenders = used.filter((c) => !PUBLISHED_CLASSES.has(c));
  return {
    pass: offenders.length === 0,
    checked: used.length,
    offenders,
    what: "every class attribute token is published by design-system/dist/components.json",
  };
}

const VAR_REF = /var\(\s*(--[A-Za-z0-9_-]+)/g;

function gateTokens(markup) {
  const used = [...new Set([...markup.matchAll(VAR_REF)].map((m) => m[1]))].sort();
  const offenders = used.filter((v) => !ALLOWED_VARS.has(v));
  return {
    pass: offenders.length === 0,
    checked: used.length,
    offenders,
    what: "every var(--x) is a token in design-system/dist/tokens.flat.json, or one of the two component-local custom properties components.css defines",
  };
}

/* ============================================================
   5. Gate 3 — literals

   REIMPLEMENTED FROM, NOT IMPORTED FROM, scripts/check-css.mjs. `evals/` may
   not read `scripts/` (check-boundaries.mjs), and the sibling is the canonical
   statement of these rules — its rule 1 (no literal font-size) and rule 3 (no
   hex/rgb/hsl literal, composition through a token allowed) are reproduced here
   over markup instead of over stylesheets. If those rules move there, they have
   to be moved here by hand; that is the cost of the boundary and it is cheaper
   than the import.

   ONE DELIBERATE DIFFERENCE. check-css.mjs does NOT check literal spacing, and
   its header explains why: `mm` in a print block is a physical fact about A4
   and `padding-bottom: 2px` under an underline is an optical offset, so a
   spacing rule over the whole repo "would be wrong more often than right". None
   of that applies to a freshly generated component fragment, where a raw
   `padding: 12px` is a model declining to use the ramp. So spacing IS checked
   here, and it is reported as its own kind so a reader can discount it
   separately if they disagree.

   WHERE IT LOOKS. Declaration context only — `style` attributes and any
   `<style>` block — plus the presentational attributes that can carry a colour
   without one. Scanning the whole fragment for `#abc` would flag `href="#abc"`,
   and a gate that is wrong about an anchor is a gate people learn to override.
   ============================================================ */
const HEX = /#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3,4})(?![0-9a-z_-])/gi;
const COLOUR_FUNC = /\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\((?:[^()]|\([^()]*\))*\)/gi;
const FONT_SIZE_OK = /^(var\(\s*--[a-z0-9-]+\s*(,[^)]*)?\)|inherit|initial|unset|revert|revert-layer)$/i;
const SPACING_PROP = /^(margin|padding|gap|row-gap|column-gap|inset)(-(top|right|bottom|left|block|inline|start|end))?$/;
const LENGTH = /(^|[\s(,])[\d.]+(px|rem|em|ch|ex|vh|vw|vmin|vmax|pt|pc|cm|mm|in)\b/i;
const COLOUR_ATTRS = ["fill", "stroke", "color", "bgcolor", "stop-color", "flood-color"];

/** `a: b; c: d` → [{prop, value}]. Good enough for a style attribute. */
const splitDecls = (text) =>
  text
    .split(";")
    .map((d) => d.trim())
    .filter(Boolean)
    .map((d) => {
      const i = d.indexOf(":");
      return i > 0 ? { prop: d.slice(0, i).trim().toLowerCase(), value: d.slice(i + 1).trim() } : null;
    })
    .filter(Boolean);

function gateLiterals(markup, els) {
  const offenders = [];

  /* Every declaration the fragment carries, from both places one can hide. */
  const decls = [];
  for (const e of els) if (e.attrs.style) decls.push(...splitDecls(e.attrs.style));
  for (const m of markup.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)) {
    /* Strip selectors and braces; what is left is declarations. A brace walk
       would be more correct and this is a fragment, not a stylesheet. */
    for (const body of m[1].split("}")) decls.push(...splitDecls(body.slice(body.indexOf("{") + 1)));
  }

  const declText = decls.map((d) => `${d.prop}: ${d.value}`).join("\n");
  for (const m of declText.matchAll(HEX)) offenders.push({ kind: "colour", literal: m[0] });
  for (const m of declText.matchAll(COLOUR_FUNC)) {
    /* Composition through a token — rgba(var(--accent-rgb), 0.4) — is the
       supported way to build a colour at runtime. check-css.mjs rule 3. */
    if (!m[0].includes("var(") && /\d/.test(m[0])) offenders.push({ kind: "colour", literal: m[0] });
  }
  for (const d of decls) {
    if (d.prop === "font-size" && !FONT_SIZE_OK.test(d.value.replace(/\s*!important$/, ""))) {
      offenders.push({ kind: "font-size", literal: `${d.prop}: ${d.value}` });
    }
    if (d.prop === "font" && /\d/.test(d.value)) {
      offenders.push({ kind: "font-size", literal: `${d.prop}: ${d.value}` });
    }
    if (SPACING_PROP.test(d.prop) && !d.value.includes("var(") && LENGTH.test(d.value)) {
      offenders.push({ kind: "spacing", literal: `${d.prop}: ${d.value}` });
    }
  }
  /* A fresh non-global regex per test: `HEX` is global, and a global regex
     carries lastIndex between calls, so reusing it here would skip every other
     match. Cheap bug, invisible symptom. */
  const hexOnce = new RegExp(HEX.source, "i");
  for (const e of els) {
    for (const a of COLOUR_ATTRS) {
      const v = e.attrs[a];
      if (v && hexOnce.test(v)) offenders.push({ kind: "colour", literal: `${a}="${v}"` });
    }
  }

  return {
    pass: offenders.length === 0,
    checked: decls.length,
    offenders,
    what: "no raw colour, font-size or spacing literal — reimplemented from scripts/check-css.mjs rules 1 and 3, plus spacing",
  };
}

/* ============================================================
   6. Gate 4 — accessibility, from a fixed table

   Each rule is one deterministic function over the element list. They are
   derived by hand from the `a11y` sentence components.json carries for the
   component the brief is about; the sentence is quoted in `from` so the
   derivation is auditable rather than asserted.

   A rule that finds nothing to check REPORTS that rather than passing. "No
   .chip in the markup" is not evidence that chips are spans, and a gate that
   scores a vacuous pass is a gate that rewards producing nothing.
   ============================================================ */
const A11Y = {
  "heading-order-h2-h3": {
    from: "card: Titles are <h3> inside a section headed by <h2> — the heading order is the contract.",
    check: (els) => {
      const h2 = els.findIndex((e) => !e.close && e.tag === "h2");
      const h3 = els.findIndex((e) => !e.close && e.tag === "h3");
      if (h2 === -1) return ["no <h2> — the section heading the card titles sit under is missing"];
      if (h3 === -1) return ["no <h3> — vacuous, nothing to check the order against"];
      return h2 < h3 ? [] : ["<h3> appears before the <h2> it should sit under"];
    },
  },
  "card-title-is-h3": {
    from: "card: Titles are <h3> inside a section headed by <h2>.",
    check: (els) => {
      const titles = withClass(els, "card__title");
      if (!titles.length) return ["no .card__title in the markup — vacuous"];
      const bad = titles.filter((e) => e.tag !== "h3").map((e) => `<${e.tag} class="card__title">`);
      return bad.length ? [`.card__title on ${[...new Set(bad)].join(", ")} — the contract says <h3>`] : [];
    },
  },
  "fact-has-all-three-parts": {
    from: "fact: All three parts are required — a number with no label is unreadable.",
    check: (els) => {
      const facts = withClass(els, "fact");
      if (!facts.length) return ["no .fact in the markup — vacuous"];
      const out = [];
      for (const part of ["fact__num", "fact__title", "fact__label"]) {
        const n = withClass(els, part).length;
        if (n < facts.length) out.push(`${facts.length} .fact but ${n} .${part} — all three parts are required`);
      }
      return out;
    },
  },
  "chip-is-a-span": {
    from: "chip: Display-only <span>. Anything that responds to a click is a Button instead.",
    check: (els) => {
      const chips = withClass(els, "chip");
      if (!chips.length) return ["no .chip in the markup — vacuous"];
      const bad = chips.filter((e) => e.tag !== "span").map((e) => `<${e.tag} class="chip">`);
      return bad.length ? [`.chip on ${[...new Set(bad)].join(", ")} — the contract says a display-only <span>`] : [];
    },
  },
  "one-emphasised-chip": {
    from: "chip --solid, and the one-per-group rule scripts/check-css.mjs rule 5 enforces for .btn--solid.",
    check: (els) => {
      const solid = withClass(els, "chip--solid").length;
      if (!withClass(els, "chip").length) return ["no .chip in the markup — vacuous"];
      return solid === 1 ? [] : [`${solid} .chip--solid — the brief asks for exactly one leader`];
    },
  },
  "section-title-is-h2": {
    from: "section-head: Always an <h2>; the note is hidden under 640px, so it may never carry essential information.",
    check: (els) => {
      const titles = withClass(els, "sec__title");
      if (!titles.length) return ["no .sec__title in the markup — vacuous"];
      const bad = titles.filter((e) => e.tag !== "h2").map((e) => `<${e.tag} class="sec__title">`);
      return bad.length ? [`.sec__title on ${[...new Set(bad)].join(", ")} — the contract says always an <h2>`] : [];
    },
  },
  "entry-role-is-h3": {
    from: "entry: Role is <h3> under the section <h2>.",
    check: (els) => {
      const roles = withClass(els, "entry__role");
      if (!roles.length) return ["no .entry__role in the markup — vacuous"];
      const bad = roles.filter((e) => e.tag !== "h3").map((e) => `<${e.tag} class="entry__role">`);
      return bad.length ? [`.entry__role on ${[...new Set(bad)].join(", ")} — the contract says <h3>`] : [];
    },
  },
  "bullets-are-a-list": {
    from: "entry: bullet glyphs are ::before so the list is still announced as a list.",
    check: (els) => {
      const lists = withClass(els, "entry__list");
      if (!lists.length) return ["no .entry__list in the markup — vacuous"];
      const bad = lists.filter((e) => e.tag !== "ul" && e.tag !== "ol").map((e) => `<${e.tag}>`);
      if (bad.length) return [`.entry__list on ${[...new Set(bad)].join(", ")} — bullets must be a real list`];
      return hasTag(els, "li") ? [] : ["a list element with no <li> in it"];
    },
  },
  "profile-is-a-definition-list": {
    from: "profile: Real <dl>/<dt>/<dd> semantics, each pair wrapped in a <div> for the grid.",
    check: (els) => {
      const out = [];
      if (!hasTag(els, "dl")) out.push("no <dl> — the contract says real definition-list semantics");
      const dt = els.filter((e) => !e.close && e.tag === "dt").length;
      const dd = els.filter((e) => !e.close && e.tag === "dd").length;
      if (!dt || !dd) out.push(`<dt> ${dt}, <dd> ${dd} — both are required`);
      else if (dt !== dd) out.push(`<dt> ${dt} but <dd> ${dd} — pairs must match`);
      return out;
    },
  },
  "external-links-safe": {
    from: "link-grid: External links carry target=_blank rel=noopener and a trailing arrow.",
    check: (els) => {
      const blank = els.filter((e) => !e.close && e.tag === "a" && e.attrs.target === "_blank");
      if (!blank.length) return ["no link opens away from the page — the brief asked for three that do"];
      const bad = blank.filter((e) => !(e.attrs.rel ?? "").includes("noopener")).map((e) => e.attrs.href || "(no href)");
      return bad.length ? [`target=_blank without rel=noopener on ${bad.join(", ")}`] : [];
    },
  },
  "links-are-named": {
    from: "link-grid: labels name the destination, never 'click here'.",
    check: (els, markup) => {
      const bad = [...markup.matchAll(/<a\b[^>]*>([\s\S]*?)<\/a>/gi)]
        .map((m) => m[1].replace(/<[^>]*>/g, "").trim())
        .filter((t) => !t || /^(click here|here|read more|link|more)$/i.test(t));
      return bad.length ? [`link text ${bad.map((t) => JSON.stringify(t)).join(", ")} does not name a destination`] : [];
    },
  },
  "sources-are-an-ordered-list": {
    from: "source: Real <ol>/<li>; the ordinal is content inside the item, not a CSS counter a screen reader would skip.",
    check: (els) => {
      const out = [];
      if (!hasTag(els, "ol")) out.push("no <ol> — the contract says a real ordered list");
      if (!hasTag(els, "li")) out.push("no <li> — an ordered list with no items");
      return out;
    },
  },
  "images-have-meaningful-alt": {
    from: "media: Every real <img> needs meaningful alt text describing the content, never 'screenshot'.",
    check: (els) => {
      const imgs = els.filter((e) => !e.close && e.tag === "img");
      if (!imgs.length) return ["no <img> in the markup — vacuous"];
      const out = [];
      for (const i of imgs) {
        if (i.attrs.alt === undefined) out.push(`<img src="${i.attrs.src ?? ""}"> has no alt attribute`);
        else if (!i.attrs.alt.trim()) out.push(`<img src="${i.attrs.src ?? ""}"> has an empty alt on a content image`);
        else if (/^(screenshot|image|photo|picture|graphic)\.?$/i.test(i.attrs.alt.trim()))
          out.push(`alt="${i.attrs.alt}" describes the medium, not the content`);
      }
      return out;
    },
  },
  "button-is-a-button-or-link": {
    from: "button: Use <a> to navigate and <button> to act; the global :focus-visible ring is never suppressed.",
    check: (els) => {
      const btns = withClass(els, "btn");
      if (!btns.length) return ["no .btn in the markup — vacuous"];
      const bad = btns.filter((e) => e.tag !== "button" && e.tag !== "a").map((e) => `<${e.tag} class="btn">`);
      return bad.length ? [`.btn on ${[...new Set(bad)].join(", ")} — an action is a <button>, a destination is an <a>`] : [];
    },
  },
};

function gateA11y(brief, els, markup) {
  const failures = [];
  for (const rule of brief.a11y) {
    const spec = A11Y[rule];
    if (!spec) {
      failures.push({ rule, problems: [`no such rule in the A11Y table`] });
      continue;
    }
    const problems = spec.check(els, markup);
    if (problems.length) failures.push({ rule, from: spec.from, problems });
  }
  return {
    pass: failures.length === 0,
    checked: brief.a11y.length,
    failures,
    what: "the fixed per-brief expectations in this file, derived by hand from each component's a11y sentence",
  };
}

/** All four gates over one fragment. */
function runGates(brief, markup) {
  const els = elementsOf(markup);
  const gates = {
    classes: gateClasses(els),
    tokens: gateTokens(markup),
    literals: gateLiterals(markup, els),
    a11y: gateA11y(brief, els, markup),
  };
  return { gates, passedAll: Object.values(gates).every((g) => g.pass) };
}

/* ============================================================
   7. Self-test — the gates prove themselves before anything is billed

   run.mjs refuses to measure until its tokeniser and its validators have
   reproduced known answers. Same idea, and cheaper: two fixtures written by
   hand, one that must pass every gate and one that must fail every gate in a
   named way. A gate that has quietly stopped finding what it guards reports
   success forever, and this is the only thing standing between that and a
   published number.
   ============================================================ */
const FIXTURE_GOOD = `<section class="sec">
  <header class="sec__head"><h2 class="sec__title t-title">Results</h2></header>
  <div class="well">
    <div class="facts">
      <div class="fact">
        <span class="fact__num">70</span>
        <span class="fact__title">Corpus</span>
        <span class="fact__label">Chunks in the whole index.</span>
      </div>
    </div>
    <dl class="profile"><div><dt>Based</dt><dd>Sofia</dd></div></dl>
    <span class="chip chip--solid">hit@3 91.8%</span>
  </div>
</section>`;

const FIXTURE_BAD = `<section class="card-deck" style="padding: 12px; color: #ff0000; font-size: 14px">
  <h3 class="card__title">A card title, above the section heading it belongs under</h3>
  <h2 class="sec__title">The section heading, late</h2>
  <div class="chip">not a span</div>
  <p style="border-color: rgb(20, 20, 20); margin: 8px">x</p>
  <img src="a.png" alt="screenshot">
  <span style="color: var(--accent); background: var(--brand-blue)">tokens</span>
  <span style="background: rgba(var(--accent-rgb), 0.4)">composed, and allowed</span>
</section>`;

if (SELF_TEST) {
  const problems = [];
  const good = runGates({ id: "fixture", a11y: ["fact-has-all-three-parts", "section-title-is-h2", "chip-is-a-span", "profile-is-a-definition-list"] }, FIXTURE_GOOD);
  if (!good.passedAll) {
    for (const [k, g] of Object.entries(good.gates)) {
      if (!g.pass) problems.push(`the GOOD fixture failed gate ${k}: ${JSON.stringify(g.offenders ?? g.failures)}`);
    }
  }

  const bad = runGates({ id: "fixture", a11y: ["heading-order-h2-h3", "chip-is-a-span", "images-have-meaningful-alt"] }, FIXTURE_BAD);
  const expect = (cond, msg) => { if (!cond) problems.push(`the BAD fixture: ${msg}`); };
  expect(bad.gates.classes.offenders.includes("card-deck"), "gate 1 did not name the unpublished class `card-deck`");
  expect(bad.gates.tokens.offenders.includes("--brand-blue"), "gate 2 did not name the unpublished var `--brand-blue`");
  expect(!bad.gates.tokens.offenders.includes("--accent"), "gate 2 wrongly rejected the real token `--accent`");
  const kinds = new Set(bad.gates.literals.offenders.map((o) => o.kind));
  expect(kinds.has("colour"), "gate 3 found no colour literal");
  expect(kinds.has("font-size"), "gate 3 found no font-size literal");
  expect(kinds.has("spacing"), "gate 3 found no spacing literal");
  expect(
    !bad.gates.literals.offenders.some((o) => o.literal.includes("var(")),
    "gate 3 wrongly flagged a colour composed from a token — rgba(var(--accent-rgb), 0.4) is the supported form"
  );
  const rules = bad.gates.a11y.failures.map((f) => f.rule);
  expect(rules.includes("heading-order-h2-h3"), "gate 4 missed the inverted heading order");
  expect(rules.includes("chip-is-a-span"), "gate 4 missed a .chip on a <div>");
  expect(rules.includes("images-have-meaningful-alt"), 'gate 4 missed alt="screenshot"');

  /* Vacuity: a rule with nothing to look at must FAIL, not pass. */
  const empty = runGates({ id: "fixture", a11y: ["chip-is-a-span"] }, `<p class="t-lead">nothing here</p>`);
  expect(!empty.gates.a11y.pass, "gate 4 scored a vacuous pass on markup containing no .chip");

  if (problems.length) {
    console.error(`✗ gate self-test failed:\n  - ${problems.join("\n  - ")}`);
    process.exit(1);
  }
  console.log(`✓ gate self-test         (4 gates, 2 fixtures, ${Object.keys(A11Y).length} a11y rules, vacuity rejected)`);
  console.log(`✓ contract               (${PUBLISHED_CLASSES.size} classes @ ${componentsDigest}, ${ALLOWED_VARS.size} vars @ ${tokensDigest})`);
  console.log(`✓ briefs                 (${BRIEFS.length} @ ${briefsHash})`);
  process.exit(0);
}

/* ============================================================
   8. The plan
   ============================================================ */
const SELECTED = ONLY ? BRIEFS.filter((b) => b.id === ONLY) : BRIEFS;
if (!SELECTED.length) {
  console.error(`✗ no brief with id "${ONLY}". Known: ${BRIEFS.map((b) => b.id).join(", ")}`);
  process.exit(1);
}

if (DRY_RUN) {
  console.log(`model        ${MODEL}`);
  console.log(`tools        ${TOOLS.map((t) => t.name).join(", ")} (+ submit_markup)`);
  console.log(`contract     ${PUBLISHED_CLASSES.size} classes @ ${componentsDigest} · ${ALLOWED_VARS.size} vars @ ${tokensDigest}`);
  console.log(`briefs       ${SELECTED.length} of ${BRIEFS.length} @ ${briefsHash}`);
  console.log(`spend        up to ${SELECTED.length} × ${MAX_TURNS} model calls, ${MAX_TOKENS} max tokens each`);
  console.log(SELECTED.map((b, i) => `  ${String(i + 1).padStart(2)} ${b.id.padEnd(20)} [${b.coverage}] ${b.brief.slice(0, 80)}…`).join("\n"));
  process.exit(0);
}

/* ============================================================
   9. Run — one agentic loop per brief

   The model gets the SHIPPED tools and the tool calls are executed for real, so
   what it reads is what api/mcp.js would have served it. The system prompt
   states the rules the design system states about itself — the same standing
   instructions a human contributor gets from design-system/README.md — and does
   NOT enumerate the gates. Listing the checks would measure whether the model
   can follow a checklist; the question is whether it can read a contract.
   ============================================================ */
const SUBMIT_TOOL = {
  name: "submit_markup",
  description:
    "Submit the finished markup fragment. Call this exactly once, when the markup is complete. " +
    "The fragment only — no <html>, no <head>, no <body>, no explanation.",
  input_schema: {
    type: "object",
    additionalProperties: false,
    required: ["markup", "componentsUsed"],
    properties: {
      markup: { type: "string", description: "The HTML fragment." },
      componentsUsed: {
        type: "array",
        items: { type: "string" },
        description: "The ids of the design-system components this markup is built from.",
      },
    },
  },
};

const SYSTEM =
  "You write HTML for a static site built on a published design system. The design system's " +
  "machine-readable contract is available through your tools: call get_design_system first, then " +
  "get_component for every component you intend to write, and build from what they return.\n\n" +
  "What this system states about itself:\n" +
  "- Every class you write is one the contract publishes. The stylesheet is fixed; a class it does " +
  "not define does nothing.\n" +
  "- Every custom property you reference is one the contract publishes.\n" +
  "- Colours, fonts and spacing come from tokens, so markup carries no raw colour, font-size or " +
  "spacing values.\n" +
  "- Each component's accessibility sentence is part of its contract, not advice.\n\n" +
  "Return the markup fragment through the submit_markup tool.";

const KEY = process.env.ANTHROPIC_API_KEY;
if (!KEY) {
  console.error(
    `✗ ANTHROPIC_API_KEY is not set in this process — the model cannot be called.\n` +
      `  Node does not read .env on its own. Run:\n\n      node --env-file=.env evals/generation.mjs\n\n` +
      `  To exercise the gates without spending anything:  node evals/generation.mjs --self-test`
  );
  process.exit(1);
}

const usage = { calls: 0, inputTokens: 0, outputTokens: 0 };

async function callModel(messages) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": KEY, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: SYSTEM,
      tools: [...TOOLS, SUBMIT_TOOL],
      messages,
    }),
  });
  if (!res.ok) throw new Error(`${res.status}: ${(await res.text()).slice(0, 300)}`);
  const json = await res.json();
  usage.calls++;
  usage.inputTokens += json.usage?.input_tokens ?? 0;
  usage.outputTokens += json.usage?.output_tokens ?? 0;
  return json;
}

/** Execute a shipped tool. VOYAGE_API_KEY is dropped so nothing here can open a
 *  second billed socket — the design-system tools never rank anything anyway,
 *  and a stray search_content should stay on the free lexical path. */
async function execTool(name, input) {
  const saved = process.env.VOYAGE_API_KEY;
  if (saved !== undefined) delete process.env.VOYAGE_API_KEY;
  try {
    return await callTool(name, input ?? {});
  } catch (e) {
    return { error: String(e.message ?? e) };
  } finally {
    if (saved !== undefined) process.env.VOYAGE_API_KEY = saved;
  }
}

/** One brief, one loop. Throws on transport failure so the caller can retry. */
async function generate(brief) {
  const messages = [{ role: "user", content: brief.brief }];
  const toolCalls = [];

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const reply = await callModel(messages);
    messages.push({ role: "assistant", content: reply.content });

    const uses = reply.content.filter((b) => b.type === "tool_use");
    if (!uses.length) return { outcome: "no-markup", detail: "the model stopped without calling submit_markup", toolCalls };

    const submit = uses.find((u) => u.name === "submit_markup");
    if (submit) {
      return {
        outcome: "submitted",
        markup: String(submit.input?.markup ?? ""),
        componentsUsed: submit.input?.componentsUsed ?? [],
        /* Recorded so a `max_tokens` stop can be told apart from bad markup —
           a truncated fragment would score as a failure of the model when it is
           a failure of the budget. */
        stopReason: reply.stop_reason ?? null,
        toolCalls,
      };
    }

    const results = [];
    for (const u of uses) {
      toolCalls.push(u.name);
      const result = await execTool(u.name, u.input);
      results.push({
        type: "tool_result",
        tool_use_id: u.id,
        content: JSON.stringify(result).slice(0, 60000),
      });
    }
    messages.push({ role: "user", content: results });
  }
  return { outcome: "no-markup", detail: `hit the ${MAX_TURNS}-turn cap without calling submit_markup`, toolCalls };
}

console.log(`→ ${SELECTED.length} briefs against ${MODEL}`);
console.log(`  contract ${PUBLISHED_CLASSES.size} classes @ ${componentsDigest} · ${ALLOWED_VARS.size} vars @ ${tokensDigest}\n`);

const detail = [];
for (const [i, brief] of SELECTED.entries()) {
  process.stdout.write(`  ${String(i + 1).padStart(2)}/${SELECTED.length} ${brief.id.padEnd(20)} … `);

  /* ONE retry, then record the error AS THE VERDICT. A billed eval that retries
     until it succeeds is an eval with an unbounded bill and a survivorship bias
     in its own results; `error` is a truthful row and a second failure is
     information. groundedness.mjs does not retry at all — the difference is
     that a brief here is one whole measurement rather than one of forty. */
  let run = null;
  let error = null;
  for (let attempt = 0; attempt < 2 && !run; attempt++) {
    try {
      run = await generate(brief);
    } catch (e) {
      error = e.message;
      if (attempt === 0) process.stdout.write(`retrying after ${e.message.slice(0, 60)} … `);
    }
  }

  if (!run) {
    detail.push({ id: brief.id, coverage: brief.coverage, brief: brief.brief, outcome: "error", detail: error });
    console.log(`ERROR — ${error}`);
    continue;
  }

  if (run.outcome !== "submitted") {
    detail.push({ id: brief.id, coverage: brief.coverage, brief: brief.brief, ...run });
    console.log(`${run.outcome} — ${run.detail}`);
    continue;
  }

  const { gates, passedAll } = runGates(brief, run.markup);
  detail.push({
    id: brief.id,
    coverage: brief.coverage,
    brief: brief.brief,
    outcome: "submitted",
    toolCalls: run.toolCalls,
    componentsUsed: run.componentsUsed,
    gates,
    passedAll,
    markup: run.markup,
  });
  const failed = Object.entries(gates).filter(([, g]) => !g.pass).map(([k]) => k);
  console.log(passedAll ? `all four gates pass` : `FAIL ${failed.join(", ")}`);
}

/* ============================================================
   10. Report
   ============================================================ */
const submitted = detail.filter((d) => d.outcome === "submitted");
const rate = (ok, n) => {
  const w = wilson(ok, n);
  return { pass: ok, n, value: Number(w.p.toFixed(4)), lo: Number(w.lo.toFixed(4)), hi: Number(w.hi.toFixed(4)), half: Number(w.half.toFixed(4)) };
};
const perGate = Object.fromEntries(
  ["classes", "tokens", "literals", "a11y"].map((k) => [k, rate(submitted.filter((d) => d.gates[k].pass).length, submitted.length)])
);
const byCoverage = Object.fromEntries(
  ["published", "unpublished"].map((c) => {
    const rows = submitted.filter((d) => d.coverage === c);
    return [c, rate(rows.filter((d) => d.passedAll).length, rows.length)];
  })
);

const report = {
  $generatedBy: "evals/generation.mjs — manual, billed, never in CI",
  $question:
    "Given the tool surface api/mcp.js serves, can a model generate markup that honours the published design-system contract?",
  $notGated:
    "This file is covered by NOTHING. `npm run check` does not read it, `evals/run.mjs --check` does not know it exists, and no boundary pin names it. It can only change when a human spends money, so a staleness gate could only be silenced by a billed run. Read it as dated: contract.componentsDigest and contract.tokensDigest say which contract it was measured against, and briefs.briefsHash says whether the briefs have moved.",
  generatedAt: new Date().toISOString(),
  model: MODEL,
  modelCaveat:
    `The model under test is ${MODEL}. api/chat.js runs claude-haiku-4-5, so this is NOT a measurement of the site's own assistant — it measures whether the published contract is legible to a capable agent, which is the claim api/mcp.js makes to somebody else's tooling. n is 10; every rate below carries a two-sided 95% Wilson interval and the half-widths are wider than 15 percentage points. One brief moves a rate by 10pp. Read the intervals, not the point estimates.`,
  toolSurface: {
    tools: TOOLS.map((t) => t.name),
    source: "lib/knowledge/index.js TOOLS — the same array api/mcp.js maps into MCP descriptors and api/chat.js spreads into its request",
    harnessTool: "submit_markup — this file's answer channel, not part of the design-system contract",
  },
  contract: {
    source: "design-system/dist/components.json + design-system/dist/tokens.flat.json, read directly",
    components: components.count,
    publishedClasses: PUBLISHED_CLASSES.size,
    publishedTokens: PUBLISHED_TOKENS.size,
    componentLocalVars: COMPONENT_LOCAL_VARS,
    componentLocalVarsNote:
      "Consumed by components.css and defined in it, so they are published by the contract without being design tokens. Allowed by gate 2 because a gate that rejected them would reject the shipped stylesheet.",
    componentsDigest,
    tokensDigest,
  },
  briefs: {
    n: BRIEFS.length,
    run: SELECTED.length,
    published: BRIEFS.filter((b) => b.coverage === "published").length,
    unpublished: BRIEFS.filter((b) => b.coverage === "unpublished").length,
    unpublishedNote:
      "`form-row` names work this design system does not publish a component for. Inventing a class for it fails gate 1 by naming the class, which is the measurement working rather than the brief being unfair. Reported separately.",
    briefsHash,
  },
  gates: [
    { id: "classes", what: "every class attribute token is published by components.json", judge: "set membership" },
    { id: "tokens", what: "every var(--x) is a published token or a component-local custom property", judge: "set membership" },
    { id: "literals", what: "no raw colour, font-size or spacing literal", judge: "regex, reimplemented from scripts/check-css.mjs rules 1 and 3 plus spacing" },
    { id: "a11y", what: "the fixed per-brief table in generation.mjs, derived by hand from each component's a11y sentence", judge: "deterministic checks over the element list" },
  ],
  totals: {
    outcomes: detail.reduce((m, d) => ({ ...m, [d.outcome]: (m[d.outcome] ?? 0) + 1 }), {}),
    allGates: rate(submitted.filter((d) => d.passedAll).length, submitted.length),
    perGate,
    byCoverage,
  },
  usage,
  detail,
};

writeFileSync(OUT, JSON.stringify(report, null, 2) + "\n");

/* ---------- stdout ---------- */
const pct = (x) => `${(x * 100).toFixed(1)}%`;
const line = (label, r) =>
  console.log(`  ${label.padEnd(14)} ${pct(r.value).padStart(6)}  ±${(r.half * 100).toFixed(1)}pp   ${r.pass}/${r.n}`);

console.log("");
console.log(`outcomes       ${Object.entries(report.totals.outcomes).map(([k, v]) => `${v} ${k}`).join(" · ")}`);
console.log("");
line("all four", report.totals.allGates);
for (const [k, r] of Object.entries(perGate)) line(k, r);
console.log("");
for (const [k, r] of Object.entries(byCoverage)) if (r.n) line(k, r);
console.log("");
console.log(`spend          ${usage.calls} model calls · ${usage.inputTokens} in / ${usage.outputTokens} out tokens`);
console.log(`✓ evals/generation.json`);
console.log(`  n=${submitted.length}. Every interval above is wider than 15pp. The model is ${MODEL}, not the`);
console.log(`  claude-haiku-4-5 api/chat.js runs — this measures the contract, not the site's assistant.`);
console.log(`  Nothing gates this file. It is dated evidence: contract ${componentsDigest} · briefs ${briefsHash}.`);
