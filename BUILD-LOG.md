# Build log — content pipeline, retrieval, and an assistant

Raw material for a case study. Written during the build, not reconstructed afterwards.
Everything here is traceable to a commit, a measurement, or a failure that actually
happened. The interesting parts are the places the plan turned out to be wrong.

> **Read this as dated, not as current.** Every figure and every count below describes the
> state of the repo at the phase it sits under, and several have moved since — Phase 1's six
> tools are eight, the question set has grown, and one argument recorded here as settled has
> since been withdrawn (see *"The gate that didn't work"*). Corrections are appended in place
> rather than edited into the original, because a build log that is quietly updated stops
> being evidence of anything. For what is true **now**, `ARCHITECTURE.md` and the per-slice
> `CLAUDE.md` files are the live documents.

**Branch:** `feat/content-pipeline` · 7 commits · not yet merged to `main`.

---

## What existed before

A static portfolio site with no build step, plus the design system it runs on, in one
repo. Two pages, 17 components, 59 tokens carrying 106 values across light/dark/print.
Vanilla HTML/CSS/JS, no framework, GSAP vendored.

The design system already had one discipline worth copying: **tokens are born in
`tokens.json` and everything else is an output.** A zero-dependency script generates the
CSS the site loads, and the build fails if a component is missing any of its three legs.

Content had no such discipline. ~4,500 words of prose lived in three places at once:

- Six projects each had **three independent descriptions** — the index row, the case-study
  subtitle, and the body opening. Studio Kipo work had a fourth on the CV.
- Tag vocabularies diverged: the chips on the index row and the chips in the case study
  were different strings for the same project.
- Skills were 6 groups on the site and 5 differently-worded groups on the CV.
- The three "unexpected facts" disagreed on a label — "Heaviest lift" vs "Heaviest deadlift".
- The system's own statistics were asserted verbatim in three files and policed by a
  string-matching linter, which existed *because they had gone stale twice in one session*.

---

## What was built

| commit | |
|---|---|
| `0b8c04e` | Content pipeline — one source of truth for every word |
| `a23e26c` | Retrieval tool core + eval harness |
| `299b67c` | Chunk-id uniqueness fix |
| `9b14d9a` | Root `package.json` + `vercel.json` |
| `9ccafc9` | Embeddings eval arm |
| `579e613` | Remote MCP server |
| `5d18dbc` | Chat assistant |

**Phase 0 — content pipeline.** Content authored in `content/` as JSON frontmatter plus
Markdown bodies with `{#kind}` section slugs. No content file contains raw HTML.
`scripts/build-content.mjs` compiles it into `js/case-studies.js`, 18 marked regions across
both pages, a retrieval index, JSON-LD and `llms.txt`. The counts linter became a
*generator*: the design-system build now emits its own statistics and the prose
interpolates them, so the numbers have exactly one source.

**Phase 1 — tool core and evals.** Six tools with strict schemas over the content index,
plus the answer-block schema and its validators. An eval harness measuring retrieval
across four arms — free, offline, no API key, runs in CI.

**Phase 2 — MCP server.** The same tool core exposed over remote MCP so anyone can add the
portfolio to their own Claude Desktop or Claude Code.

**Phase 3 — chat assistant.** A server-side agent loop that returns structured blocks
rendered as real design-system components, not markdown.

---

## The reversals — where measurement beat intuition

This is the part worth writing up. The plan made four confident claims. Measurement
overturned or narrowed **all four**.

### 1. "Structured lookup ranks better than search" — wrong

The plan argued that because `get_project(id)` cannot mis-retrieve, structured navigation
beats search on a corpus this small. The eval:

```
arm             hit@1   hit@3     MRR   abstain
tools-only      39.5%   51.2%   0.499     72.7%
bm25            46.5%   74.4%   0.613      0.0%
```

BM25 won by 23 points, and the gap was **widest exactly where the plan claimed tools would
win** — skills 75% vs 25%, cross-cutting 87.5% vs 50%.

The argument was true and irrelevant. Reading the right project was never the hard part.
*Choosing* it was.

### 2. The planned hybrid was the worst arm of all

