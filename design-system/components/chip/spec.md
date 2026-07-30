---
{
  "id": "chip",
  "status": "stable",
  "since": "initial",
  "a11y": "Display-only <span>. Anything that responds to a click is a Button instead."
}
---

# Chip

Small bordered mono label for metadata: project tags, case-study meta, statuses.

## Pattern

```html
<div class="chips">
  <span class="chip">Accessibility</span>
  <span class="chip">WCAG AA</span>
  <span class="chip chip--solid">Shipped</span>
</div>
```

## Variants

| Class | Use |
| --- | --- |
| `.chip` | Default bordered chip |
| `.chip--solid` | The ONE emphasised fact in a set (inverted ink) |
| `.chips` | Flex wrapper providing wrap + gap |

## Tokens

`--chrome-border-strong`, `--chrome-label-strong`, `--content-inverse`, `--font-mono`,
`--primary`, `--text-2xs`, `--space-1`, `--space-2`

## A11y

Chips are display-only text (`<span>`) — never interactive. If it needs a click, it's a Button.

## AI notes

- Max one `--solid` chip per group; it marks the single most important fact (e.g. "Shipped").
- Keep labels to 1–3 words; chips are scanning aids, not sentences.
- Used in: work-row tags (`.idx__tags`), and the tag row on a project page (`.chips`).
