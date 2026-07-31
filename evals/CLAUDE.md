# evals/ — the retrieval contract

## What this owns

**The evidence for the retrieval decision.** A golden question set, six retriever arms
measured on it, a committed baseline, and the numbers published on `/evals` — on both
surfaces, from one run's artefacts. The plan
recommends structured retrieval over a vector database; this directory is what makes that a
finding rather than an assertion, and it is explicitly allowed to overturn it. It has
overturned it.

## Scope — retrieval, and one deliberate exception

`hit@k`, `ent@k`, `MRR` and abstention are properties of the **retriever**. They need no
model, so `run.mjs` is free, offline, deterministic and runs in CI on every commit — which
is the only reason an eval suite survives a year.

Two questions here do need a live model, and both are quarantined rather than absent:
manual, billed, **refuse to run when `$CI` is set**, imported by nothing.
`evals/groundedness.mjs` asks whether the assistant's prose follows from what it cited;
`evals/generation.mjs` asks whether a model handed the design system's published contract can
produce markup that obeys it. See "The two files that call a model" below. Everything else
here holds the original rule.

## What this consumes

- `lib/knowledge/index.js` — the tool core, imported directly. `evals/` sits below
  `lib/knowledge/` in the graph, so this import is the legitimate direction.
- `evals/questions.json` — the golden set.
- `evals/baseline.json` — the committed floor.
- `content.json`'s `evalsPage.reading` — the `/evals` section-04 prose, authored in
  `content/evals.json` as a template with `{{evals:…}}` placeholders. `build-content.mjs` may
  not read `evals/` (`check-boundaries.mjs`), so it ships the prose unfilled and `run.mjs`
  substitutes. Direction stays content → lib/knowledge → evals.

## What this emits

| Output | Consumer |
| --- | --- |
| stdout | the comparison table, the paired tests, the per-class and per-shape tables |
| `evals/results.json` | the machine-readable run, including every interval and every paired test |
| the `<!-- content:evals-* -->` regions of `evals.html` | the published page — **five** of them |
| `evals/dist/page.json` | the same five regions **as data**, for the second renderer |
| `evals/vectors.json` | the embeddings cache, rebuilt only with `VOYAGE_API_KEY` |
| `evals/groundedness.json` | the answer-level measurement, written only by a manual run |
| `evals/generation.json` | the design-system generation measurement, same — and gated by nothing |

`evals/dist/page.json` exists because `apps/next/` needed `/evals` and the alternative was
for it to parse `evals.html`. A page that scrapes another page's markup for its numbers is
one whitespace change away from publishing something the runner never produced, and it would
put a second copy of the placeholder substitution in a slice that is forbidden to import this
one. So each region builder returns a **model** and renders its own markup from that model;
`page.json` carries the models the HTML was rendered from, in the same pass, so there is no
path by which the two can disagree. `apps/next/src/app/evals/page.tsx` types the file and
asserts its shape, so a region that changes kind fails that build naming itself rather than
rendering an empty table under a heading that promises numbers.

`evals.html` is therefore **partly generated**, on the same contract as `index.html`: the
skeleton is hand-authored, five regions are written by `run.mjs`, and `--check` fails if any
is stale. The page can never advertise a number the runner did not produce.

The fifth region is `evals-reading`, and it exists because the prose under "Reading the
numbers" used to be the one part of that page nothing regenerated. It drifted from the table
directly above it. Every figure in it is now a placeholder, and three things fail the build:
a declared token that appears in no paragraph, a `{{…}}` surviving substitution, and a
placeholder naming an arm this run did not measure. The last one is the important one — it
is what stops the page carrying prose about the embeddings arm on a run where the embeddings
arm was skipped.

## The arms

| Arm | What it is |
| --- | --- |
| `tools-only` | model-free structured lookup: match the question against each entity's **name surface**, weight each matched term by its corpus IDF, expand the winners to their chunks. No entity named → returns nothing. |
| `bm25` | Okapi BM25 over the precomputed term statistics — raw `search()`, deliberately not the tool. |
| `hybrid` | tools first, BM25 appended beneath. The shape §1 of the plan originally proposed. |
| `tools-gated` | **counterfactual.** BM25's ranking, refused when the entity gate reports no coverage. |
| `embeddings` | Voyage `voyage-3.5`, cosine over cached vectors. **Gated on a FRESH cache**, not on a key. |
| `gated-embeddings` | **counterfactual.** `embeddings`, refused when the entity gate reports no coverage. |

