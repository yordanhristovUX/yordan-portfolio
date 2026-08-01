/* ============================================================
   The wire, hand-typed.

   source of truth: api/chat.js's `emit()` calls + lib/knowledge/schema.js's
   VARIANTS table — hand-typed, verify on schema change.

   Same rule as src/lib/types.ts and for the same reason: the server that emits
   these frames is another slice, reachable only over HTTP, so a type here is a
   CLAIM about a contract rather than an import of it. The claim is checked the
   only way a claim about a stream can be — every field is optional-tolerant
   and every renderer returns null rather than throwing when one is missing,
   which is exactly what js/answer-render.js does.

   THE BLOCK UNION IS THE ACCURACY STORY. `prose` is the only block carrying
   model-authored text; every other block names content BY ID and the client
   renders it from the corpus. That is why `prose.text` is the only string here
   that reaches the screen without a lookup — and why it is rendered as text,
   never as markup.
   ============================================================ */

export type BlockType =
  | "prose"
  | "project"
  | "experience"
  | "facts"
  | "metric"
  | "tags"
  | "links"
  | "media"
  | "sources";

export interface AnswerBlock {
  type: BlockType;
  /** prose */
  text?: string;
  /** project */
  id?: string;
  /** experience */
  entryId?: string;
  /** facts — profile row terms ("Focus") or personal fact ids ("endurance") */
  termIds?: string[];
  /** metric + media */
  projectId?: string;
  metricIndex?: number;
  slot?: string;
  /** tags */
  labels?: string[];
  /** links — "<projectId>:<index>" */
  linkIds?: string[];
  /** sources */
  chunkIds?: string[];
}

/** `meta` — budget, not work. The trace shows it without counting it. */
export interface MetaFrame {
  model?: string;
  maxTurns?: number;
  maxBlocks?: number;
}

/** `turn` — `forced` means the model was made to answer on its last turn. */
export interface TurnFrame {
  turn?: number;
  forced?: boolean;
}

/** `trace` — one tool call, emitted the moment it runs. Doubles as keep-alive. */
export interface TraceFrame {
  turn?: number;
  tool: string;
  input?: Record<string, unknown>;
  summary?: string;
  ms?: number;
}

/** `notice` — the gates, made visible: a retry, or dropped blocks/citations. */
export interface NoticeFrame {
  kind?: "retry" | "gates" | string;
  reason?: string;
  dropped?: unknown[];
  strippedSources?: unknown[];
}

export interface ErrorFrame {
  kind?: string;
  status?: number | null;
  message?: string;
}

export interface DoneFrame {
  turns?: number;
  retried?: boolean;
  degraded?: boolean;
  uncited?: boolean;
  blocks?: number;
  error?: string;
}

/** What the assistant's turn is made of, in the order the vanilla appends it. */
export interface TraceRow {
  tool: string;
  args: string;
  summary?: string;
  ms?: number;
  /** `false` for `meta` and `notice` rows — rows that do not claim a tool ran. */
  counts: boolean;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}
