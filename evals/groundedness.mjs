#!/usr/bin/env node
/* ============================================================
   groundedness.mjs — the answer-level measurement Phase 3 shipped without

   Does the PROSE follow from the chunks it CITES?

   `evals/run.mjs` measures the retriever: hit@k, MRR, abstention. Those are
   properties of retrieval, need no model, and run free in CI. They say nothing
   about the sentence a reader actually reads. The audit put it exactly:

     "Gate 3 proves a chunk was RETURNED BY A TOOL; it says nothing about
      whether the sentence beside it follows from that chunk. 'Everything the
      assistant says is traceable to text authored in content/' is true of ids
      and false of sentences, and sentences are what a reader reads."

   A fabricated claim wearing a validated citation passes all three gates. This
   file puts a number on that gap.

   ── HOW IT IS DIFFERENT FROM run.mjs, and why that matters ──────────────────

     run.mjs                        groundedness.mjs
     free, offline, deterministic   billed, networked, non-deterministic
     runs in CI on every commit     NEVER in CI — refuses if $CI is set
     measures the RETRIEVER         measures the ANSWER
     needs no key                   needs ANTHROPIC_API_KEY, and a running
                                    /api/chat to answer against

   It is a separate file rather than a flag on run.mjs precisely so that no
   accident can put a model call on the commit path. run.mjs does not import it
   and must not.

   ── WHY IT DRIVES THE HTTP ENDPOINT RATHER THAN THE LOOP ────────────────────

   The obvious implementation is to import api/chat.js and call the agent loop.
   scripts/check-boundaries.mjs forbids it (`evals` may not reference `api/`),
   and the rule is right: an eval that reimplemented the loop, the system prompt
   and the retry policy would measure a lookalike assistant and publish the
   number as if it were the real one. So this drives the SHIPPED surface over
   HTTP and parses the SSE it emits. Nothing about the answer is reconstructed.

   The one thing it does import from lib/knowledge is `retrievedChunkIds` — the
   very function the provenance gate uses — so that "which chunk ids could this
   turn legitimately have cited" is computed by the shipped code and not by a
   guess about which tools license what.

   ── THE FOURTH VERDICT, AND WHY IT IS NOT A ZERO ────────────────────────────

   Some tools license no chunk ids at all:

     · `get_design_system` / `get_component` — deliberately. The component
       contract is not chunked and not in the manifest, so there is nothing
       honest to license; inventing one would be the borrowed-credibility
       failure that removing `project.why` closed.
     · `list_projects` — not deliberately, just a consequence of its shape: the
       compact record it returns carries no chunkIds array at all.

   `list_experience` USED to be a third case and was the reason this verdict
   exists. `retrievedChunkIds` read a hard-coded list of three paths and none of
   them was `r.experience[i].chunkIds`, so the tool licensed 0 of 76 chunks and
   the highest-stakes question class in the corpus was structurally unable to
   cite. FIXED — the function now walks the result for chunkId/chunkIds keys, so
   provenance is a property of the DATA rather than of a path list somebody has
   to remember to update. That is also why this note is kept rather than
   deleted: the bug was invisible precisely because the list looked complete.

   Anything written before that fix — including the `unsourceable.note` baked
   into the committed evals/groundedness.json — still describes list_experience
   as unable to cite. That file is an artefact of a billed manual run and can
   only change on a re-run; do not hand-edit it to agree with this comment.

   An answer built only from those tools has prose and no possible source. The
   provenance gate fires, the retry burns a turn, and the answer may degrade —
   and none of that is the model inventing anything. Scoring it as ungrounded
   would blame the model for a property of the tool surface, so it gets its own
   verdict, `unsourceable`, and its own line in the output. The headline
   groundedness rate is computed over turns that COULD cite.

   ── THE JUDGE IS A MODEL, AND THIS FILE DOES NOT PRETEND OTHERWISE ──────────

   An LLM judge is an instrument with its own error rate, and nothing here
   validates it. Two things make it usable rather than circular: it is a
   different, larger model than the one under test (haiku answers, sonnet
   judges), and it is given ONLY the cited chunk text — never the corpus, never
   the question's ground truth — so it cannot confirm a claim from knowledge the
   answer never cited. Every verdict carries the judge's own one-line reason so
   a human can audit a sample. Treat the number as an estimate with a Wilson
   interval on it, which is how it is reported.

   ── USAGE ──────────────────────────────────────────────────────────────────

     # 1. start the real endpoint in another terminal
     vercel dev            # or any host that serves /api/chat

     # 2. run it once, manually
     node --env-file=.env evals/groundedness.mjs

     node --env-file=.env evals/groundedness.mjs --n 40
     node --env-file=.env evals/groundedness.mjs --endpoint http://localhost:3000/api/chat
     node --env-file=.env evals/groundedness.mjs --capture turns.jsonl   # save raw turns
     node evals/groundedness.mjs --from turns.jsonl                      # re-judge, no chat spend
     node evals/groundedness.mjs --dry-run                               # print the plan, spend nothing

   Writes evals/groundedness.json. Nothing else in the repo reads it; it is
   evidence for a human, not an input to a gate.
   ============================================================ */