### The name surface is the shipped one

`tools-only` used to build its own name surfaces inline, and that copy still carried
`experience.descriptor` after `gate.js` dropped it — so its published abstention rate was
literally the pre-fix number sitting in the table while the page beside it described a gate
that excluded the field. It now calls the exported `buildNameSurfaces(content)`. **Import the
shipped constructor; never build a lookalike in the runner.**

It reads the `terms` union rather than applying the gate's name/label split, and that is
deliberate: this arm is IDF-weighted bag-of-names, which is what makes it a *lower bound on
structured routing* rather than a second copy of `tools-gated`.

### The two gated arms are counterfactuals, not the deployed shape

They were the deployed shape when they were written: `search_content` applied the gate
internally and returned nothing on a miss. **That is no longer true.** The gate moved above
the tool; `searchContent` returns `{gateMatched, gateScore, results}` with the ranking intact
on a miss, and nothing in `api/chat.js` or `api/mcp.js` filters on it.

So what ships is the **ungated** ranking with a coverage note attached. The two gated rows
measure what a caller would pay if it chose to refuse on a gate miss — worth measuring,
because that is the decision the system prompt is being trusted to make, and **not a
description of production**. Do not quote either row as one.

### `tools-only` is a proxy, and this is its main limitation

In production the *model* reads the corpus manifest and decides which tool to call. This arm
approximates that with IDF-weighted name matching, because the suite must run without a
model. A real model routes better than a bag of words. **The tools arm is therefore a lower
bound on structured retrieval, not a measurement of it** — including on its favourable rows.

## Nothing here is tuned on these questions

This is the property that makes the numbers worth publishing, and it is easy to lose.

- BM25 keeps the standard `k1 = 1.2`, `b = 0.75`. Sixty-odd questions cannot support a
  hyperparameter search; fitting them would launder noise as a result.
- The tools arm weights matched names by IDF taken from `content.bm25.df` — a statistic of
  the **corpus**, not of the test set.
- `DEPTH = 10` affects only the MRR tail. Production returns 8, and `run.mjs` reads that
  number out of the shipped tool rather than copying it, then reports MRR at both depths.

**One exception is on the record rather than defended.** `experience.descriptor` was removed
from the gate's name surface *after* `oob-google` failed. The principled argument — a
descriptor is a sentence, and the gate matches names — is sound on its own, but it was
constructed after the failure. **Parameter count is not the definition of overfitting**: a
discrete structural choice selected by watching the evaluation set is test-set fitting even
though it adds no constant. `gate.js`'s header says so too. The eleven questions added in
version 2 were written after that change and are the beginning of an out-of-sample check on
it; they are not a substitute for a set written by someone else.

## The question set

`evals/questions.json` — **65 questions**, version 2. `{id, question, category, shape,
expectedEntity, expectedChunkIds[]}`. Written the way a person would ask a portfolio
assistant, and grounded in the real corpus: **`run.mjs` refuses to start if any
`expectedChunkId` is not a real chunk id in `content.json`.**

**49 retrieval, 16 abstention.** A question is an abstention question when `expects` is
`"abstain"`, or — when `expects` is absent — when `expectedChunkIds` is empty. The explicit
field exists for exactly one question, `metric-token-count`, whose expected chunks are still
the right *passages* but no longer contain the *answer*; `run.mjs` prints every question
where the explicit flag overrides the derived one, so the exception is visible rather than
silent.

Abstention questions split three ways, and the distinction matters:

| Category | n | Meaning |
| --- | --- | --- |
| `out-of-corpus` | 8 | not in the corpus at all — Kubernetes, salary, Google or Hotjar as an employer |
| `structured-only` | 5 | in `content.json` as a **structured field** but in no chunk — location, availability, email, dates, the design-system counts |
| `corpus-gap` | 3 | an entity that exists yet produced **no chunk** — the 2007–2009 QA role has no bullets |

