# Blueprint design system

AI-ready, repo-first design system for the portfolio at the repo root. **Read this file
before touching any UI.** It is the entry point for humans and AI agents alike.

## The three rules

1. **Tokens are born in one place.** `tokens/tokens.json` is the only file where a colour,
   font stack, **type size** or spacing value may be written literally. Components use
   semantic CSS variables (`--surface-page`, `--content-primary`, `--text-xs`,
   `--space-4`…) — never raw ramp values, never new literals. Run `npm run build` after
   editing tokens. From the repo root, `node scripts/check-css.mjs` fails on any literal
   `font-size` here or in a page stylesheet — see "The type scale" below.
2. **Every component is three things**: a CSS block in `css/components.css`, a spec in
   `components/<name>/spec.md`, and a story in `stories/<name>.stories.js`. The build's
   coverage check (`npm run build`) fails if any leg is missing. The same run also fails if
   the counts the site advertises about itself have gone stale — see below.
3. **Figma is an output, never a source.** Sync is one-way, repo → Figma, via the MCP
   procedure in `figma/push-guide.md`.
4. **Themes are tokens, not queries.** A colour that changes between light and dark gets a
   `dark` value beside its light one in `tokens.json`. There is no `prefers-color-scheme`
   media query anywhere in `css/components.css`, and adding one is a bug — see below.

## Map

```
tokens/tokens.json      source of truth: colour, type, rhythm (edit here)
scripts/build.mjs       tokens → dist/ + coverage check   (npm run build)
dist/tokens.css         generated :root variables — the site <link>s this
dist/tokens.flat.json   generated machine-readable tokens — AI + Figma push read this
css/components.css      every component's styles (hand-authored, semantic tokens only)
assets/                 artwork a component ships with, served as-is (avatar.svg)
components/*/spec.md    per-component: pattern, variants, tokens, a11y, AI do/don't
stories/*.stories.js    Storybook (CSF3, vanilla HTML strings)  (npm run storybook → :6006)
figma/push-guide.md     the repeatable Figma Variables push (Figma MCP)
```

The site consumes the system with two `<link>` tags in `../index.html`
(`dist/tokens.css` then `css/components.css`) ahead of the page-layout stylesheet
`../css/style.css` — no build step in the site itself.

**`dist/`, `css/` and `assets/` are the published surface; everything else here is
private.** `scripts/check-boundaries.mjs` names `tokens/`, `components/`, `stories/`,
`scripts/` and `figma/` as internals that nothing outside this directory may reach into, and
its silence about the other three is the permission. `assets/` holds artwork that belongs to
a component rather than to the copy: `avatar.svg` is the portrait
`components/drawer/spec.md` prints on its plate. It is a derivative of the owner's export in
`../content/assets/`, which stays untouched — content owns the words and the figures inside
them, the system owns its own chrome.

## Theming (light / dark)

The whole theme is 24 re-aliased semantic tokens. Nothing else in the system knows a theme
exists — that is the design, and it is what proves the semantic tier is real rather than
decorative.

```jsonc
// tokens.json — the light value and its dark counterpart, together
"surface-page": { "value": "var(--stone-100)", "dark": "var(--stone-900)" }
```

`scripts/build.mjs` turns that into three blocks in `dist/tokens.css`: `:root` (light),
`@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) }`, and
`:root[data-theme="dark"]`. So the OS preference is followed by default and the visitor's
explicit choice wins in either direction.

**Only the semantic tier flips.** The raw ramps never move; dark mode walks the *same*
stone and slate ramps to the other end. A token that aliases another
(`content-primary` → `primary`) inherits the flip for free and needs no `dark` of its own —
which is why the CSS has no per-component dark rules at all.

Three rules for anyone extending it:

- **No `prefers-color-scheme` in `components.css`.** If a component needs a different colour
  in dark, the thing that varies is a *token*. Add the `dark` key and the component stops
  caring.
- **Not every token inverts literally.** `rule-strong` is `2px solid var(--content-primary)`
  in light; inverted literally that becomes a glaring 2px near-white bar across every
  section, so its dark value is the strong chrome border instead. Judgement belongs in
  `tokens.json`, where it can carry a `description` explaining itself.
- **One token refuses to invert at all, and it is the clearest case for the tier.**
  `surface-portrait` is stone-50 in light and stone-**100** in dark: still paper, one step
  down the same end of the ramp. It is the plate the face illustration is printed on, and
  that illustration is dark line-art over light fills — on a stone-900 page its ink measures
  1.09:1 and the hair and jacket simply disappear. The condition is "this artwork is not
  theme-neutral", which is a fact about a colour and therefore a `dark` value here; the
  drawer that shows it contains no theme query and does not know a theme exists. See
  `components/drawer/spec.md` for the measured table.
