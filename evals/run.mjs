#!/usr/bin/env node
/* ============================================================
   Retrieval eval — zero dependencies, zero cost, zero API keys.

   evals/questions.json  →  a four-arm comparison table
                         →  evals/results.json
                         →  the <!-- content:evals-* --> regions of evals.html

   `node evals/run.mjs`                  run, print, write the artefacts
   `node evals/run.mjs --check`          run and fail if any artefact is stale (CI)
   `node evals/run.mjs --update-baseline` accept the current numbers as the baseline

   SCOPE: this measures the RETRIEVER, not the assistant. hit@k, MRR and
   abstention are properties of retrieval and need no model, so this runs free,
   offline and in CI on every commit. Answer-level metrics — citation validity
   in a real answer, turns per answer, latency, cost — need a live model and
   belong with api/chat.js in Phase 3. Nothing here calls a model API, and the
   embeddings arm is the one exception that would: it is gated behind
   VOYAGE_API_KEY and skips cleanly without one rather than being faked.

   The gate this is allowed to change: if an arm wins a question class, that
   arm ships and §1 of the plan is amended rather than defended.
   ============================================================ */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  content,
  callTool,
  search,
  entityGate,
  tokenize,
  verifyTokeniser,
  validateReferential,
  validateProvenance,
} from "../lib/knowledge/index.js";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const CHECK = process.argv.includes("--check");
const UPDATE_BASELINE = process.argv.includes("--update-baseline");

const lf = (s) => s.replace(/\r\n/g, "\n");
const read = (...p) => readFileSync(join(root, ...p), "utf8");

/** How deep any arm is allowed to look. MRR is 0 past this. */
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
    { type: "project", id: realProject, why: "real" },
    { type: "project", id: "no-such-project", why: "invented" },
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
   1. The question set
   ============================================================ */
const QUESTIONS = JSON.parse(read("evals", "questions.json")).questions;

/* An invented expected id would score a question that nothing can answer, and
   would do it silently. Refuse to run. */
{
  const validIds = new Set(content.chunks.map((c) => c.id));
  const bad = [];
  for (const q of QUESTIONS) {
    for (const id of q.expectedChunkIds) {
      if (!validIds.has(id)) bad.push(`${q.id}: "${id}" is not a chunk id in content.json`);
    }
  }
  if (bad.length) {
    console.error(`✗ questions.json references chunk ids that do not exist:\n  - ${bad.join("\n  - ")}`);
    process.exit(1);
  }
}

const RETRIEVAL = QUESTIONS.filter((q) => q.expectedChunkIds.length > 0);
const ABSTAIN = QUESTIONS.filter((q) => q.expectedChunkIds.length === 0);
preflight.push(
  `question set         (${QUESTIONS.length} questions — ${RETRIEVAL.length} retrieval, ${ABSTAIN.length} abstention)`
);

/* ============================================================
   2. Arm — tools-only

   A model-free stand-in for what the agent does with the corpus manifest in
   its system prompt: it can already see every project id, title, client, tag
   and one-line summary, so it navigates by name and calls get_project /
   list_experience / get_profile to READ rather than to FIND.

   Matching is over each entity's NAME SURFACE only — ids, titles, clients,
   tags, role and org names, skill terms, fact titles — never its body. Each
   matched term contributes its corpus IDF, so "spetema" (df 3) counts and
   "design" (df 40) barely does. That weighting comes from content.json's own
   statistics, not from these questions.

   An entity nobody named scores nothing, so the arm returns nothing. That
   abstention is a structural property, not a tuned threshold.
   ============================================================ */
const { N, df } = content.bm25;
const idf = (t) => Math.log(1 + (N - (df[t] ?? 0) + 0.5) / ((df[t] ?? 0) + 0.5));

/* Chunks each entity owns, in authored order — the order get_project returns. */
const chunksByEntity = new Map();
content.chunks.forEach((c, i) => {
  if (!chunksByEntity.has(c.entity)) chunksByEntity.set(c.entity, []);
  chunksByEntity.get(c.entity).push(i);
});

