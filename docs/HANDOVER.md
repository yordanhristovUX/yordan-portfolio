# Handover — state of play

Written at the end of a long session. Everything here was measured, not remembered.

**Branch:** `audit/w1-w2-foundations` · **HEAD:** `440ae8b` · **Base:** `main` (Wave 0 already
merged and deployed to production)

---

## Starter prompt for a new session

> I'm continuing a remediation programme on my portfolio repo. Read `docs/HANDOVER.md` first —
> it has the full state, what's left, and the open decisions. `docs/PROGRAMME-LOG.md` has the
> history and the traps, read it before you trust any measurement tool. Then read
> `ARCHITECTURE.md` for the slice map.
>
> Work through specialists in `.claude/agents/` — each is scoped to one slice, and the rule is
> that no agent writes a file another agent owns. Brief them with what is already fixed, what is
> deliberately still broken, and which findings they own, or they redo work.
>
> Start by telling me what you think the next step is and why, before doing it.

---

## Current numbers

```
tests           96 / 96
corpus          9530564fdc07971c · 70 chunks · 1048 terms
design system   83 tokens · 142 values · 21 components · 24 dark · 35 print
gates           tokens ✓  content ✓  css ✓  vectors ✓
                bounds ✓  evals ✓  behaviour ✓  api-loads ✓
                doc-arithmetic ✓  (new — see task 32 below)
```

**`npm run check` runs end to end and exits 0.** It had been short-circuiting at step 3 of
nine, so `build-vectors --check`, `check-boundaries`, `evals --check`, the behaviour suite and
both `api/` smoke tests were not executing in a single command — the numbers above were true
but had been gathered by running the steps individually. That is fixed; one command now proves
all of it.

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

### Open decisions — these need the owner, nothing else blocks on me

1. **The type ramp.** Full proposal in the session log; prototype at
   `_type-study.html` (serve it, never open as `file://`). The decision is the **768–1024 band**:
   card titles 18.4 → 24.8px, page 7–12% longer. 1280/1600 barely move. Owner chose "prototype
   first" and has seen it; verdict pending.
2. **The head fix.** Three CSS declarations, no token changed, delivers phase 0 at every width.
   Owner chose to hold it and land with the ramp. **It is independent and could ship alone.**
3. **The hero floor.** `2.5rem` may still overflow the well at a true 320px — this pane clamps
   at 353 and the two measurements disagree. Needs a real 320px check. If it overflows, the fix
   is `2.25rem` and nothing else in the proposal changes.
4. **`theme-color`.** The `<meta>` tags key on `prefers-color-scheme` while the site keys on
   `[data-theme]` — pin light on a dark OS and the browser chrome is wrong. Only a JS-written
   value fully fixes it, which brushes the no-flash head-script rule.
5. **Notable Projects images** — nine cards, placeholders in place, real files drop in with no
   code change.
6. **Groundedness re-run** (~$0.93). The committed artefact describes an endpoint that no longer
   exists; the 15% figure is a large understatement. Deliberately deferred until content settles.

### Tracked work

| # | Item |
|---|---|
| 24 | Design-system MCP tools cannot satisfy the provenance gate — needs a second provenance kind, not a fake chunk id |
| 26 | The retry instruction pushes design-system answers toward a false "not on file" |
| 29 | **BM25 has no stopword list** — the owner's new Background statement is BM25's top-1 for six of sixteen misses, because `where`/`moment`/`say` score as rare terms. Must NOT be tuned against `questions.json`. |
| 30 | `/evals` ¶4 has broken three times — remove the claim *shape* (a cross-row superlative), not the value |
| ~~31~~ | ~~Replace `check-css` rule 6~~ — **done, `98882fa`.** It bounds a floor on `--space-6` (a rail's simulated cells go as 1/cell²) and a ceiling on `HIDDEN`, plus an assertion that the cost *model* still has four sim assignments from a known term set. Nine mutation cases verified. |
| ~~32~~ | ~~Gate that tokens obey their own documented system~~ — **done, `2142dbf`.** See below; it found four bad contrast figures and the handover's framing of it was overstated. |
| — | W6 numbers pass (docs citing measured figures, held until content settles) |
| — | W7 end-to-end verification and deploy |

### Uncommitted right now

`_type-study.html`, `_type-proposed.css` — the type prototype. Delete once decided.

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
