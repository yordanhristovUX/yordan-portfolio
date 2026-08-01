---
{
  "id": "chat",
  "status": "stable",
  "since": "phase-3",
  "a11y": "Thread is role=log aria-live=polite; the composer keeps focus while busy (aria-disabled + readOnly, never the disabled attribute)."
}
---

# Chat

The assistant surface: a turn list, a composer, a streaming state, and a collapsible tool
trace. It is a **surface, not a container**: it knows nothing about where it is mounted and
carries no `position`, no z-index and no backdrop of its own. Two hosts exist today —
a `.band`/`.well` on the page, where it obeys the skeleton's rules like everything else, and
`components/drawer/spec.md`, which slides it in over the page from the nav bar. The drawer
holds the frame; everything below is the same in both.

**A widget floating over the page is the drawer's job, never this block's.** Adding
`position: fixed` here is the change this paragraph exists to prevent.

The answer inside an assistant turn is not chat markup. It is **the site's own components**,
built from `content/dist/content.json` by `js/answer-render.js`: a project renders as the
real `.idx__row` and opens the real case dialog, a role renders as the real `.entry`. Chat
owns the conversation chrome; it owns none of the answer.

## Pattern

```html
<section class="band sec" id="ask">
  <header class="sec__head">
    <h2 class="sec__title t-title">Ask</h2>
    <span class="sec__note">Answers are built from the same source as the page</span>
  </header>
  <div class="well">
    <div class="chat" data-chat>
      <div class="chat__thread" tabindex="0" role="log" aria-live="polite" aria-label="Conversation">

        <article class="chat__turn chat__turn--user">
          <p class="chat__role t-label">You</p>
          <div class="chat__body">
            <p class="chat__prose">What did he do at Green Street?</p>
          </div>
        </article>

        <article class="chat__turn chat__turn--assistant">
          <p class="chat__role t-label">Assistant</p>
          <div class="chat__body">
            <details class="chat__trace">
              <summary class="chat__trace-toggle mono">2 tool calls</summary>
              <ol class="chat__trace-list">
                <li class="chat__trace-row">
                  <code class="chat__trace-name">get_project</code>
                  <span class="chat__trace-args">id: greenstreet-ds</span>
                  <span class="chat__trace-result">→ 6 sections, 7 chunks</span>
                  <span class="chat__trace-ms mono">1ms</span>
                </li>
              </ol>
            </details>
            <div class="chat__answer">
              <p class="chat__prose">One paragraph of connective prose.</p>
              <p class="chat__why">Why this project answers the question.</p>
              <!-- .idx__row · .entry · .profile · .stat · .chips · .link-grid · .ph · .sources -->
            </div>
          </div>
        </article>

      </div>

      <form class="chat__form">
        <textarea class="chat__input" rows="2" maxlength="1000"
                  placeholder="Ask about the work, the roles, or this design system"
                  aria-label="Ask a question"></textarea>
        <button class="btn btn--solid chat__send" type="submit">Ask →</button>
      </form>

      <div class="chat__suggest">
        <button class="btn btn--small" type="button" data-chat-ask="What has he shipped?">What has he shipped?</button>
      </div>
      <p class="chat__status mono"></p>
    </div>
  </div>
</section>
```

Streaming state, replacing nothing — appended to `.chat__body` while the loop runs and
removed when it ends:

```html
<p class="chat__state mono" role="status" aria-live="polite">
  <span class="chat__cell"></span><span class="chat__cell"></span>
  <span class="chat__cell"></span><span class="chat__cell"></span>
  <span class="chat__state-label">Reading the corpus…</span>
</p>
```

The three answer parts the table below names and this fence did not show. A metric is a
`.stat` with a label beside it; an error is framed because something went wrong and the
frame is the alarm; a note is the surface reporting what it did, and is deliberately not
framed — a reader who pressed Stop must not be shown their own decision dressed as a
failure. All three sit inside `.chat__answer`:

```html
<p class="chat__metric"><span class="stat">31%</span> faster first contentful paint</p>
<p class="chat__error">The corpus is unavailable right now.</p>
<p class="chat__note">Stopped.</p>
```

## Elements

| Class | Role |
| --- | --- |
| `.chat` | Grid wrapper. Carries `data-chat` — the hook `js/chat.js` binds to |
| `.chat__thread` | The turn list. **Bounded height, scrolls internally** — see below |
| `.chat__turn` (`--user` / `--assistant`) | One turn. User turns sit on `--surface-raised` |
| `.chat__role` | `t-label` speaker tag; accent on the assistant side |
| `.chat__body` | Everything the turn contains, in source order |
| `.chat__answer` | The rendered block list — design-system components, not chat markup |
| `.chat__prose` | The ONLY model-authored text. Written with `textContent`, never `innerHTML` |
| `.chat__why` | One model-authored clause annotating a project row |
| `.chat__metric` | Wraps a `.stat` plus its label inline |
| `.chat__state` + `.chat__cell` | Streaming indicator — four cells from the automata's vocabulary |
| `.chat__trace` / `--toggle` / `--list` / `--row` | Collapsible tool trace (`<details>`). **Open while the answer streams, collapsed on completion** |
| `.chat__form` / `.chat__input` / `.chat__send` | Composer. Textarea + Button — no new button styles |
| `.chat__suggest` | Seed questions. Buttons, not Chips (chips are display-only) |
| `.chat__error` | Structured failure text. Never a stack trace |
| `.chat__note` | A neutral notice — "Stopped.", or a deadline reached with partial content already on screen. **Not** an error and never styled as one |

