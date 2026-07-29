export default { title: "Components/Drawer" };

/* The slide-in panel that hosts the assistant. On the site it is toggled by a
   single attribute — `data-open` on `.drawer` — and nothing else; these stories
   set that attribute in the markup so the open state can be reviewed without
   any JS at all. That is the point of the component: everything visual is a
   function of one attribute, so the animation, the tab order and the
   accessibility tree cannot disagree with each other.

   `.drawer` is `position: fixed`, so in Storybook it fills the preview iframe
   rather than a story box. That is the real geometry: resize the canvas and the
   panel is the whole screen below 1025px and 46rem above it. */

const answer = `
  <details class="chat__trace">
    <summary class="chat__trace-toggle mono">2 tool calls</summary>
    <ol class="chat__trace-list">
      <li class="chat__trace-row">
        <code class="chat__trace-name">search_content</code>
        <span class="chat__trace-args">query: shipped work</span>
        <span class="chat__trace-result">&rarr; 8 chunks</span>
        <span class="chat__trace-ms mono">1ms</span>
      </li>
      <li class="chat__trace-row">
        <code class="chat__trace-name">get_project</code>
        <span class="chat__trace-args">id: greenstreet-audit</span>
        <span class="chat__trace-result">&rarr; 6 sections, 7 chunks</span>
        <span class="chat__trace-ms mono">2ms</span>
      </li>
    </ol>
  </details>
  <div class="chat__answer">
    <p class="chat__prose">Four projects are on file. Two of them are the ones you are asking
      about &mdash; a design-system engagement and a pair of WCAG 2.1 AA audits &mdash; and both
      were shipped rather than proposed.</p>
    <ul class="idx">
      <li>
        <a class="idx__row" href="#">
          <span class="idx__no mono">02</span>
          <span class="idx__main">
            <span class="idx__name">AI-ready design systems and Agentic workflows</span>
            <span class="idx__desc">~35 components at 1:1 Figma-to-code parity, 100% token coverage, custom Claude skills.</span>
          </span>
          <span class="idx__tags chips"><span class="chip">Design Systems</span><span class="chip">AI</span></span>
          <span class="idx__go">Open &rarr;</span>
        </a>
      </li>
      <li>
        <a class="idx__row" href="#">
          <span class="idx__no mono">03</span>
          <span class="idx__main">
            <span class="idx__name">UX &amp; Accessibility Audits</span>
            <span class="idx__desc">WCAG 2.1 AA audits of two product surfaces &mdash; editorial and data-dense analytics.</span>
          </span>
          <span class="idx__tags chips"><span class="chip">WCAG</span></span>
          <span class="idx__go">Open &rarr;</span>
        </a>
      </li>
    </ul>
    <p class="chat__why">This project answers the accessibility half of the question directly.</p>
    <div class="entry">
      <p class="entry__role">Senior Product Designer</p>
      <p class="entry__span mono">2026 &mdash;</p>
      <p class="entry__org">Green Street <em>&mdash; CRE news, research data and analytics</em></p>
      <ul class="entry__list">
        <li>Shipped production navigation, <strong>reviewed and merged by engineering</strong>.</li>
        <li>200+ issue instances catalogued with severity ratings.</li>
      </ul>
    </div>
    <div class="sources">
      <p class="sources__title">Sources</p>
      <ol class="sources__list">
        <li class="source">
          <span class="source__ref">1</span>
          <a class="source__link" href="#">Green Street &mdash; UX &amp; Accessibility Audits</a>
          <span class="source__id mono">greenstreet-audit#outcome</span>
        </li>
      </ol>
    </div>
  </div>`;

const turn = (who, body) => `
  <article class="chat__turn chat__turn--${who}">
    <p class="chat__role t-label">${who === "user" ? "You" : "Assistant"}</p>
    <div class="chat__body">${body}</div>
  </article>`;

/* The canonical panel from components/drawer/spec.md. `open` is the only
   difference between the closed and open renderings anywhere in this file. */
