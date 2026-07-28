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

   Claim 1 is true as of this file's `project.why` removal and was not before:
   `why` was free-form model text sitting in a non-prose block, declared four
   lines under a comment saying no such thing existed. See the note in VARIANTS.

   WHAT THESE DO NOT DO, stated because the repo used to claim otherwise.
   "Everything the assistant says is traceable to text authored in content/" is
   true of every ID and FALSE OF EVERY SENTENCE. Gate 2 proves an id resolves;
   gate 3 proves a chunk was returned by a tool this turn. Neither reads the
   prose. A constructed answer pairing fabricated biography with two genuinely
   retrieved chunk ids passes all three gates with nothing dropped and
   `hasUnsourcedClaim: false` — verified, not hypothesised. The gap between
   "cited" and "true" is the entire prose channel, and it is a gap these gates
   were never built to close: they remove the highest-frequency hallucination
   class (invented dates, metrics, clients, tags) by making it UN-TYPEABLE,
   which is a real and unusual mechanism, and they do not check entailment.
   Anything that does needs a model reading (prose, cited chunk text) pairs.

   Gate 3 is also BROAD rather than deep. `get_profile` licenses 20 of 76 chunk
   ids in one call and `get_system_facts` 12, so a few cheap calls a model makes
   anyway license a large fraction of the corpus. "Returned by a tool" is a
   weaker claim than "read", and it is the one being made.

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
  /* `why` USED TO LIVE HERE and has been removed. It was declared
     "One short clause on why this project answers the question" — free-form
     model-authored prose, in the same file whose header claims prose is the
     ONLY block carrying model-authored text. checkShape verified it was a
     string and checkRefs for `project` looked only at `block.id`, so nothing
     validated it at all, and it rendered attached to an id-validated project
     row where it borrowed the credibility of the checked content beside it.

     Deleting it is the only one of the three available fixes that makes the
     claim TRUE rather than narrower: constraining a length or an enum would
     still leave model text in a non-prose block. The model has not lost the
     ability to say why a project is relevant — that sentence belongs in the
     prose block, where the reader already knows the words are the model's. */
  project: {
    id: { type: "string", description: "A project id from content.json. Renders as a row that opens the real case dialog." },
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

/** The `respond` tool the final turn is forced into.
 *
 *  `sources` is a TOP-LEVEL REQUIRED property, not one variant among the twelve
 *  a block may take. As an `anyOf` member it was structurally optional: an
 *  answer that cited nothing was schema-VALID, and the only thing standing
 *  between an uncited claim and the browser was `hasUnsourcedClaim` — a flag
 *  the caller had to notice and act on, one retry later. A required key makes
 *  "what did you read to write this" a question the model must answer to emit
 *  anything at all, which is where the cost of not answering it belongs.
 *
 *  The `sources` BLOCK variant is kept because it is what the client renders;
 *  the two are unioned when the claimed set is computed, so a model that fills
 *  either is understood and one that fills both is not double-counted. */
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
    sources: {
      type: "array",
      items: { type: "string" },
      description:
        "REQUIRED. Every chunk id a tool returned to you in this turn that your prose is " +
        "actually based on. An id no tool returned is stripped. If you read nothing, pass " +
        "an empty array and say the answer is not on file — do not cite to fill the field.",
    },
  },
  required: ["blocks", "sources"],
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

/* How deep to walk a tool result looking for provenance. Every shape this
   module actually emits is reachable within three levels
   (result → experience[] → chunkIds); the bound exists so a future result
   shape cannot turn this into an unbounded traversal on the hot path. */
const WALK_MAX_DEPTH = 6;

/**
 * Every chunk id a tool actually handed back this turn.
 *
 * WHY THIS WALKS RATHER THAN NAMING PATHS. It used to read exactly three:
 * `r.chunkIds`, `r.results[].chunkId` and `r.project.chunkIds`. `list_experience`
 * nests `chunkIds` INSIDE each experience record — `r.experience[i].chunkIds` —
 * which was on none of those paths, so the tool licensed **0 of 76 chunks** and
 * employment history, the highest-stakes question class in the corpus and the
 * one this tool exists for, was structurally unable to cite. A correct, properly
 * grounded answer ("He is currently a Senior Product Designer at Green Street",
 * citing a real chunk list_experience had just returned) had its citation
 * stripped, `hasUnsourcedClaim` fired, the retry burned a turn, and the answer
 * could degrade to "not on file" — the strongest possible answer failing in the
 * shape of the weakest.
 *
 * A hard-coded path list is a provenance gate that silently forgets a tool
 * whenever a result shape changes, and it had already forgotten one. Walking
 * the result for `chunkIds`/`chunkId` keys makes provenance a property of the
 * DATA rather than of a list somebody has to remember to update — and it
 * retired the `r.project.chunkIds` special case that get_system_facts's nesting
 * used to require (that nesting is gone too; see tools.js).
 *
 * This only ever ADDS ids that a tool genuinely returned, so a wider walk
 * cannot license anything the turn did not actually retrieve. It does mean
 * provenance stays broad — three cheap calls license roughly half the corpus,
 * so "returned by a tool" remains a weaker claim than "read". That is a real
 * limit of gate 3 and not something this walk introduces.
 */
