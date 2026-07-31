#!/usr/bin/env node
/* ============================================================
   Retrieval eval — zero dependencies, offline, deterministic.

   evals/questions.json  →  a six-arm comparison table
                         →  evals/results.json
                         →  the <!-- content:evals-* --> regions of evals.html
                         →  evals/dist/page.json  (those same regions as data,
                            for the second renderer that must not scrape them)

   `node evals/run.mjs`                   run, print, write the artefacts
   `node evals/run.mjs --check`           run and fail if any artefact is stale (CI)
   `node evals/run.mjs --update-baseline` accept the current numbers as the baseline

   SCOPE: this measures the RETRIEVER, not the assistant. hit@k, MRR and
   abstention are properties of retrieval and need no model, so this runs free,
   offline and in CI on every commit. Answer-level metrics belong elsewhere:
   `evals/groundedness.mjs` is the manual, key-gated, never-in-CI pass that
   measures whether the prose follows from the chunks it cites.

   WHAT CHANGED IN THIS REVISION, and why each change is here rather than in
   lib/knowledge/ — this file measures, it does not repair:

     · every published rate now carries a 95% Wilson interval, and the
       regression gate compares a drop against that interval rather than
       against a flat 0.001. A gate three orders of magnitude finer than the
       sampling error fires on one question changing its mind.
     · exact McNemar on the per-question data measure() has always built and
       thrown away. Paired tests are the only way to say whether one arm beats
       another on 49 questions; margins alone cannot.
     · `separability` is decomposed. For a gated arm most of it is the
       abstention rate wearing a second name, and it was being printed beside
       `abstain` as if it were independent corroboration.
     · the `tools-only` arm now builds its name surface with the SHIPPED
       buildNameSurfaces() instead of a divergent local copy that still carried
       experience.descriptor. The published 72.7% abstain was the pre-fix
       number sitting in the table unremarked.
     · the eval's own vector cache is fingerprinted by CORPUS HASH, not by
       chunk count, and `--check` covers it. A count cannot see a reword.
     · a missing VOYAGE_API_KEY next to a .env file on disk is a mistake, not a
       choice, and it now says so and exits instead of republishing a table
       with the embeddings arms quietly deleted from it.
   ============================================================ */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  content,
  callTool,
  search,
  entityGate,
  buildNameSurfaces,
  tokenize,
  verifyTokeniser,
  validateReferential,
  validateProvenance,
  vectorsCorpusHash,
  vectorsStatus,
} from "../lib/knowledge/index.js";
import { wilson, meanInterval, mcnemarExact } from "./stats.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const CHECK = process.argv.includes("--check");
const UPDATE_BASELINE = process.argv.includes("--update-baseline");

const lf = (s) => s.replace(/\r\n/g, "\n");
const read = (...p) => readFileSync(join(root, ...p), "utf8");

/** How deep any arm is allowed to look. MRR is 0 past this. Production returns
 *  fewer — see SHIP_LIMIT below, which is read out of the shipped tool rather
 *  than copied from it. */
const DEPTH = 10;

/* ============================================================
   0. Preflight — the harness proves itself before it measures anything
   ============================================================ */
const preflight = [];

/* 0a. The query tokeniser must agree with the one that built the index. A
   mismatch does not throw; it loses recall silently, which would make every
   number below a measurement of a bug. */
const tok = verifyTokeniser(content);
if (!tok.ok) {
  console.error(
    `✗ tokeniser disagreement — the query tokeniser in lib/knowledge/search.js no longer\n` +
      `  reproduces the index in content/dist/content.json:\n  - ${tok.problems.join("\n  - ")}`
  );
  process.exit(1);
}
preflight.push(`tokeniser agreement  (${tok.chunks} chunks, ${tok.terms} terms reproduced exactly)`);

/* 0b. The two validators the whole accuracy story rests on. Cheap to assert,
   catastrophic to have silently inverted. */
{
  const problems = [];
  const realProject = content.projects[0].id;
  const realChunk = content.chunks[0].id;

  const refs = validateReferential([
    { type: "prose", text: "ok" },
    /* No `why` here: it was a free-text field on `project` blocks and it was
       REMOVED, because it was model-authored prose that nothing validated
       sitting in the same file that claims prose is the only model-authored
       text. The schema is `additionalProperties: false`, so passing it now
       fails checkShape and this fixture would test the wrong gate. */
    { type: "project", id: realProject },
    { type: "project", id: "no-such-project" },
    { type: "metric", projectId: realProject, metricIndex: 99 },
    { type: "sources", chunkIds: [realChunk, "project:nope#summary"] },
  ]);
  if (refs.blocks.length !== 2) problems.push(`referential gate kept ${refs.blocks.length} blocks, expected 2`);
  if (refs.ok) problems.push("referential gate reported ok on invented ids");

  const prov = validateProvenance(
    [
      { type: "prose", text: "ok" },
      { type: "sources", chunkIds: [realChunk, content.chunks[1].id] },
    ],
    null,
    [{ name: "search_content", input: {}, result: { results: [{ chunkId: realChunk }] } }]
  );
  if (prov.stripped.length !== 1) problems.push(`provenance gate stripped ${prov.stripped.length} sources, expected 1`);
  if (prov.blocks.find((b) => b.type === "sources")?.chunkIds.length !== 1) {
    problems.push("provenance gate did not trim the surviving sources block");
  }

  const provAll = validateProvenance(
    [{ type: "sources", chunkIds: ["project:nope#summary"] }],
    null,
    []
  );
  if (provAll.blocks.length !== 0) problems.push("provenance gate kept a sources block with nothing retrieved");

  if (problems.length) {
    console.error(`✗ validator self-test failed:\n  - ${problems.join("\n  - ")}`);
    process.exit(1);
  }
  preflight.push("validator self-test  (referential + provenance gates drop what they must)");
}

/* ============================================================
   0c. The corpus fingerprint — and the separator that is not a space

   THE SEPARATOR IS A NUL BYTE. scripts/build-vectors.mjs writes it as an
   explicit `SEP` constant precisely because a literal one renders as a space in
   every editor, in `git diff` and in a plain file read: anyone reimplementing
   the digest from the page would compute a different one, declare a current
   cache stale, and silently fall back to a worse ranker. This is the third
   copy of that construction (build-vectors.mjs, lib/knowledge/embed.js, here),
   and three copies of a hash function across two boundaries that forbid the
   import is exactly the shape verifyTokeniser exists for. So it gets the same
   treatment: computed independently, then RECONCILED against the shipped one.

   The reconciliation only works while content/dist/vectors.json is itself
   current, because that is the only place a corpus digest is published. When it
   is stale the cross-check cannot run and the preflight says so rather than
   passing quietly.
   ============================================================ */
const CORPUS_SEP = "\u0000"; /* NUL, written as an ESCAPE on purpose — a literal one renders as a space. */
const CORPUS_TEXTS = content.chunks.map((c) => `${c.heading}. ${c.text}`);
const sha16 = (s) => createHash("sha256").update(s).digest("hex").slice(0, 16);
const corpusHash = sha16(CORPUS_TEXTS.join(CORPUS_SEP));

{
  const shipped = vectorsStatus(content);
  if (!shipped.stale) {
    if (vectorsCorpusHash !== corpusHash) {
      console.error(
        `✗ corpus fingerprint disagreement — this runner computes ${corpusHash} while\n` +
          `  content/dist/vectors.json (which lib/knowledge/embed.js just certified as CURRENT)\n` +
          `  was built for ${vectorsCorpusHash}. The two digests are meant to be the same\n` +
          `  construction over the same text. Check the separator: it is a NUL byte, not a space.`
      );
      process.exit(1);
    }
    preflight.push(`corpus fingerprint   (${corpusHash} — agrees with content/dist/vectors.json)`);
  } else {
    preflight.push(
      `corpus fingerprint   (${corpusHash} — NOT cross-checked: content/dist/vectors.json is stale, ${shipped.reason})`
    );
  }
}

/* ============================================================
   0d. The production search limit, read out of the shipped tool

   audit 05 §2.7: SEARCH_LIMIT_DEFAULT is 8 in production while DEPTH is 10
   here, so any part of the table that depends on ranks 9 and 10 describes a
   configuration that does not ship. The constant is not exported, so rather
   than copy the number — a copy is what goes stale — the runner asks the tool.
   `searchContent` echoes the limit it actually applied.

   VOYAGE_API_KEY is removed for the duration of the probe so this stays
   offline: embedRank reads the key at call time and returns null without one,
   which drops it onto BM25 and makes no network request. The limit is the same
   either way; the point is that `node evals/run.mjs` never opens a socket
   outside the embeddings arm.
   ============================================================ */
const SHIP_LIMIT = await (async () => {
  const saved = process.env.VOYAGE_API_KEY;
  if (saved !== undefined) delete process.env.VOYAGE_API_KEY;
  try {
    const probe = await callTool("search_content", { query: "design system" });
    const n = Number(probe?.limit);
    return Number.isInteger(n) && n > 0 ? n : DEPTH;
  } finally {
    if (saved !== undefined) process.env.VOYAGE_API_KEY = saved;
  }
})();
preflight.push(
  `production depth     (search_content returns ${SHIP_LIMIT} by default; this suite measures to ${DEPTH})`
);