const nameSurfaces = [];
{
  const add = (entity, parts) =>
    nameSurfaces.push({ entity, terms: new Set(tokenize(parts.filter(Boolean).join(" "))) });

  for (const p of content.projects) {
    add(`project:${p.id}`, [
      p.id.replace(/-/g, " "),
      p.title,
      p.client,
      p.indexTitle,
      p.indexClient,
      p.cardType,
      ...(p.tags ?? []),
      ...(p.indexTags ?? []),
    ]);
  }
  for (const e of content.experience) {
    add(`experience:${e.id}`, [e.id.replace(/-/g, " "), e.org, e.role, e.descriptor]);
  }
  for (const c of content.capabilities) add(`capability:${c.id}`, [c.id.replace(/-/g, " "), c.title]);
  for (const [id, g] of Object.entries(content.skills.groups)) {
    add(`skills:${id}`, [id.replace(/-/g, " "), g.site?.term, g.cv?.term]);
  }
  for (const f of content.facts) add(`fact:${f.id}`, [f.id, f.title, f.unit]);
  add("profile", [
    content.profile.identity.name,
    content.profile.identity.role,
    ...content.profile.identity.disciplines,
    ...content.education.education.map((e) => `${e.qualification} ${e.institution}`),
    ...content.education.languages.map((l) => l.language),
    ...content.profile.rows.map((r) => r.term),
  ]);
}

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
  /* RAW search, deliberately not callTool("search_content"). The tool is now
     entity-gated in lib/knowledge/, which is correct for production and would
     be fatal here: it would make this arm identical to `tools-gated` and the
     published table would be comparing an arm against itself. This arm's whole
     job is to be the UNGATED baseline that shows what the gate is worth. */
  return search(content, question, DEPTH).map((r) => ({
    chunkId: r.chunkId,
    chunkIndex: r.chunkIndex,
    score: r.score,
  }));
}

/* ============================================================
   3b. Arm — tools-gated  (POST-HOC — read the caveat)

   This arm did not exist when the run started. Arms 1–3 showed a clean split:
   BM25 ranks better, tools-only is the only thing that knows when to say
   nothing, and concatenating them inherits the weakness of both. The obvious
   repair is to stop fusing RANKINGS and fuse RESPONSIBILITIES instead — let
   the manifest decide *whether* the corpus covers the question, and let BM25
   decide *what* to return once it does.

   It has no tuned parameter: the gate is "the tools arm matched some entity",
   the same structural condition arm 1 already uses, and the ranking is BM25
   untouched.

   It is nonetheless a hypothesis formed after seeing this test set, so it is
   labelled as such everywhere it is reported. It should be confirmed against
   questions written after it, not treated as established by the run that
   suggested it.
   ============================================================ */