"Tools first, BM25 as fallback" was in the approved plan. Measured, it scored *below BM25
alone* (58.1%) and abstained on nothing — it inherited the structured arm's ranking and
BM25's credulity. **It would have shipped unmeasured.**

### 3. "No vector database, therefore no embeddings" — half right, and the half that was
wrong was the important half

Once a Voyage key was available:

```
arm             hit@1   hit@3     MRR   abstain
bm25            46.5%   74.4%   0.613      0.0%
tools-gated     41.9%   67.4%   0.551     72.7%
embeddings      86.0%   93.0%   0.902      0.0%
```

100% on skills, cross-cutting and metrics. hit@1 nearly **double** BM25's. It did not lose a
single retrieval category.

The plan had collapsed two separate claims into one argument:

| claim | verdict |
|---|---|
| Don't provision a managed vector **database** | **Correct, and now demonstrated.** 76 vectors sit in a committed JSON file — no service, no index to rebuild, nothing billing at idle. "A vector DB at this scale is a JSON array" was exactly right. |
| Therefore lexical retrieval is sufficient | **Refuted by ~19 points of hit@3.** This never followed. It was a different decision smuggled in on the same argument. |

The latency objection was real but got *priced*: one round-trip to embed the query buys
+18.6pp hit@3.

### 4. "The manifest will enable prompt caching" — doesn't

The plan claimed a corpus manifest in the system prompt would carry the prefix over Haiku's
4,096-token minimum cacheable length. Measured: the manifest is 4,323 characters ≈ 1,100
tokens, and the whole prefix lands at ~2,600–3,100. Live traffic confirms
`cache_read_input_tokens: 0`.

The tempting fix was padding the prompt to clear the bar. That was refused — it is the
false economy the plan itself argued against one paragraph earlier, and at ~$0.003/turn the
entire question is worth fractions of a cent. **Better to lose a benefit honestly than to
inflate a prompt to claim it.**

### What survived

Abstention. Embeddings abstain on 0 of 11 unanswerable questions, identical to BM25 —
semantic similarity finds a confident nearest neighbour for "did he work at Google?" just as
readily as term overlap does. So the shipping design is:

> **The entity gate decides *whether*. Embeddings decide *what*.**

> **Correction, appended later.** That is no longer the shipping design. The gate was moved
> *above* the tool: `search_content` returns its full ranking with a coverage verdict
> attached (`gateMatched`, `gateScore`, `note`) and refuses nothing. Two measurements forced
> it — the gate was refusing answerable questions including *"Where is he working at the
> moment?"*, and collapsed to a boolean inside the tool it discarded the entity it had just
> identified, so it could only ever refuse and never re-route. The verdict is now a signal
> the *caller* weighs. Read `lib/knowledge/gate.js`'s header for the current shape, and treat
> the `tools-gated` and `gated-embeddings` rows below as **counterfactuals** — they price
> what refusing on a gate miss would cost, and they no longer describe production.

---

## The moment the architecture proved itself

Asked *"Did he work at Google?"*, the assistant answers:

> No, Yordan has not worked at Google. His employment history spans Green Street, Studio
> Kipo, Domestina, Live to Lift, CNCsys, and independent work.

The trace shows the model **invented five citations** getting there —
`experience:green-street#outcome` and four siblings. The provenance gate stripped all five
and dropped the emptied block, reason: *"no cited chunk was returned by a tool call this
turn."*

That is the difference between an architecture that prevents hallucination and a prompt that
asks nicely. The model misbehaved exactly as predicted, and the mechanism caught it.

Three gates run server-side before anything reaches the browser:

1. **Schema** — non-prose blocks carry ids, not prose. The model cannot type a date it isn't
   allowed to type.
2. **Referential** — every id must resolve in the content index.
3. **Provenance** — every cited chunk must have been returned by a tool call *this turn*.

`prose` is the only block carrying model-authored text. Everything else references content by
id and the client renders from the index. The model composes; it does not restate.

---

## Hiccups — what actually went wrong

### Process

- **A plan was marked approved that the author had never read.** The harness reported
  approval after an interruption; work started on that basis. Caught before any file was
  written, but it is a real failure mode of agentic workflows: *approval signals are not the
  same as informed consent.* The fix was to stop, verify nothing had changed, and put the
  plan in front of a human.

### Infrastructure

