---
{
  "id": "definition-row",
  "status": "stable",
  "since": "initial",
  "a11y": "A real <dl>: each row is a <div> wrapping one <dt>/<dd> pair, so the term/definition relationship survives with no ARIA."
}
---

# Definition row

A term and its definition, ruled off from the next pair — the skills list on the index and on
the CV. One of the two halves of what used to be `row`; the other is `project-row`, a
clickable index entry. They shared a name because both are full-width list rows and for no
other reason.

**Its appearance is generated.** The CSS block lives in a generated region of
`css/components.css` and is rendered from `definition.json` beside this file. Change how a row
*looks* there; when to reach for one at all stays here. It could be generated because every
relation it needs is one this format already had — a part, a `last` position, two scoped parts
reaching bare tags, and one named condition — which is exactly the argument for splitting the
component: the half that could be data was waiting on the half that could not.

**Not `profile`.** That is also a `<dl>` of pairs and it is a two-column *index of facts* —
mono, small, two pairs per row. This is one pair per row at body size, with a display-family
term. A skills list read as an index of facts would say the wrong thing about it.

## Pattern

```html
<dl class="tools">
  <div class="tools__row">
    <dt>Design</dt>
    <dd>Figma, design systems, component architecture, token systems</dd>
  </div>
</dl>
```

The `<div>` around each pair is not decoration: a `<dl>` may not have a `<dt>`/`<dd>` pair as
one grid item without it, and the wrapper is what the outer grid stacks.

## Tokens

`--content-primary`, `--font-display`, `--pad`, `--rule`, `--space-1`, `--space-4`,
`--space-7`, `--text-base`, `--text-md`, `--weight-extrabold`, `--width-body`

## A11y

- A real `<dl>` with real `<dt>`/`<dd>` pairs; the relationship is the markup's and needs no
  ARIA. Do not build one out of `<div>`s with classes.
- The term is uppercased in CSS (`text-transform`), never in the copy, so a screen reader
  still hears the word rather than the letters.

## AI notes

- One `<div class="tools__row">` per pair. A `<dt>` with two `<dd>`s under it is a different
  shape and this block does not lay it out.
- Definitions are comma-separated lists of tools, not sentences.
- Below 620px the pair stacks; the term track is gone and the gap drops to one step. Nothing
  in the markup changes.
