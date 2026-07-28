/* ============================================================
   The entity gate — the safety property.

   Audit 03 · C2: "The entity gate is opened by a single common corpus token."
   There is no IDF floor, so any one matching name-surface token opens it. The
   only existing coverage is the eval's 11 unanswerable questions, which are all
   of one shape: they avoid corpus vocabulary entirely. The measured failure is
   the natural phrasing, not the exotic one.

   WHAT THE `regression` TAG MEANS HERE. Every assertion tagged
   [C2 · regression] was written against the TARGET contract and failed on
   purpose before the discrimination existed — an IDF floor, a shared-token
   rule, a ≥2-matched-terms rule; the shape was Wave 2's to choose. Writing
   them first is what stopped the fix from being graded against itself. They
   are green now, and they stay: this is the property that gets tuned away
   first, because every one of these tokens looks harmless on its own.

   The untagged tests are the counterweight, and they matter just as much:
   a gate that refuses everything scores perfectly on abstention and is useless.
   They pin the questions a fix may not break.
   ============================================================ */
import test from "node:test";
import assert from "node:assert/strict";

import { goOffline, readJson, gateOpened, nameSurfaceDf, isCorpusMiss } from "./helpers/contract.mjs";

goOffline();

const { entityGate, content, callTool } = await import("../lib/knowledge/index.js");
const { buildNameSurfaces } = await import("../lib/knowledge/gate.js");

const opens = (q) => gateOpened(entityGate(q));

/* ------------------------------------------------------------
   C2 — a single common token must not open the gate
   ------------------------------------------------------------ */

/* Measured by audit 03 against the shipped corpus. Each of these opens the
   gate today, on its own, with no entity named anywhere in the query. */
const MEASURED_SINGLE_TOKEN_OPENERS =
  "design system product senior research team web site audit app".split(" ");

test("[C2 · regression] no single common corpus token opens the gate alone", () => {
  const stillOpening = MEASURED_SINGLE_TOKEN_OPENERS.filter(opens);
  assert.deepEqual(
    stillOpening,
    [],
    `these bare tokens name no entity yet open the gate: ${stillOpening.join(" ")}`
  );
});

/* The generalised, corpus-derived form of the same property — the one that
   does not depend on a list somebody typed. If a token appears in the name
   surfaces of three or more different entities it identifies none of them, so
   it cannot be evidence that the corpus covers the query. Nothing here is
   tuned against evals/questions.json; the statistic is a property of the
   corpus, exactly like the IDF the gate already uses. */
test("[C2 · regression] a token shared by 3+ entity name surfaces cannot open the gate alone", () => {
  const df = nameSurfaceDf(buildNameSurfaces(content));
  const shared = [...df].filter(([, n]) => n >= 3).map(([t]) => t);
  assert.ok(shared.length >= 10, "sanity: the corpus should have shared name-surface tokens");

  const stillOpening = shared.filter(opens);
  assert.deepEqual(
    stillOpening,
    [],
    `tokens naming 3+ different entities still open the gate: ${stillOpening.join(" ")}`
  );
});

/* The four phrasings from C2's table. Each names an employer he never had and
   each is a MORE natural phrasing than the one question the eval tests.
   "Meta" appears here as the COMPANY, deliberately — renaming the
   self-referential case study away from the id `meta` is one of C2's own
   recommended fixes, and if that rename is what turns these green, that is the
   fix working. The question text must not be edited to match a new id. */
const FABRICATED_EMPLOYER_QUESTIONS = [
  "did he do design work at Meta",
  "what product design did he do at Stripe",
  "was he a senior designer at Figma",
  "tell me about his research at Meta",
];

test("[C2 · regression] one word of corpus vocabulary does not defeat the gate", () => {
  const opened = FABRICATED_EMPLOYER_QUESTIONS.filter(opens);
  assert.deepEqual(
    opened,
    [],
    `questions about employers he never had still open the gate: ${opened.join(" | ")}`
  );
});

