/* ============================================================
   Daily token budget — the only thing standing between a public
   endpoint and an unbounded bill

   TWO QUANTITIES, TWO MECHANISMS. Requests are limited by Vercel WAF at the
   edge, before this function is invoked, so abuse costs nothing rather than one
   invocation per rejection. TOKENS are a different quantity — one slow, legal,
   expensive conversation is not a rate problem — and they are capped here.

   WHY UPSTASH AND NOT MEMORY. A serverless function has no shared state:
   instances come and go, so an in-memory counter resets constantly and caps
   nothing under exactly the traffic that would hurt. An in-memory limiter is
   not a weak limiter, it is a limiter-shaped object, and it is worse than none
   because it reads as done. So this either has a real shared counter or it
   honestly reports that it does not.

   NO SDK. Upstash speaks REST over plain fetch; a dependency would buy nothing.

   IF UNCONFIGURED it returns { enforced: false } and says so in the logs, once.
   That is a deliberate, visible degradation rather than a silent pass.
   ============================================================ */

/* Accept BOTH naming conventions. The Vercel↔Upstash integration has injected
   `KV_REST_API_*` (the old Vercel KV names) and `UPSTASH_REDIS_REST_*` at
   different times, and which pair you get depends on how the store was
   connected. Reading both removes an entire class of "it silently isn't
   enforcing and nobody knows why" — the failure would otherwise look exactly
   like not having configured it at all. */
const URL_ = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

/** Tokens per UTC day across all visitors. Haiku 4.5 at $1/$5 per MTok:
 *  2M tokens is roughly $2-4/day worst case, and a normal day is cents. */
const DAILY_TOKEN_BUDGET = Number(process.env.DAILY_TOKEN_BUDGET ?? 2_000_000);

export const configured = Boolean(URL_ && TOKEN);

let warned = false;
function warnOnce() {
  if (warned) return;
  warned = true;
  console.warn(
    "[budget] No Redis credentials found — the daily token cap is NOT enforced. " +
      "Set UPSTASH_REDIS_REST_URL/TOKEN or KV_REST_API_URL/TOKEN. " +
      "Per-request caps (turns, max_tokens, input length) still apply."
  );
}

const dayKey = () => `chat:tokens:${new Date().toISOString().slice(0, 10)}`;

/** How long a bookkeeping round trip may take before it is treated as an
 *  outage. checkBudget() is awaited BEFORE the SSE headers are written, so this
 *  number is a hard floor on the assistant's time-to-first-byte — every chat
 *  request pays it whenever Upstash is unwell.
 *
 *  Failing open only protects against Upstash saying NO. It does nothing
 *  against Upstash saying NOTHING: without a deadline, a blackholed connection
 *  (dropped packets rather than a refused connection) stalls every request in
 *  front of the first byte, for as long as the platform allows. That is a
 *  monitoring outage taking the assistant down, which is the exact failure mode
 *  the fail-open policy exists to prevent — so the timeout is what makes the
 *  policy true rather than merely stated. 1s is far above a healthy Upstash
 *  round trip and far below anything a reader would sit through.
 *
 *  lib/knowledge/embed.js already had this right with a 2.5s abort on Voyage. */
const REDIS_TIMEOUT_MS = 1000;

async function redis(command) {
  const res = await fetch(URL_, {
    method: "POST",
    headers: { authorization: `Bearer ${TOKEN}`, "content-type": "application/json" },
    body: JSON.stringify(command),
    /* An abort throws, which lands in the caller's catch — checkBudget fails
       OPEN and recordUsage swallows it. The asymmetry is preserved exactly: a
       timeout is an error, never an overrun. */
    signal: AbortSignal.timeout(REDIS_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`upstash ${res.status}`);
  return (await res.json())?.result;
}

/**
 * Check before spending. Fails OPEN on an Upstash error: a monitoring outage
 * should not take the assistant down, and the per-request caps still bound the
 * blast radius. Fails CLOSED on being over budget, which is the point.
 *
 * @returns {Promise<{enforced:boolean, over:boolean, used:number, budget:number}>}
 */
export async function checkBudget() {
  if (!configured) {
    warnOnce();
    return { enforced: false, over: false, used: 0, budget: DAILY_TOKEN_BUDGET };
  }
  try {
    const used = Number((await redis(["GET", dayKey()])) ?? 0);
    return { enforced: true, over: used >= DAILY_TOKEN_BUDGET, used, budget: DAILY_TOKEN_BUDGET };
  } catch (err) {
    console.error("[budget] check failed, failing open:", err.message);
    return { enforced: false, over: false, used: 0, budget: DAILY_TOKEN_BUDGET };
  }
}

/**
 * Record what a conversation actually cost. Called after the loop, never in it —
 * a mid-loop abort would leave a turn unbilled, and under-counting a budget is
 * the one direction that matters.
 *
 * INCRBY then EXPIRE: the key is per-UTC-day, so a 48h TTL cleans up without a
 * cron and survives a run that straddles midnight.
 */
export async function recordUsage(totalTokens) {
  if (!configured || !Number.isFinite(totalTokens) || totalTokens <= 0) return;
  try {
    const key = dayKey();
    await redis(["INCRBY", key, Math.round(totalTokens)]);
    await redis(["EXPIRE", key, 172_800]);
  } catch (err) {
    /* Never fail a served answer because bookkeeping failed. */
    console.error("[budget] record failed:", err.message);
  }
}