/* ============================================================
   1. The question set
   ============================================================ */
const QUESTION_FILE = JSON.parse(read("evals", "questions.json"));
const QUESTIONS = QUESTION_FILE.questions;

/* An invented expected id would score a question that nothing can answer, and
   would do it silently. Refuse to run. */
{
  const validIds = new Set(content.chunks.map((c) => c.id));
  const bad = [];
  const seen = new Set();
  for (const q of QUESTIONS) {
    if (seen.has(q.id)) bad.push(`duplicate question id "${q.id}"`);
    seen.add(q.id);
    for (const id of q.expectedChunkIds) {
      if (!validIds.has(id)) bad.push(`${q.id}: "${id}" is not a chunk id in content.json`);
    }
    if (q.expects !== undefined && q.expects !== "abstain" && q.expects !== "chunks") {
      bad.push(`${q.id}: expects "${q.expects}" — only "abstain" or "chunks" are meaningful`);
    }
  }
  if (bad.length) {
    console.error(`✗ questions.json is not usable:\n  - ${bad.join("\n  - ")}`);
    process.exit(1);
  }
}

/* Abstention is normally DERIVED from an empty expectedChunkIds, and `expects`
   overrides it. The override exists for one question and is printed by name,
   because a question that scores as abstention while carrying expected chunks
   is exactly the kind of quiet exception a reader is entitled to see. */
const isAbstention = (q) =>
  q.expects ? q.expects === "abstain" : q.expectedChunkIds.length === 0;

const OVERRIDDEN = QUESTIONS.filter(
  (q) => q.expects && q.expects === "abstain" !== (q.expectedChunkIds.length === 0)
);

const RETRIEVAL = QUESTIONS.filter((q) => !isAbstention(q));
const ABSTAIN = QUESTIONS.filter((q) => isAbstention(q));
preflight.push(
  `question set         (${QUESTIONS.length} questions — ${RETRIEVAL.length} retrieval, ${ABSTAIN.length} abstention` +
    (OVERRIDDEN.length ? `; ${OVERRIDDEN.map((q) => q.id).join(", ")} scored by explicit \`expects\`` : "") +
    `)`
);

/** Fingerprint of the questions this cache was embedded for. Adding, removing
 *  or rewording a question must invalidate the question vectors, and a count
 *  cannot see a reword any more than it can in the corpus. */
const questionsHash = sha16(QUESTIONS.map((q) => `${q.id}\u0000${q.question}`).join("\u0001"));

/* ============================================================
   2. Arm — tools-only

   A model-free stand-in for what the agent does with the corpus manifest in
   its system prompt: it can already see every project id, title, client, tag
   and one-line summary, so it navigates by name and calls get_project /
   list_experience / get_profile to READ rather than to FIND.

   THE SURFACE IS THE SHIPPED ONE. This arm used to build its own name surfaces
   inline, and that copy still carried `experience.descriptor` after gate.js
   dropped it — so the arm's published 72.7% abstain was literally the pre-fix
   number, sitting in the table unremarked while the page beside it described a
   gate that excluded the field. gate.js exports buildNameSurfaces "so the eval
   can construct a gate over a fixture"; not using it was a boundary violation
   by this repo's own rules. It now uses it, and this arm's abstain moves as a
   result. The move is a correction, not a regression.

   buildNameSurfaces returns {name, label, terms}. This arm reads `terms`, the
   union — it is deliberately NOT the gate. The gate applies a name/label split
   and a floor; this arm is IDF-weighted bag-of-names, which is what makes it a
   lower bound on structured routing rather than a second copy of `tools-gated`.

   Each matched term contributes its corpus IDF, so "spetema" (df 3) counts and
   "design" (df 29) barely does. That weighting comes from content.json's own
   statistics, not from these questions.
   ============================================================ */
const { N, df } = content.bm25;
const idf = (t) => Math.log(1 + (N - (df[t] ?? 0) + 0.5) / ((df[t] ?? 0) + 0.5));

/* Chunks each entity owns, in authored order — the order get_project returns. */
const chunksByEntity = new Map();
content.chunks.forEach((c, i) => {
  if (!chunksByEntity.has(c.entity)) chunksByEntity.set(c.entity, []);
  chunksByEntity.get(c.entity).push(i);
});

const nameSurfaces = buildNameSurfaces(content);

function armTools(question) {
  const terms = [...new Set(tokenize(question))];
  const scored = [];
  for (const surface of nameSurfaces) {
    let score = 0;
    for (const t of terms) if (surface.terms.has(t)) score += idf(t);
    if (score > 0) scored.push({ entity: surface.entity, score });
  }
  scored.sort((a, b) => b.score - a.score);

  const out = [];
  for (const { entity, score } of scored) {
    for (const i of chunksByEntity.get(entity) ?? []) {
      out.push({ chunkId: content.chunks[i].id, chunkIndex: i, score });
      if (out.length >= DEPTH) return out;
    }
  }
  return out;
}

/* ============================================================
   3. Arm — bm25
   ============================================================ */
function armBm25(question) {
  /* RAW search, deliberately not callTool("search_content"). The tool ranks
     with embeddings when a key and a fresh cache are present, so routing this
     arm through it would make the lexical baseline a semantic one on some
     machines and not others. This arm's whole job is to be the free, offline,
     zero-dependency floor every other arm is measured against. */
  return search(content, question, DEPTH).map((r) => ({
    chunkId: r.chunkId,
    chunkIndex: r.chunkIndex,
    score: r.score,
  }));
}

/* ============================================================
   3b. Arm — tools-gated  (POST-HOC, and no longer the shipped shape)

   BM25's ranking, refused outright when the entity gate reports no coverage.

   READ THIS BEFORE QUOTING THE ROW. When it was written, `search_content`
   applied the gate internally and returned nothing on a miss, so this arm
   described production. It does not any more: gate.js was moved above the tool
   in Wave 2 and `searchContent` now returns `{gateMatched, gateScore, results}`
   with the ranking intact on a miss. Nothing in api/chat.js or api/mcp.js
   filters on it — `summarize()` prints it into a trace string and that is the
   only consumer.

   So this arm, and `gated-embeddings` below, are now COUNTERFACTUALS: they
   measure what a caller would pay if it chose to refuse on a gate miss. That is
   worth measuring — it is the decision the system prompt is being trusted to
   make — but it is not a description of the deployed configuration, and it must
   not be quoted as one.

   It calls the SHIPPED gate from lib/knowledge/gate.js rather than
   approximating it with `armTools(...).length`, so the refusal it measures is
   the real one.
   ============================================================ */
function armToolsGated(question) {
  return entityGate(question) ? armBm25(question) : [];
}

/* ============================================================
   4. Arm — hybrid

   Tools first, BM25 appended beneath. This is the shape §1 actually proposes
   ("the model navigates a small, well-typed corpus through deterministic
   tools, with BM25 as an open-ended fallback") rather than a generic fusion
   baseline. Reciprocal rank fusion was considered and rejected: nobody is
   proposing to ship RRF here, and blending the two ranks would also destroy
   the tools arm's abstention, which is the property most worth measuring.
   ============================================================ */
function armHybrid(question) {
  const seen = new Set();
  const out = [];
  for (const hit of armTools(question)) {
    if (seen.has(hit.chunkIndex)) continue;
    seen.add(hit.chunkIndex);
    out.push(hit);
  }
  for (const hit of armBm25(question)) {
    if (out.length >= DEPTH) break;
    if (seen.has(hit.chunkIndex)) continue;
    seen.add(hit.chunkIndex);
    out.push(hit);
  }
  return out.slice(0, DEPTH);
}

/* ============================================================
   5. Arm — embeddings (Voyage), cache-gated

   Anthropic has no embeddings endpoint; Voyage is the recommended partner.
   The arm runs from the committed cache, and a key is needed only to BUILD
   that cache. Without either it SKIPS — it is not faked, and it is not quietly
   replaced by TF-IDF cosine relabelled "semantic".

   FRESHNESS IS BY DIGEST, NOT BY COUNT. The old guard was
   `cache.chunks.length === chunks.length && cache.questions.length ===
   questions.length`, which is the exact check scripts/build-vectors.mjs
   computes a corpusHash to avoid: "comparing a hash rather than a length means
   rewording a chunk invalidates the cache, which a count would silently miss."
   It missed one. A corpus rebuild that renamed an entity and reworded its
   chunks left 76 cached vectors against 76 live chunks, and the arm scored
   against text that no longer existed while every gate stayed green.
   ============================================================ */
const VOYAGE_MODEL = "voyage-3.5";
const VOYAGE_URL = "https://api.voyageai.com/v1/embeddings";
const VECTORS_PATH = join(here, "vectors.json");
const ENV_PATH = join(root, ".env");

