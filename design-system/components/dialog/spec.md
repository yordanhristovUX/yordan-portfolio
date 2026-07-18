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
      <div class="band case__band">
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

## Tokens

`--surface-page`, `--chrome-bg`, `--chrome-border`, `--rule`, `--rule-strong`, `--pad`,
content typography tokens

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
