---
{
  "id": "theme-toggle",
  "status": "stable",
  "since": "initial",
  "a11y": "A real <button> with three states, so no aria-pressed; the aria-label carries the current state and what activating does."
}
---

# Theme toggle

Tri-state theme control. A **satellite of the nav bar**: in the DOM as the bar's last child,
absolutely positioned just off the bar's right edge — its own paper, hairline and drop shadow,
so it reads as related to the instrument without being a segment of it. It carries no text at
all.

## Pattern

```html
<button class="theme" data-theme-toggle data-state="auto" aria-label="Theme: auto, following your system setting. Activate to change the theme.">
  <span class="theme__lamp" aria-hidden="true"></span>
</button>
```

`data-state` and `aria-label` are rewritten by `js/theme.js` on every change. The markup above
is the pre-script state, and the label is deliberately **vaguer** than anything the script
produces: the script's `auto` name says what auto is currently resolving to, and static HTML
cannot know the visitor's OS preference. So the initial value says only what is true under
both. A name that guessed a resolution would be wrong half the time.

## Placement

Hanging 0.75rem off the bar's right edge, centred on the bar's midline. It must be a **child
of `.bar`** for that to be expressible at all: the bar is centred and shrink-wrapped
(`width: max-content`), so no viewport-anchored rule can know where its right edge is.

Two consequences of being a child, both deliberate:

- **The bar centres by opposing insets + auto margins, not by `translateX(-50%)`.** A
  transformed ancestor is the containing block for `position: fixed` descendants, and the
  narrow-screen fallback below needs `fixed` to mean the viewport.
- **The puck sits in the bar's tab order, last** — identity → navigation → context → primary
  action → utility, which is the bar's stated order.

**Below 700px the satellite hides and the menu sheet carries the control.** The bar docks
full-width there, so there is no edge to hang off; and the bottom corner — the puck's old
fallback — belongs to the chat now (see `components/ask-fab/spec.md`): messages are expected
at that corner on a phone, a theme dial is not. The same control sits at the end of the
sheet's `.menu__body`, under the links on their left edge — just the circle, no strip and no
caption, by the owner's decision. Two renderings, one visible per breakpoint; `js/theme.js`
rewrites every `[data-theme-toggle]` on every change, so they cannot disagree — and "one
control per document" becomes "one *visible* control per viewport".

`z-index` sits under the drawer's, so an open panel covers it — a theme toggle floating over
a modal surface is a control with nothing to act on.

## The dial, and why it lost its words

It used to read `AUTO` / `LIGHT` / `DARK` beside a small square lamp. Three words are three
widths, and — the deciding reason — **the thing they described can simply show what it is.**

| `data-state` | Lamp | Means |
| --- | --- | --- |
| `auto` | half ink, half paper, **turning** | Following `prefers-color-scheme`; nothing stored |
| `light` | outline only | Pinned light, stored in `localStorage` |
| `dark` | filled | Pinned dark, stored in `localStorage` |

A pinned state is a fill — how much ink is in the circle says which one, which needs no
convention at all. Auto is the half-and-half, and it is **still turning**: the two pinned
states are a decision — the dial has landed — and auto is the absence of one, so it never
settles. That distinction reads without a legend, which is what let the words go.

The two halves are `--content-primary` and `--surface-page`, so the dial is literally "the two
themes" and it inverts with the theme like everything else. There is no theme query in this
block and nothing in it knows which theme is live.

**Under `prefers-reduced-motion` auto stops turning and rests at 45°** — still visibly neither
settled state, so it stays legible without the motion that usually carries it. A perpetually
spinning object is exactly what that query exists for.

**The hover is deliberately quiet.** A lift, not a fill: the one control on the page that is
meant to look pressable is the bar's accent block, and the puck must not compete with it.

## Every press changes the page

The next state is always the **opposite of what is currently rendered** — and when that
opposite is what the system would show anyway, it is stored as `auto` (nothing stored) rather
than as a pin. "Showing what your OS shows" and "following your OS" are the same state, so
there is nothing to pin.

| From | Rendering | Next state | The page |
| --- | --- | --- | --- |
| `auto`, system light | light | `dark` | flips to dark |
| `dark` pinned, system light | dark | `auto` | flips to light |
| `auto`, system dark | dark | `light` | flips to light |
| `light` pinned, system dark | light | `auto` | flips to dark |