function armToolsGated(question) {
  /* Calls the SHIPPED gate from lib/knowledge/gate.js rather than approximating
     it with `armTools(...).length`. This arm is now a measurement of the thing
     production actually runs, not of something that resembles it — which is the
     only way its numbers can be claimed for the deployed system. */
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
   5. Arm — embeddings (Voyage), gated

   Anthropic has no embeddings endpoint; Voyage is the recommended partner.
   Without VOYAGE_API_KEY this arm SKIPS — it is not faked, and it is not
   quietly replaced by TF-IDF cosine and relabelled "semantic". Vectors are
   cached to evals/vectors.json so the corpus is embedded once, at build time,
   and never again: 76 chunks × 1024 float32 is ~250 KB, which is the whole
   point being made in §1 about what "vector database" means at this size.
   ============================================================ */
const VOYAGE_MODEL = "voyage-3.5";
const VOYAGE_URL = "https://api.voyageai.com/v1/embeddings";
const VECTORS_PATH = join(here, "vectors.json");

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

async function buildEmbeddings(key) {
  const chunkTexts = content.chunks.map((c) => `${c.heading}. ${c.text}`);
  const questionTexts = QUESTIONS.map((q) => q.question);

  let cache = null;
  if (existsSync(VECTORS_PATH)) {
    const c = JSON.parse(readFileSync(VECTORS_PATH, "utf8"));
    if (c.model === VOYAGE_MODEL && c.chunks?.length === chunkTexts.length && c.questions?.length === questionTexts.length) {
      cache = c;
    }
  }
  if (!cache) {
    const chunks = await voyageEmbed(chunkTexts, "document", key);
    const questions = await voyageEmbed(questionTexts, "query", key);
    cache = { model: VOYAGE_MODEL, dims: chunks[0]?.length ?? 0, chunks, questions, questionIds: QUESTIONS.map((q) => q.id) };
    writeFileSync(VECTORS_PATH, JSON.stringify(cache));
  }
  const byQuestionId = new Map((cache.questionIds ?? QUESTIONS.map((q) => q.id)).map((id, i) => [id, cache.questions[i]]));

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
   6. Metrics
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
      abstention: q.expectedChunkIds.length === 0,
      rank,
      entityRank,
      top1: hits[0]?.score ?? null,
      returned: hits.length,
      top: hits.slice(0, 3).map((h) => h.chunkId),
    };
  });

  const retrieval = perQuestion.filter((r) => !r.abstention);
  const abstain = perQuestion.filter((r) => r.abstention);

  const rate = (rows, ok) => (rows.length ? rows.filter(ok).length / rows.length : 0);
  const hitAt = (k) => rate(retrieval, (r) => r.rank > 0 && r.rank <= k);
  const entAt = (k) => rate(retrieval, (r) => r.entityRank > 0 && r.entityRank <= k);
  const mrr = retrieval.length
    ? retrieval.reduce((s, r) => s + (r.rank > 0 ? 1 / r.rank : 0), 0) / retrieval.length
    : 0;

  /* Threshold-free separability. "Is there ANY score cut that tells a question
     the corpus can answer from one it cannot?" — computed as the fraction of
     (retrieval, abstention) pairs ordered correctly by top-1 score, ties half.
     Picking a single threshold instead would mean tuning on the test set. */
  let ordered = 0;
  let pairs = 0;
  for (const a of retrieval) {
    for (const b of abstain) {
      pairs++;
      const x = a.top1 ?? -Infinity;
      const y = b.top1 ?? -Infinity;
      if (x > y) ordered += 1;
      else if (x === y) ordered += 0.5;
    }
  }

  const byCategory = {};
  for (const r of perQuestion) {
    const c = (byCategory[r.category] ??= { n: 0, hit3: 0, abstained: 0, abstention: r.abstention });
    c.n++;
    if (r.abstention) c.abstained += r.returned === 0 ? 1 : 0;
    else c.hit3 += r.rank > 0 && r.rank <= 3 ? 1 : 0;
  }
  for (const c of Object.values(byCategory)) {
    c.score = c.abstention ? c.abstained / c.n : c.hit3 / c.n;
  }

  return {
    arm: armName,
    hit1: hitAt(1),
    hit3: hitAt(3),
    hit5: hitAt(5),
    ent1: entAt(1),
    ent3: entAt(3),
    mrr,
    abstain: rate(abstain, (r) => r.returned === 0),
    separability: pairs ? ordered / pairs : 0,
    retrievalTop1: range(retrieval.map((r) => r.top1)),
    abstainTop1: range(abstain.map((r) => r.top1)),
    byCategory,
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

/* The arm runs from the committed vector cache when one is present, and only
   needs a key to BUILD that cache. Gating on the key alone made the generated
   artefacts key-dependent: a run with a key wrote five arms, and `--check` in
   CI — which has no key — then recomputed four and called them stale. The
   cache is the thing that makes this arm reproducible offline, so the cache is
   what the gate should ask about. A key is still required if the cache is
   missing or has gone stale against the corpus. */
const hasVectorCache = existsSync(VECTORS_PATH);
let embeddingsNote = hasVectorCache
  ? "skipped (cached vectors are stale — set VOYAGE_API_KEY to rebuild)"
  : "skipped (no cached vectors and no VOYAGE_API_KEY)";
if (process.env.VOYAGE_API_KEY || hasVectorCache) {
  try {
    const run = await buildEmbeddings(process.env.VOYAGE_API_KEY);
    results.push(measure("embeddings", run));

    /* THE SHIPPED CONFIGURATION. lib/knowledge/ gates with entityGate and ranks
       with embeddings, so this row — not `embeddings` and not `tools-gated` —
       is what api/chat.js and api/mcp.js actually do. It was added the moment
       the two were combined in production, because a deployed configuration
       that appears in no row of the table is exactly the unmeasured claim this
       whole suite exists to prevent.

       Expect it to cost recall against ungated `embeddings`: the gate matches
       entity NAMES, so a question that names nothing ("how far has he run?")
       is refused before the ranker ever sees it, even when the corpus holds
       the answer. That trade is the row's whole point — it is what buys the
       abstention that ungated embeddings does not have. */
    results.push(measure("gated-embeddings", (q, qid) => (entityGate(q) ? run(q, qid) : [])));

    embeddingsNote = `${VOYAGE_MODEL}, vectors cached in evals/vectors.json`;
  } catch (e) {
    embeddingsNote = `failed — ${e.message}`;
    console.error(`! embeddings arm ${embeddingsNote}`);
  }
}

/* ============================================================
   8. Print
   ============================================================ */
const pct = (x) => `${(x * 100).toFixed(1)}%`;
const num = (x) => x.toFixed(3);
const padEnd = (s, n) => String(s).padEnd(n);
const padStart = (s, n) => String(s).padStart(n);

for (const line of preflight) console.log(`✓ ${line}`);
console.log("");

/* 17 wide: "gated-embeddings" is 16 characters and the column must not collide
   with the numbers beside it. Widen this, not the numbers, when an arm is added. */
const COLS = [
  ["arm", 17, (r) => r.arm],
  ["hit@1", 7, (r) => pct(r.hit1)],
  ["hit@3", 7, (r) => pct(r.hit3)],
  ["hit@5", 7, (r) => pct(r.hit5)],
  ["MRR", 7, (r) => num(r.mrr)],
  ["ent@1", 7, (r) => pct(r.ent1)],
  ["ent@3", 7, (r) => pct(r.ent3)],
  ["abstain", 8, (r) => pct(r.abstain)],
  ["sep.", 6, (r) => num(r.separability)],
];

const rule = (ch) => console.log(COLS.map(([, w]) => ch.repeat(w)).join(" "));
console.log(COLS.map(([h, w], i) => (i ? padStart(h, w) : padEnd(h, w))).join(" "));
rule("─");
for (const r of results) {
  console.log(COLS.map(([, w, f], i) => (i ? padStart(f(r), w) : padEnd(f(r), w))).join(" "));
}
if (!results.some((r) => r.arm === "embeddings")) {
  console.log(`${padEnd("embeddings", 13)} ${embeddingsNote}`);
}
rule("─");
console.log(
  `  ${RETRIEVAL.length} retrieval questions (hit@k, ent@k, MRR over top ${DEPTH}) · ` +
    `${ABSTAIN.length} abstention questions (abstain = returned nothing)`
);
console.log(`  hit@k = the right CHUNK in the top k · ent@k = the right ENTITY in the top k`);
console.log(
  `  sep. = fraction of (retrieval, abstention) pairs a top-1 score cut orders correctly; 0.5 is chance`
);
console.log(
  `  tools-gated is POST-HOC — it was written after seeing arms 1-3 on this same set. Treat as a hypothesis.`
);

/* Per-category hit@3 — the number that decides whether an arm ships for a
   question class, which is the decision §1 hands to this file. */
console.log("");
const cats = [...new Set(QUESTIONS.map((q) => q.category))];
const CW = 17;
console.log(padEnd("category", CW) + results.map((r) => padStart(r.arm, 18)).join(""));
console.log("─".repeat(CW + results.length * 18));
for (const c of cats) {
  const isAbstain = QUESTIONS.find((q) => q.category === c).expectedChunkIds.length === 0;
  const label = `${c}${isAbstain ? " *" : ""}`;
  console.log(
    padEnd(label, CW) +
      results.map((r) => padStart(r.byCategory[c] ? pct(r.byCategory[c].score) : "—", 18)).join("")
  );
}
console.log("─".repeat(CW + results.length * 13));
console.log(`  * abstention category — the score is the correct-abstention rate, not hit@3`);

console.log("");
for (const r of results) {
  const a = r.retrievalTop1;
  const b = r.abstainTop1;
  console.log(
    `  ${padEnd(r.arm, 12)} top-1 score  answerable ${a ? `${a.min.toFixed(2)}–${a.max.toFixed(2)} (med ${a.median.toFixed(2)})` : "n/a"}` +
      `   unanswerable ${b ? `${b.min.toFixed(2)}–${b.max.toFixed(2)} (med ${b.median.toFixed(2)})` : "n/a — returned nothing"}`
  );
}

/* ============================================================
   9. Artefacts — results.json and the evals.html regions
   ============================================================ */
const summary = {
  $schema: "evals/results.schema — see evals/CLAUDE.md",
  version: 1,
  generatedBy: "evals/run.mjs — do not edit",
  contentVersion: content.version,
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
    categories: Object.fromEntries(
      cats.map((c) => [c, QUESTIONS.filter((q) => q.category === c).length])
    ),
  },
  depth: DEPTH,
  embeddings: embeddingsNote,
  arms: results.map((r) => ({
    arm: r.arm,
    hit1: round(r.hit1),
    hit3: round(r.hit3),
    hit5: round(r.hit5),
    ent1: round(r.ent1),
    ent3: round(r.ent3),
    mrr: round(r.mrr),
    abstain: round(r.abstain),
    separability: round(r.separability),
    byCategory: Object.fromEntries(Object.entries(r.byCategory).map(([k, v]) => [k, round(v.score)])),
  })),
};
function round(x) {
  return Number(x.toFixed(4));
}

