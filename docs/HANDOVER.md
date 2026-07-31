# Handover — state of play

Written at the end of a long session. Everything here was measured, not remembered.

**Branch:** `main` · **HEAD:** the docs commit sitting on `c84ddf9`.

**Merged is not deployed, and this is the first thing to know.** `main` is **24 commits ahead
of `origin/main`** — the whole contract-gaps + second-site programme is committed locally and
**nothing of it is pushed or deployed**. `yordan-portfolio.vercel.app` is serving `9da8576`,
the previous session's HEAD, and it is healthy (`/`, `/cv`, `/evals`, `/work/<id>` all 200).
Everything the earlier sections of this file call "deployed" still is; everything in the
programme section below is not.

---

## Starter prompt for a new session

> I'm continuing work on my portfolio repo. Read `docs/HANDOVER.md` first — it has the full
> state, what is deliberately deferred, and the standing rules. `docs/PROGRAMME-LOG.md` has the
> traps; read it before you trust any measurement tool, especially the browser pane. Then read
> `ARCHITECTURE.md` for the slice map. Anything about deploying — env vars, a second Vercel
> project, headers — is in `docs/DEPLOY-RUNBOOK.md` and nowhere else.
>
> Everything is committed on `main` and `npm run check` is green — start there, and if it is
> not green, that is the first thing to tell me. **`main` is well ahead of `origin/main`, so
> "merged" does not mean "deployed" right now**; the handover's OPEN ITEMS say which is which.
>
> I have more defects to fix. I will describe them; audit each one against the actual code
> before you change anything, because several of my reports this session turned out to have a
> different cause than the symptom suggested.
>
> Standing rules: copy is mine — corrections are fine, editorial changes are drafted and
> stopped for review. Do not touch anything eval-related, the assistant's retrieval defects
> (items 24 and 26), or the groundedness re-run until I say so. Verify in the browser before
> claiming something works, and tell me plainly what you could not verify.

---

## Current numbers

```
HEAD            docs commit on c84ddf9, main — NOT pushed, NOT deployed
deployed        9da8576 — origin/main, 24 commits behind local main
tests           146 / 146
gates           all green — `npm run check` exits 0 end to end
corpus          9530564fdc07971c · 70 chunks · 967 terms      (unmoved)
design system   83 tokens · 147 values · 23 components         (unmoved)
                (83 base + 23 dark + 36 print + 5 wide)
package         @yordan/design-system 1.0.0 · 6 exported subpaths · RELEASED.json at 1.0.0
questions       65 — 49 retrieval, 16 abstention
boundaries      8 slice rules · 74 files · 20 crossings pinned
pages           vanilla: index · cv · mcp · evals · work/<id> × 5
                apps/next: the same nine, statically exported (11 files, with 404)
workflows       ci.yml · design-system.yml · next.yml
```

Every figure above was read off a gate's own output this session, not remembered. The
component count says 23 rather than the 21 this block used to carry because two components
landed after it was last written, not because anything moved this session — `6b6cc48`'s
message states the counts were unchanged, and `content/system.generated.json` agrees.

**Nothing is billed by the current state.** `corpusHash` has not moved since the corpus
freeze: the stopword change altered the index and not the chunk text, and the project pages
altered `cite` metadata and not the chunk text. Both vector caches are valid, and the whole
of Phases 1–8 was free — no chunk text was touched.

---

## What is done

| Wave | Outcome |
|---|---|
| 0 | Production defect, WCAG Level A keyboard trap, MCP amplification, prototype-chain dispatch. **Merged to main and deployed.** |
| 1 | 96-test `node:test` suite · design-system contract gate · vendored fonts · client a11y |
| 2 | Entity gate hardened *and* relocated above `search_content` · schema and provenance fixes |
| 3 | Corpus freeze · **stats decoupled from chunk text** · owner copy · five case studies |
| 4 | Wilson intervals · exact McNemar · tolerance-aware baseline · groundedness harness |
| 5 | `get_design_system` / `get_component` MCP tools |
| 6a | Structural doc claims (numbers pass still outstanding) |
| 8 | `npm run dev`, scaffolds, one-command build chain, CI≡check enforced by test |
| 9 | Automata as canvas · one lattice · terminator · rails snap to whole columns |
| 10 | **Both gates: `check-css` rule 6 replaced (31) and the doc-arithmetic gate landed (32).** Four agent charters corrected · three false claims in `automata.js` · the dead region `background-size` bridge removed · the `contain: size` instruction purged from every document that still gave it |