async function voyageEmbed(texts, inputType, key) {
  const out = [];
  for (let i = 0; i < texts.length; i += 96) {
    const batch = texts.slice(i, i + 96);
    const res = await fetch(VOYAGE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({ input: batch, model: VOYAGE_MODEL, input_type: inputType }),
    });
    if (!res.ok) throw new Error(`Voyage ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const json = await res.json();
    for (const d of json.data.sort((a, b) => a.index - b.index)) out.push(d.embedding);
  }
  return out;
}

const dot = (a, b) => {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
};
const norm = (a) => Math.sqrt(dot(a, a));
const cosine = (a, b) => dot(a, b) / (norm(a) * norm(b) || 1);

/** @returns {{cache:object|null, state:"fresh"|"missing"|"stale", reason:string|null}} */
function readVectorCache() {
  if (!existsSync(VECTORS_PATH)) return { cache: null, state: "missing", reason: "evals/vectors.json does not exist" };
  let c;
  try {
    c = JSON.parse(readFileSync(VECTORS_PATH, "utf8"));
  } catch (e) {
    return { cache: null, state: "stale", reason: `evals/vectors.json is not valid JSON (${e.message})` };
  }
  if (c.model !== VOYAGE_MODEL) {
    return { cache: null, state: "stale", reason: `built with ${c.model}, this arm expects ${VOYAGE_MODEL}` };
  }
  if (c.corpusHash !== corpusHash) {
    return {
      cache: null,
      state: "stale",
      reason: c.corpusHash
        ? `built for corpus ${c.corpusHash}, this corpus is ${corpusHash}`
        : `carries no corpusHash at all — it predates the freshness check and cannot be trusted`,
    };
  }
  if (c.questionsHash !== questionsHash) {
    return {
      cache: null,
      state: "stale",
      reason: c.questionsHash
        ? `built for question set ${c.questionsHash}, this set is ${questionsHash}`
        : `carries no questionsHash at all — it predates the freshness check and cannot be trusted`,
    };
  }
  if (c.chunks?.length !== content.chunks.length || c.questions?.length !== QUESTIONS.length) {
    return { cache: null, state: "stale", reason: `vector counts disagree with the corpus and question set` };
  }
  return { cache: c, state: "fresh", reason: null };
}

async function buildEmbeddings(key) {
  const questionTexts = QUESTIONS.map((q) => q.question);
  const chunks = await voyageEmbed(CORPUS_TEXTS, "document", key);
  const questions = await voyageEmbed(questionTexts, "query", key);
  const cache = {
    $generatedBy: "evals/run.mjs — do not edit; rebuild with `node --env-file=.env evals/run.mjs`",
    model: VOYAGE_MODEL,
    dims: chunks[0]?.length ?? 0,
    corpusHash,
    questionsHash,
    chunkIds: content.chunks.map((c) => c.id),
    questionIds: QUESTIONS.map((q) => q.id),
    chunks,
    questions,
  };
  writeFileSync(VECTORS_PATH, JSON.stringify(cache));
  return cache;
}

function rankerFor(cache) {
  const byQuestionId = new Map(cache.questionIds.map((id, i) => [id, cache.questions[i]]));
  return (question, qid) => {
    const v = byQuestionId.get(qid);
    if (!v) return [];
    return content.chunks
      .map((c, i) => ({ chunkId: c.id, chunkIndex: i, score: Number(cosine(v, cache.chunks[i]).toFixed(4)) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, DEPTH);
  };
}

/* ============================================================
   6. Statistics

   Small n is a property of the result, not a footnote. At 49 retrieval
   questions a headline rate carries a Wilson interval 11–14 percentage points
   wide; the 16 abstention questions carry ±16–18, and `corpus-gap` at n=3
   carries ±37. Every rate below is published with its interval so nobody has to
   compute one to know which differences the table can support.

   The three formulae live in evals/stats.mjs, imported by this file and by
   evals/groundedness.mjs. They were inline here until the second consumer
   appeared; see the note at the top of that file about why a second copy was
   not the answer.
   ============================================================ */

function measure(armName, run) {
  const perQuestion = QUESTIONS.map((q) => {
    const hits = run(q.question, q.id);
    const want = new Set(q.expectedChunkIds);
    const rank = hits.findIndex((h) => want.has(h.chunkId)) + 1; // 0 = not found
    /* Entity rank is the softer, and in several places fairer, question:
       "did it find the right PROJECT", not "did it find the right paragraph
       of it". Chunk rank alone penalises an arm that returns
       project:domestina#approach for "what was Domestina about?" — which
       located the right thing and picked the wrong section of it. Both are
       reported; neither is a substitute for the other. */
    const entityRank = q.expectedEntity
      ? hits.findIndex((h) => content.chunks[h.chunkIndex].entity === q.expectedEntity) + 1
      : 0;
    return {
      id: q.id,
      category: q.category,
      shape: q.shape ?? "lookup",
      abstention: isAbstention(q),
      rank,
      entityRank,
      top1: hits[0]?.score ?? null,
      returned: hits.length,
      top: hits.slice(0, 3).map((h) => h.chunkId),
    };
  });

  const retrieval = perQuestion.filter((r) => !r.abstention);
  const abstain = perQuestion.filter((r) => r.abstention);

  const count = (rows, ok) => rows.filter(ok).length;
  const hitAt = (k) => wilson(count(retrieval, (r) => r.rank > 0 && r.rank <= k), retrieval.length);
  const entAt = (k) => wilson(count(retrieval, (r) => r.entityRank > 0 && r.entityRank <= k), retrieval.length);
  const rr = retrieval.map((r) => (r.rank > 0 ? 1 / r.rank : 0));
  const rrShip = retrieval.map((r) => (r.rank > 0 && r.rank <= SHIP_LIMIT ? 1 / r.rank : 0));

  /* Threshold-free separability, DECOMPOSED. "Is there ANY score cut that tells
     a question the corpus can answer from one it cannot?" — the fraction of
     (retrieval, abstention) pairs ordered correctly by top-1 score, ties half.

     Audit 05 §2.4: for a gated arm most of this is the abstention rate wearing
     a second name. A pair where the unanswerable side returned NOTHING is won
     by the refusal, not by the score scale, and `tools-gated` and
     `gated-embeddings` published an identical 0.920 across BM25 scores of
     4.70–21.88 and cosines of 0.24–0.59. A statistic invariant to replacing the
     entire ranker is not measuring the ranker. So the empty-driven part is
     separated out and the remainder — pairs where BOTH sides produced a score —
     is reported as the only part that is about ranking at all. */
  let ordered = 0;
  let pairs = 0;
  let emptyDriven = 0;
  let tied = 0;
  let scoredPairs = 0;
  let scoredOrdered = 0;
  let lostByRefusingAnAnswer = 0;
  for (const a of retrieval) {
    for (const b of abstain) {
      pairs++;
      const x = a.top1;
      const y = b.top1;
      const bothScored = typeof x === "number" && typeof y === "number";
      const xv = x ?? -Infinity;
      const yv = y ?? -Infinity;
      const win = xv > yv ? 1 : xv === yv ? 0.5 : 0;
      ordered += win;
      if (bothScored) {
        scoredPairs++;
        scoredOrdered += win;
      } else if (typeof x === "number" && y === null) {
        emptyDriven++;
      } else if (x === null && y === null) {
        tied++;
      } else {
        /* The arm returned nothing for an ANSWERABLE question while returning
           something for an unanswerable one — a pair it loses outright. The
           fourth bucket exists so the four shares sum to 100% and nobody has to
           wonder where the remainder went. */
        lostByRefusingAnAnswer++;
      }
    }
  }

  const byGroup = (key) => {
    const out = {};
    for (const r of perQuestion) {
      const g = (out[r[key]] ??= { n: 0, nRetrieval: 0, nAbstention: 0, hit3: 0, abstained: 0 });
      g.n++;
      if (r.abstention) {
        g.nAbstention++;
        g.abstained += r.returned === 0 ? 1 : 0;
      } else {
        g.nRetrieval++;
        g.hit3 += r.rank > 0 && r.rank <= 3 ? 1 : 0;
      }
    }
    for (const g of Object.values(out)) {
      /* A group is scored on whichever kind of question it is made of. Every
         group in this set is homogeneous; if one ever is not, `mixed` says so
         instead of averaging two different things into one cell. */
      g.mixed = g.nRetrieval > 0 && g.nAbstention > 0;
      g.abstention = g.nAbstention > 0 && g.nRetrieval === 0;
      g.score = g.abstention ? g.abstained / g.nAbstention : g.hit3 / (g.nRetrieval || 1);
      g.interval = g.abstention
        ? wilson(g.abstained, g.nAbstention)
        : wilson(g.hit3, g.nRetrieval || 1);
    }
    return out;
  };

  const abstainRate = wilson(count(abstain, (r) => r.returned === 0), abstain.length);

  return {
    arm: armName,
    hit1: hitAt(1),
    hit3: hitAt(3),
    hit5: hitAt(5),
    ent1: entAt(1),
    ent3: entAt(3),
    mrr: meanInterval(rr),
    mrrShip: meanInterval(rrShip),
    abstain: abstainRate,
    separability: pairs ? ordered / pairs : 0,
    separabilityScored: scoredPairs ? scoredOrdered / scoredPairs : null,
    separabilityDetail: { pairs, emptyDriven, tied, scoredPairs, lostByRefusingAnAnswer },
    retrievalTop1: range(retrieval.map((r) => r.top1)),
    abstainTop1: range(abstain.map((r) => r.top1)),
    byCategory: byGroup("category"),
    byShape: byGroup("shape"),
    perQuestion,
  };
}

function range(values) {
  const v = values.filter((x) => typeof x === "number");
  if (!v.length) return null;
  return { min: Math.min(...v), median: median(v), max: Math.max(...v) };
}
function median(v) {
  const s = [...v].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/* ============================================================
   7. Run
   ============================================================ */
const results = [
  measure("tools-only", armTools),
  measure("bm25", armBm25),
  measure("hybrid", armHybrid),
  measure("tools-gated", armToolsGated),
];

/* ---------- the embeddings arms, and the two ways they can be absent ----------

   The arm runs from the committed cache when one is FRESH, and needs a key only
   to build it. Gating on the key alone made the generated artefacts
   key-dependent; gating on the cache's mere existence let a stale one through,
   which is the defect this revision exists to close.

   T3 — a .env file on disk with no VOYAGE_API_KEY in the process is a MISTAKE,
   not a choice. `node evals/run.mjs` does not load .env; `node --env-file=.env
   evals/run.mjs` does. Running the first when you meant the second used to
   print `skipped`, delete two arms from the published table, and republish it
   with the strongest result in the repo silently missing. It now says so and
   exits. Where there is no .env at all — CI, a fresh clone — a missing key is a
   genuine choice and the arm skips as documented. */
const vectorCache = readVectorCache();
let embeddingsNote = null;
let embeddingsSkip = null;

{
  const key = process.env.VOYAGE_API_KEY;
  let cache = vectorCache.cache;

  if (!cache) {
    if (key) {
      try {
        cache = await buildEmbeddings(key);
        console.log(`✓ evals/vectors.json     (rebuilt — ${vectorCache.reason})`);
      } catch (e) {
        embeddingsSkip = `failed — ${e.message}`;
      }
    } else if (existsSync(ENV_PATH)) {
      console.error(
        `✗ VOYAGE_API_KEY is not set in this process, but ${join(root, ".env")} exists.\n` +
          `  The embeddings and gated-embeddings arms would be dropped and the table republished\n` +
          `  without them — deleting the strongest measured result in this repo rather than\n` +
          `  reporting it. Node does not read .env on its own. Run:\n\n` +
          `      node --env-file=.env evals/run.mjs\n\n` +
          `  Why the arms cannot run from the cache: ${vectorCache.reason}.\n` +
          `  If you genuinely mean to run the four free arms only, move .env aside first.`
      );
      process.exit(1);
    } else {
      embeddingsSkip = `skipped (${vectorCache.reason}; set VOYAGE_API_KEY to build it)`;
    }
  }

  if (cache) {
    const run = rankerFor(cache);
    results.push(measure("embeddings", run));

    /* A COUNTERFACTUAL, not the shipped configuration — see the note on
       `tools-gated`. Since Wave 2 the gate annotates and does not filter, so
       what ships is the row above this one. This row measures what refusing on
       a gate miss would cost: the gate matches entity NAMES, so a question that
       names nothing ("how far has he run?") is refused before the ranker sees
       it, even when the corpus holds the answer. That trade is the row's whole
       point, and it is now a trade the caller may decline. */
    results.push(measure("gated-embeddings", (q, qid) => (entityGate(q) ? run(q, qid) : [])));

    embeddingsNote = `${VOYAGE_MODEL}, ${cache.chunks.length} chunk + ${cache.questions.length} question vectors cached in evals/vectors.json (corpus ${cache.corpusHash})`;
  } else {
    embeddingsNote = embeddingsSkip;
    console.error(`! embeddings arm ${embeddingsSkip}`);
  }
}

const byArm = Object.fromEntries(results.map((r) => [r.arm, r]));
const has = (arm) => Boolean(byArm[arm]);

/* ---------- paired significance ----------

   The per-question data measure() builds has always been thrown away. These are
   the comparisons the numbers can actually support, computed on hit@3 over the
   retrieval questions, one row per question, exact two-sided McNemar.

   Read the `note` on each: an improvement between two arms that do not ship is
   not a justification for what does. */
const COMPARISONS = [
  ["embeddings", "bm25", "the ranker that ships against the free offline floor"],
  ["embeddings", "tools-only", "semantic ranking against structured name lookup"],
  ["bm25", "tools-only", "lexical ranking against structured name lookup"],
  ["bm25", "hybrid", "does appending BM25 beneath the tools arm cost anything"],
  ["gated-embeddings", "embeddings", "what refusing on a gate miss costs the ranker"],
  ["gated-embeddings", "bm25", "the gated counterfactual against free offline BM25"],
  ["tools-gated", "bm25", "what refusing on a gate miss costs BM25"],
];

const significance = [];
for (const [a, b, note] of COMPARISONS) {
  if (!has(a) || !has(b)) continue;
  const A = byArm[a].perQuestion.filter((r) => !r.abstention);
  const B = byArm[b].perQuestion.filter((r) => !r.abstention);
  let wins = 0;
  let losses = 0;
  const winIds = [];
  const lossIds = [];
  for (let i = 0; i < A.length; i++) {
    const okA = A[i].rank > 0 && A[i].rank <= 3;
    const okB = B[i].rank > 0 && B[i].rank <= 3;
    if (okA && !okB) {
      wins++;
      winIds.push(A[i].id);
    } else if (okB && !okA) {
      losses++;
      lossIds.push(A[i].id);
    }
  }
  significance.push({ a, b, note, ...mcnemarExact(wins, losses), winIds, lossIds });
}

/* `a` and `b` are ARM NAMES on these rows; the McNemar counts are `wins`,
   `losses` and `discordant`. They were `b` and `c` in the first draft of this
   file and the spread above silently overwrote the arm name with a number, so
   the printed table read "embeddings vs 0". Caught by running it; named here so
   the next person does not reintroduce the collision. */

/* ============================================================
   8. Print
   ============================================================ */
const pct = (x) => `${(x * 100).toFixed(1)}%`;
const num = (x) => x.toFixed(3);
const pp = (x) => `±${(x * 100).toFixed(1)}`;
/* `p = 0.0000` is not a p-value, it is a rounding artefact reported as certainty.
   An exact binomial tail is never zero; below the printable resolution it is
   reported as a bound. */
const pval = (p) => (p < 0.0001 ? `< 0.0001` : `= ${p.toFixed(4)}`);
const padEnd = (s, n) => String(s).padEnd(n);
const padStart = (s, n) => String(s).padStart(n);

for (const line of preflight) console.log(`✓ ${line}`);
console.log("");

/* 17 wide: "gated-embeddings" is 16 characters and the column must not collide
   with the numbers beside it. Widen this, not the numbers, when an arm is added.
   Each rate column carries its 95% half-width in percentage points beneath the
   value, because a table printed to 0.1pp against a ±20pp interval invites
   exactly the reading it cannot support. */
const COLS = [
  ["arm", 17, (r) => r.arm, () => ""],
  ["hit@1", 8, (r) => pct(r.hit1.p), (r) => pp(r.hit1.half)],
  ["hit@3", 8, (r) => pct(r.hit3.p), (r) => pp(r.hit3.half)],
  ["hit@5", 8, (r) => pct(r.hit5.p), (r) => pp(r.hit5.half)],
  ["MRR", 8, (r) => num(r.mrr.p), (r) => `±${r.mrr.half.toFixed(3)}`],
  ["ent@1", 8, (r) => pct(r.ent1.p), (r) => pp(r.ent1.half)],
  ["ent@3", 8, (r) => pct(r.ent3.p), (r) => pp(r.ent3.half)],
  ["abstain", 8, (r) => pct(r.abstain.p), (r) => pp(r.abstain.half)],
];

const rule = (ch) => console.log(COLS.map(([, w]) => ch.repeat(w)).join(" "));
console.log(COLS.map(([h, w], i) => (i ? padStart(h, w) : padEnd(h, w))).join(" "));
rule("─");
for (const r of results) {
  console.log(COLS.map(([, w, f], i) => (i ? padStart(f(r), w) : padEnd(f(r), w))).join(" "));
  console.log(COLS.map(([, w, , g], i) => (i ? padStart(g(r), w) : padEnd("", w))).join(" "));
}
if (!has("embeddings")) console.log(`${padEnd("embeddings", 17)} ${embeddingsNote}`);
rule("─");
console.log(
  `  ${RETRIEVAL.length} retrieval questions (hit@k, ent@k, MRR over top ${DEPTH}) · ` +
    `${ABSTAIN.length} abstention questions (abstain = returned nothing)`
);
console.log(`  hit@k = the right CHUNK in the top k · ent@k = the right ENTITY in the top k`);
console.log(
  `  ± is the 95% Wilson half-width (normal, for MRR). At n=${RETRIEVAL.length} one question is ${(100 / RETRIEVAL.length).toFixed(1)}pp,`
);
console.log(
  `  so any two arms whose intervals overlap are not separated by this table. Use the paired tests below.`
);
console.log(
  `  tools-gated and gated-embeddings are COUNTERFACTUALS. Since the gate moved above the tool it`
);
console.log(
  `  annotates rather than filters, so what ships is the ungated ranking with a coverage note attached.`
);

/* MRR at the depth production actually returns. audit 05 §2.7. */
{
  const drift = results.filter((r) => Math.abs(r.mrr.p - r.mrrShip.p) > 5e-4);
  if (SHIP_LIMIT >= DEPTH) {
    console.log(`  search_content returns ${SHIP_LIMIT} by default, so nothing above describes an unshipped depth.`);
  } else if (!drift.length) {
    console.log(
      `  search_content returns ${SHIP_LIMIT} by default; MRR recomputed at that depth is identical for every arm,`
    );
    console.log(`  so ranks ${SHIP_LIMIT + 1}–${DEPTH} contribute nothing and the tail is a difference on paper only.`);
  } else {
    console.log(`  search_content returns ${SHIP_LIMIT} by default. MRR truncated to that depth — the shipping number:`);
    for (const r of drift) {
      console.log(`    ${padEnd(r.arm, 17)} MRR ${num(r.mrr.p)} at depth ${DEPTH} → ${num(r.mrrShip.p)} at depth ${SHIP_LIMIT}`);
    }
  }
}

/* ---------- paired significance ---------- */
console.log("");
console.log(`paired significance — exact two-sided McNemar on hit@3, ${RETRIEVAL.length} retrieval questions`);
console.log("─".repeat(96));
for (const s of significance) {
  const verdict = s.p < 0.05 ? "significant" : s.discordant === 0 ? "identical" : "not significant";
  console.log(
    `  ${padEnd(`${s.a} vs ${s.b}`, 36)} ${padStart(`${s.wins}–${s.losses}`, 7)}  n=${padStart(s.discordant, 2)}  ` +
      `p ${padEnd(pval(s.p), 8)} ${verdict}`
  );
  console.log(`  ${padEnd("", 36)} ${s.note}`);
}
console.log(
  `  wins–losses counts only DISCORDANT questions; concordant ones carry no information in a paired test.`
);
console.log(`  Five discordant pairs cannot reach p<0.05 under an exact test — 0.0625 is the floor.`);

/* ---------- separability, decomposed ---------- */
console.log("");
console.log(`separability — and how much of it is the abstention rate under another name`);
console.log("─".repeat(96));
for (const r of results) {
  const d = r.separabilityDetail;
  const share = (n) => `${((n / (d.pairs || 1)) * 100).toFixed(0)}%`;
  console.log(
    `  ${padEnd(r.arm, 17)} ${num(r.separability)}  of ${d.pairs} pairs: ` +
      `${share(d.emptyDriven)} won by returning nothing, ${share(d.tied)} tied empty, ` +
      `${share(d.lostByRefusingAnAnswer)} lost by refusing an answerable one, ` +
      `${share(d.scoredPairs)} actually scored` +
      (r.separabilityScored === null ? "" : ` → ${num(r.separabilityScored)} on the scored pairs alone`)
  );
}
console.log(
  `  Only the last figure is about the RANKER. tools-gated and gated-embeddings agreeing on the first`
);
console.log(
  `  across BM25 scores and cosines is the proof: a statistic invariant to replacing the entire ranker`
);
console.log(`  is not measuring the ranker, and it is not independent corroboration of the abstain column.`);

/* Per-category hit@3 — the number that decides whether an arm ships for a
   question class, which is the decision §1 hands to this file. */
console.log("");
const cats = [...new Set(QUESTIONS.map((q) => q.category))];
const CW = 20;
console.log(padEnd("category", CW) + results.map((r) => padStart(r.arm, 18)).join(""));
console.log("─".repeat(CW + results.length * 18));
for (const c of cats) {
  const g = results[0].byCategory[c];
  const label = `${c}${g.abstention ? " *" : ""} (n=${g.abstention ? g.nAbstention : g.nRetrieval})`;
  console.log(
    padEnd(label, CW) +
      results.map((r) => padStart(r.byCategory[c] ? pct(r.byCategory[c].score) : "—", 18)).join("")
  );
  console.log(
    padEnd("", CW) +
      results.map((r) => padStart(r.byCategory[c] ? pp(r.byCategory[c].interval.half) : "", 18)).join("")
  );
}
console.log("─".repeat(CW + results.length * 18));
console.log(`  * abstention category — the score is the correct-abstention rate, not hit@3`);
console.log(`  ± is the 95% Wilson half-width. A cell at n=3 has an interval wider than 50pp; read it as such.`);

/* Per-shape hit@3 — added because the version-1 set was 52/54 plain lookup. */
console.log("");
const shapes = [...new Set(QUESTIONS.map((q) => q.shape ?? "lookup"))];
console.log(padEnd("question shape", CW) + results.map((r) => padStart(r.arm, 18)).join(""));
console.log("─".repeat(CW + results.length * 18));
for (const s of shapes) {
  const g = results[0].byShape[s];
  /* For a MIXED shape the cell is hit@3 over its retrieval members only, so the
     n printed beside it is that count and not the shape's total — a cell must
     never advertise a sample size larger than the one it was computed on. */
  const label = `${s}${g.mixed ? " †" : g.abstention ? " *" : ""} (n=${g.abstention ? g.nAbstention : g.nRetrieval}${g.mixed ? ` of ${g.n}` : ""})`;
  console.log(
    padEnd(label, CW) +
      results.map((r) => padStart(r.byShape[s] ? pct(r.byShape[s].score) : "—", 18)).join("")
  );
}
console.log("─".repeat(CW + results.length * 18));
console.log(`  * abstention shape · † mixed shape — the cell is hit@3 over its retrieval members only`);
console.log(`  Every shape but "lookup" has n ≤ 4. These cells locate a weakness; they do not measure one.`);

console.log("");
for (const r of results) {
  const a = r.retrievalTop1;
  const b = r.abstainTop1;
  console.log(
    `  ${padEnd(r.arm, 17)} top-1 score  answerable ${a ? `${a.min.toFixed(2)}–${a.max.toFixed(2)} (med ${a.median.toFixed(2)})` : "n/a"}` +
      `   unanswerable ${b ? `${b.min.toFixed(2)}–${b.max.toFixed(2)} (med ${b.median.toFixed(2)})` : "n/a — returned nothing"}`
  );
}

/* ============================================================
   9. Artefacts — results.json, the evals.html regions, dist/page.json
   ============================================================ */
function round(x) {
  return Number(x.toFixed(4));
}
const interval = (i) => ({ value: round(i.p), lo: round(i.lo), hi: round(i.hi), half: round(i.half) });

const summary = {
  $schema: "evals/results.schema — see evals/CLAUDE.md",
  version: 2,
  generatedBy: "evals/run.mjs — do not edit",
  contentVersion: content.version,
  corpusHash,
  questionsHash,
  corpus: {
    chunks: content.chunks.length,
    terms: Object.keys(content.bm25.df).length,
    avgdl: content.bm25.avgdl,
    projects: content.projects.length,
    experience: content.experience.length,
    manifestChars: JSON.stringify(content.manifest).length,
  },
  questions: {
    total: QUESTIONS.length,
    retrieval: RETRIEVAL.length,
    abstention: ABSTAIN.length,
    categories: Object.fromEntries(cats.map((c) => [c, QUESTIONS.filter((q) => q.category === c).length])),
    shapes: Object.fromEntries(
      shapes.map((s) => [s, QUESTIONS.filter((q) => (q.shape ?? "lookup") === s).length])
    ),
  },
  depth: { eval: DEPTH, production: SHIP_LIMIT },
  confidence: {
    method: "Wilson score interval, two-sided 95%; normal interval on the mean for MRR",
    note: `n=${RETRIEVAL.length} retrieval and n=${ABSTAIN.length} abstention questions. One question is ${round(1 / RETRIEVAL.length)} of a retrieval rate.`,
  },
  embeddings: embeddingsNote,
  arms: results.map((r) => ({
    arm: r.arm,
    hit1: interval(r.hit1),
    hit3: interval(r.hit3),
    hit5: interval(r.hit5),
    ent1: interval(r.ent1),
    ent3: interval(r.ent3),
    mrr: interval(r.mrr),
    mrrAtProductionDepth: interval(r.mrrShip),
    abstain: interval(r.abstain),
    separability: round(r.separability),
    separabilityScored: r.separabilityScored === null ? null : round(r.separabilityScored),
    separabilityDetail: r.separabilityDetail,
    byCategory: Object.fromEntries(
      Object.entries(r.byCategory).map(([k, v]) => [k, { score: round(v.score), n: v.abstention ? v.nAbstention : v.nRetrieval, half: round(v.interval.half) }])
    ),
    byShape: Object.fromEntries(
      Object.entries(r.byShape).map(([k, v]) => [k, { score: round(v.score), n: v.abstention ? v.nAbstention : v.nRetrieval, half: round(v.interval.half) }])
    ),
  })),
  significance: significance.map((s) => ({
    a: s.a,
    b: s.b,
    metric: "hit@3",
    test: "exact two-sided McNemar",
    wins: s.wins,
    losses: s.losses,
    discordant: s.discordant,
    /* Three significant figures, not four decimal places: an exact binomial
       tail of 1.5e-8 rounds to 0 at four places, and a stored `"p": 0` is a
       claim of certainty no test can make. */
    p: Number(s.p.toPrecision(3)),
    significant: s.p < 0.05,
    note: s.note,
    winIds: s.winIds,
    lossIds: s.lossIds,
  })),
};

/* ---------- evals.html regions, and evals/dist/page.json ----------

   Each region builder returns a MODEL — the region's content as data — and
   RENDERS its own HTML from that model. The two are not computed twice: the
   HTML is a function of the model, so `evals/dist/page.json` cannot carry a
   number the page does not show, which is the whole reason a second consumer
   is allowed a second serialization at all.

   Every string a model carries is the string that lands in evals.html, already
   HTML-escaped. Escaping happens when the model is BUILT, never when it is
   rendered — esc() is not idempotent, so a renderer that escaped again would
   double-encode the first ampersand anyone writes. */
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const best = (key) => Math.max(...results.map((r) => r[key].p ?? r[key]));

/** A `<p class="ev-note">` block. The model carries the prose lines unindented;
 *  this is the only place the two-space body indent is written. */
const noteHtml = (lines) => [`<p class="ev-note">`, ...lines.map((l) => `  ${l}`), `</p>`];

const summaryRegion = () => {
  const b = results.reduce((a, r) => (r.mrr.p > a.mrr.p ? r : a));
  const top = results.reduce((a, r) => (r.hit3.p > a.hit3.p ? r : a));
  const fact = (value, unit, title, label) => ({
    value: esc(value),
    unit: esc(unit),
    title: esc(title),
    label,
  });
  const facts = [
    fact(String(content.chunks.length), "", "Corpus", "Chunks in the whole index — the entire corpus fits in a system prompt."),
    fact(
      String(QUESTIONS.length),
      "",
      "Questions",
      `${RETRIEVAL.length} retrieval, ${ABSTAIN.length} abstention. Every expected id verified against content.json.`
    ),
    fact(
      pct(top.hit3.p).replace("%", ""),
      "%",
      "Best hit@3",
      `${esc(top.arm)} — 95% CI ${pct(top.hit3.lo)} to ${pct(top.hit3.hi)} on ${RETRIEVAL.length} questions. Best MRR is ${esc(b.arm)}.`
    ),
    fact(String(results.length), "", "Arms", `Measured offline, no model. ${esc(embeddingsNote)}`),
  ];
  return {
    kind: "facts",
    facts,
    html: [
      `<div class="facts">`,
      ...facts.flatMap((f) => [
        `  <div class="fact">`,
        `    <span class="fact__num">${f.value}${f.unit ? `<small>${f.unit}</small>` : ""}</span>`,
        `    <span class="fact__title">${f.title}</span>`,
        `    <span class="fact__label">${f.label}</span>`,
        `  </div>`,
      ]),
      `</div>`,
    ],
  };
};

/** A chip built from an already-escaped model row. */
const chip = (text, isBest) => `<span class="chip${isBest ? " chip--solid" : ""}">${text}</span>`;
const metricChip = (m) => chip(`${m.label} ${m.value}${m.half ? ` ${m.half}` : ""}`, m.best);

/* One `.chip--solid` per row marks the single best value in that column — the
   chip spec allows exactly one emphasised chip per group, so the row can carry
   at most one leader. `separability` is deliberately NOT a column an arm can
   lead: for a gated arm it is mostly the abstain column restated, and awarding
   it a win would be counting one fact twice. */
const solidFor = (r) => {
  const cols = ["hit1", "hit3", "hit5", "ent1", "ent3", "mrr", "abstain"];
  const led = cols.filter((k) => r[k].p === best(k) && r[k].p > 0);
  return led[0] ?? null;
};

/* The seven metric columns, in the order the page prints them. One list, read
   by both the model and the renderer, so a column cannot appear in the JSON and
   not on the page. */
const METRIC_COLUMNS = [
  ["hit1", "hit@1", (r) => pct(r.hit1.p), (r) => pp(r.hit1.half)],
  ["hit3", "hit@3", (r) => pct(r.hit3.p), (r) => pp(r.hit3.half)],
  ["hit5", "hit@5", (r) => pct(r.hit5.p), (r) => pp(r.hit5.half)],
  ["ent1", "ent@1", (r) => pct(r.ent1.p), (r) => pp(r.ent1.half)],
  ["ent3", "ent@3", (r) => pct(r.ent3.p), (r) => pp(r.ent3.half)],
  ["mrr", "MRR", (r) => num(r.mrr.p), (r) => `±${r.mrr.half.toFixed(3)}`],
  ["abstain", "abstain", (r) => pct(r.abstain.p), (r) => pp(r.abstain.half)],
];

const tableRegion = () => {
  const arms = results.map((r) => {
    const solid = solidFor(r);
    return {
      arm: esc(r.arm),
      counterfactual: r.arm === "tools-gated" || r.arm === "gated-embeddings",
      best: solid,
      metrics: METRIC_COLUMNS.map(([key, label, value, half]) => ({
        key,
        label: esc(label),
        value: esc(value(r)),
        half: esc(half(r)),
        best: solid === key,
      })),
    };
  });

  /* A skipped arm is a truthful row, never a substituted number. When the
     embeddings cache is absent this row says so in place of a metric row, and
     page.json carries the same row rather than a shorter table. */
  const skipped = has("embeddings")
    ? null
    : {
        arm: esc("embeddings"),
        text: `${esc(embeddingsNote)} — the arm is implemented and cache-gated, never faked. Anthropic has no embeddings endpoint; Voyage is the partner model.`,
      };

  const armsNote = [
    `Every ± is the half-width of a two-sided 95% Wilson interval on ${RETRIEVAL.length} retrieval or`,
    `${ABSTAIN.length} abstention questions — one question moves a retrieval rate by ${(100 / RETRIEVAL.length).toFixed(1)}pp.`,
    `Two arms whose intervals overlap are not separated by this table, which is what the paired`,
    `tests below are for. tools-gated and gated-embeddings are counterfactuals: since the entity`,
    `gate moved above the tool it annotates rather than filters, so the deployed ranking is the`,
    `ungated one with a coverage note attached.`,
  ];

  const paired = significance.map((s) => ({
    a: esc(s.a),
    b: esc(s.b),
    wins: s.wins,
    losses: s.losses,
    discordant: s.discordant,
    counts: `${s.wins}–${s.losses} of ${s.discordant} discordant`,
    p: `p ${esc(pval(s.p))}`,
    significant: s.p < 0.05,
    verdict: esc(s.p < 0.05 ? "significant" : "not significant"),
    note: esc(s.note),
  }));

  const pairedNote = [
    `Exact two-sided McNemar on hit@3, paired question by question. Only discordant questions —`,
    `ones the two arms disagree about — carry information, so the counts are small even where the`,
    `margin is large. Five discordant pairs cannot reach p&lt;0.05 under an exact test; 0.0625 is`,
    `the floor. A significant result here is a real difference; a non-significant one is a`,
    `difference this question set is too small to detect, not a demonstration of equality.`,
  ];

  const separability = results.map((r) => {
    const d = r.separabilityDetail;
    const share = (n) => `${((n / (d.pairs || 1)) * 100).toFixed(0)}%`;
    return {
      arm: esc(r.arm),
      allPairs: num(r.separability),
      emptyDriven: share(d.emptyDriven),
      tied: share(d.tied),
      lostByRefusingAnAnswer: share(d.lostByRefusingAnAnswer),
      scored: r.separabilityScored === null ? null : num(r.separabilityScored),
    };
  });

  const separabilityNote = [
    `separability is the fraction of (answerable, unanswerable) pairs that any top-1 score cut`,
    `orders correctly, ties counted half. It was previously printed beside abstain as independent`,
    `corroboration and it is not: for an arm that refuses, most pairs are won by the refusal rather`,
    `than by the score, which is why two arms with completely different score scales reported the`,
    `same figure. Only the last chip on each row is about ranking.`,
  ];

  const html = [`<dl class="tools">`];
  for (const a of arms) {
    html.push(
      `  <div class="tools__row">`,
      `    <dt>${a.arm}${a.counterfactual ? ` <span class="chip">counterfactual</span>` : ""}</dt>`,
      `    <dd class="chips">`,
      ...a.metrics.map((m) => `      ${metricChip(m)}`),
      `    </dd>`,
      `  </div>`
    );
  }
  if (skipped) {
    html.push(
      `  <div class="tools__row">`,
      `    <dt>${skipped.arm}</dt>`,
      `    <dd>${skipped.text}</dd>`,
      `  </div>`
    );
  }
  html.push(`</dl>`, ...noteHtml(armsNote));

  if (paired.length) {
    html.push(`<dl class="tools">`);
    for (const s of paired) {
      html.push(
        `  <div class="tools__row">`,
        `    <dt>${s.a} vs ${s.b}</dt>`,
        `    <dd class="chips">`,
        `      ${chip(s.counts, false)}`,
        `      ${chip(s.p, s.significant)}`,
        `      ${chip(s.verdict, false)}`,
        `      ${chip(s.note, false)}`,
        `    </dd>`,
        `  </div>`
      );
    }
    html.push(`</dl>`, ...noteHtml(pairedNote));
  }

  html.push(`<dl class="tools">`);
  for (const s of separability) {
    html.push(
      `  <div class="tools__row">`,
      `    <dt>separability · ${s.arm}</dt>`,
      `    <dd class="chips">`,
      `      ${chip(`all pairs ${s.allPairs}`, false)}`,
      `      ${chip(`${s.emptyDriven} won by returning nothing`, false)}`,
      `      ${chip(`${s.tied} tied empty`, false)}`,
      `      ${chip(`${s.lostByRefusingAnAnswer} lost by refusing an answerable one`, false)}`,
      `      ${chip(s.scored === null ? "no scored pairs" : `scored pairs only ${s.scored}`, false)}`,
      `    </dd>`,
      `  </div>`
    );
  }
  html.push(`</dl>`, ...noteHtml(separabilityNote));

  return { kind: "arms", arms, skipped, armsNote, paired, pairedNote, separability, separabilityNote, html };
};

const categoryRegion = () => {
  const categories = cats.map((c) => {
    const g0 = results[0].byCategory[c];
    const n = g0.abstention ? g0.nAbstention : g0.nRetrieval;
    const top = Math.max(...results.map((r) => r.byCategory[c]?.score ?? 0));
    /* At most one `--solid` chip per group (chip spec): the FIRST arm to reach
       the top score wears it, not every arm tied at the top. */
    const leader = top > 0 ? results.find((r) => (r.byCategory[c]?.score ?? 0) === top)?.arm : null;
    return {
      category: esc(c),
      n,
      nLabel: `${n} ${n === 1 ? "question" : "questions"}`,
      abstention: Boolean(g0.abstention),
      metric: g0.abstention ? "abstention rate" : "hit@3",
      leader: leader ?? null,
      arms: results.map((r) => ({
        key: r.arm,
        label: esc(r.arm),
        value: esc(pct(r.byCategory[c]?.score ?? 0)),
        half: esc(pp(r.byCategory[c]?.interval.half ?? 0)),
        best: r.arm === leader,
      })),
    };
  });

  const note = [
    `Each ± is a 95% Wilson half-width at that class's n. The smallest classes here carry intervals`,
    `wider than 40 percentage points, so a class winner is a direction to investigate rather than a`,
    `result. The per-class table decides nothing on its own.`,
  ];

  const html = [`<dl class="tools">`];
  for (const g of categories) {
    html.push(
      `  <div class="tools__row">`,
      `    <dt>${g.category}</dt>`,
      `    <dd class="chips">`,
      `      ${chip(g.nLabel, false)}`,
      `      ${chip(g.metric, false)}`,
      ...g.arms.map((a) => `      ${metricChip(a)}`),
      `    </dd>`,
      `  </div>`
    );
  }
  html.push(`</dl>`, ...noteHtml(note));
  return { kind: "categories", categories, note, html };
};

