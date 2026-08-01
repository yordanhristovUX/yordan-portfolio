---
{
  "id": "entry",
  "status": "stable",
  "since": "initial",
  "a11y": "Role is <h3> under the section <h2>; bullet glyphs are ::before so the list is still announced as a list."
}
---

# Entry

A dated record: role, organisation, time span, and what happened. Used for the CV's
experience and education lists. One entry per position — never one per project.

## Pattern

```html
<article class="entry">
  <h3 class="entry__role">Senior Product Designer</h3>
  <p class="entry__span">Jan 2026 – Present · Sofia</p>
  <p class="entry__org">Green Street <em>— commercial real estate data and analytics</em></p>
  <ul class="entry__list">
    <li>Redesigned the AI Assistant module and built its design system end to end.</li>
    <li><strong>100% token coverage</strong> across the module.</li>
  </ul>
</article>
```

Source order is role → span → org, because that is the reading order for a screen reader
and for the mobile layout. The grid places `.entry__span` in the right-hand column on wide
screens without changing the DOM.

## Variants

None. An entry with no bullets simply omits `.entry__list`; an entry with no subtitle omits
`.entry__org`.

## Tokens

`--chrome-label`, `--content-muted`, `--content-primary`, `--font-display`, `--font-mono`,
`--primary`, `--rule`, `--text-2xs`, `--text-md`, `--text-sub`, `--text-xs`, `--pad`,
`--space-1`, `--space-2`, `--space-3`, `--space-6`, `--space-7`, `--space-flow`,
`--tracking-wide`, `--weight-extrabold`, `--weight-regular`, `--weight-semibold`,
`--width-sub`

## A11y

- `.entry__role` is `<h3>`: entries live under a section `<h2>`. Keep the order — do not
  promote the org to a heading to make it bigger.
- The span is plain text, not a `<time>`: it is a range with qualifiers ("Present",
  "advisory since 2022"), which `datetime` cannot express honestly.
- Bullet glyphs come from `::before` on an unstyled `<ul>`, so the list is still announced
  as a list and the marker is never read out.

## AI notes

- Do not reach for `.card` for a CV entry. Cards are fixed-height index cells with ~25 words;
  entries are variable-length records with bullets.
- Bullets are outcomes, not duties. Each one should survive the question "so what?".
- The dates column is `minmax(9rem, 14rem)`: long spans wrap rather than squeezing the role.
  Do not widen it to fit an unusually long string — shorten the string.
- Entries stack inside `.well--flush`; the component owns its own padding and dividers.