**The single highest-leverage change** was decoupling the design system's published counts from
chunk text. Adding a component used to change `corpusHash`, invalidate both vector caches and
force a billed rebuild plus a re-baseline. It now costs one local `build.mjs` run. Component #21
was the first free one.

---

## The contract-gaps + second-site programme (Phases 1–8)

One session, eight phases, 24 commits, **none of them pushed**. Two threads ran through it:
close the gaps between what this repo's documents claimed and what its gates enforced, and
build a second front end that could only work if those boundaries were real.

Phases are mapped to agents by **slice ownership**, which is what the commits show — every
commit stayed inside one slice, and where a finding straddled two it was split and handed
over rather than reached across.

| Phase | Agent (by slice) | What landed | Commits |
|---|---|---|---|
| 1 | `design-system`, then `test-engineer` | `dist/tokens.dtcg.json` + `dist/tokens.d.ts` (**the first two files here `--check` byte-compares**); `@yordan/design-system` 1.0.0 with `files` and an `exports` map of six subpaths; `RELEASED.json` + `contract-diff.mjs` as a semver gate; **the DRIFT gate** | `6b6cc48` `98a8a51` `d67a2bf` |
| 2 | `design-system` + `test-engineer` | axe over every story and a screenshot of each (report-only until 2026-09-01), in their own path-filtered workflow; `npm test` stops wandering | `9458b2d` `a35ce2e` `e36dc95` `90bb7df` `0d733f1` |
| 3 | `test-engineer`, then `next-app` | the charter and the boundary rule **before** the first file, then `apps/next/` — nine routes, the chrome ported, links become routes | `780ab08` `2e84323` `6f4f418` `51eba19` `1ba2200` `fe12a71` `02e4606` |
| 4 | `api-security`, then `next-app` | `CHAT_ALLOWED_ORIGINS` on `/api/chat`; the React chat client | `7ad4a17` `e80cce3` `0a0b36f` |
| 5 | **the owner** | **OPEN — see below.** No commits |
| 6 | `evals`, then `next-app`, then `test-engineer` | `evals/dist/page.json` as a third gated output; `/evals` on the second surface, byte-diffed against the first; the pin table catches up | `41412f9` `5524c80` `cace793` |
| 7 | `evals` | `evals/generation.mjs` — can a model build **on** this design system | `ffb0c33` |
| 8 | `test-engineer`, then `api-security` | `next.yml`; `.vercelignore` gains `/apps/` | `5903207` `c84ddf9` |

### What Phase 1 actually closed, since `ARCHITECTURE.md` had been advertising the hole

That document carried a paragraph headed *"The design system's four outputs are the honest
gap"*: `build.mjs` writes `tokens.css`, `tokens.flat.json`, `components.json` and
`system.generated.json` unconditionally, `--check` regenerated them in place, and nothing
compared their contents against what was committed. A hand-edit was silently overwritten
rather than caught. The drift step — `npm run build` then `git diff --exit-code` over eight
pathspecs — closes it, and `test/drift.test.js` proves the closure by mutation rather than by
assertion. That paragraph was **false from `d67a2bf` until this docs commit**, which is four
commits of the repo's most-read document describing a gap that no longer existed.

### The three barrier catches worth remembering

These are the ones where a phase boundary caught something the phase itself had not.

1. **`npm test` had been running a browser for weeks.** Node's default test discovery
   includes `**/test-*.?(c|m)js`, which is **not rooted at `test/`**, so
   `design-system/scripts/test-storybook.mjs` joined the suite the day Phase 2 wrote it — and
   `npm run check`, whose entire promise is offline, browser-free and seconds long, was
   building Storybook and reaching for Chromium. Nothing announced it; the gate just got
   slow. Fixed twice on purpose: `test/run.mjs` hands the runner an explicit file list (the
   only form Node 20 *and* 24 both accept), and the harness was then renamed out of the
   pattern entirely so a bare `node --test` is safe too. `check` went 46s → 6.4s; the suite
   39.4s → 3.0s.
