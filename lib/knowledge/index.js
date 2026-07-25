/* ============================================================
   lib/knowledge — the tool core. THE product.

   Pure functions over content/dist/content.json. No network, no state, no
   framework, no dependencies. api/chat.js calls this in process; api/mcp.js
   exposes the same six tools over remote MCP; evals/ measures the retrieval
   underneath. All three consume this module unchanged, which is what makes a
   tool bug impossible on one surface and not another.

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