- **Four agent deaths.** One stalled mid-stream; three hit a monthly spend limit. All four
  were resumable from transcript with no work lost — but only because each agent was told
  to *stop and report rather than work around*, and because completed work was verified
  before resuming rather than redone.
- **Both parallel worktrees were created at the wrong base** — pre-Phase-0, without
  `lib/knowledge/`, `content/` or `scripts/`. Both agents noticed and reset themselves.
  This is the most dangerous bug in the log: an agent that *didn't* notice would have
  reimplemented the tool core from scratch, produced something plausible in isolation, and
  been wrong on merge.

### Correctness

- **BM25 tokeniser kept punctuation.** 171 of 1,209 terms ended in a full stop, and
  `analytics` and `analytics.` were stored as separate terms — splitting document frequency
  and silently missing every chunk where a word ended a sentence. Fixed by trimming
  *trailing* punctuation only: `200+`, `1:1`, `2.1`, `p5.js` and `tokens.json` are all
  meaningful tokens in this corpus and a naive strip would have destroyed them.
- **Chunk ids were not unique.** Ids were `entity#kind`, and kinds repeat within a project —
  6 of 76 collided. A citation therefore identified a section *kind*, not a passage, which
  quietly weakened the provenance gate. Fixed with ordinal suffixes.
- **A stale eval label, hidden by that collision.** Fixing the ids made the eval regress.
  Investigation showed the ground truth was wrong, not the retrieval: a question about
  deployment pointed at "The system" when the answer is in "The pipeline". **The label had
  been wrong before the rename and the collision was masking it.** Correcting it made the
  question stricter, not looser. Six other affected questions were checked against what each
  section actually says and left alone — the temptation to adjust labels until the score
  recovers is exactly the trap an eval exists to avoid.
- **The eval was accidentally key-dependent.** The embeddings arm gated on
  `VOYAGE_API_KEY` rather than on the vector cache, so a keyed run wrote five arms and
  `--check` in CI recomputed four and called them stale. CI would have failed on every
  commit. The cache is what makes the arm reproducible offline, so the cache is what the
  gate now asks about.

### Merge

- **A near-miss on README.** Phase 3's branch predated Phase 2's, so copying its `README.md`
  wholesale would have silently deleted the MCP section. Avoided by copying only *source*
  files and re-running the generators — which had the side benefit of proving the pipeline
  cascades a component-count change correctly through four generated files.
- **Shared scaffolding had to land first.** Both backend phases needed `package.json` and
  `vercel.json`; two worktrees each inventing them is a guaranteed conflict. Landed on the
  base before dispatch.

### The gate that didn't work, and the test that passed for the wrong reason

**Closed since.** The entity gate was built inside `api/chat.js`, because `lib/knowledge/`
had been declared off-limits to both parallel agents so they could not collide in it. The
consequence: the web chat refused "did he work at Google?" and the MCP server — same tool,
same corpus — served the ungated arm to anyone who added it to their own Claude. **A scoping
decision taken for merge safety became an architectural defect**, and the slice's own
`CLAUDE.md` already forbade it in as many words.

Moving it into the core exposed something worse. **The gate did not actually work on its
headline case.** `"did he work at Google"` *opened* it, because Studio Kipo's descriptor is
*"sole designer for all client work"*, so the token `work` sat in that entity's name surface.

Production had been refusing the question by luck: the model happened to call
`list_experience` rather than searching. **The end-to-end test passed and proved less than it
appeared to** — the strongest evidence in this log that a green test is not the same as a
working mechanism.

The fix was principled rather than tuned. A descriptor is a *sentence*, and the gate's
contract says it matches names and never bodies. Excluding it added no parameter, so nothing
could have been fitted to the question set.

```
tools-gated   abstain 72.7% → 90.9%   separability 0.869 → 0.920
              hit@3 67.4% (unchanged)
```

