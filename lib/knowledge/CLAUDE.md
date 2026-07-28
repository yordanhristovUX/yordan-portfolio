# lib/knowledge — the retrieval contract

## What this owns

**Retrieval, and the rules that make an answer traceable.** Eight tools, lexical and
semantic ranking, the entity gate, the answer block schema, and the three validation gates.
It is the product: `api/chat.js` calls it in process, `api/mcp.js` exposes the same tools
over remote MCP, and `evals/` measures the retrieval underneath. All three consume it
unchanged, so a tool bug cannot exist on one surface and not the other.

**Nothing enumerates the tools.** `TOOLS` is the list; `api/mcp.js` maps over it and
`api/chat.js` passes it through, which is why adding `get_design_system` and `get_component`
published them on both surfaces without a line of transport code changing. Keep it that way,
and treat any count of tools written in prose — including the one in the line above — as the
thing most likely to be stale in this file.

| File | Owns |
| --- | --- |
| `search.js` | the tokeniser, Okapi BM25, `verifyTokeniser` |
| `embed.js` | the Voyage query embedding, the committed chunk vectors, the BM25 fallback |
| `gate.js` | the entity gate — name surfaces, `idf/sf` scoring, `GATE_MISS_MESSAGE` |
| `tools.js` | the corpus load, `TOOLS` + their JSON Schemas, id resolution |
| `schema.js` | the answer block union, `RESPOND_TOOL`, the three gates |
| `index.js` | the public surface — import from here, not from the parts |

## What this consumes

`content/dist/content.json`, read **as data** at module init and never again. One
`readFileSync` + `JSON.parse`; after that every corpus tool call is property access on a
loaded object (~1 ms). `content/dist/vectors.json` is the second and last file, loaded the
same way by `embed.js`. Beyond those two: no state, no dependencies, and no network except
the per-request query embedding, which fails to BM25 rather than throwing.

The shape it relies on:

```
{ version, system: {tokens, values, components, light, dark, print},
  profile: {identity, availability, contact, rows, prose},
  capabilities[]: {id, title, …}, skills: {order, groups}, education, facts[],
  projects[]:   {id, index, order, title, client, indexClient, indexTitle, cardType,
                 hasCaseStudy, tags[], accentTag, indexTags[], metrics[], links[],
                 media[], summary, subtitle, sections[]}
  experience[]: {id, role, org, descriptor, period, span, projects[], bullets[]}
  designSystem: {$derivedFrom, count, components[]}   ← the component contract,
                                                        folded in verbatim from
                                                        design-system/dist/components.json
  evalsPage:    {$doc, reading}                       ← /evals section-04 prose; NOT read
                                                        by this slice, only carried
  chunks[]:     {id, entity, kind, heading, text, cite, len, tf}
  bm25:         {N, avgdl, df}
  manifest:     {projects[], experience[], facts[]} }
```

`designSystem` is how the design system reaches this slice without an import: the content
build copies `design-system/dist/components.json` into the corpus, and `get_design_system` /
`get_component` read it from there. `capabilities[]` is read by `gate.js` when it builds
name surfaces.

Two properties of that file are load-bearing and are asserted, not assumed:

- **`sections` is an ARRAY, in authored order, and a kind may repeat.** The Green Street
  audit has two `{#approach}` and two `{#outcome}`; Spetema has two `{#approach}`. Keying
  sections by kind silently discards half of them. `get_project` returns the array.
- **The tokeniser here must match the one that built the index.** They sit either side of a
  boundary that forbids the import, so agreement is proved empirically instead — see below.

## What this emits

`TOOLS` — tool descriptors, each `strict: true`, `additionalProperties: false`, every
property in `required`. An **optional** argument is a nullable type, not an omitted key
(`tag: {type: ["string","null"]}`): that is the portable strict-mode idiom. `minimum`,
`maximum`, `minItems` and `maxItems` are deliberately absent — strict schemas do not honour
them consistently, so bounds are enforced in the handler where they actually hold.

Two families, one list. Six read the **portfolio corpus**; two read the **design system's
derived component contract** that the content build folded into the same file.

