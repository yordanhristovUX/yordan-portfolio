/* ============================================================
   The chat surface — composer, turn list, SSE consumer, tool trace.

   The stream contract, and why the client is this small:
   api/chat.js validates every block server-side and emits COMPLETE
   block objects as discrete SSE events. So this file needs SSE framing
   — buffer until a blank line, parse each complete event — and nothing
   else. There is no streaming JSON parser here, and there must never be
   one: the moment partial JSON goes on the wire, the accuracy story
   moves into the browser where it cannot be enforced.

   Two invariants worth stating out loud:

     · `.rail { contain: size }` is load-bearing. A growing message list
       inside a band must never feed back into rail height — see
       design-system/components/skeleton/spec.md. The thread additionally
       scrolls inside its own bounded box (css/style.css), so the band's
       height is constant no matter how long the conversation gets, and
       `window.rebuildCaseSquares?.()` is called after DOM mutation the
       same way js/main.js:167 does.
     · Motion follows the page: the HAS_GSAP guard and
       prefers-reduced-motion, never a hard dependency on either.

   Vanilla, classic `defer`, no modules, no bundler.
   ============================================================ */
(() => {
  const root = document.querySelector("[data-chat]");
  if (!root) return;

  const RM = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const HAS_GSAP = typeof gsap !== "undefined";
  const MOTION = HAS_GSAP && !RM;

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

  /** Full history, sent on every request — the API is stateless. */
  const history = [];
  let busy = false;

  /* ---------- Layout bookkeeping ----------
     Called after every DOM mutation. The rail's own `contain: size`
     stops it from sizing the band; this keeps the dialog rails honest
     after layout shifts, exactly as js/main.js does on open. */
  function settle() {
    thread.scrollTop = thread.scrollHeight;
    requestAnimationFrame(() => window.rebuildCaseSquares?.());
  }

  function reveal(node) {
    if (!MOTION) return;
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
     introducing a spinner that belongs to no other part of the site. */
  function thinking(body) {
    const state = el("p", "chat__state mono");
    state.setAttribute("role", "status");
    state.setAttribute("aria-live", "polite");
    for (let i = 0; i < 4; i++) state.appendChild(el("span", "chat__cell"));
    state.appendChild(el("span", "chat__state-label", "Reading the corpus…"));
    body.appendChild(state);
    return {
      say: (t) => {
        const label = state.querySelector(".chat__state-label");
        if (label) label.textContent = t;
      },
      done: () => state.remove(),
    };
  }

  /* ---------- Tool trace ----------
     Collapsible, in design-system chrome. This is the architecture made
     visible: which tools ran, what they were asked, what came back. */
  function traceView(body) {
    let wrap = null;
    let list = null;
    let count = 0;

    return (event) => {
      if (!wrap) {
        wrap = el("details", "chat__trace");
        const summary = el("summary", "chat__trace-toggle mono", "Tool calls");
        wrap.appendChild(summary);
        list = el("ol", "chat__trace-list");
        wrap.appendChild(list);
        body.appendChild(wrap);
      }
      count += 1;
      wrap.querySelector(".chat__trace-toggle").textContent =
        count + (count === 1 ? " tool call" : " tool calls");

      const row = el("li", "chat__trace-row");
      row.appendChild(el("code", "chat__trace-name", event.tool));
      const args = Object.entries(event.input || {})
        .filter(([, v]) => v !== null && v !== undefined && v !== "")
        .map(([k, v]) => k + ": " + (typeof v === "string" ? v : JSON.stringify(v)))
        .join(" · ");
      if (args) row.appendChild(el("span", "chat__trace-args", args));
      if (event.summary) row.appendChild(el("span", "chat__trace-result", "→ " + event.summary));
      row.appendChild(el("span", "chat__trace-ms mono", event.ms + "ms"));
      list.appendChild(row);
    };
  }

  function errorBlock(body, message) {
    body.appendChild(el("p", "chat__error", message));
  }

  /* ---------- SSE ----------
     Buffer to a blank line, parse each complete event. That is the
     entire client-side protocol, because the server never emits a
     partial block. */
  async function stream(body, onEvent) {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: history }),
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
  }

  /* ---------- Ask ---------- */
  async function ask(question) {
    if (busy) return;
    busy = true;
    send.disabled = true;
    input.disabled = true;

    const user = addTurn("user");
    user.body.appendChild(el("p", "chat__prose", question));
    history.push({ role: "user", content: question });

    const assistant = addTurn("assistant");
    const state = thinking(assistant.body);
    const trace = traceView(assistant.body);
    settle();

    let rendered = 0;
    const answer = el("div", "chat__answer");
    assistant.body.appendChild(answer);

    try {
      await Promise.all([
        window.AnswerRender.load(),
        stream(assistant.body, (name, data) => {
          switch (name) {
            case "turn":
              state.say(data.forced ? "Composing the answer…" : "Reading the corpus…");
              break;
            case "trace":
              trace(data);
              settle();
              break;
            case "block": {
              const node = window.AnswerRender.render(data);
              if (node) {
                answer.appendChild(node);
                rendered += 1;
                reveal(answer.lastElementChild);
                settle();
              }
              break;
            }
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
      errorBlock(
        assistant.body,
        "The assistant could not be reached. The case studies, the CV and the eval results on this page are all static and unaffected."
      );
    } finally {
      state.done();
      if (!rendered && !assistant.body.querySelector(".chat__error")) {
        errorBlock(assistant.body, "No answer survived validation, which means nothing in the corpus backed it.");
      }
      /* Only the model's own prose goes back in the history — the block
         ids are re-resolved from content.json on every render, so there
         is nothing else worth replaying. */
      const prose = [...answer.querySelectorAll(".chat__prose")].map((p) => p.textContent).join("\n\n");
      history.push({ role: "assistant", content: prose || "(no answer on file)" });

      busy = false;
      send.disabled = false;
      input.disabled = false;
      input.value = "";
      settle();
    }
  }

  /* ---------- Wiring ---------- */
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const question = input.value.trim().slice(0, MAX_CHARS);
    if (question) ask(question);
  });

  /* Enter sends, Shift+Enter breaks the line — the composer is a
     textarea so a long question wraps rather than scrolling sideways. */
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
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

  if (status) status.textContent = "";
})();
