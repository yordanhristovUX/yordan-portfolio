---
{
  "id": "drawer",
  "status": "stable",
  "since": "phase-3",
  "a11y": "role=dialog aria-modal=true labelled by its title; the focus trap, Escape and focus restore are mandatory, and the opener carries aria-expanded."
}
---

# Drawer (slide-in panel)

A right-hand panel that slides over the page with a scrim behind it, summoned from the nav
bar. It **hosts** a surface; it is not one. Today it carries Chat — every class in
`components/chat/spec.md` works unchanged inside it, and the drawer contributes only a
frame, a portrait, a title and a way out.

It exists because the assistant was section `06` of the homepage: something you scrolled
past, reachable only by scrolling, and invisible to anyone who read the top of the page and
left. The audit called that the single weakest thing about the site — the most
differentiating work in the repo had no entry point. A drawer is the smallest change that
turns "a section you may reach" into "a control you can press from anywhere".

## Why this is not a Chat variant

The first paragraph of `components/chat/spec.md` says chat "is a **section of the page**,
not a widget floating over it — it lives inside a `.band`/`.well` and obeys the skeleton's
rules like everything else." Putting `position: fixed` and a scrim inside the chat block
would make that sentence false, and `@component` ownership is per CSS **block**, so
`dist/components.json` would then report `chat` as owning a z-index and a backdrop. The
frame and the conversation are two things; the drawer is the generic one.

## Pattern

Two pieces, in two places. The opener is a segment of the existing nav bar — no new
component, no new button style:

```html
<button class="bar__action mono" type="button"
        data-drawer-open="ask-panel" aria-controls="ask-panel" aria-expanded="false">Ask</button>
```

The panel is the **last child of `<body>`**, after the footer and after the case dialog, so
that no ancestor can trap it in a stacking context:

```html
<div class="drawer" id="ask-panel" data-drawer>
  <div class="drawer__scrim" data-drawer-close></div>
  <aside class="drawer__sheet" role="dialog" aria-modal="true"
         aria-labelledby="drawer-title" tabindex="-1">
    <header class="drawer__head">
      <span class="drawer__portrait">
        <img src="design-system/assets/avatar.svg" alt="" width="80" height="80" decoding="async">
      </span>
      <span class="drawer__heading">
        <h2 class="drawer__title" id="drawer-title">Ask</h2>
        <p class="drawer__note">Answers are built from the same source as this page</p>
      </span>
      <button class="btn btn--small" type="button" data-drawer-close
              aria-label="Close the assistant">Close ✕</button>
    </header>
    <div class="drawer__body">
      <div class="chat" data-chat data-chat-endpoint="/api/chat">
        <!-- exactly the chat from components/chat/spec.md, unchanged -->
      </div>
    </div>
  </aside>
</div>
```

`js/chat.js` binds to `document.querySelector("[data-chat]")` — **one** instance per
document. Moving the assistant into the drawer means removing the `#ask` section, not
duplicating the composer into both.

## Elements

| Class | Role |
| --- | --- |
| `.drawer` | The fixed layer. Carries `data-drawer` (the JS hook) and `data-open` (the state) |
| `.drawer__scrim` | The veil. Any `[data-drawer-close]` closes |
| `.drawer__sheet` | The panel: `min(46rem, 100%)`, paper, a hairline left edge. `tabindex="-1"` so it can take focus |
| `.drawer__head` | Portrait / heading / Close, in one row. Always visible — it is row 1 of the sheet grid |
| `.drawer__portrait` | The plate the face illustration is printed on. See below |
| `.drawer__heading` | Title + note. `min-width: 0`, so a long note never pushes Close off the row |
| `.drawer__title` | The `<h2>` that `aria-labelledby` points at |
| `.drawer__note` | One line of chrome under the title. Hidden below 560px, exactly as `.sec__note` is below 640px |
| `.drawer__body` | The frame the hosted surface lives in. **Does not scroll** — see below |

## Geometry, measured

| Viewport | Sheet | Reading column | Notes |
| --- | --- | --- | --- |
| 375px | 375 × viewport, at x = 0 | 335px | full width; `.drawer__note` hidden |
| 768px | 768 × viewport, at x = 0 | 728px | full width |
| 1024px | 1024 × viewport, at x = 0 | 984px | last full-width step |
| 1025px | 736 × viewport, at x = 289 | 696px | the panel proper begins |
| 1280px | 736 × viewport, at x = 544 | 696px | prose measure 604px |
| 1440px | 736 × viewport, at x = 704 | 696px | unchanged from 1025 up |

