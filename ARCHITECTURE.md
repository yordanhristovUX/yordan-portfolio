# Architecture

One page. Read this to find out **which slice you need** — then read that slice's
`CLAUDE.md` (or `README.md`) and nothing else.

## The dependency graph

Acyclic and one-directional. Nothing points back up.

```
design-system/          owns tokens + components
   │  emits  dist/tokens.css · dist/tokens.flat.json
   │         · dist/components.json          (the derived component contract)
   │         · content/system.generated.json (the token/component counts)
   ▼
content/                owns every word on the site
   │  consumes both of the above and folds components.json in verbatim
   │  emits  content/dist/content.json · generated page regions · js/case-studies.js
   │         · content/dist/site.jsonld · llms.txt
   ▼
lib/knowledge/          owns retrieval — tools, BM25 + embeddings, answer schema, validators
   │  emits  the tool API + JSON Schemas
   ├────────────────┬─────────────────┐
   ▼                ▼                 ▼
api/chat.js      api/mcp.js        evals/
  (Phase 3)        (Phase 2)          │  emits  results.json · evals.html regions

(site root)  index.html · cv.html · mcp.html · evals.html · css/ · js/
   consumes design-system/dist + content-generated regions + api/ OVER HTTP
```

`js/` is a governed slice with its own rule in the boundary gate, not a free-for-all: it may
read `design-system/`'s published CSS and `content/dist/`, and it may `fetch` `/api/chat`,
but it may not import `lib/`, `api/`, `evals/` or `scripts/` as code. Nothing in those runs
in a browser, so such an import is either a mistake or the first step of moving retrieval
into the client.

The design system therefore reaches `lib/knowledge/` by exactly the same route the copy
does — through `content/dist/content.json`. `get_design_system` and `get_component` read
`content.designSystem`, which `scripts/build-content.mjs` copied out of
`design-system/dist/components.json`. No tool imports the design system.

`content/` never reads `lib/`. `lib/knowledge/` never reads `api/`. The design system
knows about none of them.

## The load-bearing rule

**Every crossing *between slices* is a generated artefact with a schema, never a code
import.**

`lib/knowledge/` does not import from `content/` — it reads `content/dist/content.json`,
whose shape is documented and version-stamped. So working on retrieval needs the *schema of
that file* in context, not the 14 project files that produced it. Same for the site: it
consumes `dist/tokens.css` and generated HTML regions, never the design system's or the
content pipeline's internals.

**The one exception, named here so the graph above is not read as claiming otherwise.**
`api/` and `evals/` both `import` `lib/knowledge/index.js` as code, and the arrows in the
graph say so. The argument for calling that legitimate rather than a violation is in
`api/CLAUDE.md` ("What this consumes"): those two are not peer slices across a boundary,
they are the two *consumers* of `lib/knowledge/`, sitting directly beneath it. A generated
artefact between them would buy nothing and would let a tool bug exist on one surface and
not the other, which is the property the whole arrangement exists to guarantee.
`scripts/check-boundaries.mjs` encodes exactly that distinction: its rule list bans nothing
matching `lib/` from `api/` or from `evals/`, bans each of those two from reaching the
other, and bans `lib/knowledge/` from reaching either.

The context needed to work on any slice is **its own source plus the schemas of its
inputs** — never the whole repo. `scripts/check-boundaries.mjs` asserts the direction in
CI, because every boundary in every repo erodes within a month of being drawn.

It also asserts the direction's *negative space*, which is the harder half. A rule bans a
slice's source and stays silent about its `dist/`; that silence is the permission, and
silence is invisible in review. So the gate carries a `CROSSINGS` list naming every real
crossing this architecture depends on — retrieval reading `content/dist/content.json`,
`build-content.mjs` reading `design-system/dist/components.json`, `js/answer-render.js`
reading the published corpus — and asserts each is **still legal**. Tighten a rule too far
and it names the line of the gate that is wrong, instead of turning red against a repo that
is behaving correctly.

## For task X, open slice Y

