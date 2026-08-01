# apps/next — the second surface

The same portfolio, rendered by Next.js + React + TypeScript from the same generated
artefacts as the vanilla site at the repo root. It exists to prove *one source, many
surfaces*: if two independently written front ends can be built from the design system's
published CSS and the content pipeline's published corpus, then the boundaries in
[`ARCHITECTURE.md`](../../ARCHITECTURE.md) are real rather than aspirational.

**Read [`.claude/agents/next-app.md`](../../.claude/agents/next-app.md) before changing
anything here.** It is the charter this app is built against, and the rules in it are
enforced by `scripts/check-boundaries.mjs` at the repo root.

## Run it

```sh
npm install          # standalone — its own lockfile, no root workspace
npm run dev          # syncs artefacts, then next dev
npm run build        # syncs artefacts, then a static export into out/
npm run typecheck    # tsc --noEmit
npx serve out        # what CI and the exit gate look at
```

`npm run sync` alone re-copies the artefacts; `node scripts/sync-artifacts.mjs --clean`
deletes the copies. `next.config.mjs` calls the sync at config load, so a bare
`npx next build` works from a clean checkout too.

**`npm install` is also how the design system gets here.** `.npmrc` sets
`install-links=true`, so `@yordan/design-system` is packed and installed as a real
directory rather than symlinked — read that file before removing the line, it is what
makes the generated React components resolve `class-variance-authority` at all. The cost
is that the installed copy does not follow a design-system rebuild until the next
`npm install`. CI and Vercel run `npm ci`, which re-packs every time, so only a local
tree can go stale.

## Two style pipelines, on purpose

Since phase R2b the design system reaches this app by **two** routes at once, and which
one a component uses is the design system's decision, not this app's. **R5 finished the
cutover**, so the split is no longer *which components* — it is *what is being said about
one*:

| | pipeline 2 | pipeline 1 |
| --- | --- | --- |
| what arrives | `@yordan/design-system/react/<id>` — a typed component, a cva class map | `components.css` and a class contract |
| what styles it | Tailwind utilities built from `tokens.tailwind.css` | the design system's own class names |
| what it covers | every **app-authored** element that has a React form — twenty components, root and every class part | the six blocks with **no React form and never will**, the **authored halves** of the four split blocks, and the two artefact renderers below |
| what this app writes | `<Chip variant="solid">` | `className="card card--reveal"` |

**Dropping `components.css` was never the end state, and `src/app/layout.tsx` still imports
it.** Six blocks cannot be definitions at all — the two `@component none` blocks, `skeleton`,
`terminator`, `project-row` — and four more are *split*: a generated core interleaved with
authored gaps that a class attribute cannot hold. A page rendering `<CardGrid>`/`<Card>` gets
its grid hairlines from that stylesheet, because `:nth-child(3n)` and the orphan-row pair are
not class attributes in any pipeline.

Both read the same custom properties out of `tokens.css`, so dark, print and the wide
viewport reach a utility and a hand-written rule through the same cascade. There is no
second set of values anywhere and there is no colour literal in either.

