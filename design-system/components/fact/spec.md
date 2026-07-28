---
{
  "id": "fact",
  "status": "stable",
  "since": "initial",
  "a11y": "All three parts are required — a number with no label is unreadable; the counter degrades to plain text without JS or with reduced motion."
}
---

# Fact

Framed stat cells: big display number, mono title, one-line meaning. Facts must carry a
message — never decorative numbers.

## Pattern

```html
<div class="facts">
  <div class="fact">
    <span class="fact__num"><span data-count="42">0</span><small>km</small></span>
    <span class="fact__title">Endurance</span>
    <span class="fact__label">Marathon finisher. Multi-year engagements don't wear me down.</span>
  </div>
</div>
```

## Tokens

`--chrome-label-strong`, `--content-body`, `--content-muted`, `--content-primary`,
`--font-display`, `--font-mono`, `--rule`, `--rule-strong`, `--surface-page`, `--text-2xs`,
`--text-display`, `--text-sm`, `--text-unit`, `--space-1`, `--space-2`, `--space-6`

## Behaviour

`data-count="N"` → the site's GSAP counter clicks up in whole steps (odometer) on scroll.
Without JS (or with reduced motion) the number renders directly.

## AI notes

- Exactly three parts per fact: number, one-word title, one-sentence label tying the number
  to how the person works. A number without its "so what" is not allowed.
- 2–4 facts per group; each `<small>` unit stays inside `fact__num`.
