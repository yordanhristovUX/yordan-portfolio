# lib/knowledge — the retrieval contract

## What this owns

**Retrieval, and the rules that make an answer traceable.** Six tools, BM25, the answer
block schema, and the three validation gates. It is the product: `api/chat.js` calls it in
process, `api/mcp.js` exposes the same six tools over remote MCP, and `evals/` measures the
retrieval underneath. All three consume it unchanged, so a tool bug cannot exist on one
surface and not the other.

| File | Owns |
| --- | --- |
| `search.js` | the tokeniser, Okapi BM25, `verifyTokeniser` |
| `tools.js` | the corpus load, the six tools + their JSON Schemas, id resolution |
| `schema.js` | the answer block union, `RESPOND_TOOL`, the three gates |
| `index.js` | the public surface — import from here, not from the parts |

## What this consumes

`content/dist/content.json`, read **as data** at module init and never again. One
`readFileSync` + `JSON.parse`; after that every tool call is property access on a loaded
object (~1 ms). Nothing else — no network, no state, no dependencies.

The shape it relies on:

```
{ version, system: {tokens, values, components},
  profile: {identity, availability, contact, rows, prose},
  capabilities[], skills: {order, groups}, education, facts[],
  projects[]:   {id, index, order, title, client, indexClient, indexTitle, cardType,
                 hasCaseStudy, tags[], accentTag, indexTags[], metrics[], links[],
                 media[], summary, subtitle, sections[]}
  experience[]: {id, role, org, descriptor, period, span, projects[], bullets[]}
  chunks[]:     {id, entity, kind, heading, text, cite, len, tf}
  bm25:         {N, avgdl, df}
  manifest:     {projects[], experience[], facts[]} }
```

Two properties of that file are load-bearing and are asserted, not assumed:

- **`sections` is an ARRAY, in authored order, and a kind may repeat.** The Green Street
  audit has two `{#approach}` and two `{#outcome}`; Spetema has two `{#approach}`. Keying
  sections by kind silently discards half of them. `get_project` returns the array.
- **The tokeniser here must match the one that built the index.** They sit either side of a
  boundary that forbids the import, so agreement is proved empirically instead — see below.

## What this emits

`TOOLS` — six tool descriptors, each `strict: true`, `additionalProperties: false`, every
property in `required`. An **optional** argument is a nullable type, not an omitted key
(`tag: {type: ["string","null"]}`): that is the portable strict-mode idiom. `minimum`,
`maximum`, `minItems` and `maxItems` are deliberately absent — strict schemas do not honour
them consistently, so bounds are enforced in the handler where they actually hold.

| Tool | Returns |
| --- | --- |
| `list_projects({tag, client, hasCaseStudy})` | compact records; all three filters nullable |
| `get_project({id})` | full project — ordered `sections[]`, metrics, links, media, tags, `chunkIds` |
| `list_experience({})` | 6 roles — org, role, period, location, mode, descriptor, bullets |
| `get_profile({})` | identity, location, availability, contact, skills, education, facts |
| `get_system_facts({})` | the design system's own numbers, corpus stats, the `meta` case study |
| `search_content({query, limit})` | ranked chunks with citations; `limit` clamped to 1..20 |

`RESPOND_TOOL` / `ANSWER_SCHEMA` — the final turn's forced tool. `blocks` is a **flat array
of a discriminated union**, never a tree: strict JSON Schema does not support recursion.

`validateBlocks` → `validateReferential` → `validateProvenance`, or `validateAnswer` for all
three in order.

## The entity gate — `gate.js`

`search_content` applies it **internally**, so both API surfaces get it and neither can
bypass it. Do not wrap a gate around the tool in a consumer; that is how the defect below
happened.

    the gate decides WHETHER · the ranker decides WHAT

Phase 1 measured why it exists: raw BM25 abstains on **0 of 11** unanswerable questions.
Gated, correct abstention is **90.9%** with ranking unchanged.

Matching is over **name surfaces only** — ids, orgs, roles, titles, clients, tags, skill
terms, fact titles. Never a body, and never a *sentence*: `experience.descriptor` is
deliberately excluded, because "sole designer for all client work" put the token `work` in
Studio Kipo's name surface and opened the gate for *"did he work at Google"* — the exact
question the gate exists to refuse. Each matched term contributes its corpus IDF from
`content.bm25.df`. **Nothing is tuned**, so no parameter could have been fitted to the eval.

**Why this is in the core, recorded because it was nearly not.** The gate was first written
inside `api/chat.js`, which made the web chat refuse correctly while `api/mcp.js` — same
tool, same corpus — served the ungated arm to anyone who added this server to their own
Claude. `lib/knowledge/` had been declared off-limits to two parallel agents so they could
not collide in it, so the gate landed in the only place it was allowed to land. **A scoping
decision taken for merge safety became an architectural defect**, and `api/CLAUDE.md`
already forbade it. Correctness outranks merge convenience.

`evals/run.mjs` imports this same `entityGate` for its `tools-gated` arm, so the published
numbers describe the shipped gate rather than a lookalike. The `bm25` arm deliberately calls
raw `search()` instead of the tool, because a gated baseline would make that arm identical
to `tools-gated` and the table would compare an arm against itself.

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
That is the retry signal: retry once, then degrade to an explicit "not on file" block.

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
node evals/run.mjs                 # exercises every arm and both gates
node scripts/check-boundaries.mjs  # the direction of the graph
```

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
- **Never do I/O beyond the one corpus read.** No network, no fetch, no second file. If a
  tool needs data that isn't in `content.json`, the fix is in `content/`, not here.
- **Never key sections by kind.** Kinds repeat. It is an ordered array.
- **Never let the query tokeniser drift from the index tokeniser.** Change one, change both,
  rebuild `content.json`, and `verifyTokeniser` must still pass.
- **Never tune `K1`/`B` against `evals/questions.json`.** Forty questions cannot support a
  hyperparameter search; fitting them would launder noise as a result. 1.2 / 0.75 are the
  standard defaults and stay there.
- **Never relax a gate to make an answer render.** A dropped block is the system working.
