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

const URL_ = process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

/** Tokens per UTC day across all visitors. Haiku 4.5 at $1/$5 per MTok:
 *  2M tokens is roughly $2-4/day worst case, and a normal day is cents. */
const DAILY_TOKEN_BUDGET = Number(process.env.DAILY_TOKEN_BUDGET ?? 2_000_000);

export const configured = Boolean(URL_ && TOKEN);

let warned = false;
function warnOnce() {
  if (warned) return;
  warned = true;
  console.warn(
    "[budget] UPSTASH_REDIS_REST_URL/TOKEN not set — the daily token cap is NOT enforced. " +
      "Per-request caps (turns, max_tokens, input length) still apply."
  );
}

const dayKey = () => `chat:tokens:${new Date().toISOString().slice(0, 10)}`;

async function redis(command) {
  const res = await fetch(URL_, {
    method: "POST",
    headers: { authorization: `Bearer ${TOKEN}`, "content-type": "application/json" },
    body: JSON.stringify(command),
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
