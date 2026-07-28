/* ============================================================
   callTool — the only surface where MCP passes unvalidated caller input
   straight to code, and the input bounds that go with it.

   Most of this file is GREEN and is meant to stay that way: it is the
   regression lock on the two holes Wave 0 already closed, written so that
   reopening either one is loud.

     03 M1 — `handlers[name]` walked the prototype chain. Measured over real
             HTTP: `constructor` returned 200 with isError FALSE and echoed the
             caller's own arguments back as a tool result; `toString` returned
             JSON-RPC -32602 carrying the MCP SDK's zod internals;
             `hasOwnProperty` put a full stack in the log. Fixed with
             Object.hasOwn. This file is what stops it coming back.
     03 C1 — an unbounded query was echoed and serialised twice: an 8.4 MB body
             came back as 16.8 MB. Fixed with SEARCH_QUERY_MAX_CHARS = 1000.

   The one RED test is n2: resolve.link is lax in the file whose job is not
   being lax.
   ============================================================ */
import test from "node:test";
import assert from "node:assert/strict";

import { goOffline } from "./helpers/contract.mjs";

goOffline();

const { callTool, handlers, resolve, TOOLS, content } = await import("../lib/knowledge/index.js");

/* The published surface, pinned. Typed rather than derived on purpose: the
   point of this list is that ADDING a tool is a deliberate edit here and not a
   thing that happens quietly. Wave 5 added the last two — the design system's
   agent surface, which is what audit 04 §3.5 found missing. */
const TOOL_NAMES = [
  "list_projects",
  "get_project",
  "list_experience",
  "get_profile",
  "get_system_facts",
  "search_content",
  "get_design_system",
  "get_component",
];

/* Resolved from the corpus, never typed. Project ids are content, not API —
   the self-referential case study is being renamed away from "meta" precisely
   because every question about Meta the company matched it by name (03 C2), and
   a test that hard-codes an id fails for a reason that is not the bug it
   encodes. Everything below asks the corpus which project carries links. */
const LINKED = content.projects.filter((p) => (p.links ?? []).length >= 2)[0]
  ?? content.projects.filter((p) => (p.links ?? []).length >= 1)[0];

/* ============================================================
   03 M1 — prototype-chain names take the unknown_tool path
   ============================================================ */

/* Every one of these resolves to a function through Object.prototype. Before
   the guard, three of them behaved differently from each other AND from an
   unknown name — which is the actual defect: a caller could distinguish them. */
const PROTOTYPE_NAMES = ["constructor", "hasOwnProperty", "toString", "valueOf", "__proto__", "isPrototypeOf", "propertyIsEnumerable", "toLocaleString"];

test("[03 M1 · regression lock] prototype-chain names take the unknown_tool path", async () => {
  for (const name of [...PROTOTYPE_NAMES, "definitely_not_a_tool"]) {
    const result = await callTool(name, { secret: "echoed-back" });

    assert.equal(result.error, "unknown_tool", `${name} did not report unknown_tool`);
    assert.deepEqual(result.available, TOOL_NAMES, `${name} reported the wrong tool list`);
    assert.equal(result.message, `No tool named "${name}".`);

    /* Nothing else on the object. Notably not the caller's own arguments: the
       measured failure was `constructor` echoing `{"secret":"echoed-back"}`
       back as structuredContent, which a calling agent reads as corpus data
       with no way to tell it called nothing. */
    assert.deepEqual(Object.keys(result).sort(), ["available", "error", "message"], `${name} returned extra fields`);
    assert.ok(!("secret" in result), `${name} echoed the caller's arguments`);

    /* And no leaked internals — no stack, no zod validation state. */
    const serialised = JSON.stringify(result);
    assert.ok(!/\bstack\b|node_modules|ZodError|zod|invalid_type/i.test(serialised), `${name} leaked internals: ${serialised}`);
  }
});

test("[03 M1 · regression lock] every unknown name is INDISTINGUISHABLE from every other", async () => {
  /* The property that actually matters, and the one the original bug broke:
     a caller must not be able to tell a prototype name from a typo. */
  const shapes = new Set();
  for (const name of [...PROTOTYPE_NAMES, "nope", "", "  ", "search_content ", "SEARCH_CONTENT"]) {
    const result = await callTool(name, {});
    shapes.add(JSON.stringify({ ...result, message: null }));
  }
  assert.equal(shapes.size, 1, "unknown tool names produce more than one response shape");
});

