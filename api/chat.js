/* ============================================================
   /api/chat — the assistant's agent loop. Node runtime, SSE out.

   The loop IS the artefact. It is deliberately not hidden behind a
   framework helper:

     1. THE MANIFEST is in the frozen system prompt, so the model already
        knows every project, role and fact that exists. Most questions
        therefore cost read → respond (2 turns) rather than
        search → read → respond (3), and an out-of-corpus question costs
        0 tool calls.
     2. THE TURN CAP is 3. On the third the `respond` tool is FORCED, so
        worst-case latency is deterministic rather than hopeful.
     3. search_content IS ENTITY-GATED. Phase 1 measured this: raw BM25
        abstains on 0 of 11 unanswerable questions and answers "did he
        work at Google?" with a confident ranked list, because "Google"
        appears 8× in the corpus (Analytics, Play, AI Studio). The gated
        arm abstains correctly on 72.7%. A confidently-wrong answer about
        someone's employment history is the worst thing this system can
        produce, so the gate ships.
     4. THE THREE GATES (schema → referential → provenance) run HERE,
        server-side, before a single byte reaches the browser. A block
        that fails is dropped, not repaired by the client.
     5. ONLY COMPLETE, VALIDATED BLOCKS go on the wire. The client needs
        SSE framing and nothing else — no streaming JSON parser in
        vanilla JS. See §4 of the plan: this is the whole reason the
        stream framing question is a non-question.

   Tools come from lib/knowledge IN PROCESS. Routing them through
   /api/mcp would mean this function calling itself over HTTP once per
   tool call: ~100-300 ms per hop and a second cold-start path, to buy a
   purity argument. MCP is a distribution surface, not this app's
   internal boundary.

   Never logs, echoes or returns ANTHROPIC_API_KEY.
   ============================================================ */
import Anthropic from "@anthropic-ai/sdk";
import {
  TOOLS,
  RESPOND_TOOL,
  MAX_BLOCKS,
  callTool,
  content,
  manifest,
  tokenize,
  validateAnswer,
} from "../lib/knowledge/index.js";
import { checkBudget, recordUsage } from "./_budget.js";

export const config = { runtime: "nodejs" };

/* ============================================================
   Budget — every one of these is a ceiling, not a hope
   ============================================================ */
const MODEL = "claude-haiku-4-5";
const MAX_TURNS = 3;              // on the 3rd, `respond` is forced
const MAX_TOKENS = 4096;          // blocks are ids, not prose — this is generous
const MAX_QUESTION_CHARS = 1000;
const MAX_HISTORY_MESSAGES = 12;  // 6 exchanges; the manifest carries the rest
const HEARTBEAT_MS = 10_000;

/* The loop's own wall clock, checked at the top of every turn.
   maxDuration is the platform's ceiling and a bad budget: it is what a HANG
   costs, not what work costs. Three Haiku turns plus a retry is ~10-20s, so a
   run past this is not a slow answer, it is something stuck — and the cost of
   being stuck is paid by the reader waiting and by the function-seconds bill.

   It gates whether a NEW turn may START, so the true worst case is this plus
   one turn in flight. Measured against a 25s-per-turn upstream the loop stopped
   after two turns and still delivered a `done` at 50s. 35s keeps that worst
   case under the 60s maxDuration in vercel.json with room for a slow turn, so
   the loop stops ITSELF and emits an answer rather than being cut off
   mid-stream by the platform — a truncated SSE stream is the one failure the
   client cannot render. */
const MAX_WALL_MS = 35_000;

/* ============================================================
   The frozen system prompt

   FROZEN means frozen: no dates, no session ids, no request counters.
   Anything volatile here would sit at the front of the prefix and
   invalidate everything after it. (Phase 0 measured the prefix at
   ~2.6-3.1k tokens — under Haiku 4.5's 4096-token minimum cacheable
   prefix, so it will NOT cache. We are deliberately not padding it to
   clear the bar; at ~$0.003/turn uncached the entire question is worth
   fractions of a cent. Recorded rather than quietly dropped.)
   ============================================================ */
