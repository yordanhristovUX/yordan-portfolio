/* ============================================================
   The R5 cutover's own gate: WHICH DESIGN-SYSTEM CLASS NAMES MAY STILL BE
   WRITTEN IN THIS APP'S JSX, AND WHICH ONES MUST STILL REACH THE HTML.

   The cutover swapped every app-authored element to the generated React tier,
   and the tier emits utility classes rather than `.card` / `.menu__sheet` /
   `.fact__label`. That was safe for most of them and unsafe for a specific,
   enumerable minority, because THREE CONSUMERS THAT ARE NOT THE REACT TIER
   still address those elements by their design-system name — and not one of
   the three is this app's to edit:

     1. THE FOUR PAGE STYLESHEETS. css/{style,cv,mcp,evals}.css are synced
        copies of another slice's source. css/cv.css's print block alone hides
        `.bar`, `.drawer`, `.foot`, `.link-grid` and `.fact__label` and rewrites
        `.entry`, `.entry__list`, `.facts`, `.fact` and `.sec__head`.
     2. THE AUTHORED FRAGMENTS OF components.css. Six blocks have no React form
        and never will (the two `@component none` blocks, skeleton, terminator,
        project-row), and four more are SPLIT — card, menu, theme-toggle,
        ask-fab — where a generated core is interleaved with authored gaps that
        a class attribute cannot hold: `:nth-child(3n)`, `body:has()`,
        `a + a`, `prefers-reduced-motion`, `@media print`.
     3. THE PORTS. src/lib/vanilla/*.ts are COPIES of js/, and their headers
        say a bug in them is fixed upstream and re-copied. Re-pointing a port's
        selector at a data attribute would fork the copy from its source for a
        reason the source does not have, and the next re-copy would silently
        undo it. So a class a port queries is a class that stays.

   And a fourth that IS the React tier but behaves like the others: a SCOPED
   RULE names its sink by class even when its host is a utility. `Card`'s
   reveal variant emits `[&_.card__media]:[clip-path:inset(50%)]`, `MediaGrid`
   emits `[&_.ph]:m-0`, `Drawer` emits `[&_.chat__thread]:[max-height:none]`.
   The host wears the utility; the sink must still wear the name. This is
   reported upstream as the one structural gap the cutover found in the tier —
   `.card__media` has no component at all, being a scoped part, so it is
   written by hand and would have to be.

   AND A FIFTH, WHICH IS AN UPSTREAM DEFECT AND IS DETECTED BELOW RATHER THAN
   ASSUMED. Tailwind reads `_` in an arbitrary variant as a SPACE — that is
   how `[&_.card__title]` gets its descendant combinator in the first place —
   and `emit-tailwind.mjs` does not escape the underscores INSIDE a BEM class
   name. So `[&_.card__title]:[border-top:3px_solid_var(--primary)]` compiles
   to

       .\[\&_\.card__title\]\:\[…\] .card title { border-top: … }

   a descendant `<title>` ELEMENT, which no page has. NINETEEN scoped rules
   across eight of the twenty generated components compile to the wrong
   selector this way — every one whose target is a BEM part. `.card__media`,
   `.menu__sheet`, `.drawer__sheet`, `.ph__label`, `.chat__role`,
   `.ask-fab__label`, `.theme__lamp` and the rest. It was found by measuring a
   swapped `.card--ruled` against the vanilla page: 15px short, exactly the
   12px padding plus the 3px rule the ink bar is made of.

   The consequence for this app is precise: FOR SUCH A RULE, PIPELINE 2
   DELIVERS NOTHING AND components.css IS THE ONLY SURFACE THAT DELIVERS IT —
   so BOTH ends must keep their class, the sink and the HOST. `.card--ruled`
   and `.chat__trace` are here for that reason and no other. A rule whose sink
   has no underscore (`.sec--tint .well`, `.ph-grid .ph`, `.profile .is-ok`)
   compiles correctly and needs no host class, which is why `.sec--tint` and
   `.ph-grid` did leave.

   This is reported, not worked around: the fix is one escape in the emitter,
   it belongs to the design system, and the run below prints the current count
   so the day it reaches zero is visible rather than guessed at.

   ── AND A SIXTH: A SHORTHAND AND ITS OWN LONGHAND IN ONE BASE LIST ────────

   Same root cause as the fifth's cousin — a class attribute has no order — but
   a case the emitter's disjointness pass does not cover. components.css writes

       .chat__input { font: inherit; font-size: var(--text-md); … }

   which is an ordinary stylesheet sentence: reset the font, then set the size.
   cva concatenates both into one attribute; Tailwind sorts `[font:inherit]`
   after `text-step-md`; the shorthand wins and the size resets to the
   inherited 16px. Measured: 16px against the vanilla 14.72px, and a composer
   4.09px taller. design-system/README.md's "A class attribute has no order"
   solves this BETWEEN a base and a variant axis — "any base class writing one
   of them moves into that axis's `default` branch" — and a shorthand against
   its own longhand INSIDE the base list is not analysed. `.chat__input` is
   here for that, and the detector below finds the shape rather than the name.

   ── WHAT THIS FILE ASSERTS ────────────────────────────────────────────────

   A. NO UNEXPLAINED SURVIVOR. Every design-system class still written as a
      literal in app-authored JSX must be in the computed required set. A class
      kept out of habit fails here, by name, with the file it is in.
   B. NO SILENT LOSS, PER PAGE. Every required class must still land on every
      exported page it landed on before. This is the half that catches the real
      regression — a swap that drops `.card-grid` compiles, renders, looks
      correct at 1280px and loses the two-column step at 960px.

      IT IS PER PAGE BECAUSE A GLOBAL EXISTENCE CHECK IS NOT A CHECK. The first
      version of this file asked only whether a required class appeared
      somewhere in out/, and a mutation proved it worthless: deleting
      `card-grid` from the index page left the /mcp page's copy behind and the
      gate stayed green while the two-column step was gone from the page that
      has nine cards. So the answer is a census — `class-hooks.json`, one line
      per required class naming the pages it reaches — committed beside this
      script and compared on every run. A page that loses a hook fails by name;
      a page that gains one fails too, and is fixed by re-writing the census in
      the same commit as the change that earned it (`--write`).

   The required SET is COMPUTED from the four sources rather than typed here,
   so it cannot rot: a new `@media print` rule in cv.css naming a component
   adds a requirement on the next run, and a block that stops being split
   removes one. The census is the only recorded half, and it records a fact
   about this app's output rather than a decision. What is typed here besides
   is three short exception lists, each entry stating its reason — the same
   shape as the design system's own census.

   NO NEW BOUNDARY CROSSING. Everything read below is inside apps/next: the
   synced stylesheets under src/styles/site/, and the design system through
   node_modules, which is the published package rather than a path into another
   slice's source.

   Run: node scripts/check-class-hooks.mjs            (needs a `next build`)
        node scripts/check-class-hooks.mjs --write    (re-record the census)
   ============================================================ */
