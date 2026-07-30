---
{
  "id": "nav",
  "status": "stable",
  "since": "initial",
  "a11y": "<nav aria-label=\"Primary\">; the status dot is aria-hidden and hover states hold AA contrast."
}
---

# Nav (floating bar)

Compact chrome bar lying on the sheet: fixed, top-centered, max-content width, inset-shadow
edges (no border) and a hard 5px offset shadow. Identity / links / availability status.

## Pattern

```html
<header class="bar">
  <a class="bar__id" href="#top">Yordan Hristov</a>
  <nav class="bar__nav" aria-label="Primary">
    <a href="#work">Work</a>
    <a href="#about">About</a>
    <a href="#contact">Contact</a>
  </nav>
  <button class="bar__menu" type="button" data-menu-open
          aria-controls="site-menu" aria-expanded="false">Menu</button>
  <div class="bar__status">
    <span class="bar__dot" aria-hidden="true"></span>
    <span>Available for work — Sofia<span class="bar__clock">, <time id="local-time">--:--</time></span></span>
  </div>
  <button class="bar__action mono" type="button"
          data-drawer-open="ask-panel" aria-controls="ask-panel" aria-expanded="false"
          aria-label="Ask my Bot">
    <img class="bar__face" src="design-system/assets/avatar.svg" alt="" aria-hidden="true"
         width="80" height="80" decoding="async">
    <span class="bar__action-label">Ask my Bot</span>
  </button>
  <button class="theme" data-theme-toggle data-state="auto" aria-label="Theme: auto, following your system setting. Activate to change the theme.">
    <span class="theme__lamp" aria-hidden="true"></span>
  </button>
</header>
```

`.bar__clock` wraps the separator as well as the `<time>`. That is the entire reason it
exists: the clock hides below 1280px, and hiding the `<time>` alone would leave the
sentence ending in a comma. It is a rendering wrapper, so it changes no word — the string
inside it is exactly what was there before.

## Segments

| Class | Use |
| --- | --- |
| `.bar__id` | Identity or the way back; always first, and the only segment with no left divider |
| `.bar__nav` | Up to three links. Hidden under 700px, where `.bar__menu` takes over |
| `.bar__menu` | **The nav's mobile form**: one word, `Menu`, summoning the full-screen menu component. Shown only under 700px, **at the very right of the docked bar**; styled as a link, pressed ink on `[aria-expanded="true"]` |
| `.bar__status` | Passive readout (availability, clock). Hidden under 1200px |
| `.bar__clock` | The separator + `<time>` inside the status. Hidden under 1280px |
| `.theme` | The theme toggle, a satellite hanging off the bar's right edge, ≥700px only — see `components/theme-toggle/spec.md` |
| `.bar__action` | **The page's one primary action** (Ask my Bot, Print / PDF). Solid accent. A chat action carries `data-ask` and leaves the bar under 700px for the ask-fab; a non-chat action (Print) keeps its segment at every width |
| `.bar__face` | The assistant's portrait inside `.bar__action`, 1.25rem. A mark, not a likeness |
| `.bar__action-label` | The action's words. Hidden under 860px; the accessible name is not |

`.bar__menu` is a word, not a hamburger, by the owner's decision — the bar is made of words,
and an icon would be the only picture in it besides the assistant's face. **At the very right
by the same decision**, which on cv puts it after the action: the docked row's order is
identity → action → Menu, and the button sits after `.bar__action` in the DOM so tab order
and visual order agree. Above 700px it is `display: none`, so its position costs the desktop
row nothing. The chat never folds into the menu — the owner's rule is that it stays reachable
without opening it, and its mobile home is the ask-fab at the corner.

## The bar has a hierarchy, and it is stated

Left to right, on every page, no exceptions:

> identity → navigation → context → **primary action** → utility

The primary action is the one thing a page most wants pressed. The utility — the theme
toggle — is always last, because it is the least of them and a reader looking for it should
always find it in the same place.

**This corrects a decision, and the old one is worth reading because it was reasonable.**
This file used to say that `.bar__action` *deliberately* looked identical to a `.bar__nav`
link, so the bar would read as one instrument. The cost of that was not visible from inside
the rule: the site's most distinctive feature — the assistant — was a three-letter word in
nav-link grey, and on the CV the print control sat *after* the theme toggle, so the one
action that page exists to offer was both the last segment and the quietest. A row that
reads as one instrument is worth less than a row where the thing to press is obvious.

It is a solid segment now, and that is the same rule `scripts/check-css.mjs` already enforces
for `.btn--solid`: **one primary action per view, wearing the primary ink.** The bar still
reads as one instrument because the seam rule below is unchanged — the promotion is a fill,
not a shape.