- **JS that reads a themed colour must re-read it.** Read via `getComputedStyle` and listen
  for the `themechange` window event — `js/automata.js` is the reference implementation.
  Values cached at load will be wrong the moment the theme changes.

Contrast is checked in both themes; the AA reasoning for each pairing lives in the `$doc`
and `description` fields in `tokens.json`, next to the values it justifies.

### Paper is the third theme

A token may also carry a `print` value. The build emits it last, as `@media print`, so it
beats both screen themes — someone reading in dark still prints ink on paper.

```jsonc
"accent": { "value": "hsl(225 100% 47%)", "dark": "hsl(225 100% 68%)", "print": "var(--ink-900)" }
```

Print is not a preference but a physical constraint: no backlight, ink costs money, and
greyscale is likely. So surfaces collapse to one, the accent returns to ink rather than
becoming an ambiguous grey, and shadows and the skeleton grid disappear entirely. Print
values alias the raw ramps like any other token — **no page stylesheet contains a colour
for print.** `css/cv.css` is the reference: its `@media print` block is layout only.

**Print is not only a colour tier.** Every step of the type scale carries a `print` value
in pt, and `--space-nav` prints as `0`. That is not tidiness: a `clamp(3rem, 11.5vw,
10.5rem)` has no viewport to scale against on a sheet of A4, and paper wants an absolute
ramp. `css/cv.css` used to carry twenty-two hand-tuned `pt` sizes; it now carries four,
and each of those four is a token reference marking a place where a component changes
*level* on paper — a fact's display number becoming a run of body prose. The `mm` values
that remain there stay literal on purpose: a millimetre is a physical fact about the
sheet, not a step on a rhythm ramp.

## The type scale

Twelve steps, split at body. Below body — `--text-2xs` `--text-xs` `--text-sm`
`--text-md` — sizes are fixed rem on a ~1.085 ratio, because chrome has no voice and must
not grow with the window. At and above body — `--text-base` `--text-lead` `--text-sub`
`--text-heading` `--text-title` `--text-display` `--text-display-xl` `--text-display-hero`
— every step is a named voice in the hierarchy and is `clamp(min, vw, max)`, because a
display line has to survive both a 375px phone and a 1600px sheet. Two `em` **ratios**
(`--text-code`, `--text-unit`) sit outside the ramp: they mean "a fraction of whatever set
me", which a scale cannot express. Full table: `components/typography/spec.md`.

Rhythm works the same way. `--space-1…7` is a fixed 4px ramp (4/8/12/16/20/24/32) for
space *inside* a component; `--space-flow-sm` / `--space-flow` / `--space-flow-lg`,
`--space-nav` and `--pad` / `--pad-y` are fluid, for space *between* things, where the
page's rhythm should breathe with the viewport.

This is the half of the token layer that had rotted. The colour tier held — every colour
had a semantic name and no ramp value was reachable outside `tokens.json` — while type
accumulated **89 font-size declarations at 40 distinct values**, fourteen of them inside a
single 0.34rem band, rendering at 1280px as 10.88 / 11.2 / 11.52 / 12.48 / 12.8 / 13.6 /
14.08 / 14.4 / 14.72px. Nobody chose those. Prose in this file said not to; nothing
enforced it, so it happened anyway. `scripts/check-css.mjs` is the enforcement, and it is
the point of the exercise more than the tokens are.

## The counts gate

`npm run build` fails if `../README.md`, this file, `../cv.html` or `../js/case-studies.js`
no longer state the current **token count, value count, component count** — or, in the two
READMEs, the **dark count**. Those figures are a claim the site makes about itself in
public, so they get the same enforcement as component coverage — during one session they
went stale twice, which is exactly the drift this system exists to prevent.

- **tokens** — entries in `tokens.json` (84)
- **values** — light + dark + print + wide authored values across those tokens (149). Note this is
  not the number of declarations in `dist/tokens.css`, which is higher: the dark block is
  emitted twice, once for the media query and once for the pinned override.
- **components** — directories under `components/` (21)
- **dark** — tokens carrying a `dark` value (24)

The dark count was added to the gate after it proved the point the hard way. Deleting one
unused token (`surface-inverse`) took the theme from 24 re-aliased tokens to 23, and the
sentence "the entire dark theme is 24 re-aliased tokens" survived in four files because
nothing asserted it. The count is 24 again today — `surface-portrait` brought it back — and
that coincidence is worth naming: a number that returns to a stale value is exactly the case
a human reviewer cannot catch and a gate does not care about. The same sentence in
`../content/profile.json` is now `{{dark}}` and is interpolated by
`../scripts/build-content.mjs`, so it has one source like everything else.