function renderManifest(m) {
  const lines = [];
  lines.push("PROJECTS (id — client — title · tags):");
  for (const p of m.projects) {
    lines.push(
      `  ${p.id} — ${p.client || "—"} — ${p.title}` +
        (p.tags?.length ? ` · ${p.tags.join(", ")}` : "") +
        `\n    ${p.summary}`
    );
  }
  lines.push("");
  lines.push("EXPERIENCE (id — role @ org — span):");
  for (const e of m.experience) lines.push(`  ${e.id} — ${e.role} @ ${e.org} — ${e.span}`);
  lines.push("");
  lines.push(`PERSONAL FACTS (id — title): ${m.facts.map((f) => `${f.id} (${f.title})`).join(", ")}`);
  return lines.join("\n");
}

const SYSTEM_PROMPT = `You are the assistant on Yordan Hristov's portfolio site. You answer questions about his work, his experience and the design system this site is built on — and about nothing else.

THE CORPUS BOUNDARY IS ABSOLUTE.
Everything you may assert lives in the tools below. Below is the complete table of contents of that corpus: every project, every role, every fact. It is exhaustive. If a question asks about something that is not in this manifest and not returned by a tool, the honest and correct answer is that it is not on file — say so plainly in a prose block and stop. Do not infer, do not reason by analogy from a similar-sounding project, and never soften a "no" into a maybe. A confidently wrong answer about someone's employment history is the worst thing you can produce here.

=== CORPUS MANIFEST ===
${renderManifest(manifest)}
=== END MANIFEST ===

HOW TO WORK
1. Read the manifest first. It usually tells you exactly which project or role holds the answer, so you can go straight to get_project / list_experience and skip searching entirely. Some questions ("what has he shipped?") are answerable from the manifest alone, with no tool call.
2. get_profile is the ONLY path to location, availability, contact details, education, languages and the skills taxonomy. Those are structured fields; they exist in no prose chunk, so search_content cannot find them. Never search for "where is he based" — call get_profile.
3. get_system_facts answers questions about this repository, the design system, the token and component counts, and the tooling.
4. search_content is a last resort, for when the manifest does not tell you which entity holds the material. It is entity-gated: if your query names nothing that exists in this corpus it returns zero results, and that is the corpus telling you the answer is not on file. Do not rephrase and retry to get around it.
5. You may call several tools in one turn. You have at most ${MAX_TURNS} turns; on the last one you MUST answer.

HOW TO ANSWER
You answer only by calling the \`respond\` tool. Never write free markdown, never answer in plain text.

\`prose\` is the ONLY block that carries your own words. Every other block names content by id and the page renders it from the same source the rest of the site renders from — so a project block becomes a real row that opens the real case study, and an experience block becomes the real CV entry. This is why you must never restate a fact you could reference: do not type a date, a metric, a tag or a client name into prose when a \`metric\`, \`tags\`, \`experience\` or \`project\` block would carry it.

Compose an answer of at most ${MAX_BLOCKS} blocks:
- Open with one short \`prose\` block — two or three sentences, plain and specific, no preamble and no "great question".
- Then the blocks that carry the evidence: \`project\`, \`experience\`, \`metric\`, \`facts\`, \`tags\`, \`links\`, \`media\`.
- Close with one \`sources\` block listing the chunk ids that tools ACTUALLY returned to you in this turn. Ids you did not receive are stripped server-side and the answer is weaker for it, so cite what you read and nothing else. A structured read (get_project, get_profile, list_experience, get_system_facts) returns a \`chunkIds\` array — those count.

If the corpus does not cover the question, the whole answer is one \`prose\` block saying so. That is a complete, correct answer, not a failure.`;