import { readFileSync, writeFileSync, appendFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { content, callTool, retrievedChunkIds } from "../lib/knowledge/index.js";
import { wilson } from "./stats.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");

/* ============================================================
   Options
   ============================================================ */
const argv = process.argv.slice(2);
const flag = (name) => argv.includes(`--${name}`);
const opt = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i !== -1 && argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : fallback;
};

const ENDPOINT = opt("endpoint", "http://localhost:3000/api/chat");
const JUDGE_MODEL = opt("judge-model", "claude-sonnet-4-5");
const TARGET_N = Number(opt("n", "40"));
const FROM = opt("from", null);
const CAPTURE = opt("capture", null);
const DRY_RUN = flag("dry-run");
const OUT = join(here, "groundedness.json");

/* NEVER IN CI. This is the one file in evals/ that spends money and depends on
   a running server, and the suite's contract says nothing here calls a model on
   the commit path. A flag is not enough — the guard is the mechanism. */
if (process.env.CI) {
  console.error(
    `✗ groundedness.mjs will not run under CI.\n` +
      `  It bills two model APIs and needs a live /api/chat. evals/run.mjs is the CI gate;\n` +
      `  this is a manual measurement whose output is committed evidence, not a check.`
  );
  process.exit(1);
}

/* ============================================================
   The turns to measure

   Deterministic stride over evals/questions.json rather than a random sample,
   so two runs measure the same turns and a regression is a regression rather
   than a different draw. Abstention questions are INCLUDED on purpose: "the
   corpus does not cover that" is an answer whose groundedness is exactly as
   worth checking, and it is the one an over-eager model is most likely to
   fabricate around.
   ============================================================ */
const QUESTIONS = JSON.parse(readFileSync(join(here, "questions.json"), "utf8")).questions;

/* EVENLY SPREAD, not the first N. `i % stride` with stride 1 is `slice(0, 40)`,
   which took the first 40 questions of 65 — every project, experience, skill
   and cross-cutting question and NOT ONE abstention question, because
   questions.json is ordered by category and the abstention classes are last.
   A groundedness sample missing every "the corpus does not cover that" turn
   would miss the shape most likely to be fabricated around. Rounding an even
   fraction of the file keeps the category mix and stays deterministic. */
const k = Math.min(TARGET_N, QUESTIONS.length);
const SELECTED = Array.from({ length: k }, (_, i) => QUESTIONS[Math.floor((i * QUESTIONS.length) / k)]);

if (DRY_RUN) {
  const mix = SELECTED.reduce((m, q) => ({ ...m, [q.category]: (m[q.category] ?? 0) + 1 }), {});
  console.log(`endpoint     ${ENDPOINT}`);
  console.log(`judge        ${JUDGE_MODEL}`);
  console.log(`turns        ${SELECTED.length} of ${QUESTIONS.length}, evenly spread`);
  console.log(`mix          ${Object.entries(mix).map(([c, n]) => `${c} ${n}`).join(" · ")}`);
  console.log(`spend        ${SELECTED.length} chat conversations + up to ${SELECTED.length} judge calls`);
  console.log(SELECTED.map((q, i) => `  ${String(i + 1).padStart(2)} ${q.id.padEnd(30)} ${q.question}`).join("\n"));
  process.exit(0);
}

/* ============================================================
   1. Answer — drive the shipped endpoint, parse its SSE
   ============================================================ */
const chunkText = new Map(content.chunks.map((c) => [c.id, `${c.heading}. ${c.text}`]));

/** Parse an `event: X\ndata: {...}` stream into the events this needs. */
function parseSSE(body) {
  const out = { blocks: [], traces: [], notices: [], done: null, error: null, meta: null };
  for (const frame of body.split("\n\n")) {
    const ev = /^event: (.+)$/m.exec(frame)?.[1];
    const raw = frame
      .split("\n")
      .filter((l) => l.startsWith("data: "))
      .map((l) => l.slice(6))
      .join("");
    if (!ev || !raw) continue;
    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      continue;
    }
    if (ev === "block") out.blocks.push(data);
    else if (ev === "trace") out.traces.push(data);
    else if (ev === "notice") out.notices.push(data);
    else if (ev === "done") out.done = data;
    else if (ev === "error") out.error = data;
    else if (ev === "meta") out.meta = data;
  }
  return out;
}