const drawer = (thread, open = true) => `
  <div class="drawer" id="ask-panel" data-drawer${open ? " data-open" : ""}>
    <div class="drawer__scrim" data-drawer-close></div>
    <aside class="drawer__sheet" role="dialog" aria-modal="true"
           aria-labelledby="drawer-title" tabindex="-1">
      <header class="drawer__head">
        <span class="drawer__portrait">
          <img src="../assets/avatar.svg" alt="" width="80" height="80" decoding="async">
        </span>
        <span class="drawer__heading">
          <h2 class="drawer__title" id="drawer-title">Ask</h2>
          <p class="drawer__note">Answers are built from the same source as this page</p>
        </span>
        <button class="btn btn--small" type="button" data-drawer-close
                aria-label="Close the assistant">Close &#10005;</button>
      </header>
      <div class="drawer__body">
        <div class="chat">
          <div class="chat__thread" role="log" aria-live="polite" aria-label="Conversation">${thread}</div>
          <form class="chat__form" onsubmit="return false">
            <textarea class="chat__input" rows="2" maxlength="1000"
              placeholder="Ask about the work, the roles, or this design system"
              aria-label="Ask a question"></textarea>
            <button class="btn btn--solid chat__send" type="submit">Ask &rarr;</button>
          </form>
          <div class="chat__suggest">
            <button class="btn btn--small" type="button">What has he shipped?</button>
            <button class="btn btn--small" type="button">Accessibility work?</button>
          </div>
          <p class="chat__status mono">Every answer is built from Yordan's own written record,
            cited to the passage it came from &mdash; or it says so.</p>
        </div>
      </div>
    </aside>
  </div>`;

/* A page behind the panel, so the scrim has something to veil and the bar
   segment has somewhere to live. */
const page = (expanded) => `
  <header class="bar" style="position:absolute">
    <a class="bar__id" href="#">Yordan Hristov</a>
    <nav class="bar__nav" aria-label="Primary">
      <a href="#">Work</a><a href="#">About</a><a href="#">Contact</a>
    </nav>
    <button class="bar__action mono" type="button" data-drawer-open="ask-panel"
            aria-controls="ask-panel" aria-expanded="${expanded}">Ask</button>
    <button class="theme mono" data-theme-toggle data-state="auto" aria-label="Theme: auto.">
      <span class="theme__lamp" aria-hidden="true"></span>
      <span class="theme__label">Auto</span>
    </button>
  </header>
  <main class="sheet">
    <section class="band sec">
      <header class="sec__head">
        <span class="sec__no mono">02</span>
        <h2 class="sec__title t-title">Work</h2>
      </header>
      <div class="well"><p class="t-lead">The page the panel is summoned over.</p></div>
    </section>
  </main>`;

/* ---------- 1. Open, with an answer in it ----------
   The whole reason the component exists: the answer is the SITE'S own
   components, and at 46rem they render as themselves rather than as a
   narrow imitation. */
export const Open = {
  name: "Open (an answer)",
  render: () =>
    `<div style="position:relative;min-height:44rem">${page("true")}${drawer(
      turn("user", `<p class="chat__prose">What has he shipped, and what did the accessibility work involve?</p>`) +
        turn("assistant", answer)
    )}</div>`,
};

/* ---------- 2. First open ----------
   An empty thread is the state that proves `.drawer__body` is a frame and not
   a scroller: the composer must sit at the BOTTOM of the panel, not float in
   the middle of it. On the page `.chat__thread:empty` collapses; in the drawer
   that row is the flexible one, so the block un-collapses it. */
export const FirstOpen = {
  name: "Open (empty thread)",
  render: () => `<div style="position:relative;min-height:44rem">${page("true")}${drawer("")}</div>`,
};

/* ---------- 3. Closed ----------
   Nothing is visible except the bar, which is the assertion: `visibility:
   hidden` takes the panel out of the tab order and the accessibility tree, so
   there is no `hidden` attribute for JS to forget. Tab through this story —
   focus goes identity, links, Ask, toggle, and never enters the panel. */
export const Closed = {
  name: "Closed (the segment only)",
  render: () =>
    `<div style="position:relative;min-height:14rem">${page("false")}${drawer(
      turn("user", `<p class="chat__prose">You should not be able to reach this.</p>`),
      false
    )}</div>`,
};
