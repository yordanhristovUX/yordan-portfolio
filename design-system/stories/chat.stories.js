export default { title: "Components/Chat" };

/* The chat surface, static. On the site js/chat.js drives it from the SSE
   stream and js/answer-render.js builds the answer out of the SITE'S OWN
   components — a project block becomes the real .idx__row and opens the
   real case dialog. These stories render that output by hand so the
   chrome can be reviewed without an API key. */

const turn = (who, body) => `
  <article class="chat__turn chat__turn--${who}">
    <p class="chat__role t-label">${who === "user" ? "You" : "Assistant"}</p>
    <div class="chat__body">${body}</div>
  </article>`;

const composer = () => `
  <form class="chat__form" onsubmit="return false">
    <textarea class="chat__input" rows="2" maxlength="1000"
      placeholder="Ask about the work, the roles, or this design system"
      aria-label="Ask a question"></textarea>
    <button class="btn btn--solid chat__send" type="submit">Ask &rarr;</button>
  </form>
  <div class="chat__suggest">
    <button class="btn btn--small" type="button">What has he shipped?</button>
    <button class="btn btn--small" type="button">Where is he based?</button>
    <button class="btn btn--small" type="button">How is this site built?</button>
  </div>`;

const shell = (thread, extra = "") => `
  <main class="sheet">
    <section class="band sec">
      <header class="sec__head">
        <span class="sec__no mono">07</span>
        <h2 class="sec__title t-title">Ask</h2>
        <span class="sec__note">Answers are built from the same source as the page</span>
      </header>
      <div class="well">
        <div class="chat">
          <div class="chat__thread" tabindex="0" role="log" aria-live="polite" aria-label="Conversation">${thread}</div>
          ${composer()}
          ${extra}
        </div>
      </div>
    </section>
  </main>`;

/* ---------- 1. Empty — what a first visitor sees ---------- */
export const Empty = {
  name: "Empty (first visit)",
  render: () => shell(""),
};

/* ---------- 2. A real answer ----------
   Prose, then the site's own components carrying every fact, then the
   citations. Note that no date, metric or tag is typed into the prose:
   those are `metric` and `tags` blocks resolved from content.json. */
export const Answered = {
  name: "Answered (blocks + sources)",
  render: () =>
    shell(
      turn("user", `<p class="chat__prose">What accessibility work has he done?</p>`) +
        turn(
          "assistant",
          `
      <details class="chat__trace">
        <summary class="chat__trace-toggle mono">2 tool calls</summary>
        <ol class="chat__trace-list">
          <li class="chat__trace-row">
            <code class="chat__trace-name">search_content</code>
            <span class="chat__trace-args">query: accessibility audit WCAG</span>
            <span class="chat__trace-result">&rarr; 6 chunks (gate: project:greenstreet-audit)</span>
            <span class="chat__trace-ms mono">2ms</span>
          </li>
          <li class="chat__trace-row">
            <code class="chat__trace-name">get_project</code>
            <span class="chat__trace-args">id: greenstreet-audit</span>
            <span class="chat__trace-result">&rarr; greenstreet-audit — 7 sections, 7 chunks</span>
            <span class="chat__trace-ms mono">1ms</span>
          </li>
        </ol>
      </details>
      <div class="chat__answer">
        <p class="chat__prose">He audited two Green Street product surfaces against WCAG 2.1 AA — an
        editorial platform and a data-dense analytics platform — and turned the findings into a
        severity-rated remediation roadmap.</p>

        <p class="chat__why">The audit is the engagement where the accessibility work was the deliverable.</p>
        <ul class="idx" role="list">
          <li>
            <button class="idx__row" type="button">
              <span class="idx__no mono">02</span>
              <span class="idx__main">
                <span class="idx__name">Green Street <em>&mdash; UX &amp; Accessibility Audits</em></span>
                <span class="idx__desc">WCAG 2.1 AA audits of two product surfaces — editorial and
                data-dense analytics. 200+ issue instances catalogued with severity ratings and a
                prioritised remediation roadmap.</span>
              </span>
              <span class="idx__tags"><span class="chip">Accessibility</span><span class="chip">Audit</span><span class="chip">WCAG AA</span></span>
              <span class="idx__go mono" aria-hidden="true">View &rarr;</span>
            </button>
          </li>
        </ul>

        <p class="chat__metric"><span class="stat">200+</span>Issue instances catalogued</p>

        <div class="chips">
          <span class="chip">Accessibility</span>
          <span class="chip">WCAG 2.1 AA</span>
          <span class="chip">UX Audit</span>
        </div>

        <div class="sources">
          <p class="sources__title mono">Sources</p>
          <ol class="sources__list">
            <li class="source">
              <span class="source__ref mono">1</span>
              <button class="source__link" type="button">Green Street &mdash; UX &amp; Accessibility Audits &mdash; Summary</button>
              <span class="source__id mono">project:greenstreet-audit#summary</span>
            </li>
            <li class="source">
              <span class="source__ref mono">2</span>
              <button class="source__link" type="button">Green Street &mdash; UX &amp; Accessibility Audits &mdash; Outcomes</button>
              <span class="source__id mono">project:greenstreet-audit#outcome-1</span>
            </li>
          </ol>
        </div>
      </div>`
        )
    ),
};

