---
{
  "id": "section-head",
  "status": "stable",
  "since": "initial",
  "a11y": "Always an <h2>; the note is hidden under 640px, so it may never carry essential information."
}
---

# Section head

Full-width chrome band opening every numbered section: accent number, display title,
optional right-aligned note. Spans the whole sheet including the rails.

## Pattern

```html
<header class="sec__head">
  <span class="sec__no mono">02</span>
  <h2 class="sec__title t-title">Selected work</h2>
  <span class="sec__note">Click a project for the full case study</span>
</header>
```

Parent section: `<section class="band sec">` (adds the strong top rule);
`.sec--tint` tints the section's well (used for Background).

## Tokens

`--accent`, `--chrome-bg`, `--chrome-label`, `--rule`, `--rule-strong`,
`--surface-raised` (`.sec--tint`), `--text-xs`, `--pad` (title typography from `.t-title`),
`--space-4`, `--space-6`

## A11y

Always an `<h2>`; the page has exactly one `<h1>` (hero name). The note is hidden under
640px — never put essential information in it.

## AI notes

- Numbers are two digits (`01`…`06`), the only place besides availability that wears accent.
- The note is for a genuinely useful hint only. No decorative annotations — if it doesn't
  help the user act, leave it out.
- Titles are 1–3 plain words ("Selected work", not "Index of works").
