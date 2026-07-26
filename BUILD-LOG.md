# Build log — content pipeline, retrieval, and an assistant

Raw material for a case study. Written during the build, not reconstructed afterwards.
Everything here is traceable to a commit, a measurement, or a failure that actually
happened. The interesting parts are the places the plan turned out to be wrong.

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

### Still open

- **The MCP server serves ungated search.** The entity gate lives in `api/chat.js`, because
  `lib/knowledge/` was declared off-limits to both parallel agents to avoid a collision. The
  consequence: the web chat refuses "did he work at Google?" and a recruiter's Claude Desktop
  would not. The plan's claim that "a tool bug cannot exist on one surface and not the
  other" is currently false — the gate isn't in the core, it's in one surface. **Scoping
  decisions made for merge safety leaked into architecture.**

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
