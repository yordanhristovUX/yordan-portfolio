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

## Variants

| Class | Use |
| --- | --- |
| `.card` | Base cell; optional `.card__type` eyebrow above the title |
| `.card--ruled` | 3px ink rule above the title (capability/emphasis cards) |
| `.card-grid` | 3 → 2 → 1 column responsive grid with hairline dividers |

The grid's dividers are computed from position, so any card count works: the last card and
every card on the final row drop the rules that would otherwise trail into empty space.

## Tokens

`--chrome-border`, `--chrome-grid`, `--chrome-label`, `--content-body`, `--content-primary`,
`--font-display`, `--font-mono`, `--primary`, `--rule`, `--shadow-drop`, `--surface-raised`,
`--text-2xs`, `--text-md`, `--text-sm`, `--text-sub`, `--pad`, `--space-3`, `--space-4`,
`--space-6`, `--space-flow`

`--surface-raised` and `--shadow-drop` belong to `.peek`, the panel that rides the pointer:
raised paper with the same drop shadow the floating nav uses, because it is the same idea —
an object lying **on** the sheet rather than a hole cut into it. `--space-6` is the lattice
cell, and a reveal card is six of them tall, so a card is a whole number of squares like
everything else here.

## The peek panel

A `.card--reveal` shows an eyebrow and a title and **nothing else, ever**. It still carries an
image and a description; `js/peek.js` reads them out and paints them into one panel that
follows the pointer, so the grid stays a quiet list of names and the detail arrives where the
reader is already looking.

The card is six lattice cells tall and never changes size, so nothing can reflow under the
pointer.

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

Both the image and the note stay in the markup, in reading order, and are removed *visually*
rather than hidden — `display: none` and `visibility: hidden` would both take them out of the
accessibility tree. So a screen reader gets the full description with no hover to perform, and
**`js/peek.js` is allowed to fail**: `@media (hover: none), (pointer: coarse)` shows the image
and the note in the card instead. That is also what a touch reader gets, because a card must
not withhold half of itself behind a gesture the device cannot perform.

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