**46rem is a reading measure, not a proportion of the window.** The answers were arriving
in a 431px column and were called unreadable. 736px less the body's inset leaves 696px, and
the site's own `.chat__prose` cap (44rem) then does the rest — the drawer is deliberately
*narrower* than the page's own prose column rather than wider than its own.

**Below 1025px it is the whole screen.** At 1024 a 736px panel would leave a 288px sliver
of page, which reads as a mistake rather than as context, and every component an answer
renders already switches to its narrow layout at that width. The rule is `100%`, not
`100vw`: `100vw` counts the scrollbar and overhangs by its width in the frame before the
body scroll lock takes effect.

**Both grid tracks of the sheet are `minmax(0, …)` and that is load-bearing.** A grid
track's automatic minimum is min-content, so one unbreakable display-cased project name
inside an answer sizes the column, the column sizes the sheet, and the sheet overflows a
panel with an explicit width. Measured at 375px before the fix: the Close button was pushed
off the screen and every turn ran past the right edge. It is the same failure, and the same
one-line fix, as `.sec__title { min-width: 0 }`.

## The body is a frame, not a scroller

`.drawer__body` is `overflow: hidden`. The surface inside owns its own scrolling, which is
what keeps chat's defining property intact: **the thread is the bounded scroller and the
composer stays pinned.** A scrolling body would take the composer with it, and the newest
turn would scroll under the fold with it.

Three rules relax bounds the page needed and the drawer supplies structurally:

- `.chat__thread`'s `max-height: min(46rem, 75vh)` exists so a growing conversation cannot
  stretch the band it sits in. Here the sheet is `top: 0; bottom: 0` on a fixed layer, so
  its height **is** the viewport and the thread cannot move it whatever it contains. The
  bound is already structural; keeping the max-height as well would leave the composer
  floating in the middle of a tall panel.
- `.chat` becomes `grid-template-rows: minmax(0, 1fr)` + `grid-auto-rows: auto`, so the
  thread takes the slack and the composer, suggestions and status sit under it.
- `.chat__thread:empty` un-collapses. On the page an empty thread hides so the composer is
  not preceded by an empty box; here that row is the flexible one, and collapsing it would
  let the composer stretch to the full height on first open.

**The a11y properties fixed in Wave 0 all survive, and none of them is the drawer's to
break:** the composer is still `aria-disabled` + `readOnly` and never `disabled`, so focus
survives a request; `js/chat.js` still anchors to the **top of the newest turn** by
adjusting `thread.scrollTop`, and the thread is still the scroller it measures against;
sources are still a `<details>`; `.chat__status` is still the only live region announcing
(`.chat__state` is decoration); and the send button still becomes a visible **Stop**.

## Hosting the page's own components

`js/answer-render.js` renders answers as real `.idx__row`s, `.entry`s and `.profile`s, and
every one of those switches to a narrow layout at a **viewport** breakpoint — which says
nothing about the 736px column they are actually in when a 1440px window has a drawer open.
The block restates the narrow layout unconditionally inside `.drawer` for the three
components whose wide layout actually breaks at this width. These are the rules a container
query would replace; when the skeleton grows `container-type`, delete them.

## The portrait

`design-system/assets/avatar.svg` — the repo owner's own illustration, 408 paths in an
`80 80` viewBox, served as an `<img src>` and never inlined (160 KB of path data in every
page is worse than one cached request).

It is a derivative of `content/assets/avatar.svg`, which is untouched, and the derivation is
exactly two edits: the root `width`/`height` are dropped so CSS sizes it from the `viewBox`,
and the **first subpath of the first path** — the dark rounded tile the figure was drawn on
— is removed. Not the whole path: that path also carries six sub-pixel detail fragments
after the tile's `Z`, and all 408 paths and every mark survive. The 408 paths are not to be
touched.

**The plate is the whole point of `--surface-portrait`.** The portrait is dark line-art over
light fills. On the light theme it needs no help; on the dark one the ink collapses and the
fills take over, so the hair and the jacket disappear and a face is left floating. Measured,
on `--surface-page`:

| Portrait fill | On the plate (light / dark) | With no plate, on a dark page |
| --- | --- | --- |
| `#020303` outline | 19.77:1 / 18.93:1 | 1.09:1 |
| `#2F3031` line-art | 12.66:1 / 12.12:1 | 1.32:1 |
| `#09128F` collar | 13.45:1 / 12.88:1 | 1.24:1 |
| `#DDDCDE` dominant fill | 1.31:1 / 1.25:1 | 12.80:1 |

