/* ============================================================
   api/mcp.js — the portfolio as a remote MCP server.

   Streamable HTTP, Node runtime, stateless, public, READ-ONLY.

   This is a DISTRIBUTION SURFACE, not this app's internal boundary. The web
   chat (api/chat.js) calls lib/knowledge in process; routing it through here
   would make the function call itself over HTTP once per tool call — an extra
   hop, a second cold-start path and a self-referential dependency bought
   purely to satisfy a purity argument. What this endpoint adds is that
   *someone else's* agent can use the same six tools from their own tooling,
   with no chat UI in the middle. See /mcp and ARCHITECTURE.md.

   The six tools are IMPORTED from lib/knowledge, never reimplemented. Both
   surfaces go through the same `callTool`, so a tool bug cannot exist on one
   and not the other. Everything below this line is transport and framing.

   Stateless by construction: Vercel functions do not persist between
   invocations, so a fresh Server + transport is built per request and torn
   down with it. `sessionIdGenerator: undefined` disables session tracking —
   nothing is ever asked to survive a request.
   ============================================================ */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import { TOOLS, callTool, content } from "../lib/knowledge/index.js";

/* ============================================================
   Identity
   ============================================================ */
const SERVER_NAME = "yordan-portfolio";
const SERVER_VERSION = "1.0.0";
const SITE_URL = "https://yordan-portfolio.vercel.app";

/* JSON-RPC error codes (the subset this endpoint can raise). */
const PARSE_ERROR = -32700;
const INVALID_REQUEST = -32600;
const INTERNAL_ERROR = -32603;

/* ------------------------------------------------------------
   The request-size ceiling.

   Every legitimate message this endpoint can receive is a JSON-RPC envelope
   around at most a tool name and a short argument object — the largest real one
   is a search query, and lib/knowledge clamps that to 1000 characters. 256KB is
   three orders of magnitude of headroom and still bounds the worst case.

   It is here because the endpoint's whole security argument is that its worst
   case is COST rather than data, and an unbounded body broke that argument
   arithmetically: an 8.4MB body came back as a 16.8MB response, because the
   tool echoed the query and this file serialised the echo twice. At the
   documented 60 req/min/IP WAF limit that is ~1GB of billed egress per minute
   from a single IP, on an endpoint with no auth. The clamp in lib/knowledge
   fixes the amplification; this fixes the ingestion that fed it.
   ------------------------------------------------------------ */
const MAX_BODY_BYTES = 256 * 1024;
const BODY_TOO_LARGE = "E_BODY_TOO_LARGE";

/* ============================================================
   Server instructions

   The first thing a cold client reads. It has to answer three questions
   before any tool is called: whose data is this, what is it good for, and
   what will it refuse to do.
   ============================================================ */
const INSTRUCTIONS = `Read-only access to the portfolio, CV and case-study corpus of Yordan Hristov, a Senior Product Designer based in Sofia, Bulgaria.

Use it to answer questions about his work history, projects, case studies, skills, education, availability and contact details, and about how this site and its design system are built. Everything returned is text he authored himself; nothing is generated at request time.

Choosing a tool:
- \`list_projects\` first if you do not yet know what exists — it is the table of contents (${content.projects.length} projects, ${content.projects.filter((p) => p.hasCaseStudy).length} with full case studies).
- \`get_project\` to read one project in full once you have its id.
- \`list_experience\` for employment history (${content.experience.length} roles) — org, role, dates, location and bullets.
- \`get_profile\` for the person: location, availability, contact, skills, education, languages. These are structured fields and are NOT reachable by search.
- \`get_system_facts\` for questions about this repository, the design system or the site itself.
- \`search_content\` only when you cannot tell which project or role holds the material. It is lexical BM25, not semantic — favour the words the corpus itself would use.

Boundaries worth knowing:
- Every tool is READ-ONLY. There is no write, no mutation, no side effect, and no state carried between calls.
- The corpus is closed and single-subject. If it does not cover something, say so rather than inferring — an empty search result means "not on file", not "search harder".
- Sections within a project are an ordered array and a kind may repeat. Read them in order.`;

/* ============================================================
   Cold-start context, per tool

   The descriptions in lib/knowledge/tools.js are the single source of what a
   tool DOES, and they are used here VERBATIM — rewriting them is exactly the
   divergence this module exists to avoid. But they were written for the web
   chat, whose system prompt already carries the corpus manifest and already
   knows whose portfolio this is. An external client has neither.

   So each tool gets a scope line in front and, where there is a real gap, a
   note behind. Both supply context the core description has no reason to
   carry; neither restates what the tool does. If you find yourself editing
   the middle of a rendered description, you are editing the wrong file.

   Counts are interpolated from the corpus rather than typed, for the same
   reason the site's own statistics are: a number written by hand is a number
   that goes stale.
   ============================================================ */
