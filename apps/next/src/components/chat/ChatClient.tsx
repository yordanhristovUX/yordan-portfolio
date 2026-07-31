"use client";
/* ============================================================
   The chat surface — composer, turn list, tool trace.

   PORTED FROM js/chat.js @ 2e84323 (the DOM half; the conversation is in
   src/lib/chat/useChat.ts); fix upstream first. Every class name and every
   element below is that file's.

   THREE THINGS THE MARKUP IS DOING, none of them cosmetic:

   · ONE LIVE REGION. `.chat__thread` is the log (role="log", aria-live), and
     NOTHING inside it announces on its own. The thinking indicator used to be
     a nested role="status", and nested live regions do not compose — they
     multiply: one question produced the log announcement, the status
     announcement, every label change and every block, narrating the interface
     building itself on top of the answer. So there is exactly one announcer,
     `.chat__status`, which sits OUTSIDE the log; the in-thread indicator is
     aria-hidden decoration, and the log is aria-busy for the length of the
     turn so it announces the finished answer once.

   · `aria-disabled`, NEVER `disabled`. Disabling the focused textarea drops
     focus to <body>, and re-enabling does not put it back — the reader asks a
     question, waits, and is silently returned to the top of a ~9000px document
     with no way to the answer but Tab or scroll. `readOnly` is what stops
     typing into a field whose contents are about to be replaced, and the busy
     guard in ask() is what actually prevents a second submit.

   · THE SEND BUTTON IS THE CANCEL. While a request is in flight it is not
     disabled in any sense — an eight-to-fourteen second wait with no way out
     is the real defect, and the control that is already focused, already
     reachable and already the primary action is the cheapest honest place to
     put the way out. Only a REAL activation of it cancels: `submitter` is null
     for the Enter key's requestSubmit(), because Enter must not become a
     destructive key just because a request happens to be in flight.

   WHAT THE PORT DROPPED, deliberately: the GSAP reveal. `js/chat.js` guards it
   with `HAS_GSAP && !prefers-reduced-motion` and does nothing when GSAP is
   absent — which is this app's permanent state, since motion is out of scope
   here and GSAP is not vendored. So this is the vanilla's own no-GSAP path,
   not a new behaviour.
   ============================================================ */
import { useCallback, useLayoutEffect, useRef, useState } from "react";

import { AnswerBlocks } from "@/components/chat/blocks";
import { MAX_CHARS, useChat } from "@/lib/chat/useChat";
import type { AssistantTurn } from "@/lib/chat/useChat";
import { CHAT } from "@/lib/vanilla-copy";

function Trace({ turn }: { turn: AssistantTurn }) {
  const ref = useRef<HTMLDetailsElement>(null);
  const count = turn.trace.filter((r) => r.counts).length;

  /* `open` is written imperatively rather than bound, so a reader who collapses
     the disclosure mid-answer keeps it collapsed: React only forces it at the
     two moments the original does — created open, collapsed when the turn
     ends. Open while the answer is being built because for a single-tool answer
     the rows arriving one at a time are the only real progress signal this
     interface has; collapsed afterwards, because it is evidence, not
     narration. */
  useLayoutEffect(() => {
    if (ref.current) ref.current.open = turn.traceOpen;
  }, [turn.traceOpen]);

  if (!turn.trace.length) return null;
  return (
    <details className="chat__trace" ref={ref}>
      <summary className="chat__trace-toggle mono">
        {count === 0 ? "Trace" : count + (count === 1 ? " tool call" : " tool calls")}
      </summary>
      <ol className="chat__trace-list">
        {turn.trace.map((row, i) => (
          <li className="chat__trace-row" key={i}>
            <code className="chat__trace-name">{row.tool}</code>
            {row.args ? <span className="chat__trace-args">{row.args}</span> : null}
            {row.summary ? <span className="chat__trace-result">{"→ " + row.summary}</span> : null}
            {row.ms != null ? <span className="chat__trace-ms mono">{row.ms + "ms"}</span> : null}
          </li>
        ))}
      </ol>
    </details>
  );
}

/* The thinking state borrows the automata's vocabulary rather than introducing
   a spinner that belongs to no other part of the site. aria-hidden: its words
   are not lost, they go through the one live region outside the log. */
function Thinking({ label }: { label: string }) {
  return (
    <p className="chat__state mono" aria-hidden="true">
      <span className="chat__cell" />
      <span className="chat__cell" />
      <span className="chat__cell" />
      <span className="chat__cell" />
      <span className="chat__state-label">{label}</span>
    </p>
  );
}

