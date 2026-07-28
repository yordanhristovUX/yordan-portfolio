/* ============================================================
   Extractors for the hand-maintained tool surfaces.

   NOT a test file — it exports helpers and registers no tests, for the same
   reason contract.mjs does.

   Three places in this repo restate the tool list in prose a human types:
   mcp.html's install page, api/mcp.js's INSTRUCTIONS block, and the three
   per-tool maps beside it. Every one of them has already been wrong — the
   install page said "Six tools" in six places while the core shipped eight —
   and none of them can be generated, because scripts/ may not read lib/.

   So the shape is verifyTokeniser's: pull the claim out of the shipped
   artefact, recompute it from the code that produced it, and demand exact
   agreement in BOTH directions. One-way containment is the trap here — it
   catches a tool that was ADDED and never mentioned, and sails straight past
   one that was REMOVED and still is.

   These live in a helper rather than inline so the failure path can be proven
   against mutated copies of the sources, without editing a page another
   specialist owns.
   ============================================================ */

/** Both directions at once. `extra` is the half a containment check misses. */
export function compare(expected, found) {
  const e = new Set(expected);
  const f = new Set(found);
  return {
    missing: [...e].filter((x) => !f.has(x)),
    extra: [...f].filter((x) => !e.has(x)),
  };
}

/** The tool names mcp.html lists, in the one `<dl class="tools">` it has. */
export function pageToolNames(html) {
  const dl = html.match(/<dl class="tools">([\s\S]*?)<\/dl>/);
  if (!dl) return null; /* the caller must fail loudly rather than find zero */
  return [...dl[1].matchAll(/<dt>\s*([a-z][a-z0-9_]*)\s*<\/dt>/g)].map((m) => m[1]);
}

const WORDS = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6,
  seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
};
const numeric = (w) => (/^\d+$/.test(w) ? Number(w) : WORDS[w.toLowerCase()]);

/**
 * Every typed count of tools on the page.
 *
 * `totals` are claims about the whole list — "Eight tools", "8 tools",
 * "Eight read-only tools" — and each must equal TOOLS.length.
 *
 * `splits` are the one sentence that gives BOTH halves ("Six over the corpus,
 * two over the design system"): those must sum to it. A claim about one half
 * alone ("the two design-system tools") is deliberately not collected —
 * checking it would mean typing the corpus/design-system grouping somewhere,
 * and `TOOLS` carries no such field, so the list would just move rather than
 * stop being hand-maintained.
 */
export function toolCountClaims(html) {
  const NUM = `(?:\\d+|${Object.keys(WORDS).join("|")})`;
  const totals = [];
  for (const m of html.matchAll(new RegExp(`\\b(${NUM})((?:\\s+[a-z-]+){0,2})\\s+tools\\b`, "gi"))) {
    if (/design-system|corpus/i.test(m[2])) continue; /* a half, not the whole */
    const n = numeric(m[1]);
    if (n !== undefined) totals.push({ text: m[0].trim(), n });
  }
  const splits = [];
  for (const m of html.matchAll(new RegExp(`\\b(${NUM})\\s+over the corpus,\\s*(${NUM})\\s+over the design system`, "gi"))) {
    splits.push({ text: m[0].trim(), n: numeric(m[1]) + numeric(m[2]) });
  }
  return { totals, splits };
}

/** The body of a top-level template literal, e.g. `const INSTRUCTIONS = \`…\`;`. */
export function templateLiteral(src, name) {
  const m = src.match(new RegExp("const " + name + " = `([\\s\\S]*?)`;"));
  return m ? m[1] : null;
}

/** The tool names INSTRUCTIONS chooses between, one per `- \`name\`` bullet. */
export function instructionBullets(body) {
  return [...body.matchAll(/^- \\`([a-z][a-z0-9_]*)\\`/gm)].map((m) => m[1]);
}

/** The keys of a top-level object literal, e.g. `const TITLES = { … };`. */
export function objectKeys(src, name) {
  const m = src.match(new RegExp("const " + name + " = \\{([\\s\\S]*?)\\n\\};"));
  return m ? [...m[1].matchAll(/^ {2}([a-z][a-z0-9_]*):/gm)].map((k) => k[1]) : null;
}
