---
{
  "id": "actions",
  "status": "stable",
  "since": "phase-3",
  "a11y": "Nothing of its own, and that is the point: it is a flex container around controls that already carry their own semantics. It adds no role and no label, so the tab order is source order and a screen reader hears the buttons rather than a group it was not told about."
}
---

# Actions

A row of buttons, or of links shaped like buttons. It is one group that **wraps as a group**,
and it exists because a paragraph of inline-blocks is not one: the case-study pages spaced
their calls to action with an inline `margin-right` on every anchor but the last, so the
column gap was chosen and the row gap was whatever the line box gave it — measured at 1px
once the row wrapped.

It is **not** Link grid. `.link-grid` is a ruled lattice of equal cells that fills its
container; this is a short row of controls that keeps its natural widths. And it is not a
variant of Button: a `.btn` inside this looks exactly like a `.btn` anywhere else.

## Pattern

This is not an example, it is THE pattern. Copy it verbatim.

```html
<div class="actions">
  <a class="btn btn--solid" href="https://github.com/…">GitHub repo ↗</a>
  <a class="btn" href="/evals.html">Retrieval evaluation →</a>
  <a class="btn" href="/mcp.html">MCP server →</a>
</div>
```

`<button>` works here for the same reason it works in Button: this block styles the row, not
what is in it, so a mix of links and buttons is a markup decision the page makes.

## The two gaps are two decisions

`column-gap` and `row-gap` are written separately and carry the same token today. That is
deliberate. A single `gap` would make them one decision, and they were not one problem: the
horizontal spacing was chosen (`.6rem`, off the ramp) and the vertical spacing was never
chosen at all. Naming both means a later change to the wrapped rhythm is visible as a change
to the row gap rather than as a change to "the gap".

| gap | token | px |
| --- | --- | --- |
| `column-gap` | `--space-3` | 12 |
| `row-gap` | `--space-3` | 12 |

## Variants

None. One primary action per view is a rule Button already states and
`scripts/check-css.mjs` already counts, so a `--stacked` or a `--right` here would be layout
the page owns rather than appearance this component owns.

## Tokens

`--space-3`

## A11y

- No `role`, no label. It is a container, and giving it `role="group"` without a name would
  announce a group with nothing to say about it.
- Tab order is source order. Put the primary action first: it is what the row is for, and it
  is what a keyboard reaches first.
- At most one `.btn--solid` in the row, per `components/button/spec.md`.

## AI notes

- Reach for this wherever two or more buttons sit side by side. One button on its own needs
  no row.
- Never space the buttons with a margin, inline or otherwise. That is the defect this block
  replaced, and a margin on the last child is what makes a wrapped row look wrong.
- It composes with Page head's meta slot and with a case study's closing block; it does not
  belong inside `.chips`, which is a different thing wearing a similar shape.