async function askEndpoint(question) {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "text/event-stream" },
    body: JSON.stringify({ messages: [{ role: "user", content: question }] }),
  });
  const body = await res.text();
  if (!res.ok && !body.includes("event:")) {
    throw new Error(`${ENDPOINT} → ${res.status}: ${body.slice(0, 200)}`);
  }
  return parseSSE(body);
}

/* ============================================================
   2. What this turn COULD have cited

   Replays the turn's tool calls locally and hands the results to the SHIPPED
   `retrievedChunkIds` — the same function the provenance gate uses. That is
   what makes "unsourceable" a fact about the tool surface rather than an
   opinion about it.

   VOYAGE_API_KEY is removed for the replay: `search_content` ranks with
   embeddings when a key is present, and the ranking does not change which ids
   are LICENSABLE for a query that returned n results. Dropping the key keeps
   the replay free and offline.
   ============================================================ */
async function licensableFor(traces) {
  const saved = process.env.VOYAGE_API_KEY;
  if (saved !== undefined) delete process.env.VOYAGE_API_KEY;
  try {
    const calls = [];
    for (const t of traces) {
      try {
        calls.push({ name: t.tool, input: t.input ?? {}, result: await callTool(t.tool, t.input ?? {}) });
      } catch {
        /* A tool that throws on replay licenses nothing, which is the safe
           direction: it can only move a turn INTO `unsourceable`, never out. */
      }
    }
    return new Set(retrievedChunkIds(calls));
  } finally {
    if (saved !== undefined) process.env.VOYAGE_API_KEY = saved;
  }
}

/* ============================================================
   3. Judge

   Forced tool use, one verdict per prose block, and the judge sees ONLY the
   prose and the cited chunk text. Not the question's expected chunks, not the
   corpus, not the arm's ranking. If a claim is true of the corpus but absent
   from what the answer cited, the correct verdict is `unsupported` — because
   that is precisely the gap being measured.
   ============================================================ */
const VERDICT_TOOL = {
  name: "verdict",
  description: "Record one verdict per numbered claim.",
  input_schema: {
    type: "object",
    additionalProperties: false,
    required: ["claims"],
    properties: {
      claims: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["index", "verdict", "reason"],
          properties: {
            index: { type: "integer", description: "The claim number, as given." },
            verdict: {
              type: "string",
              enum: ["supported", "partly-supported", "unsupported", "contradicted"],
              description:
                "supported: every factual assertion follows from the cited text. " +
                "partly-supported: some do and at least one does not. " +
                "unsupported: the cited text does not contain the assertion either way. " +
                "contradicted: the cited text says something incompatible with it.",
            },
            reason: { type: "string", description: "One sentence. Quote the deciding words." },
          },
        },
      },
    },
  },
};

const JUDGE_SYSTEM =
  "You are auditing an assistant that answers questions about one person's portfolio. " +
  "You are given the assistant's prose and the FULL TEXT of every passage it cited. " +
  "Decide, for each numbered claim, whether it follows from the cited text ALONE.\n\n" +
  "Rules that decide the hard cases:\n" +
  "- Judge only against the cited text. If a claim is plausible, or true of the world, or " +
  "true of a portfolio you can imagine, but is not in the cited text, it is `unsupported`. " +
  "That is the entire measurement; do not be generous.\n" +
  "- Numbers, dates, job titles, employer names, team sizes and counts must appear in the " +
  "cited text. An approximation the text does not state is `unsupported`.\n" +
  "- Ordinary connective language, hedging, and restating the question are not claims. " +
  "Judge the factual assertions.\n" +
  "- A refusal ('the corpus does not cover that') is `supported` when the cited text indeed " +
  "does not cover it, and `contradicted` when it plainly does.\n" +
  "Call the `verdict` tool exactly once.";

