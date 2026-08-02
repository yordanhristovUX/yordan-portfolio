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

   ── THE FIFTH AND SIXTH SOURCES WERE UPSTREAM DEFECTS, AND ARE FIXED ──────

   Both are kept below as DETECTORS rather than deleted, because each was found
   by measuring rather than by reading, and a silent regression in either would
   cost this app a stylesheet's worth of rules again. Each now prints nothing.

   THE FIFTH WAS THE UNESCAPED UNDERSCORE. Tailwind reads `_` in an arbitrary
   variant as a SPACE — that is how `[&_.card__title]` gets its descendant
   combinator in the first place — and `emit-tailwind.mjs` did not escape the
   underscores INSIDE a BEM class name, so
   `[&_.card__title]:[border-top:3px_solid_var(--primary)]` compiled to

       .\[\&_\.card__title\]\:\[…\] .card title { border-top: … }

   a descendant `<title>` ELEMENT, which no page has. Nineteen scoped rules
   across eight components compiled to the wrong selector that way, and for
   each of them pipeline 2 delivered nothing while components.css delivered
   everything — so BOTH ends had to keep their class, the sink and the HOST.
   Found by measuring a swapped `.card--ruled` against the vanilla page: 15px
   short, exactly the 12px padding plus the 3px rule the ink bar is made of.

   2.8.0 escapes them (`[&_.card\_\_title]:…`, written with String.raw), the
   count below is zero, and THE HOST HALF OF SOURCE 5 IS RETIRED WITH IT: a
   host wearing the component's utility now carries its own scoped rule, so
   `.card--ruled`, `.chat__trace` and the sixteen others go. The SINK half is
   not a defect and never was — a scoped rule names its sink by class whichever
   pipeline compiles it — so it stands on its own, as source 4.

   THE SIXTH WAS A SHORTHAND AND ITS OWN LONGHAND IN ONE BASE LIST. Same root
   cause as the fifth's cousin — a class attribute has no order — in a case the
   emitter's disjointness pass did not cover. components.css writes

       .chat__input { font: inherit; font-size: var(--text-md); … }

   which is an ordinary stylesheet sentence: reset the font, then set the size.
   cva concatenated both into one attribute; Tailwind sorted `[font:inherit]`
   after `text-step-md`; the shorthand won and the size reset to the inherited
   16px, measured against the vanilla 14.72px with a composer 4.09px taller.
   The emitter now DISTRIBUTES a shorthand over the longhands its rule does not
   set again, so `[font:…]` never reaches a class attribute and `.chat__input`
   is gone from this app. The detector below still looks for the SHAPE rather
   than the name, and would name the next one.

   ── AND A NOTE ON HOW THE TIER IS READ ────────────────────────────────────

   Sources 4 and 6 parse the generated .tsx, and the escape above made half of
   its class strings `String.raw` template literals rather than quoted strings.
   Both readers accept either delimiter; a reader that only knew `"` would have
   gone quietly blind on exactly the rules the fix touched, which is the failure
   mode a gate must not have.

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

/* 4. the React tier's own scoped rules — the sink is named even when the host
      is a utility. EITHER DELIMITER: since 2.8.0 an arbitrary variant whose
      target is a BEM class is written `String.raw`[&_.card\_\_title]:…``, so a
      reader that only knew `"` would miss precisely the escaped ones. The
      backslashes come out before the class names go in — `.card\_\_title` is
      `.card__title` with two CSS escapes in it, not a class called `card`. */
for (const f of readdirSync(join(PKG, "dist", "react"))) {
  if (!f.endsWith(".tsx")) continue;
  const src = readFileSync(join(PKG, "dist", "react", f), "utf8");
  for (const m of src.matchAll(/["`]\[&([^"`]*)\]:/g))
    for (const c of m[1].replace(/\\/g, "").matchAll(/\.([a-zA-Z][\w-]*)/g)) need(c[1], `react:${f}`);
}

/* 5. THE SINK of any descendant rule in components.css, when that sink is a
      BEM class. Read off the stylesheet rather than the .tsx, so it states the
      relation that is actually doing the work rather than a claim about the
      emitter — and it overlaps source 4 by design: a rule that only
      components.css carries (an authored gap, a print block, a media query)
      still needs the name at its far end.

      THE HOST HALF IS GONE, WHICH IS THE 2.8.0 CHANGE. It was here because the
      escaping defect meant pipeline 2 compiled such a rule to a selector no
      page matched, leaving components.css the only surface delivering it and
      the host's class the only way in. The emitter escapes now — the count at
      the foot of this file is zero — so a host wearing its component's utility
      carries its own scoped rule and needs no name. Nothing else changed: a
      sink is a sink under either pipeline. */
{
  const css = strip(readFileSync(join(PKG, "css", "components.css"), "utf8"));
  for (const m of css.matchAll(/(^|[}\n])\s*([^{}@]+?)\s*\{/g)) {
    for (const sel of m[2].split(",")) {
      const parts = sel.trim().split(/\s+|(?=>)/).filter(Boolean);
      if (parts.length < 2) continue;
      for (const p of parts.slice(1))
        for (const c of p.matchAll(/\.([a-zA-Z][\w-]*)/g))
          if (c[1].includes("__")) need(c[1], "bem-descendant");
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
    /* Either delimiter, for the reason source 4 gives: half the tier's class
       strings are `String.raw` literals since the escaping fix. */
    const classes = [...body.matchAll(/"([^"]+)"|`([^`]+)`/g)].map((x) => x[1] ?? x[2]);
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

/* ---------- the two fixed defects, still counted ----------
   Reads the BUILT css and finds every arbitrary-variant rule whose escaped
   class name holds a BEM target that the compiled descendant selector has
   turned into a space. It counted nineteen at 2.6.0 and counts zero at 2.8.0,
   which is what retired the host half of source 5 — so it stays as the watch
   on that retirement rather than as a report. Printed, never failed: neither
   is this app's bug, and a red gate for somebody else's defect is a gate that
   gets muted. Either line reappearing means a class this app has stopped
   writing is needed again. */
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
      `check-class-hooks: UPSTREAM 1 HAS REGRESSED — ${broken.size} scoped rules in\n` +
        `  @yordan/design-system's React tier compile to the wrong selector again, because the "_" in a\n` +
        `  BEM class name is unescaped and Tailwind reads it as a space: ${[...broken].sort().slice(0, 4).join(", ")}…\n` +
        `  components.css is then the only surface delivering them, and the HOST half of source 5 —\n` +
        `  retired at 2.8.0 — has to come back. Not this app's to fix; report it upstream.\n`
    );
  if (orderDependent.length)
    console.log(
      `check-class-hooks: UPSTREAM 2 HAS REGRESSED — ${orderDependent.length} cva base list(s) put a shorthand and\n` +
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
