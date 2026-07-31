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
| `NEXT_PUBLIC_CHAT_ENDPOINT` | — | where the chat client will POST; it lands with the chat run |

## Where the words come from

Everything inside a `<!-- content:… -->` region on the vanilla pages is read from the
corpus. Everything *around* those regions — the page titles, the bar, the section headings,
the contact block, the footer — is authored in `content/profile.md` and never reaches
`content/dist/content.json`, so it is reproduced verbatim in `src/lib/vanilla-copy.ts`,
which names its source file and commit and explains the upstream fix that would delete it.
`src/app/mcp/page.tsx` does the same for `mcp.html`, which is hand-authored end to end.

No sentence in this app was written for this app.

## Not here yet

The menu, the chat drawer, the peek sheet and the automata are markup with no behaviour —
every one of them is marked `MOUNT POINT` in the component that renders it. The ports of
`js/menu.js`, `js/fab.js`, `js/peek.js`, `js/automata.js` and `js/chat.js` land in later
runs, and a port carries a provenance header naming its source file and commit: a bug found
in a copy is fixed upstream and re-copied, never fixed here.