test("callTool tolerates hostile-but-well-typed input", async () => {
  /* Green. The schemas are strict, but nothing between the wire and the handler
     enforces them — api/mcp.js passes `request.params.arguments` through
     unchanged — so every one of these is reachable from an unauthenticated
     caller and must come back as a value, not an exception. */
  for (const [name, input] of [
    [undefined, undefined],
    [null, null],
    [123, { a: 1 }],
    [{}, []],
    ["get_project", null],
    ["get_project", { id: null }],
    ["get_project", { id: [1, 2] }],
    ["list_projects", { tag: 42, client: [], hasCaseStudy: "yes" }],
  ]) {
    await assert.doesNotReject(() => callTool(name, input), `callTool(${JSON.stringify(name)}) threw`);
  }
});

test("[NEW · T1 · RED] a JSON-reachable argument must not make a tool throw", async () => {
  /* FOUND BY THIS SUITE, not by an audit. `String(x)` and `` `…${x}` `` throw
     TypeError("Cannot convert object to primitive value") when x carries an own
     `toString` that is not callable — and `{"id": {"toString": null}}` is
     ordinary, valid JSON that JSON.parse produces verbatim. No prototype
     pollution and no exotic object is required.

     Reached through api/mcp.js this lands in the catch at mcp.js:199, which
     logs the full stack via console.error and returns "tool_failed" — i.e.
     exactly the M1 symptom Wave 0 closed for `hasOwnProperty`, reopened through
     the arguments rather than the name, and repeatable at the WAF's 60/min by
     any unauthenticated caller.

     Two sites confirmed: get_project's not_found template (tools.js) and
     search_content's `String(query ?? "")` clamp — the second bypasses
     SEARCH_QUERY_MAX_CHARS before it can apply.

     TARGET: coerce defensively, or reject a non-string id/query as a tool
     error. Owner: retrieval specialist (lib/knowledge/tools.js).

     EXTENDED IN WAVE 5 to the two design-system tools. Both take a
     caller-supplied value and get_component interpolates its id into a
     not-found message and its detail into a fallback note — the same two throw
     sites, in a new file's worth of code. A defect class stays closed only if
     every tool added after the fix is added to the test that closed it. */
  for (const [name, input] of [
    ["get_project", { id: { toString: null } }],
    ["get_project", { id: { toString: 5 } }],
    ["search_content", { query: { toString: null }, limit: 5 }],
    ["list_projects", { tag: { toString: null }, client: null, hasCaseStudy: null }],
    ["get_component", { id: { toString: null }, detail: null }],
    ["get_component", { id: { toString: 5 }, detail: "full" }],
    ["get_component", { id: "button", detail: { toString: null } }],
    ["get_component", { id: { valueOf: null, toString: null }, detail: { toString: null } }],
    ["get_design_system", { anything: { toString: null } }],
  ]) {
    await assert.doesNotReject(
      () => callTool(name, input),
      `callTool("${name}", ${JSON.stringify(input)}) threw on valid JSON`
    );
  }
});

test("[NEW · T1] a rejected argument is reported without being touched", async () => {
  /* doesNotReject above proves nothing THREW. This proves the refusal is also
     a usable tool error rather than an empty success — the failure mode where
     a handler swallows a bad argument and returns a result that looks like a
     lookup which found nothing. */
  for (const [input, arg, described] of [
    [{ id: { toString: null }, detail: null }, "id", "object"],
    [{ id: [1, 2], detail: null }, "id", "array"],
    [{ id: null, detail: null }, "id", null],
    [{ id: "button", detail: { toString: null } }, "detail", "object"],
    [{ id: "button", detail: ["full"] }, "detail", "array"],
  ]) {
    const res = await callTool("get_component", input);
    if (described === null) {
      /* null id means "" — no such component, so the not_found path, not the
         invalid_argument one. Both are clean; they are different answers. */
      assert.equal(res.error, "not_found");
      continue;
    }
    assert.equal(res.error, "invalid_argument", `${arg} was not refused`);
    assert.equal(res.message, `get_component.${arg} must be a string; received ${described}.`);
    const serialised = JSON.stringify(res);
    assert.ok(!/\bstack\b|node_modules|ZodError|zod/i.test(serialised), `leaked internals: ${serialised}`);
  }
});

