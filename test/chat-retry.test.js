/* ============================================================
   The provenance retry, driven through the REAL /api/chat handler over HTTP.

   ── WHAT THIS ENCODES ──────────────────────────────────────────────────────

   A groundedness run (evals/groundedness.json, 2026-07-28) put 40 real
   questions through the shipped loop and judged the answers with a larger
   model. Measured:

     · 18 of 40 turns (45%) fired the provenance retry.
     · In 15 of them the first `respond` carried no surviving citation, the
       retry ran, the model answered again with no citation, AND THE LOOP
       ACCEPTED IT — because the retry verdict was taken on `blocks.length`
       alone and `hasUnsourcedClaim` was never re-read.

   So 37.5% of turns ended with prose and zero citations *after* a retry whose
   entire purpose was to prevent that. The gate fired, cost a full model turn,
   and changed nothing. Those answers are mostly TRUE — the failure is loss of
   provenance, not fabrication — which is why the fix is not "degrade them all".

   ── WHY IT DRIVES HTTP RATHER THAN CALLING A FUNCTION ──────────────────────

   The defect is not in `validateAnswer`; every gate in lib/knowledge already
   reports `hasUnsourcedClaim` correctly. The defect is in what api/chat.js DOES
   with the verdict, and that lives inside the handler. A unit test against an
   extracted helper would test the extraction. This starts the shipped default
   export on a socket — the same shape evals/groundedness.mjs uses, and the same
   shape the finding was measured with — and scripts the upstream model instead,
   through ANTHROPIC_BASE_URL. The loop, the gates, the retry, the block cap and
   the SSE framing are all the real ones.

   No network: both servers are on 127.0.0.1, and every key that would reach
   one is removed below.
   ============================================================ */
import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";

import { goOffline } from "./helpers/contract.mjs";

goOffline();

/* The budget must be inert and offline here: configured credentials would make
   checkBudget() a real fetch in front of every request in this file. */
for (const key of [
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
  "KV_REST_API_URL",
  "KV_REST_API_TOKEN",
]) {
  delete process.env[key];
}
process.env.ANTHROPIC_API_KEY = "sk-test-not-a-real-key";

const { callTool, MAX_BLOCKS } = await import("../lib/knowledge/index.js");

/* Resolved from the corpus, never typed — the same rule test/schema.test.js
   follows, so this stays true as content/ grows. */
const profile = await callTool("get_profile", {});
const LICENSED = profile.chunkIds[0];
assert.ok(LICENSED, "sanity: get_profile must license at least one chunk id");

/* ============================================================
   Harness
   ============================================================ */
let script = [];
let spent = 0;

/** A scripted Anthropic Messages API. One entry per model turn. */
const upstream = createServer((req, res) => {
  req.resume();
  req.on("end", () => {
    const turn = script[Math.min(spent, script.length - 1)];
    spent += 1;
    res.writeHead(200, { "content-type": "application/json" });
    res.end(
      JSON.stringify({
        id: `msg_${spent}`,
        type: "message",
        role: "assistant",
        model: "claude-haiku-4-5",
        content: turn,
        stop_reason: "tool_use",
        stop_sequence: null,
        usage: { input_tokens: 10, output_tokens: 10 },
      })
    );
  });
});

let chat;

before(async () => {
  await new Promise((r) => upstream.listen(0, "127.0.0.1", r));
  /* The @anthropic-ai/sdk constructor defaults baseURL to this, so the shipped
     `new Anthropic({ apiKey })` in api/chat.js needs no seam of its own. */
  process.env.ANTHROPIC_BASE_URL = `http://127.0.0.1:${upstream.address().port}`;

  const { default: handler } = await import("../api/chat.js");
  assert.equal(typeof handler, "function", "api/chat.js must default-export a handler");
  chat = createServer((q, s) => handler(q, s));
  await new Promise((r) => chat.listen(0, "127.0.0.1", r));
});

after(async () => {
  await new Promise((r) => chat.close(r));
  await new Promise((r) => upstream.close(r));
});

