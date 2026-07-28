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
| `.bar__status` | Passive readout (availability, clock). Hidden under 1080px |
| `.bar__clock` | The separator + `<time>` inside the status. Hidden under 1280px |
| `.theme` | The theme toggle — see `components/theme-toggle/spec.md` |
| `.bar__action` | A button that acts on the page (Print / PDF), styled as a nav cell |

`.bar__action` deliberately looks identical to a `.bar__nav` link. The bar reads as one
instrument; a segment that announced itself as a button would break the row. Use it only
for page-level actions, never for navigation — that is what `.bar__nav` is for.

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
`--font-mono`, `--primary`, `--shadow-drop` (the offset drop shadow), `--text-xs`,
`--space-2`, `--space-3`, `--space-5`

## Behaviour

The clock is filled by site JS (`#local-time`, Europe/Sofia). Content below needs top
clearance (hero well padding).

The three responsive steps are derived from the bar's measured width against the `.well`
beneath it, not chosen for roundness — chrome that is wider than the content column it
labels has stopped being an object lying on the sheet:

| Viewport | Bar shows | Width | Share of the well |
| --- | --- | --- | --- |
| ≤ 600px | identity + links + toggle, tightened paddings | 336.6px | fits with 14.4px slack at 375px |
| 601–1079px | identity + links + toggle | 488.6px | 54.3% at 1079px |
| 1080–1279px | + status, without the clock | 752.2px | 83.6% at 1080px, 70.6% at 1279px |
| ≥ 1280px | + the clock | 808.2px | 75.8% at 1280px, 67.3% at 1440px and wider |

The well stops growing at 1200px, so 67.3% is the floor rather than a point on the way to
something smaller. Before these steps existed the bar appeared at 98.9% of the well.

The 600px step is a fit constraint, not taste: above it the full paddings need a 576px
viewport to hold cv's four segments, and the band between the old 480px boundary and that
figure truncated the identity on all four pages.

## A11y

`<nav aria-label="Primary">`; the dot is decorative (`aria-hidden`). Link hover inverts to
ink — AA contrast in both states.

## AI notes

- Three links maximum; this bar is a compass, not a sitemap.
- Nothing else may be `position: fixed` except the dialog — the bar owns the floating layer.
