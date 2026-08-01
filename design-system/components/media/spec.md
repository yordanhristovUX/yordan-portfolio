---
{
  "id": "media",
  "status": "stable",
  "since": "initial",
  "a11y": "Every real <img> needs meaningful alt text describing the content, never 'screenshot'."
}
---

# Media slot

Labelled placeholder frame for project imagery. Drop a real `<img>` inside and the dashed
frame styling steps aside automatically (`:has(img)`).

## Pattern

```html
<figure class="ph"><span class="ph__label">Cover — design system overview, 1600×900</span></figure>

<div class="ph-grid">
  <figure class="ph"><span class="ph__label">Before — original front page</span></figure>
  <figure class="ph"><span class="ph__label">After — trust-first hierarchy</span></figure>
</div>

<!-- with an image: -->
<figure class="ph"><img src="cover.png" alt="Design system component overview"></figure>
```

## Variants

`.ph` 16:9 · `.ph--tall` 4:3 · `.ph-grid` two-up gallery (stacks under 640px)

## Tokens

`--chrome-bg`, `--chrome-border-strong`, `--chrome-label`, `--font-mono`, `--text-2xs`,
`--space-2`, `--space-4`, `--space-6`, `--tracking-wide-lg`, `--weight-medium`

## A11y

Once real images land, every `<img>` needs meaningful `alt` text describing the content,
not "screenshot".

## AI notes

- Labels state what belongs in the slot, with target size for covers (1600×900).
- One cover per case study at the top; galleries are pairs (before/after, two views).
