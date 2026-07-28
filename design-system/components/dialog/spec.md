---
{
  "id": "dialog",
  "status": "stable",
  "since": "initial",
  "a11y": "role=dialog aria-modal=true labelled by its title; the focus trap and focus restore are mandatory."
}
---

# Dialog (inner page)

Case studies open as a full inner page on the same skeleton: chrome bar (index + close),
scrollable band with rails and a solid content well. Slides up; backdrop veils the site.

## Pattern

```html
<div class="case" role="dialog" aria-modal="true" aria-labelledby="case-title" hidden>
  <div class="case__backdrop" data-case-close></div>
  <div class="case__panel" tabindex="-1">
    <div class="case__bar">
      <span class="case__index">Case study 03 / Client</span>
      <button class="btn btn--small" data-case-close aria-label="Close case study">Close ✕</button>
    </div>
    <div class="case__scroll">
      <div class="band">
        <div class="well case__well">
          <div class="case__head">
            <h2 class="case__title t-display t-display--lg" id="case-title">Title</h2>
            <p class="case__subtitle">One-paragraph summary.</p>
            <div class="case__meta chips"><!-- chips --></div>
          </div>
          <div class="case__content"><!-- h3 / p / ul / .ph / .stat / .btn --></div>
        </div>
      </div>
    </div>
  </div>
</div>
```

## Elements

| Class | Role |
| --- | --- |
| `.case` | Fixed full-viewport layer. `hidden` when closed |
| `.case__backdrop` | The scrim. Any `[data-case-close]` closes |
| `.case__panel` | The sheet: 90rem, paper, hairline edges. `tabindex="-1"` so it can take focus |
| `.case__bar` | Chrome bar: index on the left, Close on the right |
| `.case__index` | Written by `js/main.js` on open. Truncates rather than squeezing the Close button |
| `.case__scroll` | The one scroll container; `overscroll-behavior: contain` |
| `.case__well` / `.case__head` / `.case__title` / `.case__subtitle` / `.case__meta` | Header stack inside the band's well |
| `.case__content` | Injected case-study body: `h3` / `p` / `ul` plus Media, Stat, Button |

The band inside the dialog is a plain `.band` and gets its rails for free, like any band
on the page. There is no dialog-specific band class: `js/automata.js` decides which region
list a rail belongs to with `el.closest(".case")`, not with a class on the band.

## Tokens

`--chrome-bg`, `--chrome-border`, `--chrome-label-strong`, `--content-primary`,
`--font-display`, `--font-mono`, `--primary`, `--rule`, `--rule-strong`,
`--scrim` (the backdrop), `--surface-page`, `--text-2xs`, `--text-base`, `--text-sub`,
`--text-xs`, `--pad`, `--space-2`, `--space-3`, `--space-4`, `--space-5`, `--space-6`,
`--space-7`, `--space-flow-lg`

## Behaviour (site JS contract — js/main.js)

Open populates index/title/subtitle/meta/content from `js/case-studies.js`, locks body
scroll, rebuilds the case rails (`window.rebuildCaseSquares()`), slides the panel up, and
focuses it. Close: Escape, backdrop, or any `[data-case-close]`; focus returns to the
opener. Tab is trapped inside while open.

## A11y

`role="dialog" aria-modal="true"` + labelled by the title; focus trap and focus restore are
mandatory — never remove them when editing main.js.

## AI notes

- Content is `h3` sections with short paragraphs and `ul` lists; media slots (`.ph`) and at
  most one `.stat`; external links as `.btn btn--solid`.
- The dialog reuses Button, Chip, Media, Stat — nothing dialog-specific beyond its chrome.