/* ---------- 3. Streaming ---------- */
export const Streaming = {
  name: "Streaming (thinking state)",
  render: () =>
    shell(
      turn("user", `<p class="chat__prose">How is this site built?</p>`) +
        turn(
          "assistant",
          `
      <details class="chat__trace" open>
        <summary class="chat__trace-toggle mono">1 tool call</summary>
        <ol class="chat__trace-list">
          <li class="chat__trace-row">
            <code class="chat__trace-name">get_system_facts</code>
            <!-- Deliberately not the live counts. This is a mock trace whose job is to
                 show the SHAPE of a tool result; the demo does not depend on the numbers
                 being real, and hand-typed figures here would go stale the first time a
                 token lands. The real numbers have one source
                 (content/system.generated.json) and this is not it. -->
            <span class="chat__trace-result">&rarr; token, value and component counts</span>
            <span class="chat__trace-ms mono">1ms</span>
          </li>
        </ol>
      </details>
      <p class="chat__state mono" role="status" aria-live="polite">
        <span class="chat__cell"></span><span class="chat__cell"></span>
        <span class="chat__cell"></span><span class="chat__cell"></span>
        <span class="chat__state-label">Composing the answer&hellip;</span>
      </p>`
        )
    ),
};

/* ---------- 4. Not on file ----------
   The most important answer this system produces. Phase 1 measured that
   raw BM25 answers "did he work at Google?" with a confident ranked list,
   because "Google" appears 8x in the corpus (Analytics, Play, AI Studio).
   The entity gate closes, no tool returns anything, and the answer is a
   single prose block with no sources — which is correct, not a failure. */
export const NotOnFile = {
  name: "Not on file (correct abstention)",
  render: () =>
    shell(
      turn("user", `<p class="chat__prose">Did he work at Google?</p>`) +
        turn(
          "assistant",
          `
      <div class="chat__answer">
        <p class="chat__prose">No — Google is not in the record. The roles on file are Green Street,
        Studio Kipo, Domestina, independent practice, Live to Lift and CNSys, and none of them is Google.</p>
      </div>`
        )
    ),
};

/* ---------- 5. Failure ---------- */
export const Unavailable = {
  name: "Unavailable (structured failure)",
  render: () =>
    shell(
      turn("user", `<p class="chat__prose">What has he shipped?</p>`) +
        turn(
          "assistant",
          `<p class="chat__error">The assistant is not configured on this deployment. Everything else on
      this page works &mdash; the case studies, the CV, and the eval results are all static.</p>`
        )
    ),
};

/* ---------- 5b. Stopped ----------
   The distinction this story exists to hold: a cancel is NOT the failure
   above it. Open this and Unavailable side by side — the note must read as
   chrome reporting what happened, the error as an alarm. A reader who
   pressed Stop being shown their own decision in an error box is the
   regression, and it is a visual one, so only a story catches it. */
export const Stopped = {
  name: "Stopped (neutral notice, not an error)",
  render: () =>
    shell(
      turn("user", `<p class="chat__prose">What has he shipped?</p>`) +
        turn(
          "assistant",
          `
      <div class="chat__answer">
        <p class="chat__prose">Across the record the shipped work splits into three kinds &mdash; a design
        system in production, two live consumer products, and this site itself.</p>
      </div>
      <p class="chat__note mono">Stopped. What had arrived is above.</p>`
        )
    ),
};

/* ---------- 6. THE REGRESSION GUARD ----------
   Twenty messages. This story exists for exactly one reason: to prove the
   thread does not size the band.

   `.rail { contain: size }` stops the RAILS feeding their squares back
   into the band's row height — the documented failure is a 420px band
   reaching 36,000px with thousands of squares in it
   (components/skeleton/spec.md). A growing message list is the same
   failure from the other side: an unbounded thread grows the WELL, the
   well grows the row, and every rail rebuild measures a height that keeps
   moving.

   `.chat__thread` therefore has a max-height and scrolls internally. Open
   this story and the band must be the SAME HEIGHT as the Empty story
   above. If it is taller, the bound has been removed and the regression
   is back. */
export const LongThread = {
  name: "20-message thread (rail regression guard)",
  render: () => {
    const questions = [
      "What has he shipped?",
      "Tell me about the design system work.",
      "What did he do at Domestina?",
      "Any accessibility experience?",
      "Where is he based?",
      "What does he use for prototyping?",
      "How many components are in this system?",
      "What was the Spetema project?",
      "Has he written production code?",
      "What did he do before tech?",
    ];
    const answers = [
      "Six case studies and eight further projects, across design systems, civic apps, marketplaces and analytics platforms.",
      "A Figma library at 1:1 parity with the coded components, plus custom Claude skills that read it.",
      "A multi-year, research-led engagement: front page, flows, onboarding and loyalty.",
      "WCAG 2.1 AA audits of two product surfaces, with a severity-rated remediation roadmap.",
      "Sofia, Bulgaria — that is a structured profile field, not something search could find.",
      "Figma for the library, and real code for anything that has to survive contact with production.",
      "The system reports its own numbers rather than asserting them; the trace above shows the call.",
      "A 200+ product coffee catalogue reconciling B2C e-commerce and B2B corporate needs on one site.",
      "Yes — production PRs, written and shipped, reviewed and merged by engineering.",
      "Eleven years running a training practice as service designer and team lead.",
    ];

    const thread = questions
      .map(
        (q, i) =>
          turn("user", `<p class="chat__prose">${q}</p>`) +
          turn(
            "assistant",
            `<div class="chat__answer"><p class="chat__prose">${answers[i]}</p></div>`
          )
      )
      .join("");

    return shell(
      thread,
      `<p class="chat__status mono">20 messages &mdash; the band must be the same height as the Empty story.</p>`
    );
  },
};