test("the handler table and the published tool list agree", () => {
  assert.deepEqual(Object.keys(handlers).sort(), TOOL_NAMES.slice().sort());
  assert.deepEqual(TOOLS.map((t) => t.name).sort(), TOOL_NAMES.slice().sort());
});

/* ============================================================
   03 C1 — the input bounds Wave 0 added
   ============================================================ */

test("[03 C1 · regression lock] the search query is clamped to 1000 chars", async () => {
  const res = await callTool("search_content", { query: "kubernetes ".repeat(5000), limit: 8 });
  assert.equal(typeof res.query, "string", "the tool must echo the CLAMPED query, not the raw one");
  assert.ok(res.query.length <= 1000, `query echoed at ${res.query.length} chars`);
});

test("[03 C1 · regression lock] the response is bounded whatever the caller sends", async () => {
  /* The amplification property, stated without reference to any field name so
     it survives a change of return shape. api/mcp.js serialises the result
     twice (content[0].text and structuredContent), so the bound here is half
     the bound on the wire. */
  const huge = "design system domestina ".repeat(5000); // ~120 KB
  const res = await callTool("search_content", { query: huge, limit: 20 });
  const bytes = JSON.stringify(res).length;
  assert.ok(bytes < 64 * 1024, `a ${huge.length}-char query produced a ${bytes}-byte result`);
});

test("the search limit is clamped to 1..20 in the handler", async () => {
  const limitFor = async (limit) => (await callTool("search_content", { query: "domestina", limit })).limit;
  assert.equal(await limitFor(9999), 20);
  assert.equal(await limitFor(0), 1);
  assert.equal(await limitFor(-5), 1);
  assert.equal(await limitFor(3.7), 3);
  assert.equal(await limitFor("abc"), 8, "a non-numeric limit falls back to the default");
  assert.equal(await limitFor(Infinity), 8, "Infinity is not finite and must not clamp to 20 by accident");
});

/* ============================================================
   03 n2 — resolve.link is lax
   ============================================================ */

test("[03 n2 · RED until Wave 2] resolve.link rejects malformed link ids", () => {
  /* All of these resolve to link index 0 today, because Number("") is 0 and
     Number.isInteger accepts 1e0, 0.0 and -0. Harmless in effect — it renders
     a real link — but this is a validator, and a validator that accepts
     "<id>:" as "<id>:0" is not one. The id form is "<projectId>:<index>". */
  assert.ok(LINKED, "sanity: some project in the corpus must carry links");
  const id = LINKED.id;
  for (const suffix of ["", "1e0", "0.0", "-0", " 0", "+0", "0x0", "00"]) {
    const bad = `${id}:${suffix}`;
    assert.equal(resolve.link(bad), null, `resolve.link accepted the malformed id "${bad}"`);
  }
});

test("resolve.link still accepts the real thing", () => {
  const id = LINKED.id;
  assert.ok(resolve.link(`${id}:0`), `${id}:0 must resolve`);
  assert.equal(resolve.link(`${id}:${LINKED.links.length}`), null, "an out-of-range index must not resolve");
  assert.equal(resolve.link("no-such-project:0"), null);
  assert.equal(resolve.link(id), null, "no separator, no link");
});

/* ============================================================
   Tool descriptors — the contract api/mcp.js renames and republishes
   ============================================================ */

test("every tool schema is strict in the way mcp.js assumes", () => {
  for (const tool of TOOLS) {
    assert.equal(tool.strict, true, `${tool.name} is not strict`);
    const schema = tool.input_schema;
    assert.equal(schema.additionalProperties, false, `${tool.name} allows extra properties`);
    assert.deepEqual(
      schema.required.slice().sort(),
      Object.keys(schema.properties).sort(),
      `${tool.name}: strict mode requires every property to be listed in "required"`
    );
    assert.ok(tool.description?.length > 40, `${tool.name} has no usable description`);
  }
});