import { readFileSync, readdirSync, existsSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = join(HERE, "..");
const PKG = join(APP, "node_modules", "@yordan", "design-system");

/* Rendered by a port at runtime, so it is in no exported HTML and cannot be.
   js/peek.js builds the cursor panel with innerHTML — components.css calls it
   "built by js/peek.js; exists in no markup" — so assertion B must not ask for
   it. It is still in the required set for assertion A. */
const RUNTIME_ONLY = new Set(["peek", "peek__frame", "peek__text"]);

/* In the DOM only once the assistant has a turn, which is a client-side state
   and therefore in no statically exported page. The empty drawer exports
   `.chat` and `.chat__thread` and nothing inside them, so the family test
   below would otherwise demand three hooks that only exist after a question.
   Each is still required — and still asserted by A — for the reason beside it. */
const STATE_ONLY = new Set([
  "chat__cell", //          reduced motion, components.css `@component none`
  "chat__role", //          `.chat__turn--assistant .chat__role` turns accent
  "chat__trace-toggle", //  `.chat__trace[open] .chat__trace-toggle::before`
]);

/* THE TYPOGRAPHY LAYER IS NOT A COMPONENT AND HAS NO REACT FORM — ever, and
   design-system/README.md gives the two reasons: a typographic level is a
   utility class applied to whatever element a page already has (nothing about
   `.t-lead` wants a <TLead>), and `.t-title` sets `line-height` twice, a
   `round()` value behind a plain fallback, which a class attribute cannot
   express because it has no order. So `.t-*` and `.mono` are written by hand
   on both surfaces and are outside assertion A by construction rather than by
   exemption. They appear in dist/components.json under the id `typography`. */
const NO_REACT_FORM_BY_DESIGN = new Set(["typography"]);

/* Renderers of an ARTEFACT rather than authors of markup — their class names
   belong to the generator upstream and are exempt from assertion A. Each is
   documented in its own header. */
const ARTEFACT_RENDERERS = new Set(["evals-regions.tsx", "blocks.tsx"]);

const fail = [];
const walk = (d) =>
  readdirSync(d, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)]
  );
