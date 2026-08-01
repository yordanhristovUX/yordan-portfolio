---
{
  "id": "link-grid",
  "status": "stable",
  "since": "initial",
  "a11y": "External links carry target=_blank rel=noopener and a trailing arrow; labels name the destination, never 'click here'."
}
---

# Link grid

Bordered grid of equal-weight links (contact channels). Cells flex-fill the row and
invert to ink on hover.

## Pattern

```html
<div class="link-grid">
  <a href="mailto:...">Email</a>
  <a href="tel:...">+359 ...</a>
  <a href="..." target="_blank" rel="noopener">LinkedIn ↗</a>
</div>
```

## Tokens

`--chrome-label-strong`, `--content-inverse`, `--font-mono`, `--primary`, `--rule`,
`--text-xs`, `--pad`, `--space-4`, `--tracking-wide`, `--weight-medium`

## A11y

External links: `target="_blank" rel="noopener"` and a trailing `↗`. Labels name the
destination, not "click here".

## AI notes

- 3–5 links; every cell equal weight — the primary contact action lives elsewhere
  (the big display link), not here.