const corpusRegion = () => {
  const rows = [
    {
      term: "Chunks",
      definition: `${content.chunks.length} — one per authored section, across ${content.projects.length} projects and ${content.experience.length} roles.`,
    },
    {
      term: "Terms",
      definition: `${Object.keys(content.bm25.df).length} distinct terms, mean chunk length ${content.bm25.avgdl} tokens.`,
    },
    {
      term: "Manifest",
      definition: `${JSON.stringify(content.manifest).length} characters — every id, title and one-line summary. The complete table of contents fits in a system prompt.`,
    },
    {
      term: "Fingerprint",
      definition: `corpus <code>${corpusHash}</code> · questions <code>${questionsHash}</code> — both vector caches carry the corpus digest, so rewording a chunk invalidates them instead of being missed by a count.`,
    },
    {
      term: "Index size",
      definition: `Term statistics are precomputed at build time, so a query is a loop and a lookup — no service, no round trip, no idle cost.`,
    },
  ];
  return {
    kind: "definitions",
    rows,
    html: [
      `<dl class="tools">`,
      ...rows.map((r) => `  <div class="tools__row"><dt>${r.term}</dt><dd>${r.definition}</dd></div>`),
      `</dl>`,
    ],
  };
};

/* ---------- the reading region: content-authored prose, eval-supplied numbers ----------

   content/evals.json holds seven paragraphs with twelve declared {{evals:…}}
   placeholders, compiled into content.json as a non-chunked `evalsPage` field.
   scripts/build-content.mjs may not read evals/ (check-boundaries.mjs), so it
   ships the prose as a TEMPLATE and this runner — which has both the content
   and the numbers it just produced — substitutes.

   Three failures are all build failures, because the defect this replaces was a
   paragraph of hand-typed figures drifting from the table directly above it:
     · a declared token that never appears in the prose
     · a {{…}} token surviving substitution
     · a placeholder naming an arm that did not run
   The last is the important one. It means the page cannot advertise prose about
   the embeddings arm on a run where the embeddings arm was skipped. */
