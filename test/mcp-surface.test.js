/* ============================================================
   The hand-maintained tool surfaces agree with TOOLS.

   `mcp.html` is the public install page and it had no gate at all. It said
   "Six tools" in six places while the core shipped eight, and described
   search_content as lexical BM25 keyword search whose empty result meant the
   corpus does not cover the question — three claims, all false after the
   ranker and the gate changed. A docs specialist has corrected it by hand,
   which fixes today and does nothing about next time.

   It cannot be generated: check-boundaries.mjs bans `scripts/` from reading
   `lib/`, and that ban just got stronger. But `test/` is not a governed slice
   — deliberately, because the behaviour suite exists to reach into lib/ and
   api/ — so a test can import TOOLS and compare. That is not a loophole; it is
   verifyTokeniser's shape, one directory over: recompute the published claim
   from the code that produced it and demand exact agreement.

   BOTH DIRECTIONS, EVERY TIME. Containment one way catches a tool that was
   added and never documented. It sails straight past one that was removed and
   still is — which is the failure that looks like working software right up
   until a client calls it.

   NOT GATED HERE, deliberately: the prose of each `<dd>`. Whether
   search_content is described as semantic or lexical is a claim about
   behaviour that no string comparison can check, and a gate that pretended to
   would be worse than the paragraph asking someone to look. What is checkable
   is the LIST and the COUNT, and those are what drifted.

   README.md and lib/knowledge/CLAUDE.md are absent on purpose. Both were
   rewritten to describe tool families rather than to count them, so there is
   no assertion left in either to police.
   ============================================================ */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  goOffline,
  repoFile,
} from "./helpers/contract.mjs";
import {
  compare,
  pageToolNames,
  toolCountClaims,
  templateLiteral,
  instructionBullets,
  objectKeys,
} from "./helpers/surfaces.mjs";

goOffline();

const { TOOLS } = await import("../lib/knowledge/index.js");
const NAMES = TOOLS.map((t) => t.name);

const read = (rel) => readFileSync(repoFile(rel), "utf8");
const PAGE = read("mcp.html");
const MCP = read("api/mcp.js");

/* Sanity before anything else. Every assertion below compares against NAMES,
   so an empty or truncated NAMES would make all of them vacuously true — the
   exact failure this file exists to prevent, one level up. */
test("mcp surfaces: TOOLS is a non-trivial list of unique names", () => {
  assert.ok(NAMES.length >= 5, `TOOLS holds ${NAMES.length} tools — did the import resolve?`);
  assert.equal(new Set(NAMES).size, NAMES.length, "TOOLS has a duplicate name");
});

/* ============================================================
   mcp.html — the public install page
   ============================================================ */

test("mcp.html lists exactly the tools that exist", () => {
  const listed = pageToolNames(PAGE);
  assert.ok(
    listed,
    "mcp.html has no `<dl class=\"tools\">` — if the page was restructured, update test/helpers/surfaces.mjs " +
      "rather than deleting the check: a gate that quietly stops finding the thing it guards reports success forever."
  );

  const { missing, extra } = compare(NAMES, listed);
  assert.deepEqual(
    missing,
    [],
    `these tools exist in lib/knowledge but no <dt> on mcp.html names them: ${missing.join(", ")}. ` +
      `The install page is what a stranger reads before deciding to add this server; a tool it does not ` +
      `mention is a tool nobody calls.`
  );
  assert.deepEqual(
    extra,
    [],
    `mcp.html documents tools that do not exist: ${extra.join(", ")}. ` +
      `A published tool that is not in TOOLS is an install-page promise the endpoint will not keep.`
  );
});

test("every number mcp.html types about its tools is the real number", () => {
  const { totals, splits } = toolCountClaims(PAGE);

  /* Three separate surfaces carry the total — the meta description, the
     Open Graph description and the body — and all three were wrong together,
     because they are edited together and verified never. */
  assert.ok(
    totals.length >= 3,
    `only ${totals.length} typed tool counts found on mcp.html (expected the meta description, the og ` +
      `description and the body). If a count was removed on purpose, lower this floor in the same commit.`
  );
  assert.ok(splits.length >= 1, "the corpus/design-system split sentence is gone — lower the floor deliberately or restore it");

  const wrong = [...totals, ...splits].filter((c) => c.n !== NAMES.length);
  assert.deepEqual(
    wrong.map((c) => c.text),
    [],
    `mcp.html claims ${wrong.map((c) => `"${c.text}"`).join(", ")} but lib/knowledge ships ${NAMES.length}: ` +
      `${NAMES.join(", ")}.`
  );
});

/* ============================================================
   api/mcp.js — the cold-start prose beside the mapping

   MCP_TOOLS is a .map() over TOOLS, so the tool LIST on the wire is free.
   Four things beside it are not, and api/CLAUDE.md says so in as many words:
   "Adding a tool means adding a line there; nothing enforces it." This is
   the thing that enforces it.
   ============================================================ */

test("api/mcp.js INSTRUCTIONS helps a cold client choose between exactly these tools", () => {
  const body = templateLiteral(MCP, "INSTRUCTIONS");
  assert.ok(body, "could not find the INSTRUCTIONS template literal in api/mcp.js");

  const bullets = instructionBullets(body);
  const { missing, extra } = compare(NAMES, bullets);
  assert.deepEqual(
    missing,
    [],
    `INSTRUCTIONS gives no choosing guidance for: ${missing.join(", ")}. It is the first thing a remote ` +
      `client reads and the one part of api/mcp.js a new tool does not update for free.`
  );
  assert.deepEqual(extra, [], `INSTRUCTIONS steers a client toward tools that do not exist: ${extra.join(", ")}`);
});

test("every per-tool map in api/mcp.js is keyed by a real tool, and covers every one", () => {
  /* SCOPE and TITLES are consulted per tool with a silent fallback —
     `TITLES[tool.name] ?? tool.name` ships a snake_case identifier into a
     client's tool picker, and a missing SCOPE line is dropped by
     `.filter(Boolean)`. Neither fails, which is why neither gets noticed.
     SCOPE's `search_content: null` is a deliberate absence and stays legal:
     the key is present, and an explicit null is a decision on the record. */
  for (const name of ["SCOPE", "TITLES"]) {
    const keys = objectKeys(MCP, name);
    assert.ok(keys, `could not find the ${name} object literal in api/mcp.js`);
    const { missing, extra } = compare(NAMES, keys);
    assert.deepEqual(missing, [], `${name} has no entry for: ${missing.join(", ")}`);
    assert.deepEqual(extra, [], `${name} still has an entry for: ${extra.join(", ")} — a rename left it stranded`);
  }

  /* NOTE is deliberately partial — two tools have a real cold-start gap and
     the rest do not — so only the stranded direction is checkable. */
  const notes = objectKeys(MCP, "NOTE");
  assert.ok(notes, "could not find the NOTE object literal in api/mcp.js");
  assert.deepEqual(
    compare(NAMES, notes).extra,
    [],
    "NOTE carries a note for a tool that no longer exists — a rename left it stranded"
  );
});