2. **The `<Link>` swap moved the ground the ports were standing on.** Making internal
   navigation client-side was supposed to be a markup-neutral change — a `<Link>` renders an
   `<a>`, so every design-system class survives byte for byte. But a client transition keeps
   the root layout and replaces `{children}`, which is where the bar, the menu, the drawer,
   the fab and the cards live: every element the ported listeners were bound to is detached
   afterwards. Without re-initialising `SiteChrome` on `usePathname()`, the commit would have
   shipped a page whose menu opens exactly once. Caught by driving the export in Chromium, not
   by reading it.
3. **The second site's source tree was one deploy away from being public.** The vanilla
   project has `outputDirectory: "."` and `buildCommand: ""` — whatever is uploaded is served
   — so `apps/next/src/**`, `next.config.mjs`, `tsconfig.json` and the lockfile would have
   been fetchable at `/apps/next/…` the moment either build ran, and a CLI deploy would have
   added the whole of `out/`: a stale duplicate of the second site on the wrong domain.
   `.vercelignore` now carries `/apps/`, checked the way that file's own rules demand.

---

## What is left

### OPEN ITEMS from Phases 1–8 — read these before starting anything

Five. Each says what is known, what is not, and who it belongs to.

**(a) Phase 5, the owner's content pass — OPEN, and the corpus is frozen until it lands.**
No commits, by design: the words are the owner's. The operating constraint is the one from
`docs/PROJECT-PAGES.md` and it is financial rather than editorial — **write everything, then
rebuild once**. A content pass that touches chunk text moves `corpusHash`, invalidates both
vector caches and costs one billed Voyage rebuild plus a re-cut baseline:

```sh
node --env-file=.env scripts/build-vectors.mjs
node --env-file=.env evals/run.mjs
node evals/run.mjs --update-baseline --reason "owner content pass"
```

**One** rebuild after the whole pass, never one per edit. Until then, treat the corpus as
frozen: `9530564fdc07971c`, 70 chunks, 967 terms.

The brief that produced this session records a *copy-workshop chip* as existing. It is not
visible from this checkout — `content/**` is unmodified in all six worktrees listed under (d),
and `git status` on `main` shows no content change. So either it has not started or it lives
somewhere this session cannot see. **Do not assume it is done.**

**(b) The Tier 2 chat verification checklist — WRITTEN, NOT RUN.** It is
`docs/DEPLOY-RUNBOOK.md` §4: preflight `204` before the budget is touched, reflected
`Access-Control-Allow-Origin` plus `Vary: Origin`, one budget decrement per conversation, and
the four negative checks. It cannot be run until `CHAT_ALLOWED_ORIGINS` is set, and that
cannot happen until `main` is pushed and a second origin exists. It is **not** in
`apps/next/README.md`; that file belongs to `next-app`, and a note for its owner is under (d).

**(c) The generation-eval publication paragraph — AWAITING THE OWNER. Nothing about this may
reach a page.** `evals/generation.mjs` and `evals/generation.json` exist and are committed;
no sentence about them is published anywhere, and none should be until the owner writes one.

The drafted paragraph the brief refers to **is not in this checkout** — it lives in the evals
agent's report, not in a file — so it cannot be reproduced verbatim here, and it is not this
session's to compose. What can be reproduced verbatim is the artefact's own prose, which the
runner wrote and which is the raw material any published paragraph would have to respect:

> **DRAFT MATERIAL — UNPUBLISHED. Quoted from `evals/generation.json`, not written for a
> page.**
>
> `$question`: *"Given the tool surface api/mcp.js serves, can a model generate markup that
> honours the published design-system contract?"*
>
> `modelCaveat`: *"The model under test is claude-sonnet-4-5. api/chat.js runs
> claude-haiku-4-5, so this is NOT a measurement of the site's own assistant — it measures
> whether the published contract is legible to a capable agent, which is the claim api/mcp.js
> makes to somebody else's tooling. n is 10; every rate below carries a two-sided 95% Wilson
> interval and the half-widths are wider than 15 percentage points. One brief moves a rate by
> 10pp. Read the intervals, not the point estimates."*
>
> The figures, from the same file: all four gates passed on **8 of 10** briefs (95% CI
> 49.0–94.3%). Per gate — classes 10/10, tokens 10/10, literals 10/10, a11y 8/10.