| If you are… | Open | Gate |
| --- | --- | --- |
| changing a colour, a font, a spacing step | `design-system/tokens/tokens.json` | `node design-system/scripts/build.mjs --check` |
| changing how a component looks or is marked up | `design-system/` (CSS + `spec.md` + story) | same |
| changing a **sentence** anywhere on the site or CV | `content/` — see `content/CLAUDE.md` | `node scripts/build-content.mjs --check` |
| adding a project, a role, a skill row, a fact | `content/` | same |
| changing page **layout or structure** (not words) | `index.html` / `cv.html` outside the `<!-- content:… -->` regions, `css/style.css`, `css/cv.css` | serve + open |
| changing the `/mcp` install page or the `/evals` skeleton | `mcp.html` (hand-authored end to end) / `evals.html` outside its `<!-- content:evals-… -->` regions | serve + open |
| changing motion, the case dialog, the automata | `js/` | serve + open |
| changing retrieval, the tools, ranking, the gate, the validators | `lib/knowledge/` — see its `CLAUDE.md` | `npm test` (`test/gate·tools·schema`) then `node evals/run.mjs` |
| changing the question set, an arm, the published numbers | `evals/` — see its `CLAUDE.md` | `node evals/run.mjs --check` |
| changing the chat or MCP endpoints | `api/` | `npm test` (`test/chat-retry`, `test/budget`) + the manual HTTP drive in `api/CLAUDE.md` |

**One honest caveat:** the site root is where everything meets, so it is the one slice that
cannot be fully isolated — changing a component's markup means touching the design system
*and* the pages that use it. That is normal for a composition root, not a design failure.

## Generated files — never hand-edit

Each carries a "generated — do not edit" banner.

| File | Generated by | From | Hand-edit caught by |
| --- | --- | --- | --- |
| `design-system/dist/tokens.css` | `design-system/scripts/build.mjs` | `design-system/tokens/tokens.json` | its **existence** only — see below |
| `design-system/dist/tokens.flat.json` | same | same | existence only |
| `design-system/dist/components.json` | same | `css/components.css` + each `spec.md`'s frontmatter | existence only |
| `content/system.generated.json` | same | the token + component counts | existence, plus the counts gate below |
| `js/case-studies.js` | `scripts/build-content.mjs` | `content/projects/*.md` | `build-content.mjs --check` |
| the `<!-- content:… -->` regions of `index.html`, `cv.html` | same | `content/**` | same |
| `content/dist/content.json` | same | `content/**` + `design-system/dist/components.json` | same |
| `content/dist/site.jsonld` | same | `content/**` | same |
| `llms.txt` | same | `content/**` | same |
| `content/dist/vectors.json` | `scripts/build-vectors.mjs` | the shipped chunk text | `build-vectors.mjs --check` (a digest, not a byte compare) |
| `evals/results.json` | `evals/run.mjs` | `evals/questions.json` + `lib/knowledge/` | `run.mjs --check` |
| the `<!-- content:evals-… -->` regions of `evals.html` | same | same | same |
| `evals/vectors.json` | same | chunk + question text | same, by digest |

**The design system's four outputs are the honest gap, and it is worth knowing before you
trust the banner.** `build.mjs` writes all four unconditionally — `--check` regenerates them
in place and then asserts something *else*: that every component still has a spec and a
story, that each spec agrees with the CSS beside it, that the counts advertised in
`README.md`, `design-system/README.md`, `cv.html` and `js/case-studies.js` are the current
ones, and that every figure in `tokens.json`'s own prose recomputes from the values beside it
— the contrast ratios, the stated ramps, the counts and the aliases. That last gate exists
because four audits confirmed the documentation matched the *code* and nothing confirmed it
matched the *arithmetic*; it found four contrast figures that did not.
`check-boundaries.mjs` separately asserts the four files exist. Nothing compares their
*contents* against what is committed, and CI runs no `git diff`, so a hand-edit to
`dist/tokens.css` is silently overwritten in the workspace rather than failing a gate.
Everything below that line in the table is a real comparison. Treat the top four as
"regenerate and commit", not as "protected".

## Run order

`build.mjs` **emits** `content/system.generated.json`; `build-content.mjs` **consumes** it
and interpolates the numbers into the prose that advertises them. So the system's own
statistics have exactly one source and drift is structurally impossible rather than policed.

