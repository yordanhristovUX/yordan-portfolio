---
{
  "id": "profile",
  "status": "stable",
  "since": "initial",
  "a11y": "Real <dl>/<dt>/<dd> semantics, each pair wrapped in a <div> for the grid."
}
---

# Profile

Compact mono definition list for scannable key facts (hero: Focus / Currently / Previously /
Availability). Two columns desktop, one on mobile.

## Pattern

```html
<dl class="profile mono">
  <div><dt>Focus</dt><dd>AI-ready design systems · platform-scale UX</dd></div>
  <div><dt>Availability</dt><dd class="is-ok">Open to new projects</dd></div>
</dl>
```

## Tokens

`--accent` (`.is-ok`), `--chrome-label`, `--content-body`, `--font-mono`, `--rule`,
`--text-xs`, `--space-3`, `--space-4`, `--space-7`

## A11y

Real `<dl>`/`<dt>`/`<dd>` semantics; each pair wrapped in a `<div>` for the grid.

## AI notes

- Labels are single words; values one line, `·`-separated when listing.
- `.is-ok` (accent) is only for a positive availability/status value — one per list.
