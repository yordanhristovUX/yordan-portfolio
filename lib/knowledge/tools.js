/* ============================================================
   The six tools — implementations + JSON Schemas.

   Pure functions over content/dist/content.json, which is read ONCE at module
   init and never again. No other I/O, no network, no state. Both api/chat.js
   (in-process) and api/mcp.js (remote MCP) consume this module unchanged, so a
   tool bug cannot exist on one surface and not the other — that equivalence is
   the argument for the boundary being here.

   content/dist/content.json is read as DATA, not imported as source. This
   module never reaches into content/, api/, js/ or scripts/. See
   ARCHITECTURE.md and scripts/check-boundaries.mjs.
   ============================================================ */
import { readFileSync } from "node:fs";
import { search } from "./search.js";
import { makeGate, GATE_MISS_MESSAGE } from "./gate.js";
import { embedRank } from "./embed.js";

/* The corpus. One read, at module load — a ~183 KB parse, after which every
   tool call is property access on a loaded object (~1 ms). The alternative,
   a query round trip to a stateful service, is what §1 of the plan declined. */
export const content = JSON.parse(
  readFileSync(new URL("../../content/dist/content.json", import.meta.url), "utf8")
);

/* ============================================================
   Indexes

   Built once beside the corpus. Everything the tools and the validators need
   to resolve an id in O(1), so no validator is ever tempted to scan.
   ============================================================ */

const byProjectId = new Map(content.projects.map((p) => [p.id, p]));
const byExperienceId = new Map(content.experience.map((e) => [e.id, e]));
const byFactId = new Map(content.facts.map((f) => [f.id, f]));
const byProfileTerm = new Map(content.profile.rows.map((r) => [r.term, r]));

/* Chunk ids are NOT unique in content.json — a project may carry two sections
   of the same kind (the audit has two {#approach} and two {#outcome}), and the
   id is built from `entity#kind` alone. Six of seventy-six ids therefore name
   two chunks each. This map is one-to-MANY on purpose: pretending otherwise
   would silently drop half of those sections from citation and from search
   de-duplication. The defect belongs to the id scheme in
   scripts/build-content.mjs, not to this module, and is documented in
   lib/knowledge/CLAUDE.md. */
const byChunkId = new Map();
content.chunks.forEach((c, i) => {
  if (!byChunkId.has(c.id)) byChunkId.set(c.id, []);
  byChunkId.get(c.id).push(i);
});

/* Every chunk an entity owns, so a structured read can report exactly which
   chunk ids back it. Without this the provenance gate would only ever pass for
   answers that went through search_content. */
const chunkIdsByEntity = new Map();
for (const c of content.chunks) {
  if (!chunkIdsByEntity.has(c.entity)) chunkIdsByEntity.set(c.entity, []);
  const list = chunkIdsByEntity.get(c.entity);
  if (!list.includes(c.id)) list.push(c.id);
}
const chunkIdsFor = (entity) => chunkIdsByEntity.get(entity) ?? [];

/* A project has no period of its own in content.json — the dates live on the
   experience role that lists it. Deriving the span here rather than asking the
   model to join two tool results keeps "when did he do the Spetema work?" a
   one-call question. */
const roleByProject = new Map();
for (const e of content.experience) {
  for (const id of e.projects ?? []) if (!roleByProject.has(id)) roleByProject.set(id, e);
}
function periodOf(projectId) {
  const role = roleByProject.get(projectId);
  if (!role) return { period: null, span: null, viaExperience: null };
  return { period: role.period, span: role.span, viaExperience: role.id };
}

/* ============================================================
   Schema helpers

   `strict: true` means every property is listed in `required` and
   `additionalProperties` is false. An OPTIONAL argument is therefore expressed
   as a nullable type rather than by omission from `required` — the caller must
   pass the key and may pass null. This is the portable strict-mode idiom and
   it is why `list_projects` has three required-but-nullable filters.

   Deliberately absent: `minimum`/`maximum`/`minItems`/`maxItems`. Strict
   structured-output schemas do not honour them consistently across providers,
   so a bound that the schema cannot guarantee is enforced in the handler
   instead, where it actually holds.
   ============================================================ */
const obj = (properties) => ({
  type: "object",
  properties,
  required: Object.keys(properties),
  additionalProperties: false,
});
const nullable = (type, description) => ({ type: [type, "null"], description });
const NO_ARGS = obj({});

