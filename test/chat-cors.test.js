/* ============================================================
   The CORS allowlist on /api/chat, driven through the REAL handler over HTTP.

   ── WHY THIS EXISTS ────────────────────────────────────────────────────────

   A second site — a static Next app on its own domain — calls the SAME
   /api/chat on the vanilla deployment. Not a proxy: one Redis token budget for
   both sites, per-IP WAF fairness preserved, no doubled function-seconds, and
   the Next app stays fully static. The price of that decision is one
   cross-origin surface, and this file is what holds it to its shape.

   The shape, in one line: `CHAT_ALLOWED_ORIGINS` is a comma-separated list of
   EXACT origins; a request whose `Origin` string-equals an entry gets that
   entry reflected back; everything else gets byte-identical-to-today.

   ── WHY IT DRIVES HTTP RATHER THAN CALLING A FUNCTION ──────────────────────

   Same reason as chat-retry.test.js: the decision under test is not a helper,
   it is where a branch sits in the handler relative to the budget and the
   method check. A unit test against an extracted `allowedOrigin()` would prove
   string equality — which is not the interesting half. The interesting halves
   are (a) that a preflight is answered in FRONT of checkBudget, so it never
   touches Redis or the model, and (b) that the response headers a browser
   actually reads are the ones on the wire. Both are observable only from
   outside the handler, so this starts the shipped default export on a socket
   and reads raw headers off node:http.

   ── NO KEY, NO NETWORK ─────────────────────────────────────────────────────

   ANTHROPIC_API_KEY is deleted, so a POST stops at the 503 "not configured"
   branch — which is PAST every input-handling decision this file is about and
   costs no model call. The budget, by contrast, is deliberately CONFIGURED
   here against a stub Upstash, because "the preflight never touches Redis" is
   only a claim you can test if Redis would otherwise be touched: every Upstash
   call is counted, and the counter is the evidence.
   ============================================================ */
import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { createServer, request } from "node:http";

import { goOffline } from "./helpers/contract.mjs";

goOffline();

delete process.env.ANTHROPIC_API_KEY;
delete process.env.CHAT_ALLOWED_ORIGINS;

/* A configured-but-fake budget. _budget.js reads its credentials at import
   time, so these must be set before api/chat.js is imported in `before`. */
const UPSTASH = "https://upstash.invalid";
process.env.UPSTASH_REDIS_REST_URL = UPSTASH;
process.env.UPSTASH_REDIS_REST_TOKEN = "stub-token";
delete process.env.KV_REST_API_URL;
delete process.env.KV_REST_API_TOKEN;

/* The stub only intercepts Upstash. Everything else — including this file's own
   requests, if it ever used fetch — goes to the real implementation. */
const realFetch = globalThis.fetch;
let redisCalls = [];
globalThis.fetch = async (url, init) => {
  const href = typeof url === "string" ? url : (url?.url ?? String(url));
  if (!href.startsWith(UPSTASH)) return realFetch(url, init);
  redisCalls.push(JSON.parse(init.body));
  return { ok: true, status: 200, json: async () => ({ result: "0" }) };
};

let chat;

before(async () => {
  const { default: handler } = await import("../api/chat.js");
  assert.equal(typeof handler, "function", "api/chat.js must default-export a handler");
  chat = createServer((q, s) => handler(q, s));
  await new Promise((r) => chat.listen(0, "127.0.0.1", r));
});

after(async () => {
  await new Promise((r) => chat.close(r));
  globalThis.fetch = realFetch;
});

/* ============================================================
   Harness
   ============================================================ */

/* node:http rather than fetch, on purpose. `Origin` is a forbidden header name
   in a browser and undici has been in two minds about enforcing that list; a
   raw client request cannot be second-guessed, and it is also what lets a test
   send an Origin that no well-behaved client would ever produce. */
