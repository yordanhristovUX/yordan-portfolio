/* ============================================================
   Embedding ranker — the arm the eval chose

   Phase 1 ran five retrievers over 54 questions. Embeddings won every
   retrieval class:

       arm           hit@1   hit@3     MRR
       bm25          46.5%   74.4%   0.613
       embeddings    86.0%   93.0%   0.902

   The plan had argued against this, on the grounds that a corpus of 76 chunks
   does not need semantic search. That argument conflated two claims. Not
   provisioning a vector DATABASE was right — the vectors are a committed JSON
   file, no service, no index to rebuild, nothing billing at idle. Concluding
   that lexical retrieval was therefore SUFFICIENT did not follow, and the
   measurement refutes it by ~19 points.

   WHAT THIS DOES NOT FIX: abstention. Embeddings abstain on 0 of 11
   unanswerable questions, exactly like BM25 — cosine similarity finds a
   confident nearest neighbour for "did he work at Google?" just as term
   overlap does. The entity gate in gate.js is what refuses; this only ranks
   what survives it. Gate decides WHETHER, ranker decides WHAT.

   DEGRADATION IS THE POINT OF THE FALLBACK. Chunk vectors are committed, so
   they need no key. A QUERY still has to be embedded per request, which needs
   VOYAGE_API_KEY and a network round trip. Without either — no key, Voyage
   down, request slow — this returns null and search_content silently uses
   BM25. Worse ranking is a far better failure than a dead endpoint, and it
   means the MCP server keeps working for anyone who self-hosts without a key.
   ============================================================ */
import { readFileSync, existsSync } from "node:fs";

const MODEL = "voyage-3.5";
const URL_ = "https://api.voyageai.com/v1/embeddings";
const TIMEOUT_MS = 2500;

const VECTORS_URL = new URL("../../content/dist/vectors.json", import.meta.url);

/** Loaded once at module init, like the corpus itself. */
const cache = (() => {
  try {
    if (!existsSync(VECTORS_URL)) return null;
    const v = JSON.parse(readFileSync(VECTORS_URL, "utf8"));
    return v?.vectors?.length ? v : null;
  } catch {
    return null;
  }
})();

export const hasVectors = Boolean(cache);
export const vectorsModel = cache?.model ?? null;
export const vectorsCorpusHash = cache?.corpusHash ?? null;

function cosine(a, b) {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1);
}

async function embedQuery(query) {
  const key = process.env.VOYAGE_API_KEY;
  if (!key) return null;

  /* A ranking improvement is not worth hanging a request on. If Voyage has not
     answered in TIMEOUT_MS the caller gets BM25 and the user gets an answer. */
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(URL_, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      body: JSON.stringify({ model: MODEL, input: [query], input_type: "query" }),
      signal: ac.signal,
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.data?.[0]?.embedding ?? null;
  } catch {
    return null; // aborted, offline, malformed — all mean "use BM25"
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Rank chunks by cosine similarity to the query.
 * @returns {Promise<Array<{chunkId,chunkIndex,score}>|null>} null = unavailable, caller falls back.
 */
export async function embedRank(content, query, limit) {
  if (!cache) return null;

  /* A stale cache is worse than none: it would rank the query against vectors
     for text that no longer exists, silently and plausibly. */
  if (cache.chunkIds?.length !== content.chunks.length) return null;

  const qv = await embedQuery(String(query ?? ""));
  if (!qv) return null;

  return content.chunks
    .map((c, i) => ({
      chunkId: c.id,
      chunkIndex: i,
      score: Number(cosine(qv, cache.vectors[i]).toFixed(4)),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
