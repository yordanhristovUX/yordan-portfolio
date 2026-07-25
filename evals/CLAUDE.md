# evals/ — the retrieval contract

## What this owns

**The evidence for the retrieval decision.** A golden question set, four retriever arms
measured on it, a committed baseline, and the numbers published on `/evals`. The plan
recommends structured retrieval over a vector database; this directory is what makes that a
finding rather than an assertion, and it is explicitly allowed to overturn it.

## Scope — retrieval only, and deliberately so

`hit@k`, `ent@k`, `MRR` and abstention are properties of the **retriever**. They need no
model, so this suite is free, offline, deterministic and runs in CI on every commit — which
is the only reason an eval suite survives a year.

Answer-level metrics — citation validity in a real answer, turns per answer, latency, cost —
need a live model and belong with `api/chat.js` in Phase 3. **Nothing here calls a model
API.** The one exception that would is the embeddings arm, and it is gated.

## What this consumes

- `lib/knowledge/index.js` — the tool core, imported directly. `evals/` sits below
  `lib/knowledge/` in the graph, so this import is the legitimate direction.
- `evals/questions.json` — the golden set.
- `evals/baseline.json` — the committed floor.

## What this emits

| Output | Consumer |
| --- | --- |
| stdout | the comparison table and the per-class table |
| `evals/results.json` | the machine-readable run |
| the `<!-- content:evals-* -->` regions of `evals.html` | the published page |
| `evals/vectors.json` | the embeddings cache, only if `VOYAGE_API_KEY` is set |

`evals.html` is therefore **partly generated**, on the same contract as `index.html`: the
skeleton and the prose are hand-authored, four regions are written by `run.mjs`, and
`--check` fails if they are stale. The page can never advertise a number the runner did not
produce.

## The arms

| Arm | What it is |
| --- | --- |
| `tools-only` | model-free structured lookup: match the question against each entity's **name surface** (ids, titles, clients, tags, org and role names, skill terms), weight each matched term by its corpus IDF, expand the winners to their chunks. No entity named → returns nothing. |
| `bm25` | `search_content` — Okapi BM25 over the precomputed term statistics. |
| `hybrid` | tools first, BM25 appended beneath. The shape §1 of the plan originally proposed. |
| `tools-gated` | **post-hoc.** BM25's ranking, gated on the tools arm having matched some entity. Name match decides *whether*; BM25 decides *what*. |
| `embeddings` | Voyage `voyage-3.5`, cosine over cached vectors. **Gated behind `VOYAGE_API_KEY`.** Absent → prints `skipped (no VOYAGE_API_KEY)` and is left out of the table. It is never faked, and never substituted with TF-IDF cosine relabelled "semantic". |

### `tools-only` is a proxy, and this is its main limitation

In production the *model* reads the corpus manifest and decides which tool to call. This arm
approximates that with IDF-weighted name matching, because the suite must run without a
model. A real model routes better than a bag of words: it will map "user research methods"
onto the research skill group, which this arm cannot. **The tools arm is therefore a lower
bound on structured retrieval, not a measurement of it.** Phase 3 measures the real thing
against a live endpoint. Read every tools-arm number with that in mind — including the
favourable ones.

## Nothing here is tuned on these questions

This is the property that makes the numbers worth publishing, and it is easy to lose.

- BM25 keeps the standard `k1 = 1.2`, `b = 0.75`. Forty-odd questions cannot support a
  hyperparameter search; fitting them would launder noise as a result.
- The tools arm weights matched names by IDF taken from `content.bm25.df` — a statistic of
  the **corpus**, not of the test set.
- Abstention is reported **threshold-free**. `abstain` is the rate at which an arm returned
  literally nothing; `separability` is the fraction of (answerable, unanswerable) question
  pairs that *any* top-1 score cut would order correctly, with ties counted half. Choosing a
  single magic threshold after seeing the scores would be fitting the test set, so no
  threshold is chosen at all.
- `tools-gated` **is** post-hoc, was written after seeing arms 1–3 on this set, and is
  labelled as such in the code, in the table and on the page. It has no tuned parameter, but
  it is a hypothesis this run suggests rather than a result this run establishes.

## The question set

`evals/questions.json` — 54 questions, `{id, question, category, expectedEntity,
expectedChunkIds[]}`. Written the way a person would ask a portfolio assistant, and grounded
in the real corpus: **`run.mjs` refuses to start if any `expectedChunkId` is not a real chunk
id in `content.json`.** An invented expected id would score a question nothing can answer,
and would do it silently.

Eleven questions carry an empty `expectedChunkIds` — the correct behaviour is to retrieve
nothing. They split three ways, and the distinction matters:

| Category | Meaning |
| --- | --- |
| `out-of-corpus` | not in the corpus at all — Kubernetes, salary, Google as an employer |
| `structured-only` | in `content.json` as a **structured field** but in no chunk, so only the tool layer can answer it — location, availability, email |
| `corpus-gap` | an entity that exists yet produced **no chunk** — the 2007–2009 QA role has no bullets |

The abstention questions are the ones that matter most. A retriever that never abstains is a
retriever that will confidently answer anything.

## How to verify in isolation

No network, no API key, no dependencies.

```sh
node evals/run.mjs                    # run, print both tables, write the artefacts
node evals/run.mjs --check            # CI: fail if results.json or evals.html is stale
node evals/run.mjs --update-baseline  # accept the current numbers as the new floor
```

`run.mjs` will not measure anything until it has proved itself: it verifies that the query
tokeniser still reproduces the shipped index exactly, self-tests the referential and
provenance gates, and validates every expected chunk id. Any of those failing exits 1 before
a single question runs.

## What a regression means

`evals/baseline.json` is a committed floor over `hit@1/@3/@5`, `ent@1/@3`, `MRR` and
`abstain`, per arm, with a tolerance of 0.001. Falling below it exits non-zero.

A regression means one of three things, in rough order of likelihood:

1. **Content changed.** Adding or rewording a project moves chunk boundaries and term
   statistics. Re-read the per-class table: if the drop is confined to one class, the content
   change explains it, and the baseline should be raised or lowered *deliberately* with the
   reason in the commit message.
2. **The tokeniser drifted.** The preflight catches this before the questions run.
3. **Retrieval genuinely got worse.** Fix it.

## What this must never do

- **Never invent an expected chunk id to make a question score.** The runner enforces this,
  and the enforcement exists because it is the single easiest way to fake a good table.
- **Never lower `baseline.json` to make a build pass.** Raise it deliberately, or fix the
  regression.
- **Never call a model API in this suite.** The embeddings arm is the boundary, and it is
  gated. If a metric needs a model, it belongs in Phase 3.
- **Never fake or substitute a skipped arm.** `skipped (no VOYAGE_API_KEY)` is a truthful
  cell in a published table; a TF-IDF cosine labelled "semantic" is not.
- **Never tune a retrieval constant against this question set.** See above.
- **Never hand-edit the `<!-- content:evals-* -->` regions of `evals.html`.** Run `run.mjs`.