/* ============================================================
   1. list_projects
   ============================================================ */
function listProjects({ tag = null, client = null, hasCaseStudy = null } = {}) {
  const wantTag = tag == null ? null : String(tag).toLowerCase();
  const wantClient = client == null ? null : String(client).toLowerCase();

  const projects = content.projects
    .filter((p) => {
      if (hasCaseStudy != null && Boolean(p.hasCaseStudy) !== Boolean(hasCaseStudy)) return false;
      if (wantTag != null) {
        const tags = [...(p.tags ?? []), ...(p.indexTags ?? [])].map((t) => t.toLowerCase());
        if (!tags.some((t) => t.includes(wantTag))) return false;
      }
      if (wantClient != null) {
        const names = [p.client, p.indexClient, p.title].filter(Boolean).map((s) => s.toLowerCase());
        if (!names.some((n) => n.includes(wantClient))) return false;
      }
      return true;
    })
    .map((p) => {
      const { period, span } = periodOf(p.id);
      return {
        id: p.id,
        index: p.index,
        title: p.title,
        client: p.client,
        period,
        span,
        tags: p.tags?.length ? p.tags : p.indexTags,
        summary: p.summary,
        hasCaseStudy: Boolean(p.hasCaseStudy),
      };
    });

  return { count: projects.length, total: content.projects.length, projects };
}

/* ============================================================
   2. get_project
   ============================================================ */
function getProject({ id }) {
  const p = byProjectId.get(id);
  if (!p) {
    return {
      error: "not_found",
      message: `No project with id "${id}".`,
      available: content.projects.map((x) => x.id),
    };
  }
  const { period, span, viaExperience } = periodOf(p.id);
  return {
    id: p.id,
    index: p.index,
    title: p.title,
    client: p.client,
    hasCaseStudy: Boolean(p.hasCaseStudy),
    cardType: p.cardType,
    period,
    span,
    periodVia: viaExperience,
    tags: p.tags ?? [],
    accentTag: p.accentTag,
    indexTags: p.indexTags ?? [],
    summary: p.summary,
    subtitle: p.subtitle,
    /* An ARRAY, in authored order — never a map keyed by kind. Kinds repeat:
       the Green Street audit has two {#approach} sections and two {#outcome},
       and keying would silently discard one of each. */
    sections: p.sections.map((s) => ({ kind: s.kind, heading: s.heading, text: s.text })),
    metrics: p.metrics ?? [],
    links: (p.links ?? []).map((l, i) => ({ linkId: `${p.id}:${i}`, label: l.label, href: l.href })),
    media: (p.media ?? []).map((m) => ({ slot: m.slot, caption: m.caption })),
    chunkIds: chunkIdsFor(`project:${p.id}`),
    cite: { page: "/", anchor: "#work", project: p.id },
  };
}

/* ============================================================
   3. list_experience
   ============================================================ */
function listExperience() {
  return {
    count: content.experience.length,
    experience: content.experience.map((e) => ({
      id: e.id,
      org: e.org,
      role: e.role,
      period: { start: e.period.start, end: e.period.end ?? null, note: e.period.note ?? null },
      span: e.span,
      location: e.period.location ?? null,
      mode: e.period.mode ?? null,
      descriptor: e.descriptor,
      bullets: e.bullets,
      projects: e.projects ?? [],
      chunkIds: chunkIdsFor(`experience:${e.id}`),
    })),
  };
}

/* ============================================================
   4. get_profile
   ============================================================ */
function getProfile() {
  return {
    identity: {
      name: content.profile.identity.name,
      role: content.profile.identity.role,
      disciplines: content.profile.identity.disciplines,
    },
    location: content.profile.identity.location,
    availability: content.profile.availability,
    contact: content.profile.contact,
    rows: content.profile.rows,
    summary: content.profile.prose.cvSummary,
    hero: content.profile.prose.heroLede,
    background: content.profile.prose.background,
    skills: {
      order: content.skills.order,
      groups: content.skills.groups,
    },
    education: content.education,
    facts: content.facts,
    chunkIds: [
      ...chunkIdsFor("profile"),
      ...content.facts.map((f) => `fact:${f.id}`),
      ...Object.keys(content.skills.groups).flatMap((id) =>
        chunkIdsFor(`skills:${id}`)
      ),
    ],
    cite: { page: "/cv", anchor: "#top" },
  };
}

