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

---

## The contract-gaps + second-site programme — what got in the way

Eight phases, one session. The shape was the same as before: slice-scoped agents, barriers
between phases, `check-boundaries.mjs` doubling as the check that nobody reached out of their
lane. What is recorded here is only the part a fresh session would otherwise rediscover.

### A gate that had quietly grown a browser

`npm test` had been building Storybook and downloading Chromium for weeks, inside a gate
whose whole contract is *offline, browser-free, a few seconds*. Nobody added it. Node's
default test discovery includes `**/test-*.?(c|m)js`, and **that glob is not rooted at
`test/`** — it matches any depth, anywhere in the repo — so
`design-system/scripts/test-storybook.mjs` joined the suite on the day it was created, purely
because of its name.

The tell was not a failure. It was that `check` had got slow: 46s where it used to be
seconds. A gate getting slower is a symptom nobody triages.

Three things are worth carrying forward:

- **The obvious fix is wrong.** `node --test test/` works on Node 20 and 22 and on **24 runs
  zero tests and exits 1** — 24 reads a positional as a glob, `test/` matches no file, and the
  runner tries to execute a module called `test`. The glob form `'test/**/*.test.js'` is the
  mirror image: fine on 24, unavailable before 21, and CI pins 20. `node --test <file> <file>`
  is the only portable form, which is why there is a `test/run.mjs` at all.
- **A runner that finds nothing must never exit 0.** Every glob form that matched no file
  reported success. That is a green suite that ran zero tests — strictly worse than a red one.
  `test/run.mjs` refuses to report success on an empty list, and `test/ci.test.js` rebuilds
  the list from the directory and demands agreement.
- **Fence it *and* remove it.** The runner made `npm test` safe; a bare `node --test` typed at
  the repo root was still broken, and that is what a contributor actually types. The harness
  was renamed (`test-storybook.mjs` → `storybook-gates.mjs`) so nothing in the repo answers to
  the pattern any more.

`check` went 46s → 6.4s; the suite 39.4s → 3.0s.

### An allowlist entry outliving the file it excused

`test/ci.test.js` carried the Storybook harness by name, in a map of "not a test despite the
name". When the file was renamed, the entry should have become dead weight — instead the
**staleness half** of that assertion went red on the next run and named the entry. That is
the property to copy: an exemption that cannot notice its own subject disappearing is an
exemption that outlives its reason forever.

### The router changed what the ports were standing on

`apps/next`'s internal links became `next/link`, which is as close to a no-op as a change
gets: `<Link>` renders an `<a>`, so every design-system class and attribute is the string it
was, and the only difference anywhere in the export was attribute *order* on hash-only links.

The substance was somewhere else entirely. **A client transition keeps the root layout and
replaces `{children}`** — which is where the bar, the menu, the drawer, the fab and the cards
live. Every element the ported listeners had bound to is detached afterwards. Without
re-initialising on `usePathname()`, the commit ships a page whose menu opens exactly once and
whose cards peek only until you visit a case study. Nothing in the diff looks like that; it
was found by driving the static export in Chromium and checking that a window marker survived
a round trip.

**The general form:** a change that is provably markup-neutral can still be lifecycle-fatal.
Ask what the change does to *element identity*, not just to output.

### `.vercelignore` removes a file from the UPLOAD, and that cuts both ways

The second site's source tree was one deploy from being public. The vanilla project has
`outputDirectory: "."` and `buildCommand: ""` — **whatever is uploaded is served, verbatim,
with no build step in between to leave anything behind** — so `apps/next/src/**`,
`next.config.mjs`, `tsconfig.json` and the lockfile would have been fetchable at
`/apps/next/…`. A CLI deploy would have added `out/` on top: a stale duplicate of the entire
second site on the wrong domain. (A Git deploy would not, because `out/` is gitignored, which
is its own reason not to leave the two deploy paths differing.)

Adding `/apps/` fixed it and created the risk that is now the second project's first
configuration step. That project needs *"Include files outside the Root Directory"* ON — three
of its four inputs live above `apps/next` — and with that setting on, the build context is the
whole repository, so this same file is **plausibly read by that project's upload as well**, in
which case `/apps/` excludes that project's own source from its own build.

