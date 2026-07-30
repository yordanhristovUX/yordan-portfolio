---
{
  "id": "theme-toggle",
  "status": "stable",
  "since": "initial",
  "a11y": "A real <button> with three states, so no aria-pressed; the aria-label carries the current state and what activating does."
}
---

# Theme toggle

Tri-state theme control. Sits in the nav bar as the bar's **utility** segment — the least of
its parts, and always last — and it carries no text at all.

## Pattern

```html
<button class="theme mono" data-theme-toggle data-state="auto" aria-label="Theme: auto, following your system setting. Activate to change the theme.">
  <span class="theme__lamp" aria-hidden="true"></span>
</button>
```

`data-state` and `aria-label` are rewritten by `js/theme.js` on every change. The markup above
is the pre-script state, and the label is deliberately **vaguer** than anything the script
produces: the script's `auto` name says what auto is currently resolving to, and static HTML
cannot know the visitor's OS preference. So the initial value says only what is true under
both. A name that guessed a resolution would be wrong half the time.

## The dial, and why it lost its words

It used to read `AUTO` / `LIGHT` / `DARK` beside a small square lamp. Three words are three
widths in a bar with no room to spare, and — the deciding reason — **the thing they described
is a two-sided object that can simply show which side it is on.**

One circle, permanently half dark and half light. The state is its ANGLE:

| State | The dial |
| --- | --- |
| `dark` | the ink half faces up — `rotate(0)` |
| `light` | the paper half faces up — `rotate(180deg)` |
| `auto` | **it is still turning**, a slow endless rotation |

Auto being in motion is the whole idea rather than an embellishment. The other two states are
a decision — the dial has landed — and auto is the *absence* of one: the page is following
something else, so the dial never settles. That distinction reads without a legend, which is
what let the words go.

The two halves are `--content-primary` and `--surface-page`, so the dial is literally "the two
themes" and it inverts with the theme like everything else. There is no theme query in this
block and nothing in it knows which theme is live.

**Under `prefers-reduced-motion` auto stops turning and rests at 45°** — still visibly neither
settled angle, so the state survives the loss of the motion that usually carries it. A
perpetually spinning object is exactly what that query exists for.

**The hover is deliberately quiet.** This was a full ink-fill until the bar gained a
hierarchy; the segment beside it is now a solid accent block, and a utility that also filled
solid on hover would compete with the one control on the page that is meant to look pressable.

## The cycle is not a fixed ring

Three states, two renderings. Going round the ring must therefore repeat a rendering
somewhere: in `auto → X → Y → auto` there is always exactly one press that leaves the
page's colours untouched. That is arithmetic, not a bug, and it cannot be designed away
without dropping a state.

What can be chosen is **which** press it is, and it must not be the first. The old fixed
ring `auto → light → dark` put it there: a visitor on a light system pressed once, watched
the control relabel itself to LIGHT, saw nothing else move, and learned the control was
broken — the second press was where dark finally arrived.

So the next state is computed against what `auto` resolves to **right now**:

| From | System is light | System is dark |
| --- | --- | --- |
| `auto` | → `dark` | → `light` |
| the pinned state that differs from the system | → the other pinned state | → the other pinned state |
| the pinned state that matches the system | → `auto` | → `auto` |

which is `auto → dark → light → auto` on a light system and `auto → light → dark → auto`
on a dark one. Both press 1 and press 2 change the page. Press 3 is the repeat, and it is
the deliberate return to auto — a press whose meaning is "stop overriding", where landing
on the colour you were already looking at is the correct outcome rather than a surprise.
The `aria-label` says so before it happens.

If the OS preference changes mid-visit while a theme is pinned, the target of the next
press changes with it, so the label has to be recomputed on `prefers-color-scheme` changes
even when the rendered theme does not move.

## Variants

None. The three states are data, not variants.

| `data-state` | Lamp | Means |
| --- | --- | --- |
| `auto` | half-filled | Following `prefers-color-scheme`; nothing stored |
| `light` | outline only | Pinned light, stored in `localStorage` |
| `dark` | filled | Pinned dark, stored in `localStorage` |

The lamp does not encode what `auto` resolves to, and should not be asked to. A 9px square
already carries three states; a fourth distinction inside one of them turns a readout into
a puzzle. The resolution is legible in the most direct way available — the page around it
is either light or dark — and it is stated exactly in the accessible name, where it costs
no width in a bar that has none to spare.

## Why there is no press-acknowledgement flash

Reordering the cycle fixes two presses out of three. The third — the return to auto — still
cannot move the page, so the obvious next move is to flash the lamp and prove the press
landed. It was built, measured and removed; the reasoning is recorded here so it is not
rebuilt.

A CSS animation restarts only when its **name** changes, so acknowledging a state change
needs one keyframe name per state. An element that enters the document already matching
such a rule starts that animation immediately: measured, the lamp fired `theme-ack-auto`
at t≈111ms on a cold load with nothing stored and nothing pressed. A flash on every page
load is not an acknowledgement, and it devalues the one that follows a real press. Gating
on `.theme:focus` suppresses the load case but does nothing in Safari, which does not focus
a button on click — a polish effect that silently vanishes for a browser share that large
is worse than no effect.

It is also solving the wrong half of the problem. The lamp fill and the label already
change on every press including that one, and the accessible name now states the
consequence **before** it happens rather than confirming it afterwards. Announcing a no-op
in advance beats acknowledging it in retrospect.

## Tokens

`--chrome-bg`, `--chrome-border`, `--chrome-label`, `--content-primary`, `--shadow-drop`,
`--surface-page`

`--content-primary` and `--surface-page` are the dial's two tones, which is why this component
consumes a *surface* token without drawing a surface: the dial is a picture of the two themes,
so it has to be made of them.

`--chrome-bg` and `--shadow-drop` are the floating puck's own paper and its offset shadow —
the same pair the nav bar uses, because it is the same idea: an object lying on the sheet.

The lamp is drawn in `currentColor` on purpose, so it inverts with the button on hover
without a second colour token.

`--space-1` is the ≤480px padding, and it is one of the three steps that paid for the Ask
segment joining the bar — see the arithmetic in `components/nav/spec.md`. The toggle gives
up 8.0px of a 40.0px bill. It is not an independent choice: change it back and the bar
overflows at 375px.

## A11y

- Real `<button>`, not a checkbox: three states, not two, so no `aria-pressed`.
- The label carries the **current** state; the `aria-label` carries current state *and* what
  activating does, because the visible text alone would leave a screen-reader user guessing.
  `js/theme.js` rewrites both on every change.
- **The accessible name has to be true in all six combinations** — three states against two
  system settings — and the old one was true in three of them. `Theme: following your system
  setting. Activate for light.` is a lie on a light system, where activating gives you light
  on light. The name is now built from the resolved theme, and the two forms it takes are:

  | State | Name |
  | --- | --- |
  | `auto` | `Theme: auto, currently light. Activate for dark.` (and the dark-system mirror) |
  | pinned, differs from system | `Theme: dark. Activate for light.` |
  | pinned, matches system | `Theme: light. Activate for auto (your system setting, currently light).` |

  The third form is the important one. It is the press that will not change the page, and
  saying what auto resolves to is what turns that from a control that ignored you into a
  control that told you in advance.
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
