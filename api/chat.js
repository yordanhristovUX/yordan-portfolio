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
const send = (res, event, data) => {
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

  /* ---- PHASE 4 ATTACHES HERE ----------------------------------------
     Two different quantities, two different mechanisms:

       requests  → Vercel WAF rate limiting, at the edge, BEFORE this
                   function is ever invoked. Nothing to write here; it is
                   platform config on /api/*.
       tokens    → a daily spend cap in KV. That check belongs on this
                   line, before the client is constructed: read the day's
                   accumulated `usage.input_tokens + output_tokens`, and
                   if it is over budget respond 429 with the same
                   structured error payload used below (kind:
                   "over_budget") plus a static FAQ built from
                   content.json. The UI already renders that shape, so
                   the degraded path costs no new client code.

     Both are deliberately NOT stubbed now — a fake limiter that always
     passes is worse than none, because it reads as done.
     -------------------------------------------------------------------- */

  let body = req.body;
  if (body === undefined || typeof body === "string") {
    try {
      body = typeof body === "string" ? JSON.parse(body) : JSON.parse(await readBody(req));
    } catch {
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

  if (!history.length || history[0].role !== "user") {
    // The API requires the first message to be a user turn.
    while (history.length && history[0].role !== "user") history.shift();
  }
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
  const beat = setInterval(() => res.write(": ping\n\n"), HEARTBEAT_MS);
  let closed = false;
  const finish = () => {
    if (closed) return;
    closed = true;
    clearInterval(beat);
    res.end();
  };
  req.on?.("close", () => {
    clearInterval(beat);
    closed = true;
  });

  send(res, "meta", { model: MODEL, maxTurns: MAX_TURNS, maxBlocks: MAX_BLOCKS });

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
    client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: SYSTEM_PROMPT,
      tools: [...TOOLS, RESPOND_TOOL],
      tool_choice: forced ? { type: "tool", name: "respond" } : { type: "auto" },
      messages,
    });

  try {
    let answer = null;

    while (turns < MAX_TURNS && !answer) {
      turns += 1;
      const forced = turns === MAX_TURNS;
      send(res, "turn", { turn: turns, forced });

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
        send(res, "trace", {
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
      send(res, "notice", {
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

    for (const block of blocks) send(res, "block", block);

    if (verdict.dropped.length || verdict.strippedSources.length) {
      send(res, "notice", {
        kind: "gates",
        dropped: verdict.dropped,
        strippedSources: verdict.strippedSources,
      });
    }

    send(res, "done", {
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
    send(res, "error", {
      kind,
      status,
      message:
        kind === "rate_limited"
          ? "The assistant is busy right now. Try again in a moment — the case studies and the CV are all static and unaffected."
          : "The assistant could not complete that. Nothing else on this page depends on it.",
    });
    send(res, "done", { turns, blocks: 0, error: kind, usage });
  } finally {
    finish();
  }
}

/* ============================================================
   Helpers
   ============================================================ */
function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.setEncoding?.("utf8");
    req.on("data", (c) => {
      data += c;
      if (data.length > 64_000) reject(new Error("body too large"));
    });
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