function hit({ method = "POST", origin, body = JSON.stringify({ messages: [{ role: "user", content: "hi" }] }) } = {}) {
  const headers = {};
  if (origin !== undefined) headers.Origin = origin;
  if (method === "POST") {
    headers["Content-Type"] = "application/json";
    headers["Content-Length"] = Buffer.byteLength(body);
  }

  return new Promise((resolve, reject) => {
    const req = request(
      { host: "127.0.0.1", port: chat.address().port, path: "/api/chat", method, headers },
      (res) => {
        let text = "";
        res.setEncoding("utf8");
        res.on("data", (c) => (text += c));
        res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body: text }));
      }
    );
    req.on("error", reject);
    if (method === "POST") req.write(body);
    req.end();
  });
}

/** The header set a comparison should be made on: everything that is not a
 *  clock or a connection detail. */
const stable = (headers) => {
  const out = { ...headers };
  for (const k of ["date", "connection", "keep-alive", "transfer-encoding", "content-length"]) delete out[k];
  return out;
};

const acao = (res) => res.headers["access-control-allow-origin"];

/** Set CHAT_ALLOWED_ORIGINS for the duration of one test. */
const withAllowlist = (t, value) => {
  const before_ = process.env.CHAT_ALLOWED_ORIGINS;
  if (value === undefined) delete process.env.CHAT_ALLOWED_ORIGINS;
  else process.env.CHAT_ALLOWED_ORIGINS = value;
  t.after(() => {
    if (before_ === undefined) delete process.env.CHAT_ALLOWED_ORIGINS;
    else process.env.CHAT_ALLOWED_ORIGINS = before_;
  });
};

const SITE = "https://next.example.com";
const OTHER = "https://cv.example.org";

/* ============================================================
   The preflight
   ============================================================ */

test("an allowed origin's preflight is answered 204 with the reflected origin", async (t) => {
  withAllowlist(t, SITE);
  redisCalls = [];

  const res = await hit({ method: "OPTIONS", origin: SITE });

  assert.equal(res.status, 204, "a preflight is a 204, not a 405 and not a 200 with a body");
  assert.equal(res.body, "", "a 204 carries no body");

  assert.equal(acao(res), SITE, "the ALLOWED ORIGIN is reflected — never `*`");
  assert.notEqual(acao(res), "*", "a wildcard here would open the endpoint that spends inference to everyone");
  assert.equal(res.headers.vary, "Origin", "the response varies by Origin and must say so");

  const methods = res.headers["access-control-allow-methods"] ?? "";
  assert.match(methods, /POST/, "the browser is about to POST; the preflight must say POST is allowed");

  const allowHeaders = (res.headers["access-control-allow-headers"] ?? "").toLowerCase();
  assert.match(
    allowHeaders,
    /content-type/,
    "application/json is not a CORS-safelisted content type — without this the preflight fails and no POST ever happens"
  );

  const maxAge = Number(res.headers["access-control-max-age"]);
  assert.ok(maxAge > 0, "a preflight with no max-age is re-flown before every single message");

  /* No credentials, deliberately: there is no cookie and no session on this
     endpoint, and Allow-Credentials would turn a reflected origin into an
     ambient-authority hole for nothing in return. */
  assert.equal(
    res.headers["access-control-allow-credentials"],
    undefined,
    "this endpoint has no cookie and no session — credentials must never be allowed"
  );
});

test("a preflight spends nothing: no Redis, no budget, no model", async (t) => {
  withAllowlist(t, SITE);

  /* The budget IS configured in this file — the stub above answers as Upstash —
     so a request that reaches checkBudget() leaves a fingerprint. */
  redisCalls = [];
  await hit({ method: "OPTIONS", origin: SITE });
  assert.deepEqual(
    redisCalls,
    [],
    "the OPTIONS branch must sit in FRONT of checkBudget — a preflight that reads Redis " +
      "pays a round trip, and one that wrote to it would let a browser bleed the daily cap " +
      "without ever sending a question"
  );

  /* And the control: the same configuration, a real POST, does reach it. Without
     this the assertion above would pass just as well if the budget were broken. */
  redisCalls = [];
  await hit({ method: "POST", origin: SITE });
  assert.ok(
    redisCalls.length > 0,
    "control: a POST must still consult the budget, or the test above proves nothing"
  );
  assert.equal(redisCalls[0][0], "GET", "the budget check is a read");
});