The abstention questions are the ones that matter most. A retriever that never abstains is a
retriever that will confidently answer anything.

### `shape` — because the set used to test one thing

`shape` records the FORM of a question independently of its subject. Version 1 was 52 plain
lookups and 2 adversarial probes out of 54: nothing negatively phrased, comparative,
multi-hop across two entities, or temporal. Version 2 adds those. Every non-lookup shape has
n ≤ 4, so the per-shape table **locates a weakness rather than measuring one**, and it says
so in its own footer.

Two version-1 questions were reworded off wording that echoed their target heading
(`proj-spetema-ia`, `metric-deadlift`). Both keep their expected chunks; the wording moved
away from the heading, never toward it.

## Statistics — small n is a property of the result

Every published rate carries a **two-sided 95% Wilson interval**; MRR carries a normal
interval on its own standard error. The formulae live in `evals/stats.mjs`, imported by
`run.mjs` and `groundedness.mjs`.

At n=49 one question is 2.0pp and the intervals are 11–14pp wide; the abstention classes are
wider still and `corpus-gap` at n=3 is wider than 50pp. **Two arms whose intervals overlap
are not separated by the table.** That is what the paired tests are for.

**Exact two-sided McNemar** on per-question hit@3 is computed for every comparison worth
making and published in `results.json`, on stdout and on the page. Only *discordant*
questions carry information, so the counts are small even where the margins are large — and
five discordant pairs cannot reach p<0.05 under an exact test, because 0.0625 is the floor.
A non-significant result is *"this set is too small to detect a difference"*, never
*"the arms are equal"*.

### `separability` is not independent evidence, and is no longer printed as if it were

`separability` is the fraction of (answerable, unanswerable) pairs that *any* top-1 score cut
orders correctly, ties half — chosen so no magic threshold is picked after seeing the scores.
For a **gated** arm most of it is the abstention rate wearing a second name: a pair where the
unanswerable side returned nothing is won by the refusal, not by the score. Two arms with
completely different score scales reported an identical figure, which is the proof.

It is now decomposed into four shares that sum to 100 — won by returning nothing, tied empty,
lost by refusing an answerable question, actually scored — and the figure over the **scored
pairs alone** is reported beside it. Only that last one is about the ranker. `separability`
is also excluded from the columns an arm can lead in the published table, because awarding it
a win counts one fact twice.

## Freshness — by digest, never by count

Both vector caches carry a `corpusHash`: `content/dist/vectors.json` (written by
`scripts/build-vectors.mjs`) and `evals/vectors.json` (written by `run.mjs`). The eval cache
also carries a `questionsHash`, because adding or rewording a question must invalidate the
question vectors.

**A count cannot see a reword, and it missed one.** A corpus rebuild that renamed an entity
and reworded its chunks left 76 cached vectors against 76 live chunks; the arm scored against
text that no longer existed and every gate stayed green. `--check` now covers the cache too,
and reports **four** artefacts: `results.json`, `dist/page.json`, `evals.html` and
`vectors.json` at the corpus hash it was built for.

> **The separator in the corpus digest is a NUL byte, written as `"\u0000"`.** A literal one
> renders as a space in every editor, in `git diff` and in a plain file read. Reimplementing
> the hash from what the line appears to say produces a different digest, declares a current
> cache stale, and drops the ranker to BM25 behind answers that look identical. There are
> three copies of that construction across two boundaries that forbid the import, so
> `run.mjs`'s preflight **reconciles** its own digest against the shipped one — the same
> treatment `verifyTokeniser` gives the tokeniser.

## The two files that call a model

### `evals/groundedness.mjs`

It answers the question `hit@k` cannot: **does the prose follow from
the chunks it cites?** A fabricated claim wearing a validated citation passes all three
gates, and nothing measured how often that happens.

- It drives the **shipped** `/api/chat` over HTTP and parses its SSE. It does not import
  `api/` (the boundary forbids it) and it does not reimplement the loop, the system prompt or
  the retry policy — an eval that reconstructed those would measure a lookalike assistant.
