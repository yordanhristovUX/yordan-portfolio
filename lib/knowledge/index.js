/* ============================================================
   lib/knowledge — the tool core. THE product.

   Pure functions over content/dist/content.json. No network, no state, no
   framework, no dependencies. api/chat.js calls this in process; api/mcp.js
   exposes the same tools over remote MCP; evals/ measures the retrieval
   underneath. All three consume this module unchanged, which is what makes a
   tool bug impossible on one surface and not another.

   Six tools read the portfolio corpus. Two — get_design_system and
   get_component — read the design system's derived component contract, which
   the content build folds into the same file. Both halves are `TOOLS`, both go
   through `callTool`, and no consumer enumerates them.

     import { TOOLS, callTool, RESPOND_TOOL, validateAnswer } from "../lib/knowledge/index.js";

   See lib/knowledge/CLAUDE.md for the slice contract.
   ============================================================ */

export {
  content,
  manifest,
  TOOLS,
  handlers,
  callTool,
  resolve,
} from "./tools.js";

export { tokenize, search, verifyTokeniser, K1, B } from "./search.js";

/* The entity gate — a COVERAGE SIGNAL search_content attaches to every result,
   no longer a filter it applies. `entityGate` is the instance bound to this
   corpus (and carries `.floor`, the score it judges against); `makeGate` builds
   one over a fixture. Exported so the eval measures the SHIPPED gate rather
   than a lookalike. */
export { entityGate } from "./tools.js";
export { makeGate, buildNameSurfaces, gateFloor, GATE_MISS_MESSAGE } from "./gate.js";

/* Vector-cache freshness, exported so a caller can REPORT a degraded ranker
   rather than serve one silently. */
export { hasVectors, vectorsModel, vectorsCorpusHash, vectorsStatus } from "./embed.js";

export {
  ANSWER_SCHEMA,
  RESPOND_TOOL,
  MAX_BLOCKS,
  validateBlocks,
  validateReferential,
  validateProvenance,
  retrievedChunkIds,
  validateAnswer,
} from "./schema.js";