export function ChatClient({ endpoint }: { endpoint: string }) {
  const { turns, busy, announcement, ask, cancel } = useChat({ endpoint });
  const [value, setValue] = useState("");
  const threadRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const sendRef = useRef<HTMLButtonElement>(null);
  const anchorHeld = useRef(false);

  /* ---------- Layout bookkeeping ----------
     NOT scrollTop = scrollHeight. One answer runs to roughly three screens of a
     thread that is bounded by design, so "scroll to the bottom" lands the
     reader on the citation list with the sentence they asked for already
     scrolled out of sight above. The anchor is the TOP of the newest assistant
     turn: the reader waited ten seconds for the first line, so the first line
     is what they get. Everything after it is theirs to scroll to. */
  useLayoutEffect(() => {
    const thread = threadRef.current;
    if (!thread || anchorHeld.current) return;
    const anchor = thread.querySelector<HTMLElement>(".chat__turn--assistant:last-of-type");
    if (!anchor) return;
    const delta =
      anchor.getBoundingClientRect().top - thread.getBoundingClientRect().top - thread.clientTop;
    if (Math.abs(delta) < 1) return;
    thread.scrollTop += delta;
  }, [turns]);

  /* The moment the reader scrolls for themselves, they own the viewport for the
     rest of the turn — an answer that keeps yanking itself back into position
     while you are reading it is worse than one that sits in the wrong place. */
  const hold = useCallback(() => {
    anchorHeld.current = true;
  }, []);

  const submit = useCallback(
    (question: string) => {
      anchorHeld.current = false;
      setValue("");
      void ask(question);
    },
    [ask]
  );

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (busy) {
      /* Only a real activation of the send button cancels. */
      const submitter = (e.nativeEvent as SubmitEvent).submitter;
      if (submitter === sendRef.current) cancel("stopped");
      return;
    }
    const question = value.trim().slice(0, MAX_CHARS);
    if (question) submit(question);
  };

  return (
    <div className="chat" data-chat="" data-chat-endpoint={endpoint}>
      {/* tabindex="0" is the WCAG 2.1.1 fix: this is a bounded scroller holding
          content taller than itself, and <body> is overflow:hidden while the
          drawer is open, so a keyboard reader has nowhere to send a PageDown.
          Chrome's focusable-scroller heuristic never rescues it, because the
          tool trace always renders at least one focusable child. */}
      <div
        className="chat__thread"
        ref={threadRef}
        tabIndex={0}
        role="log"
        aria-live="polite"
        aria-label={CHAT.threadLabel}
        aria-busy={busy ? "true" : "false"}
        onWheel={hold}
        onTouchMove={hold}
        onPointerDown={hold}
        onKeyDown={hold}
      >
        {turns.map((turn) =>
          turn.kind === "user" ? (
            <article className="chat__turn chat__turn--user" key={turn.id}>
              <p className="chat__role t-label">You</p>
              <div className="chat__body">
                <p className="chat__prose">{turn.text}</p>
              </div>
            </article>
          ) : (
            <article
              className="chat__turn chat__turn--assistant"
              key={turn.id}
              {...(turn.degraded ? { "data-degraded": "true" } : {})}
            >
              <p className="chat__role t-label">Assistant</p>
              <div className="chat__body">
                {turn.state ? <Thinking label={turn.state} /> : null}
                {/* The answer sits ABOVE the trace: the vanilla appends the
                    answer container when the turn opens and the trace only
                    when its first row arrives, which is after the stream has
                    started. Same order here, on purpose. */}
                <div className="chat__answer">
                  <AnswerBlocks nodes={turn.answer} />
                </div>
                <Trace turn={turn} />
                {turn.error ? <p className="chat__error">{turn.error}</p> : null}
                {/* A cancel is not an error, and must not be dressed as one. */}
                {turn.note ? <p className="chat__note mono">{turn.note}</p> : null}
              </div>
            </article>
          )
        )}
      </div>

      <form className="chat__form" onSubmit={onSubmit}>
        <textarea
          className="chat__input"
          ref={inputRef}
          rows={2}
          maxLength={MAX_CHARS}
          placeholder={CHAT.placeholder}
          aria-label={CHAT.inputLabel}
          aria-disabled={busy ? "true" : "false"}
          readOnly={busy}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            /* Enter sends, Shift+Enter breaks the line — the composer is a
               textarea so a long question wraps rather than scrolling
               sideways. */
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              if (busy) return;
              const question = value.trim().slice(0, MAX_CHARS);
              if (question) submit(question);
            }
          }}
        />
        <button
          className="btn btn--solid chat__send"
          ref={sendRef}
          type="submit"
          aria-disabled="false"
          {...(busy ? { "aria-label": "Stop generating this answer" } : {})}
        >
          {busy ? "Stop" : CHAT.send}
        </button>
      </form>

      <div className="chat__suggest">
        {CHAT.suggestions.map((s) => (
          <button
            className="btn btn--small"
            type="button"
            key={s.ask}
            data-chat-ask={s.ask}
            onClick={() => {
              if (busy) return;
              submit(s.ask);
            }}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* The one announcer, outside the log. It holds the authored provenance
          sentence until the first question replaces it — which is exactly what
          the vanilla does, and what that sentence's own note in js/chat.js
          says it deserves better than. */}
      <p className="chat__status mono" role="status" aria-live="polite" aria-atomic="true">
        {announcement ?? CHAT.status}
      </p>
    </div>
  );
}
