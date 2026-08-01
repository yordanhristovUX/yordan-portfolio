# Handover — state of play

Written at the end of a long session. Everything here was measured, not remembered.

**Branch:** `main`. **The push happened.** `origin/main` carries everything through the
ordered-rules migration, production is deployed and was verified from outside (see below),
and GitHub is down to one branch. Local `main` runs a little ahead of the remote at any
moment because work is in flight — `git rev-list --count origin/main..main` is the only
honest answer to "how far", and this sentence cannot interpolate one.

**Production is live and current.** Checked this session against
`yordan-portfolio.vercel.app`: `/cv` carries the owner's retitle *"Portfolio as a product"*,
the index carries the notable-cards hint line, and `/apps/next/package.json` and
`/apps/next/next.config.mjs` both 404 — the `.vercelignore` guard doing its job on a
deployment that now contains an `apps/` to guard.

**R4 is in flight while you read this.** The design system is mid-migration: definitions are
landing one batch at a time, and `design-system/**` has uncommitted work in it more often
than not. Every design-system figure below is read from the last commit, not from the working
tree, and will have moved.

---

## Starter prompt for a new session

> I'm continuing work on my portfolio repo. Read `docs/HANDOVER.md` first — it has the full
> state, what is deliberately deferred, and the standing rules. `docs/PROGRAMME-LOG.md` has the
> traps; read it before you trust any measurement tool, especially the browser pane. Then read
> `ARCHITECTURE.md` for the slice map. Anything about deploying — env vars, a second Vercel
> project, headers — is in `docs/DEPLOY-RUNBOOK.md` and nowhere else.
>
> Everything is committed on `main`, pushed, and deployed — start with `npm run check`, and
> if it is not green, that is the first thing to tell me. **The design system is mid-migration
> (R4), so expect uncommitted work under `design-system/` and do not run a build over
> somebody else's half-finished tokens.** The handover's OPEN ITEMS say what is in flight.
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
deployed        yes — verified from outside: retitle live, hint line live, /apps/ 404
tests           149 / 149
gates           green — content, css, boundaries, evals and the suite all pass
corpus          43413e53aa94810c · 99 chunks · 1435 terms      (was 70 · 967)
design system   103 tokens · 167 values · 23 components         (was 83 · 147)
                (103 base + 23 dark + 36 print + 5 wide)
package         @yordan/design-system 1.9.0 · 21 exported subpaths · RELEASED at 1.9.0
definitions     26 blocks: 13 generated, 12 authored, 1 SPLIT (ask-fab, the first)
                14 generated regions in components.css · 13 definitions · 17 packaged
                artefacts byte-compared   (read off build.mjs --check at 2983f30)
questions       65 — 49 retrieval, 16 abstention  (unmoved: not one was added or reworded)
boundaries      8 slice rules · 80 files · 20 crossings pinned
pages           vanilla: index · cv · mcp · evals · work/<id> × 5
                apps/next: the same nine, statically exported (11 files, with 404)
