---
{
  "id": "project-row",
  "status": "stable",
  "since": "initial",
  "a11y": "Project rows are <button>s; .idx__go is aria-hidden because the whole row is the target."
}
---

# Project row

A full-width, clickable index entry that opens a case study. One of the two halves of what
used to be `row`; the other is `definition-row`, a term/definition pair. They shared a name
because both are full-width list rows and for no other reason — nothing in either block
referred to the other, and one component owning two banners meant `dist/components.json`
reported one class list for two unrelated things.

**This half stays authored, and the reason is one selector.** `.idx li:last-child .idx__row`
puts a positional in the *middle* of a descendant path — the `<li>` is the last child, and the
rule applies to the row inside it. Every relation the definition format admits is closed at
both ends: a scoped part names an ancestor rule and reaches bare tags or one class, and a
position is an enum applied to the rule it hangs off. Neither can say "a descendant of the
last sibling", and the key that could would be a selector with extra punctuation, which is the
wedge `PATTERNS.md` refuses. So the block carries
`/* ---- authored:project-row — relational-selectors ---- */` and the census checks that the
reason is still true.

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
```

## Tokens

`--chrome-border-strong`, `--chrome-label`, `--content-inverse`, `--content-muted`,
`--content-primary`, `--font-display`, `--font-mono`, `--pad`, `--primary`, `--rule`,
`--space-2`, `--space-3`, `--space-flow`, `--surface-raised`, `--text-heading`, `--text-sm`,
`--text-sub`, `--text-xs`, `--tracking-wide`, `--tracking-wide-lg`, `--weight-bold`,
`--weight-extrabold`, `--weight-semibold`, `--width-normal`, `--width-sub`, `--text-sub`,
`--motion-state`, `--ease-arrive`

## A11y

Project rows are `<button>`s (they open a case study). `.idx__go` is decorative
(`aria-hidden`) — the whole row is the target. Hover/focus states share the same styles, and
the 6px left bar is drawn by `::before` rather than by a border, so the row's own tracks do
not move when it appears.

## AI notes

- Number project rows `01…` in order; numbers are set in markup, not CSS counters.
- `.idx__name` pattern is always `Client <em>— Project</em>`; the em half renders muted.
- Descriptions lead with the outcome where one exists ("bounce rate down 40%").
- Tags are Chips (see chip spec), 3 max per row.
- Do not reach for this for a term/definition list — that is `definition-row`, and the two are
  different components now.