- It imports `retrievedChunkIds` from `lib/knowledge`, so *"which ids could this turn
  legitimately have cited"* is computed by the shipped provenance function.
- The judge is a larger model than the one under test and sees **only** the prose and the
  cited chunk text — never the corpus, never the question's ground truth.
- **`unsourceable` is a fourth verdict, not a zero.** Three tools license no chunk ids:
  `get_design_system` and `get_component` deliberately (the component contract is not chunked
  and is not in the corpus, and faking a citation would be the borrowed-credibility failure
  that removing `project.why` closed), and `list_projects` incidentally — its compact record
  carries no `chunkIds` array. An answer built only from those has prose and no possible
  source; blaming the model for a property of the tool surface would be wrong, so those turns
  are counted separately and excluded from the headline rate.
- **`list_experience` was a fourth such tool and is not any more.** `retrievedChunkIds` read
  a hard-coded list of three result paths, and `r.experience[i].chunkIds` was on none of
  them, so employment history — the highest-stakes question class here — could not cite.
  It now walks the result instead, and `test/schema.test.js` holds that. **The committed
  `evals/groundedness.json` still says otherwise**, in its `unsourceable.note` and in its
  counts, because it is the artefact of a billed manual run and can only change on a re-run.
  Do not hand-edit it to agree with this file; re-run it, or read it as dated.
- It **refuses to run when `$CI` is set**. The guard is the mechanism, not a convention.

```sh
vercel dev                                        # in another terminal
node --env-file=.env evals/groundedness.mjs       # billed, manual
node evals/groundedness.mjs --dry-run             # print the plan, spend nothing
node evals/groundedness.mjs --from turns.jsonl    # re-judge a capture, no chat spend
```

### `evals/generation.mjs`

It answers the question the other two do not touch: **can a model handed this design
system's published contract build markup that obeys it?** `get_design_system` and
`get_component` publish that contract and `api/mcp.js` serves it to somebody else's agent —
the repo's argument that a design system can be *consumed* by a model rather than only read
by a person. An argument with no measurement behind it is a claim.

- Ten fixed briefs, driven through the **shipped** `TOOLS` array, and **no LLM judge
  anywhere.** That is the design, not a shortcut: "does this sentence follow from that
  passage" has no closed form and needs a judge; "is this class published" does not. All four
  gates — published classes, published custom properties, no raw colour/font/spacing literal,
  and a per-brief accessibility table — are set-membership tests or regexes, so two runs can
  disagree about the markup and cannot disagree about whether a fragment passed.
- Gate 4's table is fixed and hand-derived rather than computed, because `a11y` in
  `components.json` is one authored English sentence per component. Deriving a check from it
  would mean parsing prose, which is the judge this file exists without.
- It reads `design-system/dist/components.json` and `tokens.flat.json` **directly**. The
  `evals` rule bans the design system's *source* directories and says nothing about `dist/`,
  which is the published artefact every consumer is meant to read — so both reads are pinned
  in `CROSSINGS`, because that kind of silence is what the pin table exists to make audible.
- **There is no baseline and no `--check`, deliberately.** The measured object is a model,
  which moves under you without a commit; a floor over it would be a floor over somebody
  else's release schedule.
- `--self-test` proves the gates before any of this is believed: two fixtures, one that must
  pass everything and one that must fail everything in a named way, and a vacuous pass is
  rejected.

**What the number is about, said before anyone quotes it.** One model, this tool surface, ten
briefs. At n=10 the 95% Wilson interval is wider than 30 percentage points, and every rate is
published with that interval attached for exactly that reason. The model under test defaults
to `claude-sonnet-4-5` — **not** the `claude-haiku-4-5` that `api/chat.js` runs — so this
measures the contract's legibility to a capable agent and is not a statement about the site's
own assistant.

```sh
node evals/generation.mjs --self-test          # prove the GATES, spend nothing
node evals/generation.mjs --dry-run            # print the plan, spend nothing
node --env-file=.env evals/generation.mjs      # billed, manual, writes the artefact
```

