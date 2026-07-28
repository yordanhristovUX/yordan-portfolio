---
{
  "id": "footer",
  "status": "stable",
  "since": "initial",
  "a11y": "The only inverse surface on the page; its label token is rated against that surface in both themes."
}
---

# Footer

Dark slate chrome strip closing the page: copyright + one line of voice.

## Pattern

```html
<footer class="foot mono">
  <span>© <span id="year">2026</span> Yordan Hristov — Sofia, Bulgaria</span>
  <span>Built by hand, with machines that help</span>
</footer>
```

## Tokens

`--chrome-bg-strong`, `--chrome-label-on-strong` (text), `--font-mono`, `--text-2xs`, `--pad`,
`--space-2`, `--space-4`, `--space-7`

## AI notes

- Two or three short spans max; the year is filled by site JS (`#year`).
- This is the only inverse-chrome surface on the page — don't reuse its style elsewhere.
- The label colour is a *label* token, not a border token. The obvious-looking
  `--chrome-border-strong` measures 2.7:1 as text here once dark mode inverts it.
  `--chrome-label-on-strong` exists for this one placement and deliberately has no `dark`
  value: the surface is near-black in both themes, so the label stays light in both.
