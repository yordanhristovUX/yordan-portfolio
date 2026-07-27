# api — the runtime surfaces

## What this owns

**The two places the tool core meets the network.** Nothing else. There is no retrieval
logic, no BM25, no validator and no content in this slice — every one of those lives in
`lib/knowledge/`, and a copy of any of them here is a bug regardless of how well it works.

| File | Owns | Phase |
| --- | --- | --- |
| `mcp.js` | remote MCP over streamable HTTP — the public, read-only distribution surface | 2 |
| `chat.js` | the in-process agent loop and the SSE stream to the browser | 3 |

The division that makes the slice coherent: **`lib/knowledge/` decides what is true; `api/`
decides how it travels.** Transport, framing, error shape, CORS, method handling. If a change
alters what a tool *returns*, it does not belong in this directory.

## What this consumes

`lib/knowledge/index.js` — the public surface, imported as code. This is the one boundary in
`ARCHITECTURE.md` that is a real import rather than a generated artefact, because it is not a
boundary crossing between slices at all: `api/` sits directly beneath `lib/knowledge/` in the
graph and is one of its two consumers.

```js
import { TOOLS, callTool, content } from "../lib/knowledge/index.js";
```

`TOOLS` is Anthropic Messages API shape (`input_schema`, `strict`). MCP wants `inputSchema`
and has no `strict`; the rename is done in `mcp.js` and is the *only* transformation applied
to a tool descriptor. Nothing else in a schema is touched.

Runtime: **Node, both functions.** Set in `vercel.json` (`functions["api/*.js"].maxDuration`),
not in this directory. The MCP streamable-HTTP transport needs Node APIs and could never have
run on Edge; keeping one runtime means no shared module in `lib/knowledge/` ever has to
satisfy two environments.

## What this emits

### `api/mcp.js` — MCP streamable HTTP, `POST /api/mcp`

| Property | Value |
| --- | --- |
| Protocol | MCP over streamable HTTP, JSON responses (`enableJsonResponse: true`) |
| Session | none — `sessionIdGenerator: undefined` |
| Methods | `POST` only; `OPTIONS` preflight; everything else `405` + a JSON-RPC error |
| Auth | none, deliberately |
| Writes | none, structurally |
| Tools | the six from `lib/knowledge`, each annotated `readOnlyHint: true` |

**Stateless is a requirement, not a style.** Vercel functions do not persist between
invocations, so a `Server` and a transport are constructed per request and closed in the same
invocation. Nothing is asked to survive a request, which is why there is no session id, no
resumable `GET` stream and no `DELETE`.

**Read-only by construction is the security model.** Not a policy, not a prompt, not a
permission check — there is no tool that can write, so there is nothing an abused endpoint can
damage. Its worst case is bounded to cost. That is what makes an unauthenticated public
endpoint a reasonable thing to ship.

**Errors, by kind.** A tool reporting a problem in its own result (unknown project id, unknown
tool name) is a *tool* error: it comes back `200` with `isError: true` and the tool's own
message, so a calling model can read it and correct itself. A malformed request, an unknown
JSON-RPC method or a thrown exception is a *protocol* error and gets a JSON-RPC error object.
**A stack trace never reaches the wire** — it goes to `console.error` and the caller gets a
sentence.

**Cold-start descriptions.** The tool descriptions in `lib/knowledge/tools.js` are used
verbatim; `mcp.js` adds a scope line in front and, for `search_content`, a note behind. Those
additions exist because the web chat's system prompt carries the corpus manifest and a remote
client does not — they supply missing *context*, never semantics. Counts inside them are
interpolated from the corpus rather than typed, for the same reason the site's own statistics
are generated: a number written by hand goes stale.

### `api/chat.js` — Phase 3

Owned by Phase 3. The contract it must hold: it calls `lib/knowledge/` **in process**, never
through `/api/mcp`. Routing the chat through the MCP endpoint would make the function call
itself over HTTP once per tool call — an extra hop, a second cold-start path and a
self-referential dependency, bought to satisfy a purity argument. The Claude API supports
remote MCP servers natively, so this is a rejected option rather than an unavailable one.

## Spend control — what is code and what is dashboard

Two quantities that get confused constantly, and the confusion is expensive.

| Quantity | Mechanism | Where | Covers |
| --- | --- | --- | --- |
| **Requests** | Vercel WAF rate limit rule | dashboard, not this repo | `/api/*` |
| **Tokens** | daily cap in `api/_budget.js` | code | `chat.js` only |