const readingRegion = () => {
  const src = content.evalsPage?.reading;
  if (!src?.html?.length || !src?.placeholders?.length) {
    console.error(
      `✗ content.json has no evalsPage.reading — the prose for evals.html section 04 is authored in\n` +
        `  content/evals.json and compiled by scripts/build-content.mjs. Run that build first.`
    );
    process.exit(1);
  }

  const fmt = (spec) => {
    if (spec.source === "questions") {
      const v = summary.questions[spec.field];
      if (typeof v !== "number") throw new Error(`questions.${spec.field} is not a number`);
      return String(v);
    }
    const arm = byArm[spec.arm];
    if (!arm) {
      throw new Error(
        `arm "${spec.arm}" did not run, so ${spec.token} cannot be filled. ` +
          `The page must not carry prose about an arm this run did not measure.`
      );
    }
    const metric = arm[spec.metric];
    const value = typeof metric === "number" ? metric : metric?.p;
    if (typeof value !== "number") throw new Error(`${spec.arm}.${spec.metric} is not a number`);
    switch (spec.format) {
      case "pct":
        return pct(value);
      case "num":
        return num(value);
      case "abstained":
        return String(Math.round(value * ABSTAIN.length));
      case "int":
        return String(Math.round(value));
      default:
        throw new Error(`unknown placeholder format "${spec.format}" on ${spec.token}`);
    }
  };

  let html = src.html.join("\n");
  const problems = [];
  for (const spec of src.placeholders) {
    if (!html.includes(spec.token)) {
      problems.push(`${spec.token} is declared in content/evals.json but appears in no paragraph`);
      continue;
    }
    try {
      html = html.split(spec.token).join(fmt(spec));
    } catch (e) {
      problems.push(`${spec.token}: ${e.message}`);
    }
  }
  const left = html.match(/\{\{[^}]*\}\}/g);
  if (left) problems.push(`unfilled placeholder(s) survived substitution: ${[...new Set(left)].join(", ")}`);
  if (problems.length) {
    console.error(
      `✗ evals.html reading region could not be built:\n  - ${problems.join("\n  - ")}\n` +
        `  An unfilled placeholder rendering literally on the page is the defect this substitution exists to end.`
    );
    process.exit(1);
  }
  /* One authored paragraph per line, exactly as content/evals.json holds them
     and exactly as they land on the page. This region is PROSE: it carries the
     owner's own markup (`<strong>`, `<em>`, `<code>`, curly quotes) with the
     numbers substituted in, and there is nothing tabular in it to structure. */
  const paragraphs = html.split("\n");
  return { kind: "prose", paragraphs, html: paragraphs };
};