/* ---------- evals.html regions ---------- */
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const best = (key) => Math.max(...results.map((r) => r[key]));

const summaryRegion = () => {
  const b = results.reduce((a, r) => (r.mrr > a.mrr ? r : a));
  const cells = [
    [String(content.chunks.length), "", "Corpus", "Chunks in the whole index — the entire corpus fits in a system prompt."],
    [String(QUESTIONS.length), "", "Questions", `${RETRIEVAL.length} retrieval, ${ABSTAIN.length} abstention. Every expected id verified against content.json.`],
    [pct(best("hit3")).replace("%", ""), "%", "Best hit@3", `${b.arm} — the winning arm on rank quality across all retrieval questions.`],
    [String(results.length), "", "Arms", `Measured offline, no model, no API key. ${esc(embeddingsNote)}`],
  ];
  return [
    `<div class="facts">`,
    ...cells.flatMap(([n, unit, title, label]) => [
      `  <div class="fact">`,
      `    <span class="fact__num">${esc(n)}${unit ? `<small>${esc(unit)}</small>` : ""}</span>`,
      `    <span class="fact__title">${esc(title)}</span>`,
      `    <span class="fact__label">${label}</span>`,
      `  </div>`,
    ]),
    `</div>`,
  ];
};

const metricCell = (label, value, isBest) =>
  `<span class="chip${isBest ? " chip--solid" : ""}">${esc(label)} ${esc(value)}</span>`;

