# Yordan Hristov — Portfolio, built on its own design system

**Live site:** https://yordan-portfolio.vercel.app · **Storybook:** run it locally —
`npm run storybook` in `design-system/`. There is no public Storybook deployment yet:
`yordan-design-system.vercel.app` is currently a second domain on the portfolio project and
serves this same site (checked — `/cv` resolves there). Standing it up is one Vercel project
away; the steps are in [`docs/DEPLOY-RUNBOOK.md`](docs/DEPLOY-RUNBOOK.md).

A senior product designer's portfolio that doesn't just *describe* AI-ready design systems —
it runs on one. Static HTML/CSS/JS with **no build step**, consuming an AI-first, repo-first
design system that lives in this same repository, documents itself for both humans and AI
agents, renders in Storybook, and pushes its tokens to Figma.

```
tokens/tokens.json ──▶ build.mjs ──▶ dist/tokens.css ────▶ the site (2 <link> tags)
   (source of truth)     (zero deps)   dist/tokens.flat.json ─▶ AI agents · Figma push
                                       dist/tokens.dtcg.json ─▶ a consumer with its own
                                       dist/tokens.d.ts          token pipeline · a TS build
                                       css/components.css ──▶ site + Storybook
components/<id>/definition.json ─▶ emit-css ──▶ a generated region of components.css
   (appearance as data)          ─▶ emit-tailwind + emit-react ──▶ dist/tokens.tailwind.css
                                                                  dist/react/<id>.tsx ─▶ apps/next
components/*/spec.md  ◀── every component = spec + story, and CSS that is generated or
                          authored-with-a-reason (build-enforced, either way)
```

## The design

**Utilitarian brutalism with a blueprint/engineering aesthetic.** Warm stone paper for
content, cold slate for chrome, iron-gall ink as primary, one scarce blueprint-blue accent.
The page skeleton is a 24-square sheet whose side rails are *real* square divs sized by the
layout's own `fr` tracks — and Conway's Game of Life lives on those squares. Hover one and
it lights accent-blue; click to seed new life whose lineage stays visibly yours for a few
generations. "An old sketchbook with machines that help."

## The system (`design-system/`)

- **Repo-first tokens** — [`tokens/tokens.json`](design-system/tokens/tokens.json) is the
  only place a colour, a type size or a spacing step is born; a zero-dependency script
  generates the CSS variables the site loads and a flat JSON that AI agents and the Figma
  push read. 107 tokens carrying 171 values across light, dark, print and wide, in two tiers
  (raw ramps → semantic layer).
- **Light, dark and paper from one source** — a themed token carries its `dark` value (and,
  where it matters, its `print` value) beside its light one; the build emits the media
  query, the pinned-theme override, and the print block. The entire dark theme is 23
  re-aliased semantic tokens and **zero** per-component dark rules — the sharpest test a
  semantic tier can be put to. No stylesheet anywhere contains a colour for print, and
  since the type scale landed, none contains a literal `font-size` either: paper gets its
  own pt sizes down the same pipe the colours use. `scripts/check-css.mjs` enforces it.
- **26 components, and their appearance is becoming data** — each carries an AI spec
  ([example](design-system/components/button/spec.md)) and a Storybook story, and `npm run
  build` fails if either is missing. The third leg is mid-migration: a component's CSS is
  either *generated* from `components/<id>/definition.json` — about half the stylesheet at the
  time of writing, byte-compared on every build — or authored, in which case it must declare
  why, from a closed vocabulary the build checks against the block itself.
- **AI-first** — [`CLAUDE.md`](CLAUDE.md) routes agents to
  [`design-system/README.md`](design-system/README.md); every spec carries canonical HTML
  patterns and do/don't rules written for machine consumption.
- **A package, not a folder** — `@yordan/design-system` at a real version, with an `exports`
  map that is the authority on what is published (read `design-system/package.json`; the list
  grows with the migration) and `RELEASED.json` as the published contract.
  `contract-diff.mjs` classifies every change across four surfaces — tokens, components,
  definitions and the subpath list — as added name MINOR, changed value PATCH, removed or
  renamed MAJOR, and fails when the version bump does not cover the class.