const toolUse = (id, name, input) => ({ type: "tool_use", id, name, input });
const respond = (blocks, sources) => [toolUse("r", "respond", { blocks, sources })];
const READ_PROFILE = [toolUse("t", "get_profile", {})];

const PROSE = {
  type: "prose",
  text: "Yordan speaks Bulgarian as his native language and English at professional proficiency level.",
};

/** Run one conversation against the real handler and parse its SSE. */
async function ask(turns) {
  script = turns;
  spent = 0;

  const res = await fetch(`http://127.0.0.1:${chat.address().port}/api/chat`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "text/event-stream" },
    body: JSON.stringify({ messages: [{ role: "user", content: "What languages does he speak?" }] }),
  });
  assert.equal(res.status, 200, "the handler must answer 200 and stream");

  const out = { blocks: [], notices: [], done: null, error: null };
  for (const frame of (await res.text()).split("\n\n")) {
    const ev = /^event: (.+)$/m.exec(frame)?.[1];
    const raw = frame.split("\n").filter((l) => l.startsWith("data: ")).map((l) => l.slice(6)).join("");
    if (!ev || !raw) continue;
    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      continue;
    }
    if (ev === "block") out.blocks.push(data);
    else if (ev === "notice") out.notices.push(data);
    else if (ev === "done") out.done = data;
    else if (ev === "error") out.error = data;
  }

  assert.equal(out.error, null, `the loop errored: ${JSON.stringify(out.error)}`);
  assert.ok(out.done, "every conversation must end with a `done` event");
  out.modelTurns = spent;
  out.prose = out.blocks.filter((b) => b.type === "prose");
  out.cited = out.blocks.filter((b) => b.type === "sources").flatMap((b) => b.chunkIds ?? []);
  return out;
}

/* ============================================================
   The defect — RED before the fix
   ============================================================ */

test("[groundedness · 15 of 40] a retry that repeats the defect is not shipped silently", async () => {
  /* The measured shape, verbatim: tools were called and DID license chunk ids,
     the model answered with prose and cited nothing, the retry fired, and the
     retry came back with exactly the same defect. */
  const out = await ask([READ_PROFILE, respond([PROSE], []), respond([PROSE], [])]);

  assert.equal(out.done.retried, true, "sanity: the provenance retry must have fired");
  assert.deepEqual(out.cited, [], "sanity: this turn is the uncited shape by construction");

  /* The whole finding. Before the fix `hasUnsourcedClaim` was evaluated once,
     BEFORE the retry, and the retry was accepted on `blocks.length` alone — so
     an answer carrying the defect that triggered the retry reached the browser
     indistinguishable from a cited one. */
  assert.equal(
    out.done.uncited,
    true,
    "an answer that survived the retry with no citation must be reported as uncited — " +
      "this is the 15-of-40 defect: the gate fires, costs a model turn, and changes nothing"
  );

  const notice = out.notices.find((n) => n.kind === "uncited");
  assert.ok(notice, "the terminal state must be announced on the notice channel too");

  /* Reader-visible, not just machine-visible. A `notice` lands in a collapsed
     trace viewer; the person the provenance is for reads the blocks. */
  assert.equal(out.prose.length, 2, "the answer must carry a visible caveat block");
  assert.match(
    out.prose.at(-1).text,
    /citation/i,
    "the closing block must say plainly that the answer carries no citation"
  );

  /* And the answer itself is KEPT. "Bulgarian (native) and English
     (professional proficiency)" is true; degrading it to "not on file" would
     swap a correct answer for a refusal — the strongest answer failing in the
     shape of the weakest. */
  assert.equal(out.done.degraded, false, "a true-but-uncited answer must not be degraded to a refusal");
  assert.equal(out.prose[0].text, PROSE.text, "the model's answer must survive verbatim");
});

