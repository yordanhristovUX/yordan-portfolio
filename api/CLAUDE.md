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
| Tools | **whatever `TOOLS` holds** — `MCP_TOOLS` is a `.map()` over it, never a list here. Each is annotated `readOnlyHint: true`. |

**That row is deliberately not a number.** When `get_design_system` and `get_component`
landed in the core they appeared on this surface without a line of transport code changing,
which is the property the mapping buys. A count typed here would have been wrong the same
day, and it was: this file said "six" for as long as there were eight.

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
verbatim; `mcp.js` adds a scope line in front and, where there is a real gap, a note behind.
There are two notes — `search_content` and `get_component` — and both close the *same*
cold-start gap for different reasons: the web chat's system prompt carries the corpus
manifest so its model can already see every id, and a remote client cannot; component ids
are in no manifest on either surface. They supply missing *context*, never semantics. Counts
inside them are interpolated from the corpus rather than typed, for the same reason the
site's own statistics are generated: a number written by hand goes stale.

The `INSTRUCTIONS` block a cold client reads first is the other place this matters. It
describes **two** things the server exposes — the corpus and the design-system contract — and
its per-tool lines are hand-maintained prose. That is the one part of this file a new tool
does *not* update for free. Adding a tool means adding a line there; nothing enforces it.

### `api/chat.js` — the agent loop and the SSE stream

| Property | Value |
| --- | --- |
| Protocol | SSE — `text/event-stream`, one JSON payload per named event |
| Session | none — the whole history is POSTed every turn |
| Methods | `POST` only; `OPTIONS` answered `204` **when, and only when, the request's `Origin` is on the allowlist**; everything else `405` + `Allow: POST` + `{"error":"method_not_allowed"}` |
| CORS | an allowlist — see below. `api/mcp.js` sends `*` and should keep doing so |
| Auth | none; cost is bounded by the WAF rule and the daily token budget instead |
| Wall clock | `MAX_WALL_MS` = 35 s, under the 60 s `maxDuration` `vercel.json` gives this function |

**The `OPTIONS` row is the one difference from `mcp.js`'s otherwise identical row, and the
condition in it is deliberate.** A preflight from an unlisted origin is not a preflight this
endpoint has anything to say to, so it falls through to the same `405` any other stray method
gets — no CORS headers, no acknowledgement that an allowlist exists. Both branches sit **in
front of** `checkBudget()`, which is the load-bearing part: a browser asking permission must
never cost a Redis round trip, and a preflight that could touch the token budget would let a
page bleed the daily cap without ever asking a question. `test/chat-cors.test.js` drives the
real handler over HTTP against a stub Upstash for exactly that assertion.

The contract it must hold: it calls `lib/knowledge/` **in process**, never through
`/api/mcp`. Routing the chat through the MCP endpoint would make the function call itself
over HTTP once per tool call — an extra hop, a second cold-start path and a self-referential
dependency, bought to satisfy a purity argument. The Claude API supports remote MCP servers
natively, so this is a rejected option rather than an unavailable one.

**The one decision this file makes that `lib/knowledge/` does not.** The gate no longer
filters — `search_content` returns its ranking with a coverage verdict attached — so *whether
to answer* is this file's call, taken by the system prompt's corpus-boundary section. And
*what to do with a failed provenance check* is this file's call too. Three terminal states,
reported on the `done` event:

| State | When | What ships |
| --- | --- | --- |
| grounded | blocks survived with sources | the answer |
| `uncited` | prose survived the retry with nothing backing it | the answer **plus a server-authored caveat block** |
| `degraded` | nothing survived | the "not on file" block |

The middle one exists because the measured failure is **loss of provenance, not
fabrication**: degrading those answers would trade correct ones for refusals. The retry
verdict is compared on completeness, not on `blocks.length` — taking it on length alone is
the defect `test/chat-retry.test.js` was written against, and that suite drives this file's
real default export over a socket rather than testing an extracted helper.

## Cross-origin access — `CHAT_ALLOWED_ORIGINS`

**This is not a spend control and does not belong in the table below.** It answers a
different question — *which other page may read this endpoint's answers in a browser* — and
it exists because a second site (`apps/next/`, on its own Vercel project and its own origin)
calls this function rather than proxying through one of its own. That was chosen over a proxy
for four reasons that all point the same way: one Redis token budget covering both sites
instead of two that cannot see each other, the per-IP WAF rule still seeing the real caller's
IP, no doubled function-seconds for the same answer, and the second site staying fully
static. The price is exactly one cross-origin surface, and this is it.

| | |
| --- | --- |
| Where | Vercel project environment variable, on the **vanilla** project — not in this repo |
| Shape | comma-separated **exact origins**: scheme + host + port, no path, no trailing slash |
| Unset | **fully supported and costs nothing.** No CORS header is emitted, which is byte-identical to the day before this landed — same-origin traffic and `curl` cannot tell it exists |
| Read | per request, memoised on the raw string — not at module load, so a test can vary it without a new process |

Matching is **exact string equality**, and what goes on the wire is the *configured* entry
rather than the request header — so "never echo an arbitrary `Origin`" is true by shape
rather than by argument. Anything looser is an escape hatch with a name: a substring test
admits `https://evil-example.com` through a listed `https://example.com`, a prefix test
admits `https://example.com.evil.test`, a host-only test ignores the scheme and the port.

A matched request gets `Access-Control-Allow-Origin: <entry>` and `Vary: Origin`. There is no
`Access-Control-Allow-Credentials`: this endpoint has no cookie, no session and no per-caller
state, so allowing credentials would buy nothing and would turn a reflected origin into
ambient authority.

**An unlisted `Origin` on a `POST` is processed, not rejected**, and that is the decision in
this file worth arguing about. Rejecting would treat `Origin` as authorisation. It is a hint
a browser attaches and anything that is not a browser can set, so a guard built on it stops
nobody who matters while changing the answer for every non-browser caller that happens to
send one — `curl -H`, a server-side fetch, `evals/groundedness.mjs`. Withholding the header
**is** the mechanism: the browser refuses to hand the response to the page, which is the
whole of what CORS ever promised; it never promised to stop the request being made. Cost
stays where the rest of this file puts it, on the WAF rate limit and the daily token budget.

**Why `api/mcp.js` keeps `*` and is not an oversight.** The rule in this slice is that a
guard on one surface is a question about the other, so the answer is written down in both
places — at this file's CORS banner in `api/chat.js`, and beside the header in `api/mcp.js`.
That endpoint is unauthenticated on purpose, every tool on it is read-only by construction,
and it spends **no inference**: the caller's own client pays. There is nothing an origin
check there would protect. This endpoint is the opposite on the one axis that matters — it
spends `ANTHROPIC_API_KEY` against a shared daily budget — so "who may call this from a
browser" is a real question here and a vacuous one there. Same reasoning, two answers.

The owner-side steps (which project, which value, and the redeploy an environment change
needs) are in `docs/DEPLOY-RUNBOOK.md`.

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
returns **every entry in `lib/knowledge`'s `TOOLS`, and nothing else**, each carrying
`readOnlyHint`; `tools/call` on `get_project` returns the project; `tools/call` with a bad id
returns `isError: true` and never a stack. Compare against the core rather than against a
remembered count —

```sh
node -e "import('./lib/knowledge/index.js').then(k => console.log(k.TOOLS.length, k.TOOLS.map(t => t.name).join(' ')))"
```

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
