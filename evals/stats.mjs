/* ============================================================
   evals/stats.mjs — the three statistics this suite publishes

   Pulled out of run.mjs the moment a second consumer appeared
   (groundedness.mjs). Three copies of a hash function across two boundaries is
   what the corpus fingerprint note in run.mjs is about; three copies of a
   Wilson interval would have been the same mistake with less excuse, because
   nothing forbids the import here.

   Zero dependencies, no I/O, no state. Every function is a pure formula and is
   testable by hand against a table.
   ============================================================ */

/** Two-sided 95%. */
export const Z = 1.959964;

/**
 * Wilson score interval for a binomial proportion.
 *
 * Chosen over the normal approximation for one concrete reason: several cells
 * in this suite sit at exactly 0 or exactly 1 (bm25 abstains on 0 of 16;
 * embeddings answers 8 of 8 experience questions). The normal interval runs off
 * the end of [0,1] there and reports a lower bound below zero or an upper bound
 * above one, which is not a defensible thing to publish. Wilson does not.
 *
 * @param {number} k successes
 * @param {number} n trials
 * @returns {{p:number, lo:number, hi:number, half:number, k:number, n:number}}
 */
export function wilson(k, n) {
  if (!n) return { p: 0, lo: 0, hi: 0, half: 0, k: 0, n: 0 };
  const p = k / n;
  const denom = 1 + (Z * Z) / n;
  const centre = (p + (Z * Z) / (2 * n)) / denom;
  const spread = (Z * Math.sqrt((p * (1 - p)) / n + (Z * Z) / (4 * n * n))) / denom;
  return { p, lo: Math.max(0, centre - spread), hi: Math.min(1, centre + spread), half: spread, k, n };
}

/**
 * A mean is not a proportion, so MRR and any other averaged score gets a normal
 * interval on its own standard error rather than a Wilson one.
 * @param {number[]} values
 */
export function meanInterval(values) {
  const n = values.length;
  if (!n) return { p: 0, lo: 0, hi: 0, half: 0, n: 0 };
  const mean = values.reduce((s, x) => s + x, 0) / n;
  const variance = n > 1 ? values.reduce((s, x) => s + (x - mean) ** 2, 0) / (n - 1) : 0;
  const half = Z * Math.sqrt(variance / n);
  return { p: mean, lo: Math.max(0, mean - half), hi: Math.min(1, mean + half), half, n };
}

/**
 * Exact two-sided McNemar.
 *
 * `wins` = questions A got right and B did not; `losses` the reverse.
 * Concordant pairs carry no information and are excluded — that is the entire
 * point of a paired test, and it is why the counts here are small even where
 * the difference in margins is large.
 *
 * The exact binomial tail rather than the chi-square approximation, because the
 * discordant counts in this suite are routinely under 10 and the approximation
 * is not trustworthy there. A consequence worth stating rather than
 * discovering: FIVE discordant pairs cannot reach p<0.05 however lopsided they
 * are — 2 × 0.5^5 = 0.0625 is the floor. A 5–0 result is a consistent signal,
 * not an established one.
 *
 * The cumulative tail is built by ratio (`term *= (n-i)/(i+1)`) rather than from
 * binomial coefficients, so nothing overflows at any n this suite will reach.
 */
export function mcnemarExact(wins, losses) {
  const discordant = wins + losses;
  if (!discordant) return { wins, losses, discordant, p: 1 };
  let term = Math.pow(0.5, discordant); // P(X = 0)
  let cum = term;
  const k = Math.min(wins, losses);
  for (let i = 0; i < k; i++) {
    term *= (discordant - i) / (i + 1);
    cum += term;
  }
  return { wins, losses, discordant, p: Math.min(1, 2 * cum) };
}
