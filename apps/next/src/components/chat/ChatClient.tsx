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

   THE COMPOSER CHROME IS THE REACT TIER; THE ANSWER IS NOT. Everything below
   is `@yordan/design-system/react/chat` — `chat` is the block with the most
   rules in the file and it needed the fewest constructs, so it is generated
   whole and there is no authored remainder to work around. What blocks.tsx
   renders INSIDE `.chat__answer` stays vanilla-classed, and its own header
   says why: it is a port of js/answer-render.js, so its markup is the
   artefact's rather than this app's.

   FIVE CLASSES SURVIVE HERE, each named by something that is not the tier:

     .chat                   the drawer HOSTS a chat and re-lays it out by
     .chat__thread           name — four rules on `.chat`, two on the thread
                             and one on `.chat__thread:empty`. Nine of
                             drawer's rules are about components it hosts.
     .chat__role             `.chat__turn--assistant` declares nothing at all;
                             its whole effect is turning this label accent.
     .chat__turn--assistant  the scroll anchor below queries it directly —
                             `:last-of-type` is how the newest answer is found.
     .chat__cell             the reduced-motion block of components.css
                             (`@component none`) stops all four squares.
     .chat__trace-toggle     `.chat__trace[open] .chat__trace-toggle::before`
                             flips the disclosure caret; the sink is named.

   `.chat__send` LEAVES, and it is the clearest small case for the tier: it was
   a QUERY-ONLY rule, one declaration under `max-width: 560px` and nothing
   unconditional, so `chatSend()` is a single arbitrary variant and the class
   was carrying nothing else.
   ============================================================ */
import { useCallback, useLayoutEffect, useRef, useState } from "react";
import type { Ref } from "react";

import { Button } from "@yordan/design-system/react/button";
import type { ButtonProps } from "@yordan/design-system/react/button";
import {
  Chat,
  ChatAnswer,
  ChatBody,
  ChatCell,
  ChatError,
  ChatForm,
  ChatInput,
  ChatNote,
  ChatProse,
  ChatRole,
  ChatState,
  ChatStateLabel,
  ChatStatus,
  ChatSuggest,
  ChatThread,
  ChatTrace,
  ChatTraceArgs,
  ChatTraceList,
  ChatTraceMs,
  ChatTraceName,
  ChatTraceResult,
  ChatTraceRow,
  ChatTraceToggle,
  ChatTurn,
  chatSend,
  chatTurnAssistant,
  chatTurnUser,
} from "@yordan/design-system/react/chat";

import { AnswerBlocks } from "@/components/chat/blocks";
import { MAX_CHARS, useChat } from "@/lib/chat/useChat";
import type { AssistantTurn } from "@/lib/chat/useChat";
import { CHAT } from "@/lib/vanilla-copy";

/* THE SEND BUTTON NEEDS A REF, AND THE GENERATED TYPE DOES NOT OFFER ONE.

   `ButtonProps` is built from `ComponentPropsWithoutRef<"button">`, so `ref` is
   not in it. React 19 passes `ref` to a function component as an ordinary prop
   and the generated Button spreads `...rest` onto its element, so the ref DOES
   attach at runtime — this is a hole in the published type, not in the
   component. Widening it here is a one-line cast at one call site rather than a
   local reimplementation of the button; the fix belongs in the emitter, and is
   reported for R3. The ref is load-bearing: `onSubmit` compares it against the
   submit event's `submitter` to tell a real click on Send from the Enter key's
   requestSubmit(), which is what stops Enter becoming a cancel key. */
const SendButton = Button as (props: ButtonProps & { ref?: Ref<HTMLButtonElement> }) => React.JSX.Element;

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
    <ChatTrace className="chat__trace" ref={ref}>
      {/* BOTH ENDS OF `.chat__trace[open] .chat__trace-toggle::before` stay —
          the rule that swaps the disclosure caret. The sink because a scoped
          rule names its sink by class even when its host is a utility; the
          HOST because pipeline 2's version of this rule does not compile:
          `[&[open]_.chat__trace-toggle::before]` becomes
          `.chat trace-toggle:before`, since `_` is a space in an arbitrary
          variant. Upstream defect, written up in scripts/check-class-hooks.mjs
          — until it is fixed, components.css is the only surface that draws
          this caret, and it needs both names. */}
      <ChatTraceToggle className="chat__trace-toggle mono">
        {count === 0 ? "Trace" : count + (count === 1 ? " tool call" : " tool calls")}
      </ChatTraceToggle>
      <ChatTraceList>
        {turn.trace.map((row, i) => (
          <ChatTraceRow key={i}>
            <ChatTraceName>{row.tool}</ChatTraceName>
            {row.args ? <ChatTraceArgs>{row.args}</ChatTraceArgs> : null}
            {row.summary ? <ChatTraceResult>{"→ " + row.summary}</ChatTraceResult> : null}
            {row.ms != null ? <ChatTraceMs className="mono">{row.ms + "ms"}</ChatTraceMs> : null}
          </ChatTraceRow>
        ))}
      </ChatTraceList>
    </ChatTrace>
  );
}

/* The thinking state borrows the automata's vocabulary rather than introducing
   a spinner that belongs to no other part of the site. aria-hidden: its words
   are not lost, they go through the one live region outside the log. */
