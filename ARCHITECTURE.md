# Architecture

One page. Read this to find out **which slice you need** — then read that slice's
`CLAUDE.md` (or `README.md`) and nothing else.

> **Status, 2026-08-01 — accurate about the boundaries, behind on the design system.**
> Everything below about slices, the artefact-not-import rule, the gates and the two
> deployments is current and was re-verified on this date. What it does **not** yet describe
> is the design system's architecture revision, which is mid-flight: components are becoming
> **contract-first** — appearance held as data in `design-system/components/<id>/definition.json`
> and rendered by emitters into **two** pipelines, a generated region of `components.css` and
> a Tailwind `@theme` + generated React tier that `apps/next` consumes. At the last commit 13
> of 26 blocks generate and the authored remainder is governed by a census that makes each one
> state its reason.
>
> The full rewrite of this page is a scheduled pass (R7) and is deliberately not done
> piecemeal. Until it lands, **`design-system/README.md` and `design-system/PATTERNS.md` are
> the current truth** for anything about definitions, the emitters, the two pipelines or the
> census. Numbers about that slice move weekly; the artefacts that produce them are named
> wherever one appears here.

## The dependency graph

Acyclic and one-directional. Nothing points back up.

```
design-system/          owns tokens + components
   │  emits  dist/tokens.css · dist/tokens.flat.json
   │         · dist/tokens.dtcg.json · dist/tokens.d.ts  (the package surface)
   │         · dist/components.json          (the derived component contract)
   │         · content/system.generated.json (the token/component counts)
   ▼
content/                owns every word on the site
   │  consumes both of the above and folds components.json in verbatim
   │  emits  content/dist/content.json · generated page regions · work/<id>.html
   │         · content/dist/site.jsonld · llms.txt
   ▼
lib/knowledge/          owns retrieval — tools, BM25 + embeddings, answer schema, validators
   │  emits  the tool API + JSON Schemas
   ├────────────────┬─────────────────┐
   ▼                ▼                 ▼
api/chat.js      api/mcp.js        evals/
  (Phase 3)        (Phase 2)          │  emits  results.json · evals.html regions
                                      │         · evals/dist/page.json

TWO consumers sit at the bottom, and neither imports anything above it:

(site root)  index.html · cv.html · mcp.html · evals.html · work/<id>.html · css/ · js/
   consumes design-system/dist + content-generated regions + api/ OVER HTTP

apps/next/   the second site — Next.js + React + TypeScript, static export
   consumes @yordan/design-system (the package) + content/dist/content.json
          + evals/dist/page.json + /api/chat OVER HTTP
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

## The second site — `apps/next/`

A full Next.js + React + TypeScript application that renders **the same portfolio from the
same artefacts**: nine pages statically exported (`/`, `/cv`, `/mcp`, `/evals`, and
`/work/<id>` for each of the five case studies), plus the not-found route, which `next
build` writes twice — `_not-found.html` and `404.html` — for eleven files in `out/`.

It exists to make the load-bearing rule falsifiable. If a second, independently written
front end can be built from the design system's published package and the content
pipeline's published corpus, the boundaries below are real; the moment it reaches for
another slice's *source* it has stopped proving anything. So it consumes exactly four
inputs, each by its published surface:

| Input | Route in |
| --- | --- |
| the design system | the `@yordan/design-system` package (`file:../../design-system`), and **only the subpaths its `exports` map names** — that map is the authority and it grows with the migration, so read it rather than a count typed here. It now covers both pipelines: the stylesheets and token artefacts, plus `tokens.tailwind.css` and a `./react/<id>` entry per generated component |
| the corpus | a build-time `import` of `content/dist/content.json` |
| the eval numbers | a build-time `import` of `evals/dist/page.json` |
| the assistant | `fetch` to `/api/chat` over HTTP, endpoint in `NEXT_PUBLIC_CHAT_ENDPOINT` |

Still four inputs, and the first one has grown a second dialect rather than a second route:
`apps/next` now consumes the generated React components and their Tailwind utilities through
the same package, which is why `class-variance-authority` and `tailwindcss` are dependencies
*of the app* and not of the design system. The boundary is unchanged; what crosses it is
richer.

`css/{style,cv,mcp,evals}.css`, `css/fonts/` and `content/assets/` arrive by **copy at build
time** through `apps/next/scripts/sync-artifacts.mjs`; every copy is gitignored, and a wrong
one is fixed upstream and re-synced rather than edited there. The vanilla client behaviour it
needs is **ported, not imported** — `src/lib/vanilla/` holds copies of `js/menu.js`,
`js/fab.js`, `js/peek.js`, the layer stack out of `js/main.js`, and `js/automata.js`, each
carrying a provenance header naming its source file and the commit it was taken at. A copy
you can re-take from upstream is a boundary you can audit; an import would make a second
consumer of files written for one.

It is standalone: its own `package.json`, its own lockfile, no root workspace, and the root
`npm ci` installs not one byte of Next, React or TypeScript. Its charter is
`.claude/agents/next-app.md`; its own README is `apps/next/README.md`; its gate is
`.github/workflows/next.yml` (`tsc --noEmit`, then `next build`).

`scripts/check-boundaries.mjs` carries it as the eighth slice rule — banned as code:
`lib/`, `api/`, `js/`, `scripts/`, all of `evals/` except `evals/dist/`, and every content
source. Those patterns anchor at `^` where the older rules do not, and the anchor is
load-bearing: `apps/next` has a `scripts/`, a `lib/` and ports of `js/` of its own, so every
reference is resolved against its own file's directory before a rule sees it, and `^scripts/`
therefore means the repo's generators while `./scripts/sync-artifacts.mjs` means the app's.
Ten of the gate's twenty pinned crossings are this app's, and `test/boundaries.test.js`
census-tests `sync-artifacts.mjs` in the other direction, so a sixth stylesheet cannot arrive
unpinned.

## The load-bearing rule

**Every crossing *between slices* is a generated artefact with a schema, never a code
import.**

`lib/knowledge/` does not import from `content/` — it reads `content/dist/content.json`,
whose shape is documented and version-stamped. So working on retrieval needs the *schema of
that file* in context, not the 14 project files that produced it. Same for both consumers:
they read `dist/tokens.css` and generated HTML or JSON, never the design system's or the
content pipeline's internals.

The design system now states its half of that in the vocabulary a package manager
understands. `design-system/package.json` is `@yordan/design-system` at a real `version`,
`private` (it is consumed by `file:`, never from a registry), with `files: [dist, css,
assets]` and an **`exports` map that is the authority on what is published**. Do not look for
a count here: the map grew from six subpaths to twenty as the second pipeline landed and it
moves with every batch of the migration — `design-system/package.json` is the file to read,
and `contract-diff.mjs` treats the subpath list as one of the four surfaces it versions. A
subpath not on that map is unreachable rather than merely undocumented,
which is the same statement `check-boundaries.mjs` makes about
`design-system/{tokens,components,stories,scripts,figma}/`. `assets/` is in `files` and
deliberately not in `exports`, because `avatar.svg` is fetched by URL and never resolved as
a module. `RELEASED.json` snapshots that contract at the version it shipped as, and
`design-system/scripts/contract-diff.mjs --check` — a step in `npm run check` and in
`ci.yml` — classifies every difference against it: an added name is MINOR, a changed value
is PATCH, a removed or renamed one is MAJOR, and the gate fails when the version delta does
not cover the class. `--release` performs the bump, re-snapshots `RELEASED.json` and appends
the `CHANGELOG.md` entry in one step.

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
reading the published corpus, `evals/generation.mjs` reading the design system's `dist/`,
and the second site's ten — and asserts each is **still legal**. Twenty are pinned today;
`CROSSING_SURFACES` additionally requires each to land on a published surface, which is what
catches a pin whose `../` count is wrong and therefore asserts nothing. Tighten a rule too
far and the gate names the line of *itself* that is wrong, instead of turning red against a
repo that is behaving correctly.

A pin table only covers what somebody remembered to pin, so the census runs the other way
too: `test/boundaries.test.js` reads `apps/next/scripts/sync-artifacts.mjs`, resolves every
literal source the way the gate would, and requires each one that leaves `apps/next` to
appear in `CROSSINGS`.

## For task X, open slice Y

| If you are… | Open | Gate |
| --- | --- | --- |
| changing a colour, a font, a spacing step | `design-system/tokens/tokens.json` | `node design-system/scripts/build.mjs --check` |
| changing how a component looks or is marked up | `design-system/` (CSS + `spec.md` + story) | same |
| changing a **sentence** anywhere on the site or CV | `content/` — see `content/CLAUDE.md` | `node scripts/build-content.mjs --check` |
| adding a project, a role, a skill row, a fact | `content/` | same |
| changing page **layout or structure** (not words) | `index.html` / `cv.html` outside the `<!-- content:… -->` regions, `css/style.css`, `css/cv.css` | serve + open |
| changing a **case-study page's** layout | `scripts/build-content.mjs` — `work/<id>.html` is generated whole, not in regions | `node scripts/build-content.mjs --check` |
| changing the `/mcp` install page or the `/evals` skeleton | `mcp.html` (hand-authored end to end) / `evals.html` outside its `<!-- content:evals-… -->` regions | serve + open |
| changing motion, the peek panel, the automata | `js/` | serve + open |
| changing retrieval, the tools, ranking, the gate, the validators | `lib/knowledge/` — see its `CLAUDE.md` | `npm test` (`test/gate·tools·schema`) then `node evals/run.mjs` |
| changing the question set, an arm, the published numbers | `evals/` — see its `CLAUDE.md` | `node evals/run.mjs --check` |
| measuring the assistant's *answers* rather than its retrieval | `evals/groundedness.mjs` | none — billed, manual, refuses to run under `$CI` |
| measuring whether a model can build **on** the design system | `evals/generation.mjs` | `--self-test` proves the gates; the artefact is gated by nothing (see below) |
| changing the chat or MCP endpoints | `api/` | `npm test` (`test/chat-retry`, `test/chat-cors`, `test/budget`) + the manual HTTP drive in `api/CLAUDE.md` |
| changing anything on the **second site** | `apps/next/` — see its `README.md` and `.claude/agents/next-app.md` | `cd apps/next && npx tsc --noEmit && npx next build`, then `npm run check` at the root |

**One honest caveat:** the site root is where everything meets, so it cannot be fully
isolated — changing a component's markup means touching the design system *and* the pages
that use it. That is normal for a composition root, not a design failure. There are two
composition roots now, and the cost is real rather than theoretical: a markup change lands in
`index.html` and again in `apps/next/src/components/`, and nothing compares the two
automatically. What holds them together is the design system's class contract plus the
`next` workflow's build, not a gate that diffs the surfaces.

## Generated files — never hand-edit

Each carries a "generated — do not edit" banner.

| File | Generated by | From | Hand-edit caught by |
| --- | --- | --- | --- |
| `design-system/dist/tokens.css` | `design-system/scripts/build.mjs` | `design-system/tokens/tokens.json` | the **drift gate** — see below |
| `design-system/dist/tokens.flat.json` | same | same | same |
| `design-system/dist/components.json` | same | `css/components.css` + each `spec.md`'s frontmatter | same |
| `content/system.generated.json` | same | the token + component counts | same, plus the counts gate below |
| `design-system/dist/tokens.dtcg.json` | same | `tokens.json`, aliases **kept** as `{group.token}` references | `build.mjs --check` byte-compares it, *and* the drift gate |
| `design-system/dist/tokens.d.ts` | same | the token names, as a TS union | same |
| the **generated regions** of `design-system/css/components.css` | `scripts/emit-css.mjs`, via `build.mjs` | `components/<id>/definition.json`, and `tokens/typography.json` for the type layer | `build.mjs --check` byte-compares each region, *and* the drift gate |
| `design-system/dist/tokens.tailwind.css` and `dist/react/<id>.tsx` | `scripts/emit-tailwind.mjs`, `scripts/emit-react.mjs`, via `build.mjs` | the same definitions — pipeline 2 | `build.mjs --check` byte-compares them against its `packaged` list |
| `design-system/RELEASED.json` | `design-system/scripts/contract-diff.mjs --release` | the current `dist/` | `contract-diff.mjs --check` (semver class vs `package.json`'s version) |
| `design-system/CHANGELOG.md` | same | the classified diff against the previous snapshot | nothing — it is an append-only record, not a comparison |
| the `<!-- content:… -->` regions of `index.html`, `cv.html` | `scripts/build-content.mjs` | `content/**` | `build-content.mjs --check`, and the drift gate |
| `work/<id>.html` — **whole files**, five of them | same | `content/projects/*.md` | same |
| `content/dist/content.json` | same | `content/**` + `design-system/dist/components.json` | same |
| `content/dist/site.jsonld` | same | `content/**` | same |
| `llms.txt` | same | `content/**` | same |
| `content/dist/vectors.json` | `scripts/build-vectors.mjs` | the shipped chunk text | `build-vectors.mjs --check` (a digest, not a byte compare) |
| `evals/results.json` | `evals/run.mjs` | `evals/questions.json` + `lib/knowledge/` | `run.mjs --check` |
| the `<!-- content:evals-… -->` regions of `evals.html` | same | same | same |
| `evals/dist/page.json` | same | the same run's region **models** | same |
| `evals/vectors.json` | same | chunk + question text | same, by digest |
| `evals/groundedness.json` | `evals/groundedness.mjs` | a billed manual run against the deployed `/api/chat` | **nothing** — read it as dated |
| `evals/generation.json` | `evals/generation.mjs` | a billed manual run against a model | **nothing, deliberately** — see below |

`js/case-studies.js` **used to be on this list and is gone.** It rendered the case studies
into a modal from `window.CASE_STUDIES`; the five have real pages now, so it was a second
renderer for content already rendered as HTML — the exact drift this pipeline exists to
prevent. The counts gate followed the prose rather than the filename: it asserts against
`work/portfolio-system.html` where that paragraph now lives.

**The design system's first four outputs used to be the honest gap. They are not any more,
and the paragraph that said so was false for four commits.** `build.mjs --check` still
*regenerates* those four in place rather than comparing them, and then asserts something
else: that every component still has a spec and a story, that each spec agrees with the CSS
beside it, that the counts advertised in `README.md`, `design-system/README.md`, `cv.html`
and `work/portfolio-system.html` are the current ones, and that every figure in
`tokens.json`'s own prose recomputes from the values beside it. (The **four older** `dist/`
files are the ones regenerated in place. Everything added since — `tokens.dtcg.json`,
`tokens.d.ts`, `tokens.tailwind.css` and the generated React components — is **byte-compared**
instead, and so is every generated region of `components.css`. `build.mjs` keeps the
authoritative list in its `packaged` array and refuses to render a component whose file is
missing from it: those bytes are what another repo installs, and a hand-edit that survives in
the workspace is a hand-edit that ships.)

What closed the gap is the **drift step**, which is a line of `npm run check` and a step of
`ci.yml`:

```sh
npm run build
git diff --exit-code -- design-system/dist content/system.generated.json index.html \
  cv.html work content/dist/content.json content/dist/site.jsonld llms.txt
```

It runs both generators for real and asks git whether the tree still holds what they
produced, over eight pathspecs. It runs **after** the two `--check` gates and never before:
it overwrites the working tree, so first place would leave every byte-comparison above it
comparing files it had just written. `test/drift.test.js` is what keeps it honest — it
recomputes the pathspec list from every `writeFileSync` target in every script `npm run
build` runs, has git resolve the pathspecs in this repo and demands the matched set be
exactly that set, and mutation-tests the command against a scratch repository (hand-edit
`dist/tokens.css` and it must go red naming it; hand-edit `content/dist/vectors.json`, which
needs a Voyage key to rebuild, and it must stay green).

**One case it cannot catch, stated so nobody assumes otherwise:** an *unstaged* hand-edit is
overwritten by the build before git ever sees it. That is not the shipping risk — a hand-edit
only reaches another reader by being committed, and by then it is in the index, which is what
the diff compares against.

`check-boundaries.mjs` separately asserts six artefacts **exist** at all, because a graph
whose artefacts are missing is a diagram: `design-system/dist/{tokens.css,tokens.flat.json,
components.json}`, `content/system.generated.json`, `content/dist/content.json` and
`evals/dist/page.json`.

**The two bottom rows are covered by nothing, and that is a choice.**
`evals/groundedness.json` and `evals/generation.json` are the artefacts of billed manual
runs. A staleness gate over either could only ever be silenced by spending money, so instead
each is stamped with what it was measured against — `generation.json` carries the briefs hash
and both design-system contract digests — so a contract change **dates** it rather than
silently moving it. `evals/generation.mjs`'s own header says so in as many words, and
`test/boundaries.test.js` asserts the absence in both directions so it cannot be mistaken for
an oversight.

## Run order

`build.mjs` **emits** `content/system.generated.json`; `build-content.mjs` **consumes** it
and interpolates the numbers into the prose that advertises them. So the system's own
statistics have exactly one source and drift is structurally impossible rather than policed.

```sh
node design-system/scripts/build.mjs        # tokens + dist/ + components.json + system.generated.json
node scripts/build-content.mjs              # content → pages, case studies, index, llms.txt
node scripts/build-vectors.mjs              # chunk embeddings → content/dist/vectors.json (needs a key)
node evals/run.mjs                          # retrieval eval → results.json, evals.html, evals/dist/page.json
```

The second site is built separately, by its own project, and comes **after** all four —
`apps/next/scripts/sync-artifacts.mjs` copies what they produced:

```sh
cd apps/next && npm ci && npx next build    # → apps/next/out/
```

**The gate is `npm run check`.** Do not maintain a second list of it here: the `check`
script in `package.json` is the list, and `.github/workflows/ci.yml` runs the same steps in
the same order — `test/ci.test.js` fails if the two ever disagree. What it covers, in order,
one line per command:

1. `build.mjs --check` — component coverage, the advertised counts, the spec↔CSS contract,
   the doc-arithmetic gate, and a byte compare of `tokens.dtcg.json` + `tokens.d.ts`.
2. `contract-diff.mjs --check` — the published package surface against `RELEASED.json` at
   the version `design-system/package.json` claims.
3. `build-content.mjs --check` — the ten generated content files, plus the assertion that no
   HTML comment on any of the four shipped pages contains a nested `<!--`.
4. **the drift step** — `npm run build`, then `git diff --exit-code` over eight pathspecs.
5. `check-css.mjs` — no literal size, colour or `prefers-color-scheme`, and the `--space-6`
   floor and off-stage ceiling the automata's lattice depends on.
6. `build-vectors.mjs --check` — the embeddings still match the corpus, by digest.
7. `check-boundaries.mjs` — the dependency direction, the pinned crossings, the artefacts.
8. `evals/run.mjs --check` — four eval artefacts and the committed baseline.
9. `npm test` → `node test/run.mjs` — the `node:test` behaviour suite, the only step that
   executes `lib/` and `api/` rather than comparing an artefact.
10–11. an import-time smoke test of each `api/` module.

Everything in it runs with **no API key and no network**, and that is a contract rather than
a happy accident — it is why two gates that need a browser or a framework live in their own
workflows instead.

`npm test` is `node test/run.mjs`, and the indirection has a reason worth knowing before you
simplify it. Bare `node --test` uses Node's own discovery patterns, one of which is
`**/test-*.?(c|m)js` — **not** rooted at `test/` — so the design system's Storybook harness
joined the suite the day it was written, and `npm run check` was quietly building Storybook
and reaching for Chromium. `test/run.mjs` hands the runner an explicit file list read off the
directory (the one form Node 20 through 24 all accept), refuses to report success if it finds
no files, and `test/ci.test.js` recomputes the list from the directory again from the
outside. The harness has since been renamed out of the pattern too, so the hazard is retired
at its source as well as fenced off.

The order matters in one direction only: a component or token landing changes the counts and
the component contract, so `build.mjs` must run before `build-content.mjs` — otherwise the
advertised numbers and `content.designSystem` are a build behind.

### Two more workflows, deliberately beside `ci.yml` rather than in it

| Workflow | Trigger | What it runs |
| --- | --- | --- |
| `.github/workflows/design-system.yml` | pushes and PRs touching `design-system/**` or itself | `npm run test:a11y` (axe over every story — a violation fails the job) then `npm run test:visual` (screenshot regression, **report-only until 2026-09-01**, and the date is written in two places in the design system) |
| `.github/workflows/next.yml` | pushes and PRs touching `apps/next/**` or itself | `npx tsc --noEmit` then `npx next build`, in `apps/next`, on its own lockfile |

Both are path-filtered, both install their own dependencies, and **neither joins `npm run
check`**. That is the offline contract above, stated as a decision: the first needs Chromium
and a Storybook build, the second needs a framework, and bolting either onto the root gate
would make it something nobody runs before pushing. `test/ci.test.js` knows all three files
exist and holds `ci.yml ≡ check`, so merging them is not a tidy-up that passes quietly.

One expected result, so it does not read as a broken gate: the visual job's committed
baselines are `__screenshots__/win32/`, captured on the machine that took them, so on
`ubuntu-latest` every story reports "no baseline yet" and the job exits 0. The linux captures
ride out in the `visual-diff` artifact, and the first linux baseline set gets committed from
it.

## Deploy configuration, because nothing else writes it down

**The repo produces two independent sites from one tree, plus an optional third artefact.**
They are separate Vercel projects rather than two paths into one — one Root Directory each,
one build each, one domain each:

| Project | Root Directory | Build | Serves | Exists? |
| --- | --- | --- | --- | --- |
| the vanilla site | the repo root | none — `buildCommand: ""`, `outputDirectory: "."` | `index.html`, `/cv`, `/mcp`, `/evals`, `/work/<id>`, **and the two functions in `api/`** | **yes, live** |
| the second site | `apps/next` | `next build` → static export | the same nine pages, rendered by React | **not yet** |
| Storybook | `design-system` | `npm run build-storybook` → `storybook-static` | the component stories | **not yet**, and optional |

Only the last column is state rather than architecture, and it is deliberately here: two of
the three are configuration that has been *designed* and not yet *created*, and a diagram
that does not say so reads as a description of production.

Only the first has functions. `/api/chat` and `/api/mcp` live there and stay there whatever
origin the second site is served from, which is why every request the second site's assistant
makes is cross-origin and why `api/chat.js` has an origin allowlist at all
(`CHAT_ALLOWED_ORIGINS` — see `api/CLAUDE.md`).

`.vercelignore` carries `/apps/` for the first project, and the entry is a security boundary
rather than a size one: `outputDirectory` is `.` and `buildCommand` is empty, so **whatever
is uploaded is served**, and without that line the vanilla domain would publish the second
site's TypeScript source at `/apps/next/…`. Read the comment above it before touching it —
it also carries the one honest risk in the second project's configuration, and the owner's
steps for both are in **[`docs/DEPLOY-RUNBOOK.md`](docs/DEPLOY-RUNBOOK.md)**.

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
`evals.html` to root-absolute in the same commit. The five `work/<id>.html` pages are already
root-absolute and have a gate of their own: they are served one directory down, where a
relative reference resolves against `/work/` and 404s, so `build-content.mjs` refuses to
write one. `apps/next` mirrors the key in `next.config.mjs`, where it decides whether the
export writes `out/cv.html` or `out/cv/index.html`.

## Non-negotiables

These are cheap to violate and expensive to discover. Full detail in `CLAUDE.md` and
`design-system/README.md`.

1. **Copy is extracted, never rewritten.** Every word on this site was written by the repo
   owner; that is what makes a claim about him traceable. See `content/CLAUDE.md`.
2. Colours, fonts and spacing come from `tokens.json` only. **Never** a
   `prefers-color-scheme` query in `components.css` or a page stylesheet — a themed colour
   is a token with a `dark` value, and print is a token with a `print` value.
3. Every design-system component carries a `spec.md` and a story, always, and the build fails
   otherwise. The third leg is the one the revision is changing: a component either has a
   `definition.json` **its CSS block is generated from** — 13 of 26 blocks at the last commit,
   and a scaffolded component is now born that way — or an authored block that must declare a
   reason from a closed vocabulary, which the build checks is actually present in it. Current
   detail in `design-system/README.md` and `design-system/PATTERNS.md`.
4. A rail never sizes its band; content lives in the well. `.rail { contain: size }` used to
   enforce that and has been deleted — the loop is unbuildable now, not merely prevented, so
   the rule is upheld by review rather than by a declaration. Separately, `--space-6` is the
   automata's lattice as well as a spacing step, and `scripts/check-css.mjs` bounds it because
   a rail's cell count goes as 1/cell². See `design-system/components/skeleton/spec.md`.
5. No colour literals in JS: read via `getComputedStyle`, re-read on `themechange`.
6. Zero runtime dependencies in the site half; the generators stay dependency-free. In the
   **root** `package.json` — which is the one that claim is about — `api/` is the only slice
   with `node_modules` in its path, and three dependencies are declared:
   `@anthropic-ai/sdk` and `@modelcontextprotocol/sdk`, both genuinely imported, plus `zod`
   — which **no file in this repo imports**. It is there because the MCP SDK needs it (see
   `package-lock.json`) and it surfaces in `api/mcp.js` only as an error payload that file
   exists to sanitise. So "three dependencies" is two the repo chose and one it inherited; do
   not count it as a third when arguing about dependency discipline.

   Two directories have dependency trees of their own and are **not** covered by that
   sentence: `design-system/` (Storybook, Vite, Playwright — all `devDependencies`, none of
   them shipped) and `apps/next/` (Next, React, TypeScript). Both are standalone, with their
   own lockfiles and no root workspace, so `npm ci` at the root installs neither. The claim
   the site half makes is about **what it ships**, and what the vanilla site ships is still
   zero runtime dependencies and no build step.
