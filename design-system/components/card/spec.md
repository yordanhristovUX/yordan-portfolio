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
  <article class="card">
    <!-- optional. alt="" + aria-hidden: the title below says everything the
         image does, and an alt repeating it reads every project twice. -->
    <span class="card__media">
      <img src="content/assets/notable/spetema.svg" alt="" aria-hidden="true"
           width="640" height="400" loading="lazy" decoding="async">
    </span>
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

`--chrome-border`, `--chrome-grid`, `--chrome-label`, `--content-primary`, `--font-display`,
`--font-mono`, `--primary`, `--rule`, `--text-2xs`, `--text-md`, `--text-sub`, `--pad`,
`--space-3`, `--space-4`, `--space-flow`

`--chrome-grid` is the ground under `.card__media` and `--chrome-border` its hairline. The
tint is invisible while the plates are the generated placeholders — those *are* graph paper —
and becomes the ground a real photograph sits on, so the window still reads as part of the
sheet rather than as a hole in it.

## A11y

Card titles are `<h3>` inside a section with an `<h2>` head — keep the heading order.

## AI notes

- Choose ONE of eyebrow (`.card__type`) or rule (`--ruled`) per grid, not both, and keep it
  consistent across all cards in that grid.
- Body copy: one paragraph, ~25 words max. Cards are index entries, not articles.