## The thread must not size the band

A rail can no longer feed its cells back into the band's row height — they are pixels on a
canvas that is out of flow, so the loop is unbuildable (`components/skeleton/spec.md` keeps
the record: the documented failure was a 420 px band reaching 36,000 px, and until the
canvas landed it was held off by `contain: size` alone). That fixes the rail. **A growing
message list is the same failure from the other side, and nothing structural fixes it**: the
well would grow without bound, the row would follow, and every rail would resize against a
height that keeps moving.

So `.chat__thread` carries `max-height: min(46rem, 75vh)` and `overflow-y: auto`. The band is
exactly as tall on message 20 as on message 1, and the page's node count stays flat because
no rail is ever rebuilt taller. `stories/chat.stories.js` has a 20-message story that exists
purely to keep this honest — if that story makes the band grow, the regression is back.

**Inside the drawer that max-height is released, and the property it protects is not.** The
drawer's sheet is `top: 0; bottom: 0` on a fixed layer, so its height *is* the viewport and
the thread cannot stretch anything whatever it contains — the bound is structural rather
than declared. Keeping the max-height there as well would leave the composer floating in the
middle of a tall panel. The three rules that do it live in the drawer's block, not this one;
they are listed in `components/drawer/spec.md`.

`js/chat.js` used to call a rebuild hook after appending, so the automata could re-measure a
grown thread. It does not any more, and the hook is gone: the drawer contains **0 automata
regions** — no rail, no strip, no canvas — so there was never anything inside it to rebuild.
The thread's bounded height is what keeps the layout still, and that is unchanged.

## Tokens

`--accent`, `--chrome-bg`, `--chrome-border`, `--chrome-border-strong`, `--chrome-label`,
`--chrome-label-strong`, `--content-body`, `--content-muted`, `--content-primary`,
`--font-mono`, `--primary-muted`, `--rule`, `--surface-page`, `--surface-raised`,
`--text-2xs`, `--text-md`, `--text-sm`, `--text-xs`, `--pad`, `--space-2`, `--space-3`,
`--space-4`, `--space-5`, `--tracking-wide`, `--tracking-wide-lg`, `--weight-semibold`

No `prefers-color-scheme` anywhere in this block. Every colour above flips through its own
`dark` value in `tokens.json`; the component does not know a theme exists.

## Behaviour (site JS contract — js/chat.js)

`POST /api/chat` with `{messages}`; the response is SSE. The server validates every block
through all three gates before emitting it, so complete block objects arrive as discrete
events and the client needs **SSE framing only** — buffer to a blank line, parse each event.
There is no streaming JSON parser here and there must never be one.

| Event | Effect |
| --- | --- |
| `meta` | Model and turn budget, for the trace |
| `turn` | Updates `.chat__state-label` |
| `trace` | Appends a `.chat__trace-row` the moment the tool ran — also the keep-alive |
| `block` | `window.AnswerRender.render()` → appended to `.chat__answer` |
| `notice` | Gate outcomes: dropped blocks, stripped sources |
| `error` | Renders `.chat__error`. Structured payload, never a stack trace |
| `done` | Ends the turn; `degraded` marks a "not on file" answer |

## A11y

- `.chat__thread` is `role="log" aria-live="polite"` — new turns are announced without
  stealing focus.
- `.chat__state` is `role="status" aria-live="polite"`; the label carries the meaning, the
  cells are decoration.
- The composer is a real `<form>` with a labelled `<textarea>`. Enter submits, Shift+Enter
  breaks the line.
- `.chat__trace` is a native `<details>`: keyboard-operable and announced as a disclosure
  with no ARIA of its own.
- **Nothing is ever `disabled` while a request is in flight.** Disabling the focused
  textarea drops focus to `<body>`, and re-enabling it does not put focus back — the reader
  asks a question, waits, and is silently returned to the top of a ~9000px document. So the
  composer carries `aria-disabled` + `readOnly` instead: it keeps focus, announces the busy
  state, and the guard in `js/chat.js` is what actually prevents a second submit.
  `.chat__input[aria-disabled="true"]` is the visible half of that, and matters *more* than
  a `:disabled` style would, because the field still looks focusable.
- The submit button is not disabled either — while a request is in flight it becomes a
  **Stop** control. A ten-second wait with no way out is the real defect, and the control
  that is already focused and already the primary action is the cheapest honest place to put
  the way out: no new markup, no new tab stop.
- A stop or a cut-off renders `.chat__note`, never `.chat__error`. A user-initiated Stop is
  not a failure and must not be announced or styled as one.

## AI notes

- **Never render `prose` as HTML.** `textContent`, always. The schema stops the model
  emitting markup; this stops it mattering if that ever changed.
- Every non-prose block is an **id**, resolved against `content/dist/content.json` at render
  time. An id that does not resolve renders nothing — never a placeholder.
- Reuse `window.openCase` for project rows. Do not build a second dialog; the focus trap and
  the rail rebuild live in `js/main.js`.
- Do not put a background on `.chat__turn--assistant` — the well is already paper, and a
  second tint makes the answer read as quoted rather than as the page's own content.
- Print is a *layout* rule and lives in the page stylesheets: the chat surface and the
  drawer that may be carrying it are both hidden on paper. Never put a print colour here.
- `js/chat.js` binds to `document.querySelector("[data-chat]")` — **one** instance per
  document. Moving the assistant into the drawer means removing the section, not rendering a
  second composer into both.
