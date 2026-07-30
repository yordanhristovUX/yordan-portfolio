/* ============================================================
   The chat surface — composer, turn list, SSE consumer, tool trace.

   The stream contract, and why the client is this small:
   api/chat.js validates every block server-side and emits COMPLETE
   block objects as discrete SSE events. So this file needs SSE framing
   — buffer until a blank line, parse each complete event — and nothing
   else. There is no streaming JSON parser here, and there must never be
   one: the moment partial JSON goes on the wire, the accuracy story
   moves into the browser where it cannot be enforced.

   Three invariants worth stating out loud:

     · A growing message list inside a band must never feed back into
       rail height. That used to be held off by `.rail { contain: size }`;
       the rail's only child is now an absolutely-positioned canvas, so
       the loop is unbuildable rather than merely prevented — see
       design-system/components/skeleton/spec.md. The half that is still
       THIS file's is the other direction: the thread scrolls inside its
       own bounded box (css/style.css), so the band's height is constant
       no matter how long the conversation gets, and
       `window.rebuildCaseSquares?.()` is called after DOM mutation the
       same way js/main.js does.
     · Motion follows the page: the HAS_GSAP guard and
       prefers-reduced-motion, never a hard dependency on either — and
       reduce-motion is read at the moment it is used, not once at load.
     · ONE live region. `.chat__thread` is the log; nothing inside it
       announces on its own. See "Announcing" below.

   Vanilla, classic `defer`, no modules, no bundler.
   ============================================================ */
