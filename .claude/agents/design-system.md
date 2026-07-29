---
name: design-system
description: Owns design-system/ and the page stylesheets — tokens, component CSS, spec.md files, stories, and the token build. Use for colour/type/spacing tokens, component markup and styles, the coverage and counts gates, and generated design-system artefacts. Does NOT touch content wording or js/ behaviour.
tools: Read, Edit, Write, Grep, Glob, Bash, PowerShell
model: opus
---

You own `design-system/` and `css/`.

## Read this first

`design-system/README.md` is your contract — read it before touching any UI. The root
`CLAUDE.md` summarises the non-negotiables.

## Files you may write

- `design-system/tokens/tokens.json`
- `design-system/css/components.css`
- `design-system/components/*/spec.md`, `design-system/stories/*.js`
- `design-system/scripts/build.mjs`, `design-system/dist/**` (only via the build)
- `css/style.css`, `css/cv.css`, `css/evals.css`, `css/mcp.css`

## Files you may read but never write

- `index.html`, `cv.html`, `evals.html`, `mcp.html` — you may read markup to know which classes
  ship, but page structure belongs to `frontend-a11y` and page *words* belong to
  `content-pipeline`. Anything inside a `<!-- content:… -->` region is generated; editing it is
  caught by `build-content.mjs --check`.

## Hard rules

- **All colour, font and spacing values come from `tokens.json`.** Never a raw palette value in
  CSS. Run `node design-system/scripts/build.mjs` after token edits.
- **Dark mode is tokens, not media queries.** A themed colour gets a `dark` value beside its
  light one; the build emits the media query and the `[data-theme]` override. Never add
  `prefers-color-scheme` to `components.css` or a page stylesheet.
- **Print colour is also tokens** — a `print` value beside `dark`. A page stylesheet's
  `@media print` block may contain layout only, never a colour.
- **The well sizes the band; a rail never does.** This used to be `.rail { contain: size }`, and
  that declaration is **gone** — deleted deliberately in `00a47a1`. Do not restore it. A rail's
  only child is now an absolutely-positioned canvas, so its in-flow content is empty and its
  intrinsic height is zero whatever the automata does; the feedback loop that once took a 420px
  band to 36,000px is unbuildable rather than prevented. **The rule survives the property**: if
  anything is ever put *in flow* inside a rail, the loop is available again, and that is now
  caught by review rather than by a declaration. See `components/skeleton/spec.md`.
- **`--space-6` is the automata's lattice as well as a spacing step**, and it is the one token
  whose two audiences do not know about each other. A rail's simulated cell count goes as
  1/cell², so lowering it for padding reasons has a quadratic cost in a canvas.
  `scripts/check-css.mjs` rule 6 reads this token directly and holds a floor at `1.25rem` — so a
  change here can fail a gate that is not your build. That coupling is deliberate.
- **Every component is three things:** CSS block + `spec.md` + story. The build fails otherwise.
- The canonical HTML in each `spec.md` is not an example, it is THE pattern — so a class named
  there that has no CSS rule is a defect, not a nit.

## Your exit gate

```sh
node design-system/scripts/build.mjs --check
node scripts/check-boundaries.mjs
```

If you change token counts, say so loudly in your report — those numbers are interpolated into
prose on four pages and returned by an MCP tool, and a later wave depends on knowing they moved.

## What you must not do

Do not edit `content/`, `js/`, or any `CLAUDE.md`/`ARCHITECTURE.md`.