An action that opens something and leaves it open styles
`.bar__action[aria-expanded="true"]` as a *pressed* state rather than a lit one — the
inversion the old rule could not express. When resting was quiet, "open" could be the solid
one; now that resting is solid, open has to be the deeper one. That is the segment's **only** link to what it opens: the bar knows a button
can be expanded, not what it expanded. `aria-expanded` is the state a screen reader is
already being told about, so styling it costs no new attribute and cannot drift from the
announcement, which is what a hand-toggled "is open" class beside it would eventually do. A
`.bar__action` with no such attribute (cv's Print / PDF) is unaffected.

**Every seam is owned by the segment on its right.** Each segment but `.bar__id` draws a
1px inset line on its own left edge, and nothing draws one on its right. This is the rule
that makes the bar safe to compose: any segment can be hidden at any breakpoint and the
row still has exactly one line at every join and none hanging off the end. Drawing edges
the other way round does not survive a hidden neighbour — it left a doubled 2px line
between the last nav link and the toggle on cv, mcp and evals, which have no status
segment for the link's right edge to butt against.

## Tokens

`--accent` (dot), `--chrome-bg`, `--chrome-border`, `--chrome-border-strong`,
`--chrome-label`, `--chrome-label-strong`, `--content-inverse`, `--content-primary`,
`--accent`, `--font-mono`, `--primary`, `--shadow-drop` (the offset drop shadow),
`--text-xs`, `--text-sm` (the identity's one-step-up on the docked mobile bar — desktop
stays `--text-xs`, so the measured widths above remain true), `--space-2`, `--space-3`,
`--space-5`

**`--accent` is the primary action's ground**, and this is the only place in the system where
the accent is a ground rather than a mark. A solid ink segment carried the right hierarchy and
the wrong weight — at that size a near-black block reads as a hole punched in the bar. Blue
also separates the action from the ink-coloured identity on the left *and* from the
chrome-grey navigation between them, which no shade of grey does at once. Measured: the label
sits at 6.63:1 on it in light and 5.21:1 in dark, and the block itself stands off the bar at
6.60:1 and 5.32:1.

`--primary` is then hover **and** the open state. Blue at rest is an invitation; ink is what it
looks like once you are in it, and "you are in it" is one state however you arrived.

## Behaviour

The clock is filled by site JS (`#local-time`, Europe/Sofia). Content below needs top
clearance (hero well padding).

The responsive steps are derived from the bar's measured width against the `.well` beneath
it, not chosen for roundness — chrome that is wider than the content column it labels has
stopped being an object lying on the sheet:

| Viewport | Bar shows | Width (index) | Share of the well |
| --- | --- | --- | --- |
| ≤ 699px | **docked, edge to edge**: identity (growing) + Menu at the right; Ask is the ask-fab at the corner; hairline underline instead of the drop shadow | viewport width | — (it *is* the chrome edge) |
| 700–1199px | floating: identity + links + **Ask**, full paddings | 552.5px | 55.3% at 1199px |
| 1200–1279px | + status, without the clock | 816.2px | 81.6% at 1200px, 76.6% at 1279px |
| ≥ 1280px | + the clock | 872.1px | 81.8% at 1280px, 72.7% at 1440px and wider |

The well stops growing at 1200px, so 72.7% is the floor rather than a point on the way to
something smaller. Before any of these steps existed the bar appeared at 98.9% of the well.

**The ≤600px and ≤480px padding steps predate the menu and are kept for slack, not fit.**
Their history: the Ask segment was a fifth cell in a row already 95.9% full at 375px, and it
was paid for by dropping three neighbours' paddings one step down the ramp — the arithmetic
lives with the rules in `components.css`. Since the menu and the dock, the row below 700px
is two segments on index (identity + Menu) and three on cv (+ Print) inside a bar spanning
the whole viewport, and the 320px identity clip that arithmetic documented is *gone* — the
identity is the growing segment now, clipped only if a viewport is narrower than its
neighbours' fixed widths, which no real device is.

**Before adding the Ask segment to cv, mcp or evals, redo the wide-viewport arithmetic.**
cv's bar is 551.8px with its Print / PDF action, so Ask would take it to 615.8px and it
would need a 640px viewport at full padding. (Below 700px this stopped mattering: the links
fold into the menu, which is also what retired cv's old 560px `.bar__nav` hide rule.)

## A11y

`<nav aria-label="Primary">`; the dot is decorative (`aria-hidden`). Link hover inverts to
ink — AA contrast in both states.

## AI notes

- Three links maximum in `.bar__nav`; this bar is a compass, not a sitemap. A fourth
  destination is a sign that something should be a `.bar__action` instead, or should not be
  in the bar at all. (The menu sheet is not bound by three — it carries the way back too.)
- **The map of the floating layer**, lowest first: the peek panel (`z-index: 90`,
  pointer-events none), the theme puck (90, a satellite of the bar, ≥700px only), the
  ask-fab (90, the chat pill at the bottom corner, <700px only), the bar (100), the menu
  (300), the peek sheet (350, touch only — the notable cards' bottom sheet) and the drawer
  (400). The case dialog (500) is retired with the modal. Menu and drawer both cover the
  bar, which is what makes them mutually exclusive: each one's trigger lives under the
  other's sheet; the peek sheet's triggers sit under both. Check this list before adding
  anything `position: fixed`, and update it in the same commit.
