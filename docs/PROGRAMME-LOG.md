# Programme log — how it went, and what got in the way

Companion to `HANDOVER.md`. That one is state; this one is the things a fresh session would
otherwise rediscover the expensive way.

---

## The shape

Four independent audits produced ~60 findings. They were executed by slice-scoped specialists
(`.claude/agents/`) in waves, with barriers where one wave's output was another's input. The
repo's own architecture *was* the orchestration plan: `ARCHITECTURE.md` already said a slice
needs "its own source plus the schemas of its inputs", so `check-boundaries.mjs` doubled as the
check that no agent reached outside its lane.

**What worked:** slice-scoped agents with explicit "what is already fixed / what is deliberately
still broken / which findings you own" briefs. Agents given that context corrected the brief
instead of following it — repeatedly, and they were right nearly every time.

**What cost the most:** measurement instruments that lied, and my own briefs being wrong.

---

## Times an agent corrected the brief, and was right

Worth reading — the pattern is that the agent measured something I had reasoned about.

| I said | Reality |
|---|---|
| "Recategorise these two eval questions as `corpus-gap`" | Spetema's surviving summary still *answers* both. Marking them abstention would score a retriever **wrong for returning the passage that answers the question**. Refused, with a rule applied to all seven instead. |
| "Use `container-type: inline-size` on `.band`" | A container is a container for its **descendants** — `cqi` in the band's own `grid-template-columns` falls through to the viewport. Measured resolving to exactly the number the change existed to avoid. |
| "`grid-row: 2 / span 2` for the rails" | Right for five bands, wrong for the hero, which has no `.sec__head` and puts its rails in row 1. |
| "`grid-row: 2 / -1`" | `-1` addresses the **explicit** grid; the terminator's row is implicit. Rails stopped 317px short. |
| "Use `box-shadow: inset 0 -1px` for the heading rule" | Costs a print regression — inset shadows are dropped when "Background graphics" is off, and that hairline **is** the section separator on paper. |
| "Make every click change what the user sees" (theme toggle) | Not achievable. Three states over two renderings means one adjacent pair must repeat. The fix *moves* the dead press from press 1 to press 3, where landing on the same colour is correct. |
| "The clamp is why the header can't land" | It isn't. `line-height: 1` is, plus a 2px `.sec` top rule my arithmetic omitted. `7.797 = (2 + 77.797) mod 24`. |

---

## Instruments that lied

**This is the section to read before trusting any measurement.**