/* ============================================================
   The entity gate

   The `tools-gated` arm from Phase 1, in production form. Structured
   entity matching decides WHETHER the corpus covers a query; BM25
   decides WHAT comes back. Match is over each entity's NAME SURFACE
   only — ids, titles, clients, tags, org and role names, skill terms,
   fact titles — never its body, so a term that merely appears somewhere
   in the prose cannot open the gate.

   Each matched term contributes its corpus IDF, taken from
   content.bm25.df: a statistic of the corpus, not of any question set.
   Nothing here is tuned.
   ============================================================ */
/* The gate used to be implemented here. It now lives in lib/knowledge/gate.js
   and is applied inside search_content itself, so api/mcp.js gets it too —
   while it lived in this file, the web chat abstained correctly and the MCP
   server handed the ungated arm to anyone who added it to their own Claude.
   Same tool, same corpus, two different answers to "did he work at Google?".

   The cause is worth remembering: lib/knowledge/ was declared off-limits to
   both Phase 2 and Phase 3 so two parallel agents could not collide in it, and
   the gate landed in a surface because that was the only place it was allowed
   to land. A scoping decision taken for merge safety became an architectural
   defect. api/CLAUDE.md forbids exactly this and it happened anyway.

   `runTool` stays as the single funnel every tool call passes through — it is
   where the trace events are emitted — but it no longer decides anything. */
/** Seconds until the budget window rolls over, for a truthful Retry-After. */
const secondsUntilUtcMidnight = () =>
  Math.max(1, Math.ceil((new Date().setUTCHours(24, 0, 0, 0) - Date.now()) / 1000));

const runTool = (name, input) => callTool(name, input);
/* callTool is async now — search_content may embed the query. Every call site
   below awaits it. */

/** One line for the trace viewer. Never the whole tool result. */
function summarize(name, result) {
  if (!result || typeof result !== "object") return "";
  if (result.error) return `${result.error}`;
  switch (name) {
    case "list_projects":
      return `${result.count} of ${result.total} projects`;
    case "get_project":
      return `${result.id} — ${result.sections?.length ?? 0} sections, ${result.chunkIds?.length ?? 0} chunks`;
    case "list_experience":
      return `${result.count} roles`;
    case "get_profile":
      return `identity, availability, contact, ${result.education?.education?.length ?? 0} qualifications`;
    case "get_system_facts":
      return `${result.designSystem?.tokens} tokens · ${result.designSystem?.components} components`;
    case "search_content":
      return result.gated
        ? "gated — no entity matched, 0 results"
        : `${result.count} chunks (gate: ${result.gateMatched})`;
    default:
      return "";
  }
}

/* ============================================================
   SSE
   ============================================================ */
/* The raw writer. Defensive about the socket because a destroyed one still
   ACCEPTS res.write() — it fails asynchronously and emits 'error' on the
   ServerResponse, which nothing here listens for. The per-request `closed`
   guard in the handler is the authoritative check; this is the backstop. */
const send = (res, event, data) => {
  if (res.writableEnded || res.destroyed) return;
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
};

/** The one answer that is always safe to emit. */
const NOT_ON_FILE = (why) => [
  {
    type: "prose",
    text:
      why ||
      "That is not on file. This assistant only answers from Yordan's own written record — his projects, his roles, and the design system behind this site — and nothing in it covers that.",
  },
];

