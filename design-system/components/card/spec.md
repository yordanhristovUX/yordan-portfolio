---
{
  "id": "card",
  "status": "stable",
  "since": "initial",
  "a11y": "Titles are <h3> inside a section headed by <h2> — the heading order is the contract."
}
---

# Card

Bordered content cell for grids of parallel items (capabilities, project summaries).
One card component serves every card grid on the site — do not invent section-specific cards.

## Pattern

```html
<div class="card-grid">
  <!-- A REVEAL card: eyebrow and title at rest, image and note on hover. -->
  <article class="card card--reveal">
    <!-- alt="" + aria-hidden: the title says everything the image does, and an
         alt repeating it reads every project twice. -->
    <span class="card__media">
      <img src="content/assets/notable/spetema.svg" alt="" aria-hidden="true"
           width="640" height="400" loading="lazy" decoding="async">
    </span>
    <span class="card__type">Fintech</span>
    <h3 class="card__title">Payment / Crypto / Stocks</h3>
    <p class="card__note">Full IA for a unified platform…</p>
    <!-- The touch trigger, authored here and only WIRED by js/peek.js. CSS hides
         it where the cursor panel serves instead. -->
    <button class="card__more" type="button" aria-haspopup="dialog" data-card-more>Tap for details</button>
  </article>

  <!-- A PLAIN card: body is always visible, no media, no reveal. -->
  <article class="card">
    <span class="card__type">Fintech</span>
    <h3 class="card__title">Payment / Crypto / Stocks</h3>
    <p>Full IA for a unified platform…</p>
  </article>
  <article class="card card--ruled">
    <h3 class="card__title">Platform-scale UX</h3>
    <p>Whole product surfaces…</p>
  </article>
</div>
```

### The two detail surfaces, canonically

Both are part of this component and neither lives inside a card. **The sheet** is authored
once per page, beside the drawer; **the panel** is built by `js/peek.js` and exists in no
markup at all. They are canonical here because they are the pattern — a page that writes
either one differently is writing a different component.

```html
<!-- THE PEEK SHEET (touch) — authored once, beside the drawer in index.html.
     js/peek.js populates it from the tapped card and toggles data-open. -->
<div class="peek-sheet" data-peek-sheet>
  <div class="peek-sheet__scrim" data-sheet-close></div>
  <div class="peek-sheet__panel" role="dialog" aria-modal="true" tabindex="-1">
    <div class="peek-sheet__head">
      <span class="peek-sheet__title"></span>
      <button class="peek-sheet__close" type="button" data-sheet-close>Close</button>
    </div>
    <div class="peek-sheet__body">
      <span class="peek-sheet__frame"><img alt="" decoding="async" hidden></span>
      <p class="peek-sheet__note"></p>
    </div>
  </div>
</div>
```

```html
<!-- THE PEEK PANEL (fine pointer) — one per page, built by js/peek.js and
     appended to <body>. Without that file there is no panel and the card
     shows nothing extra, which is the whole fallback. -->
<div class="peek" aria-hidden="true" hidden>
  <span class="peek__frame"><img alt="" decoding="async"></span>
  <p class="peek__text"></p>
</div>
```

## Variants

| Class | Use |
| --- | --- |
| `.card` | Base cell; optional `.card__type` eyebrow above the title |
| `.card--ruled` | 3px ink rule above the title (capability/emphasis cards) |
| `.card__more` | The touch trigger, **authored in the card's markup by the content build** — a quiet underlined link in the card's corner. Real `<button>`, `aria-haspopup="dialog"`, `data-card-more`; CSS hides it on fine pointers; a tap anywhere on the card delegates to it |
| `.peek-sheet` (+`__scrim`, `__panel`, `__head`, `__title`, `__close`, `__body`, `__frame`, `__note`) | The bottom sheet the trigger opens — authored once in `index.html` beside the drawer, populated by `js/peek.js` |
| `.card-grid` | 3 → 2 → 1 column responsive grid with hairline dividers |

The grid's dividers are computed from position, so any card count works: the last card and
every card on the final row drop the rules that would otherwise trail into empty space.

## Tokens

