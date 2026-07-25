/* ============================================================
   The answer schema and the three hallucination gates.

   Prompting for accuracy is a wish. These are mechanisms, and they run in
   order:

     1. SCHEMA        — `prose` is the only block that carries model-authored
                        text. Every other block references content by id and
                        the client renders it from content.json. The model
                        composes an answer; it does not restate facts, so it
                        cannot mistype a date it is never allowed to type.
     2. REFERENTIAL   — every id in every non-prose block must resolve in
                        content.json. Unresolvable → the block is dropped.
     3. PROVENANCE    — every cited chunk id must have been RETURNED BY A TOOL
                        CALL THIS TURN. A source the model did not actually
                        retrieve is stripped, however plausible it looks.

   Everything the assistant says is therefore traceable to text authored in
   content/.

   Structured-output constraint, stated once: JSON Schema for strict tools and
   output_config does not support recursion, so `blocks` is a FLAT array of a
   discriminated union — never a tree. `minItems`/`maxItems` are not honoured
   either, so the block cap is prompt guidance enforced here in
   `validateBlocks`, where it actually holds.
   ============================================================ */
import { content, resolve } from "./tools.js";

/* One table drives both the emitted JSON Schema and the runtime validator.
   Two hand-maintained copies of the same union is precisely the drift this
   repo exists to make impossible. */
const VARIANTS = {
  prose: {
    text: { type: "string", description: "One paragraph of connective prose. The ONLY model-authored text in an answer." },
  },
  project: {
    id: { type: "string", description: "A project id from content.json. Renders as a row that opens the real case dialog." },
    why: { type: "string", description: "One short clause on why this project answers the question." },
  },
  experience: {
    entryId: { type: "string", description: "An experience id from content.json." },
  },
  facts: {
    termIds: { type: "array", items: { type: "string" }, description: "Profile row terms (\"Focus\", \"Currently\") or fact ids (\"endurance\")." },
  },
  metric: {
    projectId: { type: "string", description: "The project the metric belongs to." },
    metricIndex: { type: "integer", description: "Zero-based index into that project's metrics array." },
  },
  tags: {
    labels: { type: "array", items: { type: "string" }, description: "Tag labels that exist on some project in content.json." },
  },
  links: {
    linkIds: { type: "array", items: { type: "string" }, description: "Link ids of the form \"<projectId>:<index>\", e.g. \"meta:0\"." },
  },
  media: {
    projectId: { type: "string", description: "The project the media slot belongs to." },
    slot: { type: "string", description: "The media slot name, e.g. \"cover\"." },
  },
  sources: {
    chunkIds: { type: "array", items: { type: "string" }, description: "Chunk ids returned by a tool call in THIS turn. Anything else is stripped." },
  },
};

/** Cap on blocks per answer. Not expressible in a strict schema; enforced below. */
export const MAX_BLOCKS = 12;

const variantSchema = (type, props) => ({
  type: "object",
  properties: { type: { type: "string", const: type }, ...props },
  required: ["type", ...Object.keys(props)],
  additionalProperties: false,
});

/** The `respond` tool the final turn is forced into. */
export const ANSWER_SCHEMA = {
  type: "object",
  properties: {
    blocks: {
      type: "array",
      description:
        `The answer, as an ordered flat list of at most ${MAX_BLOCKS} blocks. ` +
        "Lead with a prose block; end with a sources block naming the chunks you actually read.",
      items: { anyOf: Object.entries(VARIANTS).map(([t, p]) => variantSchema(t, p)) },
    },
  },
  required: ["blocks"],
  additionalProperties: false,
};

export const RESPOND_TOOL = {
  name: "respond",
  description:
    "Emit the final answer as structured blocks. This is the only way to answer — never " +
    "write free markdown. Only `prose` carries your own words; every other block names " +
    "content by id and the page renders it from the same source the site renders. Cite only " +
    "chunk ids that a tool returned to you in this turn.",
  strict: true,
  input_schema: ANSWER_SCHEMA,
};

/* ============================================================
   Gate 1 — shape
   ============================================================ */
const isString = (v) => typeof v === "string";
const isStringArray = (v) => Array.isArray(v) && v.every(isString);

