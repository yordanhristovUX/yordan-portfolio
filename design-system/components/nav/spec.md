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
  <div class="bar__status">
    <span class="bar__dot" aria-hidden="true"></span>
    <span>Available for work — Sofia<span class="bar__clock">, <time id="local-time">--:--</time></span></span>
  </div>
  <button class="bar__action mono" type="button"
          data-drawer-open="ask-panel" aria-controls="ask-panel" aria-expanded="false">Ask</button>
  <button class="theme mono" data-theme-toggle data-state="auto" aria-label="Theme: auto, following your system setting. Activate to change the theme.">
    <span class="theme__lamp" aria-hidden="true"></span>
    <span class="theme__label">Auto</span>
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
| `.bar__nav` | Up to three links |
| `.bar__status` | Passive readout (availability, clock). Hidden under 1200px |
| `.bar__clock` | The separator + `<time>` inside the status. Hidden under 1280px |
| `.theme` | The theme toggle — see `components/theme-toggle/spec.md` |
| `.bar__action` | **The page's one primary action** (Ask my Bot, Print / PDF). Solid primary ink |
| `.bar__face` | The assistant's portrait inside `.bar__action`, 1.25rem. A mark, not a likeness |
| `.bar__action-label` | The action's words. Hidden under 860px; the accessible name is not |

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
`--font-mono`, `--primary`, `--primary-hover`, `--shadow-drop` (the offset drop shadow),
`--text-xs`, `--space-1`, `--space-2`, `--space-3`, `--space-5`

`--primary-hover` is the primary action's hover **and** its open state. It exists precisely
for this: the token file calls it "a state, not the brand", which is what a segment that is
already solid primary needs in order to have anywhere left to go.

## Behaviour

The clock is filled by site JS (`#local-time`, Europe/Sofia). Content below needs top
clearance (hero well padding).

The responsive steps are derived from the bar's measured width against the `.well` beneath
it, not chosen for roundness — chrome that is wider than the content column it labels has
stopped being an object lying on the sheet:

| Viewport | Bar shows | Width | Share of the well |
| --- | --- | --- | --- |
| ≤ 480px | identity + links + **Ask** + toggle, tightest paddings | 336.6px | fits with 14.4px slack at 375px |
| 481–600px | same, mid paddings | 440.5px | fits with 16.5px slack at 481px |
| 601–1199px | full paddings | 552.5px | 55.3% at 1199px |
| 1200–1279px | + status, without the clock | 816.2px | 81.6% at 1200px, 76.6% at 1279px |
| ≥ 1280px | + the clock | 872.1px | 81.8% at 1280px, 72.7% at 1440px and wider |

The well stops growing at 1200px, so 72.7% is the floor rather than a point on the way to
something smaller. Before any of these steps existed the bar appeared at 98.9% of the well.

**The Ask segment is a fifth cell and it was not free.** It measures 64.0px at full padding
and 40.0px tightened. Two things paid for it, and both were re-derived rather than nudged:

- **The status reveal moved from 1080px to 1200px.** Left at 1080 the status-bearing bar
  would have been 816.2px inside a 900px well — 90.7%, most of the way back to the 98.9%
  defect the two-step reveal exists to fix. At 1200 it is 81.6%, and the worst case anywhere
  is now **81.8%, better than the 83.6%** this bar had before Ask existed. The cost is the
  1080–1199px band, which loses the availability line; the status is a passive readout and
  Ask is the only route on the page to the assistant, so that is the right thing to lose.
- **A new ≤480px step drops three paddings one step down the ramp** (`.bar__id` space-3 →
  space-2 horizontally, `.bar__nav a` and `.theme` space-2 → space-1). That frees
  8 + 24 + 8 = 40.0px, so 336.64px becomes 336.61px and the 375px slack is 14.39px against
  14.36px. `.bar__id`'s *vertical* padding stays at space-3 — it is what sets the bar's
  height.

At 320px the bar has clipped the identity since long before Ask existed (336.6px of content
in a 296px box, which is what `.bar__id`'s `overflow: hidden` is for). The overflow absorbed
is 40.6px either way; what changes is how much name survives it — 95.2px before, 87.2px
after, one monospace character.

The 600px step is a fit constraint, not taste: above it the full paddings need a 576px
viewport to hold cv's four segments, and the band between the old 480px boundary and that
figure truncated the identity on all four pages.

**Before adding the Ask segment to cv, mcp or evals, redo this arithmetic.** cv's bar is
551.8px with its Print / PDF action, so Ask would take it to 615.8px and it would need a
640px viewport at full padding; cv's own `.bar__nav` hide step (`css/cv.css`, 560px) would
have to move with it.

## A11y

`<nav aria-label="Primary">`; the dot is decorative (`aria-hidden`). Link hover inverts to
ink — AA contrast in both states.

## AI notes

- Three links maximum in `.bar__nav`; this bar is a compass, not a sitemap. A fourth
  destination is a sign that something should be a `.bar__action` instead, or should not be
  in the bar at all.
- The floating layer has exactly three occupants and they are ordered: the bar (`z-index:
  100`), the drawer (400) and the case dialog (500). Nothing else may be `position: fixed`.
  The order is not cosmetic — an answer inside the drawer renders real `.idx__row`s that
  open the case dialog, so the dialog must land on top of the drawer that opened it.