`--accent`, `--chrome-bg`, `--chrome-border`, `--chrome-border-strong`, `--chrome-grid`,
`--chrome-label`, `--chrome-label-strong`, `--content-body`, `--content-inverse`,
`--content-primary`, `--font-display`, `--font-mono`, `--primary`, `--rule`, `--rule-strong`,
`--scrim`, `--shadow-drop`, `--surface-page`, `--surface-raised`, `--text-2xs`,
`--text-base`, `--text-md`, `--text-sm`, `--text-sub`, `--text-xs`, `--pad`, `--space-2`,
`--space-3`, `--space-4`, `--space-5`, `--space-6`, `--space-flow`, `--tracking-wide-lg`,
`--tracking-wide-sm`, `--tracking-wide-xl`, `--weight-extrabold`, `--width-body`

The `--scrim`/`--surface-page`/`--chrome-bg` group belongs to the peek sheet — a real
overlay wears the same dress every other overlay here wears, which is why a card component
suddenly consumes chrome and scrim tokens.

`--surface-raised` and `--shadow-drop` belong to `.peek`, the panel that rides the pointer:
raised paper with the same drop shadow the floating nav uses, because it is the same idea —
an object lying **on** the sheet rather than a hole cut into it. `--space-6` is the lattice
cell, and a reveal card is six of them tall, so a card is a whole number of squares like
everything else here.

## The peek panel

A `.card--reveal` shows an eyebrow, a title and (on touch) its corner trigger — **nothing
else, at any width, on any input**. It still carries an image and a description; two
consumers read them out of the markup: the cursor panel on fine pointers, the peek sheet on
coarse ones. The grid stays a quiet list of names either way.

The card is six lattice cells tall everywhere and never changes size — one stated height,
no per-input override, which is both the owner's spec ("collapsed by default on mobile and
desktop") and what keeps nine cards one grid.

**One panel, not nine.** Nine absolutely-positioned previews would be nine boxes to keep off
the viewport edges and nine more elements under the cursor to confuse `pointerleave`. There is
exactly one, reused.

**`pointer-events: none` on the panel is load-bearing, not hygiene.** It sits in the cursor's
neighbourhood, so anything there that could receive a pointer event would come between the
reader and the card being described — it would swallow the `pointerleave` that dismisses it
and then flicker against its own presence.

**It flips rather than clamps at the viewport edge.** A panel pinned to the edge stops tracking
the pointer and reads as stuck; one that flips to the other side of the cursor keeps the
relationship the reader is using to understand what it belongs to.

### The content is in the card, not in the panel

Both the image and the note stay in the markup, in reading order, visually clipped rather
than display-hidden — `display: none` and `visibility: hidden` would both take them out of
the accessibility tree. One base rule, no media query: a screen reader gets the full
description on every device with no gesture to perform.

**Touch gets the peek *sheet*** — one reusable surface, authored in `index.html` beside the
drawer, populated from whichever card was tapped, arriving from the bottom edge. It is a
real dialog where the cursor panel is deliberately not one: focus moves in, Tab is trapped,
the background goes `inert`, and it closes on Escape, scrim tap or its Close segment
(close-on-scroll was rejected — dismissing a surface with the gesture used to read it is a
trap, and the page behind is locked anyway). The trigger is authored in the card and merely
*wired* by `js/peek.js` — **nothing is injected, so the page's geometry after scripts is
its geometry before them**, which is the invariant the lattice measurements depend on (the
injected first version slid every band below the cards off the grid; PROGRAMME-LOG has the
record).

**The traded fallback, stated honestly:** a sighted touch reader without JS sees the
collapsed card and a dead trigger. The content remains in the DOM, the accessibility tree
and reader mode; the *visual* detail view is the one thing that requires JS. The owner
chose this over the previous three-state cascade (fine-clip / coarse-expand / JS-collapse),
which was also the override soup the inspector complained about. The labels ("Tap for
details", "Close") are assistant-drafted chrome, flagged for the owner's rewording.

The image is `alt=""` and `aria-hidden` because the title already says what it says, and an
alt repeating it makes a screen reader read every project twice.

**The panel is not a dialog.** It takes no focus, traps nothing, and carries `aria-hidden` —
everything in it is already available elsewhere in the page.

## A11y

Card titles are `<h3>` inside a section with an `<h2>` head — keep the heading order.

## AI notes

- Choose ONE of eyebrow (`.card__type`) or rule (`--ruled`) per grid, not both, and keep it
  consistent across all cards in that grid.
- Body copy: one paragraph, ~25 words max. Cards are index entries, not articles.
