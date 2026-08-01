# Blueprint portfolio

Static site (no build step) + its design system. Four hand-skeletoned pages —
`index.html` (portfolio), `cv.html` (print-native CV, served at `/cv`), `mcp.html` and
`evals.html` — plus five `work/<id>.html` case studies that are generated **whole** from
`content/`.

There is also a **second front end**, `apps/next/` — the same nine pages in Next.js + React
+ TypeScript, built from the same published artefacts and deployed as a separate Vercel
project. It is a consumer at the bottom of the graph and owns nothing; read
`ARCHITECTURE.md`'s "The second site" section before touching it, and its charter is
`.claude/agents/next-app.md`.

Run it locally with `npx serve .` — or the `site` config in `.claude/launch.json`.

**Start at [`ARCHITECTURE.md`](ARCHITECTURE.md)** — one page: the dependency graph, the rule
that every boundary crossing is a generated artefact rather than a code import, and a
"for task X, open slice Y" table. It is the only file you need to read to find out which
slice you actually need.

**Before touching any UI, read `design-system/README.md`.**

> **Dated note, 2026-08-01 — the design system is mid-revision, and this list is a summary of
> a moving target.** Components are becoming **contract-first**: appearance lives as data in
> `design-system/components/<id>/definition.json` and is rendered by emitters into two
> pipelines — a generated region of `components.css`, and a Tailwind `@theme` + generated
> React components that `apps/next` consumes. At the last commit 13 of 26 blocks generate,
> one is split between the two, and `build.mjs --check` prints the census — read it rather
> than counting markers in the file.
> The rules below are still the rules; where you need detail or a current number,
> **`design-system/README.md` and `design-system/PATTERNS.md` are the truth** and this file
> is a summary. The full architectural write-up is a scheduled pass and is not here yet.

In short:

- All colours/fonts/spacing come from `design-system/tokens/tokens.json` → run
  `npm run build` in `design-system/` after token edits. Never write raw palette values in
  CSS — semantic variables only.
- Every component has a `spec.md` and a story, and the build fails otherwise. Its CSS is
  either **generated** from `components/<id>/definition.json` — in which case do not edit the
  block, edit the definition — or authored, in which case the block must carry a census
  reason from a closed vocabulary that the build checks is really present. Both halves of
  `components.css` are marked in the file; look at the marker before you type into it.
- **`design-system/css/components.css` is no longer plain authored source.** Roughly half of
  it is emitter output between markers, byte-compared on every `--check`. A hand-edit inside
  a generated region is overwritten by the next build and fails the gate before that.
- `css/style.css` is page layout ONLY; component styles belong in
  `design-system/css/components.css`.
- **Dark mode is tokens, not media queries.** A themed colour gets a `dark` value beside its
  light one in `tokens.json`; the build emits the media query and the `[data-theme]`
  override. Never add `prefers-color-scheme` to `components.css` or `style.css`.
- **Print colour is also tokens** — a `print` value beside `dark`, emitted as `@media print`.
  A page stylesheet's `@media print` block may contain layout only, never a colour.
- **The well sizes the band; a rail never does.** This used to be `.rail { contain: size }`,
  and that declaration is **gone** — do not restore it. A rail's only child is an
  absolutely-positioned canvas, so its in-flow content is empty and the feedback loop that once
  took a 420px band to 36,000px is now unbuildable rather than prevented. The *rule* outlives
  the property: nothing goes in flow inside a rail. See
  `design-system/components/skeleton/spec.md`.
- **`--space-6` is the automata's lattice as well as a spacing step**, and it is the one token
  whose two audiences don't know about each other. A rail's simulated cell count goes as
  1/cell², so lowering it for padding reasons quadruples a canvas simulation.
  `scripts/check-css.mjs` holds a floor at `1.25rem` and a ceiling on the off-stage padding.
- Anything in `js/` that uses a themed colour reads it via `getComputedStyle` and re-reads on
  the `themechange` event (see `js/automata.js`). No colour literals in JS.
- GSAP is vendored in `js/vendor/gsap/` — do not swap it back to a CDN, and keep the
  `HAS_GSAP` guard in `js/main.js`: it is what stops a load failure from leaving the page
  blank. Details in `js/vendor/gsap/README.md`.
- **Copy is generated too.** Every word on the pages is authored in `content/` and compiled
  by `scripts/build-content.mjs` into the `<!-- content:… -->` regions of
  `index.html`/`cv.html`, the five `work/<id>.html` pages, `content/dist/`, and `llms.txt`
  — ten files, and `--check` byte-compares all of them. Never hand-edit those; edit
  `content/` and re-run. Copy is moved verbatim, never rewritten — see `content/CLAUDE.md`.
  Run order is `design-system/scripts/build.mjs` (it emits the counts) then
  `scripts/build-content.mjs` (it interpolates them). (`js/case-studies.js` used to be on
  that list and is **gone** — the modal it fed was retired when the case studies got real
  pages.)
- **There is a second pipeline, and `apps/next` is its consumer.** The same definitions
  render `dist/tokens.tailwind.css` (every entry a `var()` reference to the runtime token, so
  dark, print and the wide tier reach a utility by the mechanism they already reach a rule by)
  and a typed React component per generated block. Never hand-write a React mirror of a
  component: it is emitter output, and its subpath is in the package's `exports`. Details in
  `design-system/README.md`.
- Figma sync is one-way repo → Figma: `design-system/figma/push-guide.md`.
- Storybook: `npm run storybook` in `design-system/` (port 6006). Two browser gates —
  `npm run test:a11y` and `npm run test:visual` — live there too and deliberately do **not**
  join the root `npm run check`, which stays offline and browser-free.
- Deploying anything (env vars, the second Vercel project, response headers) is
  `docs/DEPLOY-RUNBOOK.md`. Nothing about it is committable, which is why it is written down.
- `generated/` is a read-only reference (the complex design system this one simplifies) —
  never edit or build it.