It cannot be patched from the root file: **gitignore semantics do not allow re-including a
path whose parent directory is excluded**, so a trailing `!/apps/next/` does nothing. The
escape hatch that looks available is not. Confidence in the risk is medium-high and it is
**untested**, because testing it requires creating the project — so the runbook makes a
preview deployment the mandatory first step and says exactly what the failure looks like.

The rule underneath, which that file already states about `content/dist/vectors.json` and
about `/test/` and `/scripts/`: **before excluding anything, check whether a function, a page
or a script reads it at runtime** — `.vercelignore` removes it from the upload, and
`functions.includeFiles` cannot bring back a file that was never uploaded.

### Pin ahead of the scaffold, and check the pins with a second mechanism

`apps/next`'s slice rule and its first crossings were written **before the app had a file** —
"a rule written after the first import is a rule negotiated with the code it is supposed to
govern". That worked, and it has one failure mode: a pin whose `../` count is wrong resolves
somewhere harmless, matches no ban, and **passes while asserting nothing**. A pin that proves
nothing is worse than no pin, because it reads like coverage. `CROSSING_SURFACES` — every
resolved crossing must land on a published surface — is what catches it, and it caught two
miscounted fixture cases while it was being written.

The other half arrived a phase later, and the gap is the interesting part: section 3 proved
every pin was still *legal*, and **nothing proved every crossing was still pinned**. A sixth
stylesheet could have arrived into silence. The census test now reads
`sync-artifacts.mjs`, resolves every literal the way the gate would, and requires each one
that leaves the app to appear in `CROSSINGS`.

### Two documents that were false for exactly as long as nobody re-read them

- **`ARCHITECTURE.md`'s "honest gap" paragraph** described a hole that `d67a2bf` had closed —
  four commits of the repo's most-read document telling readers that a hand-edit to
  `dist/tokens.css` would be silently overwritten, when the drift gate had started catching
  it. The document was *right when written*, which is the whole failure mode: prose describing
  a gap does not know when the gap is filled.
- **`README.md` published `yordan-design-system.vercel.app` as "Storybook".** It serves this
  portfolio — checked from outside: `/cv` resolves there and `/index.json` 404s. It is a second
  domain on the vanilla project. Nobody mistyped anything; a link was written for a plan and
  the plan did not happen, and a URL that returns 200 never looks stale.

**The instrument lesson: `curl` the claim.** Both of these were cheap to check and neither had
ever been checked, because both *look* verified — one sits beside a gate, the other returns
200.

---

## The architecture revision, the copy pass and the push — what got in the way

The era after Phase 8: components became contract-first, the owner's words arrived, and
everything went to production. Same rule as above — only what a fresh session would otherwise
rediscover expensively.

### A class attribute has no order, and it is the deepest thing this repo has learned about
### the two pipelines

The pilot generated a Tailwind + React tier from the same definitions as the CSS, and the
components *rendered wrong on the second surface only*. `Button variant="solid"` came out as
dark ink on a dark fill exactly where the hero call to action is — rgb(20,21,24) against the
vanilla page's rgb(245,245,244) — and `size="small"` rendered at base metrics, 102×46 against
81×36.

The cause is one sentence and it is not obvious: **`cva` concatenates base and variant classes
into one `class` attribute, a class attribute has no precedence, CSS resolves the pair by
stylesheet order, and Tailwind decides stylesheet order by sorting class names.** Every
override in the pilot happened to sort *before* the base class it had to beat —
`px-space-3` before `px-space-5`, `text-content-inverse` before `text-content-primary`,
`hover:bg-action-hover` before `hover:bg-primary`. `Chip` worked, and worked only because its
names sort the other way. **A component library that works by alphabetical luck is a component
library that will break on a rename.**

Three things about the fix are worth carrying:

- **Disjointness, not weight.** No `!important`, no `tailwind-merge`, and not one byte of the
  definitions — they stay transcription-faithful. Every emitted class reports which CSS
  *longhands* it writes, shorthands expand, and a base class writing a longhand an axis owns
  is moved into that axis's `default` branch. Exactly one of the two is then ever present.