- **Two pipelines, one source** — the same definitions render the stylesheet the vanilla site
  loads *and* a Tailwind `@theme` plus typed React components. Neither is a translation of the
  other; the `@theme` holds no values at all, only `var()` references, so dark mode and print
  reach a utility by the mechanism they already reach a hand-written rule by.
- **Figma is an output** — one-way repo→Figma variables push, executed by an AI agent via
  the Figma MCP: [`figma/push-guide.md`](design-system/figma/push-guide.md).
- **Storybook** — vanilla-HTML stories over the very CSS the site ships. axe runs over every
  story in CI and a violation fails the job, so "accessible stories" is a gate rather than a
  claim; a screenshot of each story is captured beside it, report-only until 2026-09-01.

## Run it

```sh
npx serve .                      # the site — no build step; /, /cv, /mcp, /evals, /work/<id>
cd design-system
npm install
npm run build                    # tokens → dist + coverage check
npm run storybook                # Storybook on :6006
```

`/cv` is the CV: same tokens, same components, light and dark on screen, and a real print
stylesheet — the colour half of which lives in `tokens.json`, not in the page.

## A second front end, from the same artefacts (`apps/next/`)

The same nine pages exist a second time in `apps/next/` — Next.js, React and TypeScript,
statically exported — and not one of them reads a source file from anywhere else in the
repo. The design system arrives as an installed package, the words arrive as
`content/dist/content.json`, the eval figures arrive as `evals/dist/page.json`, and the
assistant is a `fetch` to the other deployment's `/api/chat`. It is there because "one
source, many surfaces" is easy to assert and cheap to check: a second renderer either builds
from the published artefacts or it does not, and `scripts/check-boundaries.mjs` is what
decides which. Details in [`ARCHITECTURE.md`](ARCHITECTURE.md); it runs standalone, with its
own lockfile, and `npm ci` at the repo root installs none of it.

## The MCP server (`api/mcp.js`)

The portfolio is also a **remote MCP server**: read-only tools over the same content index
the site is built from, served over streamable HTTP. Six read the portfolio corpus —
projects, case studies, employment history, profile, repository statistics, search. Two more
read the **design system's own contract**: `get_design_system` returns the token categories,
the component index and the rules markup must obey to be on-system, and `get_component`
returns one component's classes, `__element` and `--variant` suffixes, full selector list and
the exact tokens its CSS consumes — all extracted from the shipped stylesheet by the design
system's own build, so the server cannot describe a class that does not exist. Add it to
Claude Code —

```sh
claude mcp add --transport http yordan https://yordan-portfolio.vercel.app/api/mcp
```

— or to `claude_desktop_config.json`:

```json
{ "mcpServers": { "yordan": { "url": "https://yordan-portfolio.vercel.app/api/mcp" } } }
```

Then ask your own Claude "what did Yordan do at Domestina?" and it answers from
`get_project`, not from a chat widget on someone else's page. Setup, the tool table and the
reasoning are at [`/mcp`](mcp.html).

The tools are not implemented in `api/`. They live in `lib/knowledge/` as pure functions over
`content/dist/content.json`, and **both** consumers import that one module — the site's own
assistant calls it in process, this endpoint exposes it to everyone else. One core, two
surfaces, so a tool bug cannot exist on one and not the other. MCP here is a *distribution*
surface, not the web chat's internal boundary; `api/CLAUDE.md` says why routing the chat
through it was rejected.

Every tool is read-only by construction — no writes, no side effects, no state, no auth, no
API key on the server's side. That is what bounds the worst case of a public endpoint to cost
rather than to data.

## Accessibility

WCAG 2.1 AA is a stated tolerance, not an aspiration: AA-checked contrast baked into the
token choices **in both themes** (documented in tokens.json next to the values it justifies),
full `prefers-reduced-motion` handling, dialog focus trap/restore, semantic landmarks,
keyboard focus rings throughout.

The site also degrades rather than breaks: GSAP is vendored rather than fetched from a CDN,
and `main.js` only hides the animated-in elements once GSAP is confirmed loaded — so a
missing or blocked script yields a static, fully readable page instead of a blank one.

## License

Code is MIT. Case-study texts and personal content are © Yordan Hristov, all rights
reserved. The full story of this repo is a case study on the site itself — *This Site —
Portfolio as a Product*.