Two things a published paragraph must not do, both already learned the expensive way on
`/evals`: it must not carry a **typed** figure (item 30 in the tracked list is five false
claims caused by exactly that), and it must not take a **shape** a re-run can falsify — "tied
for best in the table" has now broken three times. And unlike `/evals`, this artefact has no
placeholder mechanism, because `evals/generation.json` is gated by nothing and only a billed
run can move it.

**(d) Six chip sessions are in flight, and none of them is merged.** Each is a `claude/*`
worktree under `.claude/worktrees/`. Their bases differ, so all six will need rebasing onto
whatever `main` becomes. Measured this session, not remembered:

| Worktree / branch | Base | State |
|---|---|---|
| `awesome-rhodes-08e8b6` | `cace793` | uncommitted, `js/answer-render.js` (+13/−2). Two related fixes: the corpus URL becomes root-relative (`content/dist/content.json` 404s from `/work/<id>`), and a `rebaseHref()` for corpus link hrefs, matching `rootRebase` in `build-content.mjs` |
| `confident-poincare-354e22` | `fe12a71` | uncommitted, one line of `js/automata.js`: `rebuild(pageRegions, …)` → `rebuild(all, …)`. **This is the upstream defect `apps/next`'s port reported** — `pageRegions` is defined nowhere in that file, so the font-ready re-settle throws inside a promise callback and the ResizeObserver silently heals it |
| `exciting-bose-c27c23` | `fe12a71` | uncommitted, `design-system/README.md` + `design-system/package.json` + `index.html`, plus two new files: `design-system/scripts/page-a11y.mjs` and `.github/workflows/pages-a11y.yml` — a **page-level** a11y gate, which is the assertion the story-level exemptions explicitly do not make |
| `happy-meitner-4197f2` | `fe12a71` | uncommitted, `index.html`: the drawer's `<aside role="dialog">` / `<header>` pair becomes two `<div>`s. This is the vanilla half of the defect Phase 2's axe gate found in the design system — `9458b2d` says in as many words that "index.html still ships the old pair" |
| `infallible-tu-8c096e` | `cace793` | uncommitted, `js/chat.js` + `apps/next/src/lib/chat/{types,useChat}.ts`: a gate `notice` stops counting as a tool call in the trace (`count: false`, the treatment `meta` already had). **Touches both surfaces**, which is the port rule working — fixed upstream, re-applied in the copy |
| `wizardly-liskov-f7f306` | `fe12a71` | **one commit ahead**, `9c66a24`: Storybook loaded Google's font CSS while the site vendors its own, so the a11y and visual gates took their metrics from a network fetch. All 62 stories match the committed win32 baselines after the swap |

Three of the six (`confident-poincare`, `happy-meitner`, `infallible-tu`) are fixing defects
this programme's own gates or ports *found*, which is the arrangement working. None has been
reviewed here and none is claimed correct — the table records what is on disk.

**(e) The Storybook Vercel project — PENDING, and the CV currently links a URL that lies.**
`yordan-design-system.vercel.app` answers 200 with **this portfolio** (`/cv` resolves there,
`/index.json` 404s): it is a second domain on the vanilla project, not a Storybook. That URL
is published by `content/profile.json` and therefore by the CV, and it was published by
`README.md` as "**Storybook:**" until this commit corrected it. The README is a document and
was fixed; the CV is a **page**, its words are the owner's, and it has been left alone. The
fix is either a Storybook project with that domain moved onto it
(`docs/DEPLOY-RUNBOOK.md` §3) or an owner edit to `content/profile.json` — a deploy decision,
not a copy one, so it is recorded rather than acted on.

### The design pass is finished and shipped

Everything in this block is live. It is listed so a new session does not re-propose it.

