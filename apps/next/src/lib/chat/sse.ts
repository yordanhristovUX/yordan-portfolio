"use client";
/* ============================================================
   SSE framing — ported from js/chat.js @ 2e84323 (the `stream()` block); fix
   upstream first.

   Buffer to a blank line, parse each complete event. That is the ENTIRE
   client-side protocol, because api/chat.js validates every block server-side
   and emits COMPLETE block objects as discrete events. There is no streaming
   JSON parser here and there must never be one: the moment partial JSON goes
   on the wire, the accuracy story moves into the browser where it cannot be
   enforced.

   What the port changed: the callback became an async generator, so the
   consumer is a `for await` loop it can leave at any point — and leaving it is
   what runs the `finally` below. The parsing rules are the source's, exactly:

     · a frame starting with `:` is a heartbeat and is skipped (api/chat.js
       writes `: ping\n\n` every few seconds so the first byte lands early);
     · a frame with no `data:` line is skipped;
     · `event:` names the frame, defaulting to "message";
     · multiple `data:` lines are joined with "\n" before parsing;
     · A MALFORMED FRAME IS SKIPPED, NEVER FATAL. One bad JSON payload must not
       cost the reader the rest of an answer that is already streaming.

   `reader.cancel()` in the finally is not tidiness either: aborting the fetch
   already errors the body stream, but the cancel is what tells the SERVER to
   stop, which is the half of the disconnect contract api/chat.js waits on —
   it listens for `close` on the response and aborts the model call, so a
   reader who presses Stop stops the SPENDING and not just the writing.
   ============================================================ */

export interface SseFrame {
  name: string;
  data: unknown;
}

export async function* sseFrames(body: ReadableStream<Uint8Array>): AsyncGenerator<SseFrame> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let split: number;
      while ((split = buffer.indexOf("\n\n")) !== -1) {
        const raw = buffer.slice(0, split);
        buffer = buffer.slice(split + 2);
        if (!raw.trim() || raw.startsWith(":")) continue; // heartbeat

        let name = "message";
        const data: string[] = [];
        for (const line of raw.split("\n")) {
          if (line.startsWith("event:")) name = line.slice(6).trim();
          else if (line.startsWith("data:")) data.push(line.slice(5).trim());
        }
        if (!data.length) continue;

        let parsed: unknown;
        try {
          parsed = JSON.parse(data.join("\n"));
        } catch {
          /* A malformed frame is skipped, never fatal. */
          continue;
        }
        yield { name, data: parsed };
      }
    }
  } finally {
    /* Abort already errors the body stream; this is what tells the SERVER to
       stop. It is allowed to reject — the stream may already be gone. */
    reader.cancel().catch(() => {});
  }
}