async function judge(claims, sources, key) {
  const body = {
    model: JUDGE_MODEL,
    max_tokens: 2000,
    system: JUDGE_SYSTEM,
    tools: [VERDICT_TOOL],
    tool_choice: { type: "tool", name: "verdict" },
    messages: [
      {
        role: "user",
        content:
          `CITED PASSAGES (${sources.length}):\n` +
          (sources.length
            ? sources.map((s) => `[${s.id}]\n${s.text}`).join("\n\n")
            : "(none — the answer cited nothing)") +
          `\n\nCLAIMS:\n` +
          claims.map((c, i) => `${i + 1}. ${c}`).join("\n"),
      },
    ],
  };
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`judge ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const json = await res.json();
  const use = json.content?.find((b) => b.type === "tool_use");
  if (!use) throw new Error("judge returned no tool_use block");
  return { claims: use.input?.claims ?? [], usage: json.usage ?? null };
}

/* ============================================================
   4. Run
   ============================================================ */
const KEY = process.env.ANTHROPIC_API_KEY;
if (!KEY) {
  const hint = existsSync(join(root, ".env"))
    ? `  .env exists on disk and Node does not read it on its own. Run:\n\n      node --env-file=.env evals/groundedness.mjs\n`
    : `  Set ANTHROPIC_API_KEY, or pass --from <captured.jsonl> to re-judge a saved run.\n`;
  console.error(`✗ ANTHROPIC_API_KEY is not set in this process — the judge cannot run.\n${hint}`);
  process.exit(1);
}

const turns = [];

/** Source of raw turns: replay a capture, or drive the live endpoint. */
async function collect() {
  if (FROM) {
    const lines = readFileSync(join(root, FROM), "utf8").split("\n").filter(Boolean);
    console.log(`↻ replaying ${lines.length} captured turns from ${FROM} — no chat spend`);
    return lines.map((l) => JSON.parse(l));
  }
  const out = [];
  console.log(`→ ${SELECTED.length} turns against ${ENDPOINT}`);
  for (const [i, q] of SELECTED.entries()) {
    process.stdout.write(`  ${String(i + 1).padStart(2)}/${SELECTED.length} ${q.id} … `);
    try {
      const sse = await askEndpoint(q.question);
      const rec = { questionId: q.id, question: q.question, category: q.category, shape: q.shape ?? "lookup", sse };
      out.push(rec);
      if (CAPTURE) appendFileSync(join(root, CAPTURE), JSON.stringify(rec) + "\n");
      console.log(`${sse.blocks.length} blocks, ${sse.traces.length} tool calls${sse.error ? ` — ERROR ${sse.error.kind}` : ""}`);
    } catch (e) {
      console.log(`FAILED — ${e.message}`);
      out.push({ questionId: q.id, question: q.question, category: q.category, shape: q.shape ?? "lookup", failure: e.message });
    }
  }
  return out;
}

const raw = await collect();

console.log(`\n→ judging with ${JUDGE_MODEL}`);
for (const rec of raw) {
  if (rec.failure) {
    turns.push({ ...rec, outcome: "endpoint-failed" });
    continue;
  }
  const { sse } = rec;
  if (sse.error) {
    turns.push({ ...rec, sse: undefined, outcome: "endpoint-error", detail: sse.error.kind });
    continue;
  }

  const prose = sse.blocks.filter((b) => b.type === "prose").map((b) => b.text).filter(Boolean);
  const cited = [...new Set(sse.blocks.filter((b) => b.type === "sources").flatMap((b) => b.chunkIds ?? []))];
  const licensable = await licensableFor(sse.traces);
  const sources = cited.map((id) => ({ id, text: chunkText.get(id) ?? "(id resolves to no chunk)" }));

  const base = {
    questionId: rec.questionId,
    question: rec.question,
    category: rec.category,
    shape: rec.shape,
    tools: sse.traces.map((t) => t.tool),
    licensableChunkIds: licensable.size,
    citedChunkIds: cited,
    proseBlocks: prose.length,
    turnsUsed: sse.done?.turns ?? null,
    retried: Boolean(sse.done?.retried),
    degraded: Boolean(sse.done?.degraded),
    strippedSources: sse.done?.strippedSources ?? 0,
  };

  if (!prose.length) {
    turns.push({ ...base, outcome: "no-prose" });
    console.log(`  ${rec.questionId.padEnd(30)} no prose block`);
    continue;
  }

  /* THE FOURTH VERDICT. Prose with nothing the tool surface could have licensed
     is not the model inventing a citation — it is the model having none to
     invent. Kept out of the headline rate, reported on its own line. */
  if (!cited.length && licensable.size === 0) {
    turns.push({ ...base, outcome: "unsourceable" });
    console.log(`  ${rec.questionId.padEnd(30)} unsourceable — ${base.tools.join(", ") || "no tools"} license 0 chunk ids`);
    continue;
  }

  try {
    const { claims, usage } = await judge(prose, sources, KEY);
    const verdicts = claims.map((c) => ({
      claim: prose[c.index - 1] ?? null,
      verdict: c.verdict,
      reason: c.reason,
    }));
    turns.push({ ...base, outcome: "judged", verdicts, judgeUsage: usage });
    const counts = verdicts.reduce((m, v) => ({ ...m, [v.verdict]: (m[v.verdict] ?? 0) + 1 }), {});
    console.log(`  ${rec.questionId.padEnd(30)} ${Object.entries(counts).map(([k, v]) => `${v} ${k}`).join(", ")}`);
  } catch (e) {
    turns.push({ ...base, outcome: "judge-failed", detail: e.message });
    console.log(`  ${rec.questionId.padEnd(30)} JUDGE FAILED — ${e.message}`);
  }
}

/* ============================================================
   5. Report
   ============================================================ */
const judged = turns.filter((t) => t.outcome === "judged");
const allVerdicts = judged.flatMap((t) => t.verdicts);
const n = allVerdicts.length;
const countOf = (v) => allVerdicts.filter((x) => x.verdict === v).length;

const supported = countOf("supported");
const partly = countOf("partly-supported");
const unsupported = countOf("unsupported");
const contradicted = countOf("contradicted");

/* The headline is STRICT: only fully supported counts. `partly-supported` means
   at least one assertion in that block did not follow from the cited text, and
   a paragraph with one invented number in it is not a grounded paragraph. */
const groundedRate = wilson(supported, n);
const notGrounded = wilson(unsupported + contradicted + partly, n);

const pct = (x) => `${(x * 100).toFixed(1)}%`;
const outcomeCounts = turns.reduce((m, t) => ({ ...m, [t.outcome]: (m[t.outcome] ?? 0) + 1 }), {});

const report = {
  $generatedBy: "evals/groundedness.mjs — manual, billed, never in CI",
  $question: "Does the prose follow from the chunks it cites? evals/run.mjs measures the retriever; this measures the answer.",
  generatedAt: new Date().toISOString(),
  endpoint: FROM ? `replayed from ${FROM}` : ENDPOINT,
  answerModel: raw.find((r) => r.sse?.meta)?.sse.meta.model ?? null,
  judgeModel: JUDGE_MODEL,
  judgeCaveat:
    "The judge is a model and nothing here validates it. It is larger than the model under test and " +
    "sees only the prose and the cited chunk text — never the corpus and never the question's ground " +
    "truth — so it cannot confirm a claim the answer did not cite. Read the rate as an estimate with " +
    "the interval attached, and audit the per-claim reasons before quoting it.",
  turns: { requested: SELECTED.length, collected: raw.length, ...outcomeCounts },
  claims: {
    n,
    supported,
    partlySupported: partly,
    unsupported,
    contradicted,
    groundedRate: { value: Number(groundedRate.p.toFixed(4)), lo: Number(groundedRate.lo.toFixed(4)), hi: Number(groundedRate.hi.toFixed(4)) },
    notGroundedRate: { value: Number(notGrounded.p.toFixed(4)), lo: Number(notGrounded.lo.toFixed(4)), hi: Number(notGrounded.hi.toFixed(4)) },
    note: "groundedRate counts ONLY fully supported claims. A block with one unsupported assertion in it is not a grounded block.",
  },
  unsourceable: {
    turns: outcomeCounts.unsourceable ?? 0,
    note:
      "Prose with no chunk id any tool called could have licensed. Not a model failure: get_design_system " +
      "and get_component license nothing deliberately (the component contract is not chunked and is not in " +
      "the corpus), and list_projects licenses nothing because its compact record carries no chunkIds array. " +
      "list_experience was a third case until retrievedChunkIds stopped reading a hard-coded path list and " +
      "started walking the result; it now licenses the chunk ids it returns, so any earlier run of this file " +
      "reports a larger unsourceable count than the same questions would produce today. " +
      "These turns are excluded from the rates above and counted here instead.",
  },
  detail: turns,
};

writeFileSync(OUT, JSON.stringify(report, null, 2) + "\n");

console.log("");
console.log(`turns          ${Object.entries(outcomeCounts).map(([k, v]) => `${v} ${k}`).join(" · ")}`);
console.log(`claims judged  ${n}`);
if (n) {
  console.log(
    `grounded       ${pct(groundedRate.p)}  95% CI ${pct(groundedRate.lo)}–${pct(groundedRate.hi)}   (fully supported only)`
  );
  console.log(
    `not grounded   ${pct(notGrounded.p)}  — ${unsupported} unsupported, ${contradicted} contradicted, ${partly} partly`
  );
}
console.log(`unsourceable   ${outcomeCounts.unsourceable ?? 0} turns — the tool surface licenses nothing, not a model failure`);
console.log(`✓ evals/groundedness.json`);
console.log(`  The judge is a model. Read evals/groundedness.json's per-claim reasons before quoting the rate.`);
