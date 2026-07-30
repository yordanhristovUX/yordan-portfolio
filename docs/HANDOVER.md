# Handover — state of play

Written at the end of a long session. Everything here was measured, not remembered.

**Branch:** `main` · **HEAD:** `7b47aa2` · **Everything below is merged and deployed to
production.** The `audit/w1-w2-foundations` branch was fast-forwarded into `main` and the site
at `yordan-portfolio.vercel.app` is running it.

---

## Starter prompt for a new session

> I'm continuing work on my portfolio repo. Read `docs/HANDOVER.md` first — it has the full
> state, what is deliberately deferred, and the standing rules. `docs/PROGRAMME-LOG.md` has the
> traps; read it before you trust any measurement tool, especially the browser pane. Then read
> `ARCHITECTURE.md` for the slice map.
>
> Everything is merged to `main` and deployed, and `npm run check` is green — start there, and
> if it is not green, that is the first thing to tell me.
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
HEAD            7b47aa2 on main, deployed
tests           96 / 96
gates           all green — `npm run check` exits 0 end to end
corpus          9530564fdc07971c · 70 chunks · 967 terms
design system   83 tokens · 147 values · 21 components
                (83 base + 23 dark + 36 print + 5 wide)
pages           index · cv · mcp · evals · work/<id> × 5
```

**Nothing is billed by the current state.** `corpusHash` has not moved since the corpus
freeze: the stopword change altered the index and not the chunk text, and the project pages
altered `cite` metadata and not the chunk text. Both vector caches are valid.

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

## What is left

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
| Theme control | **Out of the nav.** A floating 40px puck, bottom right. No text: a fill for each pinned state, half-and-half + rotating for auto. |
| Project pages | Five case studies at `/work/<id>`, generated and byte-compared. The full-screen modal is retired. |

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

Nothing. The tree is clean and `main` is deployed.

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
