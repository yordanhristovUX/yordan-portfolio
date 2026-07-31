"use client";
/* ============================================================
   The conversation, as a state machine — ported from js/chat.js @ 2e84323
   (the `ask()` block and its wiring); fix upstream first.

   The original mutates the DOM as frames arrive; this holds the same sequence
   as state and lets React write it out. Nothing about the ORDER of events, the
   wording of any outcome, or what counts as an answer has changed — those are
   the parts that carry the accuracy story, and they are reproduced statement
   for statement. What changed is where the turn lives.

   THE FOUR INVARIANTS, stated where they are implemented rather than left for
   the next reader to re-derive:

   1. VERBATIM REPLAY. Only the model's own prose goes back into `history`, and
      it goes back as the TEXT of the prose blocks that actually rendered —
      never markup, never a summary of a block, never a block id. Everything
      else in an answer is re-resolved from content.json on the next render, so
      there is nothing else worth replaying. The API is stateless: the whole
      history is sent on every request.

   2. THE 45 SECOND DEADLINE. api/chat.js gives itself a 35s wall clock and
      aborts when the client disconnects. This is the other half of that
      contract: 35 + 10, so that when the server is alive its own structured
      error wins the race and the reader gets the real reason instead of a
      generic timeout. The timeout is the floor, not the plan. Without it, a
      request that never resolves at all leaves the composer busy and "Reading
      the corpus…" on screen forever with nothing to press.

   3. THE BLOCK-VS-CORPUS RACE. The corpus fetch and the stream race each
      other, and THE STREAM CAN WIN. Blocks that arrive before content.json has
      loaded are QUEUED, not rendered and not dropped; the queue drains in
      arrival order the moment the corpus is ready, and drains once more in the
      `finally` before the "did anything render?" verdict is computed. The bug
      this prevents is the worst one this page can have: rendering nothing,
      counting zero, and telling the reader "No answer survived validation,
      which means nothing in the corpus backed it" — a FALSE claim about
      provenance, made while the blocks were valid and the server had already
      passed them through all three gates. The client simply was not ready.

   4. WHAT IS ON SCREEN DECIDES THE WORDING. A cancel is not a failure. A
      deadline that fires after some of the answer has rendered is a
      truncation, not a blank. Saying "the assistant could not answer" over two
      paragraphs the reader can see is the same class of inaccuracy the whole
      system exists to avoid.
   ============================================================ */
import { useCallback, useRef, useState } from "react";
import type { ReactElement } from "react";

import { renderBlock } from "@/components/chat/blocks";
import { load } from "@/lib/chat/corpus";
import { sseFrames } from "@/lib/chat/sse";
import type {
  AnswerBlock,
  ChatMessage,
  DoneFrame,
  ErrorFrame,
  MetaFrame,
  NoticeFrame,
  TraceFrame,
  TraceRow,
  TurnFrame,
} from "@/lib/chat/types";

/* api/chat.js's own wall clock, plus the ten seconds that let its structured
   error win the race. */
const SERVER_WALL_MS = 35_000;
export const CLIENT_DEADLINE_MS = SERVER_WALL_MS + 10_000;

export const MAX_CHARS = 1000;
const START_LABEL = "Reading the corpus…";
const COMPOSING_LABEL = "Composing the answer…";

/* The loaded corpus index. Module-scoped like the original's closure variable:
   one page, one corpus, and `load()` already caches it. Kept out of state on
   purpose — it is not something a render depends on, it is something a drain
   reads, and a drain can happen between two renders. */
const corpusRef: { current: Awaited<ReturnType<typeof load>> | null } = { current: null };

/** One block that resolved: its node, and the block it came from. */
export interface RenderedBlock {
  key: number;
  node: ReactElement;
  block: AnswerBlock;
}

export interface UserTurn {
  kind: "user";
  id: number;
  text: string;
}

export interface AssistantTurn {
  kind: "assistant";
  id: number;
  /** The thinking indicator's label, or null once the turn is finished. */
  state: string | null;
  trace: TraceRow[];
  traceOpen: boolean;
  answer: RenderedBlock[];
  /** `.chat__error` — the assistant could not do it. */
  error?: string;
  /** `.chat__note mono` — a cancel or a truncation, which is not an error. */
  note?: string;
  degraded?: boolean;
}