### The browser pane
- **Screenshots fail** most of the time ("the pane is not displayed, so the page is not
  compositing frames"). Occasionally works. Never rely on it.
- **`requestAnimationFrame` never fires** — GSAP tweens sit at `progress: 0`, the automata loop
  does not advance. Early on this produced a *false* accessibility finding: `data-theme="dark"`
  looked like it left colours stuck at 1.04:1, because the CSS transitions were pinned at
  `currentTime: 0`.
- **The automata's initial rebuild does not land either, and it looks exactly like a bug you
  just introduced.** Measured on a clean load of `index.html`: all 21 canvases keep either an
  early-layout bitmap (a rail 24px wide — the one-cell `max()` floor, i.e. measured before
  layout gave it its real width) or the browser's untouched 300×150 default. Nothing is wrong
  with the page. **Dispatching one synthetic `resize` corrects 19 of 21 to exact
  bitmap↔box agreement**, and the two that stay at the default are the case dialog's rails,
  which report a 0×0 box until it opens and which the engine's zero-box guard is *supposed* to
  skip. So: fire a resize before you measure any canvas here, and do not read a default-sized
  canvas as a regression.
- **The useful reads in this pane are all non-visual.** `getImageData` alpha-sampling proves the
  automata is drawing, and `getComputedStyle` proves the lattice resolved — neither needs a
  frame, a screenshot, or a working rAF. Prefer them to anything that has to composite.
- **Transition clocks stall, so a mid-transition read is meaningless.** A CSS transition can sit
  at its start value indefinitely here, which makes a correct rule look like it is not applying
  — it cost a false diagnosis twice, on the peek panel and again on the theme dial. **The
  decisive test is to remove the transition and re-read**: set `transition: none`, force a
  reflow with `void el.offsetWidth`, then read the computed value. If it resolves to the target,
  the rule is right and only the clock is stuck.
- **The viewport silently collapses.** A measurement once came back with the card grid reporting
  a single 205px column and `--text-sub` resolving to its *mobile* value on what was supposed to
  be a desktop pane. Every width-derived conclusion from that read was wrong, and it very nearly
  caused a type-size "fix" for a problem that did not exist. **Pin the viewport explicitly with
  `resize_window` before any width-dependent measurement, and print `window.innerWidth` beside
  the result** so a collapsed pane is visible in the output rather than inferred later.
- **Compare bitmaps to CSS pixels only after multiplying by devicePixelRatio.** A check that
  omitted it reported 0 of 23 canvases correctly sized; with `dpr = 1.5` applied it was 23 of
  23. The pane's dpr is not 1.
- **Viewport reported as 0×0 at one point**, which makes `IntersectionObserver` unable to fire at
  all — so scroll-triggered code is unreachable. The workaround that worked: run the *real
  shipped files* under stub DOMs in `vm`.
- **Real key events arrive** (`isTrusted: true`) — but `Enter` on a focused `<button>` delivers
  keydown/keyup without the browser's default click activation, and `PageDown` does not scroll.
- **`computer` ref-clicks silently miss**: the pane's coordinate space is CSS ÷ 3.6441, so a
  ref-click lands nowhere. Coordinate clicks work.
- **Will not go below ~353px** even when asked for 320.

### The type study, which lied four different ways
Built to compare two type ramps. Each failure looked like a finding:

1. **Injected after load** → GSAP `SplitText` had already wrapped every line in an
   `overflow:hidden` box sized for the old type. Line counts doubled; reported phase **6.891**
   where a clean load reports **0**.
2. **Injected too early** → landed *before* `tokens.css` in the cascade. Same `:root`
   specificity, last wins. Reported `loaded: true` and changed nothing, silently.
3. **Reload loop** → `f.addEventListener("load", apply)` while `apply()` set `f.src`. The frame
   strobed continuously. Entirely self-inflicted.
4. **Dead dev server** → navigation failures that looked like page errors.

The window that works: inject after `css/style.css` is parsed, before `document.fonts.ready`.

### The corpus digest
`scripts/build-vectors.mjs` joined chunk texts with a **literal NUL byte**, which renders as
`texts.join(" ")` in every editor, in `git diff`, and in a plain file read. Anyone reimplementing
the hash from the source computes a different digest, declares a current cache stale, and
`embedRank` silently returns the weaker lexical ranking behind answers that look identical to
semantically-ranked ones. (The two figures that used to sit here were a corpus out of date the
day they were written, which is its own entry below.)
Found by hex-dumping. Now an explicit `SEP = "\u0000"` with the reasoning attached — same bytes, visible.

**And then this document did the same thing, in the paragraph you have just read.** The sentence
above meant to *name* a NUL and instead *contained* one — a literal one between two backticks,
rendering as `` ` ` ``, which is precisely the symptom the paragraph describes. It shipped in
`cd20cc1`, the commit that created these handover docs.

The consequence is the part worth keeping. **One NUL in the first 8000 bytes makes git classify
the whole file as binary**, so every `git diff` of this file reported `-` `-` instead of line
changes. A 60-line rewrite of it in `2554611` was therefore invisible in review: that commit's
summary said "60 insertions", and every one of them belonged to `HANDOVER.md`. The log recording
that an invisible byte cost a silent 20-point retrieval regression was itself unreviewable for
exactly the same reason, and nothing caught it for four commits.

Two rules fall out of it:

- **A byte you cannot see needs a name in prose, not just in code.** Write the escape or the
  word — never the character.
- **`Bin N -> M bytes` in a commit summary, or `-` `-` in `--numstat`, is a defect report for a
  text file.** It is easy to read past, because the commit still succeeds and the content is all
  there. The only thing lost is the ability to review it.

### The environment
- **The Bash tool fails on this machine** (exit 1 on every call). Use PowerShell.
  *Update, later session: it works again, and it is the only way to write a multi-line commit
  message — PowerShell has no heredoc, so `git commit -F- <<'EOF'` is a Bash-tool-only move.
  Everything else still goes through PowerShell.*
- **PowerShell rejects commands containing control characters** — write a script to the
  scratchpad and run it instead.
- **PowerShell 5.1 wraps native stderr as errors**, so `git push` looks like it failed when it
  succeeded. Check the exit code, not the red text.
- **`git add -A` swept stray files into commits twice** — a study prototype and, worse, one
  agent's work into another's commit, leaving a commit message that did not describe its own
  contents. Stage explicitly.
- **`Set-Content -Encoding utf8` writes a BOM in PowerShell 5.1**, and a BOM breaks
  `JSON.parse`. This ruined a round of gate mutation-testing in the most misleading way
  available: every case "failed" with exit 1, which is what the test was looking for, so six
  mutations looked verified when the JSON had simply stopped parsing. Use
  `[IO.File]::WriteAllText($p, $s, [Text.UTF8Encoding]::new($false))`. **A mutation test must
  assert the failure REASON, not just a non-zero exit.**
- **A PowerShell script written as UTF-8 is read as ANSI by PS 5.1**, so every non-ASCII
  character in it is corrupted before it is used. This did two kinds of damage in one commit:
  every em dash inserted into four page heads shipped as mojibake, **and** a `.Replace()` whose
  search string contained an em dash silently matched nothing — so half of a fix never applied
  while the script reported success, because it checked that *something* had changed rather
  than that *both* changes had. The browser verification passed too, because it tested the
  outcome after load and the missing half was the pre-first-paint one. **Use Node for text
  edits**: it reads and writes UTF-8 without being told.
- **A regex with an optional `(?:<!--[\s\S]*?-->)?` group before its anchor deleted 273 lines
  across four pages.** The quantifier is lazy, but laziness does not stop backtracking: the
  engine took the leftmost start position that could match at all, which was the *first comment
  in the file*, and swallowed everything down to the target — document heads included. Caught by
  `build-content.mjs --check` on the next run and restored from git. **Anchor a destructive
  pattern on a literal that occurs once**, and guard the write: assert what must still be true
  afterwards and refuse to write if it is not. The guard on the retry was itself wrong — it
  asserted a region only some pages have — but it failed in the safe direction and wrote
  nothing.
- **Rewriting the same file in a tight loop** while Node still holds a mapped view throws
  `"The requested operation cannot be performed on a file with a user-mapped section open"`.
  Restore via `git checkout --` between cases instead, and never `git checkout` a file that has
  uncommitted work in it — commit first, then mutate.

### Subagents were unavailable for most of a session
Four consecutive subagent launches died to `API Error: 529 Overloaded` — two on one agent
(including a `SendMessage` resume that produced zero tool calls), two on a parallel pair — while
main-loop calls in the same minutes all succeeded. Resuming preserved context and cost nothing,
so it is still the right first move, but **after two failures stop retrying and do the work in
the main loop.** Keeping each commit scoped to one slice preserves the ownership record even
when one actor makes every edit.

---

## Process failures worth not repeating

- **Agent definitions in `.claude/agents/` are not loadable mid-session.** The harness reads them
  at startup. They were written, then had to be inlined into every brief for that whole session.
  They work now.
- **A spend limit killed four agents mid-wave.** All four resumed cleanly from their own
  transcripts via `SendMessage` — resuming preserved context and avoided redoing work. Restarting
  fresh would have duplicated a lot.
- **Numbers moved under approved prose, twice.** The owner approved three `/evals` corrections;
  ninety minutes later the eval re-ran and two were false again. The lesson that stuck: **figures
  must be placeholders, and qualitative claims must not be shaped so a re-run can falsify them.**
  "Tied for best in the table" has now broken three times and needs the *shape* removed, not the
  value corrected.
- **I planned a two-pass content build that was boundary-illegal** — `check-boundaries.mjs` bans
  `scripts/` from reading `evals/`, and it would only have passed through the M7 hole. Caught by a
  sequencing validator before any code was written. Run that validator on any multi-wave plan.

---

## Findings nobody's audit contained

These came out of doing the work, not from the audit documents.

- **T1** — `{"id": {"toString": null}}` is ordinary JSON and throws on coercion, reopening the M1
  stack-leak through *arguments* rather than the tool *name*. Fixed at six sites, not two.
- **T2** — the chat raced its corpus fetch against the SSE stream; when the stream won, every
  block was dropped and the reader was told *"nothing in the corpus backed it"*. A false
  provenance claim on the page whose entire claim is provenance.
- **T3** — the documented eval command silently skips the embeddings arms when keys live in
  `.env`, republishing the table without the 93.0% result.
- **The transport ate citations.** `api/chat.js` captured only `respond.input.blocks` and dropped
  the top-level `sources` field — a *required* schema property. The model was citing; the server
  threw it away, then a broken retry accepted the result anyway.
- **`list_experience` was fixed and three documents still called it a live bug.**
- **A "these figures are dated, on purpose" caveat aged better than the figures it defended.**
  `build-vectors.mjs`'s header quoted an embeddings-versus-BM25 pair. It went stale once when a
  corpus rewrite took the index from 76 chunks to 70; it was corrected, and gained a paragraph
  explaining that the pair was deliberately dated and that the reader should consult
  `evals/results.json` instead. Then the stopword list moved BM25 by 16 points and the pair was
  wrong for the third time. **A comment cannot interpolate, so the only figure it can hold
  safely is none** — the claim now names a direction and a significance test, which survive a
  re-run, and points at the generated artefact for cells. The same typed pair was living in
  `lib/knowledge/tools.js` in two places, already a corpus out of date before any of this.
- **Four agent charters had drifted from the repo**, and this is the worst class of stale doc
  here: not a number that moved, but an *instruction that causes damage if followed*.
  `design-system`'s hard rule #4 still ordered its agent to maintain `.rail { contain: size }`
  four commits after that property was deliberately deleted — it had to be corrected inline in
  every brief before the agent could be trusted with a task. `retrieval-core`'s exit gate was
  `node evals/run.mjs` without `--env-file=.env`, which is finding T3 written down as an
  instruction. `api-security` carried a standing licence to write another slice's file, granted
  for one change in one wave that had long since landed. `evals` typed a figure ("43 questions,
  ±16–27pp") in the same rule that forbids typing figures.
- **The wrong numbers were shipping.** Four bad contrast figures in `tokens.json`'s `$doc`
  prose were emitted into `dist/tokens.css` as comments and served to models by
  `get_design_system`. A `$doc` is not internal documentation — it is published in three places.
- **The prompt described a gate that no longer existed** — it told the model `search_content`
  "returns zero results" on a miss, on every request, months after that stopped being true.
- **Prompt caching was never requested.** `cache_control` was never set, so
  `cache_read_input_tokens: 0` was a tautology. The real prefix was 4,680 tokens — already over
  the 4,096 minimum. And enabling it would have silently stopped billing ~4.8k tokens per
  conversation to the daily budget, because cached tokens report outside `input_tokens`.
- **No script may change the page's flow layout, and the rule was bought twice.** js/automata.js
  derives every band's terminator slack from the DOM it finds at run time; when js/peek.js's
  tap mode began injecting card triggers and collapsing the notable cards on touch, every
  band below Selected work slid off the 24px lattice — the owner saw squares disagreeing
  with the graph paper. The first fix reordered scripts and dispatched a synthetic `resize`
  after mutating: a patch, and the owner called it one. The real fix removed the mutation —
  the triggers are authored in the cards by the content build, the peek sheet is authored in
  index.html beside the drawer, CSS decides visibility, and peek.js wires without creating.
  The invariant that survives: **the page's geometry after scripts is its geometry before
  them.** Anything that needs structure puts it in markup; JS toggles attributes.
- **The second lattice slide had nothing to do with scripts: the scroll lock itself moved the
  page.** A classic scrollbar occupies ~15px of layout, so any overlay's `overflow: hidden`
  handed that width back — measured, the sheet shifted 4.33px left and grew 24px under every
  body lock, with **no resize event fired**. Open→close restored it exactly, so the defect
  needed a third ingredient: a real resize landing *while* locked (devtools moving, rotation,
  the mobile URL bar) baked the scrollbar-less geometry into the automata's phases, and
  closing the overlay left every canvas a few px off the paper — worst far down the page,
  where re-wrap deltas accumulate, which is why the owner saw it "only under Selected work".
  Fixed structurally with `html { scrollbar-gutter: stable }`: the gutter is reserved whether
  or not the scrollbar draws, so every lock (is-locked and the `:has()` locks) is now
  layout-neutral — verified by resizing mid-lock and measuring zero drift after close. The
  rule: **a scroll lock that changes the scrollbar's layout contribution is a resize nobody
  is told about.**
- **The lattice saga's closing move was to stop enumerating shifters.** After fonts (handled),
  injected structure (removed), and the scrollbar toggle (neutralised), the owner could STILL
  reproduce a slide on every fresh warm reload that any resize healed — proof that layout
  keeps settling after the engine's last rebuild through paths nobody has listed yet
  (measured: a 2.2px Contact delta with the whole enumerated list already fixed). The engine
  now watches its own lattice root with a **ResizeObserver feeding the same debounced rebuild
  a resize uses**: any layout change from any cause re-measures automatically, and it
  converges because a rebuild against unchanged layout writes unchanged slack. Verified:
  fresh load self-settles with no synthetic resize, and consecutive rebuilds are byte-stable
  (624 → 624 → 624). The instrument lesson beneath it: every earlier pane verification
  OPENED with a synthetic resize (the pane's own canvas-trap workaround) — which silently hid
  every fresh-load defect. **A workaround baked into the measurement ritual becomes a blind
  spot in exactly the shape of the workaround.**
- **The div model proved its own thesis while being replaced.** An intermediate measurement read
  556 squares at 61.8% of the DOM — taken with the old engine running against the new CSS, where
  `contain: size` had already gone. It immediately rebuilt the feedback loop that property
  existed to stop.

---

## Gates that could not fail

Three found in one pass, all the same shape: something that reports success forever.

- **`api-security`'s exit gate used `console.assert`.** In Node that logs and returns — it does
  not throw and does not set an exit code. Measured: `node -e "console.assert(false)"` exits
  **0**. Two thirds of that agent's gate could not fail however broken the handlers were.
- **`check-css` rule 6 was the good case**, and worth keeping in mind as the counter-example: it
  went red the day the constants it read were deleted, which is the only reason the DOM budget
  got re-derived instead of quietly disappearing. Every gate written since carries the same
  property deliberately — if it can no longer find its subject, it fails rather than passes.
- **A gate can be blind in a direction you did not test.** The doc-arithmetic gate's first
  version checked the geometric ratio of the static type ramp, which depends only on its
  endpoints, so moving an interior step sailed through — the very "no gate enforces a scale"
  failure it was written to fix, reproduced inside itself. Found by mutation, not by reading.

Two related notes for anyone mutation-testing a gate here:

- **Gate ORDER masks mutations.** Anything that adds a token or a value trips the counts gate,
  which runs earlier, so the later gate never executes and the case is inconclusive rather than
  passed. Two doc-arithmetic claims are unverifiable in isolation for exactly this reason. That
  is defence in depth, not a hole — but do not record it as a verified case.
- **Write the mutation cases expecting some to be wrong.** Of nine written for rule 6, two
  passed when they should have failed, and both fixes made the gate materially stronger. Of the
  doc-arithmetic set, one did the same. A mutation suite where everything behaves first time
  probably is not testing much.

## The one structural lesson

Four audits verified that the documentation matched the code. It did. **Nothing verified that the
documentation matched the arithmetic**, and that is where every remaining problem was hiding —
a type scale with a gate enforcing "every size is a token" and no gate enforcing "the tokens form
a scale".

The repo's own doctrine, which it had already written down and not applied to itself:

> Every number in a document is interpolated from the artefact that produced it, and every
> invariant either gets a check or gets deleted.
