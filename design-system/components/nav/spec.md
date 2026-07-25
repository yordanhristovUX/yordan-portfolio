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
    <span>Available for work — Sofia, <time id="local-time">--:--</time></span>
  </div>
  <button class="theme mono" data-theme-toggle data-state="auto" aria-label="Theme: following your system setting. Activate for light.">
    <span class="theme__lamp" aria-hidden="true"></span>
    <span class="theme__label">Auto</span>
  </button>
</header>
```

## Segments

| Class | Use |
| --- | --- |
| `.bar__id` | Identity or the way back; always first |
| `.bar__nav` | Up to three links |
| `.bar__status` | Passive readout (availability, clock). Hidden under 980px |
| `.theme` | The theme toggle — see `components/theme-toggle/spec.md` |
| `.bar__action` | A button that acts on the page (Print / PDF), styled as a nav cell |

`.bar__action` deliberately looks identical to a `.bar__nav` link. The bar reads as one
instrument; a segment that announced itself as a button would break the row. Use it only
for page-level actions, never for navigation — that is what `.bar__nav` is for.

## Tokens

`--chrome-bg`, `--chrome-border`, `--chrome-border-strong`, `--chrome-label`,
`--chrome-label-strong`, `--content-primary`, `--primary`, `--accent` (dot), `--font-mono`

## Behaviour

The clock is filled by site JS (`#local-time`, Europe/Sofia). Status hides under 980px;
paddings tighten under 480px. Content below needs top clearance (hero well padding).

## A11y

`<nav aria-label="Primary">`; the dot is decorative (`aria-hidden`). Link hover inverts to
ink — AA contrast in both states.

## AI notes

- Three links maximum; this bar is a compass, not a sitemap.
- Nothing else may be `position: fixed` except the dialog — the bar owns the floating layer.