const strip = (css) => css.replace(/\/\*[\s\S]*?\*\//g, "");

/* ---------- the design system's own class census ---------- */
const contract = JSON.parse(readFileSync(join(PKG, "dist", "components.json"), "utf8"));
const DS_CLASSES = new Set();
for (const c of contract.components ?? []) {
  if (NO_REACT_FORM_BY_DESIGN.has(c.id)) continue;
  for (const cls of c.classes ?? []) DS_CLASSES.add(cls.slice(1));
}
if (DS_CLASSES.size < 100) fail.push(`components.json yielded only ${DS_CLASSES.size} classes — shape changed?`);
if (!(contract.components ?? []).some((c) => NO_REACT_FORM_BY_DESIGN.has(c.id)))
  fail.push(`components.json no longer has a "typography" component — the exemption above is stale.`);

/* ---------- the required set, from the four sources ---------- */
const why = new Map();
const need = (cls, reason) => {
  if (!DS_CLASSES.has(cls)) return;
  if (!why.has(cls)) why.set(cls, new Set());
  why.get(cls).add(reason);
};

// 1. the synced page stylesheets
const SITE_CSS = join(APP, "src", "styles", "site");
for (const f of readdirSync(SITE_CSS)) {
  const css = strip(readFileSync(join(SITE_CSS, f), "utf8"));
  for (const m of css.matchAll(/\.([a-zA-Z][\w-]*)/g)) need(m[1], `css/${f}`);
}

// 2. the AUTHORED fragments of components.css — between an `authored:` marker
//    and the next `generated:` one. A gap in a split block is a fragment too.
{
  let inside = null;
  for (const line of readFileSync(join(PKG, "css", "components.css"), "utf8").split(/\r?\n/)) {
    const open = line.match(/---- authored:([\w-]+)/);
    if (open) {
      inside = open[1];
      continue;
    }
    if (/---- \/?generated:/.test(line)) {
      inside = null;
      continue;
    }
    if (!inside) continue;
    for (const m of strip(line).matchAll(/\.([a-zA-Z][\w-]*)/g)) need(m[1], `authored:${inside}`);
  }
  if (![...why.values()].some((s) => [...s].some((r) => r.startsWith("authored:"))))
    fail.push("no authored fragments found in components.css — marker format changed?");
}

// 3. the ports — a copy of js/, whose selectors are not this app's to move
for (const f of walk(join(APP, "src", "lib", "vanilla"))) {
  if (!f.endsWith(".ts")) continue;
  const src = readFileSync(f, "utf8");
  const name = f.split(/[\\/]/).pop();
  // selector literals: a quoted string that starts with `.` or contains ` .`
  for (const m of src.matchAll(/"((?:[^"\\]|\\.)*)"/g)) {
    const s = m[1];
    if (!/(^|[\s,>+~([])\.[a-zA-Z]/.test(s)) continue;
    for (const c of s.matchAll(/\.([a-zA-Z][\w-]*)/g)) need(c[1], `port:${name}`);
  }
}

// 4. the React tier's own scoped rules — the sink is named even when the host
//    is a utility, which is the gap this cutover reported upstream
for (const f of readdirSync(join(PKG, "dist", "react"))) {
  if (!f.endsWith(".tsx")) continue;
  const src = readFileSync(join(PKG, "dist", "react", f), "utf8");
  for (const m of src.matchAll(/"\[&([^"]*)\]:/g))
    for (const c of m[1].matchAll(/\.([a-zA-Z][\w-]*)/g)) need(c[1], `react:${f}`);
}

// 5. BOTH ends of any descendant rule in components.css whose sink is a BEM
//    class, because pipeline 2's copy of that rule does not compile (see the
//    header). Read off the stylesheet rather than the .tsx, so it states the
//    relation that is actually doing the work rather than a claim about the
//    emitter. When the emitter escapes its underscores this stops being
//    necessary for the HOST half; the sink half stands on its own.
{
  const css = strip(readFileSync(join(PKG, "css", "components.css"), "utf8"));
  for (const m of css.matchAll(/(^|[}\n])\s*([^{}@]+?)\s*\{/g)) {
    for (const sel of m[2].split(",")) {
      const parts = sel.trim().split(/\s+|(?=>)/).filter(Boolean);
      if (parts.length < 2) continue;
      const sinks = parts.slice(1).flatMap((p) => [...p.matchAll(/\.([a-zA-Z][\w-]*)/g)].map((x) => x[1]));
      if (!sinks.some((s) => s.includes("__") && DS_CLASSES.has(s))) continue;
      for (const p of parts)
        for (const c of p.matchAll(/\.([a-zA-Z][\w-]*)/g)) need(c[1], "bem-descendant");
    }
  }
}

