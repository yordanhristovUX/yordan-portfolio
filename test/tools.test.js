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

const TOOL_NAMES = ["list_projects", "get_project", "list_experience", "get_profile", "get_system_facts", "search_content"];

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
     error. Owner: retrieval specialist (lib/knowledge/tools.js). */
  for (const [name, input] of [
    ["get_project", { id: { toString: null } }],
    ["get_project", { id: { toString: 5 } }],
    ["search_content", { query: { toString: null }, limit: 5 }],
    ["list_projects", { tag: { toString: null }, client: null, hasCaseStudy: null }],
  ]) {
    await assert.doesNotReject(
      () => callTool(name, input),
      `callTool("${name}", ${JSON.stringify(input)}) threw on valid JSON`
    );
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