- **The collision is between properties, not between class names.** Chip's base
  `border: 1px solid var(--chrome-border-strong)` and its variant's `border-color` are two
  names for one declaration, and nothing that compares class strings can see that.
- **Refuse rather than choose.** Two axes writing the same property cannot be made disjoint,
  because both apply at once and `cva` has no ordering between them. The build fails naming
  both branches and the property. Which should win is not an emitter's decision.

The same commit found the sibling of it: Tailwind's `hover:` wraps in `@media (hover: hover)`
and `components.css`'s `:hover` does not, so **the two pipelines disagreed about every hover
state in the system on a coarse pointer**. The media query may be the better behaviour. It is
still not the emitter's to invent — if it is right it is right for both surfaces, so it is a
definition-format question filed for one commit that moves both.

### Reduced motion, and a `*` selector that turned a settle pass into an oscillator

The page's bands oscillated at ~5Hz, for as long as they were open, **under exactly the
preference that asks for stillness** — and the first symptom was a ~4px cross-site offset at
`.idx__tags` that only existed under reduce, because both surfaces inherited it out of phase.

The cause is boilerplate almost every reduced-motion block in the world contains:
`transition-duration: 0.01ms` on `*`. `transition-property` defaults to `all`, so every
`--term-slack` write became a height tween whose progress was still 0 for the rest of the task
that wrote it. The terminator pass then measured the *previous* pass's layout instead of the
one it had just reset — `S(n+1) = f(S(n))` with no fixpoint.

Two layers were fixed, because they answer different questions. The stylesheet says `0s`: the
block means "in no time", and the only thing `0.01ms` buys is a `transitionend` nothing here
waits for. And the pass stopped trusting any stylesheet — it pins `transition: none` on the
one element it writes, for exactly the duration of the pass.

**The general rule: a universal `transition-duration` breaks any write-then-measure code in
the document, and it will look like a bug in the measuring code.**

### A scaffold emitted a dead format for a whole phase, and no gate could see it

`scripts/new-component.mjs` kept writing `base: { declarations: […] }` for a phase after
definitions became one ordered list. Nothing failed. The reason is the useful part: **every
gate that understands the format lives on the far side of the scaffold actually being run, and
a dry run never gets there.** A generator's *output* was unexercised even though the generator
itself was tested.

It was found by a human noticing that the loader had been special-casing the shape by hand. The
fix is the shape of the repair worth copying: `test/scaffold.test.js` now runs the design
system's own loader over the dry-run bytes — spawned as a process, because the boundary gate
makes `design-system/scripts/` private and spawning a slice's entry point is how every other
consumer already reaches it. In the same file, three `def.variants ?? []` reads were pointing
at top-level sections that had stopped existing, so a coverage assertion had become **vacuously
true**: the selector set was the root and nothing else. It now reads the list and asserts it is
non-empty, because an empty list must not report coverage.

### The suite ran on the developer's Node, not on CI's

147 green locally, two failures on ubuntu, and neither was a platform difference:

- `test/ci.test.js` opened with `import { globSync } from "node:fs"`. That export arrived in
  Node 22; the workflows pin 20. The module raised `SyntaxError: … does not provide an export
  named 'globSync'` **before one assertion in it ran** — so *the file that checks the gates was
  the one file that never loaded*, and nothing said so.
- `test/budget.test.js`'s abort-signal lock had nothing holding the event loop open, because
  `AbortSignal.timeout()`'s timer is unref'd. On 20 the loop drained first and the runner
  reported "Promise resolution is still pending but the event loop has already resolved",
  cancelling that test **and the two after it**.

Both are the same class: a version-dependent behaviour that is invisible on the machine you
are typing on. The guard added is `ARRIVED_IN` — a list of builtin exports newer than the
pinned Node, which fails any gate that imports one, **compared against the pin rather than a
hard-coded 20**, so raising `node-version` retires an entry rather than orphaning a rule. And
the verification was done the only way that settles it: docker on `node:20` linux *and*
Windows on 24.

### Do not widen a gold set inside the commit that freezes a floor