function applyRegions(html, regions) {
  let out = lf(html);
  for (const [name, lines] of Object.entries(regions)) {
    const open = `<!-- content:${name} -->`;
    const close = `<!-- /content:${name} -->`;
    const start = out.indexOf(open);
    const end = out.indexOf(close, start);
    if (start === -1 || end === -1) {
      console.error(`✗ evals.html: region marker ${open} … ${close} not found`);
      process.exit(1);
    }
    const lineStart = out.lastIndexOf("\n", start) + 1;
    const at = out.slice(lineStart, start).length;
    const closeLineStart = out.lastIndexOf("\n", end) + 1;
    out =
      out.slice(0, start + open.length) +
      "\n" +
      lines.map((l) => (l === "" ? "" : " ".repeat(at) + l)).join("\n") +
      (lines.length ? "\n" : "") +
      out.slice(closeLineStart);
  }
  return out;
}

const REGION_MODELS = {
  "evals-summary": summaryRegion(),
  "evals-table": tableRegion(),
  "evals-categories": categoryRegion(),
  "evals-reading": readingRegion(),
  "evals-corpus": corpusRegion(),
};

/** What applyRegions() writes between each pair of markers in evals.html — the
 *  `html` a region model already rendered from itself, never a second build. */
const REGIONS = Object.fromEntries(Object.entries(REGION_MODELS).map(([name, m]) => [name, m.html]));