> **Correction, appended later — the last sentence of that paragraph is wrong, and it is the
> most instructive error in this log.** "Excluding it added no parameter, so nothing could
> have been fitted" is a non-sequitur. **Parameter count is not the definition of
> overfitting.** The exclusion was decided *after* watching `oob-google` fail, and a discrete
> structural choice selected by observing the evaluation set is test-set fitting whether or
> not it adds a constant. The principled argument for it is still sound on its own — it was
> simply constructed after the failure rather than before, and at the time only the first of
> those two facts got written down. That is exactly how a defence becomes load-bearing
> without ever being checked: it was true-sounding, it was written in a document nothing
> gates, and it was quoted onward into two other files. `lib/knowledge/gate.js`'s header and
> `evals/CLAUDE.md` now carry the concession; `lib/knowledge/CLAUDE.md` carries the list of
> what *can* honestly be claimed instead.

### A trap in the same change

Making `search_content` gated would have silently gated the eval's `bm25` arm too, since it
called the tool — turning the ungated baseline into a second copy of `tools-gated`. The
published table would have compared an arm against itself and shown a flattering,
meaningless result. The arm now calls raw `search()`, and `tools-gated` imports the *shipped*
gate rather than approximating it.

### Shipping the measured winner — and measuring what actually ships

Embeddings won the eval, so they became the ranker: chunk vectors are built once by
`scripts/build-vectors.mjs` and committed, and a query is embedded per request with a 2.5s
timeout and a BM25 fallback. Degraded ranking is a far better failure than a dead endpoint.

But gate + embeddings was a combination **no row of the table described**. A deployed
configuration that appears in no measurement is exactly the unmeasured claim the suite exists
to prevent, so it got its own arm:

```
arm                 hit@3   abstain    sep.
bm25                74.4%      0.0%   0.837
tools-gated         67.4%     90.9%   0.920
embeddings          93.0%      0.0%   0.832
gated-embeddings    79.1%     90.9%   0.920   ← what shipped at the time
```

> **Correction, appended later.** The arrow was true when it was written and is not now: the
> gate stopped filtering, so what ships is the **ungated** embeddings ranking with a coverage
> note attached. `gated-embeddings` is a counterfactual row. The reasoning in the paragraph
> below — that a deployed configuration appearing in no measurement is the unmeasured claim
> the suite exists to prevent — is the part that survived, and it is why the ungated arm is
> still in the table.

The shipped arm beats the old gated arm by **11.7pp with identical abstention**, and gives up
13.9pp against ungated embeddings to buy refusal. Both gated arms reach **100% on
out-of-corpus and structured-only**.

The cost is visible and worth naming: the gate matches entity *names*, so *"how far has he
run?"* is refused even though "42 km. Marathon finisher." is in the corpus. Recall paid for
refusal. That is the trade, stated rather than hidden.

---

## Numbers

| | |
|---|---|
| Prose consolidated | ~4,500 words, 3 sources → 1 |
| Content files | 14 projects, 6 experience entries, 5 data files |
| Retrieval index | 76 chunks, 1,112 terms, 183 KB |
| Corpus manifest | 4,323 chars (~1,100 tokens) |
| Eval questions | 54 — 43 retrieval, 11 abstention |
| Retrieval arms compared | 5 |
| Best hit@3 | 93.0% (embeddings) |
| Best abstention | 72.7% (entity-gated) |
| Components | 17 → 19, **zero new tokens required** |
| Chat latency | 5.4–7.9 s |
| Runtime dependencies in the site | 0 |

The component count is worth a sentence: two entirely new components — a chat surface and a
citation list — needed **no new tokens**. The existing semantic tier covered every colour in
both. That is the strongest evidence in the repo that the tier is real rather than
decorative.

---

## What this demonstrates

Table stakes in 2026: a portfolio chatbot, RAG, a vector DB, streaming, an MCP server that
exists.

What is actually harder:

- **Publishing the eval that overturned your own recommendation.** Anyone can wire a vector
  database. Far fewer measure whether they needed one, and fewer still publish the table when
  it contradicts them.
- **Mechanical provenance.** Citations checked server-side against the tool calls that
  actually ran — not requested in a prompt.
- **Structured output through an enforced design system.** The answer looks native because it
  is built from the same specs the page is.
- **One content source feeding site, CV, retrieval index, JSON-LD and `llms.txt`**, with the
  design system emitting its own statistics into that source.
- **Being wrong in public, with the numbers attached.** Four claims went in; four came out
  changed. The document that records that is worth more than one that was right by luck.

The through-line: *the same discipline that governs a colour value governs a sentence.*