function checkShape(block) {
  if (!block || typeof block !== "object" || Array.isArray(block)) return "not an object";
  const props = VARIANTS[block.type];
  if (!props) return `unknown block type "${block.type}"`;

  const allowed = new Set(["type", ...Object.keys(props)]);
  for (const k of Object.keys(block)) {
    if (!allowed.has(k)) return `unexpected property "${k}" on a ${block.type} block`;
  }
  for (const [k, spec] of Object.entries(props)) {
    const v = block[k];
    if (v === undefined) return `${block.type} block is missing "${k}"`;
    if (spec.type === "string" && !isString(v)) return `${block.type}.${k} must be a string`;
    if (spec.type === "integer" && !Number.isInteger(v)) return `${block.type}.${k} must be an integer`;
    if (spec.type === "array" && !isStringArray(v)) return `${block.type}.${k} must be an array of strings`;
  }
  if (block.type === "prose" && !block.text.trim()) return "prose block is empty";
  return null;
}

/**
 * Gate 1. Drop malformed blocks and enforce the block cap.
 * @returns {{ok:boolean, blocks:object[], dropped:{index:number,type:string,reason:string}[]}}
 */
export function validateBlocks(blocks) {
  if (!Array.isArray(blocks)) {
    return { ok: false, blocks: [], dropped: [{ index: -1, type: null, reason: "blocks is not an array" }] };
  }
  const kept = [];
  const dropped = [];
  blocks.forEach((b, index) => {
    const reason = checkShape(b);
    if (reason) dropped.push({ index, type: b?.type ?? null, reason });
    else if (kept.length >= MAX_BLOCKS) {
      dropped.push({ index, type: b.type, reason: `over the ${MAX_BLOCKS}-block cap` });
    } else kept.push(b);
  });
  return { ok: dropped.length === 0, blocks: kept, dropped };
}

/* ============================================================
   Gate 2 — referential integrity

   Every id in every non-prose block must resolve in content.json.
   ============================================================ */

/* Tag labels are a closed vocabulary: the union of every project's tags and
   indexTags. A tag block naming anything else is inventing metadata. */
const KNOWN_TAGS = new Set(
  content.projects.flatMap((p) => [...(p.tags ?? []), ...(p.indexTags ?? [])])
);

/* A `facts` block renders the profile definition list, so its ids are profile
   row terms ("Focus", "Currently", "Availability"). The three personal facts
   are also addressable by id ("endurance", "power", "balance") — the two sets
   are disjoint, so accepting both is unambiguous and saves the model a guess. */
const resolveTermId = (id) => resolve.profileTerm(id) ?? resolve.fact(id);

function checkRefs(block) {
  switch (block.type) {
    case "prose":
      return null;

    case "project":
      return resolve.project(block.id) ? null : `no project "${block.id}" in content.json`;

    case "experience":
      return resolve.experience(block.entryId) ? null : `no experience "${block.entryId}" in content.json`;

    case "facts": {
      const bad = block.termIds.filter((t) => !resolveTermId(t));
      return bad.length ? `unresolvable term ids: ${bad.join(", ")}` : null;
    }

    case "metric": {
      if (!resolve.project(block.projectId)) return `no project "${block.projectId}" in content.json`;
      return resolve.metric(block.projectId, block.metricIndex)
        ? null
        : `project "${block.projectId}" has no metric at index ${block.metricIndex}`;
    }

    case "tags": {
      const bad = block.labels.filter((l) => !KNOWN_TAGS.has(l));
      return bad.length ? `tags that exist on no project: ${bad.join(", ")}` : null;
    }

    case "links": {
      const bad = block.linkIds.filter((id) => !resolve.link(id));
      return bad.length ? `unresolvable link ids: ${bad.join(", ")}` : null;
    }

    case "media":
      return resolve.media(block.projectId, block.slot)
        ? null
        : `project "${block.projectId}" has no media slot "${block.slot}"`;

    case "sources": {
      const bad = block.chunkIds.filter((id) => !resolve.chunkExists(id));
      return bad.length ? `chunk ids not in content.json: ${bad.join(", ")}` : null;
    }

    default:
      return `unknown block type "${block.type}"`;
  }
}

/**
 * Gate 2. Every id in every non-prose block resolves in content.json.
 * @param {object[]} blocks
 * @returns {{ok:boolean, blocks:object[], dropped:{index:number,type:string,reason:string}[]}}
 */