test("[C2 · regression] 'did he do design work at Meta' yields no composed-answer path", async () => {
  /* The end-to-end consequence, at the surface both api/chat.js and api/mcp.js
     share. The gate opening is not the harm; the harm is real, well-cited
     chunks coming back for a question about an employer he never had, which a
     model then composes into a confident answer. Shape-agnostic on purpose —
     Wave 2 is moving the gate above search_content, and this must hold either
     way. */
  const res = await callTool("search_content", { query: "did he do design work at Meta", limit: 8 });
  assert.ok(
    isCorpusMiss(res),
    `search_content handed back ${res.results?.length ?? "?"} chunks for a fabricated employer ` +
      `(gateMatched: ${JSON.stringify(res.gateMatched)})`
  );
});

/* ------------------------------------------------------------
   The counterweight — what a fix may NOT break

   Green today. A gate that refuses everything scores 100% on abstention.
   ------------------------------------------------------------ */

test("the questions the gate already refuses stay refused", () => {
  /* Green today and the reason the gate exists. Kept so a refactor that
     rebuilds the matcher cannot quietly lose the original property. */
  for (const q of ["did he work at Google", "work", "brand", "user", "Kubernetes backend microservices"]) {
    assert.equal(opens(q), false, `expected the gate to refuse: ${q}`);
  }
});

test("every out-of-corpus eval question is refused", () => {
  const questions = readJson("evals/questions.json").questions.filter(
    (q) => q.category === "out-of-corpus"
  );
  /* Non-emptiness, not arity. A hard-coded count made this fail the moment the
     eval gained an eighth out-of-corpus question — for a reason that had nothing
     to do with the property under test, which is that NONE of them open the gate.
     Same instinct as `verifyTokeniser` and the test below: derive from the
     shipped artefact so it grows with the corpus. */
  assert.ok(questions.length > 0, "sanity: the out-of-corpus class should be non-empty");
  const opened = questions.filter((q) => opens(q.question)).map((q) => q.id);
  assert.deepEqual(opened, [], `out-of-corpus questions opened the gate: ${opened.join(", ")}`);
});

test("every real entity is still reachable by its own name", () => {
  /* Artefact-driven rather than a hand-typed list, in the spirit of
     verifyTokeniser: derived from the shipped corpus, so it grows with it. */
  const missed = [];
  for (const p of content.projects) {
    if (!opens(`What was the ${p.title} project about?`)) missed.push(`project:${p.id}`);
    if (!opens(p.id.replace(/-/g, " "))) missed.push(`project-id:${p.id}`);
  }
  for (const e of content.experience) {
    if (!opens(`What did he do at ${e.org}?`)) missed.push(`experience:${e.id}`);
  }
  assert.deepEqual(missed, [], `a fix closed the gate on real entities: ${missed.join(", ")}`);
});

test("a distinctive name still opens the gate on its own", () => {
  /* The direct tension with a naive "require >= 2 matched terms" rule, stated
     so it is a decision rather than an accident. Each of these questions
     matches exactly ONE name-surface term, and that term names exactly one
     entity — which is precisely the case the gate SHOULD open on. Note that
     this cannot be derived from name-surface df alone: `team`, `web` and
     `audit` are also df-1 in this corpus and are in the refusal list above.
     Distinguishing them is the design problem Wave 2 owns. */
  const cases = [
    ["mindromeda", "What is Mindromeda?"],
    ["domestina", "What was the Domestina project about?"],
    ["spetema", "How many products are in the Spetema catalogue?"],
    ["paraflow", "What is Paraflow?"],
  ];

  const df = nameSurfaceDf(buildNameSurfaces(content));
  for (const [term, q] of cases) {
    /* Sanity first: if a rename removes the name this question asks about, fail
       with a message that says so rather than as a mysterious gate regression. */
    assert.ok(df.has(term), `"${term}" is no longer a name in the corpus — update this case`);
    assert.equal(opens(q), true, `a real entity became unreachable: ${q}`);
  }
});
