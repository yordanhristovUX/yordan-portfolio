/* ============================================================
   Shared helpers for the behavioural suite.

   NOT a test file — it exports helpers and registers no tests. It lives under
   test/helpers/ rather than test/ so the runner does not treat it as a suite.

   Everything here is written against the TARGET contract, not against current
   behaviour. Where a Wave-2 refactor is expected to change a return SHAPE
   (search_content is moving from "filter internally" to "report the gate and
   let the caller decide"), the helper accepts either shape and asserts the
   BEHAVIOUR both shapes must express. Coordinating by contract is the point:
   these tests must not have to be rewritten when the implementation lands.
   ============================================================ */
import { readFileSync } from "node:fs";

/* No key, no network, ever. embed.js reads VOYAGE_API_KEY at call time and
   falls back to BM25 when it is absent, so deleting it here makes every
   search_content call in this suite deterministic and offline. Each test file
   runs in its own process under `node --test`, so this cannot leak sideways. */
export function goOffline() {
  delete process.env.VOYAGE_API_KEY;
}

const root = new URL("../../", import.meta.url);
export const repoFile = (rel) => new URL(rel, root);
export const readJson = (rel) => JSON.parse(readFileSync(repoFile(rel), "utf8"));

/**
 * Did the tool report that the corpus does not cover this query?
 *
 * TARGET CONTRACT, shape-agnostic. Two shapes satisfy it:
 *   today      { gated: true, results: [], message: … }
 *   Wave 2     { gateMatched: null, gateScore: …, results: […] }
 * Anything that hands the caller a non-empty result set while claiming a gate
 * match is NOT a refusal, whichever shape it wears.
 */
export function isCorpusMiss(res) {
  if (!res || typeof res !== "object") return false;
  if (res.gated === true) return true;
  if ("gateMatched" in res && (res.gateMatched === null || res.gateMatched === undefined)) return true;
  return Array.isArray(res.results) && res.results.length === 0;
}

/**
 * Did the entity gate open?
 *
 * `entityGate` returns a match object or null today. If Wave 2 gives it an
 * explicit `matched` flag, that wins; otherwise truthiness is the signal.
 */
export function gateOpened(verdict) {
  if (verdict == null) return false;
  if (typeof verdict === "object" && "matched" in verdict) return Boolean(verdict.matched);
  return true;
}

/** How many entities' NAME SURFACES a term appears in — a statistic of the
 *  corpus, not of any question set, and not a tuned parameter. A term that
 *  names three or more different entities names none of them. */
export function nameSurfaceDf(surfaces) {
  const df = new Map();
  for (const s of surfaces) for (const t of s.terms) df.set(t, (df.get(t) ?? 0) + 1);
  return df;
}
