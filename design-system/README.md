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
   coverage check (`npm run build`) fails if any leg is missing.
3. **Figma is an output, never a source.** Sync is one-way, repo → Figma, via the MCP
   procedure in `figma/push-guide.md`.

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
- The skeleton (band / rail / well / strip / sq) is layout law: no borders, no px widths,
  content only inside `.well`. Its full contract: `components/skeleton/spec.md`.
- Site-level behaviour (automata engine, dialog logic, reveals) lives in `../js/` and is
  documented in the relevant spec.md files — the system describes the contract, the site
  implements it.