/* ============================================================
   5. get_system_facts

   Recruiters ask about the repo, so the design system's own statistics and the
   `meta` case study are one call rather than a search. The numbers come from
   content.json, which got them from content/system.generated.json, which the
   design-system build emitted — one source, three hops, no restatement.
   ============================================================ */
function getSystemFacts() {
  const meta = byProjectId.get("meta");
  return {
    designSystem: {
      tokens: content.system.tokens,
      values: content.system.values,
      components: content.system.components,
      note:
        `${content.system.tokens} tokens carrying ${content.system.values} values across ` +
        `light, dark and print · ${content.system.components} components, each enforced as ` +
        `CSS + spec.md + Storybook story.`,
    },
    corpus: {
      projects: content.projects.length,
      caseStudies: content.projects.filter((p) => p.hasCaseStudy).length,
      experience: content.experience.length,
      chunks: content.chunks.length,
      terms: Object.keys(content.bm25.df).length,
      avgChunkLength: content.bm25.avgdl,
      manifestChars: JSON.stringify(content.manifest).length,
      contentVersion: content.version,
    },
    openSource: {
      prose: content.profile.prose.openSource,
      facts: content.profile.prose.openSourceFacts,
      repo: content.profile.contact.repo,
      storybook: content.profile.contact.storybook,
    },
    project: meta ? getProject({ id: "meta" }) : null,
    chunkIds: [...chunkIdsFor("project:meta"), ...chunkIdsFor("profile")],
  };
}

/* ============================================================
   6. search_content
   ============================================================ */
const SEARCH_LIMIT_DEFAULT = 8;
const SEARCH_LIMIT_MAX = 20;

/* The gate is applied HERE, inside the tool, rather than by either caller.
   A gate wrapped around the tool by one surface is a gate the other surface
   does not have — which is exactly what happened while api/chat.js owned it
   and api/mcp.js served the ungated arm. Inside the tool, both consumers get
   it and neither can bypass it. See lib/knowledge/gate.js. */
export const entityGate = makeGate(content);

/* Hydrate a bare {chunkId, chunkIndex, score} ranking into the result shape
   both surfaces expect, so the two rankers are interchangeable downstream. */
function hydrate(ranked) {
  return ranked.map((r) => {
    const c = content.chunks[r.chunkIndex];
    return {
      chunkId: c.id,
      chunkIndex: r.chunkIndex,
      score: r.score,
      heading: c.heading,
      kind: c.kind,
      entity: c.entity,
      cite: c.cite,
      text: c.text,
    };
  });
}

/* Async because ranking may embed the query over the network. The gate runs
   FIRST and is synchronous, so an out-of-corpus question costs no API call at
   all — the cheapest request is the one we refuse. */
async function searchContent({ query, limit = SEARCH_LIMIT_DEFAULT }) {
  /* The bound the schema cannot state, enforced where it holds. */
  const n = Number.isFinite(Number(limit))
    ? Math.min(Math.max(1, Math.trunc(Number(limit))), SEARCH_LIMIT_MAX)
    : SEARCH_LIMIT_DEFAULT;

  const gate = entityGate(query);
  if (!gate) {
    return { query, limit: n, count: 0, results: [], gated: true, message: GATE_MISS_MESSAGE };
  }

  /* Embeddings won every retrieval class in the Phase 1 eval (93.0% vs 74.4%
     hit@3). null means unavailable — no key, no vectors, Voyage slow or down —
     and BM25 takes over. Degraded ranking beats a failed request. */
  const ranked = await embedRank(content, query, n);
  const results = ranked ? hydrate(ranked) : search(content, query, n);

  return {
    query,
    limit: n,
    count: results.length,
    results,
    gated: false,
    gateMatched: gate.entity,
    ranker: ranked ? "embeddings" : "bm25",
  };
}

/* ============================================================
   The surface
   ============================================================ */
