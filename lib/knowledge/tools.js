/* ============================================================
   The tools — implementations + JSON Schemas.

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

/* ------------------------------------------------------------
   The design system's derived contract.

   content.json carries it under `designSystem`, folded in VERBATIM from
   design-system/dist/components.json by scripts/build-content.mjs. This module
   does not read design-system/dist/ — that would pass check-boundaries.mjs,
   because dist/ is a published surface, and would still be wrong: it would give
   a slice with exactly one input a second one, and route around the graph in
   ARCHITECTURE.md. The fold exists so that this file keeps its single read.

   Defaulted rather than asserted, because a missing key here would throw at
   MODULE INIT and take down both surfaces — including the six corpus tools,
   which have nothing to do with the design system. An absent fold degrades to
   an empty contract; test/tools.test.js asserts the contract is non-empty, so
   the failure is loud in CI instead of at 3am on the wire.

   Not chunked and not in `content.manifest`, deliberately: it is a derived
   artefact, not a passage someone wrote, and putting it in either would change
   `manifestChars` and force a billed corpus rebuild. See the two tools below
   for what that costs — they license no chunk ids, because there are none. */
const designSystem = content.designSystem ?? {};
const designComponents = Array.isArray(designSystem.components) ? designSystem.components : [];
const byComponentId = new Map(designComponents.map((c) => [c.id, c]));

/* Every distinct token a component BLOCK consumes. Not the same number as
   content.system.tokens, which counts every token the design system declares:
   this contract only carries what components reach for, and the full token
   surface is published separately as design-system/dist/tokens.flat.json. The
   difference is stated in getDesignSystem rather than explained away — a token
   declared and unused is a real finding (audit 04 §3.3), not a rounding error. */
const COMPONENT_TOKENS = [...new Set(designComponents.flatMap((c) => c.tokens ?? []))].sort();

/* Grouped by the FIRST SEGMENT of the name — `--space-3` → `space`,
   `--text-2xs` → `text`, `--accent` → `accent`. A mechanical split on the first
   hyphen, so the grouping is a property of the names the build emitted and not
   a taxonomy invented here. If the naming convention changes, the groups change
   with it and nothing has to be remembered. */
const TOKEN_CATEGORIES = (() => {
  const groups = new Map();
  for (const t of COMPONENT_TOKENS) {
    const name = t.startsWith("--") ? t.slice(2) : t;
    const cut = name.indexOf("-");
    const prefix = cut === -1 ? name : name.slice(0, cut);
    if (!groups.has(prefix)) groups.set(prefix, []);
    groups.get(prefix).push(t);
  }
  return [...groups].map(([prefix, tokens]) => ({ prefix, count: tokens.length, tokens }));
})();

/** Distinct values of one array-valued field across every component. `.stat` is
 *  claimed by both `stat` and `chat`, so the union is smaller than the sum and
 *  the union is the honest number. */
const distinctAcross = (field) =>
  new Set(designComponents.flatMap((c) => c[field] ?? [])).size;

const DS_TOTALS = {
  components: designComponents.length,
  classes: distinctAcross("classes"),
  elements: distinctAcross("elements"),
  variants: distinctAcross("variants"),
  selectors: distinctAcross("selectors"),
  tokens: COMPONENT_TOKENS.length,
};

/** The per-component counts, so an index entry says how big a `full` read is
 *  before the caller pays for one. */
const componentCounts = (c) => ({
  blocks: (c.blocks ?? []).length,
  classes: (c.classes ?? []).length,
  elements: (c.elements ?? []).length,
  variants: (c.variants ?? []).length,
  selectors: (c.selectors ?? []).length,
  tokens: (c.tokens ?? []).length,
});

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
   needs no edit at all. It has since been renamed, and this file did not move.

   RE-CHECKED once get_design_system existed (audit 05 §5). The split still
   holds and the three integers stay here: this tool answers "how big is it",
   which is a STATISTIC about the repository and belongs beside the corpus
   statistics — and api/chat.js renders `designSystem.tokens` and
   `.components` in its tool trace. What it must not do is grow the contract
   inline, which would repeat the get_project mistake in a new shape. So it
   points at get_design_system by name and returns no part of it.
   ============================================================ */