So the plate stays light in **both** themes, which reads as a printed portrait card lying on
a dark page — the same "object on the sheet" language as the nav bar's drop shadow. It is
stone-100 in dark rather than stone-50 because at 3.5rem on near-black the brightest paper
in the ramp is a light source rather than a card. **Do not reach for `filter: invert()`:** it
makes an uncanny negative of a human face and turns his blue collar orange.

3.5rem, and not smaller, because 408 paths in an 80-unit box put every feature under a pixel
by 40px. That is also why the portrait is **not** in the nav bar: at 18px it is a smudge, and
the bar has no room for it either (see the bar cost below).

`alt=""`. The heading beside it carries the meaning and the illustration is chrome; if the
title ever stops naming what this panel is, the alt should carry it instead.

## What the nav segment costs

The opener is a `.bar__action`, the segment `components/nav/spec.md` already defines for "a
button that acts on the page, styled as a nav cell". It measures **64.0px** with the word
"Ask" in it and 40.0px at the tightened padding below 600px. Both reveal points in the bar
were re-derived rather than inherited, so the bar's worst-case share of the well goes from
83.6% to **81.8%** — it is proportionally better with the segment than it was without.
Numbers and the 375px arithmetic: `components/nav/spec.md`.

## Tokens

`--chrome-bg`, `--chrome-border-strong`, `--chrome-label`, `--content-primary`,
`--font-display`, `--font-mono`, `--rule-strong`, `--scrim`, `--surface-page`,
`--surface-portrait`, `--text-2xs`, `--text-sub`, `--space-1`, `--space-3`, `--space-4`,
`--space-5`

No `prefers-color-scheme` anywhere in this block, and no colour in any `@media print`. The
plate's refusal to invert is a `dark` value in `tokens.json`, which is the only place that
judgement can live.

The drawer is hidden on paper by a layout rule in each page stylesheet
(`css/style.css`, `css/cv.css`, `css/mcp.css`, `css/evals.css`). A fixed overlay printed is
printed once, at the top of sheet one, over whatever was there.

## Behaviour (site JS contract)

**The drawer is presentation only. JS toggles exactly one attribute and never writes a
style.**

| What | Where | When |
| --- | --- | --- |
| `data-open` | on `.drawer` | added on open, removed on close. This is the entire visual state |
| `aria-expanded` | on `[data-drawer-open]` | mirrors `data-open`. The bar styles `[aria-expanded="true"]`, so the highlight cannot drift from the announcement |
| `is-locked` | on `<body>` | while open. The class already exists in the foundation; the dialog uses it too |
| focus | `.drawer__sheet` | focused on open; returned to the opener on close |

Everything else is the a11y contract, and none of it is optional: **Tab is trapped inside
the sheet while open, `Escape` closes, and a click on `[data-drawer-close]` — which includes
the scrim — closes.** Focus restore matters more here than in the case dialog: the opener is
in a fixed bar, so a lost focus lands the reader at the top of a ~9000px document.

`js/chat.js` already calls `window.rebuildCaseSquares?.()` after appending. Opening the
drawer changes no band's height — it is a fixed layer outside `.sheet` — so it needs no
rail rebuild of its own.

## A11y

- `role="dialog" aria-modal="true"` on `.drawer__sheet`, labelled by `.drawer__title`.
- Closed is `visibility: hidden`, not a JS-written style. That removes the panel from the
  tab order **and** the accessibility tree, and it is animatable, so the close transition
  is not cut off at frame one. It is the reason no `hidden` attribute is needed.
- **Reduced motion: the panel does not travel.** The transitions are dropped in the
  reduced-motion block; the sheet still starts off-screen and still ends in place, it simply
  arrives in one frame. The visibility delay goes with them, or the layer would linger for
  280ms after a close with nothing moving to explain the wait.
- The opener is a real `<button type="button">` with `aria-controls` and `aria-expanded`,
  not a link to an anchor. There is no `#ask` section to link to any more.

## AI notes

- The drawer is a **frame**. Do not put chat-specific rules in this block, and do not put
  drawer rules in the chat block.
- Never more than one drawer per page, and never a second `[data-chat]`.
- `z-index: 400` sits between the bar (100) and the case dialog (500) on purpose: an answer
  renders real `.idx__row`s that call `window.openCase`, and the case study must land on top
  of the drawer that opened it.
- Do not give `.drawer__body` `overflow-y: auto` to "let it breathe". That unpins the
  composer and is the one change that would undo the reason this component exists.