export function validateReferential(blocks) {
  const kept = [];
  const dropped = [];
  (Array.isArray(blocks) ? blocks : []).forEach((b, index) => {
    const shape = checkShape(b);
    if (shape) {
      dropped.push({ index, type: b?.type ?? null, reason: shape });
      return;
    }
    const reason = checkRefs(b);
    if (reason) dropped.push({ index, type: b.type, reason });
    else kept.push(b);
  });
  return { ok: dropped.length === 0, blocks: kept, dropped };
}

/* ============================================================
   Gate 3 — provenance

   A chunk id that resolves is not the same as a chunk the model actually read.
   Gate 2 only proves the id is real; this proves it was retrieved. Both are
   needed: the corpus is small enough that a model can guess a well-formed,
   resolvable, and entirely unread chunk id.
   ============================================================ */

/**
 * Every chunk id a tool actually handed back this turn.
 * search_content reports them per result; the structured reads carry a
 * `chunkIds` array for exactly this purpose.
 */
export function retrievedChunkIds(toolCallsThisTurn = []) {
  const ids = new Set();
  const take = (v) => {
    if (isString(v)) ids.add(v);
    else if (Array.isArray(v)) v.forEach(take);
  };
  for (const call of toolCallsThisTurn) {
    const r = call?.result;
    if (!r || typeof r !== "object") continue;
    take(r.chunkIds);
    for (const hit of r.results ?? []) if (isString(hit?.chunkId)) ids.add(hit.chunkId);
    /* get_system_facts nests a full project read. */
    if (r.project?.chunkIds) take(r.project.chunkIds);
  }
  return ids;
}

/**
 * Gate 3. Strip cited chunk ids that no tool call in this turn returned.
 *
 * @param {object[]} blocks             the answer blocks
 * @param {string[]|null} sources       claimed chunk ids; null derives them
 *                                      from the answer's own `sources` blocks
 * @param {{name:string,input:object,result:object}[]} toolCallsThisTurn
 * @returns {{ok:boolean, blocks:object[], sources:string[],
 *            stripped:string[], retrieved:string[],
 *            dropped:{index:number,type:string,reason:string}[]}}
 */
export function validateProvenance(blocks, sources = null, toolCallsThisTurn = []) {
  const list = Array.isArray(blocks) ? blocks : [];
  const retrieved = retrievedChunkIds(toolCallsThisTurn);

  const claimed =
    sources ??
    list.filter((b) => b?.type === "sources").flatMap((b) => (isStringArray(b.chunkIds) ? b.chunkIds : []));

  const stripped = [...new Set(claimed.filter((id) => !retrieved.has(id)))];
  const strippedSet = new Set(stripped);

  const kept = [];
  const dropped = [];
  list.forEach((b, index) => {
    if (b?.type !== "sources") {
      kept.push(b);
      return;
    }
    const surviving = (isStringArray(b.chunkIds) ? b.chunkIds : []).filter((id) => !strippedSet.has(id));
    if (!surviving.length) {
      dropped.push({
        index,
        type: "sources",
        reason: "no cited chunk was returned by a tool call this turn",
      });
      return;
    }
    kept.push({ ...b, chunkIds: surviving });
  });

  return {
    ok: stripped.length === 0 && dropped.length === 0,
    blocks: kept,
    sources: [...new Set(claimed.filter((id) => retrieved.has(id)))],
    stripped,
    retrieved: [...retrieved],
    dropped,
  };
}

/**
 * All three gates, in order. The single call api/chat.js makes before anything
 * reaches the browser.
 *
 * `hasUnsourcedClaim` is the retry signal from plan §2: prose survived but
 * nothing backs it. The caller retries once, then degrades to an explicit
 * "not on file" answer rather than shipping an uncited claim.
 */
export function validateAnswer(blocks, toolCallsThisTurn = []) {
  const shape = validateBlocks(blocks);
  const refs = validateReferential(shape.blocks);
  const prov = validateProvenance(refs.blocks, null, toolCallsThisTurn);

  const hasProse = prov.blocks.some((b) => b.type === "prose");
  const hasSources = prov.blocks.some((b) => b.type === "sources" && b.chunkIds.length);

  return {
    ok: shape.ok && refs.ok && prov.ok,
    blocks: prov.blocks,
    dropped: [...shape.dropped, ...refs.dropped, ...prov.dropped],
    strippedSources: prov.stripped,
    sources: prov.sources,
    hasUnsourcedClaim: hasProse && !hasSources,
  };
}
