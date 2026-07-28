---
{
  "id": "stat",
  "status": "stable",
  "since": "initial",
  "a11y": "A framed number inside prose — it adds no semantics, so the sentence around it has to still read correctly."
}
---

# Stat

A single framed headline number inside prose (case-study outcomes). The loud sibling of
Fact — no title/label structure, just the number in a strong-rule box.

## Pattern

```html
<p><span class="stat">−40%</span></p>
```

## Tokens

`--content-primary`, `--font-display`, `--rule-strong`, `--text-display`, `--space-1`,
`--space-2`, `--space-4`, `--space-6`

## AI notes

- Only for a measured, defensible result ("−40%"), never for counts of things.
- One stat per case study, placed immediately before the outcomes list it summarises.
