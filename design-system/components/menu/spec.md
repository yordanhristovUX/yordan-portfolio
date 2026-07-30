---
{
  "id": "menu",
  "status": "stable",
  "since": "phase-3",
  "a11y": "role=dialog aria-modal on the sheet; focus trapped while open, Escape closes, focus returns to the Menu segment. The trigger's aria-expanded is the announcement and the lit state in one fact."
}
---

# Menu (full-screen nav)

The bar's navigation, unfolded. Below 700px the bar's row of anchors becomes one `.bar__menu`
segment (owned by the nav component), and this component is what that segment summons: a
sheet covering the whole viewport — bar included — carrying the same links at a size a thumb
can hit.

## Pattern

```html
<div class="menu" id="site-menu" data-menu>
  <div class="menu__sheet" role="dialog" aria-modal="true" aria-label="Menu" tabindex="-1">
    <div class="menu__head">
      <span class="menu__title">Menu</span>
      <button class="menu__close" type="button" data-menu-close>Close</button>
    </div>
    <div class="menu__body">
      <nav class="menu__nav" aria-label="Menu">
        <a href="#work">Work</a>
        <a href="#about">About</a>
        <a href="#contact">Contact</a>
      </nav>
      <button class="theme" data-theme-toggle data-state="auto" aria-label="Theme: auto, following your system setting. Activate to change the theme.">
        <span class="theme__lamp" aria-hidden="true"></span>
      </button>
    </div>
  </div>
</div>
```

Opened by the bar's `.bar__menu` segment (`data-menu-open`, `aria-controls="site-menu"`,
`aria-expanded`). `js/menu.js` toggles exactly one attribute — `data-open` on `.menu` — and
never writes a style, the same contract the drawer holds with `js/main.js`.

## Decisions

- **It covers the bar, deliberately.** The drawer set the precedent. Covering the bar makes
  menu and drawer mutually exclusive *by construction* — each one's trigger lives under the
  other's sheet — so no layer stack, no `inert` bookkeeping and no Escape-ordering rules need
  to exist for it.
- **The page's primary action is not in here.** The owner's rule: the chat must be reachable
  without opening the menu. On mobile it is the ask-fab at the bottom corner; the sheet
  carries navigation, plus the theme control in its foot.
- **The trigger is the word `Menu`, not a hamburger** — the owner's decision. The bar is made
  of words, and an icon would be the only picture in it besides the assistant's face.
- **Links are the page's own compass**, verbatim from that page's `.bar__nav`, plus
  `← Portfolio` on the pages whose identity segment is the way back (the sheet covers the
  bar, so the way back must not be lost with it). The three-link maximum for the bar does not
  apply here; the menu's limit is what fits a viewport without scrolling, and `overflow-y`
  covers the pathological case.
- **The head is a replica of the docked bar, and Close sits in the trigger's exact slot** —
  a full-height segment flush at the very right with the same `--space-5` padding and a seam
  on its left edge. The owner named the defect this fixes: the trigger and the way back were
  in different places, so the thumb that opened the sheet had to travel to leave it. Now the
  press point does not move. (A chrome strip with an inset Close button was the first
  version; it measured 61×36 and sat away from the corner.)
- **Close wears the pressed ink at rest** — the second defect the owner named: title and
  Close were the same quiet mono, a caption and a control in one coat. Close now carries the
  exact state the trigger shows at `[aria-expanded="true"]`: you pressed the segment, it went
  ink, and the sheet opened with that same ink segment in the same slot, now reading Close.
  The passive title stays chrome-quiet; the one pressable thing in the head is the one thing
  filled. Hover steps to `--action-hover`, the solid family's own hover.
- **The theme circle sits under the links — just the circle.** Below 700px the satellite
  puck hides (the docked bar has no edge to hang off; the corner belongs to the chat,
  `components/ask-fab/spec.md`), and the same control sits at the end of `.menu__body`,
  on the links' left edge, utility last — the order the bar taught. No strip and no caption,
  by the owner's decision: a chrome band for one 40px circle was furniture, and the dial
  plus the accessible name already carry the state. `js/theme.js` updates every
  `[data-theme-toggle]`, so the two renderings cannot disagree.
- **The scroll lock is `body:has(.menu[data-open])`, not a JS class.** `body.is-locked`
  belongs to `js/main.js`'s layer stack, and main.js does not load on every page this menu
  does. A selector derived from `data-open` cannot disagree with the state that produced it.
- **`visibility` with a delayed flip is what closes it** (the drawer's mechanism): animatable,
  and it removes the sheet from the tab order and the accessibility tree when — not before —
  the exit transition ends.

## Variants

None. One menu per document, `id="site-menu"`.

## Tokens

`--accent`, `--action-hover`, `--chrome-bg`, `--chrome-border`, `--chrome-label`,
`--content-inverse`, `--content-primary`, `--font-display`, `--font-mono`, `--primary`,
`--rule`, `--rule-strong`, `--space-3`, `--space-4`, `--space-5`, `--space-6`,
`--surface-page`, `--text-sm`, `--text-title`, `--text-xs`

The head is bar chrome on purpose — `--chrome-bg`, `--font-mono`, `--text-xs` are the bar's
own voice, and `--chrome-border` is Close's left seam, the same edge every bar segment
draws — so the sheet reads as the bar unfolded rather than as a new surface. The links are
`--font-display` at `--text-title`: reading type, not chrome type, because a full screen of
mono uppercase would shout.

## A11y

- The sheet is `role="dialog" aria-modal="true"` with `tabindex="-1"`; `js/menu.js` focuses
  it on open, traps Tab inside it, closes on Escape, and returns focus to the trigger.
- The trigger carries `aria-expanded` + `aria-controls`; the pressed ink styles
  `[aria-expanded="true"]`, so the announcement and the lit state cannot drift apart.
- Activating a link closes the menu — it navigates within the page, and a menu left open
  over the destination would be a reader trapped under chrome.
- Under `prefers-reduced-motion` the sheet arrives in one frame; it is content, not
  decoration, so it appears rather than declining to.
- If the viewport grows past the breakpoint while open (a rotation), `js/menu.js` closes it:
  the trigger it would return focus to no longer exists at that width.

## AI notes

- One `data-menu` per document. The links inside are copied verbatim from that page's bar —
  never reworded; copy is the owner's.
- `z-index: 300` — over the bar (100), under the drawer (400). See the nav spec's map of the
  floating layer before adding anything `position: fixed`.
- Do not move the chat into this sheet — its mobile home is the ask-fab at the corner, so it
  is reachable without opening the menu. The theme control DOES live here on mobile (the
  circle at the end of `.menu__body`), and only here: its other rendering is the bar's
  satellite, ≥700px.