| Tool | Returns | Licenses chunk ids? |
| --- | --- | --- |
| `list_projects({tag, client, hasCaseStudy})` | compact records; all three filters nullable | **no — none** |
| `get_project({id})` | full project — ordered `sections[]`, metrics, links, media, tags, `chunkIds` | yes |
| `list_experience({})` | every role — org, role, period, location, mode, descriptor, bullets, `chunkIds` | yes |
| `get_profile({})` | identity, location, availability, contact, skills, education, facts | yes |
| `get_system_facts({})` | the design system's own numbers, the corpus statistics, the open-source links | yes (the profile chunks) |
| `search_content({query, limit})` | `{query, limit, count, results[], gateMatched, gateScore, gateFloor, note, ranker, rankerNote}`; `limit` clamped to 1..20 | yes |
| `get_design_system({})` | token categories, the component index, the rules markup must obey | **no — deliberately** |
| `get_component({id, detail})` | one component's blocks, classes, elements, variants, selectors, tokens, `a11y`, `spec` path | **no — deliberately** |

**The provenance column is a property worth knowing before you debug a stripped citation.**
Gate 3 licenses only chunk ids a tool handed back this turn, so a turn built entirely out of
the three "no" rows has prose and no possible source — `hasUnsourcedClaim` fires and the
retry burns a model turn through no fault of the model. For `get_design_system` and
`get_component` that is deliberate: the component contract is not chunked and not in the
manifest, so there is no passage to license and borrowing a profile chunk for it would be
the failure that removing `project.why` closed. For `list_projects` it is simply a
consequence of the shape — the compact record carries no `chunkIds` array. `evals/`
measures this as its fourth verdict, `unsourceable`, rather than scoring it as a
hallucination. Two tests hold it: `test/tools.test.js` — *"neither design-system tool
licenses a chunk id"* — and `test/schema.test.js` — *"`list_experience` licenses the chunks
it returned"*.

`RESPOND_TOOL` / `ANSWER_SCHEMA` — the final turn's forced tool. `blocks` is a **flat array
of a discriminated union**, never a tree: strict JSON Schema does not support recursion.

`validateBlocks` → `validateReferential` → `validateProvenance`, or `validateAnswer` for all
three in order.

## The entity gate — `gate.js`

**It is a coverage signal, not a filter.** `search_content` calls it, attaches
`{gateMatched, gateScore, gateFloor, note}` to every result, and returns the full ranking
either way. Nothing in this slice acts on the verdict.

    the gate reports COVERAGE · the ranker decides WHAT · the caller decides WHETHER

That is a change of shape, not of wording, and the previous shape is worth knowing because
half the documents around it still describe it. The gate used to run *inside* the tool and
return zero results on a miss. Two measurements ended that:

- On the eval set a miss is a **precise signal about the query and a weak one about the
  corpus**: it refuses the unanswerable questions, and it refuses a large share of the
  answerable ones too, because "Does he do motion design?" genuinely names no entity while
  the corpus genuinely answers it. Filtering on that threw away real answers, including
  *"Where is he working at the moment?"* — close to the most likely question a recruiter
  asks. (The exact split is in `gate.js`'s header and moves with the question set.)
- Collapsed to a boolean inside the tool, the matched entity was discarded, so the signal
  could only ever refuse — never narrow the search to the entity it had just identified,
  never re-route to `get_project` or `list_experience`.

`gate.js`'s own header carries the current numbers and the derivation; do not restate them
here, read them there.

**The consequence for a consumer, stated plainly because it is now their problem.**
`api/chat.js`'s system prompt carries an explicit corpus-boundary section and a remote MCP
client's own model reads `note`. Nothing else refuses. If you want refusal behaviour, that is
a decision to make in the caller — and it is the decision `evals/`'s two *gated* arms price
out. They are counterfactuals now, not descriptions of production; `evals/CLAUDE.md` says so
in as many words, and quoting one as "what ships" is the mistake it exists to prevent.

Matching is over **name surfaces only** — ids, orgs, titles, clients, tags, skill terms,
fact titles — split into what an entity *is* (`name`) and what it is *tagged with* (`label`),
because no scalar threshold separates *"was he a senior designer at Figma"* (three labels,
higher score, must refuse) from *"What was the AI-Ready Design System project about?"* (one
name, lower score, must open). Weight is `idf(t)/sf(t)`, and a single term opens the gate
only if it is the entity's own name, near-unique, and a proper noun *by the corpus's own
capitalisation*. `experience.descriptor` is excluded because it is a sentence, and a sentence
in a name surface is body-matching: "sole designer for all client work" put `work` in Studio
Kipo's name surface and opened the gate for *"did he work at Google"*.

### "Nothing is tuned" was the wrong defence, and it is withdrawn

This file used to argue that because the gate adds no fitted constant, no parameter could
have been fitted to the eval. That is a non-sequitur and it is now conceded in `gate.js`'s
own header. **Parameter count is not the definition of overfitting.** The descriptor
exclusion was made *after* `oob-google` failed; a discrete structural choice selected by
watching the evaluation set is test-set fitting whether or not it adds a number. The
principled argument for it is sound on its own — it was simply constructed after the failure
rather than before, and only one of those two facts used to be written down.

What can honestly be claimed, and is what the numbers rest on:

- `K1`/`B` are the standard 1.2 / 0.75 and were never searched.
- The IDF and surface-frequency weights are statistics of the **corpus**, not of the
  question set.
- `gateFloor(N)` is a function of corpus size alone, was chosen before any of this was
  measured, and has not been moved since — where it costs a question, the cost is reported
  rather than the constant adjusted.
- The eleven questions added in version 2 of the set were written after the descriptor
  change and are the beginning of an out-of-sample check on it. They are not a substitute
  for a set written by someone else.

Prefer that list to the old sentence. It is longer and it is true.

**Why this is in the core, recorded because it was nearly not.** The gate was first written
inside `api/chat.js`, which made the web chat refuse correctly while `api/mcp.js` — same
tool, same corpus — served the ungated arm to anyone who added this server to their own
Claude. `lib/knowledge/` had been declared off-limits to two parallel agents so they could
not collide in it, so the gate landed in the only place it was allowed to land. **A scoping
decision taken for merge safety became an architectural defect**, and `api/CLAUDE.md`
already forbade it. Correctness outranks merge convenience.

That history is why the gate still *lives* here even though it no longer decides anything:
the signal is computed once, in the core, and reaches both surfaces identically. A consumer
may choose what to do with it. A consumer may not compute its own.

`evals/run.mjs` imports this same `entityGate`, so the published numbers describe the shipped
gate rather than a lookalike. The `bm25` arm deliberately calls raw `search()` instead of the
tool, because a gated baseline would make that arm identical to `tools-gated` and the table
would compare an arm against itself.

## The three gates

1. **Schema.** `prose` is the only block carrying model-authored text. Every other block
   names content by id and the client renders it from `content.json`. The model composes an
   answer; it does not restate facts, so it cannot mistype a date it is never allowed to type.
2. **Referential.** Every id resolves in `content.json` — project ids, experience ids,
   profile row terms and fact ids, `<projectId>:<index>` link ids, media slots, metric
   indices, tag labels, chunk ids. Unresolvable → block dropped.
3. **Provenance.** Every cited chunk id must have been **returned by a tool call in this
   turn**. Gate 2 only proves an id is real; this proves it was read. Both are needed — the
   corpus is small enough for a model to guess a well-formed, resolvable, entirely unread
   chunk id. Structured reads carry a `chunkIds` array for exactly this reason; without it
   the gate would only ever pass for answers that went through `search_content`.

`validateAnswer` also returns `hasUnsourcedClaim` — prose survived with nothing backing it.
That is the retry signal. This slice emits the signal and nothing more; the policy is
`api/chat.js`'s, and it is: **retry once, then take the better verdict** — degrade to an
explicit "not on file" block only when nothing survives, and ship-with-an-uncited-signal when
a true answer survives with no provenance.

**Three terminal states, not two.** This used to be documented as two, and the two-state
version was never what shipped:

| State | Means | What the reader gets |
| --- | --- | --- |
| grounded | blocks survived and something backs them | the answer |
| **uncited** | prose survived the retry with no chunk id any tool returned this turn | the answer **plus a server-authored caveat block**, and `uncited: true` on the `done` event |
| degraded | nothing survived at all | the "not on file" block, and `degraded: true` |

The middle row is the one worth understanding before changing anything here. The measured
failure at that point is **loss of provenance, not fabrication** — most of those answers are
true and cite a passage the gate could not license. Degrading them would swap correct
answers for refusals in order to punish a bookkeeping failure. `test/chat-retry.test.js`
drives the real handler over HTTP and holds the policy: a retry that repeats the defect is
not shipped silently, a retry that comes back empty does not discard the first answer, and
an answer where nothing survives still degrades to not-on-file.

## Known properties of the input

Both belong to `scripts/build-content.mjs`, not to this slice. Recorded here because a
reader of this module will otherwise assume neither exists.

- **Chunk ids are unique — FIXED in `299b67c`, this note kept as history.** The id was
  `entity#kind` and kinds repeat, so 6 of 76 ids named two chunks each. `addChunk()` now
  appends an ordinal to later collisions (`…#approach`, `…#approach-2`), and all 76 ids are
  distinct. `resolve.chunks(id)` still returns an **array** for compatibility, but it is now
  always length 0 or 1 — the one-to-many `byChunkId` map in `tools.js` is dead weight and
  can be simplified whenever that file is next touched. **A citation now identifies a
  passage**, which is what the provenance gate needs in order to prove anything.
- **`experience:cncsys` has no chunks.** The 2007–2009 QA role has no bullets, so it
  produces no chunk and is invisible to `search_content`. It is reachable only through
  `list_experience`. Any question about it is unanswerable by search — see
  `evals/questions.json`, category `corpus-gap`. This is a *content* gap, not a code bug:
  the fix is bullets in `content/experience/cncsys.md`, and that is the author's call.

## How to verify in isolation

No network, no API key, no fixture server.

```sh
node -e "import('./lib/knowledge/index.js').then(k => console.log(k.verifyTokeniser(k.content)))"
npm test                           # the behaviour suite — gate, tools, schema, retry
node evals/run.mjs                 # exercises every arm
node scripts/check-boundaries.mjs  # the direction of the graph
```

`npm test` is the one that changed. `test/gate.test.js`, `test/tools.test.js` and
`test/schema.test.js` assert the *behaviour* of this slice rather than comparing an
artefact — which of the ten measured single tokens still refuse alone, that a poison argument
comes back as a tool error and never a stack, that provenance descends into every result
shape. They are the only step in `npm run check` that executes this code.

`verifyTokeniser` is the one that matters. The index in `content.json` was built by a copy
of this tokeniser living in `scripts/build-content.mjs`, on the other side of a boundary
that forbids the import. Rather than trust two copies to stay identical, it recomputes the
whole index — every `tf`, every `df`, `N`, `avgdl` — from the chunk text that shipped and
requires an exact match. A tokeniser mismatch between index and query does not throw; it
loses recall silently, on exactly the terms that matter most (`WCAG 2.1 AA`, `200+`, `1:1`,
`p5.js`). This is what makes that failure loud.

## What this must never do

- **Never import from `api/`, `js/`, `scripts/`, or `content/*.md`.** Retrieval reads
  `content/dist/content.json` and nothing else. `scripts/check-boundaries.mjs` asserts it.
- **Never do I/O beyond the two committed reads.** `content/dist/content.json` and
  `content/dist/vectors.json`, both at module init. The query embedding is the one network
  call, and it must keep failing to BM25 rather than throwing. If a tool needs data that is
  in neither file, the fix is in `content/` or in the design-system build, not here.
- **Never key sections by kind.** Kinds repeat. It is an ordered array.
- **Never let the query tokeniser drift from the index tokeniser.** Change one, change both,
  rebuild `content.json`, and `verifyTokeniser` must still pass.
- **Never enumerate the tools.** `TOOLS` is the list. A consumer that hard-codes six names
  publishes seven when the eighth lands.
- **Never tune `K1`/`B` against `evals/questions.json`.** A question set this size cannot
  support a hyperparameter search; fitting it would launder noise as a result. 1.2 / 0.75 are
  the standard defaults and stay there.
- **Never make a structural choice by watching the eval either.** Removing a field from a
  feature set because it made a known test item fail is test-set fitting even though it adds
  no constant. It has happened once here, it is on the record above, and "it added no
  parameter" is not a defence.
- **Never relax a gate to make an answer render.** A dropped block is the system working.
- **Never re-implement the coverage verdict in a consumer.** The gate is computed once, here,
  and both surfaces receive the same `{gateMatched, gateScore, gateFloor, note}`. What a
  caller *does* with it is the caller's; what it *is* must not be.