(() => {
  const root = document.querySelector("[data-chat]");
  if (!root) return;

  /* Re-read on every use rather than captured at load: a reader who turns
     reduce-motion on while an answer is streaming has changed their mind
     about the next block, not just about the next page. This is the same
     discipline js/automata.js applies to themed colour. */
  const RMQ = window.matchMedia("(prefers-reduced-motion: reduce)");
  const HAS_GSAP = typeof gsap !== "undefined";
  const motion = () => HAS_GSAP && !RMQ.matches;

  const $ = (s, c = root) => c.querySelector(s);
  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };

  const thread = $(".chat__thread");
  const form = $(".chat__form");
  const input = $(".chat__input");
  const send = $(".chat__send");
  const status = $(".chat__status");

  const ENDPOINT = root.dataset.chatEndpoint || "/api/chat";
  const MAX_CHARS = 1000;

  /* api/chat.js gives itself a 35s wall clock and aborts when the client
     disconnects (both landed with the server-side fix). This is the other
     half of that contract. Without a client deadline a request that never
     resolves at all — a dropped connection, a proxy that swallows the
     stream, a cold start that never returns — leaves the composer busy and
     "Reading the corpus…" on screen forever, with nothing to press.

     The client deadline sits ABOVE the server's so that when the server is
     alive its own structured error wins the race: a reader is better served
     by the real reason than by a generic timeout. The timeout is the floor,
     not the plan. */
  const SERVER_WALL_MS = 35_000;
  const CLIENT_DEADLINE_MS = SERVER_WALL_MS + 10_000;

  const SEND_LABEL = send.textContent;
  const START_LABEL = "Reading the corpus…";

  /** Full history, sent on every request — the API is stateless. */
  const history = [];
  let busy = false;
  /** The request in flight: { controller, timer, reason }. */
  let inflight = null;

  /* ---------- Announcing ----------
     `.chat__thread` already carries role="log" aria-live="polite". The
     thinking indicator used to be created INSIDE it with its own
     role="status" aria-live="polite", and every answer block was appended
     inside it too. Nested live regions do not compose; they multiply. For
     one question a screen reader got the log announcement, the status
     announcement, every label change, and every block — narration of the
     interface building itself, on top of the answer.

     So there is exactly one announcer, and it is `.chat__status`: already
     in the markup, already OUTSIDE the log, and until now wiped to an empty
     string by this file on load. The in-thread indicator keeps its four
     cells and its label as decoration (aria-hidden), and the log is marked
     aria-busy for the length of the turn so it announces the finished
     answer once instead of narrating its own construction.

     What the markup still owes this: `.chat__status` currently holds the
     provenance sentence, which is authored copy, and the first question
     replaces it. That sentence deserves its own element. */
  if (status) {
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    status.setAttribute("aria-atomic", "true");
  }
  const announce = (text) => { if (status) status.textContent = text; };

  /* ---------- Layout bookkeeping ----------
     Called after every DOM mutation. A rail cannot size the band — its
     only child is an out-of-flow canvas — so this is not defending the
     band; it re-measures the dialog's regions so their bitmaps match the
     boxes a layout shift just gave them, exactly as js/main.js does on
     open.

     What it deliberately does NOT do is pin scrollTop to scrollHeight.
     One answer runs to roughly three screens of a thread that is bounded
     by design, so "scroll to the bottom" lands the reader on the citation
     list with the sentence they asked for already scrolled out of sight
     above. The anchor is the TOP of the newest assistant turn: the reader
     waited ten seconds for the first line, so the first line is what they
     get. Everything after it is theirs to scroll to. */
  let anchor = null;
  let anchorHeld = false;

  function keepAnchor() {
    if (!anchor || anchorHeld) return;
    const delta =
      anchor.getBoundingClientRect().top -
      thread.getBoundingClientRect().top -
      thread.clientTop;
    if (Math.abs(delta) < 1) return;
    thread.scrollTop += delta;
  }

  /* This used to also call `window.rebuildCaseSquares?.()`, so the automata
     could re-measure after the thread grew. That hook is gone with the
     case-study modal, and the call was doing nothing here anyway: the drawer
     contains no `.rail`, no `.strip` and no canvas — measured, 0 regions — so
     there has never been anything inside it for the engine to rebuild. The
     thread's own bounded height is what keeps the layout still, and that is
     unchanged. */
  function settle() {
    keepAnchor();
  }

  /* The moment the reader scrolls for themselves, they own the viewport
     for the rest of the turn — an answer that keeps yanking itself back
     into position while you are reading it is worse than one that sits
     in the wrong place. */
  ["wheel", "touchmove", "pointerdown", "keydown"].forEach((type) =>
    thread.addEventListener(type, () => { anchorHeld = true; }, { passive: true })
  );

  /* ---------- Busy state ----------
     `aria-disabled`, never `disabled`. Disabling the focused textarea
     drops focus to <body>, and re-enabling it does not put focus back —
     so the reader asks a question, waits, and is silently returned to the
     top of a ~9000px document with no way to the answer but Tab or
     scroll. aria-disabled announces the busy state without moving focus;
     the `busy` guard at the top of ask() is what actually prevents a
     second submit, and readOnly is what stops typing into a field whose
     contents are about to be replaced.

     The send button is the exception: while a request is in flight it is
     not disabled in any sense, it is the CANCEL. An eight-to-fourteen
     second wait with no way out is the real defect, and the control that
     is already focused, already reachable and already the primary action
     is the cheapest honest place to put the way out — no new markup, no
     new tab stop, no layout risk. */
  function setBusy(on) {
    busy = on;
    input.setAttribute("aria-disabled", String(on));
    input.readOnly = on;
    thread.setAttribute("aria-busy", String(on));

    send.setAttribute("aria-disabled", "false");
    send.textContent = on ? "Stop" : SEND_LABEL;
    if (on) send.setAttribute("aria-label", "Stop generating this answer");
    else send.removeAttribute("aria-label");
  }

  /** Abort the request in flight. `reason` is read back in ask(). */
  function cancel(reason) {
    if (!inflight) return;
    inflight.reason = reason;
    inflight.controller.abort();
  }

  function reveal(node) {
    if (!motion()) return;
    gsap.fromTo(node, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.35, ease: "power2.out" });
  }

  /* ---------- Turns ---------- */
  function addTurn(who) {
    const turn = el("article", "chat__turn chat__turn--" + who);
    turn.appendChild(el("p", "chat__role t-label", who === "user" ? "You" : "Assistant"));
    const body = el("div", "chat__body");
    turn.appendChild(body);
    thread.appendChild(turn);
    reveal(turn);
    return { turn, body };
  }

  /* The thinking state: the automata are already running on this page,
     so the streaming indicator borrows their vocabulary rather than
     introducing a spinner that belongs to no other part of the site.

     It is aria-hidden. Its words are not lost — `say()` puts them through
     the single live region outside the log, which is the whole point of
     the announcing note above. */
  function thinking(body) {
    const state = el("p", "chat__state mono");
    state.setAttribute("aria-hidden", "true");
    for (let i = 0; i < 4; i++) state.appendChild(el("span", "chat__cell"));
    const label = el("span", "chat__state-label", START_LABEL);
    state.appendChild(label);
    body.appendChild(state);
    announce(START_LABEL);
    return {
      say: (t) => {
        if (label.textContent === t) return;
        label.textContent = t;
        announce(t);
      },
      done: () => state.remove(),
    };
  }

  /* ---------- Tool trace ----------
     In design-system chrome. This is the architecture made visible: which
     tools ran, what they were asked, what came back.

     OPEN while the answer is being built, collapsed once it is done. For a
     single-tool answer the only other feedback is a static line for eight
     and a half seconds; the rows arriving one at a time are the only real
     progress signal this interface has, and hiding them behind a
     disclosure spent that signal on nothing. Afterwards it collapses back
     to what its spec says it is — evidence, not narration — which also
     keeps it out of the log's one announcement on completion. */
  function traceView(body) {
    let wrap = null;
    let list = null;
    let count = 0;

    /* `opts.count: false` adds a row without claiming a tool ran — the
       `meta` frame is budget, not work, and inflating the tool count to
       describe it would be a new inaccuracy in the one panel whose whole
       job is being accurate about what happened. */
    const add = (event, opts = {}) => {
      if (!wrap) {
        wrap = el("details", "chat__trace");
        wrap.open = true;
        const summary = el("summary", "chat__trace-toggle mono", "Tool calls");
        wrap.appendChild(summary);
        list = el("ol", "chat__trace-list");
        wrap.appendChild(list);
        body.appendChild(wrap);
      }
      if (opts.count !== false) count += 1;
      wrap.querySelector(".chat__trace-toggle").textContent =
        count === 0 ? "Trace" : count + (count === 1 ? " tool call" : " tool calls");

      const row = el("li", "chat__trace-row");
      row.appendChild(el("code", "chat__trace-name", event.tool));
      const args = Object.entries(event.input || {})
        .filter(([, v]) => v !== null && v !== undefined && v !== "")
        .map(([k, v]) => k + ": " + (typeof v === "string" ? v : JSON.stringify(v)))
        .join(" · ");
      if (args) row.appendChild(el("span", "chat__trace-args", args));
      if (event.summary) row.appendChild(el("span", "chat__trace-result", "→ " + event.summary));
      if (event.ms != null) row.appendChild(el("span", "chat__trace-ms mono", event.ms + "ms"));
      list.appendChild(row);
    };

    add.collapse = () => { if (wrap) wrap.open = false; };
    add.count = () => count;
    return add;
  }

  function errorBlock(body, message) {
    body.appendChild(el("p", "chat__error", message));
  }

  /* A cancel is not an error, and must not be dressed as one. `mono` is a
     design-system utility, so this reads as chrome even before
     `.chat__note` has a rule of its own in components.css. */
  function noteBlock(body, message) {
    body.appendChild(el("p", "chat__note mono", message));
  }

  /* ---------- SSE ----------
     Buffer to a blank line, parse each complete event. That is the
     entire client-side protocol, because the server never emits a
     partial block. */
  async function stream(body, signal, onEvent) {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: history }),
      signal,
    });

    if (!res.ok || !res.body) {
      /* The failure paths return a structured JSON payload with its own
         renderable blocks, never a stack trace. */
      let payload = null;
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

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let split;
        while ((split = buffer.indexOf("\n\n")) !== -1) {
          const raw = buffer.slice(0, split);
          buffer = buffer.slice(split + 2);
          if (!raw.trim() || raw.startsWith(":")) continue; // heartbeat

          let name = "message";
          const data = [];
          for (const line of raw.split("\n")) {
            if (line.startsWith("event:")) name = line.slice(6).trim();
            else if (line.startsWith("data:")) data.push(line.slice(5).trim());
          }
          if (!data.length) continue;
          try {
            onEvent(name, JSON.parse(data.join("\n")));
          } catch {
            /* A malformed frame is skipped, never fatal. */
          }
        }
      }
    } finally {
      /* Abort already errors the body stream; this is what tells the
         SERVER to stop, which is the half of the disconnect contract
         api/chat.js is waiting for. */
      reader.cancel().catch(() => {});
    }
  }

  /* ---------- Ask ---------- */
  async function ask(question) {
    if (busy) return;
    setBusy(true);
    /* Cleared now, not in `finally`: the question is already on screen as
       the user turn, and a field that empties itself ten seconds later
       would throw away anything typed in the meantime. */
    input.value = "";

    const user = addTurn("user");
    user.body.appendChild(el("p", "chat__prose", question));
    history.push({ role: "user", content: question });

    const assistant = addTurn("assistant");
    anchor = assistant.turn;
    anchorHeld = false;
    const state = thinking(assistant.body);
    const trace = traceView(assistant.body);
    settle();

    const controller = new AbortController();
    const timer = setTimeout(() => cancel("timeout"), CLIENT_DEADLINE_MS);
    inflight = { controller, timer, reason: null };

    let rendered = 0;
    const answer = el("div", "chat__answer");
    assistant.body.appendChild(answer);

    /* ---------- Blocks wait for the corpus ----------
       The corpus fetch and the stream race each other, and the stream can
       win: a warm response, a cold content.json, and every block arrives
       while `AnswerRender.render()` still has no corpus to resolve ids
       against. render() correctly returns null in that state — an id that
       does not resolve must render NOTHING — but the caller then counted
       zero blocks and told the reader "No answer survived validation,
       which means nothing in the corpus backed it."

       That sentence was false. The blocks were valid and the server had
       already passed them through all three gates; the CLIENT simply was
       not ready yet. Of every wrong thing this page could say, a false
       claim about provenance is the worst, because provenance is the only
       thing it is really asserting.

       So blocks queue and drain in arrival order. Order is preserved by
       draining the whole queue rather than rendering late arrivals
       directly, and nothing is dropped for being early. */
    const pending = [];
    function drain() {
      if (!window.AnswerRender.isReady() || !pending.length) return;
      while (pending.length) {
        const node = window.AnswerRender.render(pending.shift());
        if (!node) continue;
        answer.appendChild(node);
        rendered += 1;
        reveal(answer.lastElementChild);
      }
      settle();
    }

    const corpus = window.AnswerRender.load();
    corpus.then(drain, () => {});

    try {
      await Promise.all([
        corpus,
        stream(assistant.body, controller.signal, (name, data) => {
          switch (name) {
            case "meta":
              /* The server has emitted this since day one and the spec
                 documents it as being "for the trace"; the client just
                 never had a case for it. This is the trace. */
              trace(
                {
                  tool: "meta",
                  input: { model: data.model, maxTurns: data.maxTurns, maxBlocks: data.maxBlocks },
                },
                { count: false }
              );
              settle();
              break;
            case "turn":
              state.say(data.forced ? "Composing the answer…" : START_LABEL);
              break;
            case "trace":
              trace(data);
              settle();
              break;
            case "block":
              pending.push(data);
              drain();
              break;
            case "notice":
              /* The gates, made visible. A dropped block or a stripped
                 citation is the system working, so it belongs in the
                 trace next to the tool calls rather than being silent. */
              trace({
                tool: data.kind === "retry" ? "retry" : "validate",
                input: {},
                summary:
                  data.kind === "retry"
                    ? data.reason
                    : [
                        data.dropped?.length ? `${data.dropped.length} block(s) dropped` : null,
                        data.strippedSources?.length
                          ? `${data.strippedSources.length} citation(s) stripped — not returned by a tool this turn`
                          : null,
                      ]
                        .filter(Boolean)
                        .join(" · "),
                ms: 0,
              });
              settle();
              break;
            case "error":
              errorBlock(assistant.body, data.message);
              break;
            case "done":
              if (data.degraded) {
                assistant.turn.dataset.degraded = "true";
              }
              break;
            default:
              break;
          }
        }),
      ]);
    } catch {
      /* Four different things end up here and they are not the same event.
         A cancel is not a failure, and a deadline that fires AFTER some of
         the answer has already rendered is a truncation, not a blank —
         saying "the assistant could not answer" over two paragraphs the
         reader can see is the same class of inaccuracy this whole system
         exists to avoid. What is on screen decides the wording. */
      const why = inflight?.reason;
      const secs = Math.round(CLIENT_DEADLINE_MS / 1000);
      if (why === "stopped") {
        noteBlock(
          assistant.body,
          rendered ? "Stopped. What had arrived is above." : "Stopped before anything arrived."
        );
      } else if (why === "timeout" && rendered) {
        noteBlock(assistant.body, `Cut off after ${secs} seconds. What arrived is above.`);
      } else if (why === "timeout") {
        errorBlock(
          assistant.body,
          `No response after ${secs} seconds, so the request was dropped. ` +
            "The case studies, the CV and the eval results on this page are all static and unaffected."
        );
      } else {
        errorBlock(
          assistant.body,
          "The assistant could not be reached. The case studies, the CV and the eval results on this page are all static and unaffected."
        );
      }
    } finally {
      const why = inflight?.reason;
      clearTimeout(timer);
      inflight = null;

      /* Last chance for anything still queued behind the corpus, so the
         `!rendered` verdict below is computed on what actually arrived. */
      drain();

      state.done();
      trace.collapse();

      const failed = Boolean(assistant.body.querySelector(".chat__error"));
      if (!rendered && !failed && why !== "stopped") {
        errorBlock(assistant.body, "No answer survived validation, which means nothing in the corpus backed it.");
      }
      /* Only the model's own prose goes back in the history — the block
         ids are re-resolved from content.json on every render, so there
         is nothing else worth replaying. */
      const prose = [...answer.querySelectorAll(".chat__prose")].map((p) => p.textContent).join("\n\n");
      history.push({
        role: "assistant",
        content: prose || (why === "stopped" ? "(the reader stopped this answer)" : "(no answer on file)"),
      });

      setBusy(false);

      /* The one announcement the reader actually waited for, from the one
         live region. The log is no longer aria-busy at this point, so a
         screen reader reads the finished answer; this says it is finished
         and how much of it there is. */
      const tools = trace.count();
      const blocks = `${rendered} block${rendered === 1 ? "" : "s"}` +
        (tools ? `, ${tools} tool call${tools === 1 ? "" : "s"}.` : ".");
      if (why === "stopped") announce(rendered ? `Stopped — ${blocks}` : "Stopped.");
      else if (why === "timeout") announce(rendered ? `Cut off — ${blocks}` : "No response in time. The reason is in the conversation.");
      else if (failed || !rendered) announce("The assistant could not answer. The reason is in the conversation.");
      else announce(`Answer ready — ${blocks}`);

      /* Focus should never have left the composer — that is the point of
         aria-disabled. If something else took it during the wait, only
         <body> is worth reclaiming: anywhere else is somewhere the reader
         chose to be. */
      if (document.activeElement === document.body) input.focus({ preventScroll: true });
      settle();
    }
  }

  /* ---------- Wiring ---------- */
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    if (busy) {
      /* Only a real activation of the send button cancels. `submitter` is
         null for form.requestSubmit(), which is what Enter in the textarea
         goes through — Enter must not become a destructive key just
         because a request happens to be in flight. */
      if (e.submitter === send) cancel("stopped");
      return;
    }
    const question = input.value.trim().slice(0, MAX_CHARS);
    if (question) ask(question);
  });

  /* Enter sends, Shift+Enter breaks the line — the composer is a
     textarea so a long question wraps rather than scrolling sideways. */
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (busy) return;
      form.requestSubmit();
    }
  });

  root.querySelectorAll("[data-chat-ask]").forEach((btn) =>
    btn.addEventListener("click", () => {
      if (busy) return;
      input.value = btn.dataset.chatAsk;
      form.requestSubmit();
    })
  );
})();