/* ============================================================
   9b. evals/dist/page.json — the same regions, for a second renderer

   apps/next/ publishes /evals too, and the alternative was for it to parse
   evals.html. A page that scrapes another page's markup for numbers is one
   whitespace change away from publishing something the runner never produced,
   and it would put a second copy of the substitution logic in a slice that
   cannot import this one.

   So this is a SERIALIZATION, not a second computation. Every value here is the
   object the region builder above already rendered its HTML from, which is why
   `regions[name].html` and the corresponding block of evals.html are the same
   array of strings — one indented to its marker column, one not. Nothing in
   this file is re-worded, re-rounded or re-derived, and there is no code path
   by which page.json can disagree with the page: both come from REGION_MODELS.
   ============================================================ */
const PAGE = {
  $schema: "evals/page.schema — see evals/CLAUDE.md",
  $doc: [
    "Generated by evals/run.mjs alongside evals/results.json and the <!-- content:evals-* --> regions of evals.html. Do not edit; `node evals/run.mjs --check` byte-compares this file and names it when it is stale.",
    "This is a serialization of the SAME numbers those two artefacts carry, structured so a renderer does not have to parse HTML or re-derive anything. Every figure was computed once, by the run that wrote all three.",
    "EVERY STRING UNDER `regions` IS HTML, already escaped exactly as it appears in evals.html. Render it as markup (dangerouslySetInnerHTML or equivalent), not as plain text, or an entity such as `&lt;` in the paired-test note will render literally. Do not escape it again.",
    "`regions[name].html` is the exact line array written between that region's markers in evals.html, for byte-verification. evals.html indents each line to its marker's column; these lines carry only their own relative indent. Prefer the structured fields beside it for rendering — `html` exists so a second renderer can prove it is showing the same thing.",
    "`regions['evals-reading']` is PROSE, authored in content/evals.json by the repo owner and substituted here. It has no structure to recover: ship each paragraph verbatim. Never re-word it, never re-flow a sentence around a number.",
    "n is small and the intervals are wide. Read `summary.confidence`, `summary.questions` and the per-metric `half` strings out of this file — never hard-code a sample size or a half-width into a page or a document, because both have moved before.",
    "A skipped arm is `regions['evals-table'].skipped` and a shorter `arms` array. It is never a substituted number from elsewhere; render the skip.",
  ],
  generatedBy: "evals/run.mjs — do not edit",
  version: 2,
  contentVersion: content.version,
  corpusHash,
  questionsHash,
  source: { page: "evals.html", results: "evals/results.json" },
  summary: {
    corpus: summary.corpus,
    questions: summary.questions,
    depth: summary.depth,
    confidence: summary.confidence,
    arms: results.map((r) => r.arm),
    embeddings: summary.embeddings,
    embeddingsMeasured: has("embeddings"),
  },
  regions: REGION_MODELS,
};