`evals/generation.json` is committed evidence and is covered by **nothing** — not `npm run
check`, not `run.mjs --check`, not a boundary pin, and `test/boundaries.test.js` asserts that
absence in both directions so it cannot be mistaken for an oversight. It can only change when
a human spends money, so a staleness gate could only ever be silenced by a billed run. Read
it as dated: `contract.componentsDigest` and `contract.tokensDigest` say which contract it
was measured against, and `briefs.briefsHash` says whether the briefs have moved.

## How to verify in isolation

No network, no API key, no dependencies — as long as the committed vector cache is current.

```sh
node evals/run.mjs                    # run, print the tables, write the artefacts
node evals/run.mjs --check            # CI: fail if any artefact or the vector cache is stale
node evals/run.mjs --update-baseline --reason "…"   # accept these numbers as the new floor
node --env-file=.env evals/run.mjs    # the only form that can REBUILD the vector cache
```

`run.mjs` will not measure anything until it has proved itself: the query tokeniser still
reproduces the shipped index exactly, the referential and provenance gates still drop what
they must, its corpus digest agrees with the shipped one, and every expected chunk id is
real. Any of those failing exits 1 before a single question runs.

**A `.env` on disk with no `VOYAGE_API_KEY` in the process is a mistake, not a choice.** Node
does not read `.env` on its own. Running the plain form when you meant `--env-file` used to
print `skipped`, delete two arms and republish the table without them. It now says so and
exits.

## What a regression means

`evals/baseline.json` is a committed floor over `hit@1/@3/@5`, `ent@1/@3`, `MRR` and
`abstain`, per arm. **The tolerance is the sampling error, not 0.001.** A drop must exceed
the 95% half-width of that metric at this n — the wider of the half-widths at the baseline
value and at the current one. A gate three orders of magnitude finer than the interval around
the number it guards fires on one question changing its mind, gets triaged as content drift,
and is eventually lowered by whoever is under time pressure.

What that does not protect against is a slow slide of one question per commit, each inside
the margin. That is the cost of the trade, stated here rather than discovered later; the
defence is that the floor is re-cut deliberately and every re-cut records `reason`.

An arm that stops being measured also fails the build. Deleting a row is the cheapest way to
make a table look better.

A regression means one of three things, in rough order of likelihood:

1. **Content changed.** Adding or rewording a project moves chunk boundaries and term
   statistics — and invalidates both vector caches, which the digests now catch. Re-read the
   per-class table: if the drop is confined to one class, say so in `reason`.
2. **The tokeniser drifted.** The preflight catches this before the questions run.
3. **Retrieval genuinely got worse.** Fix it — in `lib/knowledge/`, not here.

## What this must never do

- **Never invent an expected chunk id to make a question score.** The runner enforces this,
  and the enforcement exists because it is the single easiest way to fake a good table.
- **Never lower `baseline.json` to make a build pass.** Raise or lower it deliberately, with
  `--reason`, or fix the regression.
- **Never tune anything against this question set** — not `K1`/`B`, not a threshold, and not
  a *structural* choice. Removing a field from a feature set because it made a known test
  item fail is test-set fitting even though it adds no parameter.
- **Never fake or substitute a skipped arm.** `skipped` is a truthful cell in a published
  table; a TF-IDF cosine labelled "semantic" is not, and neither is republishing the table
  with the arm quietly deleted.
- **Never build a lookalike of shipped code inside the runner.** Import the exported
  constructor. The gate the eval measures must be the gate that ships.
- **Never let `run.mjs` call a model API.** `groundedness.mjs` is the boundary, it is
  quarantined, and it must never be imported from the commit path.
- **Never quote a comparison between two arms that do not ship as a justification for one
  that does.**
- **Never hand-edit the `<!-- content:evals-* -->` regions of `evals.html`, or
  `evals/dist/page.json`.** Run `run.mjs`. Two surfaces publish these numbers now, and both
  read what that one run wrote.
- **Never let the second surface compute a figure.** `apps/next` renders `page.json`; a rate,
  a half-width or a sample size it derived would be a second opinion about a measurement,
  which is the one thing a second renderer must never be.