/* 6. a cva base list holding an arbitrary SHORTHAND and, elsewhere in the same
      list, a utility writing one of that shorthand's longhands. The class
      attribute has no order, so which one applies is Tailwind's sort rather
      than the definition's sequence — and only components.css can put them
      back in order. Requires the component's OWN class. */
const SHORTHANDS = {
  font: ["text-step-", "font-", "leading-", "tracking-"],
  background: ["bg-"],
  border: ["border-"],
  padding: ["p-", "px-", "py-", "pt-", "pr-", "pb-", "pl-"],
  margin: ["m-", "mx-", "my-", "mt-", "mr-", "mb-", "ml-"],
};
const orderDependent = [];
for (const f of readdirSync(join(PKG, "dist", "react"))) {
  if (!f.endsWith(".tsx")) continue;
  const src = readFileSync(join(PKG, "dist", "react", f), "utf8");
  /* One cva at a time, with the class it owns taken from the doc comment the
     emitter writes beside it — `The \`.x\` half of the pattern` for a part,
     `The class map for \`.x\`` for a root. */
  /* The FIRST array after `cva(` is the base list in both shapes the emitter
     writes — `cva([…])` for a part and `cva([…], { variants: … })` for a root. */
  for (const m of src.matchAll(/export const (\w+) = cva\(\s*\[([\s\S]*?)\n\s*\]/g)) {
    const body = m[2];
    /* The emitter names a PART in the doc comment BELOW its cva ("The `.x`
       half of the pattern") and a ROOT in the one ABOVE ("The class map for
       `.x`"). Look forward first, then back, and never past the next cva. */
    const after = src.slice(m.index + m[0].length, src.indexOf("export const", m.index + m[0].length) + 1 || undefined);
    const before = src.slice(Math.max(0, m.index - 700), m.index);
    const own =
      after.match(/The `\.([\w-]+)` half of the pattern/) ?? before.match(/class map for `\.([\w-]+)`/);
    const classes = [...body.matchAll(/"([^"]+)"/g)].map((x) => x[1]);
    for (const [short, longs] of Object.entries(SHORTHANDS)) {
      if (!classes.some((c) => c.startsWith(`[${short}:`))) continue;
      const clash = classes.find((c) => longs.some((l) => c.startsWith(l)));
      if (!clash || !own) continue;
      orderDependent.push(`${f}:${m[1]} — [${short}:…] competes with ${clash} on .${own[1]}`);
      need(own[1], "shorthand-order");
    }
  }
}

/* ---------- A. no unexplained survivor in app-authored JSX ---------- */
for (const f of walk(join(APP, "src"))) {
  if (!f.endsWith(".tsx")) continue;
  const base = f.split(/[\\/]/).pop();
  if (ARTEFACT_RENDERERS.has(base)) continue;
  const src = readFileSync(f, "utf8")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "");
  for (const m of src.matchAll(/className=(?:"([^"]*)"|\{[^}]*"([^"]*)"[^}]*\})/g)) {
    for (const cls of (m[1] ?? m[2] ?? "").split(/\s+/).filter(Boolean)) {
      if (!DS_CLASSES.has(cls) || why.has(cls)) continue;
      fail.push(
        `A: ${base} still writes .${cls} — nothing outside the React tier names it, ` +
          `so the generated component should be carrying it. Swap it or state the reason.`
      );
    }
  }
}

/* ---------- B. no silent loss, per page ---------- */
const CENSUS = join(HERE, "class-hooks.json");
const OUT = join(APP, "out");
const write = process.argv.includes("--write");