export type Turn = UserTurn | AssistantTurn;

const argsOf = (input: Record<string, unknown> | undefined) =>
  Object.entries(input ?? {})
    .filter(([, v]) => v !== null && v !== undefined && v !== "")
    .map(([k, v]) => k + ": " + (typeof v === "string" ? v : JSON.stringify(v)))
    .join(" · ");

export function useChat({ endpoint }: { endpoint: string }) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false);
  const [announcement, setAnnouncement] = useState<string | null>(null);

  /** Full history, sent on every request — the API is stateless. */
  const history = useRef<ChatMessage[]>([]);
  const nextId = useRef(0);
  /** The request in flight: { controller, reason }. */
  const inflight = useRef<{ controller: AbortController; reason: string | null } | null>(null);
  const busyRef = useRef(false);

  const patch = useCallback((id: number, next: Partial<AssistantTurn>) => {
    setTurns((ts) =>
      ts.map((t) => (t.id === id && t.kind === "assistant" ? { ...t, ...next } : t))
    );
  }, []);

  /** Abort the request in flight. `reason` is read back in ask(). */
  const cancel = useCallback((reason: string) => {
    if (!inflight.current) return;
    inflight.current.reason = reason;
    inflight.current.controller.abort();
  }, []);

  const ask = useCallback(
    async (question: string) => {
      if (busyRef.current) return;
      busyRef.current = true;
      setBusy(true);

      const userId = nextId.current++;
      const turnId = nextId.current++;
      setTurns((ts) => [
        ...ts,
        { kind: "user", id: userId, text: question },
        {
          kind: "assistant",
          id: turnId,
          state: START_LABEL,
          trace: [],
          traceOpen: true,
          answer: [],
        },
      ]);
      history.current.push({ role: "user", content: question });
      setAnnouncement(START_LABEL);

      const controller = new AbortController();
      const timer = setTimeout(() => cancel("timeout"), CLIENT_DEADLINE_MS);
      inflight.current = { controller, reason: null };

      /* Local, exactly as in the original: `rendered` is what the verdict at
         the bottom is computed from, and it counts blocks that RESOLVED. */
      let rendered = 0;
      const answer: RenderedBlock[] = [];
      const trace: TraceRow[] = [];
      let toolCount = 0;
      let errorText: string | undefined;
      let noteText: string | undefined;

      const addTrace = (row: TraceRow) => {
        if (row.counts) toolCount += 1;
        trace.push(row);
        patch(turnId, { trace: [...trace] });
      };

      /* ---------- Blocks wait for the corpus ----------
         Order is preserved by draining the WHOLE queue rather than rendering
         late arrivals directly, and nothing is dropped for being early. */
      const pending: AnswerBlock[] = [];
      const drain = () => {
        const corpus = corpusRef.current;
        if (!corpus || !pending.length) return;
        while (pending.length) {
          const block = pending.shift()!;
          const node = renderBlock(corpus, block);
          if (!node) continue;
          answer.push({ key: nextId.current++, node, block });
          rendered += 1;
        }
        patch(turnId, { answer: [...answer] });
      };

      const corpus = load().then((c) => {
        corpusRef.current = c;
        return c;
      });
      corpus.then(drain, () => {});

      const onEvent = (name: string, data: unknown) => {
        switch (name) {
          case "meta": {
            /* The server has emitted this since day one and the spec documents
               it as being "for the trace". `counts: false` adds a row without
               claiming a tool ran — the frame is budget, not work. */
            const d = data as MetaFrame;
            addTrace({
              tool: "meta",
              args: argsOf({ model: d.model, maxTurns: d.maxTurns, maxBlocks: d.maxBlocks }),
              counts: false,
            });
            break;
          }
          case "turn": {
            const d = data as TurnFrame;
            const label = d.forced ? COMPOSING_LABEL : START_LABEL;
            patch(turnId, { state: label });
            setAnnouncement(label);
            break;
          }
          case "trace": {
            const d = data as TraceFrame;
            addTrace({ tool: d.tool, args: argsOf(d.input), summary: d.summary, ms: d.ms, counts: true });
            break;
          }
          case "block":
            pending.push(data as AnswerBlock);
            drain();
            break;
          case "notice": {
            /* The gates, made visible. A dropped block or a stripped citation
               is the system working, so it belongs in the trace next to the
               tool calls rather than being silent. */
            const d = data as NoticeFrame;
            addTrace({
              tool: d.kind === "retry" ? "retry" : "validate",
              args: "",
              summary:
                d.kind === "retry"
                  ? d.reason
                  : [
                      d.dropped?.length ? `${d.dropped.length} block(s) dropped` : null,
                      d.strippedSources?.length
                        ? `${d.strippedSources.length} citation(s) stripped — not returned by a tool this turn`
                        : null,
                    ]
                      .filter(Boolean)
                      .join(" · "),
              ms: 0,
              counts: true,
            });
            break;
          }
          case "error": {
            const d = data as ErrorFrame;
            errorText = d.message;
            patch(turnId, { error: errorText });
            break;
          }
          case "done": {
            const d = data as DoneFrame;
            if (d.degraded) patch(turnId, { degraded: true });
            break;
          }
          default:
            break;
        }
      };

      const stream = async () => {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: history.current }),
          signal: controller.signal,
        });

        if (!res.ok || !res.body) {
          /* The failure paths return a structured JSON payload with its own
             renderable blocks, never a stack trace. */
          let payload: { error?: string; message?: string } | null = null;
          try {
            payload = await res.json();
          } catch {
            /* not JSON — fall through to the generic message */
          }
          onEvent("error", {
            kind: payload?.error || "unreachable",
            message:
              payload?.message ||
              "The assistant is unavailable. Everything else on this page is static and works without it.",
          });
          return;
        }

        for await (const frame of sseFrames(res.body)) onEvent(frame.name, frame.data);
      };

      try {
        await Promise.all([corpus, stream()]);
      } catch {
        /* Four different things end up here and they are not the same event. */
        const why = inflight.current?.reason;
        const secs = Math.round(CLIENT_DEADLINE_MS / 1000);
        if (why === "stopped") {
          noteText = rendered ? "Stopped. What had arrived is above." : "Stopped before anything arrived.";
        } else if (why === "timeout" && rendered) {
          noteText = `Cut off after ${secs} seconds. What arrived is above.`;
        } else if (why === "timeout") {
          errorText =
            `No response after ${secs} seconds, so the request was dropped. ` +
            "The case studies, the CV and the eval results on this page are all static and unaffected.";
        } else {
          errorText =
            "The assistant could not be reached. The case studies, the CV and the eval results on this page are all static and unaffected.";
        }
      } finally {
        const why = inflight.current?.reason;
        clearTimeout(timer);
        inflight.current = null;

        /* Last chance for anything still queued behind the corpus, so the
           `!rendered` verdict below is computed on what actually arrived. */
        drain();

        const failed = Boolean(errorText);
        if (!rendered && !failed && why !== "stopped") {
          errorText = "No answer survived validation, which means nothing in the corpus backed it.";
        }

        patch(turnId, {
          state: null,
          traceOpen: false,
          answer: [...answer],
          trace: [...trace],
          error: errorText,
          note: noteText,
        });

        /* Only the model's own prose goes back in the history — the block ids
           are re-resolved from content.json on every render, so there is
           nothing else worth replaying. */
        const prose = answer
          .filter((a) => a.block.type === "prose")
          .map((a) => a.block.text ?? "")
          .join("\n\n");
        history.current.push({
          role: "assistant",
          content: prose || (why === "stopped" ? "(the reader stopped this answer)" : "(no answer on file)"),
        });

        busyRef.current = false;
        setBusy(false);

        /* The one announcement the reader actually waited for, from the one
           live region outside the log. */
        const blocks =
          `${rendered} block${rendered === 1 ? "" : "s"}` +
          (toolCount ? `, ${toolCount} tool call${toolCount === 1 ? "" : "s"}.` : ".");
        if (why === "stopped") setAnnouncement(rendered ? `Stopped — ${blocks}` : "Stopped.");
        else if (why === "timeout")
          setAnnouncement(
            rendered ? `Cut off — ${blocks}` : "No response in time. The reason is in the conversation."
          );
        else if (failed || !rendered)
          setAnnouncement("The assistant could not answer. The reason is in the conversation.");
        else setAnnouncement(`Answer ready — ${blocks}`);
      }
    },
    [cancel, endpoint, patch]
  );

  return { turns, busy, announcement, ask, cancel };
}
