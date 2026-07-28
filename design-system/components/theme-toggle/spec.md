---
{
  "id": "theme-toggle",
  "status": "stable",
  "since": "initial",
  "a11y": "A real <button> with three states, so no aria-pressed; the aria-label carries the current state and what activating does."
}
---

# Theme toggle

Tri-state theme control. Sits in the nav bar as one more segment of the instrument, and
reads as a labelled readout you can press rather than a switch.

## Pattern

```html
<button class="theme mono" data-theme-toggle data-state="auto" aria-label="Theme: following your system setting. Activate for light.">
  <span class="theme__lamp" aria-hidden="true"></span>
  <span class="theme__label">Auto</span>
</button>
```

`data-state`, `.theme__label` and `aria-label` are all rewritten by `js/theme.js` on every
change — the markup above is the initial state only, and must match what the script would
produce for `auto` so the control is correct before the script runs. The three states cycle
`auto → light → dark → auto`.

## Variants

None. The three states are data, not variants.

| `data-state` | Lamp | Means |
| --- | --- | --- |
| `auto` | half-filled | Following `prefers-color-scheme`; nothing stored |
| `light` | outline only | Pinned light, stored in `localStorage` |
| `dark` | filled | Pinned dark, stored in `localStorage` |

## Tokens

`--chrome-border`, `--chrome-label`, `--content-inverse`, `--primary`, `--space-2`,
`--space-4`

The lamp is drawn in `currentColor` on purpose, so it inverts with the button on hover
without a second colour token.

## A11y

- Real `<button>`, not a checkbox: three states, not two, so no `aria-pressed`.
- The label carries the **current** state; the `aria-label` carries current state *and* what
  activating does, because the visible text alone would leave a screen-reader user guessing.
  `js/theme.js` rewrites both on every change.
- Below 480px the text label is hidden and the lamp stands alone — the `aria-label` is what
  keeps it usable, which is why it is not optional.
- Auto is a real state, not the absence of one: it must survive reload, so "no stored value"
  is what encodes it.

## AI notes

- **Never write a `prefers-color-scheme` media query in `components.css`.** Dark values live
  in `tokens/tokens.json` as a `dark` key beside the light value; the build emits both the
  media query and the `[data-theme]` override. A component that needs a conditional colour
  needs a *token*, not a query.
- The theme is set by `data-theme` on `<html>`, applied by an inline script in `<head>`
  before first paint. Do not move it to a deferred script — that reintroduces the flash.
- One toggle per document. It belongs to `.bar`; do not repeat it in the footer or dialog.
- Anything that reads a themed colour in JS must read it from `getComputedStyle` and re-read
  on the `themechange` window event (see `js/automata.js`) — not cache it at load.