/* ============================================================
   Handler
   ============================================================ */
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.statusCode = 405;
    res.setHeader("Allow", "POST");
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "method_not_allowed" }));
    return;
  }

  /* ---- SPEND CONTROL (Phase 4) --------------------------------------
     Two different quantities, two different mechanisms:

       requests  → Vercel WAF rate limiting, at the edge, BEFORE this
                   function is invoked, so abuse costs nothing rather
                   than one invocation per rejection. Platform config on
                   /api/*, not code. See api/CLAUDE.md for the rules.
       tokens    → the daily cap below. A rate limit cannot catch one
                   slow, legal, expensive conversation; a token budget
                   can. It needs shared state, so it is real only when
                   Upstash is configured and says so plainly when it is
                   not — see api/_budget.js for why an in-memory
                   counter would be worse than none.
     -------------------------------------------------------------------- */
  const budget = await checkBudget();
  if (budget.over) {
    res.statusCode = 429;
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Retry-After", String(secondsUntilUtcMidnight()));
    res.end(
      JSON.stringify({
        error: "over_budget",
        kind: "over_budget",
        message:
          "The assistant is resting — it has reached its budget for today. " +
          "Everything it would tell you is on this page already.",
        resetsAt: new Date(new Date().setUTCHours(24, 0, 0, 0)).toISOString(),
      })
    );
    return;
  }

  let body = req.body;
  if (body === undefined || typeof body === "string") {
    try {
      body = typeof body === "string" ? JSON.parse(body) : JSON.parse(await readBody(req));
    } catch (err) {
      if (err?.code === "E_BODY_TOO_LARGE") {
        /* Drop the socket once the answer is out, rather than sitting there
           absorbing the rest of an upload already refused. Destroying first
           would reset the connection and the caller would get a transport
           error instead of a reason. */
        res.once("finish", () => req.destroy());
        return fail(
          res,
          413,
          "bad_request",
          `That message is too large. A question is capped at ${MAX_QUESTION_CHARS} characters.`
        );
      }
      body = null;
    }
  }

  const messagesIn = Array.isArray(body?.messages) ? body.messages : null;
  if (!messagesIn?.length) {
    return fail(res, 400, "bad_request", "Send { messages: [{ role, content }] }.");
  }

  const history = messagesIn
    .slice(-MAX_HISTORY_MESSAGES)
    .filter((m) => (m?.role === "user" || m?.role === "assistant") && typeof m.content === "string")
    .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_QUESTION_CHARS) }));

  // The API requires the first message to be a user turn.
  while (history.length && history[0].role !== "user") history.shift();

  if (!history.length) {
    return fail(res, 400, "bad_request", "The first message must be from the user.");
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    /* Structured, renderable, and never a stack trace. */
    return fail(
      res,
      503,
      "no_api_key",
      "The assistant is not configured on this deployment. Everything else on this page works — the case studies, the CV, and the eval results are all static."
    );
  }

  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-store, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });

  /* Trace events double as the keep-alive, so first byte lands ~1 s in
     regardless of how long the loop runs. The heartbeat covers the gap
     before the first tool call. */
  let closed = false;    // the reader is gone: stop writing AND stop spending
  let finished = false;  // we ended the response ourselves

  const beat = setInterval(() => {
    if (!closed && !res.writableEnded && !res.destroyed) res.write(": ping\n\n");
  }, HEARTBEAT_MS);

  /* The client hanging up must stop the SPENDING, not just the writing. The
     agent loop was previously unaffected by a disconnect: it kept calling the
     model, and every send() after that wrote to a destroyed socket. The signal
     goes into client.messages.create so an in-flight call is CANCELLED, not
     merely ignored when it returns.

     Listen on `res`, not on `req`. An IncomingMessage emits 'close' when the
     REQUEST completes — which for a POST is as soon as the body has been read,
     several hundred milliseconds before any of this runs. Registering there
     meant the handler was either attached too late to ever fire or fired
     immediately for the wrong reason; measured, it never fired at all and the
     loop ran all three turns after the reader had left. `res` 'close' is the
     one that means the socket went away, and `writableEnded` separates a
     premature close from our own res.end(). */
  const ac = new AbortController();

  const finish = () => {
    if (finished) return;
    finished = true;
    clearInterval(beat);
    if (!res.writableEnded) res.end();
  };

  res.on("close", () => {
    clearInterval(beat);
    if (!res.writableEnded) {
      closed = true;
      ac.abort();
    }
  });

  /** Every SSE write goes through here, so one flag stops all of them. */
  const emit = (event, data) => {
    if (closed) return;
    send(res, event, data);
  };

  emit("meta", { model: MODEL, maxTurns: MAX_TURNS, maxBlocks: MAX_BLOCKS });

  const client = new Anthropic({ apiKey });
  const messages = history.map((m) => ({ role: m.role, content: m.content }));
  const toolCallsThisTurn = [];
  const usage = { input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0 };
  let turns = 0;

  const tally = (u) => {
    if (!u) return;
    usage.input_tokens += u.input_tokens ?? 0;
    usage.output_tokens += u.output_tokens ?? 0;
    usage.cache_read_input_tokens += u.cache_read_input_tokens ?? 0;
  };

  const ask = (forced) =>
    client.messages.create(
      {
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: SYSTEM_PROMPT,
        tools: [...TOOLS, RESPOND_TOOL],
        tool_choice: forced ? { type: "tool", name: "respond" } : { type: "auto" },
        messages,
      },
      /* Cancels the HTTP request to Anthropic when the reader hangs up. */
      { signal: ac.signal }
    );

  const startedAt = Date.now();

  try {
    let answer = null;

    while (turns < MAX_TURNS && !answer) {
      /* Two ways to stop that are not "the model finished": the reader left,
         or the loop has run long enough that something is wrong. Both break
         rather than throw, so whatever survived validation is still emitted
         and `finally` still bills what was actually spent. */
      if (closed || ac.signal.aborted) break;
      if (Date.now() - startedAt > MAX_WALL_MS) break;

      turns += 1;
      const forced = turns === MAX_TURNS;
      emit("turn", { turn: turns, forced });

      const response = await ask(forced);
      tally(response.usage);

      const calls = response.content.filter((b) => b.type === "tool_use");
      const respond = calls.find((c) => c.name === "respond");

      if (respond) {
        answer = { blocks: respond.input?.blocks, id: respond.id, content: response.content };
        break;
      }

      if (!calls.length) {
        /* The model answered in prose instead of calling `respond`. That
           is a contract violation, not an answer: append it and let the
           next turn (which is forced) convert it into blocks. */
        messages.push({ role: "assistant", content: response.content });
        messages.push({
          role: "user",
          content:
            "Answer by calling the `respond` tool. Free text is not an answer here.",
        });
        continue;
      }

      messages.push({ role: "assistant", content: response.content });

      const results = [];
      for (const call of calls) {
        const started = Date.now();
        const result = await runTool(call.name, call.input ?? {});
        const ms = Date.now() - started;

        toolCallsThisTurn.push({ name: call.name, input: call.input, result });

        /* Emitted the MOMENT the tool runs — this is the trace viewer's
           feed and the connection's keep-alive at the same time. */
        emit("trace", {
          turn: turns,
          tool: call.name,
          input: call.input ?? {},
          summary: summarize(call.name, result),
          ms,
        });

        results.push({
          type: "tool_result",
          tool_use_id: call.id,
          content: JSON.stringify(result),
        });
      }
      messages.push({ role: "user", content: results });
    }

    /* ---- The three gates, server-side, before anything is emitted ---- */
    let verdict = validateAnswer(answer?.blocks ?? [], toolCallsThisTurn);
    let retried = false;

    /* One retry, then degrade — plan §2. `hasUnsourcedClaim` means prose
       survived with nothing backing it, which is exactly the shape of a
       plausible-sounding invention. */
    if (answer && (verdict.hasUnsourcedClaim || !verdict.blocks.length)) {
      retried = true;
      emit("notice", {
        kind: "retry",
        reason: verdict.blocks.length ? "prose survived with no surviving sources" : "no block survived validation",
        dropped: verdict.dropped,
        strippedSources: verdict.strippedSources,
      });

      messages.push({ role: "assistant", content: answer.content });
      messages.push({
        role: "user",
        content: [
          {
            type: "tool_result",
            tool_use_id: answer.id,
            content: JSON.stringify({
              rejected: true,
              dropped: verdict.dropped,
              strippedSources: verdict.strippedSources,
              instruction:
                "Every id must resolve in the corpus and every cited chunk id must have been returned to you by a tool call in THIS conversation. Call `respond` again. If you cannot back a claim with a chunk a tool actually gave you, drop the claim — and if that leaves nothing, answer with a single prose block saying it is not on file.",
            }),
          },
        ],
      });

      const retry = await ask(true);
      tally(retry.usage);
      turns += 1;
      const again = retry.content.find((b) => b.type === "tool_use" && b.name === "respond");
      const retryVerdict = validateAnswer(again?.input?.blocks ?? [], toolCallsThisTurn);
      if (retryVerdict.blocks.length) verdict = retryVerdict;
    }

    let blocks = verdict.blocks;
    let degraded = false;
    if (!blocks.length) {
      degraded = true;
      blocks = NOT_ON_FILE();
    }

    for (const block of blocks) emit("block", block);

    if (verdict.dropped.length || verdict.strippedSources.length) {
      emit("notice", {
        kind: "gates",
        dropped: verdict.dropped,
        strippedSources: verdict.strippedSources,
      });
    }

    emit("done", {
      turns,
      retried,
      degraded,
      blocks: blocks.length,
      dropped: verdict.dropped.length,
      strippedSources: verdict.strippedSources.length,
      toolCalls: toolCallsThisTurn.length,
      usage,
    });
  } catch (err) {
    /* Never a stack trace on the wire. The status the upstream gave us
       is useful; its internals are not. */
    const status = err?.status ?? err?.statusCode ?? null;
    const kind = status === 429 ? "rate_limited" : status === 401 || status === 403 ? "no_api_key" : "upstream";
    /* An abort we caused ourselves is not an upstream failure and has nobody
       left to tell: `emit` is already a no-op once `closed` is set, so this
       classification only ever reaches a reader who is still connected. */
    emit("error", {
      kind,
      status,
      message:
        kind === "rate_limited"
          ? "The assistant is busy right now. Try again in a moment — the case studies and the CV are all static and unaffected."
          : "The assistant could not complete that. Nothing else on this page depends on it.",
    });
    emit("done", { turns, blocks: 0, error: kind, usage });
  } finally {
    /* Bill what was actually spent, including a run that errored mid-way —
       those tokens were still bought. In `finally` so no early return or throw
       can skip it: under-counting a budget is the one direction that matters.
       Not awaited — the answer is already on the wire and a bookkeeping round
       trip should not delay `finish()`; recordUsage swallows its own failures. */
    void recordUsage(usage.input_tokens + usage.output_tokens);
    finish();
  }
}

/* ============================================================
   Helpers
   ============================================================ */
const MAX_BODY_BYTES = 64_000;

/* Rejecting the promise ends the AWAIT, not the UPLOAD. The 'data' listener
   stayed attached and kept concatenating, so a 10MB body was still received in
   full into memory long after the caller had given up on it — the cap bounded
   the waiting and nothing else. Detaching the listener is what actually stops
   the read; the socket is dropped later, by the caller, once the 413 has
   flushed. (api/mcp.js caps at 256KB — a bigger number because it carries a
   whole JSON-RPC envelope, the same shape of fix.) */
function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.setEncoding?.("utf8");
    const onData = (c) => {
      data += c;
      if (data.length > MAX_BODY_BYTES) {
        req.removeListener("data", onData);
        req.pause();
        const err = new Error("body too large");
        err.code = "E_BODY_TOO_LARGE";
        reject(err);
      }
    };
    req.on("data", onData);
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

/** A structured payload the UI can render. Never a stack trace. */
function fail(res, status, kind, message) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify({ error: kind, message, blocks: NOT_ON_FILE(message) }));
}
