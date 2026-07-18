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

`--font-mono`, `--chrome-border-strong`, `--chrome-label-strong`, `--primary`, `--content-inverse`

## A11y

Chips are display-only text (`<span>`) — never interactive. If it needs a click, it's a Button.

## AI notes

- Max one `--solid` chip per group; it marks the single most important fact (e.g. "Shipped").
- Keep labels to 1–3 words; chips are scanning aids, not sentences.
- Used in: work-row tags (`.idx__tags`), case-study meta (`.case__meta`).
