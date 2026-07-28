/* ============================================================
   api/_budget.js — the only thing standing between a public endpoint and an
   unbounded bill, and the one piece of api/ with a stated failure POLICY:

       fail OPEN on an Upstash error   (a monitoring outage must not take the
                                        assistant down)
       fail CLOSED on being over budget (that is the point)
       and never hang                   (03 M2 — the policy was stated but not
                                        true: redis() had no timeout, so a
                                        blackholed connection stalled every
                                        request in front of the first byte.
                                        Wave 0 added AbortSignal.timeout(1000).)

   ALL GREEN — this file is a regression lock, not a bug report. It exists
   because "fails open" is the kind of claim that is true on the day it is
   written and silently false a year later.

   NO NETWORK. `fetch` is stubbed per test. The module reads its credentials
   from process.env at import time, so each case sets the environment and then
   imports with a cache-busting query string to force re-evaluation.
   ============================================================ */
import test from "node:test";
import assert from "node:assert/strict";

const BUDGET = 2_000_000;

let stamp = 0;

/**
 * Import a fresh copy of _budget.js under a given environment, with `fetch`
 * replaced. Returns the module plus the calls the stub saw.
 */
async function loadBudget({ configured = true, budget = BUDGET, fetchImpl }) {
  const saved = { ...process.env };
  const savedFetch = globalThis.fetch;

  for (const k of [
    "UPSTASH_REDIS_REST_URL",
    "UPSTASH_REDIS_REST_TOKEN",
    "KV_REST_API_URL",
    "KV_REST_API_TOKEN",
  ]) {
    delete process.env[k];
  }
  if (configured) {
    process.env.UPSTASH_REDIS_REST_URL = "https://stub.invalid";
    process.env.UPSTASH_REDIS_REST_TOKEN = "stub-token";
  }
  process.env.DAILY_TOKEN_BUDGET = String(budget);

  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url, init, command: JSON.parse(init.body) });
    return fetchImpl(url, init);
  };

  const mod = await import(`../api/_budget.js?case=${++stamp}`);

  const restore = () => {
    globalThis.fetch = savedFetch;
    for (const k of Object.keys(process.env)) if (!(k in saved)) delete process.env[k];
    Object.assign(process.env, saved);
  };
  return { mod, calls, restore };
}

/** A stub Upstash reply. */
const reply = (result) => ({ ok: true, status: 200, json: async () => ({ result }) });

test("unconfigured: reports honestly that it is not enforcing, and does not call out", async (t) => {
  const { mod, calls, restore } = await loadBudget({
    configured: false,
    fetchImpl: () => assert.fail("must not call Upstash when unconfigured"),
  });
  t.after(restore);

  assert.equal(mod.configured, false);
  const verdict = await mod.checkBudget();
  assert.deepEqual(verdict, { enforced: false, over: false, used: 0, budget: BUDGET });
  assert.equal(calls.length, 0);

  /* Deliberate, VISIBLE degradation rather than a silent pass. */
  await mod.recordUsage(1000);
  assert.equal(calls.length, 0, "recordUsage must be a no-op when unconfigured");
});

test("under budget: enforced and open", async (t) => {
  const { mod, calls, restore } = await loadBudget({ fetchImpl: () => reply("1234") });
  t.after(restore);

  assert.equal(mod.configured, true);
  assert.deepEqual(await mod.checkBudget(), { enforced: true, over: false, used: 1234, budget: BUDGET });
  assert.deepEqual(calls[0].command[0], "GET", "the check must be a GET, never a write");
});

test("fails CLOSED on being over budget", async (t) => {
  const { mod, restore } = await loadBudget({ fetchImpl: () => reply(String(BUDGET)) });
  t.after(restore);

  const verdict = await mod.checkBudget();
  assert.equal(verdict.over, true, "at exactly the budget the endpoint must refuse");
  assert.equal(verdict.enforced, true);
});

test("fails OPEN when Upstash errors", async (t) => {
  for (const fetchImpl of [
    () => Promise.reject(new Error("ECONNREFUSED")),
    () => ({ ok: false, status: 500, json: async () => ({}) }),
    () => ({ ok: true, status: 200, json: async () => { throw new Error("bad json"); } }),
  ]) {
    const { mod, restore } = await loadBudget({ fetchImpl });
    const verdict = await mod.checkBudget();
    assert.equal(verdict.over, false, "an Upstash outage must not refuse traffic");
    assert.equal(verdict.enforced, false, "and must say it is no longer enforcing");
    restore();
  }
});

test("[03 M2 · regression lock] the budget check carries an abort signal and cannot hang", async (t) => {
  /* The finding: checkBudget() is awaited BEFORE the SSE headers are written,
     so an Upstash that blackholes rather than refuses stalls every chat request
     in front of the first byte — for as long as the platform allows, against
     maxDuration: 300. Failing open protects against Upstash saying NO; it does
     nothing against Upstash saying NOTHING. The timeout is what makes the
     stated policy true rather than merely stated. */
  let sawSignal = null;
  const { mod, restore } = await loadBudget({
    fetchImpl: (_url, init) => {
      sawSignal = init.signal;
      /* A connection that accepts and then says nothing. Only the abort ends it. */
      return new Promise((_resolve, reject) => {
        init.signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
      });
    },
  });
  t.after(restore);

  const started = Date.now();
  const verdict = await mod.checkBudget();
  const elapsed = Date.now() - started;

  assert.ok(sawSignal, "redis() passed no AbortSignal — a blackholed Upstash would hang forever");
  assert.ok(elapsed < 5000, `checkBudget took ${elapsed}ms against a silent Upstash`);
  assert.equal(verdict.over, false, "a timeout is an error, never an overrun");
  assert.equal(verdict.enforced, false);
});

test("recordUsage writes INCRBY then EXPIRE, and swallows failure", async (t) => {
  const { mod, calls, restore } = await loadBudget({ fetchImpl: () => reply(1) });
  t.after(restore);

  await mod.recordUsage(1234.6);
  assert.deepEqual(calls.map((c) => c.command[0]), ["INCRBY", "EXPIRE"]);
  assert.equal(calls[0].command[2], 1235, "token counts are rounded, never truncated toward zero");
  assert.equal(calls[0].command[1], calls[1].command[1], "both commands must address the same day key");

  /* Never fail a served answer because bookkeeping failed. */
  const failing = await loadBudget({ fetchImpl: () => Promise.reject(new Error("down")) });
  await assert.doesNotReject(() => failing.mod.recordUsage(500));
  failing.restore();
});

test("recordUsage ignores nonsense token counts", async (t) => {
  const { mod, calls, restore } = await loadBudget({ fetchImpl: () => reply(1) });
  t.after(restore);

  for (const n of [0, -1, NaN, Infinity, undefined, null, "1000"]) await mod.recordUsage(n);
  assert.deepEqual(calls, [], "under-counting a budget is the one direction that matters");
});
