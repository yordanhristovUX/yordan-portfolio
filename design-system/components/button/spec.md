---
{
  "id": "button",
  "status": "stable",
  "since": "initial",
  "a11y": "Use <a> to navigate and <button> to act; the global :focus-visible ring is never suppressed."
}
---

# Button

Rectangular mono-type action. Outline by default; solid ink for the primary action of a view.

> **Its appearance is generated.** The CSS block lives in a generated region of
> `css/components.css` and is rendered from `definition.json` beside this file. Change how a
> button *looks* there; everything below — which element to use, the focus ring, the
> one-solid rule — is behaviour and judgement, and stays here.

## Pattern

```html
<a class="btn" href="#">Get in touch</a>
<a class="btn btn--solid" href="#">See the work ↓</a>
<button class="btn btn--small">Close ✕</button>
```

## Variants

| Class | Use |
| --- | --- |
| `.btn` | Default outline button |
| `.btn--solid` | THE primary action — at most one per view |
| `.btn--small` | Chrome contexts (dialog bar, dense rows) |

## Tokens

`--action-hover`, `--content-inverse`, `--content-primary`, `--font-mono`, `--primary`,
`--text-2xs`, `--text-xs`, `--space-2`, `--space-3`, `--space-5`, `--tracking-wide`,
`--weight-semibold`, `--motion-state`

## A11y

Use `<a>` when it navigates, `<button>` when it acts. Focus ring comes from the global
`:focus-visible` accent outline — never suppress it. Hover inverts to ink; contrast stays AA.

## AI notes

- Never place two `--solid` buttons side by side; the second action is always outline.
- No new sizes or colours — if a context needs something else, it is not a button.
- Text is sentence case; arrows (`↓`, `↗`, `→`) allowed as a trailing character only.