export function retrievedChunkIds(toolCallsThisTurn = []) {
  const ids = new Set();

  const walk = (node, depth) => {
    if (depth > WALK_MAX_DEPTH || !node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      for (const item of node) walk(item, depth + 1);
      return;
    }
    for (const [key, value] of Object.entries(node)) {
      if (key === "chunkId" && isString(value)) ids.add(value);
      else if (key === "chunkIds" && isStringArray(value)) for (const id of value) ids.add(id);
      else walk(value, depth + 1);
    }
  };

  for (const call of toolCallsThisTurn) walk(call?.result, 0);
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
 * nothing backs it.
 *
 * THE CALLER'S HALF IS DONE — this note used to say it was not, and the
 * correction is worth keeping rather than deleting. What was true: api/chat.js
 * took the retry verdict on `blocks.length` alone and never re-read
 * `hasUnsourcedClaim`, so "retry once, then ship whatever comes back" was the
 * real policy and an unsourced claim reaching the browser was invisible. That
 * was measured, not suspected — a groundedness run put 40 questions through the
 * shipped loop and 15 of them ended exactly that way.
 *
 * What api/chat.js does now: it re-runs all three gates on the retry and takes
 * the BETTER of the two verdicts, so there are three terminal states rather
 * than two — grounded, `uncited` (a true answer that lost its provenance ships
 * WITH a server-authored caveat block, because degrading it would trade a
 * correct answer for a refusal in order to punish bookkeeping), and `degraded`
 * (nothing survived → "not on file"). test/chat-retry.test.js drives the real
 * handler over HTTP and holds that policy.
 *
 * Independently of the retry, and still the better fix: `sources` is a REQUIRED
 * top-level property of the respond schema, so the sources-free answer is not
 * schema-valid in the first place. Structural fix before retry policy — a retry
 * spends a whole model turn papering over a shape the schema should never have
 * permitted.
 */
export function validateAnswer(answer, toolCallsThisTurn = []) {
  /* Accepts either the whole `respond` input — {blocks, sources} — or a bare
     blocks array, which is what the caller passed before `sources` became a
     required top-level property. Both are validated identically; the array form
     simply has no top-level sources to union in. */
  const isBare = Array.isArray(answer);
  const blocks = isBare ? answer : answer?.blocks;
  const topLevel = isBare || !isStringArray(answer?.sources) ? [] : answer.sources;

  const shape = validateBlocks(blocks);
  const refs = validateReferential(shape.blocks);

  /* The claimed set is the union of the top-level `sources` and any surviving
     `sources` block. Passing it explicitly rather than letting validateProvenance
     derive it from the blocks is what makes the top-level field count: an answer
     that cites only there still gets its ids checked, and still gets credit for
     them. Ids that reached gate 3 but were never returned this turn are stripped
     from both channels by the same pass. */
  const claimed = [
    ...topLevel,
    ...refs.blocks
      .filter((b) => b?.type === "sources")
      .flatMap((b) => (isStringArray(b.chunkIds) ? b.chunkIds : [])),
  ];
  const prov = validateProvenance(refs.blocks, claimed, toolCallsThisTurn);

  const hasProse = prov.blocks.some((b) => b.type === "prose");
  /* Sources survive in EITHER channel. A model that filled only the required
     top-level array has answered the question gate 3 asks, even though it
     emitted no sources block for the client to render. */
  const hasSources = prov.sources.length > 0;

  return {
    ok: shape.ok && refs.ok && prov.ok,
    blocks: prov.blocks,
    dropped: [...shape.dropped, ...refs.dropped, ...prov.dropped],
    strippedSources: prov.stripped,
    sources: prov.sources,
    hasUnsourcedClaim: hasProse && !hasSources,
  };
}
