/* ============================================================
   The three gates, on adversarial and on honest input.

   Two audit findings live here and they pull in opposite directions:

     05 §3.2 / 03 C3 — a fabricated answer survives all three gates.
                       The gates check IDS; prose is unchecked model text, and
                       prose is what a reader reads.
     05 §3.3         — an HONEST answer about employment history had its real
                       citation stripped, because retrievedChunkIds read a
                       hard-coded list of three result paths and
                       r.experience[i].chunkIds was on none of them. FIXED: the
                       function walks the result now, so provenance is a
                       property of the DATA rather than of a path list somebody
                       has to remember to update.

   So the suite asserts both "the fabrication is not caught" (a scope test, see
   the long note below) and "the honest answer IS accepted" — the second pair
   was written RED against the target contract before the fix existed, so the
   fix could not be graded against itself. Both are green. They stay, as the
   regression test for a bug whose defining quality was that the path list
   looked complete.
   ============================================================ */
import test from "node:test";
import assert from "node:assert/strict";

import { goOffline } from "./helpers/contract.mjs";

goOffline();

const { callTool, validateAnswer, retrievedChunkIds, content, ANSWER_SCHEMA } = await import("../lib/knowledge/index.js");

/* Every id below is RESOLVED FROM THE CORPUS, never typed. Project ids are
   content and are being renamed under this suite (03 C2 — the self-referential
   case study's id matched every question about Meta the company). A test that
   hard-codes one fails for a reason that is not the finding it encodes. */
const SUBJECT = content.projects.find((p) => p.hasCaseStudy && (p.sections ?? []).length >= 2);
const withChunks = (e) => (e.chunkIds ?? []).length > 0;

/* ============================================================
   05 §3.3 — list_experience granted zero provenance. FIXED in Wave 2;
   these two are now the regression test for it.
   ============================================================ */

test("[05 §3.3 · regression] list_experience licenses the chunks it returned", async () => {
  const result = await callTool("list_experience", {});
  const calls = [{ name: "list_experience", input: {}, result }];

  /* Derived from the tool's own output rather than typed, so it stays true as
     content/ grows. cncsys legitimately contributes none — the 2007–2009 QA
     role has no bullets and therefore no chunk. That is a content gap and is
     documented as one. */
  const handedBack = result.experience.flatMap((e) => e.chunkIds);
  assert.ok(handedBack.length >= 5, "sanity: most roles carry a chunk id");

  const seen = retrievedChunkIds(calls);
  const missing = handedBack.filter((id) => !seen.has(id));
  assert.deepEqual(
    missing,
    [],
    `list_experience returned ${handedBack.length} chunk ids; the provenance gate saw ` +
      `${seen.size}. Provenance never descends into r.experience[].`
  );
});

test("[05 §3.3 · regression] a correct, grounded employment answer keeps its citation", async () => {
  /* The end-to-end consequence, reproduced verbatim from the audit. This is a
     TRUE answer, citing a chunk list_experience really just returned. BEFORE
     the fix the citation was stripped, hasUnsourcedClaim fired, the retry burnt
     a model turn and a repeat could degrade the answer to "not on file" — for
     the highest-stakes question class in the corpus, and the one
     list_experience exists to serve. */
  const result = await callTool("list_experience", {});
  const calls = [{ name: "list_experience", input: {}, result }];

  const role = result.experience.find(withChunks);
  assert.ok(role, "sanity: at least one role must carry a chunk id");

  const blocks = [
    { type: "prose", text: `He is currently a ${role.role} at ${role.org}.` },
    { type: "experience", entryId: role.id },
    { type: "sources", chunkIds: [role.chunkIds[0]] },
  ];

  const verdict = validateAnswer(blocks, calls);

  assert.deepEqual(verdict.strippedSources, [], "a real, just-returned citation was stripped");
  assert.equal(verdict.hasUnsourcedClaim, false, "a grounded answer was flagged unsourced");
  assert.equal(verdict.blocks.length, 3, "the sources block was dropped");
  assert.equal(verdict.ok, true);
});

/* ============================================================
   05 §3.1 — no non-prose block may carry model-authored text

   `project.why` was free-form model prose sitting in a non-prose block, four
   lines under a comment saying no such thing existed, rendering attached to an
   id-validated project row and borrowing its credibility. Wave 2 deleted it.
   These two tests are the lock that keeps it deleted.
   ============================================================ */

const FABRICATED_WHY = "He shipped it single-handedly after being promoted to Head of Engineering.";

test("[05 §3.1 · regression lock] a non-prose block cannot carry free text", async () => {
  const project = await callTool("get_project", { id: SUBJECT.id });
  const calls = [{ name: "get_project", input: { id: SUBJECT.id }, result: project }];

  const verdict = validateAnswer(
    [
      { type: "prose", text: "Some prose." },
      { type: "project", id: SUBJECT.id, why: FABRICATED_WHY },
      { type: "sources", chunkIds: project.chunkIds.slice(0, 1) },
    ],
    calls
  );

  assert.equal(verdict.ok, false, "a project block carrying `why` must not validate");
  assert.deepEqual(verdict.dropped.map((d) => d.type), ["project"]);
  assert.ok(
    !JSON.stringify(verdict.blocks).includes("Head of Engineering"),
    "free text in a non-prose block reached the client"
  );
});