workflows       ci.yml · design-system.yml · next.yml · pages-a11y.yml
```

Every figure was read off a gate's own output or off the last commit this session, not
remembered. **The design-system rows move under you** — they are the ones R4 is changing, and
`node design-system/scripts/build.mjs --check` is the artefact that produces them.

**One thing this block cannot show, and it is the important one.** `npm run check` was **not
run end to end** for this update: the design-system build writes `dist/` and
`content/system.generated.json`, and another agent holds uncommitted work in that directory.
Running it would have rendered their half-finished source into published artefacts. The
read-only gates were run instead and are green — `build-content.mjs --check` (ten files),
`check-css.mjs`, `check-boundaries.mjs`, `evals/run.mjs --check` (four artefacts, no
regression across 7 metrics × 6 arms) and the 149-test suite.

**What was billed, and it was budgeted.** The copy pass moved chunk text, so the corpus
fingerprint moved twice and was re-embedded twice: once for the pass itself (99 chunks), and
once more — sanctioned, one pass — after the open-source chunk's citation label was corrected
to the heading that is actually on the page, because the digest covers `heading. text`. The
baseline was re-cut twice with reasons on file. Both vector caches are valid at
`43413e53aa94810c`.

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

One session, eight phases, 24 commits — **unpushed at the time this section was written, and
pushed since**, along with everything in the era after it. Two threads ran through it:
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

## The architecture revision, the copy pass, and the push (R1 → R4, and everything beside it)

Everything above ends at the documentation commit that closed Phase 8. What follows is the
era after it, and it is a bigger change than the eight phases were: **the owner took an
architectural decision mid-programme, and the design system stopped being a stylesheet.**

### The decision

Components become **contract-first**: a component's appearance is held as data in
`design-system/components/<id>/definition.json`, and two emitters render it into two
independent pipelines —

| | Pipeline 1 | Pipeline 2 |
|---|---|---|
| Output | a generated region of `css/components.css` | `dist/tokens.tailwind.css` + `dist/react/<id>.tsx` |
| Consumer | the vanilla site, and Storybook | `apps/next` |
| Emitter | `scripts/emit-css.mjs` | `scripts/emit-tailwind.mjs`, `scripts/emit-react.mjs` |

Neither output is a translation of the other — both are renderings of the same definition,
which is the whole claim. The owner chose the end state explicitly: **grow the schema until
every component generates**, rather than stopping at a comfortable subset. Typography went
the same way and is now a generated region rendered from `tokens/typography.json`, which is
deliberately *not* a component definition (nothing about `.t-lead` wants a `<TLead>`, and
`.t-title` sets `line-height` twice behind a fallback — a construct a class attribute cannot
express, because a class attribute has no order).

### R1–R3, in the order they landed

- **The pilot** (`82404c7`). `button`, `chip` and `stat` moved into definitions and out of
  authored CSS, and all three generated regions came back **byte-identical** to the blocks
  they replaced. Nothing was designed: every value was transcribed. The one idea in it is
  that a value is one of three things — a bare string is a structural literal, `{token:x}` is
  a binding, an array is a sequence of both — so `border: 1px solid var(--content-primary)`
  records which third of itself is a token, a fact no parser recovers from CSS.
- **Pipeline 2** (`a8b307a`, `85b0e25`, `13bbdca`). The same three definitions render a
  Tailwind `@theme` in which **every entry is a `var()` reference and no entry holds a
  value** — so dark mode, print and the wide tier reach a utility by exactly the mechanism
  they already reach a hand-written rule by, and there is nothing to fork. Three refusals are
  load-bearing: the 25 raw ramp tokens get no utility at all (`bg-stone-500` would hand a
  consumer the raw tier this system's first rule reserves), `color-scheme` stays out of
  `--color-*`, and the keys are `p-space-3` / `text-step-xs` so the package cannot silently
  redefine a class the Tailwind ecosystem already owns.
- **The schema** (`7bb06fd`). Extracted from the real definitions rather than invented ahead
  of them, and validated by `scripts/validate-json.mjs` with a **closed keyword list** — a
  key the validator does not know is an error, not an extension.
- **`contract-diff.mjs` grew to four surfaces** — tokens, components, definitions, exports —
  and the version walked `1.0.0 → 1.9.0` with a release per batch and a `CHANGELOG.md` entry
  each time. Exports went 6 → 11 → 21 subpaths. Both figures are still climbing;
  `design-system/CHANGELOG.md` is the record and `package.json` is the current state.
- **The ordered-rules migration** (`fd76075`). A definition held five named sections and the
  emitter rendered them in a fixed cascade; `media` and `profile` proved the cascade was the
  *emitter's opinion rather than the stylesheet's shape*. The alternative was a `detach` flag
  — a key that exists to move a line rather than to say something about the component — and
  the format refuses hints. So the sections became **one ordered list in stylesheet order**,
  each entry tagged by `kind`: source order *is* the cascade, so recording it records a fact.
  Landed as a migration with a byte-parity ratchet — all ten definitions moved in one commit,
  every generated region and all fourteen published artefacts byte-identical to a fresh
  render, and the contract's resolved projection unchanged.
- **The census** (`0090df9`). `components.css` could prove its generated half and nothing
  about the rest. Every block now carries a marker saying which half it is in, and an
  authored one **says why** from a closed vocabulary; the build asserts that the reason's
  feature is actually *present* in the block, so a reason that has stopped being true is a
  block that should now be a definition and the build names it. At the last commit, in the
  gate's own words: **26 blocks — 13 generated, 12 authored, 1 split** — with the authored
  reasons breaking down as 5 `relational-selectors`, 4 `unnamed-condition`, 2
  `foreign-selector`, 2 `local-custom-property`. **`split` is new**: `2983f30` cut `ask-fab`
  into a generated half and an authored one, which is the shape the migration takes when a
  block is *partly* expressible rather than not at all.

### The finding that cost the most, and is the most reusable

**A class attribute has no order.** `cva` concatenates base and variant classes into one
attribute, CSS resolves the pair by *stylesheet* order, and Tailwind decides stylesheet order
by sorting class names. Every override in the pilot sorted before the base class it had to
beat — `px-space-3` before `px-space-5`, `text-content-inverse` before `text-content-primary`
— so `Button variant="solid"` rendered dark ink on a dark fill where the hero CTA is, and
`size="small"` rendered at base metrics: 102×46 against the vanilla page's 81×36. Chip worked,
and worked only by the accident that its names sort the other way.

The fix (`612732c`) is **disjointness, not weight**: no `!important`, no `tailwind-merge`, and
not one byte of the definitions. Every emitted class now reports the CSS longhands it writes,
shorthands expand, and a base class writing a longhand an axis owns is moved into that axis's
`default` branch — so exactly one of the two is ever in the attribute. Two axes writing the
same property cannot be made disjoint, and the build **fails naming both branches and the
property** rather than choosing. In the same commit `:hover` became `[&:hover]:` because
Tailwind's `hover:` wraps in `@media (hover: hover)` and `components.css`'s `:hover` does not
— the two pipelines disagreed about every hover state in the system on a coarse pointer. That
media query may well be better behaviour; it is **not the emitter's to invent**, so it is
filed as a definition-format question that must move both surfaces in one commit.

### The copy pass arrived, and the ground truth had to follow it

Thirteen workshop commits merged (`09197f1`). The corpus went **70 → 99 chunks**, and the
site/CV skills taxonomy collapsed into one six-row list, which killed `skills:design:site` and
stopped the eval runner before a question ran.

- Two question ids were repointed to the surviving groups that carry their subject, **all 65
  re-verified** against the new corpus rather than only the two the error named, and no
  question was added, removed or reworded. Every premise still holds; the two
  fabricated-employer probes got *harder*, because the pass added more Google and Hotjar
  mentions as tools.
- **Everything fell, and that is what a much bigger index does to a fixed top-k** — 70 chunks
  to 99: bm25 hit@3 83.7 → 63.3, embeddings 91.8 → 79.6. The floor was re-cut with the reason
  on file. (`52fbcfb`'s own message says "36% bigger" in one sentence and "70 chunks to 99" in
  another; the counts are the checkable half, so they are what is quoted here.)
- Part of that fall was **measurement, not retrieval**, and it was escalated rather than
  folded in: the pass restored six Spetema sections an earlier rewrite had killed, so five
  questions were being scored against a gold set narrower than the corpus supports.
  `cross-b2b-b2c` was marked wrong by every arm while both ranked arms returned
  `project:spetema#subtitle` — the question in as many words. Widening a gold set raises
  hit@k, so doing it inside the commit that freezes a floor is precisely the shape the
  charter's tuning rule exists to stop. **The owner approved it on 2026-08-01** and it landed
  alone (`bd6e191`), by a rule that is mechanical and checkable against git: gold is the
  UNION of each question's pre-rewrite and current sets. It recovered about a sixth of the
  fall, and only on the arms that could recover it.