## The doc arithmetic gate

The counts gate above polices numbers this system publishes **about itself**. This one polices
the numbers it publishes **inside itself** — every figure in a `$doc` or a `description` in
`tokens.json` is recomputed from the values beside it: the contrast ratios, the stated ramps,
the step counts, the aliases, the alphas.

It exists because of a gap that four separate audits walked past. They all verified that the
documentation matched the **code**, and it did. Nothing verified that the documentation matched
the **arithmetic** — this system had a gate enforcing "every size is a token" and none
enforcing "the tokens form a scale". The reason that gap produces errors is not carelessness:

> Consolidation produces a value by averaging what was already there, and an average has no
> author — so the rationale gets written afterwards, describing the result. The prose is most
> confident exactly where the value was least chosen.

A `$doc` is the most load-bearing prose here. It is what a contributor reads instead of
recomputing, it is emitted into `dist/tokens.css` as a comment, and `get_design_system` serves
it to a model that will repeat it. **On the day the gate landed, four contrast figures did not
recompute** — `6.94:1` (is `6.93`), `5.19:1` (is `5.21`), `5.30:1` (is `5.32`) and `1.9:1`
(is `2.42`). The first three are the size of a rounding difference; the last is not, and the
likeliest history is that the accent's lightness moved and the sentence did not follow.

Three things about how it is built are deliberate:

- **No arbitrary tolerances.** A figure is held to its own decimal places, because `6.94:1`
  asserts two. `~1.085` asserts less, so it is held to one unit in its last place. The
  per-step ramp test uses interval arithmetic rather than a fudge factor: a value written to
  2dp stands for an interval, and propagating that gives the band the ratio could really be.
- **The mean is not the scale.** Checking the geometric ratio across the static steps passes a
  mutation that moves an interior step, because the mean depends only on the endpoints. Every
  adjacent ratio is tested. This was caught by mutating the gate, not by reading it.
- **A census, so it cannot rot.** Every contrast-shaped figure anywhere in the prose must be
  registered in the check. Adding one without registering it turns the build red instead of
  being silently unverified — the failure mode that quietly retired `check-css.mjs`'s previous
  rule 6.

What it deliberately does **not** assert is written into the block itself, because a gate's
silence reads as permission. Two examples: it does not require a `clamp()`'s `vw` term to be
live at the viewports the type `$doc` argues from, since `clamp` survives those widths *by*
pinning at them; and it does not flag a value for being the arithmetic mean of the two it
replaced, because that is the consolidation this scale was built by.

Add a token or a component and the build tells you which sentence to update, with the new
numbers. Matching is whitespace-insensitive, so the prose may wrap wherever it reads best.

## How to add a component (4 steps)

1. Read the spec of the closest existing component; reuse it if it fits — most "new"
   components are a variant of Card, Row, or Chip.
2. Add the CSS block to `css/components.css`, with `@component <id>` on its banner.
   Semantic tokens only: `--text-*` for every size, `--space-*` for every gap, padding and
   margin, no borders inside the skeleton (inset box-shadows).
3. Write `components/<name>/spec.md` (pattern, variants, tokens, a11y, AI notes) and
   `stories/<name>.stories.js` with the same canonical HTML as the spec. The `## Tokens`
   list must name **every** token the block consumes — the build cross-checks it against
   the CSS and fails on an omission.
4. `npm run build` (coverage + contract check), then `node scripts/check-css.mjs` from the
   repo root, and use it in the site.

## For AI agents, specifically

- The canonical HTML in each spec.md is not an example — it is THE pattern. Copy it.
- One `.btn--solid` per view; one `.chip--solid` per group; one `.t-statement` per section;
  accent (`--accent`) only in its five sanctioned places (see tokens.json `$doc`). The
  first of those is now checked: `scripts/check-css.mjs` counts `.btn--solid` per shipped
  page, exempting the chat composer's submit (which is the primary action of its own
  surface, and is canonical in `components/chat/spec.md`).
- **Never write a size.** No literal `font-size` may appear in `css/components.css` or in
  `../css/*.css`; pick a `--text-*` step, or add one to `tokens.json` if none fits.
- Never hardcode a colour in JS. `js/automata.js` reads `--automata-cell-rgb` and
  `--accent-rgb` at runtime precisely so the engine has no palette of its own.
- The skeleton (band / rail / well / strip / sq) is layout law: no borders, no px widths,
  content only inside `.well`. Its full contract: `components/skeleton/spec.md`.
- Site-level behaviour (automata engine, dialog logic, reveals) lives in `../js/` and is
  documented in the relevant spec.md files — the system describes the contract, the site
  implements it.