`src/app/globals.css` is the whole of pipeline 2 and its header is the file to read
before touching the cascade. Three things there are load-bearing: Tailwind is imported in
parts rather than as one line (Preflight would overwrite the Foundation block of
`components.css`); its utilities are deliberately **unlayered** (a layered utility loses
outright to that block's `a {}` and `button {}` rules, whatever the specificity says); and
since R5 they are imported **before** `components.css` rather than after, because an
authored gap is an *override* and an override at 0-1-0 loses to a generated base utility
emitted later. With the old order the card grid's two-column step at 960px, every
`prefers-reduced-motion` cancellation and every `@media print { display: none }` in a split
block stopped applying — measured, then fixed by one line.

### Which design-system class names survive, and why

The generated components emit utilities, not `.card` / `.menu__sheet` / `.fact__label`. A
class stays on a swapped element **exactly when something that is not the React tier
addresses it by that name**, and `scripts/check-class-hooks.mjs` computes that set from its
sources rather than trusting a list: the four synced page stylesheets, the authored
fragments of `components.css`, this app's ports of `js/` (a copy's selectors are not this
app's to re-point), the tier's own scoped rules — whose *sink* is named by class even when
its host is a utility — and two upstream defects the cutover measured, both written up in
that file's header. It asserts both directions: no class kept without a reason, and no
required class dropped from a page it used to reach. `npm run check:hooks`.

**Two surfaces are deliberately not swapped:** `src/components/evals-regions.tsx`, whose
markup must stay byte-identical to the regions `evals/run.mjs` writes into `evals.html`, and
`src/components/chat/blocks.tsx`, the port of `js/answer-render.js`. Neither authors markup —
each renders an artefact — so the class names in them belong to the generator upstream and
change there first. Both are styled by `components.css`, which is loaded.

## What crosses the boundary, and how

| Input | Route in | Where |
| --- | --- | --- |
| tokens.css, components.css | the `@yordan/design-system` package's `exports` | `src/app/layout.tsx` |
| tokens.tailwind.css, keyframes.css | the same `exports` map | `src/app/globals.css` |
| `react/<id>` × 19 | the same `exports` map — generated TSX, transpiled here | the use sites below |
| `surface-page`'s two values | `@yordan/design-system/tokens.flat.json` | `src/lib/theme-script.ts` |
| the corpus | a build-time import of `content/dist/content.json` | `src/lib/content.ts` |
| the corpus, again | copied to `public/corpus/` for the browser | `scripts/sync-artifacts.mjs` |
| `css/{style,cv,mcp,evals}.css` | copied to `src/styles/site/` | same |
| `css/fonts/*`, the plates, the avatar | copied to `public/` | same |
| the chat API | `fetch` over HTTP, `NEXT_PUBLIC_CHAT_ENDPOINT` | `src/lib/chat/useChat.ts` |
| the eval page's numbers | a build-time import of `evals/dist/page.json` | `src/app/evals/page.tsx` |

Everything under `public/fonts/`, `public/corpus/`, `public/assets/` and `src/styles/site/`
is a **copy** and is gitignored. If one of them is wrong, the fix is in the slice that owns
it, followed by a re-sync — never an edit here.

## Environment

| Variable | Default | What it does |
| --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | `profile.contact.site` from the corpus | canonical and `og:url` for every page |
| `NEXT_PUBLIC_CHAT_ENDPOINT` | `profile.contact.site` + `/api/chat` | where the chat client POSTs |

The chat endpoint defaults to the **vanilla deployment's** origin, not to `siteUrl`: the API
is a function over there and stays there whatever origin this app is served from. That makes
every request cross-origin, which is what `CHAT_ALLOWED_ORIGINS` on the API exists for.

**A same-origin development run needs the variable set.** `next dev` on localhost has no
`/api/chat` of its own, so point it at a deployment that allows your origin — or at a mock.

## Where the words come from

Everything inside a `<!-- content:… -->` region on the vanilla pages is read from the
corpus. Everything *around* those regions — the page titles, the bar, the section headings,
the contact block, the footer — is authored in `content/profile.md` and never reaches
`content/dist/content.json`, so it is reproduced verbatim in `src/lib/vanilla-copy.ts`,
which names its source file and commit and explains the upstream fix that would delete it.
`src/app/mcp/page.tsx` does the same for `mcp.html`, which is hand-authored end to end, and
`src/app/evals/page.tsx` for the skeleton `evals.html` carries around its generated regions.

No sentence in this app was written for this app.

## The ports

`src/lib/vanilla/` holds five copies of the vanilla site's client behaviour — `menu.ts`,
`fab.ts`, `peek.ts`, `drawer.ts` (the layer stack out of `js/main.js`) and `automata.ts`.
Each carries a provenance header naming its source file and the commit it was taken at, and
each lists what the port changed and nothing else: an IIFE became an exported `init…()`
returning a teardown, because a React effect owes the next unmount its listeners back.

**A bug found in a port is reported upstream, fixed there by its owner, and re-copied —
never fixed only here.** `automata.ts` documents the one line of `js/automata.js` it does
not reproduce and why.

`SiteChrome` mounts the first four in the root layout, in the vanilla's script order; every
one of them returns immediately when its markup is absent, which is how `/cv` gets the menu
without the fab. `AutomataLayer` owns the engine's lifetime and re-scans on a pathname
change. `window.automataStats()` is the engine's own cost report and the handle a browser
parity sweep can compare against the vanilla page.

## The assistant

`src/lib/chat/` and `src/components/chat/` are the port of `js/chat.js` and
`js/answer-render.js`: `sse.ts` (framing), `corpus.ts` (the published corpus, indexed in the
browser), `useChat.ts` (the conversation), `blocks.tsx` (answer blocks → design-system
markup) and `ChatClient.tsx` (composer, thread, trace). The four invariants are documented
where they are implemented — verbatim replay, the 45s deadline, the block-vs-corpus queue,
and "what is on screen decides the wording".

Two rules are worth repeating here because they are the whole point of the feature:
**`prose` is the only block carrying model-authored text**, and it is rendered as text; and
**an id that does not resolve renders nothing** — not a placeholder, not a broken link, and
not counted toward "did anything survive".

## The eval page

`/evals` renders from `evals/dist/page.json` — the structured serialization `evals/run.mjs`
writes beside `results.json` and beside the HTML regions of `evals.html`, from one run.
`src/lib/evals.ts` types it, `src/components/evals-regions.tsx` renders the five regions and
`src/app/evals/page.tsx` holds the pinned import and asserts the file's shape.

**Not one figure is typed here, and none is derived either** — a rate, a half-width, a
p-value or a sample size this app computed would be a second opinion about a measurement. n
comes from `summary.questions`, the interval method from `summary.confidence`, each `half`
from beside the value it belongs to. Every string under `regions` is HTML the run already
escaped, so it is rendered as markup and never escaped again; `region.html` is typed and
never read, because it is the *proof handle*, not the source. What proves the two renderers
agree is a byte diff of the export against `evals.html`'s regions: all five appear verbatim
once the generator's line breaks and indent are removed, and inside them the rendered side
needs no normalisation at all.

## Navigation

Internal routes go through `next/link` via `src/components/AppLink.tsx`; anchors, `mailto:`,
`tel:` and absolute URLs stay plain `<a>`. `<Link>` renders an `<a>`, so every DS class and
attribute is the string it was.

A client transition keeps the root layout and replaces `{children}` — which is where the
bar, the menu, the drawer and the cards live. **Both `SiteChrome` and `AutomataLayer`
therefore re-run on `usePathname()`**: the ports re-bind to the new elements and the engine
adopts the new rails. Removing either dependency ships a page whose menu opens once.

Prefetch is off for every link, and the reason is measured rather than stylistic — see the
header of `AppLink.tsx`.

## What is still absent

Every page and every behaviour the vanilla site has is here: `/`, `/cv`, `/work/<id>`,
`/mcp`, `/evals`, the chrome, and the assistant in the drawer. What remains is three things,
and none of them is a half-finished feature — plus one that is a defect and is written down
so that nobody fixes it in the wrong place.

**`Button`'s `variant="solid"` and `size="small"` used to have no effect and now do.** The
bug was in the artefact rather than here — cva puts a base and its variant in one `class`
attribute, which has no order — and the design system fixed it where it belonged, by making
each axis disjoint from the base. Recorded because the shape recurs: the two defects below
are the same sentence about a different pair of declarations.

**Three components carry a design-system class they should not need, and each one is an
upstream defect this app measured rather than worked around.** All three are detected and
counted by `scripts/check-class-hooks.mjs`, which prints them on every run so the day they
are fixed is visible rather than guessed at.

1. **Eighteen scoped rules in the React tier compile to the wrong selector.** Tailwind reads
   `_` in an arbitrary variant as a space — that is how `[&_.card__title]` gets its
   descendant combinator — and `emit-tailwind.mjs` does not escape the underscores *inside*
   a BEM class name, so it compiles to `.card title`, a descendant `<title>` element. Every
   scoped rule whose target is a BEM part is affected: `.card__media`, `.menu__sheet`,
   `.drawer__sheet`, `.ph__label`, `.chat__role`, `.ask-fab__label`, `.theme__lamp` and the
   rest. Found by measuring a swapped `.card--ruled` against the vanilla page — 15px short,
   exactly the ink bar's 12px padding plus 3px rule. `components.css` delivers all eighteen,
   so **both ends keep their class** until the escape lands.
2. **A shorthand and its own longhand in one base list.** `.chat__input` writes
   `font: inherit` then `font-size: var(--text-md)`, which is an ordinary stylesheet
   sentence; in one class attribute Tailwind's sort puts `[font:inherit]` last and the size
   resets to the inherited 16px. Measured: 16px against 14.72px, and a composer 4.09px
   taller. The emitter's disjointness pass covers a base against a *variant axis*, not a
   shorthand against its own longhand inside the base list.
3. **`@yordan/design-system/react/theme-toggle` does not parse at 2.6.0.** Three class
   strings carry an unescaped double quote inside a double-quoted string literal
   (`"[&[data-state="dark"]_.theme__lamp]:…"`), which is `tsc` TS1005 six times over. The
   same construct on a rule's own root comes out correctly single-quoted in `nav.tsx`, so it
   is one of the emitter's two paths. `ThemeToggle` therefore stays on pipeline 1, and every
   import in this app names `./react/<id>` rather than the barrel — which re-exports the
   broken file — so one bad artefact costs one component instead of the whole tier.

**Motion, deliberately.** No GSAP here. On the vanilla site `[data-rise]`/`[data-reveal]` are
hidden only under the `js` class that a *confirmed* GSAP load adds, so a load failure shows
the static page rather than a blank one. This app is that same degradation contract with the
load never attempted: it renders the page GSAP's absence is supposed to produce. The motion
hooks themselves — `data-rise`, `data-reveal`, `data-lines` — are markup and are kept, so a
port later has somewhere to land without a single element moving.

**The Tier 2 cross-origin verification, pending a deploy.** The chat client is built and the
API's CORS branch is tested locally by `test/chat-cors.test.js`, but no Vercel project serves
this app yet, so the checklist in [`docs/DEPLOY-RUNBOOK.md`](../../docs/DEPLOY-RUNBOOK.md)
§4 — preflight reflected byte for byte, no credentials, no budget spent before the CORS
branch — has never been run against a real second origin. Until it has, "the assistant works
cross-origin" is a local assertion, not an observation.

**The JSON-LD block.** `content/dist/site.jsonld` is emitted into the `content:meta` region
of `index.html` and `cv.html`, and this app emits none, so its structured data is thinner
than the vanilla site's. It is a published artefact and reading it would be legal, but it is
a crossing this app does not make today — one to pin at a phase boundary rather than add
quietly.