- **The comparison this suite exists to make stopped being significant, and it is published
  that way.** `embeddings vs bm25` was p=0.0386 and is now **p=0.0654** — the re-widen helped
  bm25 more than embeddings, 9–2 on eleven discordant questions. That is not retrieval getting
  worse; it is the ground truth getting more accurate and 49 questions turning out to be too
  few to hold the distinction they appeared to hold. It is reported as *"this set cannot
  detect a difference"*, never as *"the arms are equal"*, and the remedy is more questions.

### The defect chain, and every chip merged

**Every branch in this repo is now an ancestor of `HEAD`** — the six chips this file listed
as in flight, the copy workshop, and the two agent branches that opened after it. Checked
with `git merge-base --is-ancestor`, not assumed. What the chips carried, and what each one
actually turned out to be:

| Fix | What it turned out to be |
|---|---|
| `Independent` unreachable (`9eb816b`) | The gate reads a term as a proper name when every occurrence in chunk *bodies* is capitalised — which is what stops `team`, `web` and `site` opening it. `independent` appears lowercase exactly once, in Domestina's description, and one unrelated sentence made an employer unreachable by the only name it has. Fixed by a per-entity `sole` set: a term also counts when it **exhausts** one of that entity's authored names |
| Reduced-motion 5Hz oscillation (`ebc9900`) | The `*` boilerplate `transition-duration: 0.01ms`, with `transition-property` defaulting to `all`, turned every `--term-slack` write into a tween still at progress 0 for the rest of the task that wrote it — so the terminator pass read the *previous* pass's layout. Fixed in both layers and on both surfaces |
| `pageRegions` (`20a162a`, re-copied at `554cdc2`) | The font-ready re-settle had never run: a name deleted with the case dialog threw inside a promise. It was `all` all along |
| Chat trace count (`ec2e5d1`) | A validation notice is not a tool call |
| Corpus hrefs (`fe7028d`) | The renderer now rebases what the build already rebased |
| Drawer `<aside>` (`17a7285`) | `index.html` catching up to the spec the axe gate fixed in the design system |
| Storybook fonts (`9c66a24`) | The gates were taking their text metrics from a network fetch |
| The page-level axe gate (`68520b5`) | The assertion the story-level exemptions explicitly do not make: four shipped pages, both themes, no exemptions — `pages-a11y.yml`, the **fourth** workflow |

