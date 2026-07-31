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

## What crosses the boundary, and how

| Input | Route in | Where |
| --- | --- | --- |
| tokens.css, components.css | the `@yordan/design-system` package's `exports` | `src/app/layout.tsx` |
| `surface-page`'s two values | `@yordan/design-system/tokens.flat.json` | `src/lib/theme-script.ts` |
| the corpus | a build-time import of `content/dist/content.json` | `src/lib/content.ts` |
| the corpus, again | copied to `public/corpus/` for the browser | `scripts/sync-artifacts.mjs` |
| `css/{style,cv,mcp,evals}.css` | copied to `src/styles/site/` | same |
| `css/fonts/*`, the plates, the avatar | copied to `public/` | same |
| the chat API | `fetch` over HTTP, `NEXT_PUBLIC_CHAT_ENDPOINT` | not built yet |

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
`src/app/mcp/page.tsx` does the same for `mcp.html`, which is hand-authored end to end.

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

## Not here yet

The chat client (the drawer's body is an empty mount point) and the eval page. Motion is
deliberately out: no GSAP here, and `[data-rise]`/`[data-reveal]` are hidden only under the
`js` class that only a confirmed GSAP load adds — so this app renders the static page that
contract promises.