if (!existsSync(OUT)) {
  fail.push("B: out/ is missing — run `next build` before this gate.");
} else {
  /* One entry per required class: the pages it reaches, sorted. A class that
     reaches none is omitted rather than recorded as `[]` — the difference
     between "this app does not render that part" and "this app lost it" is the
     whole point, and an empty array would blur it. RUNTIME_ONLY and STATE_ONLY
     are excluded here and only here: they are required, and they are not in
     any static page, which is a fact about WHEN they exist rather than about
     whether they survived. */
  const observed = {};
  for (const f of walk(OUT).filter((f) => f.endsWith(".html")).sort()) {
    const page = f.slice(OUT.length + 1).replace(/\\/g, "/");
    const present = new Set();
    for (const m of readFileSync(f, "utf8").matchAll(/class="([^"]*)"/g))
      for (const c of m[1].split(/\s+/)) present.add(c);
    for (const cls of why.keys()) {
      if (RUNTIME_ONLY.has(cls) || STATE_ONLY.has(cls) || !present.has(cls)) continue;
      (observed[cls] ??= []).push(page);
    }
  }

  if (write) {
    writeFileSync(CENSUS, JSON.stringify(observed, null, 2) + "\n");
    console.log(`check-class-hooks: wrote ${Object.keys(observed).length} entries to scripts/class-hooks.json`);
    process.exit(0);
  }
  if (!existsSync(CENSUS)) {
    fail.push("B: scripts/class-hooks.json is missing — regenerate it with `--write` and commit it.");
  } else {
    const recorded = JSON.parse(readFileSync(CENSUS, "utf8"));
    for (const [cls, pages] of Object.entries(recorded)) {
      const now = new Set(observed[cls] ?? []);
      const lost = pages.filter((p) => !now.has(p));
      if (lost.length)
        fail.push(
          `B: .${cls} — required by ${[...why.get(cls) ?? ["(no longer required)"]].join(" · ")} — ` +
            `no longer reaches ${lost.join(", ")}. The swap dropped a hook something else reads.`
        );
    }
    for (const [cls, pages] of Object.entries(observed)) {
      const was = new Set(recorded[cls] ?? []);
      const gained = pages.filter((p) => !was.has(p));
      if (gained.length)
        fail.push(
          `B: .${cls} now also reaches ${gained.join(", ")}, which the census does not record. ` +
            `If that is the intended change, re-run with --write and commit the census beside it.`
        );
    }
  }
}

/* ---------- the upstream defect, counted rather than assumed ----------
   Reads the BUILT css and finds every arbitrary-variant rule whose escaped
   class name holds a BEM target that the compiled descendant selector has
   turned into a space. Reported, never failed: it is not this app's bug, and a
   red gate for somebody else's defect is a gate that gets muted. The number
   going to zero is what says the emitter has been fixed and the host halves of
   source 5 can be relaxed. */
{
  const chunks = join(APP, "out", "_next", "static", "chunks");
  let css = "";
  if (existsSync(chunks)) for (const f of readdirSync(chunks)) if (f.endsWith(".css")) css += readFileSync(join(chunks, f), "utf8");
  const broken = new Set();
  for (const r of css.match(/\.\\\[[^{}]*\{[^{}]*\}/g) ?? []) {
    const sel = r.slice(0, r.indexOf("{"));
    const i = sel.search(/(?<!\\) /);
    if (i < 0) continue;
    const [escaped, descendant] = [sel.slice(0, i), sel.slice(i).trim()];
    for (const bem of escaped.match(/[a-zA-Z][\w-]*__[\w-]+/g) ?? [])
      if (descendant.includes(bem.replace(/_+/g, " "))) broken.add(bem);
  }
  if (broken.size)
    console.log(
      `check-class-hooks: UPSTREAM 1 — ${broken.size} scoped rules in @yordan/design-system's React\n` +
        `  tier compile to the wrong selector, because emit-tailwind.mjs does not escape the "_" in a\n` +
        `  BEM class name and Tailwind reads it as a space: ${[...broken].sort().slice(0, 4).join(", ")}…\n` +
        `  components.css delivers each of them instead, which is why both ends keep their class.\n` +
        `  Not this app's to fix. When this line disappears, source 5 in the header can be relaxed.\n`
    );
  if (orderDependent.length)
    console.log(
      `check-class-hooks: UPSTREAM 2 — ${orderDependent.length} cva base list(s) put a shorthand and\n` +
        `  its own longhand in one class attribute, which has no order, so Tailwind's sort decides\n` +
        `  instead of the definition's sequence:\n` +
        orderDependent.map((s) => "    " + s).join("\n") +
        `\n  components.css restores the authored order, which is why those classes stay.\n`
    );
}

/* ---------- report ---------- */
if (fail.length) {
  console.error(`check-class-hooks: ${fail.length} problem(s)\n`);
  for (const f of fail) console.error("  " + f);
  process.exit(1);
}
const bySource = {};
for (const reasons of why.values())
  for (const r of reasons) {
    const k = r.split(":")[0].replace(/^css$/, "page stylesheets");
    bySource[k] = (bySource[k] ?? 0) + 1;
  }
console.log(
  `check-class-hooks: ok — ${why.size} design-system classes kept, each named by ` +
    Object.entries(bySource)
      .map(([k, n]) => `${n} ${k}`)
      .join(", ") +
    "; every one of them is in the exported HTML."
);