The copy pass restored six Spetema sections an earlier rewrite had killed, and five questions
were left scored against a gold set narrower than the corpus supported. `cross-b2b-b2c` was
marked wrong by *every* arm while both ranked arms returned `project:spetema#subtitle` —
"reconciling B2C e-commerce and B2B corporate needs on a single coherent site", the question
almost word for word. **The retriever was right and the ground truth was wrong.**

Widening a gold set raises hit@k. Doing it in the same commit that re-cuts the baseline is
therefore indistinguishable, in the artefact, from tuning — which is the one shape the eval
charter exists to stop. So it was **escalated instead of fixed**, written up for the owner,
approved on a date that is on the record, and landed *alone*, by a rule that is mechanical and
checkable against git: gold becomes the UNION of each question's pre-rewrite and current sets,
with `git show <sha>:evals/questions.json` named as the state the union was taken against.

Two details generalise. The count was **five, not the four that were escalated** — one question
was filed under REWORDED rather than REPOINTED and did not surface when the count came off the
`why` notes, so a category boundary hid a member of the set. And one restored id puts an echo
of a heading back within BM25's reach, on a question that was deliberately worded *away* from
that heading; the wording did not move back, so the protection stands, but it is written down
rather than left for someone to rediscover as a mystery.

### A significant result stopped being significant, and that is the honest outcome

`embeddings vs bm25` was p=0.0386 before the re-widen and is **p=0.0654** after it: the
correction helped BM25 more than embeddings, 9–2 on eleven discordant questions. The
comparison this entire suite exists to make is no longer separated at 95% by these 49
questions.

The reading that is correct and the reading that is tempting are different sentences.
**"This set cannot detect a difference"** is what the data says. *"The arms are equal"* is
what it does not say, and publishing the second would be the same error as publishing a
flattering one. Nothing was tuned, no threshold moved, and the remedy is arithmetic rather
than engineering: more questions. It shipped with the p-value attached.

### A census that could only prove its own good half

`components.css` had eleven byte-compared generated regions and fifteen blocks that were
simply *whatever was in the file* — and that is the wrong way round while the authored set is
the one that is shrinking. Every block now carries a marker naming which half it is in, and an
authored one carries a **reason from a closed vocabulary**. The build asserts three things:
every block is exactly one kind, the reason is in the vocabulary, and **the scan finds that
feature in the block** — so a reason that has stopped being true is a block that should now be
a definition, and the build says which one.

The design decision inside it is the one to copy: the check asserts **presence, not
disqualification**. Proving that a block *cannot* generate would mean re-implementing the
schema inside the census, and a census that re-implements the emitter agrees with it by
construction — which is exactly the trap `dist/components.json` is kept out of by being parsed
from the shipped CSS.

Two of the vocabulary's original entries were wrong and were replaced by doing the work:
`at-rule` became `unnamed-condition` (an `@media` whose query has a *name* generates fine;
what disqualifies is a condition the system cannot name), and `computed-geometry` disappeared
entirely once `expr` landed — the arithmetic was never the problem, an unreadable `var()`
inside a string was.

**And the census immediately caught this document counting it wrong.** Writing the handover,
the generated/authored split was obtained by grepping the markers in `components.css` — which
gives *"14 generated, 13 authored"*. The gate says *"26 blocks: 13 generated, 12 authored, 1
split"*. Both readings are of the same file and only one is right: a **split** block
contributes a marker to each half, and one generated region is typography, which is not a
component at all. The number was in a draft for about ten minutes.

That is the repo's own doctrine catching the person writing the repo's own doctrine, so it is
worth stating as a rule rather than an anecdote: **a marker is not a count, and a grep is not
a gate.** `node design-system/scripts/build.mjs --check` prints the census; anything derived
from the file by hand is a second implementation of the census that nobody tested.

## The one structural lesson

Four audits verified that the documentation matched the code. It did. **Nothing verified that the
documentation matched the arithmetic**, and that is where every remaining problem was hiding —
a type scale with a gate enforcing "every size is a token" and no gate enforcing "the tokens form
a scale".

The repo's own doctrine, which it had already written down and not applied to itself:

> Every number in a document is interpolated from the artefact that produced it, and every
> invariant either gets a check or gets deleted.