| Landed | What |
|---|---|
| Section rhythm | One rule: every well is inset two lattice cells, tint no longer decides spacing. A strip separates **every** section boundary including the last — 8 sections, 8 strips, all 96px. |
| Type ramp | Ten steps set by level (chosen rem, stepping at the 760px grid break), three set by their box (clamps). Measured ratios 1.11 phone / 1.25 wide. |
| A viewport tier in the token layer | A step that changes at the grid break is a token with a `wide` value, emitted as a media query by the same machinery that emits `dark` and `print`. The build refuses a token carrying both `dark` and `wide`. |
| Section heads | Exactly 3 cells from the section's top edge, bottom edge at phase 0 on every section. |
| `theme-color` | Browser chrome follows the pinned theme, fixed inside the already-blocking head script. |
| Notable cards | Minimal at rest (6 cells, eyebrow + title). Image **and** description ride the pointer in one floating panel — `js/peek.js`. Touch and no-JS show both in the card. |
| Portrait | The owner's original file, byte-identical, black tile intact. Circular in both the bar and the drawer. |
| Nav hierarchy | identity → navigation → context → **primary action** → utility. The action is a solid **accent** block, not ink. |
| Theme control | **A satellite of the bar** ≥700px: a 40px puck hanging 12px off the bar's right edge (DOM child of `.bar`; the bar centres by auto margins, not transform). **Below 700px it lives in the menu sheet's foot** — the corner belongs to the chat pill. Two renderings, one visible per viewport; `js/theme.js` updates every `[data-theme-toggle]`. **Every press flips the page:** the next state is the opposite of what is rendered, and a flip landing on the system's own theme stores auto rather than a pin — the dead press is gone, not relocated. No text: a fill for each pinned state, half-and-half + rotating for auto. |
| Project pages | Five case studies at `/work/<id>`, generated and byte-compared. The full-screen modal is retired. |
| Mobile nav | Below 700px the bar **docks edge-to-edge** (hairline underline, no drop shadow — the floating pill measured 54% of a 375px viewport and read as unanchored) with the identity growing left and the **`Menu` word-segment at the very right** (no hamburger — owner's decisions, both). It opens a **full-screen menu** (`js/menu.js`) that covers the bar and sets the background `inert`. **The sheet's head is a replica of the docked bar and Close sits in the trigger's exact slot** (flush right, 0–44px, same padding) so the thumb never moves — owner named the friction. **Close wears the pressed ink at rest** (the trigger's own `[aria-expanded="true"]` state carried through) so the passive title and the control are never the same coat — owner named that too. Hero CTAs stack vertically ≤480px at **equal widths** (they had 6.5px of slack at 375 and overflowed below ~369). The theme circle sits at the **top** of the menu body (owner's second call, reversing utility-last). Sub-page labels are **"← Home"** in the bar and **"Home"** (no arrow) first in the menu; work-page menus add a distinct `/` Home. Work pages gained the nav clearance their section head never had (title sat 32/48px under the bar, mobile/desktop). The work-index rows keep their `View →` chip ≤560px (it was `display: none` — the only affordance dropped exactly where hover doesn't exist), and their numbers stack **above** the name there (the 2.5rem gutter spent a fifth of a 312px line on two digits). The docked bar's identity is one type step up on mobile only (`--text-sm`, study frame F; desktop keeps `--text-xs` so the measured width tables stay true; the menu head's title tracks it — the head is a replica and the title sets its height). Notable cards: **collapsed at one fixed 6-cell height on every input** (owner's spec), content clipped by ONE base rule (no media queries), the touch trigger a quiet underlined link in the corner **authored in the card markup by the content build**, and the **peek sheet authored statically in index.html** beside the drawer (z 350; real dialog — focus trap, `inert`, Escape/scrim/Close). js/peek.js wires and populates, **injects nothing** — measured zero DOM growth — after an injected first version slid the lattice (PROGRAMME-LOG has the arc). The owner's "two grids" screenshot then exposed the deeper cause: **the scroll lock itself was a silent resize** (scrollbar removal shifted the sheet 4.33px/+24px with no event), fixed structurally with `html { scrollbar-gutter: stable }` — every body lock is now layout-neutral, verified by resizing mid-lock and measuring zero drift. The closing fix: **automata now watches its lattice root with a ResizeObserver** feeding its debounced rebuild, so ANY post-load layout change re-measures automatically — the owner's fresh-reload repro (misaligned until any resize) is gone by construction, not by enumeration. Traded fallback, documented: sighted no-JS touch sees the collapsed card; content stays in the DOM and a11y tree. Strings "Tap for details"/"Close" are assistant-drafted, awaiting the owner's rewording. The circle in the menu is captionless and strip-less, at the **top** of the body (owner's calls). **All section plate numbers (`01`–`07`) are removed** on every page and the work template — owner's call; the head grid is `1fr auto` now, the cv print rule went with it, and the removal note lives in section-head's spec. The **work-index numbers stack above the content at every width** (rows are an ordered list, so those digits stayed). **The chat is the `ask-fab`** (component #23, `js/fab.js`): a **solid-accent** pill at the bottom-right corner (owner reversed the earlier chrome+ring dress; offset shadow kept, no hairline — same ground/label pair as the bar's Ask), face at 2.75rem filling the pill inside a 2px rim, folding to a 48px face-circle on downward scroll — any upward scroll restores the full pill, wherever the reader is. cv keeps Print in the bar; evals/mcp have no action; desktop is untouched. Replaces cv's old 560px link-hiding rule; the 320px identity clip is gone. |

### Open decisions — these need the owner, nothing else blocks on me

1. ~~**The type ramp.**~~ **SHIPPED.** The prototype files are deleted.
2. ~~**The head fix.**~~ **SHIPPED**, with the ramp.
3. ~~**The hero floor.**~~ **ANSWERED — `2.5rem` fits. The `2.25rem` fallback is not needed.**
   Settled by arithmetic rather than by a viewport, because the pane will not go below ~353px.
   Archivo was confirmed loaded, `HRISTOV` (the longer of the two lines) was measured by glyph
   advance with the `-0.02em` letter-spacing included, and the width chain was reproduced from
   the CSS and validated against the live 1280px layout — it predicts sheet 1248, rail 96 and
   979.2px of content, all three exact, and predicts the 360px sheet at 375px that
   `skeleton/spec.md`'s measured table independently reports.

   | hero floor | `HRISTOV` | vs 224px (320px, no scrollbar) | vs 200px (320px + scrollbar) |
   |---|---|---|---|
   | `3rem` (today) | 233.5px | **overflows** | **overflows** |
   | `2.5rem` (proposed) | 194.6px | fits, 29.4px spare | fits, 5.4px spare |
   | `2.25rem` (fallback) | 175.1px | fits, 48.9px spare | fits, 24.9px spare |

   The one caveat: in a 320px *desktop* window a scrollbar takes 15px and the margin falls to
   5.4px, under 3%. Real 320px devices have no persistent scrollbar. If you want comfort rather
   than a fit, `2.25rem` buys 25px — but the proposal as written is sound.
4. ~~**`theme-color`.**~~ **SHIPPED.** It did not brush the no-flash rule after all — the head
   script that reads the pinned theme is already inline and blocking, so it flips the metas in
   the same frame. No new script.
5. **Notable Projects images.** Nine placeholder plates are generated by
   `scripts/make-placeholders.mjs` — the site's own graph paper with each project's initials.
   Dropping a real file at `content/assets/notable/<id>.svg` is the whole migration: the path is
   derived from the id, so there is no frontmatter to add and no build change.
   **Constraint for real photography:** type sits over the image under a `--surface-page` wash
   at 0.88. Light images are fine; a dark photograph needs that wash raised. In `card/spec.md`.
6. **Groundedness re-run** (~$0.93). The committed artefact describes an endpoint that no longer
   exists; the 15% figure is a large understatement. Deliberately deferred until content settles.
7. **Bespoke hover copy for the notable cards.** The cards currently reveal each project's
   existing `{#summary}` — the owner's own words, and free. A *new* description field becomes a
   corpus chunk, which moves `corpusHash` and forces the billed vector rebuild, so it should
   batch with item 8.
8. **Assistant-only project knowledge.** Not due. The architecture is written up in
   `docs/PROJECT-PAGES.md`: sections in `content/projects/*.md` are chunked by default and
   *rendered* by an allow-list, so "not on the page" is already the safe default and each one
   becomes a real citable chunk. The single constraint is operational — **write all nine, then
   rebuild once.** One at a time pays the billed rebuild nine times.

### Tracked work

| # | Item |
|---|---|
| 24 | Design-system MCP tools cannot satisfy the provenance gate — needs a second provenance kind, not a fake chunk id |
| 26 | The retry instruction pushes design-system answers toward a false "not on file" |
| ~~29~~ | ~~BM25 has no stopword list~~ — **done, `16ec209`.** NLTK English list, external and fixed before measurement. bm25 hit@3 67.3 → 83.7, hit@1 49.0 → 57.1, MRR 0.627 → 0.706; the Background statement's 9 wrong top-1s fall to 1; abstain 0.0 → 43.8%. Nothing billed — `corpusHash` is over chunk *text*, so both vector caches stayed valid. Baseline re-cut with `--reason` so the gain is protected. |
| 30 | **BLOCKED ON THE OWNER, and it grew.** `/evals` now carries **five** false claims, recorded in `content/evals.json`'s `review` array with the arithmetic rather than rewritten — that file's rule is that an agent must not author replacement prose. Two were caused by item 29 (¶2's "salary expectations" and "speak Japanese" examples now *abstain*, illustrating the opposite of the sentence's point; ¶4's "roughly seven points" is now 49, and "the entire ability to say not on file" is false because BM25 abstains on its own). Three predate it (¶4's "tied for best in the table" — the superlative, now also wrong because `evals/CLAUDE.md` bars separability from lead-able columns; ¶2's "appears eight times" — `google` occurs 10 times across 9 chunks). **Each needs the owner's own words.** |
| ~~31~~ | ~~Replace `check-css` rule 6~~ — **done, `98882fa`.** It bounds a floor on `--space-6` (a rail's simulated cells go as 1/cell²) and a ceiling on `HIDDEN`, plus an assertion that the cost *model* still has four sim assignments from a known term set. Nine mutation cases verified. |
| ~~32~~ | ~~Gate that tokens obey their own documented system~~ — **done, `2142dbf`.** See below; it found four bad contrast figures and the handover's framing of it was overstated. |
| — | W6 numbers pass (docs citing measured figures, held until content settles) |
| ~~—~~ | ~~W7 end-to-end verification and deploy~~ — **done.** Merged to `main` and deployed. |

### Uncommitted right now

Nothing on `main` — the tree is clean. But `main` is **24 commits ahead of `origin/main`**
and therefore ahead of production, and six worktrees carry uncommitted work of their own; see
open item (d).

---

## What a new session must NOT touch without being asked

The owner has deferred these explicitly. They are not oversights and they are not warm-ups.

- **Anything eval-related.** `/evals` publishes five claims that are currently false; the owner
  has seen the list and chosen to ship anyway. They are recorded with their arithmetic in
  `content/evals.json`'s `review` array. **Do not rewrite them** — that file's own rule is that
  replacement prose must be the owner's.
- **Items 24 and 26**, the assistant's retrieval defects.
- **The groundedness re-run**, which is billed.
- **Per-project prose.** The owner intends to review each case study's text himself.
- **`evals/generation.json`'s numbers, on any page.** The measurement exists; the paragraph
  that publishes it is the owner's to write. See open item (c) — and note that the artefact
  is gated by nothing, so a published figure about it could only be kept true by spending
  money.
- **The corpus**, until the Phase 5 content pass lands. Every chunk-text edit before then
  pays the billed rebuild twice.
- **`content/profile.json`'s `storybook` URL**, even though it currently points at the wrong
  site. It is copy, it is the owner's, and the honest fix is a deploy step. Open item (e).

## How the owner's defect reports have gone

Worth reading before acting on the next one. **Four of the reports this session had a different
cause than the symptom suggested**, and in each case auditing first was what found it:

| Reported | Actual cause |
|---|---|
| "spacing under sections is inconsistent" | Twice. First the well padding was coupled to *tint*; then the real complaint turned out to be the **strip**, which existed at only 3 of 7 boundaries. |
| "the avatar has a strange border radius" | A square stroke drawn around a *rounded* tile — the radius mismatch, not a radius. |
| "the dark/light switch order is wrong" | The order was already correct, verified on production. The dial was unreadable: two mirror-image states. |
| "the hover is nothing like what I imagined" | A correct reading of a wrong implementation — an in-card reveal instead of a cursor-following panel. |

**Audit the code before changing it, and say what you found.**

---

## The finding that matters most

An audit of the token system asked *"which values were chosen, and which were inherited?"* and
found: **about two-thirds decided, with the inheritance concentrated exactly in the layer
carrying the most confident prose.**

- The colour tier is genuinely solid. Every contrast claim recomputes to two decimals. The
  static type ramp is a real construction: `(1/0.72)^(1/4) = 1.0856`.
- The **fluid** type tier contains no chosen number. Four of seven steps are arithmetic means of
  the ramps they replaced; three are verbatim copies. `--text-title` is the exact mean of
  `.t-title` and `.t-statement` on all three terms.
- Its `vw` term is **inert at both viewports its own documentation argues from**, and none of its
  14 pin points is one of the 13 breakpoints the CSS uses.

The mechanism, and the reason four audits missed it:

> Consolidation produces a value by averaging what was already there, and **an average has no
> author** — so the rationale has to be written afterwards, describing the result. The system is
> decided exactly where there was nothing to inherit.

> The audits checked whether the code matched the documentation, and it did. The failure is one
> level up — whether the documentation matches the **arithmetic** — and nothing tests that.

**That was task 32, and it landed in `2142dbf` before any token value changed.**

### What it actually found, and where this section was wrong

The claim above — that a `$doc`-recomputing gate "would have caught all five findings" — **was
overstated, and the gate is built to what is defensible rather than to that sentence.** Kept
here rather than deleted, because being wrong in this particular direction is the thing this
programme keeps having to correct.

It catches **two and a half of the five**. What it cannot catch:

- *"Four of seven fluid steps are arithmetic means of the ramps they replaced"* is **not a
  `$doc` claim**, so there is nothing to recompute. The `description` fields do quote the
  superseded values, so a gate *could* test "is this the mean of those two?" — but being the
  mean of two predecessors is a smell, not an error, and failing on it would block the
  consolidation this scale was built by.
- *"The `vw` term is inert at both viewports its own documentation argues from"* must not be an
  assertion. `clamp()` survives a 375px phone and a 1600px sheet **by** pinning at them, and
  all seven fluid steps are pinned at both. A gate demanding otherwise demands the clamp not
  work. The defensible half — a `vw` term must be active *somewhere* — is asserted, and all
  seven pass it.
- *"None of its 14 pin points is one of the 13 breakpoints the CSS uses"* is an observation.
  Pin points need not be breakpoints.

**What it did find, on the day it landed: four contrast figures that do not recompute**, all of
which were being emitted into `dist/tokens.css` as comments and served by `get_design_system`.

| Claimed | Actual | Where |
|---|---|---|
| `6.94:1` | `6.93` (exact 6.9344) | stone-400 on stone-900 |
| `5.19:1` | `5.21` | accent 68% on the dark page |
| `5.30:1` | `5.32` | accent 68% on dark chrome |
| **`1.9:1`** | **`2.42`** | accent 47% on a stone-900 ground |

The first three are the size of a rounding difference and point the same way, which reads like
a tool using a different luminance threshold. **The fourth is a different kind of error** —
nothing plausible measures 1.9:1 there; an accent at L=39% on stone-900 does, so the likeliest
history is that the lightness moved to 47% and the sentence did not follow. The conclusion was
never in doubt (2.42 still fails AA, so the argument for a dark variant stands), which is why
all four were corrected as prose rather than raised as questions about the values. So the
audit's "every contrast claim recomputes to two decimals" was false for four of nine.

**The most useful thing learned building it:** the first version checked the geometric ratio
across the static ramp, which depends only on its endpoints — so a mutation moving an interior
step from `0.85rem` to `0.88rem` passed. That is the *same* failure as "a gate enforcing every
size is a token and none enforcing the tokens form a scale", reproduced inside the gate written
to fix it. Every adjacent ratio is tested now, using interval arithmetic from the values' own
2dp precision rather than a tolerance nobody chose. It was caught by mutating the gate, not by
reading it — so **mutate any gate you add here.**

---

## Rules that are load-bearing

- **Copy is the owner's.** Corrections are fine; editorial changes are drafted and stopped for
  review. This has been honoured throughout and must continue.
- **No agent writes a file another agent owns.** Where a finding straddles slices, split it and
  hand off explicitly.
- **Brief agents with what is already fixed**, or they redo it.
- **Verify with the instrument before trusting its output.** See `PROGRAMME-LOG.md`.
- The billed steps are `build-vectors.mjs` and `evals/run.mjs`. Batch every corpus change before
  running either. Both keys are in `.env`; Node needs `--env-file=.env` or the embeddings arms
  print `skipped` and quietly republish a table without them.