function Thinking({ label }: { label: string }) {
  return (
    <ChatState className="mono" aria-hidden="true">
      {/* `.chat__cell` stays: the reduced-motion block of components.css is
          `@component none` — no component, so no definition and no React form
          ever — and it is what stops the four squares breathing. */}
      <ChatCell className="chat__cell" />
      <ChatCell className="chat__cell" />
      <ChatCell className="chat__cell" />
      <ChatCell className="chat__cell" />
      <ChatStateLabel>{label}</ChatStateLabel>
    </ChatState>
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
    <Chat className="chat" data-chat="" data-chat-endpoint={endpoint}>
      {/* tabindex="0" is the WCAG 2.1.1 fix: this is a bounded scroller holding
          content taller than itself, and <body> is overflow:hidden while the
          drawer is open, so a keyboard reader has nowhere to send a PageDown.
          Chrome's focusable-scroller heuristic never rescues it, because the
          tool trace always renders at least one focusable child. */}
      <ChatThread
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
        {/* TWO PARTS ON ONE ELEMENT, NOT A VARIANT WITH TWO BRANCHES, and
            that is the definition's shape rather than this file's choice: a
            modifier's selector is its ROOT plus its name, and chat's root is
            `.chat` — so `.chat__turn--user` modifies a PART, a part has no
            axis, and the stylesheet's two classes are two parts. `ChatTurn`
            renders the article and the second class map rides in on
            `className`, exactly as the stylesheet writes the pair. */}
        {turns.map((turn) =>
          turn.kind === "user" ? (
            <ChatTurn className={chatTurnUser()} key={turn.id}>
              <ChatRole className="chat__role t-label">You</ChatRole>
              <ChatBody>
                <ChatProse>{turn.text}</ChatProse>
              </ChatBody>
            </ChatTurn>
          ) : (
            <ChatTurn
              /* `.chat__turn--assistant` is the ONE class here the scroll
                 anchor above needs by name — it is what `:last-of-type` finds
                 — and it is also the host of the accent-role rule, whose sink
                 `.chat__role` is named for the same reason. */
              className={chatTurnAssistant({ className: "chat__turn--assistant" })}
              key={turn.id}
              {...(turn.degraded ? { "data-degraded": "true" } : {})}
            >
              <ChatRole className="chat__role t-label">Assistant</ChatRole>
              <ChatBody>
                {turn.state ? <Thinking label={turn.state} /> : null}
                {/* The answer sits ABOVE the trace: the vanilla appends the
                    answer container when the turn opens and the trace only
                    when its first row arrives, which is after the stream has
                    started. Same order here, on purpose. */}
                <ChatAnswer>
                  <AnswerBlocks nodes={turn.answer} />
                </ChatAnswer>
                <Trace turn={turn} />
                {turn.error ? <ChatError>{turn.error}</ChatError> : null}
                {/* A cancel is not an error, and must not be dressed as one. */}
                {turn.note ? <ChatNote className="mono">{turn.note}</ChatNote> : null}
              </ChatBody>
            </ChatTurn>
          )
        )}
      </ChatThread>

      <ChatForm onSubmit={onSubmit}>
        {/* `.chat__input` STAYS, and this is the second upstream defect the
            cutover measured. components.css writes

                .chat__input { font: inherit; font-size: var(--text-md); … }

            — a SHORTHAND followed by a longhand that overrides it, which is
            an ordinary and correct thing for a stylesheet to say. cva puts
            both in one class attribute, a class attribute has no order, and
            Tailwind sorts `[font:inherit]` AFTER `text-step-md`: the shorthand
            wins and resets the size to the inherited 16px. Measured against
            the vanilla composer: 16px against 14.72px, and a form 4.09px
            taller. The emitter's disjointness pass (design-system/README.md,
            "A class attribute has no order") makes a BASE and a VARIANT AXIS
            disjoint; a shorthand and its own longhand inside ONE base list are
            not analysed. Reported; until it is fixed the class is what puts
            the two declarations back in the order the stylesheet wrote them. */}
        <ChatInput
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
        {/* THE SEND BUTTON IS TWO COMPONENTS' WORTH OF STYLING ON ONE
            ELEMENT, which is what the stylesheet says it is:
            `.btn.btn--solid.chat__send`. `variant="solid"` is the first two,
            and `chatSend()` is the third — a single query-only declaration
            with no unconditional rule behind it, so the class itself carried
            nothing and does not survive the swap. */}
        <SendButton
          variant="solid"
          className={chatSend()}
          ref={sendRef}
          type="submit"
          aria-disabled="false"
          {...(busy ? { "aria-label": "Stop generating this answer" } : {})}
        >
          {busy ? "Stop" : CHAT.send}
        </SendButton>
      </ChatForm>

      <ChatSuggest>
        {CHAT.suggestions.map((s) => (
          <Button
            size="small"
            type="button"
            key={s.ask}
            data-chat-ask={s.ask}
            onClick={() => {
              if (busy) return;
              submit(s.ask);
            }}
          >
            {s.label}
          </Button>
        ))}
      </ChatSuggest>

      {/* The one announcer, outside the log. It holds the authored provenance
          sentence until the first question replaces it — which is exactly what
          the vanilla does, and what that sentence's own note in js/chat.js
          says it deserves better than. */}
      <ChatStatus className="mono" role="status" aria-live="polite" aria-atomic="true">
        {announcement ?? CHAT.status}
      </ChatStatus>
    </Chat>
  );
}
