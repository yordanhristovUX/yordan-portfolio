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

   SCALE BOUND — correct at 76 chunks, structurally wrong above ~1,000.
   The single read and the O(1) indexes hold fine; what does not is the premise
   the whole loop is built on. `manifest` is a complete table of contents that
   the system prompt carries in its frozen prefix, which is what collapses most
   questions from search → read → respond to read → respond. It is 4.3 KB at
   this size. At 10× it is ~43 KB, at 100× ~430 KB, and long before that the
   model no longer "already knows everything that exists" — the manifest stops
   being a prefix and becomes something that itself has to be searched. At that
   point list_projects/get_project stay right and the manifest-in-the-prompt
   design has to go. Recorded here because nothing else in the repo says where
   the bound is.
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

/* Chunk ids ARE unique — build-content.mjs appends an ordinal to a colliding
   `entity#kind` (…#approach, …#approach-2), so all 76 name exactly one passage.
   This used to be a one-to-many Map<string, number[]> against the era when six
   ids named two chunks each, and it kept a `resolve.chunks(id) -> Chunk[]`
   accessor alive for compatibility. That accessor had zero call sites anywhere
   in the repo, so the many-ness was carried by nothing. A Set is the whole of
   what the validators actually ask: does this id exist. */
const chunkIds = new Set(content.chunks.map((c) => c.id));

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
   Argument hygiene — never COERCE a value a caller chose

   `String(x)`, `` `${x}` ``, `Number(x)`, `obj[x]` and `arr[x]` all run
   ToPrimitive, and ToPrimitive THROWS `TypeError: Cannot convert object to
   primitive value` when the object carries a non-callable own `toString`.

       {"id": {"toString": null}}

   is ordinary JSON. `JSON.parse` produces it verbatim — no prototype
   pollution, no exotic input, nothing a schema validator that checks
   `type: "string"` after the fact can prevent, because the throw happens while
   the handler is still reading its own arguments.

   This is the SAME defect class Wave 0 closed for the tool NAME (see callTool),
   reopened through the tool ARGUMENTS. Over api/mcp.js it reaches the catch
   that logs a full stack and answers `tool_failed`, at 60 requests a minute
   from an unauthenticated caller. Worse, in search_content the throw happened
   inside `String(query ?? "")` — the FIRST expression in the handler — so it
   pre-empted SEARCH_QUERY_MAX_CHARS entirely and the clamp that exists to bound
   an unbounded body never ran.

   The rule is therefore: a caller-supplied value is INSPECTED, never coerced.
   `typeof` cannot be intercepted and cannot throw; every helper below is total.
   ============================================================ */

/** The value as text, or null if it is not something safe to stringify.
 *  null/undefined become "" to preserve the "no argument" reading. */
function asText(value) {
  if (value == null) return "";
  const t = typeof value;
  if (t === "string") return value;
  /* number and boolean stringify without consulting the object, so they are
     safe and forgiving of a model that sends `limit: "8"` or `tag: 3`. */
  if (t === "number" || t === "boolean") return String(value);
  return null; // object, array, function, symbol, bigint — refuse, do not coerce
}

/** A finite integer, or null. Never calls Number() on an object. */
function asInt(value) {
  if (typeof value === "number") return Number.isFinite(value) ? Math.trunc(value) : null;
  if (typeof value === "string") {
    const n = Number(value);
    return Number.isFinite(n) ? Math.trunc(n) : null;
  }
  return null;
}

/** A value safe to use as an object/array key. Guards `handlers[name]` and
 *  `metrics[index]`, both of which coerce through ToPropertyKey. */
const isKeyable = (v) => typeof v === "string" || typeof v === "number";

/** What to call a rejected argument in a message, without touching it. */
const describe = (v) => (v === null ? "null" : Array.isArray(v) ? "array" : typeof v);