test("the required top-level `sources` field is provenance, not decoration", async () => {
  /* ANSWER_SCHEMA makes `sources` a REQUIRED top-level property of the respond
     input, so that "what did you read to write this" is a question the model
     must answer to emit anything at all. api/chat.js kept `respond.input.blocks`
     and dropped the rest, so an answer that cited only there was scored as
     having cited nothing: the retry fired, burned a model turn, and shipped
     uncited. The model had answered the question; the transport threw it away. */
  const out = await ask([READ_PROFILE, respond([PROSE], [LICENSED])]);

  assert.equal(out.done.retried, false, "a properly cited answer must not trigger the provenance retry");
  assert.equal(out.done.uncited, false);
  assert.equal(out.modelTurns, 2, "the wasted retry turn must not be spent");
  assert.deepEqual(
    out.cited,
    [LICENSED],
    "the surviving citation must reach the client as a `sources` block — the block is what " +
      "the client renders, so a citation validated server-side and never emitted is the same " +
      "loss of provenance in a different coat"
  );
});

/* ============================================================
   The states either side of it — green before and after
   ============================================================ */

test("an answer with a valid sources block is passed through untouched", async () => {
  const out = await ask([
    READ_PROFILE,
    respond([PROSE, { type: "sources", chunkIds: [LICENSED] }], [LICENSED]),
  ]);

  assert.equal(out.done.retried, false);
  assert.equal(out.done.uncited, false);
  assert.equal(out.done.degraded, false);
  assert.equal(out.blocks.length, 2, "nothing may be added to an already-grounded answer");
  assert.deepEqual(out.cited, [LICENSED]);
});

test("an answer where nothing survives still degrades to not-on-file", async () => {
  const out = await ask([
    READ_PROFILE,
    respond([{ type: "project", id: "no-such-project" }], []),
    respond([{ type: "project", id: "still-no-such-project" }], []),
  ]);

  assert.equal(out.done.retried, true);
  assert.equal(out.done.degraded, true, "the degrade path must survive the new terminal state");
  assert.equal(out.done.uncited, false, "degraded and uncited are different outcomes");
  assert.equal(out.blocks.length, 1);
  assert.match(out.prose[0].text, /not on file/i);
});

test("a retry that genuinely fixes the citation is accepted", async () => {
  const out = await ask([
    READ_PROFILE,
    respond([PROSE], []),
    respond([PROSE, { type: "sources", chunkIds: [LICENSED] }], [LICENSED]),
  ]);

  assert.equal(out.done.retried, true);
  assert.equal(out.done.uncited, false, "the retry did its job and must be taken");
  assert.deepEqual(out.cited, [LICENSED]);
});

test("a retry that comes back empty does not discard the first answer or its diagnostics", async () => {
  /* `betterOf` keeps the shipped `retry.blocks.length &&` test in front of the
     completeness comparison, because when the retry produces nothing the FIRST
     verdict is the one still carrying the `dropped` list that the trace and the
     `gates` notice report. Losing it would degrade the answer and lose the
     reason at the same time. */
  const out = await ask([
    READ_PROFILE,
    respond([PROSE, { type: "project", id: "no-such-project" }], []),
    respond([], []),
  ]);

  assert.equal(out.done.degraded, false, "the first answer's surviving prose must be kept");
  assert.equal(out.done.uncited, true);
  assert.equal(out.prose[0].text, PROSE.text);

  const gates = out.notices.find((n) => n.kind === "gates");
  assert.ok(gates, "the gates notice must still be emitted");
  assert.deepEqual(
    gates.dropped.map((d) => d.reason),
    ['no project "no-such-project" in content.json'],
    "the diagnostics of the verdict actually shipped must be the ones reported"
  );
});

test("a server-composed block fits inside the advertised block cap", async () => {
  /* MAX_BLOCKS is advertised in `meta` and enforced by gate 1, so the caveat
     displaces the last block rather than extending the answer past the cap. */
  const many = Array.from({ length: MAX_BLOCKS }, (_, i) => ({
    type: "prose",
    text: `Paragraph ${i + 1}.`,
  }));
  const out = await ask([READ_PROFILE, respond(many, []), respond(many, [])]);

  assert.equal(out.done.uncited, true);
  assert.equal(out.blocks.length, MAX_BLOCKS, `the answer must never exceed ${MAX_BLOCKS} blocks`);
  assert.match(out.blocks.at(-1).text, /citation/i, "the caveat must be the closing block");
});