---

# Chapter two — the design system stops being a stylesheet

Appended, not edited in. Everything above describes the content pipeline and the assistant,
and every figure in it belongs to the phase it sits under. This chapter is a later era, and
it is the one where the *design system's* architecture changed. Read it the same way: dated,
traceable to a commit, and most interesting where the plan turned out to be wrong.

## The decision, and what it cost to take it

The system had one output that mattered: `css/components.css`, hand-authored, with `spec.md`
and a story beside each block and a build that refused a component missing any of the three.
That was already better than most, and it had a ceiling — **the CSS was the source, so
anything that was not CSS had to be re-derived from it.** `dist/components.json` is parsed out
of the shipped stylesheet for exactly that reason.

The owner's call, taken mid-programme: components become **contract-first**. Appearance moves
into `components/<id>/definition.json` as data, and emitters render it into two independent
pipelines — a generated region of `components.css` for the vanilla site and Storybook, and
`dist/tokens.tailwind.css` + `dist/react/<id>.tsx` for the React surface. Neither output is a
translation of the other. Both are renderings of one source, which is the entire claim.

The end state was chosen explicitly and it is the uncomfortable one: **grow the schema until
every component generates**, rather than stopping at a convenient subset and calling the
remainder "special". That decision is what produced every finding below, because the blocks
that resist are the ones with something to teach.

## The reversals, chapter two

### 1. "The definition format is a design problem" — wrong; it is an extraction problem

The pilot was three components, transcribed rather than designed, and the three generated
regions came back **byte-identical** to the blocks they replaced. The schema was then
*extracted from those real cases* rather than written ahead of them, and validated with a
closed keyword list so an unknown key is an error rather than an extension.

Every construct the format has since gained arrived the same way — a real block refused to
generate, and the refusal named the missing idea:

| Block | What it forced |
|---|---|
| `entry`, `fact` | `at` — a set of overrides under a **named** condition, because both wrote `@media (max-width: 720px)` for the same reason and nothing in the repo said so |
| `section-head` | `expr` — computed geometry with its bindings visible, because `var(--x)` inside a string is a binding no gate can see |
| `media` | `contains` — `.ph:has(img)` is not a state and not a position; it is what the element **holds** |
| `profile` | `child` — with the closure enforced by the schema: a child combinator may only reach a bare tag, and a class may only be reached by a descendant |

### 2. "The five sections are the shape of a component" — wrong; the cascade was the emitter's opinion

A definition held `base`, `variants`, `sizes`, `parts` and `at`, and the emitter rendered them
in that fixed order. `media` and `profile` broke it: both group their rules by **topic**, and
under a fixed cascade neither is expressible.

The available fix was a `detach` flag — a key that exists to move a line rather than to say
something about the component. The format refuses hints, so the sections became **one ordered
list in stylesheet order**, each entry tagged by `kind`. *Source order is the cascade, so
recording it records a fact rather than accommodating a renderer.* It paid for itself twice
over: a reference became a backwards-only **name**, which is the only form in which a part
scoped to a state is sayable at all, and two constructs that both wore the word `at` collapsed
into one.

It landed as a migration with a byte-parity ratchet — all ten definitions moved in a single
commit, every generated region and all fourteen published artefacts byte-identical to a fresh
render.

### 3. "Two pipelines from one source will agree" — they did not, and the reason is not in CSS

This is chapter two's equivalent of the BM25 result: the confident claim, measured, and wrong
in an instructive direction.

The React tier rendered `Button variant="solid"` as dark ink on a dark fill, precisely where
the hero call to action is — rgb(20,21,24) against the vanilla page's rgb(245,245,244) — and
`size="small"` at base metrics, 102×46 against 81×36.

```
a class attribute has no precedence
  → CSS resolves the pair by STYLESHEET order
  → Tailwind decides stylesheet order by SORTING CLASS NAMES
  → px-space-3 (36) beats px-space-5 (38); text-content-inverse beats text-content-primary
```

Every override in the pilot sorted before the base class it had to beat. `Chip` worked, and
worked only because its names sort the other way — **the library was correct by alphabetical
accident.**

