# Blueprint design system

AI-ready, repo-first design system for the portfolio at the repo root. **Read this file
before touching any UI.** It is the entry point for humans and AI agents alike.

## The three rules

1. **Tokens are born in one place.** `tokens/tokens.json` is the only file where a colour,
   font stack, or spacing value may be written literally. Components use semantic CSS
   variables (`--surface-page`, `--content-primary`, `--accent`…) — never raw ramp values,
   never new literals. Run `npm run build` after editing tokens.
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
tokens/tokens.json      source of truth (edit here)
scripts/build.mjs       tokens → dist/ + coverage check   (npm run build)
dist/tokens.css         generated :root variables — the site <link>s this
dist/tokens.flat.json   generated machine-readable tokens — AI + Figma push read this
css/components.css      every component's styles (hand-authored, semantic tokens only)
components/*/spec.md    per-component: pattern, variants, tokens, a11y, AI do/don't
stories/*.stories.js    Storybook (CSF3, vanilla HTML strings)  (npm run storybook → :6006)
figma/push-guide.md     the repeatable Figma Variables push (Figma MCP)
```

The site consumes the system with two `<link>` tags in `../index.html`
(`dist/tokens.css` then `css/components.css`) ahead of the page-layout stylesheet
`../css/style.css` — no build step in the site itself.

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

## The counts gate

`npm run build` fails if `../README.md`, `../cv.html` or `../js/case-studies.js` no longer
state the current **token count, value count, or component count**. Those figures are a
claim the site makes about itself in public, so they get the same enforcement as component
coverage — during one session they went stale twice, which is exactly the drift this system
exists to prevent.

- **tokens** — entries in `tokens.json` (59)
- **values** — light + dark + print authored values across those tokens (106). Note this is
  not the number of declarations in `dist/tokens.css`, which is higher: the dark block is
  emitted twice, once for the media query and once for the pinned override.
- **components** — directories under `components/` (17)

Add a token or a component and the build tells you which sentence to update, with the new
numbers. Matching is whitespace-insensitive, so the prose may wrap wherever it reads best.

## How to add a component (4 steps)

1. Read the spec of the closest existing component; reuse it if it fits — most "new"
   components are a variant of Card, Row, or Chip.
2. Add the CSS block to `css/components.css` (semantic tokens only, no borders inside the
   skeleton — inset box-shadows).
3. Write `components/<name>/spec.md` (pattern, variants, tokens, a11y, AI notes) and
   `stories/<name>.stories.js` with the same canonical HTML as the spec.
4. `npm run build` (coverage check) and use it in the site.

## For AI agents, specifically

- The canonical HTML in each spec.md is not an example — it is THE pattern. Copy it.
- One `.btn--solid` per view; one `.chip--solid` per group; one `.t-statement` per section;
  accent (`--accent`) only in its five sanctioned places (see tokens.json `$doc`).
- Never hardcode a colour in JS. `js/automata.js` reads `--automata-cell-rgb` and
  `--accent-rgb` at runtime precisely so the engine has no palette of its own.
- The skeleton (band / rail / well / strip / sq) is layout law: no borders, no px widths,
  content only inside `.well`. Its full contract: `components/skeleton/spec.md`.
- Site-level behaviour (automata engine, dialog logic, reveals) lives in `../js/` and is
  documented in the relevant spec.md files — the system describes the contract, the site
  implements it.
