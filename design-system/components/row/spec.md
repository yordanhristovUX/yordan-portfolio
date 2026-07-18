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

`--font-display`, `--font-mono`, `--content-primary`, `--content-muted`, `--chrome-label`,
`--surface-raised`, `--primary`, `--rule`, `--pad`

## A11y

Project rows are `<button>`s (they open a dialog). `.idx__go` is decorative (`aria-hidden`) —
the whole row is the target. Hover/focus states share the same styles.

## AI notes

- Number project rows `01…` in order; numbers are set in markup, not CSS counters.
- `.idx__name` pattern is always `Client <em>— Project</em>`; the em half renders muted.
- Descriptions lead with the outcome where one exists ("bounce rate down 40%").
- Tags are Chips (see chip spec), 3 max per row.