const outputs = [
  ["evals/results.json", JSON.stringify(summary, null, 2) + "\n"],
  ["evals/dist/page.json", JSON.stringify(PAGE, null, 2) + "\n"],
  ["evals.html", applyRegions(read("evals.html"), REGIONS)],
];

/* ============================================================
   10. Baseline — a regression is a failed build, not a footnote

   THE TOLERANCE IS THE SAMPLING ERROR, not 0.001. The old gate fired when a
   metric fell 0.001 below its floor: three orders of magnitude finer than the
   interval around the number it was guarding, so a single question changing its
   mind failed the build and got triaged as content drift by the slice contract's
   own list. A gate nobody believes is a gate somebody lowers.

   A drop must now exceed the 95% half-width of the metric — the WIDER of the
   half-widths at the baseline value and at the current one, so the rule does not
   depend on which side of the comparison you stand. It is still a committed
   FLOOR and it is still raised or lowered deliberately, with the reason on file;
   what changed is that it now fires on evidence rather than on noise.

   What this does NOT protect against: a slow slide of one question per commit,
   each inside the margin. That is the cost of the trade and it is stated here
   rather than discovered later. The defence is that the baseline is re-cut
   deliberately, and every re-cut records why.
   ============================================================ */
const BASELINE_PATH = join(here, "baseline.json");
const TRACKED = ["hit1", "hit3", "hit5", "ent1", "ent3", "mrr", "abstain"];
const TOLERANCE_FLOOR = 0.001; // still the floor, for the degenerate n=0 case

/** The margin below the baseline that counts as noise for this metric. */
function marginFor(r, k, baselineValue) {
  const n = r[k].n ?? 0;
  if (!n) return TOLERANCE_FLOOR;
  if (k === "mrr") return Math.max(r.mrr.half, TOLERANCE_FLOOR);
  const atCurrent = r[k].half;
  const atBaseline = wilson(Math.round(baselineValue * n), n).half;
  return Math.max(atCurrent, atBaseline, TOLERANCE_FLOOR);
}

console.log("");
if (UPDATE_BASELINE) {
  writeFileSync(
    BASELINE_PATH,
    JSON.stringify(
      {
        $schema: "evals/baseline.schema — see evals/CLAUDE.md",
        generatedBy: "evals/run.mjs --update-baseline",
        note:
          "Committed floor. run.mjs exits non-zero when a tracked metric falls below these by MORE THAN " +
          "the 95% sampling margin for that metric at this n — not by more than 0.001, which was finer " +
          "than the sampling error by three orders of magnitude and fired on one question. Raise it " +
          "deliberately; never lower it to make a build pass, and record the reason in `reason` below.",
        reason: readBaselineReason(),
        contentVersion: content.version,
        corpusHash,
        questionsHash,
        questions: QUESTIONS.length,
        n: { retrieval: RETRIEVAL.length, abstention: ABSTAIN.length },
        arms: Object.fromEntries(
          results.map((r) => [r.arm, Object.fromEntries(TRACKED.map((k) => [k, round(r[k].p)]))])
        ),
      },
      null,
      2
    ) + "\n"
  );
  console.log(`✓ evals/baseline.json    (updated — ${results.length} arms)`);
}

/** The reason a baseline was re-cut survives the re-cut. `--update-baseline`
 *  carries the previous file's `reason` forward unless `--reason "…"` supplies a
 *  new one, so re-baselining cannot silently erase why the last one moved. */
function readBaselineReason() {
  const flag = process.argv.indexOf("--reason");
  if (flag !== -1 && process.argv[flag + 1]) return process.argv[flag + 1];
  try {
    return JSON.parse(readFileSync(BASELINE_PATH, "utf8")).reason ?? "(not recorded)";
  } catch {
    return "(not recorded)";
  }
}

let regressed = [];
if (existsSync(BASELINE_PATH)) {
  const baseline = JSON.parse(readFileSync(BASELINE_PATH, "utf8"));
  const missing = results.filter((r) => !baseline.arms?.[r.arm]).map((r) => r.arm);
  const vanished = Object.keys(baseline.arms ?? {}).filter((a) => !has(a));
  for (const r of results) {
    const b = baseline.arms?.[r.arm];
    if (!b) continue;
    for (const k of TRACKED) {
      if (typeof b[k] !== "number") continue;
      const margin = marginFor(r, k, b[k]);
      if (r[k].p < b[k] - margin) {
        regressed.push(
          `${r.arm}.${k}: ${num(r[k].p)} < baseline ${num(b[k])} by more than the ${num(margin)} sampling margin`
        );
      }
    }
  }
  /* An arm that stops being measured is not a passing build. Deleting a row is
     the cheapest way to make a table look better. */
  for (const a of vanished) regressed.push(`arm "${a}" is in the baseline and did not run`);
  if (!regressed.length) {
    console.log(
      `✓ baseline               (no regression beyond sampling error across ${TRACKED.length} tracked metrics × ${results.length} arms` +
        (missing.length ? `; ${missing.join(", ")} not yet in the baseline` : "") +
        `)`
    );
  }
} else if (!UPDATE_BASELINE) {
  console.log(`! evals/baseline.json is missing — run \`node evals/run.mjs --update-baseline\` to write it`);
}

/* ============================================================
   11. Emit / check
   ============================================================ */
if (CHECK) {
  const stale = outputs.filter(([rel, want]) => {
    const path = join(root, rel);
    return !existsSync(path) || lf(readFileSync(path, "utf8")) !== lf(want);
  });

  /* evals/vectors.json is a generated, committed artefact and was not covered
     here — `--check` reported "2 up to date" while the third could be a corpus
     old. It cannot be regenerated for a byte comparison without a key, so it is
     checked the way build-vectors.mjs checks its own: by digest. */
  const vectorProblem =
    vectorCache.state === "fresh"
      ? null
      : `evals/vectors.json — ${vectorCache.reason}`;

  if (stale.length || vectorProblem) {
    console.error(
      `✗ eval artefacts are stale:\n  - ${[...stale.map(([r]) => r), ...(vectorProblem ? [vectorProblem] : [])].join("\n  - ")}\n` +
        `  The generated regions are rebuilt by: node evals/run.mjs\n` +
        `  A stale vector cache needs a key:     node --env-file=.env evals/run.mjs`
    );
    process.exit(1);
  }
  console.log(
    `✓ eval artefacts         (4 up to date: results.json, dist/page.json, evals.html, vectors.json @ corpus ${corpusHash})`
  );
} else {
  mkdirSync(join(here, "dist"), { recursive: true });
  for (const [rel, text] of outputs) writeFileSync(join(root, rel), lf(text));
  console.log(`✓ evals/results.json     (${results.length} arms, ${significance.length} paired tests)`);
  console.log(`✓ evals/dist/page.json   (${Object.keys(REGION_MODELS).length} regions + summary)`);
  console.log(`✓ evals.html             (${Object.keys(REGIONS).length} regions)`);
}

if (regressed.length) {
  console.error(`\n✗ regression against evals/baseline.json:\n  - ${regressed.join("\n  - ")}`);
  process.exit(1);
}