test("a disallowed origin's preflight gets today's answer, and no CORS headers", async (t) => {
  withAllowlist(t, SITE);

  const res = await hit({ method: "OPTIONS", origin: "https://evil.example" });

  /* DELIBERATE: 405 + `Allow: POST` is exactly what this handler returned for
     OPTIONS before the allowlist existed. Failing closed means falling back to
     the old behaviour byte for byte, not inventing a 403 that tells a caller
     an allowlist exists and it is not on it. */
  assert.equal(res.status, 405, "an un-allowed preflight falls through to the method check, as it did before");
  assert.equal(res.headers.allow, "POST");
  assert.equal(acao(res), undefined, "no reflected origin");
  assert.equal(res.headers["access-control-allow-methods"], undefined);
  assert.equal(res.headers.vary, undefined);
});

/* ============================================================
   The POST
   ============================================================ */

test("a POST from an allowed origin carries the reflected origin and Vary", async (t) => {
  withAllowlist(t, SITE);

  const res = await hit({ method: "POST", origin: SITE });

  /* 503 because ANTHROPIC_API_KEY is deleted in this file. That is the point:
     the CORS headers must be on the ERROR responses too, or the browser cannot
     read the structured reason and shows a network failure instead. */
  assert.equal(res.status, 503);
  assert.equal(acao(res), SITE);
  assert.equal(res.headers.vary, "Origin");

  const payload = JSON.parse(res.body);
  assert.equal(payload.error, "no_api_key");
  assert.ok(payload.message, "the browser must be able to READ a reason, which is what the ACAO buys");
});

test("a POST from a disallowed origin is processed, and gets no CORS headers", async (t) => {
  withAllowlist(t, SITE);

  const res = await hit({ method: "POST", origin: "https://evil.example" });

  assert.equal(acao(res), undefined, "the browser must not be able to read this response");
  assert.equal(res.headers.vary, undefined);

  /* DELIBERATE, and the alternative was real: reject early on an unknown Origin
     and save the budget. Not taken. `Origin` is a spoofable request header, so
     rejecting on it would be authorisation built out of a hint — and it would
     change behaviour for every non-browser caller that happens to send one
     (curl -H, the groundedness harness, a server-side fetch). Withholding the
     header is the whole of the CORS mechanism: the browser blocks the read.
     Cost is bounded by the WAF rate limit and the daily token budget, which is
     where cost is supposed to be bounded — see api/CLAUDE.md. */
  assert.equal(res.status, 503, "the request is processed exactly as it is today; only the headers differ");
});

test("no Origin at all is byte-identical to today", async (t) => {
  withAllowlist(t, SITE);
  const withList = await hit({ method: "POST" });

  withAllowlist(t, undefined);
  const withoutList = await hit({ method: "POST" });

  assert.deepEqual(
    stable(withList.headers),
    stable(withoutList.headers),
    "same-origin and curl traffic must not be able to tell that an allowlist was configured"
  );
  for (const name of Object.keys(withList.headers)) {
    assert.ok(!name.startsWith("access-control-"), `unexpected ${name} on a request with no Origin`);
    assert.notEqual(name, "vary", "nothing varies by Origin when no Origin was sent");
  }
  assert.equal(withList.body, withoutList.body);
});

/* ============================================================
   The allowlist itself
   ============================================================ */

test("unset CHAT_ALLOWED_ORIGINS means no CORS behaviour at all", async (t) => {
  withAllowlist(t, undefined);

  const post = await hit({ method: "POST", origin: SITE });
  assert.equal(acao(post), undefined, "an unconfigured deployment is same-origin only, as it is today");
  assert.equal(post.headers.vary, undefined);

  const preflight = await hit({ method: "OPTIONS", origin: SITE });
  assert.equal(preflight.status, 405, "with no allowlist there is no preflight branch to enter");
  assert.equal(acao(preflight), undefined);
});