test("sections come back as an ordered array and a kind may repeat", async () => {
  /* Load-bearing: some project has two {#approach} and two {#outcome}. Keying
     sections by kind would silently discard half of them. Which project that
     is comes from the corpus, not from this file. */
  const repeats = (sections) => sections.length > new Set(sections.map((s) => s.kind)).size;
  const subject = content.projects.find((p) => repeats(p.sections ?? []));
  assert.ok(subject, "sanity: some project should carry a repeated section kind");

  const got = await callTool("get_project", { id: subject.id });
  assert.ok(Array.isArray(got.sections), "sections must be an array, never a map keyed by kind");
  assert.equal(got.sections.length, subject.sections.length, "a section was discarded in transit");
  assert.ok(repeats(got.sections), `get_project collapsed the repeated kinds of ${subject.id}`);
});

test("an unknown project id is a tool error, not a throw", async () => {
  const res = await callTool("get_project", { id: "does-not-exist" });
  assert.equal(res.error, "not_found");
  assert.ok(Array.isArray(res.available) && res.available.length > 0);
  assert.ok(!/\\|\/|node_modules/.test(res.message), "no path leaked in the message");
});

/* ============================================================
   04 §3.4/§3.5 — the design system's agent surface

   Two tiers, and these tests police the seam between them. The MECHANICAL
   half is generated and folded into content.json, so it needs no test here
   beyond "the fold happened". The HAND-DECLARED half — `composition` and
   `rules` in tools.js — is the Astryx residue, and Astryx's actual lesson is
   that the residue gets a drift test rather than a promise. That is what the
   first three tests below are.
   ============================================================ */

const DS = content.designSystem;

test("the design-system contract was folded into the corpus", () => {
  /* tools.js defaults this key to an empty contract rather than throwing at
     module init, because a throw there takes down the six corpus tools too —
     which have nothing to do with the design system. The cost of that choice
     is that a missing fold would degrade SILENTLY, so it is caught here
     instead: loud in CI rather than empty on the wire. */
  assert.ok(DS && Array.isArray(DS.components), "content.json carries no designSystem.components");
  assert.ok(DS.components.length > 0, "the design-system contract is empty");
  assert.equal(DS.count, DS.components.length, "designSystem.count disagrees with its own array");

  /* Not chunked and not in the manifest. Both are load-bearing: the manifest
     rides in the system prompt's frozen prefix and evals/results.json
     publishes its size, so folding this in would change a published number and
     force a rebuild that has already been paid for. */
  assert.ok(!("designSystem" in content.manifest), "the component contract leaked into the manifest");
  assert.equal(
    content.chunks.filter((c) => c.entity?.startsWith("component:")).length,
    0,
    "the component contract was chunked — it is a derived artefact, not a passage"
  );
});

test("[drift] `composition` names exactly the fields a component record carries", async () => {
  /* The hand-declared half, checked against the generated half. If the
     design-system build starts emitting a field, this fails until the contract
     documents it; if it stops emitting one, this fails until the contract
     drops it. Documentation that cannot go stale without failing CI. */
  const ds = await callTool("get_design_system", {});
  const documented = Object.keys(ds.composition).sort();

  for (const c of DS.components) {
    assert.deepEqual(
      Object.keys(c).sort(),
      documented,
      `component "${c.id}" does not match the documented composition`
    );
  }

  /* And `full` actually returns every documented field. */
  const full = await callTool("get_component", { id: DS.components[0].id, detail: "full" });
  for (const field of documented) {
    assert.ok(field in full, `detail "full" omits the documented field "${field}"`);
  }
});

