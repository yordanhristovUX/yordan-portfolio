---
{
  "id": "row",
  "status": "stable",
  "since": "initial",
  "a11y": "Project rows are <button>s; .idx__go is aria-hidden because the whole row is the target."
}
---

# Row

Full-width list rows. Two members of the family:

**Project row** (`.idx__row`) — clickable index entry opening a case study.
**Definition row** (`.tools__row`) — term/definition pair (skills list).

## Pattern

```html
<ul class="idx" role="list">
  <li>
    <button class="idx__row" data-project="slug">
      <span class="idx__no mono">01</span>
      <span class="idx__main">
        <span class="idx__name">Client <em>— Project Name</em></span>
        <span class="idx__desc">One-sentence summary with the measurable result.</span>
      </span>
      <span class="idx__tags"><span class="chip">Tag</span></span>
      <span class="idx__go mono" aria-hidden="true">View →</span>
    </button>
  </li>
</ul>

<dl class="tools">
  <div class="tools__row">
    <dt>Design</dt>
    <dd>Figma, design systems, token systems…</dd>
  </div>
</dl>
```

## Tokens

`--chrome-border-strong`, `--chrome-label`, `--content-inverse`, `--content-muted`,
`--content-primary`, `--font-display`, `--font-mono`, `--primary`, `--rule`,
`--surface-raised`, `--text-base`, `--text-heading`, `--text-md`, `--text-sm`, `--text-sub`,
`--text-xs`, `--pad`, `--space-1`, `--space-2`, `--space-3`, `--space-4`, `--space-7`,
`--space-flow`, `--tracking-wide`, `--tracking-wide-lg`, `--weight-bold`,
`--weight-extrabold`, `--weight-semibold`, `--width-body`, `--width-normal`, `--width-sub`

`--text-sub` is `.idx__name`'s size below 900px. A project name cannot carry section-heading
level in a ~400px column — measured, it wrapped worse at 1280px than at 1024px, because the
name grew with the viewport while its grid track did not. Naming a token at a breakpoint is
the existing idiom for "a component changes level here"; `css/cv.css` does the same thing four
times.

## A11y

Project rows are `<button>`s (they open a dialog). `.idx__go` is decorative (`aria-hidden`) —
the whole row is the target. Hover/focus states share the same styles.

## AI notes

- Number project rows `01…` in order; numbers are set in markup, not CSS counters.
- `.idx__name` pattern is always `Client <em>— Project</em>`; the em half renders muted.
- Descriptions lead with the outcome where one exists ("bounce rate down 40%").
- Tags are Chips (see chip spec), 3 max per row.