test("[05 §3.1 · regression lock] the block union admits exactly one free-text field", () => {
  /* The generalised form, asserted against the EMITTED schema rather than the
     validator, so adding a `why`-alike to any variant is loud at review time
     instead of discoverable by audit. Every field outside `prose.text` names
     content by id; if this list needs to grow, that is a decision someone
     should have to make deliberately. */
  const variants = ANSWER_SCHEMA.properties.blocks.items.anyOf;
  const shape = Object.fromEntries(
    variants.map((v) => [v.properties.type.const, Object.keys(v.properties).filter((k) => k !== "type").sort()])
  );

  assert.deepEqual(shape, {
    prose: ["text"],
    project: ["id"],
    experience: ["entryId"],
    facts: ["termIds"],
    metric: ["metricIndex", "projectId"],
    tags: ["labels"],
    links: ["linkIds"],
    media: ["projectId", "slot"],
    sources: ["chunkIds"],
  });
});

/* ============================================================
   05 §3.2 / 03 C3 — the prose channel is STILL unvalidated

   READ THIS BEFORE CHANGING THE TEST BELOW.

   Deliberately NOT written against a fixed target, because there is no agreed
   one: C3's recommended fix is to stop overclaiming in the docs, not to add a
   mechanism. So this is a SCOPE test — it pins how far the guarantee reaches,
   using the audit's own constructed answer, and it is a tripwire both ways:

     · if it starts FAILING because blocks were dropped, C3 grew a mechanism —
       good; replace the assertions with the strong ones, as was already done
       above for §3.1 when `project.why` was deleted.
     · if it keeps PASSING, nobody may claim "everything the assistant says is
       traceable to text authored in content/", because this test is the
       counterexample, executable, in CI.

   What it must never become is a test asserting that validateAnswer works.
   ============================================================ */

const FABRICATION =
  "Yordan led a team of 40 engineers at Green Street and personally wrote the entire " +
  "design system in Rust over one weekend in 2019.";

test("[05 §3.2 / 03 C3 · SCOPE] fabricated prose with real citations passes all three gates", async () => {
  const project = await callTool("get_project", { id: SUBJECT.id });
  const calls = [{ name: "get_project", input: { id: SUBJECT.id }, result: project }];

  /* Schema-valid in every respect: a real project id, and two chunk ids that
     an ordinary, legitimate get_project call really did return this turn. */
  const blocks = [
    { type: "prose", text: FABRICATION },
    { type: "project", id: SUBJECT.id },
    { type: "sources", chunkIds: project.chunkIds.slice(0, 2) },
  ];

  const verdict = validateAnswer(blocks, calls);

  assert.equal(verdict.ok, true, "SCOPE CHANGED — see the note above");
  assert.equal(verdict.blocks.length, 3);
  assert.deepEqual(verdict.dropped, []);
  assert.deepEqual(verdict.strippedSources, []);
  assert.equal(
    verdict.hasUnsourcedClaim,
    false,
    "a valid sources block from ANY tool call satisfies this, related to the prose or not"
  );

  /* The whole point: the fabricated sentence ships verbatim, with a Sources
     list underneath that makes it look MORE sourced, not less. */
  assert.ok(JSON.stringify(verdict.blocks).includes("40 engineers"), "the fabricated prose shipped");
});

/* ============================================================
   The gates on the things they DO check — green, and must stay green
   ============================================================ */

test("an invented chunk id is stripped even when it is well-formed", async () => {
  const project = await callTool("get_project", { id: SUBJECT.id });
  const calls = [{ name: "get_project", input: { id: SUBJECT.id }, result: project }];

  /* Real, resolvable, never retrieved this turn — gate 2 passes it, gate 3
     must not. This is the distinction that justifies having both. Picked from
     the corpus so it stays a genuinely unretrieved id as content changes. */
  const unread = content.chunks.map((c) => c.id).find((id) => !project.chunkIds.includes(id));
  assert.ok(unread, "sanity: the corpus must hold a chunk this call did not return");

  const blocks = [
    { type: "prose", text: "Some prose." },
    { type: "sources", chunkIds: [unread] },
  ];
  const verdict = validateAnswer(blocks, calls);

  assert.deepEqual(verdict.strippedSources, [unread]);
  assert.equal(verdict.hasUnsourcedClaim, true, "prose survived with nothing backing it");
});

test("an unresolvable id drops its block and nothing else", async () => {
  const project = await callTool("get_project", { id: SUBJECT.id });
  const calls = [{ name: "get_project", input: { id: SUBJECT.id }, result: project }];

  const blocks = [
    { type: "prose", text: "Some prose." },
    { type: "project", id: "no-such-project", why: "invented" },
    { type: "experience", entryId: "no-such-role" },
    { type: "tags", labels: ["not-a-real-tag"] },
    { type: "sources", chunkIds: project.chunkIds.slice(0, 1) },
  ];
  const verdict = validateAnswer(blocks, calls);

  assert.equal(verdict.ok, false);
  assert.deepEqual(
    verdict.dropped.map((d) => d.type).sort(),
    ["experience", "project", "tags"]
  );
  assert.equal(verdict.blocks.length, 2, "prose and the valid sources block survive");
});
