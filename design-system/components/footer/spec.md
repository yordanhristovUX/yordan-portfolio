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

`--chrome-bg-strong`, `--chrome-border-strong` (text), `--font-mono`

## AI notes

- Two or three short spans max; the year is filled by site JS (`#year`).
- This is the only inverse-chrome surface on the page — don't reuse its style elsewhere.