const CASE_STUDIES = content.projects.filter((p) => p.hasCaseStudy).length;

/* Front — names the subject and the scale, which is what a client that has
   never seen this corpus is missing before it can choose a tool at all. */
const SCOPE = {
  list_projects: `Yordan Hristov's design portfolio — ${content.projects.length} projects, ${CASE_STUDIES} with full case studies.`,
  get_project: "A single case study from Yordan Hristov's portfolio.",
  list_experience: `Yordan Hristov's career history — ${content.experience.length} roles.`,
  get_profile: "Yordan Hristov himself.",
  get_system_facts: "About this repository rather than the work it presents.",
  search_content: null,
};

/* Behind — the one genuine behavioural difference between the two surfaces.
   The web chat's system prompt carries the corpus manifest, so its model can
   already see every id and title before it calls anything. A remote client
   cannot, and a search tool is the wrong first move when you do not yet know
   what exists. */
const NOTE = {
  search_content:
    "The corpus is Yordan Hristov's portfolio and CV. This client holds no manifest of it, so call " +
    "list_projects or list_experience first when you need to know what exists; use search only to " +
    "locate material you cannot place. An empty result means the corpus does not cover the question.",
};

/* Human-readable titles, shown by clients that surface a tool picker. */
const TITLES = {
  list_projects: "List projects",
  get_project: "Get project",
  list_experience: "List experience",
  get_profile: "Get profile",
  get_system_facts: "Get system facts",
  search_content: "Search content",
};

/* ============================================================
   TOOLS → MCP tool descriptors

   Two mechanical differences and nothing else:
     · `input_schema` (Anthropic Messages API) is `inputSchema` in MCP.
     · `strict` is an Anthropic tool-use flag with no MCP equivalent; the
       schemas are already `additionalProperties: false` with every property
       required, which is what `strict` was asserting.

   `annotations` is where "read-only by construction" stops being a claim in a
   README and becomes something a client can check before it calls anything.
   ============================================================ */
const MCP_TOOLS = TOOLS.map((tool) => ({
  name: tool.name,
  title: TITLES[tool.name] ?? tool.name,
  description: [SCOPE[tool.name], tool.description, NOTE[tool.name]].filter(Boolean).join(" "),
  inputSchema: tool.input_schema,
  annotations: {
    title: TITLES[tool.name] ?? tool.name,
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  },
}));

/* ============================================================
   The server

   Built per request. Handlers close over nothing request-specific, so this is
   pure construction — the corpus itself was loaded once at module init and is
   shared across every invocation the container happens to serve.
   ============================================================ */
function buildServer() {
  const server = new Server(
    {
      name: SERVER_NAME,
      version: SERVER_VERSION,
      title: "Yordan Hristov — portfolio, CV and case studies",
      description:
        "Read-only access to a product designer's portfolio corpus: projects, case studies, " +
        "employment history, skills and profile. No writes, no side effects, no state.",
      websiteUrl: `${SITE_URL}/mcp`,
    },
    { capabilities: { tools: {} }, instructions: INSTRUCTIONS }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: MCP_TOOLS }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    /* A tool that reports a problem in its own result — an unknown project id,
       an unknown tool name — is a TOOL error, not a protocol error. It comes
       back as a normal result with isError so the calling model can read it
       and correct itself, which is the whole point of the distinction. */
    let result;
    try {
      result = await callTool(name, args ?? {});
    } catch (err) {
      /* Five of the six tools are pure functions over a loaded object, so this
         is near-unreachable for them. search_content may embed the query over
         the network, but embed.js swallows its own failures and falls back to
         BM25 rather than throwing. If this IS reached, the caller gets the
         message and never the stack. */
      console.error(`[mcp] tool "${name}" threw:`, err);
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: JSON.stringify(
              { error: "tool_failed", tool: name, message: "The tool could not complete." },
              null,
              2
            ),
          },
        ],
      };
    }

    const isError = Boolean(result && typeof result === "object" && "error" in result);
    return {
      isError,
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      structuredContent: result,
    };
  });

  return server;
}

/* ============================================================
   HTTP framing
   ============================================================ */

/* Public and unauthenticated on purpose: the point of the endpoint is that a
   stranger can install it. `*` is therefore correct rather than lazy — there is
   no credential, no cookie and no per-caller state for an origin check to
   protect. */
function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "content-type, accept, mcp-protocol-version, mcp-session-id, last-event-id, authorization"
  );
  res.setHeader("Access-Control-Expose-Headers", "mcp-session-id, mcp-protocol-version");
  res.setHeader("Access-Control-Max-Age", "86400");
}

