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

`--chrome-label`, `--content-body`, `--content-primary`, `--font-display`, `--font-mono`,
`--primary`, `--rule`, `--surface-page`, `--text-2xs`, `--text-md`, `--text-sm`, `--text-sub`,
`--pad`, `--space-3`, `--space-6`, `--space-flow`

`--surface-page` is the scrim over `.card__media`, at 0.88 — see "The reveal" below.
`--space-6` is the lattice cell, and a reveal card's `min-height` is nine of them, so a card is
a whole number of squares like everything else on the sheet and nine cards are one height
whatever their copy runs to.

## The reveal

`.card--reveal` is minimal at rest — eyebrow and title, nothing else — and uncovers an image
and a note on hover. Three things about how, because each is the difference between this
pattern and the version of it that ships broken:

- **Both are hidden by `opacity`, not by `display` or height.** The card's box therefore never
  changes size, so revealing one card cannot reflow the other eight. A grid that reshuffles
  under the pointer is the usual failure here, and it is why the reveal is a *substitution*
  rather than an expansion.
- **Opacity keeps them in the accessibility tree.** A screen reader gets the note at rest, in
  reading order, with no hover to perform and no `aria-hidden` to work around. The image is
  `alt=""` because the title already says what it says.
- **`@media (hover: none)` shows everything.** A touch reader has no hover to give, so the card
  does not withhold half of itself behind a gesture their device does not have.

`:focus-within` sits beside `:hover` throughout, so the affordance already exists for a
keyboard the moment these cards carry a link or a button.

**The scrim is a constraint on the images, not a decoration.** Type sits over the picture, so
the picture is held under a `--surface-page` wash at 0.88 and the text keeps its contrast
against paper rather than against whatever the photograph happens to be. The generated
placeholders are light graph paper, so today the wash is barely working. **A dark photograph
would need the wash raised** — the alternative, a colour decision per image, is precisely what
a system exists to avoid.

## A11y

Card titles are `<h3>` inside a section with an `<h2>` head — keep the heading order.

## AI notes

- Choose ONE of eyebrow (`.card__type`) or rule (`--ruled`) per grid, not both, and keep it
  consistent across all cards in that grid.
- Body copy: one paragraph, ~25 words max. Cards are index entries, not articles.