A rate limit cannot catch one slow, legal, expensive conversation. A token budget cannot
catch a thousand cheap ones. Both are needed, and neither substitutes for the other.

### The WAF rule (manual — it cannot be set from `vercel.json`)

Firewall rules live in the Vercel dashboard or its API; there is no `vercel.json` key for
them, which is why this is written down rather than committed.

> Project → **Firewall** → **Custom Rules** → New Rule
> - **`/api/chat`** — path equals `/api/chat`, **rate limit 10 requests / 60s per IP**, action
>   *Deny*. Generous for a human, useless for a script.
> - **`/api/mcp`** — path equals `/api/mcp`, **rate limit 60 requests / 60s per IP**, action
>   *Deny*. Higher because an agent legitimately makes several tool calls per question, and
>   because this endpoint spends no inference — the cost of abuse here is invocations, not
>   model tokens.

Rejections happen at the edge, so a blocked request never invokes a function and never
appears in the token budget.

### The token budget (code, but inert until configured)

`api/_budget.js` needs `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`. Without them
it logs one warning and reports `enforced: false` — a visible degradation, never a silent
pass. `DAILY_TOKEN_BUDGET` overrides the 2M default.

It **fails open** on an Upstash error and **fails closed** on being over budget: a monitoring
outage must not take the assistant down, but a real overrun must stop it. Over budget returns
`429` with `kind: "over_budget"` and a truthful `Retry-After`.

## How to verify in isolation

No API key. `api/mcp.js` makes no model call and reads no environment variable — if you ever
find it reaching for one, something has gone wrong.

```sh
# 1. the module loads and exports a handler
node -e "import('./api/mcp.js').then(m => console.log(typeof m.default))"

# 2. drive it over real HTTP — a bare node server calling the default export
#    the way Vercel does is enough; no vercel dev required
node -e "
  import('node:http').then(async ({ createServer }) => {
    const { default: h } = await import('./api/mcp.js');
    createServer((q, s) => h(q, s)).listen(3111);
  })"

curl -s localhost:3111 -H 'content-type: application/json' \
  -H 'accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'

# 3. and against a real client, which is what actually proves the handshake
claude mcp add --transport http yordan http://localhost:3111
```

The bar for "it works": `initialize` returns `serverInfo` and `instructions`; `tools/list`
returns six tools each carrying `readOnlyHint`; `tools/call` on `get_project` returns the
project; `tools/call` with a bad id returns `isError: true` and never a stack.

Also still true of this slice, and cheap:

```sh
node scripts/check-boundaries.mjs
```

## What this must never do

- **Never reimplement a tool.** Import from `lib/knowledge/index.js`. Two surfaces exist so
  that a tool bug is impossible on one and not the other; a convenience copy here destroys the
  only property that justifies the boundary.
- **Never edit `lib/knowledge/` to make a surface easier.** If a tool's output shape is wrong
  for MCP, that is a finding to report, not a patch to apply — the other consumer and the eval
  suite both depend on it.
- **Never add a write, a mutation or a side-effecting tool to `mcp.js`.** The moment one
  exists, "read-only by construction" becomes a claim that needs enforcing, and the case for
  shipping this endpoint without auth collapses with it.
- **Never add an application-level rate limiter.** Rate limiting is Vercel WAF, at the edge,
  *before* the function is invoked — so abuse costs nothing rather than one invocation per
  rejection. An app-level limiter would also need shared state a stateless function does not
  have. The daily *token* budget is a different quantity, belongs to `chat.js` via
  `api/_budget.js`, and does not apply to `mcp.js` at all: this endpoint spends no inference.
  The caller's client pays.
- **Never read `ANTHROPIC_API_KEY` in `mcp.js`.** The endpoint is unauthenticated by design
  and has no model in its path. **Amended:** this rule used to read "no secret, no anything",
  and that is no longer literally true — `lib/knowledge/` now embeds search queries through
  Voyage, so `VOYAGE_API_KEY` is reachable from both surfaces. The distinction that matters
  is preserved and is worth stating precisely: `VOYAGE_API_KEY` is a *server-side retrieval
  credential* whose absence degrades ranking to BM25, while `ANTHROPIC_API_KEY` buys
  *inference* and is what an abused endpoint would spend. The MCP endpoint must never be able
  to spend inference. That is the rule; "no secrets at all" was a proxy for it.
- **Never let a stack trace, a file path or an internal error reach a response body.**
- **Never hold a stream open to deliver one complete object.** These tools are property access
  on an object already in memory. `enableJsonResponse: true` is correct here; SSE is for
  `chat.js`, where there is genuinely something to stream.