### The push era

Production is deployed and was verified from outside rather than assumed: the retitle, the
hint line, and the `/apps/` guard returning 404. All four workflows are green, and getting
there needed one real fix — **the suite ran on the developer's Node, not CI's** (`f451090`).
`test/ci.test.js` imported `globSync` from `node:fs`, which arrived in Node 22, so on the
runner's pinned Node 20 *the file that checks the gates was the one file that never loaded*.
`test/budget.test.js` had an abort-signal lock with nothing holding the event loop open,
because `AbortSignal.timeout()`'s timer is unref'd. Both fixed, and a guard added:
**`ARRIVED_IN` lists builtin exports newer than the pinned Node and fails any gate that
imports one**, compared against the pin rather than a hard-coded 20, so raising
`node-version` retires an entry. Verified in docker on node:20 linux and on Windows node 24.

Eight stale branches were deleted and **the remote is `main` only** (`git branch -r`: one
branch and `HEAD`). The eight local `claude/*` names are still listed because each has a
worktree attached; all eight are ancestors of `HEAD` and none holds unmerged work.

---

## What is left

### OPEN ITEMS — read these before starting anything

Lettered so the earlier ones keep their names. **(a)** and **(d)** are closed and are kept as
one line each, because a reader who remembers them should find out where they went rather
than wonder.

**(a) Phase 5, the owner's content pass — CLOSED.** It landed: thirteen workshop commits
merged at `09197f1`, the corpus went 70 → 99 chunks, and the ground truth followed it. The
"write everything, then rebuild once" constraint was honoured — one billed rebuild for the
pass, plus one sanctioned second pass after the citation-label correction, and two baseline
re-cuts with reasons. The corpus is no longer frozen; it is `43413e53aa94810c`, 99 chunks,
1435 terms, and both caches are valid at it.

**(b) The Tier 2 chat verification checklist — WRITTEN, STILL NOT RUN.** It is
`docs/DEPLOY-RUNBOOK.md` §4: preflight `204` before the budget is touched, reflected
`Access-Control-Allow-Origin` plus `Vary: Origin`, one budget decrement per conversation, and
the four negative checks. The push has happened, so the blocker is now down to one thing:
`CHAT_ALLOWED_ORIGINS` is unset and there is no second origin to put in it. It is **not** in
`apps/next/README.md`; that file belongs to `next-app`.

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

**(d) The six chip sessions — CLOSED, all merged.** Every one is an ancestor of `HEAD`, and
what each turned out to be is in the defect-chain table above. The table that used to sit
here — six worktrees, their bases and their uncommitted diffs — described a state that no
longer exists, and is removed rather than left to be read as current.

**(e) The Storybook Vercel project — PENDING, and the CV currently links a URL that lies.**
`yordan-design-system.vercel.app` answers 200 with **this portfolio** (`/cv` resolves there,
`/index.json` 404s): it is a second domain on the vanilla project, not a Storybook. That URL
is published by `content/profile.json` and therefore by the CV, and it was published by
`README.md` as "**Storybook:**" until this commit corrected it. The README is a document and
was fixed; the CV is a **page**, its words are the owner's, and it has been left alone. The
fix is either a Storybook project with that domain moved onto it
(`docs/DEPLOY-RUNBOOK.md` §3) or an owner edit to `content/profile.json` — a deploy decision,
not a copy one, so it is recorded rather than acted on. **Re-checked after the push: still
true.**