```sh
node design-system/scripts/build.mjs        # tokens + dist/ + components.json + system.generated.json
node scripts/build-content.mjs              # content → pages, case studies, index, llms.txt
node scripts/build-vectors.mjs              # chunk embeddings → content/dist/vectors.json (needs a key)
node evals/run.mjs                          # retrieval eval → results.json, evals.html
```

**The gate is `npm run check`.** Do not maintain a second list of it here: the `check`
script in `package.json` is the list, and `.github/workflows/ci.yml` runs the same steps in
the same order — `test/ci.test.js` fails if the two ever disagree. What it covers, in order:
the design system's coverage, counts, spec↔CSS contract and doc arithmetic, the content
pipeline's generated files, the CSS literal-value ban, vector freshness, the boundary
direction, the eval artefacts and baseline, the `node:test` behaviour suite, and an
import-time smoke test of both `api/` modules. Everything in it runs with no API key and no
network.

The order matters in one direction only: a component or token landing changes the counts and
the component contract, so `build.mjs` must run before `build-content.mjs` — otherwise the
advertised numbers and `content.designSystem` are a build behind.

## Deploy configuration, because nothing else writes it down

`vercel.json` carries two routing keys that no other document mentions and that no gate
covers:

| Key | Value | What depends on it |
| --- | --- | --- |
| `cleanUrls` | `true` | `/cv` and `/mcp` resolve to `cv.html` and `mcp.html`. Those are the canonical URLs: `cv.html`'s and `mcp.html`'s own `og:url`, the `websiteUrl` and the 405 message in `api/mcp.js`, and `README.md` all point at them. In-page navigation still uses `*.html` and is unaffected. |
| `trailingSlash` | `false` | **Every relative reference on every page.** |

`trailingSlash: false` is the single most load-bearing line of deploy config in the repo.
The pages link their CSS, their JS and the vendored fonts by *relative* path
(`design-system/dist/tokens.css`, `js/main.js`, …). Served at `/cv`, those resolve against
`/`; served at `/cv/`, they resolve against `/cv/` and 404. Flipping the key therefore ships
every page unstyled and unscripted, and **nothing in `npm run check` would notice** — the
gates compare generated files against their sources, and every one of those files is still
byte-perfect. The only detection is opening the deployed site.

If you change it, change every relative reference in `index.html`, `cv.html`, `mcp.html` and
`evals.html` to root-absolute in the same commit.

## Non-negotiables

These are cheap to violate and expensive to discover. Full detail in `CLAUDE.md` and
`design-system/README.md`.

1. **Copy is extracted, never rewritten.** Every word on this site was written by the repo
   owner; that is what makes a claim about him traceable. See `content/CLAUDE.md`.
2. Colours, fonts and spacing come from `tokens.json` only. **Never** a
   `prefers-color-scheme` query in `components.css` or a page stylesheet — a themed colour
   is a token with a `dark` value, and print is a token with a `print` value.
3. Every design-system component is three things: CSS block + `spec.md` + story. The build
   fails otherwise.
4. A rail never sizes its band; content lives in the well. `.rail { contain: size }` used to
   enforce that and has been deleted — the loop is unbuildable now, not merely prevented, so
   the rule is upheld by review rather than by a declaration. Separately, `--space-6` is the
   automata's lattice as well as a spacing step, and `scripts/check-css.mjs` bounds it because
   a rail's cell count goes as 1/cell². See `design-system/components/skeleton/spec.md`.
5. No colour literals in JS: read via `getComputedStyle`, re-read on `themechange`.
6. Zero runtime dependencies in the site half; the generators stay dependency-free. The
   `api/` slice is the only one with `node_modules` in its path, and `package.json` declares
   three: `@anthropic-ai/sdk` and `@modelcontextprotocol/sdk`, both genuinely imported, plus
   `zod` — which **no file in this repo imports**. It is there because the MCP SDK needs it
   (see `package-lock.json`) and it surfaces in `api/mcp.js` only as an error payload that
   file exists to sanitise. So "three dependencies" is two the repo chose and one it
   inherited; do not count it as a third when arguing about dependency discipline.