export const TOOLS = [
  {
    name: "list_projects",
    description:
      "List every project, newest case studies first, optionally filtered. Returns compact " +
      "records — id, title, client, period, tags and the one-line summary — not full case " +
      "studies. Pass null for any filter you do not want to apply. Use get_project to read one.",
    strict: true,
    input_schema: obj({
      tag: nullable("string", "Case-insensitive substring match against a project's tags. Null for no tag filter."),
      client: nullable("string", "Case-insensitive substring match against client or project title. Null for no client filter."),
      hasCaseStudy: nullable("boolean", "True for the six full case studies, false for card-only projects, null for all."),
    }),
  },
  {
    name: "get_project",
    description:
      "Read one project in full: summary, subtitle, every body section in authored order, " +
      "metrics, links, media slots, tags, and the chunk ids that back them. Sections are an " +
      "ordered array and a kind may appear more than once.",
    strict: true,
    input_schema: obj({
      id: { type: "string", description: "The project id, e.g. \"greenstreet-audit\". Use list_projects to see them all." },
    }),
  },
  {
    name: "list_experience",
    description:
      "List all employment history, most recent first: organisation, role, period, location, " +
      "working mode, one-line descriptor and the bullet points for each. Takes no arguments.",
    strict: true,
    input_schema: NO_ARGS,
  },
  {
    name: "get_profile",
    description:
      "The person: identity, location, availability, contact details, the skills taxonomy, " +
      "education, languages and the three personal facts. Location, availability and contact " +
      "exist only here — they are structured fields and are not reachable by search_content. " +
      "Takes no arguments.",
    strict: true,
    input_schema: NO_ARGS,
  },
  {
    name: "get_system_facts",
    description:
      "The design system's own numbers (tokens, values, components), the corpus statistics, " +
      "and the 'meta' case study about how this site and its system are built. Use this for " +
      "questions about the repository, the tooling or the site itself. Takes no arguments.",
    strict: true,
    input_schema: NO_ARGS,
  },
  {
    name: "search_content",
    description:
      "Lexical BM25 search across every chunk of the corpus. Use it to locate material when " +
      "you cannot tell from the manifest which project or role holds it; prefer get_project " +
      "or list_experience once you know. Returns ranked chunks with their citations. " +
      `limit is clamped to 1..${SEARCH_LIMIT_MAX}.`,
    strict: true,
    input_schema: obj({
      query: { type: "string", description: "Natural-language query. Matched lexically, so favour the words the corpus itself would use." },
      limit: { type: "integer", description: `How many chunks to return, 1..${SEARCH_LIMIT_MAX}.` },
    }),
  },
];

export const handlers = {
  list_projects: listProjects,
  get_project: getProject,
  list_experience: listExperience,
  get_profile: getProfile,
  get_system_facts: getSystemFacts,
  search_content: searchContent,
};

/**
 * Run a tool by name. The single entry point both api/chat.js and api/mcp.js
 * go through, so the two surfaces cannot drift.
 */
/* Async because search_content may embed the query over the network. Every
   other handler is synchronous property access on a loaded object and returns
   immediately; awaiting a non-promise costs a microtask and keeps ONE calling
   convention across all six tools, which is worth more than the microtask. */
export async function callTool(name, input = {}) {
  const fn = handlers[name];
  if (!fn) {
    return { error: "unknown_tool", message: `No tool named "${name}".`, available: Object.keys(handlers) };
  }
  return fn(input ?? {});
}

/* Resolution helpers — used by schema.js and worth having on the public
   surface, because "does this id exist" is the question both validators ask. */
export const resolve = {
  project: (id) => byProjectId.get(id) ?? null,
  experience: (id) => byExperienceId.get(id) ?? null,
  fact: (id) => byFactId.get(id) ?? null,
  profileTerm: (term) => byProfileTerm.get(term) ?? null,
  /* Returns EVERY chunk carrying this id — see the note on byChunkId. */
  chunks: (chunkId) => (byChunkId.get(chunkId) ?? []).map((i) => content.chunks[i]),
  chunkExists: (chunkId) => byChunkId.has(chunkId),
  link: (linkId) => {
    const at = String(linkId).lastIndexOf(":");
    if (at < 1) return null;
    const p = byProjectId.get(String(linkId).slice(0, at));
    const i = Number(String(linkId).slice(at + 1));
    return p && Number.isInteger(i) ? p.links?.[i] ?? null : null;
  },
  media: (projectId, slot) =>
    byProjectId.get(projectId)?.media?.find((m) => m.slot === slot) ?? null,
  metric: (projectId, index) => byProjectId.get(projectId)?.metrics?.[index] ?? null,
};

/** The corpus table of contents, for the system prompt's frozen prefix. */
export const manifest = content.manifest;