**(f) R4 — the migration is IN FLIGHT right now.** At `2983f30`, in the census gate's own
words: **26 blocks — 13 generated, 12 authored, 1 split**, with 14 generated regions in
`components.css` (the thirteenth definition plus typography), contract at 1.9.0 and 21
published subpaths. `ask-fab` is the first block to be **split** into a generated half and an
authored one, which is why there is now a third census kind.

These figures moved twice while this section was being written, and one of them was wrong in
between: counting the markers in `components.css` by hand gives "14 generated, 13 authored"
and the gate says "13 generated, 12 authored, 1 split", because a split block contributes a
marker to both halves. **Read `node design-system/scripts/build.mjs --check`; do not count
the file.** That is the same lesson this repo keeps paying for, collected one more time. A **row split** is reported as approved and in
progress, and it is the change that would take the contract to **2.0.0** — a MAJOR, because
splitting a component removes a name. *That last part is reported rather than verified: at
the last commit nothing in `design-system/` names a 2.0.0 or a row split, which is what
in-flight work looks like from outside.* Expect `design-system/**` to have uncommitted work in
it, expect the counts to move, and **do not run a design-system build while it does**: that
build writes `dist/` and `content/system.generated.json`, so it would publish somebody else's
half-finished source. Read the counts from the last commit instead.

**(g) R5, the cutover — PENDING.** The end state the owner chose is every component
generating. R4 is the approach to it; R5 is the point at which the authored half of
`components.css` is empty and the census has nothing left to excuse.

**(h) R6, deploys and Tier 2 — PENDING**, and it is the same list as (b) plus
`docs/DEPLOY-RUNBOOK.md`'s three projects: `CHAT_ALLOWED_ORIGINS` on the vanilla project with
the redeploy it needs, the second Vercel project with a **preview build before any domain**,
and the optional Storybook project from (e). None of these can be done from the repository;
all of them are dashboard steps, which is why the runbook exists.

**(i) R7, the documentation pass — PENDING, and `ARCHITECTURE.md` is stale in a specific
way.** That file describes **one** pipeline. It says the design system emits CSS, tokens and
a component contract; it does not describe definitions, the two emitters, the Tailwind/React
tier, or the census. Two sentences in it say the `exports` map names "exactly six" subpaths
and there are **20**; a third counts "the six" `dist/` outputs, and `dist/` has grown a
Tailwind theme and a `react/` directory since. All three are left standing on purpose —
this rewrite is R7's, and doing it piecemeal produces a document that describes neither
architecture. Until then, `ARCHITECTURE.md` is right about the boundaries and behind on what
the design system *is*. (What it says about `check-boundaries.mjs` asserting **six artefacts**
exist is a different six and is still true — checked.)

**(j) The deferred design decisions — the owner's, and each is written where it applies.**
There is **no single consolidated list in the repo**, so this is a pointer table rather than a
count; anyone quoting a number for it is quoting something that is not written down:

| Decision | Written at |
|---|---|
| `$conditions` are named for their values (`below-720`, `from-760`) because `components.css` holds **seventeen** distinct max-widths and no ramp. Consolidating them is an *appearance* change the migration may not make | `design-system/README.md`, the `$conditions` section |
| `line-height` — twelve distinct values across nineteen declarations, drift to be consolidated *before* it is tokenised. `max-width` is on the same list, as a *measure* rather than a spacing job | `design-system/README.md`, the exemptions section |
| The border-token question | `design-system/PATTERNS.md`, its closing section |
| The single deliberate appearance change of the type phase: one `0.05em` tracking value, on five selectors, folded into `0.06em` | `df35070` |
| Whether `:hover` should carry `@media (hover: hover)` — if it is right it is right for **both** pipelines, so it is a definition-format question, filed rather than dropped | `612732c` |
| Behaviour stays out of definitions permanently — element choice, focus, keyboard, ARIA are judgement and live in `spec.md` | `design-system/README.md` |

**(k) `.nvmrc` — an open question, not a task.** All **four** workflows pin `node-version:
"20"`; every machine here runs 24, and that divergence has already cost one CI-only failure
(see the push era above). There is **no `.nvmrc` in the repo** — checked. Adding one would
make the pin visible to a developer's version manager; it would also add a fifth place the
number lives, which four workflows would not read. So it is a decision rather than an obvious
win. The guard that actually catches the class of bug — `ARRIVED_IN` in `test/ci.test.js`,
compared against the pin rather than a literal — exists either way.

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

Nothing on `main` — the tree is clean. But `main` is **well ahead of `origin/main`**
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