function getSystemFacts() {
  return {
    designSystem: {
      tokens: content.system.tokens,
      values: content.system.values,
      components: content.system.components,
      note:
        `${content.system.tokens} tokens carrying ${content.system.values} values across ` +
        `light, dark, print and wide · ${content.system.components} components, each enforced as ` +
        `CSS + spec.md + Storybook story.`,
      /* A pointer, not a payload — the same idiom as the case-study pointer in
         this tool's description. Statistics here; the contract one call away. */
      contract: "Call get_design_system for the machine-readable component contract, and get_component for one component's classes, variants and tokens.",
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

  /* Embeddings wins every retrieval class in the eval; evals/results.json has
     the current margin, and the two figures that used to be quoted here were
     already a corpus out of date. null means unavailable — no key, no vectors,
     a stale vector cache, Voyage slow or down — and BM25 takes over. Degraded
     ranking beats a failed request, but a SILENT degradation is not a
     degradation the caller can report, so `ranker` and `rankerNote` below say
     which one ran. */
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
       consumed it, so a Voyage timeout served the weaker lexical ranking
       behind an answer that looked identical to a semantically-ranked one.
       The note exists so a surface that only forwards strings still carries
       the fact. */
    ranker: ranked ? "embeddings" : "bm25",
    rankerNote: ranked
      ? null
      : "Semantic ranking was unavailable for this call (no key, stale vectors, or a " +
        "timeout) and results were ranked lexically instead — measurably weaker. Treat a " +
        "near-miss as a ranking failure rather than as evidence of absence.",
  };
}

/* ============================================================
   7. get_design_system
   8. get_component

   THE DESIGN SYSTEM'S AGENT SURFACE, and the one thing this server could not
   do before. llms.txt advertises "MCP setups that let agents assemble UI from
   the real system without drift"; until these two existed, the corpus was
   exposed thoroughly and the design system not at all — get_system_facts
   returned three integers and a sentence (audit 04 §3.5).

   TWO TIERS, and the split is the whole design (audit 04 rec 1).

     · MECHANICAL facts are generated: selectors, elements, variants, and the
       exact `var(--token)` set each CSS block consumes. Those are extracted
       from components.css by the design-system build and folded into
       content.json. Nothing here re-derives them and nothing here types them.
     · JUDGEMENT is human-written and stays in each component's spec.md. The
       accessibility rationale, the `contain: size` feedback-loop explanation,
       the reason a rule exists — none of it is derivable and none of it is
       synthesised here. `a11y` is one authored sentence per component that the
       build carries across; every tool response points at the spec path for
       the rest and reproduces none of it.

   So these tools will never describe a component. They say what it is made of
   and where the description lives. A sentence assembled from a selector list
   would read like documentation and be accountable to nobody.

   NEITHER RETURNS chunkIds, and that is not an oversight. Provenance (gate 3
   in schema.js) licenses CORPUS PASSAGES a tool handed back this turn. The
   component contract is not in the corpus — not chunked, not in the manifest —
   so there is no passage to license, and licensing profile or case-study chunks
   for it would be exactly the borrowed-credibility failure that removing
   `project.why` from schema.js closed. The honest consequence is recorded in
   the wave report rather than papered over here.
   ============================================================ */

/* What a component RECORD is composed of — the vocabulary both tools speak,
   field by field, so a client can branch on structure instead of parsing
   English out of a description. That is the point of Astryx's typed envelopes.
   `full` returns every field named here; `brief` returns a subset and names
   what it dropped; the get_design_system index returns the cheap ones.

   Typed rather than derived, and safe to type only because it is checked: a
   drift test in test/tools.test.js asserts every field named here exists on
   every component AND that no component carries a field this omits. If the
   design-system build starts or stops emitting one, CI says so. */
const COMPONENT_COMPOSITION = {
  id: "Stable identifier. The argument get_component takes.",
  status: "Lifecycle marker carried from the component's spec.md.",
  since: "When the component entered the system.",
  a11y: "One AUTHORED sentence — the accessibility contract, written by a human. The only prose in this contract.",
  spec: "Repo-relative path to spec.md: canonical HTML, the rationale, and every constraint that is not mechanical. Read it before deviating.",
  story: "Repo-relative path to the Storybook story that renders it.",
  blocks: "The CSS banner names the component's block(s) carry. A component may own more than one block.",
  classes: "Every class name the component defines. This is the API: a class not listed here has no rule behind it.",
  elements: "The `__element` suffixes that exist, appended to a block class.",
  variants: "The `--variant` suffixes that exist, appended to a block or element class.",
  selectors: "Every full selector in the CSS block, including pseudo-classes, pseudo-elements and descendant forms — what actually ships.",
  tokens: "Every custom property the CSS block consumes. Write these, never a raw colour, font or spacing value.",
};

/* THE HAND-DECLARED RESIDUE, and it is declared on purpose.

   Astryx generates its CLI manifest from Commander metadata and hand-declares
   the two facts Commander cannot express — then puts a DRIFT TEST on the
   hand-declared half so CI fails when it goes stale. That is the pattern here.
   These five rules are not derivable from a selector list, so they are typed;
   every one carries `evidence` computed from the contract itself, and
   test/tools.test.js checks the predicate behind each. A rule that stops being
   true fails a test rather than shipping as advice.

   Every number below is interpolated. None is typed. */
const DESIGN_SYSTEM_RULES = [
  {
    id: "classes-are-the-api",
    rule:
      "This is a CSS-class system, not a component runtime — there is no import, no prop and no JSX. You compose plain HTML and apply the classes this contract lists. A class that is not listed has no rule behind it and renders as nothing.",
    evidence: `${DS_TOTALS.classes} classes across ${DS_TOTALS.components} components, extracted from the shipped stylesheet.`,
  },
  {
    id: "values-come-from-tokens",
    rule:
      "Never write a raw colour, font, size or spacing value. Every value is a custom property, and a component's `tokens` array is the exact set its own block consumes — start there before reaching for the full token list.",
    evidence: `${DS_TOTALS.tokens} distinct tokens are consumed by component blocks; the design system declares ${content.system.tokens} in total.`,
  },
  {
    id: "suffixes-are-enumerated",
    rule:
      "Elements are `__suffix` and variants are `--suffix`, both appended to a block class. Only the suffixes a component lists exist. Inventing one produces markup that looks systematic and is unstyled.",
    evidence: `${DS_TOTALS.elements} elements and ${DS_TOTALS.variants} variants, all enumerated per component.`,
  },
  {
    id: "themes-are-token-values",
    rule:
      "Dark mode, print and the wide breakpoint are token VALUES, not media queries you write. Never write a `prefers-color-scheme` block, never put a colour inside `@media print`, and never re-declare a type step inside a width query — a token carries `dark`, `print` and/or `wide` beside its base value, and the build emits every query and the `[data-theme]` override from them.",
    evidence: `${content.system.light} tokens have a base value, ${content.system.dark} a dark value, ${content.system.print} a print value and ${content.system.wide} a wide value — ${content.system.values} values from ${content.system.tokens} tokens.`,
  },
  {
    id: "judgement-lives-in-the-spec",
    rule:
      "This contract is the mechanical half of the system and knows nothing about WHY. Per-component constraints, the accessibility rationale and the failure modes are human-written and live in the component's spec.md, which every response points at and none reproduces. Read the spec before you deviate from the canonical markup in it.",
    evidence: `${designComponents.filter((c) => c.spec && c.story && c.a11y).length} of ${DS_TOTALS.components} components carry a spec path, a story path and an authored a11y sentence.`,
  },
];

/* Stated rather than left to be discovered. An agent that knows what is absent
   asks for it; an agent that does not assumes the contract is complete. */
const NOT_IN_THIS_CONTRACT = [
  "The CSS itself. Selectors are named, their declarations are not — you are composing markup, not restyling the system.",
  "The prose of any spec.md. Only the one-sentence `a11y` contract crosses over; `spec` is the path to the rest.",
  "The full token list with its values. This contract carries only the tokens a component block consumes; design-system/dist/tokens.flat.json publishes all of them, resolved for light, dark and print.",
  "Anything about the portfolio corpus. Projects, roles and profile are the other tools, and no chunk id is licensed by these two.",
];

function getDesignSystem() {
  return {
    /* Provenance first, and it names the generator rather than this file. */
    $derivedFrom: designSystem.$derivedFrom ?? null,
    contentVersion: content.version,
    counts: {
      components: DS_TOTALS.components,
      tokensDeclared: content.system.tokens,
      tokenValues: content.system.values,
      themes: { light: content.system.light, dark: content.system.dark, print: content.system.print, wide: content.system.wide },
      tokensUsedByComponents: DS_TOTALS.tokens,
      classes: DS_TOTALS.classes,
      elements: DS_TOTALS.elements,
      variants: DS_TOTALS.variants,
      selectors: DS_TOTALS.selectors,
    },
    /* Grouped mechanically on the first segment of the name. The `prefix` is
       the group's whole meaning — there is no invented category label. */
    tokenCategories: TOKEN_CATEGORIES,
    /* The index: enough to choose a component, not enough to write one. The
       per-component counts say what a `full` read will cost before it is made.
       ORDER IS THE BUILD'S, preserved rather than re-sorted here. */
    components: designComponents.map((c) => ({
      id: c.id,
      blocks: c.blocks ?? [],
      status: c.status ?? null,
      since: c.since ?? null,
      spec: c.spec ?? null,
      counts: componentCounts(c),
    })),
    composition: COMPONENT_COMPOSITION,
    rules: DESIGN_SYSTEM_RULES,
    notInThisContract: NOT_IN_THIS_CONTRACT,
  };
}

/* `detail` is this repo's --dense: brief to orient across many components,
   full for the one you are about to write. Resolved in the HANDLER, like every
   other bound in this file — the schema states a nullable string and says which
   two values mean something, because strict schemas do not honour every
   keyword consistently across providers and a bound the schema cannot
   guarantee belongs where it actually holds. */
const DETAIL_LEVELS = ["brief", "full"];
const DETAIL_DEFAULT = "full";

function getComponent({ id, detail = null } = {}) {
  /* INSPECTED, never coerced — see "Argument hygiene". `{"toString": null}` is
     ordinary JSON and throws on any coercion, including the interpolation in
     the not-found message below, which is where get_project used to throw. */
  const idText = asText(id);
  if (idText === null) return invalidArgument("get_component", "id", id);

  const detailText = asText(detail);
  if (detailText === null) return invalidArgument("get_component", "detail", detail);

  /* An unrecognised level falls back rather than failing — the same forgiving
     shape as a non-numeric `limit`. But a fallback nobody can see is a silent
     degradation, so the resolved level is echoed and a note says when the
     requested one was not understood. */
  const wanted = detail == null ? DETAIL_DEFAULT : detailText.toLowerCase();
  const level = DETAIL_LEVELS.includes(wanted) ? wanted : DETAIL_DEFAULT;

  const c = byComponentId.get(idText);
  if (!c) {
    /* The same clean shape as an unknown project id: a TOOL error the calling
       model can read and correct itself from, carrying the closed list of ids.
       No throw, no stack, no schema-validator internals on the wire. */
    return {
      error: "not_found",
      message: `No component with id "${idText}".`,
      available: designComponents.map((x) => x.id),
    };
  }

  const base = {
    id: c.id,
    detail: level,
    detailNote:
      level === wanted
        ? null
        : `detail "${detailText}" is not one of ${DETAIL_LEVELS.join(", ")}; returned "${level}".`,
    status: c.status ?? null,
    since: c.since ?? null,
    /* AUTHORED. One sentence a human wrote, carried verbatim. */
    a11y: c.a11y ?? null,
    blocks: c.blocks ?? [],
    /* The spec is where the judgement is. Both levels point at it. */
    spec: c.spec ?? null,
    story: c.story ?? null,
    counts: componentCounts(c),
  };

  if (level === "brief") {
    return {
      ...base,
      /* The classes carrying no `__` or `--` suffix — the block-level names you
         put on the outermost node. A mechanical filter over `classes`, stated
         as such, so nothing here is a judgement about which class "matters". */
      blockClasses: (c.classes ?? []).filter((k) => !k.includes("__") && !k.includes("--")),
      variants: c.variants ?? [],
      omitted: {
        fields: ["classes", "elements", "selectors", "tokens"],
        note: 'Call get_component again with detail "full" before writing markup — brief names the component, full is what you write from.',
      },
    };
  }

  return {
    ...base,
    classes: c.classes ?? [],
    elements: c.elements ?? [],
    variants: c.variants ?? [],
    selectors: c.selectors ?? [],
    tokens: c.tokens ?? [],
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
  {
    name: "get_design_system",
    description:
      "The machine-readable contract for the design system this site is built from — " +
      `${content.system.tokens} tokens carrying ${content.system.values} values across light, ` +
      `dark and print, and ${DS_TOTALS.components} components. Returns the token categories a ` +
      "component may draw on, an index of every component with what it is composed of, and the " +
      "rules that markup must obey to be on-system. Derived from the shipped stylesheet by the " +
      "design-system build, not written by hand. Call this BEFORE writing any markup that uses " +
      "this system, then get_component for the one you are about to write. Takes no arguments.",
    strict: true,
    input_schema: NO_ARGS,
  },
  {
    name: "get_component",
    description:
      "One component's contract: its block names, every class it defines, its `__element` and " +
      "`--variant` suffixes, the full selector list, and the exact custom properties its CSS " +
      "consumes. Also the one authored sentence stating its accessibility contract, and the " +
      "path to the spec.md that holds the canonical markup and the reasoning — this tool " +
      "reports what the component is MADE OF and never describes it, because the description " +
      "is human-written and lives in that file. " +
      `detail "brief" names the component and its variants for scanning; "full" is everything ` +
      `and is what you write markup from. Null means "full". ` +
      `${DS_TOTALS.components} components; get_design_system lists every id.`,
    strict: true,
    input_schema: obj({
      id: { type: "string", description: "The component id, e.g. \"button\". Use get_design_system to see them all." },
      detail: nullable("string", "Either \"brief\" or \"full\". Null for full. Anything else falls back to full and says so."),
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
  get_design_system: getDesignSystem,
  get_component: getComponent,
};

/**
 * Run a tool by name. The single entry point both api/chat.js and api/mcp.js
 * go through, so the two surfaces cannot drift.
 */
/* Async because search_content may embed the query over the network. Every
   other handler is synchronous property access on a loaded object and returns
   immediately; awaiting a non-promise costs a microtask and keeps ONE calling
   convention across every tool, which is worth more than the microtask. */
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
