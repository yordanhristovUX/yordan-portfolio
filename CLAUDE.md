# Blueprint portfolio

Static site (no build step) + its design system. Two pages: `index.html` (portfolio) and
`cv.html` (print-native CV, served at `/cv`).

Run it locally with `npx serve .` — or the `site` config in `.claude/launch.json`.

**Start at [`ARCHITECTURE.md`](ARCHITECTURE.md)** — one page: the dependency graph, the rule
that every boundary crossing is a generated artefact rather than a code import, and a
"for task X, open slice Y" table. It is the only file you need to read to find out which
slice you actually need.

**Before touching any UI, read `design-system/README.md`.** In short:

- All colours/fonts/spacing come from `design-system/tokens/tokens.json` → run
  `npm run build` in `design-system/` after token edits. Never write raw palette values in
  CSS — semantic variables only.
- Every component = CSS block + `spec.md` + story (the DS build enforces this).
- `css/style.css` is page layout ONLY; component styles belong in
  `design-system/css/components.css`.
- **Dark mode is tokens, not media queries.** A themed colour gets a `dark` value beside its
  light one in `tokens.json`; the build emits the media query and the `[data-theme]`
  override. Never add `prefers-color-scheme` to `components.css` or `style.css`.
- **Print colour is also tokens** — a `print` value beside `dark`, emitted as `@media print`.
  A page stylesheet's `@media print` block may contain layout only, never a colour.
- **`.rail { contain: size }` is load-bearing.** The rail is decoration and must never size
  its band; without it the squares feed back into the row height and the page runs away to
  tens of thousands of nodes. See `design-system/components/skeleton/spec.md`.
- Anything in `js/` that uses a themed colour reads it via `getComputedStyle` and re-reads on
  the `themechange` event (see `js/automata.js`). No colour literals in JS.
- GSAP is vendored in `js/vendor/gsap/` — do not swap it back to a CDN, and keep the
  `HAS_GSAP` guard in `js/main.js`: it is what stops a load failure from leaving the page
  blank. Details in `js/vendor/gsap/README.md`.
- **Copy is generated too.** Every word on both pages is authored in `content/` and compiled
  by `scripts/build-content.mjs` into `js/case-studies.js`, the `<!-- content:… -->` regions
  of `index.html`/`cv.html`, `content/dist/`, and `llms.txt`. Never hand-edit those; edit
  `content/` and re-run. Copy is moved verbatim, never rewritten — see `content/CLAUDE.md`.
  Run order is `design-system/scripts/build.mjs` (it emits the counts) then
  `scripts/build-content.mjs` (it interpolates them).
- Figma sync is one-way repo → Figma: `design-system/figma/push-guide.md`.
- Storybook: `npm run storybook` in `design-system/` (port 6006).
- `generated/` is a read-only reference (the complex design system this one simplifies) —
  never edit or build it.