test("[drift] every declared rule still holds against the contract", async () => {
  /* Five rules are typed in tools.js because no selector list implies them.
     Each one is checked here, so a rule that stops being true fails a test
     instead of shipping as advice. */
  const ds = await callTool("get_design_system", {});
  const rule = (id) => ds.rules.find((r) => r.id === id);

  assert.deepEqual(
    ds.rules.map((r) => r.id).sort(),
    ["classes-are-the-api", "judgement-lives-in-the-spec", "suffixes-are-enumerated", "themes-are-token-values", "values-come-from-tokens"],
    "a rule was added or removed without updating its check"
  );
  for (const r of ds.rules) {
    assert.ok(r.rule?.length > 60, `rule "${r.id}" has no usable text`);
    assert.ok(r.evidence?.length > 10, `rule "${r.id}" carries no evidence`);
  }

  /* classes-are-the-api: every class a component claims is backed by a real
     selector. This is what makes "a class not listed has no rule behind it"
     the true half of a biconditional rather than half a claim — audit 04 §3.1
     found four spec-claimed classes with no rule anywhere. */
  assert.ok(rule("classes-are-the-api"));
  for (const c of DS.components) {
    for (const k of c.classes) {
      assert.ok(c.selectors.some((s) => s.includes(k)), `${c.id} claims "${k}" with no selector behind it`);
    }
  }

  /* values-come-from-tokens: every token named is a custom property, and the
     set the tool reports is exactly the union of the per-component sets. */
  const union = new Set(DS.components.flatMap((c) => c.tokens));
  assert.equal(ds.counts.tokensUsedByComponents, union.size);
  for (const t of union) assert.match(t, /^--[a-z0-9-]+$/, `"${t}" is not a custom property`);
  assert.ok(
    ds.counts.tokensUsedByComponents <= ds.counts.tokensDeclared,
    "components consume more tokens than the system declares"
  );

  /* suffixes-are-enumerated: an element is __x, a variant is --x, and each one
     appears on a class the component also lists. A suffix with no class would
     be a name an agent could type into nothing. */
  for (const c of DS.components) {
    for (const e of c.elements) {
      assert.ok(e.startsWith("__"), `${c.id} element "${e}" is not a __suffix`);
      assert.ok(c.classes.some((k) => k.includes(e)), `${c.id} element "${e}" is on no class`);
    }
    for (const v of c.variants) {
      assert.ok(v.startsWith("--"), `${c.id} variant "${v}" is not a --suffix`);
      assert.ok(c.classes.some((k) => k.endsWith(v)), `${c.id} variant "${v}" is on no class`);
    }
  }

  /* themes-are-token-values: dark and print exist as VALUES. If either count
     ever reached zero, the rule telling an agent never to write a
     prefers-color-scheme query would be describing a system that no longer
     themes itself that way. */
  assert.ok(content.system.dark > 0 && content.system.print > 0, "themes are no longer carried as token values");
  assert.equal(
    content.system.light + content.system.dark + content.system.print,
    content.system.values,
    "the three theme counts no longer account for the published value count"
  );

  /* judgement-lives-in-the-spec: every component points at the human-written
     half and carries the one authored sentence. */
  for (const c of DS.components) {
    assert.ok(c.spec?.endsWith("spec.md"), `${c.id} has no spec path`);
    assert.ok(c.story?.length > 0, `${c.id} has no story path`);
    assert.ok(c.a11y?.length > 20, `${c.id} carries no authored a11y sentence`);
  }
});

test("get_design_system indexes every component and types no number", async () => {
  const ds = await callTool("get_design_system", {});
  assert.deepEqual(ds.components.map((c) => c.id), DS.components.map((c) => c.id), "the index dropped or reordered a component");
  assert.equal(ds.counts.components, DS.components.length);
  assert.equal(ds.$derivedFrom, DS.$derivedFrom, "provenance must name the generator, not this module");

  /* Every token in a category is in the flat set, and no token is in two
     categories — the grouping is a partition of the names, not a taxonomy. */
  const flat = ds.tokenCategories.flatMap((c) => c.tokens);
  assert.equal(new Set(flat).size, flat.length, "a token appears in two categories");
  assert.equal(flat.length, ds.counts.tokensUsedByComponents);
  for (const cat of ds.tokenCategories) {
    assert.equal(cat.count, cat.tokens.length);
    for (const t of cat.tokens) assert.ok(t.startsWith(`--${cat.prefix}`), `"${t}" is not in category "${cat.prefix}"`);
  }

  /* The counts in the DESCRIPTION are interpolated from the corpus. A typed
     number would pass today and go stale on the next component; this fails the
     moment the description and the corpus disagree. */
  const tool = TOOLS.find((t) => t.name === "get_design_system");
  assert.ok(tool.description.includes(String(DS.count)), "the component count is not interpolated into the description");
  assert.ok(tool.description.includes(String(content.system.tokens)), "the token count is not interpolated into the description");
});