/* One `.chip--solid` per row marks the single best value in that column — the
   chip spec allows exactly one emphasised chip per group, so the row can carry
   at most one leader. Where an arm leads several columns the emphasis would
   double up, so `--solid` is reserved for the arm's own strongest column. */
const solidFor = (r) => {
  const cols = ["hit1", "hit3", "hit5", "ent1", "ent3", "mrr", "abstain", "separability"];
  const led = cols.filter((k) => r[k] === best(k) && r[k] > 0);
  return led[0] ?? null;
};

const tableRegion = () => {
  const out = [`<dl class="tools">`];
  for (const r of results) {
    const solid = solidFor(r);
    out.push(
      `  <div class="tools__row">`,
      `    <dt>${esc(r.arm)}${r.arm === "tools-gated" ? ` <span class="chip">post-hoc</span>` : ""}</dt>`,
      `    <dd class="chips">`,
      `      ${metricCell("hit@1", pct(r.hit1), solid === "hit1")}`,
      `      ${metricCell("hit@3", pct(r.hit3), solid === "hit3")}`,
      `      ${metricCell("hit@5", pct(r.hit5), solid === "hit5")}`,
      `      ${metricCell("ent@1", pct(r.ent1), solid === "ent1")}`,
      `      ${metricCell("ent@3", pct(r.ent3), solid === "ent3")}`,
      `      ${metricCell("MRR", num(r.mrr), solid === "mrr")}`,
      `      ${metricCell("abstain", pct(r.abstain), solid === "abstain")}`,
      `      ${metricCell("separability", num(r.separability), solid === "separability")}`,
      `    </dd>`,
      `  </div>`
    );
  }
  if (!results.some((r) => r.arm === "embeddings")) {
    out.push(
      `  <div class="tools__row">`,
      `    <dt>embeddings</dt>`,
      `    <dd>${esc(embeddingsNote)} — the arm is implemented and gated, never faked. Anthropic has no embeddings endpoint; Voyage is the partner model.</dd>`,
      `  </div>`
    );
  }
  out.push(`</dl>`);
  return out;
};