The fix is *disjointness rather than weight*: no `!important`, no `tailwind-merge`, and not
one byte of the definitions. Each emitted class now reports the CSS longhands it writes,
shorthands expand, and a base class writing a longhand an axis owns is moved into that axis's
`default` branch — so exactly one of the two is ever in the attribute. Where two axes write
the same property, the build **fails naming both branches and the property**, because which
should win is not an emitter's decision.

### 4. "A generated stylesheet proves itself" — only the generated half

At the time the census landed, eleven regions were byte-compared and fifteen blocks were
simply whatever was in the file,
which is the wrong way round while the authored set is the one shrinking. Every block now
declares which half it is in and an authored one declares **why**, from a closed vocabulary,
with the build asserting that the reason's feature is genuinely present. A reason that has
stopped being true is a block that should now be a definition, and the build names it.

The subtle call: the check asserts **presence, not disqualification**. Proving a block
*cannot* generate would mean re-implementing the schema inside the census — and a census that
re-implements the emitter agrees with it by construction, which is the trap
`dist/components.json` is kept out of by being parsed from the shipped CSS.

## The owner's words arrived, and the measurements moved under them

The copy pass is the other half of this era. Thirteen commits, and the corpus went from **70
chunks to 99**.

Everything in the eval fell, and the fall is not a regression:

```
arm            hit@3 before   after the pass   after the gold-set correction
bm25                  83.7%            63.3%                          67.3%
embeddings            91.8%            79.6%                          81.6%
```

**A 36% bigger index does that to a fixed top-k.** The floor was re-cut with the reason on
file, and part of the fall was measurement rather than retrieval: the pass restored six
sections an earlier rewrite had killed, leaving five questions scored against a gold set
narrower than the corpus supported. `cross-b2b-b2c` was marked wrong by every arm while both
ranked arms returned the chunk that answers it in as many words. That correction was
**escalated to the owner rather than folded in**, because widening a gold set raises hit@k and
doing it inside the commit that freezes a floor is indistinguishable from tuning.

And then the result this chapter exists to record honestly:

> `embeddings vs bm25` was significant at **p = 0.0386**. After the ground truth was corrected
> it is **p = 0.0654**. The comparison this entire suite was built to make is no longer
> separated at 95% by these 49 questions.

The correct sentence is *"this set cannot detect a difference"*. The tempting sentence is
*"the arms are equal"*, and it is not what the data says. Nothing was tuned, no threshold
moved, and the remedy is more questions rather than better engineering. It shipped with the
p-value attached — which is the same discipline as publishing the table that overturned the
plan, applied to a result that went the other way.

## Numbers, chapter two

| | |
|---|---|
| Definitions | 26 blocks — 13 generated, 12 authored, 1 split; each authored one carrying a reason the build checks (`build.mjs --check` at `2983f30`; still climbing) |
| Contract version | 1.0.0 → 1.9.0, one release per batch, `CHANGELOG.md` entry each time |
| Published subpaths | 6 → 21 |
| Artefacts byte-compared per build | 17 packaged files + 14 generated regions |
| Contract surfaces diffed | 4 — tokens, components, definitions, exports |
| Tokens | 83 → 103, carrying 147 → 167 values |
| Corpus | 70 → 99 chunks, 967 → 1435 terms |
| Eval questions | 65, unchanged — not one added or reworded through any of it |
| Billed rebuilds | 2 (the pass, then the citation-label correction), both sanctioned |
| Workflows | 3 → 4 (`pages-a11y.yml`) |
| Runtime dependencies in the vanilla site | still 0 |

## What chapter two demonstrates

- **Extracting a format from real cases beats designing one.** Every construct in the schema
  is there because a block refused to generate without it, and can be traced to that block.
- **Two renderings of one source is a falsifiable claim, and it was falsified once.** The
  class-attribute ordering defect is worth more than a clean run would have been: it is the
  proof that "one source, many surfaces" needs a mechanism and not an intention.
- **A migration that may not change appearance is a discipline, not a limitation.** Byte
  parity was the ratchet on every batch; the one deliberate appearance change in the whole era
  — a single `0.05em` folded into `0.06em`, on five selectors — is written down as such.
- **A result that gets weaker is still a result.** The p-value went the wrong way because the
  ground truth got more accurate, and that is the version of the number worth publishing.