const invalidArgument = (tool, arg, value) => ({
  error: "invalid_argument",
  message: `${tool}.${arg} must be a string; received ${describe(value)}.`,
});

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
  /* Inspected, not coerced — see "Argument hygiene". A filter that is not
     text is refused rather than stringified into a filter that matches
     nothing and looks like an empty result set. */
  const tagText = asText(tag);
  if (tagText === null) return invalidArgument("list_projects", "tag", tag);
  const clientText = asText(client);
  if (clientText === null) return invalidArgument("list_projects", "client", client);

  const wantTag = tag == null ? null : tagText.toLowerCase();
  const wantClient = client == null ? null : clientText.toLowerCase();

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
  /* The id is read BEFORE it is used, and the not-found message interpolates
     the SANITISED value. Interpolating the raw argument was the throw site:
     `${id}` on {"toString": null} raises TypeError from inside the error
     handler, turning a clean "no such project" into a 500 with a stack. */
  const idText = asText(id);
  if (idText === null) return invalidArgument("get_project", "id", id);

  const p = byProjectId.get(idText);
  if (!p) {
    return {
      error: "not_found",
      message: `No project with id "${idText}".`,
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

   The design system's own statistics and the corpus's own statistics. The
   numbers come from content.json, which got them from
   content/system.generated.json, which the design-system build emitted — one
   source, three hops, no restatement.

   IT NO LONGER RETURNS A CASE STUDY. This used to nest a whole
   getProject("meta") inside its response, so a client asking how many tokens
   the design system has received an entire case study it had not asked for,
   and schema.js needed a special case (`if (r.project?.chunkIds)`) to find the
   provenance buried one level down. One tool, two jobs, and the second job is
   what get_project is for — the manifest already names the self-referential
   case study, so a client that wants it can ask for it by id in the same turn.

   That split also removed the last hard-coded project id in this file. The id
   is authored in content/ and nothing here should have known it: the moment
   it is renamed — and it must be, because it is literally `meta`, so every
   question about Meta the company matches a project by name — this module
   needs no edit at all.
   ============================================================ */
function getSystemFacts() {
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
    /* Licenses exactly what it returns and nothing more. `openSource` above is
       profile prose, so the profile chunks back it; the case study's chunks are
       licensed by the get_project call that actually returns the case study. */
    chunkIds: chunkIdsFor("profile"),
  };
}

/* ============================================================
   6. search_content
   ============================================================ */
const SEARCH_LIMIT_DEFAULT = 8;
const SEARCH_LIMIT_MAX = 20;

/* The bound on the QUERY, matching MAX_QUESTION_CHARS in api/chat.js — a
   question longer than this is not a question. It is clamped here rather than
   in either surface for the same reason the gate is: a cap one surface holds
   and the other does not is not a cap. Three separate things depended on it
   being absent — the tool echoed the whole query back and mcp.js serialised
   that echo TWICE (2x amplification on an unbounded body), the gate tokenised
   it, and embed.js posted it verbatim to a paid API. Clamping the input once,
   before any of them, closes all three, and the echoed `query` is the clamped
   value so the response is bounded by construction. */
const SEARCH_QUERY_MAX_CHARS = 1000;

/* The gate is COMPUTED here, for both surfaces, and APPLIED by neither. It
   used to filter: a miss returned zero results and a terminal message, which
   made it the only component in the system that could throw away a ranking it
   had not looked at. Two measured facts ended that (see gate.js): it cost a
   significant amount of ranking while the ranker it guarded bought an
   insignificant amount, and its verdict collapsed to a boolean that discarded
   the entity it had just identified.

   Computing it here still preserves the property the old arrangement was
   defending — api/chat.js and api/mcp.js get the SAME signal from the same
   code, so a coverage bug cannot exist on one surface and not the other. What
   changed is that the signal is now reported rather than enforced, and the
   caller — a system prompt with an explicit corpus-boundary section, or a
   remote client's own model — decides what to do with it. */
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

/* Async because ranking may embed the query over the network.
   The gate runs first and is synchronous, but it no longer short-circuits: it
   annotates. An out-of-corpus question now costs one embedding call it used to
   avoid, which is the price of the six answerable questions the short-circuit
   was refusing. */
async function searchContent({ query, limit = SEARCH_LIMIT_DEFAULT }) {
  /* The query is INSPECTED before it is clamped. `String(query ?? "")` used to
     be the first expression in this handler and it throws on {"toString": null}
     — so the clamp below, which exists precisely to bound an unbounded body,
     was unreachable for the one input shape that most needed bounding. Type
     first, then clamp; both now hold for every JSON a caller can send. */
  const queryText = asText(query);
  if (queryText === null) return invalidArgument("search_content", "query", query);

  /* The bound the schema cannot state, enforced where it holds — and the query
     is clamped BEFORE the gate reads it, before the ranker embeds it and
     before it is echoed back in the result. Everything downstream sees `q`. */
  const q = queryText.slice(0, SEARCH_QUERY_MAX_CHARS);

  const limitInt = asInt(limit);
  const n =
    limitInt === null
      ? SEARCH_LIMIT_DEFAULT
      : Math.min(Math.max(1, limitInt), SEARCH_LIMIT_MAX);

  const gate = entityGate(q);

  /* Embeddings won every retrieval class in the Phase 1 eval (93.0% vs 74.4%
     hit@3). null means unavailable — no key, no vectors, a stale vector cache,
     Voyage slow or down — and BM25 takes over at 74.4%. Degraded ranking beats
     a failed request, but a SILENT degradation is not a degradation the caller
     can report, so `ranker` and `rankerNote` below say which one ran. */
  const ranked = await embedRank(content, q, n);
  const results = ranked ? hydrate(ranked) : search(content, q, n);

  return {
    query: q,
    limit: n,
    count: results.length,
    results,
    /* The coverage verdict, always present. null means the query named nothing
       in this corpus — see `note`. It is advice, not a filter; `results` is the
       same ranking either way. */
    gateMatched: gate?.entity ?? null,
    gateScore: gate?.score ?? 0,
    gateFloor: entityGate.floor,
    note: gate ? null : GATE_MISS_MESSAGE,
    /* Which ranker actually ran. This was already returned and nothing
       consumed it, so a Voyage timeout served 74.4% hit@3 behind an answer
       that looked identical to the 93.0% one. The note exists so a surface
       that only forwards strings still carries the fact. */
    ranker: ranked ? "embeddings" : "bm25",
    rankerNote: ranked
      ? null
      : "Semantic ranking was unavailable for this call (no key, stale vectors, or a " +
        "timeout) and results were ranked lexically instead — measurably weaker. Treat a " +
        "near-miss as a ranking failure rather than as evidence of absence.",
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
      "and the open-source links. Use this for questions about the repository, the tooling " +
      "or the site itself. It returns statistics only — for the case study about how this " +
      "site is built, call get_project with the self-referential project id the corpus " +
      "manifest lists. Takes no arguments.",
    strict: true,
    input_schema: NO_ARGS,
  },
  {
    name: "search_content",
    description:
      "Semantic search across every chunk of the corpus, ranked by embedding similarity " +
      "(voyage-3.5 cosine), falling back to lexical BM25 when the embedding service is " +
      "unavailable — the `ranker` field says which one ran. Use it to locate material when " +
      "you cannot tell from the manifest which project or role holds it; prefer get_project " +
      "or list_experience once you know. Returns ranked chunks with their citations. " +
      "It ALWAYS returns its ranking: `gateMatched` reports whether the query named any " +
      "entity this corpus contains, and a null there means the top hits are the closest " +
      "text rather than an answer — read `note` and prefer saying the corpus does not cover " +
      "it over rephrasing. " +
      `limit is clamped to 1..${SEARCH_LIMIT_MAX}.`,
    strict: true,
    input_schema: obj({
      query: { type: "string", description: "Natural-language query. Ranked semantically, so phrase it as the question you actually want answered rather than echoing corpus vocabulary." },
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
  /* Object.hasOwn, not `handlers[name]` — an object literal inherits from
     Object.prototype, so a bare lookup resolves `constructor`, `toString`,
     `hasOwnProperty` and `valueOf` as though they were tools. Measured before
     this guard: `constructor` returned 200 with isError FALSE and the caller's
     own arguments as structuredContent (a calling agent cannot tell it called
     nothing and reads the echo as corpus data), `toString` produced a JSON-RPC
     -32602 carrying the SDK's zod validation internals, and `hasOwnProperty`
     put a stack in the log. Only a name the corpus actually owns gets past. */
  /* `Object.hasOwn(handlers, name)` coerces `name` through ToPropertyKey, which
     is ToPrimitive again — so the guard Wave 0 added to stop `constructor` and
     `toString` resolving as tools was ITSELF a throw site for a name that is an
     object. Check the type before using the value as a key, and never
     interpolate the raw name into the message. */
  const fn = isKeyable(name) && Object.hasOwn(handlers, name) ? handlers[name] : undefined;
  if (typeof fn !== "function") {
    return {
      error: "unknown_tool",
      message:
        typeof name === "string"
          ? `No tool named "${name}".`
          : `Tool name must be a string; received ${describe(name)}.`,
      available: Object.keys(handlers),
    };
  }
  /* A non-object `input` would make destructuring in the handlers throw. */
  return fn(input && typeof input === "object" ? input : {});
}

/* Resolution helpers — used by schema.js and worth having on the public
   surface, because "does this id exist" is the question both validators ask. */
export const resolve = {
  project: (id) => byProjectId.get(id) ?? null,
  experience: (id) => byExperienceId.get(id) ?? null,
  fact: (id) => byFactId.get(id) ?? null,
  profileTerm: (term) => byProfileTerm.get(term) ?? null,
  chunkExists: (chunkId) => chunkIds.has(chunkId),
  /* A link id is "<projectId>:<index>". The index is parsed STRICTLY: the old
     `Number(...)` + `Number.isInteger` pair accepted "meta:" (Number("") is 0),
     "meta:1e0", "meta:-0", "meta: 1" and "meta:0x0" — every one of them a
     well-formed-looking id the model never saw, resolving to link 0 and
     rendering a real button under a fabricated label. The digits must be
     digits, and the whole id must round-trip to the one the caller sent. */
  link: (linkId) => {
    if (typeof linkId !== "string") return null;
    const s = linkId;
    const at = s.lastIndexOf(":");
    if (at < 1) return null;
    const rest = s.slice(at + 1);
    if (!/^(0|[1-9]\d*)$/.test(rest)) return null;
    return byProjectId.get(s.slice(0, at))?.links?.[Number(rest)] ?? null;
  },
  media: (projectId, slot) =>
    byProjectId.get(projectId)?.media?.find((m) => m.slot === slot) ?? null,
  /* `metrics[index]` coerces `index` through ToPropertyKey. Gate 1 checks the
     block shape before gate 2 calls this, so the model path is already typed —
     but `resolve` is on the public surface and a total function is the only
     kind worth exporting. */
  metric: (projectId, index) =>
    Number.isInteger(index) ? byProjectId.get(projectId)?.metrics?.[index] ?? null : null,
};

/** The corpus table of contents, for the system prompt's frozen prefix. */
export const manifest = content.manifest;