const categoryRegion = () => {
  const out = [`<dl class="tools">`];
  for (const c of cats) {
    const isAbstain = QUESTIONS.find((q) => q.category === c).expectedChunkIds.length === 0;
    const n = QUESTIONS.filter((q) => q.category === c).length;
    const top = Math.max(...results.map((r) => r.byCategory[c]?.score ?? 0));
    /* At most one `--solid` chip per group (chip spec): the FIRST arm to reach
       the top score wears it, not every arm tied at the top. */
    const leader = top > 0 ? results.find((r) => (r.byCategory[c]?.score ?? 0) === top)?.arm : null;
    out.push(
      `  <div class="tools__row">`,
      `    <dt>${esc(c)}</dt>`,
      `    <dd class="chips">`,
      `      <span class="chip">${n} ${n === 1 ? "question" : "questions"}</span>`,
      `      <span class="chip">${isAbstain ? "abstention rate" : "hit@3"}</span>`,
      ...results.map(
        (r) => `      ${metricCell(r.arm, pct(r.byCategory[c]?.score ?? 0), r.arm === leader)}`
      ),
      `    </dd>`,
      `  </div>`
    );
  }
  out.push(`</dl>`);
  return out;
};

const corpusRegion = () => [
  `<dl class="tools">`,
  `  <div class="tools__row"><dt>Chunks</dt><dd>${content.chunks.length} — one per authored section, across ${content.projects.length} projects and ${content.experience.length} roles.</dd></div>`,
  `  <div class="tools__row"><dt>Terms</dt><dd>${Object.keys(content.bm25.df).length} distinct terms, mean chunk length ${content.bm25.avgdl} tokens.</dd></div>`,
  `  <div class="tools__row"><dt>Manifest</dt><dd>${JSON.stringify(content.manifest).length} characters — every id, title and one-line summary. The complete table of contents fits in a system prompt.</dd></div>`,
  `  <div class="tools__row"><dt>Index size</dt><dd>Term statistics are precomputed at build time, so a query is a loop and a lookup — no service, no round trip, no idle cost.</dd></div>`,
  `</dl>`,
];

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

const outputs = [
  ["evals/results.json", JSON.stringify(summary, null, 2) + "\n"],
  [
    "evals.html",
    applyRegions(read("evals.html"), {
      "evals-summary": summaryRegion(),
      "evals-table": tableRegion(),
      "evals-categories": categoryRegion(),
      "evals-corpus": corpusRegion(),
    }),
  ],
];

/* ============================================================
   10. Baseline — a regression is a failed build, not a footnote
   ============================================================ */
const BASELINE_PATH = join(here, "baseline.json");
const TRACKED = ["hit1", "hit3", "hit5", "ent1", "ent3", "mrr", "abstain"];
const TOLERANCE = 0.001;

console.log("");
if (UPDATE_BASELINE) {
  writeFileSync(
    BASELINE_PATH,
    JSON.stringify(
      {
        $schema: "evals/baseline.schema — see evals/CLAUDE.md",
        generatedBy: "evals/run.mjs --update-baseline",
        note: "Committed floor. run.mjs exits non-zero if any tracked metric falls below these. Raise it deliberately; never lower it to make a build pass.",
        contentVersion: content.version,
        questions: QUESTIONS.length,
        arms: Object.fromEntries(
          results.map((r) => [r.arm, Object.fromEntries(TRACKED.map((k) => [k, round(r[k])]))])
        ),
      },
      null,
      2
    ) + "\n"
  );
  console.log(`✓ evals/baseline.json    (updated — ${results.length} arms)`);
}

let regressed = [];
if (existsSync(BASELINE_PATH)) {
  const baseline = JSON.parse(readFileSync(BASELINE_PATH, "utf8"));
  for (const r of results) {
    const b = baseline.arms?.[r.arm];
    if (!b) continue;
    for (const k of TRACKED) {
      if (typeof b[k] === "number" && r[k] < b[k] - TOLERANCE) {
        regressed.push(`${r.arm}.${k}: ${num(r[k])} < baseline ${num(b[k])}`);
      }
    }
  }
  if (!regressed.length) console.log(`✓ baseline               (no regression across ${TRACKED.length} tracked metrics)`);
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
  if (stale.length) {
    console.error(
      `✗ eval artefacts are stale:\n  - ${stale.map(([r]) => r).join("\n  - ")}\n` +
        `  These regions are GENERATED. Run: node evals/run.mjs`
    );
    process.exit(1);
  }
  console.log(`✓ eval artefacts         (${outputs.length} up to date)`);
} else {
  for (const [rel, text] of outputs) writeFileSync(join(root, rel), lf(text));
  console.log(`✓ evals/results.json     (${results.length} arms)`);
  console.log(`✓ evals.html             (4 regions)`);
}

if (regressed.length) {
  console.error(`\n✗ regression against evals/baseline.json:\n  - ${regressed.join("\n  - ")}`);
  process.exit(1);
}