function jsonRpcError(res, status, code, message) {
  if (res.headersSent) return;
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify({ jsonrpc: "2.0", id: null, error: { code, message } }));
}

/* Vercel parses a JSON body onto req.body and leaves the stream consumed; a
   plain `node --run` server does not. Read it here only when nobody already
   has, so the same file works in both without a body-parser. */
function tooLarge() {
  const err = new Error("request body too large");
  err.code = BODY_TOO_LARGE;
  return err;
}

async function readBody(req) {
  /* Content-Length first, because it is the ONLY signal available on the
     Vercel path: there the platform has already parsed the body onto req.body
     and the stream is spent, so the byte loop below never runs. A lying
     Content-Length is caught by the loop; a truthful one is refused before a
     single byte is buffered. */
  const declared = Number(req.headers?.["content-length"]);
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) throw tooLarge();

  if (req.body !== undefined && req.body !== null && req.body !== "") return req.body;

  const chunks = [];
  let bytes = 0;
  for await (const chunk of req) {
    bytes += chunk.length;
    /* Throwing here abandons the iterator, which is what actually stops the
       upload: nothing further is read, so memory is bounded at the cap rather
       than at whatever the client felt like sending. */
    if (bytes > MAX_BODY_BYTES) throw tooLarge();
    chunks.push(chunk);
  }
  if (!chunks.length) return undefined;
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) return undefined;
  return JSON.parse(raw); // a throw here is a genuine parse error — handled by the caller
}

export default async function handler(req, res) {
  /* ------------------------------------------------------------
     PHASE 4 BOUNDARY — rate limiting goes in FRONT of this file.

     Not here. Vercel WAF holds a per-path request limit on /api/mcp and
     rejects abuse at the edge, before this function is ever invoked, so a
     scraper costs nothing at all rather than one invocation each time. An
     app-level limiter would cost an invocation to say "no", need shared state
     that a stateless function does not have, and duplicate a platform feature.

     The daily *token* budget is a different quantity and belongs to
     api/chat.js — this endpoint spends no model tokens at all. The caller's
     own client pays for inference. That, plus every tool being read-only,
     is what bounds this endpoint's worst case to cost and never to data.
     ------------------------------------------------------------ */

  setCors(res);

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }

  /* Stateless means there is no server→client stream to resume and no session
     to delete, so GET and DELETE have nothing to do. Rejecting them explicitly
     is better than letting the transport open a standalone SSE stream that a
     serverless invocation would hold open until it times out. */
  if (req.method !== "POST") {
    jsonRpcError(
      res,
      405,
      INVALID_REQUEST,
      `This endpoint speaks MCP over streamable HTTP and is stateless: POST only. ` +
        `Setup instructions for humans are at ${SITE_URL}/mcp.`
    );
    return;
  }

  let body;
  try {
    body = await readBody(req);
  } catch (err) {
    if (err?.code === BODY_TOO_LARGE) {
      /* Once the response has flushed, drop the socket rather than sit there
         absorbing the rest of an upload we have already refused. Ordering
         matters: destroying first would reset the connection and the caller
         would get a transport error instead of a reason. */
      res.once("finish", () => req.destroy());
      jsonRpcError(
        res,
        413,
        INVALID_REQUEST,
        `Request body exceeds ${MAX_BODY_BYTES} bytes. A JSON-RPC message for this endpoint ` +
          `carries a tool name and a small argument object; nothing legitimate approaches this.`
      );
      return;
    }
    jsonRpcError(res, 400, PARSE_ERROR, "Request body is not valid JSON.");
    return;
  }
  if (body === undefined) {
    jsonRpcError(res, 400, INVALID_REQUEST, "Expected a JSON-RPC message in the request body.");
    return;
  }

  const server = buildServer();
  const transport = new StreamableHTTPServerTransport({
    /* Stateless. Nothing survives the invocation, so nothing pretends to. */
    sessionIdGenerator: undefined,
    /* A single JSON response rather than an SSE stream. These tools are
       property access on an object already in memory — there is no partial
       result to stream, and a serverless function should not hold a stream
       open to deliver one complete object. */
    enableJsonResponse: true,
  });

  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, body);
  } catch (err) {
    /* Never a stack trace on the wire. The log is the place for it. */
    console.error("[mcp] request failed:", err);
    jsonRpcError(res, 500, INTERNAL_ERROR, "Internal error handling the MCP request.");
  } finally {
    /* Tear down in the same invocation that built it. */
    try {
      await transport.close();
      await server.close();
    } catch (err) {
      console.error("[mcp] teardown failed:", err);
    }
  }
}