test("get_component: brief is a strict subset of full and says what it dropped", async () => {
  const id = DS.components.find((c) => c.classes.length > 3).id;
  const brief = await callTool("get_component", { id, detail: "brief" });
  const full = await callTool("get_component", { id, detail: "full" });

  assert.equal(brief.detail, "brief");
  assert.equal(full.detail, "full");

  /* Both carry the authored sentence and the pointer to the judgement — the
     two things that must survive compression, because they are the half this
     contract cannot generate. */
  for (const res of [brief, full]) {
    assert.equal(res.a11y, DS.components.find((c) => c.id === id).a11y, "the authored a11y sentence was altered");
    assert.ok(res.spec?.endsWith("spec.md"), "brief dropped the pointer to the human-written half");
    assert.ok(res.counts.classes > 0, "counts must say what a full read costs");
  }

  /* Brief is smaller, and honest about it. */
  assert.ok(JSON.stringify(brief).length < JSON.stringify(full).length, "brief is not smaller than full");
  for (const field of brief.omitted.fields) {
    assert.ok(!(field in brief), `brief lists "${field}" as omitted and returns it anyway`);
    assert.ok(field in full, `full is missing "${field}"`);
  }

  /* blockClasses is a mechanical filter over the real class list, not a
     judgement about which class matters. */
  assert.deepEqual(
    brief.blockClasses,
    full.classes.filter((k) => !k.includes("__") && !k.includes("--")),
    "blockClasses is not the suffix-free subset of classes"
  );
  assert.ok(brief.blockClasses.length > 0, "every component must have at least one block-level class");
});

test("get_component: null detail means full, and an unknown level says so", async () => {
  const id = DS.components[0].id;
  assert.equal((await callTool("get_component", { id, detail: null })).detail, "full");
  assert.equal((await callTool("get_component", { id })).detail, "full");
  assert.equal((await callTool("get_component", { id, detail: "BRIEF" })).detail, "brief", "the level is case-insensitive");

  /* A fallback nobody can see is a silent degradation. */
  const odd = await callTool("get_component", { id, detail: "compact" });
  assert.equal(odd.detail, "full");
  assert.match(odd.detailNote, /compact/, "the tool fell back without saying so");
  assert.equal((await callTool("get_component", { id, detail: "full" })).detailNote, null);
});

test("an unknown component id is a tool error, not a throw", async () => {
  const res = await callTool("get_component", { id: "does-not-exist" });
  assert.equal(res.error, "not_found", "an unknown component must take the same path as an unknown project");
  assert.deepEqual(res.available, DS.components.map((c) => c.id));
  assert.ok(!/\\|\/|node_modules/.test(res.message), "no path leaked in the message");
  assert.ok(!/ZodError|zod|stack/i.test(JSON.stringify(res)), "schema-validator internals leaked");
});

test("neither design-system tool licenses a chunk id", async () => {
  /* DELIBERATE, and worth a test because the obvious "fix" is wrong. Gate 3
     licenses corpus PASSAGES a tool returned this turn. The component contract
     is a derived artefact and is not in the corpus, so there is nothing to
     license — and licensing profile or case-study chunks for it would let an
     answer about CSS classes borrow the credibility of text about something
     else, which is the exact failure removing `project.why` from schema.js
     closed. If these tools ever start returning chunkIds, that is a decision
     someone must make on purpose. */
  for (const call of [["get_design_system", {}], ["get_component", { id: DS.components[0].id, detail: "full" }]]) {
    const serialised = JSON.stringify(await callTool(...call));
    assert.ok(!/"chunkIds?"/.test(serialised), `${call[0]} returned a chunk id`);
  }
});

test("get_system_facts points at the contract instead of embedding it", async () => {
  /* 05 §5, re-checked now that a real design-system surface exists. The tool
     used to nest a whole get_project; the fix was to point at it by name. The
     same discipline has to hold for the design system, or the split is undone
     in a new shape one release later. */
  const facts = await callTool("get_system_facts", {});
  assert.equal(facts.designSystem.components, content.system.components);
  assert.ok(facts.designSystem.contract.includes("get_design_system"), "no pointer to the contract");
  assert.ok(!("components" in facts.designSystem && Array.isArray(facts.designSystem.components)), "the component array leaked into get_system_facts");

  const bytes = JSON.stringify(facts).length;
  assert.ok(bytes < 8 * 1024, `get_system_facts grew to ${bytes} bytes — it returns statistics, not payloads`);
});
