"use client";
/* ============================================================
   The published corpus, in the browser — ported from js/answer-render.js
   @ 2e84323 (the `index()`/`load()` block); fix upstream first.

   The spine of the accuracy story on the client side: `prose` is the only
   block that carries model-authored text. Every other block names content by
   id, and it is rendered FROM THIS FILE — the same artefact the pages were
   generated from. The model composes an answer; it does not restate facts. So
   a date on screen came out of content/, not out of a model.

   Two differences from the original, both about where the file lives rather
   than what it holds:

     · the URL is /corpus/content.json, the copy scripts/sync-artifacts.mjs
       puts in public/. The vanilla fetches `content/dist/content.json`
       relatively from the site root; this app serves the same bytes from its
       own origin, which also means the citation resolver keeps working when
       the CHAT endpoint is cross-origin.
     · `load()` caches the promise and clears it on failure, exactly as the
       original does, so a failed first fetch can be retried by the next
       question rather than poisoning the page.
   ============================================================ */
import type { Chunk, Corpus, ExperienceEntry, Fact, ProfileRow, Project } from "@/lib/types";

export const CORPUS_URL = "/corpus/content.json";

export interface CorpusIndex {
  raw: Corpus;
  project: Map<string, Project>;
  experience: Map<string, ExperienceEntry>;
  fact: Map<string, Fact>;
  profileTerm: Map<string, ProfileRow>;
  chunk: Map<string, Chunk>;
}

let corpus: CorpusIndex | null = null;
let loading: Promise<CorpusIndex> | null = null;

/* ---------- Index once, resolve in O(1) ---------- */
function index(json: Corpus): CorpusIndex {
  return {
    raw: json,
    project: new Map(json.projects.map((p) => [p.id, p])),
    experience: new Map(json.experience.map((e) => [e.id, e])),
    fact: new Map(json.facts.map((f) => [f.id, f])),
    profileTerm: new Map(json.profile.rows.map((r) => [r.term, r])),
    /* Chunk ids are unique as of the id-scheme fix, but a Map keeps this
       indifferent to that: first wins, and both chunks sharing an id would
       carry the same citation anyway. */
    chunk: (() => {
      const m = new Map<string, Chunk>();
      for (const c of json.chunks ?? []) if (!m.has(c.id)) m.set(c.id, c);
      return m;
    })(),
  };
}

export function load(): Promise<CorpusIndex> {
  if (corpus) return Promise.resolve(corpus);
  if (loading) return loading;
  loading = fetch(CORPUS_URL, { credentials: "same-origin" })
    .then((r) => {
      if (!r.ok) throw new Error("content.json " + r.status);
      return r.json() as Promise<Corpus>;
    })
    .then((json) => (corpus = index(json)))
    .catch((err) => {
      loading = null;
      throw err;
    });
  return loading;
}

export const isReady = (): boolean => Boolean(corpus);

/** The loaded index, or null. Callers must have awaited `load()`. */
export const current = (): CorpusIndex | null => corpus;