An earlier version of this control was a three-state ring, and a ring over two renderings
must repeat a rendering once per lap — its best available fix was parking the dead press on
the deliberate return to auto. This design dissolves that arithmetic instead of relocating
it: only two states are reachable by pressing — `auto`, and the pin that **contradicts** the
system — so every press flips the page, including a first press from a fresh load, which
gives the visitor the opposite of whatever they are looking at.

The third state — a pin that **agrees** with the system — is unreachable by pressing. Only an
OS change under a pin can produce it, and from it the next press still flips the page (to the
other pin). If the OS preference changes mid-visit, the target of the next press changes with
it, so the label is recomputed on `prefers-color-scheme` changes even when the rendered theme
does not move.

## Variants

None. The three states are data, not variants.

The lamp does not encode what `auto` resolves to, and should not be asked to. A 14px circle
already carries three states; a fourth distinction inside one of them turns a readout into
a puzzle. The resolution is legible in the most direct way available — the page around it
is either light or dark — and it is stated exactly in the accessible name.

## Why there is no press-acknowledgement flash

There is no longer a press it could exist for: every press changes the page's colours, and
the page itself is the acknowledgement.

The mechanism it would have needed is recorded anyway, because it was built once and the
reason it failed outlives the reason it was wanted. A CSS animation restarts only when its
**name** changes, so acknowledging a state change needs one keyframe name per state — and an
element that enters the document already matching such a rule starts that animation
immediately: measured, the lamp fired `theme-ack-auto` at t≈111ms on a cold load with nothing
stored and nothing pressed. A flash on every page load is not an acknowledgement. Gating on
`.theme:focus` suppresses the load case but does nothing in Safari, which does not focus a
button on click — a polish effect that silently vanishes for a browser share that large is
worse than no effect.

## Tokens

`--chrome-bg`, `--chrome-border`, `--chrome-label`, `--content-primary`, `--shadow-drop`,
`--space-6`, `--surface-page`, `--space-6`, `--content-primary`, `--surface-page`,
`--chrome-bg`, `--shadow-drop`, `--motion-state`

## A11y

- Real `<button>`, not a checkbox: three states, not two, so no `aria-pressed`.
- The `aria-label` carries the current state *and* what activating does — the control has no
  visible text, so the accessible name is what keeps it usable, which is why it is not
  optional. `js/theme.js` rewrites it on every change.
- **The accessible name has to be true in all six combinations** — three states against two
  system settings — so both halves of it name the resolution rather than the bare state:

  | State | Name |
  | --- | --- |
  | `auto` | `Theme: auto, currently light. Activate for dark.` (and the dark-system mirror) |
  | pinned, differs from system | `Theme: dark. Activate for auto (your system setting, currently light).` |
  | pinned, matches system (OS changed under a pin) | `Theme: dark. Activate for light.` |

  The middle form names what auto resolves to because that is the press's visible outcome:
  "activate for auto" alone would leave a screen-reader user unable to predict what the page
  is about to do.
- Auto is a real state, not the absence of one: it must survive reload, so "no stored value"
  is what encodes it.

## AI notes

- **Never write a `prefers-color-scheme` media query in `components.css`.** Dark values live
  in `tokens/tokens.json` as a `dark` key beside the light value; the build emits both the
  media query and the `[data-theme]` override. A component that needs a conditional colour
  needs a *token*, not a query.
- The theme is set by `data-theme` on `<html>`, applied by an inline script in `<head>`
  before first paint. Do not move it to a deferred script — that reintroduces the flash.
- Two renderings per document, exactly: the satellite child of `.bar` (≥700px) and the one
  at the end of `.menu__body` (mobile). Both carry `data-theme-toggle`; `js/theme.js`
  updates all of them, which is what licenses the second one. Do not add a third, and do
  not move the satellite out of the bar without giving it a new anchor.
- Do not reintroduce `translateX(-50%)` centring on `.bar`: it silently turns the puck's
  narrow-screen `position: fixed` fallback into bar-relative positioning.
- Anything that reads a themed colour in JS must read it from `getComputedStyle` and re-read
  on the `themechange` window event (see `js/automata.js`) — not cache it at load.
