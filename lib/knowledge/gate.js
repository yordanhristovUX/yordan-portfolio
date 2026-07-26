/* ============================================================
   The entity gate — decides WHETHER the corpus covers a query

   Phase 1 measured the thing this exists for. Raw BM25 abstains on 0 of 11
   unanswerable questions: it answers "did he work at Google?" with a confident
   ranked list, because "Google" appears 8× in the corpus (Google Analytics,
   Google Play, Google AI Studio). Gated, correct abstention is 72.7%.

   The division the eval settled on:

       the gate decides WHETHER · the ranker decides WHAT

   A confidently-wrong answer about someone's employment history is the worst
   output this system can produce, so this is a gate and not a prompt.

   WHY IT LIVES HERE. It was first written inside api/chat.js, which made the
   web chat abstain correctly while api/mcp.js — same tool, same corpus —
   served the ungated arm to anybody who added this server to their own Claude.
   Two surfaces exist precisely so that a retrieval bug cannot exist on one and
   not the other, and a gate in one surface breaks that guarantee more quietly
   than a missing gate in both. api/CLAUDE.md forbids exactly this and the
   violation still happened, because the gate was scoped into a surface for
   merge safety while two agents worked in parallel. Correctness outranks
   merge convenience; the gate belongs in the core.

   Matching is over each entity's NAME SURFACE only — ids, titles, clients,
   tags, org and role names, skill terms, fact titles — never its body. A term
   that merely appears somewhere in the prose cannot open the gate, which is
   the whole reason "Google" does not.

   Each matched term contributes its corpus IDF from content.bm25.df: a
   statistic of the corpus, not of any question set. Nothing here is tuned, so
   there is no parameter that could have been fitted to the eval.
   ============================================================ */
import { tokenize } from "./search.js";

/** Build the name surfaces once per corpus. Exported so the eval can construct
 *  a gate over a fixture without reaching into module state. */
export function buildNameSurfaces(content) {
  const surfaces = [];
  const add = (entity, parts) =>
    surfaces.push({ entity, terms: new Set(tokenize(parts.filter(Boolean).join(" "))) });

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
    /* `descriptor` is deliberately EXCLUDED. It is a sentence — Studio Kipo's is
       "sole designer for all client work" — and putting a sentence in a name
       surface is the body-matching this gate exists to avoid. Concretely: it
       let the token "work" open the gate for "did he work at Google", which is
       the exact question the gate was built to refuse. The rule is names only:
       ids, orgs, roles, titles, clients, tags, terms. */
    add(`experience:${e.id}`, [e.id.replace(/-/g, " "), e.org, e.role]);
  }
  for (const c of content.capabilities ?? []) {
    add(`capability:${c.id}`, [c.id.replace(/-/g, " "), c.title]);
  }
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
  return surfaces;
}

/** A gate bound to one corpus. */
export function makeGate(content) {
  const surfaces = buildNameSurfaces(content);
  const { N, df } = content.bm25;
  const idf = (t) => Math.log(1 + (N - (df[t] ?? 0) + 0.5) / ((df[t] ?? 0) + 0.5));

  /** @returns {{entity:string, score:number}|null} — null means "not on file" */
  return function entityGate(query) {
    const terms = [...new Set(tokenize(String(query ?? "")))];
    let best = null;
    let bestScore = 0;
    for (const surface of surfaces) {
      let score = 0;
      for (const t of terms) if (surface.terms.has(t)) score += idf(t);
      if (score > bestScore) {
        bestScore = score;
        best = surface.entity;
      }
    }
    return bestScore > 0 ? { entity: best, score: Number(bestScore.toFixed(4)) } : null;
  };
}

/** The message a gated miss carries. Phrased for a model reading it cold:
 *  an empty result is an ANSWER ("not on file"), not a prompt to try again. */
export const GATE_MISS_MESSAGE =
  "No entity in this corpus matches that query. The corpus does not cover it — " +
  "say so rather than rephrasing.";