test("an empty or whitespace-only allowlist allows nothing", async (t) => {
  for (const value of ["", "   ", ",", " , , "]) {
    withAllowlist(t, value);
    const res = await hit({ method: "POST", origin: SITE });
    assert.equal(acao(res), undefined, `CHAT_ALLOWED_ORIGINS=${JSON.stringify(value)} must allow nothing`);
    /* The empty-string trap: a list that keeps its empty entries matches an
       empty Origin, and some clients send one. */
  }
});

test("matching is exact — scheme, host and port, with no substring or prefix escape", async (t) => {
  withAllowlist(t, "https://example.com");

  /* The direction that must SUCCEED. Without it every assertion below is
     satisfied by an implementation that matches nothing at all. */
  const good = await hit({ method: "POST", origin: "https://example.com" });
  assert.equal(acao(good), "https://example.com", "the listed origin itself must be reflected");

  /* And the direction that must FAIL — each one is a different way a lazy
     comparison lets a stranger in. `includes()` on the raw env string falls to
     the first two; `startsWith` falls to the third; a host-only comparison
     falls to the scheme and port cases. */
  const impostors = [
    "https://evil-example.com",        // the listed origin as a SUFFIX of the host
    "https://example.com.evil.test",   // the listed origin as a PREFIX of the host
    "https://notexample.com",
    "https://example.co",              // a prefix of the listed origin
    "http://example.com",              // right host, wrong scheme
    "https://example.com:8443",        // right host and scheme, wrong port
    "https://example.com/",            // an origin has no path, not even an empty one
    "https://EXAMPLE.com",             // no normalisation beyond trim, by contract
    "https://example.com, https://evil.test", // a second origin smuggled into one header
    "null",                            // a sandboxed iframe or a file:// document
  ];

  for (const origin of impostors) {
    const res = await hit({ method: "POST", origin });
    assert.equal(acao(res), undefined, `${origin} must not match the listed https://example.com`);
    assert.equal(res.headers.vary, undefined, `${origin} must get no Vary either`);

    const pre = await hit({ method: "OPTIONS", origin });
    assert.equal(acao(pre), undefined, `${origin} must not get a preflight either`);
  }
});

test("several listed origins each reflect themselves, never the list", async (t) => {
  withAllowlist(t, `${SITE},${OTHER}`);

  for (const origin of [SITE, OTHER]) {
    const res = await hit({ method: "POST", origin });
    assert.equal(acao(res), origin, "each allowed origin gets ITSELF back");
    assert.ok(!acao(res).includes(","), "Access-Control-Allow-Origin holds one origin — a list is not a valid value");
    assert.equal(res.headers.vary, "Origin");
  }

  const stranger = await hit({ method: "POST", origin: "https://third.example" });
  assert.equal(acao(stranger), undefined);
});

test("entries are trimmed, and only trimmed", async (t) => {
  withAllowlist(t, `  ${SITE} ,\t${OTHER}  `);

  for (const origin of [SITE, OTHER]) {
    const res = await hit({ method: "POST", origin });
    assert.equal(acao(res), origin, "surrounding whitespace in the env var is not part of the origin");
  }

  /* Trim is the ONLY normalisation. An entry that is not a bare origin does not
     become one. */
  withAllowlist(t, "https://trailing.example/");
  const res = await hit({ method: "POST", origin: "https://trailing.example" });
  assert.equal(acao(res), undefined, "a misconfigured entry fails closed rather than being repaired");
});

/* ============================================================
   The wire rule
   ============================================================ */

test("nothing on the new paths leaks internals", async (t) => {
  withAllowlist(t, SITE);

  const bodies = [
    (await hit({ method: "OPTIONS", origin: SITE })).body,
    (await hit({ method: "OPTIONS", origin: "https://evil.example" })).body,
    (await hit({ method: "POST", origin: SITE })).body,
    (await hit({ method: "POST", origin: "https://evil.example" })).body,
    (await hit({ method: "POST", origin: SITE, body: "{ not json" })).body,
  ];

  for (const body of bodies) {
    assert.ok(!/ {4}at |node_modules|[A-Za-z]:\\|\/var\/task|ZodError/i.test(body), `internals on the wire: ${body}`);
    assert.ok(!/CHAT_ALLOWED_ORIGINS/.test(body), "the allowlist's existence is not a thing to announce");
  }
});
