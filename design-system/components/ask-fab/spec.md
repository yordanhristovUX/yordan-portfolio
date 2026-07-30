---
{
  "id": "ask-fab",
  "status": "stable",
  "since": "phase-3",
  "a11y": "A real <button> with a permanent aria-label; the visible label folds away on scroll but the accessible name never does. Drawer wiring (aria-expanded/aria-controls) rides on the same attributes the bar's Ask uses."
}
---

# Ask FAB (floating chat pill)

The chat action's mobile form. Below 700px `Ask my Bot` leaves the docked bar for the
bottom-right corner — where messages are expected on a phone — as a floating pill: the
assistant's face plus the full label near the top of the page, folding to the face alone
once the reader scrolls.

## Pattern

```html
<button class="ask-fab" type="button" aria-label="Ask my Bot" data-ask-fab
        data-drawer-open="ask-panel" aria-controls="ask-panel" aria-expanded="false">
  <img class="ask-fab__face" src="design-system/assets/avatar.svg" alt="" aria-hidden="true"
       width="80" height="80" decoding="async">
  <span class="ask-fab__label">Ask my Bot</span>
</button>
```

On the index it opens the drawer (`data-drawer-open`, bound by `js/main.js` like any other
opener). On a work page it navigates to `/#ask` instead — same destination as that bar's Ask.
`js/fab.js` toggles exactly one attribute — `data-collapsed` — and CSS owns the fold.

## Decisions

- **The blue is the ground, exactly as in the bar** — the owner's call, reversing a first
  version that dressed the pill in chrome with the accent as a ring around the face. That
  version optimised for quietness, and quiet was the wrong brief: this is the page's one
  primary action and the only route to the assistant on a phone, and a solid brand-coloured
  bubble is what chat widgets have taught readers to look for. The system's rule — the
  primary action wears the accent — does not stop being true at 699px. No hairline, matching
  `.bar__action`; the 2px offset shadow stays, because that shadow is what keeps a floating
  object one of this site's printed things rather than a generic material FAB. Hover commits
  to the ink, same as the bar. Label on accent holds AA in both themes (6.63:1 light,
  5.21:1 dark — the bar's own measured pair).
- **The face is 2.75rem and it IS the pill** — the owner's ask, twice: first "bigger than
  the bar's 1.25rem mark", then "bigger still, with a 2px rim". At 44px the drawing reads as
  a portrait outright, filling the 48px pill to within a hairline of blue on the top, left
  and bottom; the right side keeps a real spacing step so the label can breathe. The 2px is
  a rim, not a padding step, which is why it is not a token. The drawer's 3.5rem remains the
  full likeness.
- **The fold is `max-width`, not `display`** — a label that vanishes in one frame reads as a
  glitch; one that folds reads as the pill closing.
- **The fold follows scroll *direction*, not position** — the owner's rule, correcting a
  first version that keyed on "past the top" alone. Scrolling down folds the pill; any
  scroll up brings the full pill back, wherever the reader is: reading down, the label is
  noise, but scrolling up means looking for something, and the pill should be one of the
  things found. Within two lattice cells (48px) of the top it is always the full pill.
- **It takes the corner the theme puck vacated.** One floating object per corner; the puck's
  mobile home is the menu sheet. Same z tier (90): under the menu (300) and the drawer (400),
  so an open sheet covers it.
- **Mobile only.** At ≥700px it is `display: none` and Ask is a bar segment; two renderings
  of the action, one visible per breakpoint, and the drawer does not care which one opened it.

## Variants

None. States are data: `data-collapsed` present or absent.

| State | Renders |
| --- | --- |
| (default) | face + `Ask my Bot`, pill |
| `data-collapsed` | face alone, circle |

## Tokens

`--accent`, `--content-inverse`, `--font-mono`, `--primary`, `--shadow-drop`, `--space-2`,
`--space-4`, `--text-xs`

`--accent` is the ground and `--content-inverse` the label — the same pair as `.bar__action`,
because it is the same action. `--primary` is hover, for the bar's reason: blue at rest is an
invitation, ink is what it looks like once you are in it.

## A11y

- Real `<button>` with a permanent `aria-label`; the folded state hides the visible words but
  the accessible name never narrows — the same rule the bar's `.bar__action-label` follows.
- The face is `aria-hidden` decoration; the name lives on the button.
- Under `prefers-reduced-motion` the fold happens in one frame instead of animating.
- The collapsed circle is 48px — at, not under, the 44px target floor.

## AI notes

- One `[data-ask-fab]` per document, and only on pages that have the chat (index, work).
  cv's Print is not a chat and keeps its bar segment; evals and mcp have no action at all.
- `js/fab.js` writes `data-collapsed` and nothing else. Do not add styles from JS, and do not
  add a second scroll behaviour (hide-on-scroll, dock-on-scroll) without retiring this one —
  two scroll answers on one object is a state machine nobody can read.
- The pill carries the solid accent ground *because* it is the bar's promoted action in its
  mobile position — the two are one action, never both visible, so "one primary action per
  view, wearing the accent" stays true at every width. Do not add a second accent-solid
  control to any view this appears in. See `components/nav/spec.md`.
