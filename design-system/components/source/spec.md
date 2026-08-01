---
{
  "id": "source",
  "status": "stable",
  "since": "phase-3",
  "a11y": "Real <ol>/<li>; the ordinal is content inside the item, not a CSS counter a screen reader would skip."
}
---

# Source (citations)

A numbered list of the passages an answer was actually built from. Each entry links to the
anchor it came from — the case study that holds it, or the page section — and prints the
chunk id it names.

The id is shown on purpose. It is not decoration and it is not a debug leak: it is the
smallest unit the corpus is addressable by, and showing it is what makes the claim
checkable rather than merely asserted.

## Pattern

```html
<div class="sources">
  <p class="sources__title mono">Sources</p>
  <ol class="sources__list">
    <li class="source">
      <span class="source__ref mono">1</span>
      <button class="source__link" type="button">Green Street — AI-Ready Design System — Approach</button>
      <span class="source__id mono">project:greenstreet-ds#approach</span>
    </li>
    <li class="source">
      <span class="source__ref mono">2</span>
      <a class="source__link" href="/cv#top">Profile — Background</a>
      <span class="source__id mono">profile#background</span>
    </li>
  </ol>
</div>
```

## Elements

| Class | Role |
| --- | --- |
| `.sources` | Rule-topped block. Sits last inside `.chat__answer` |
| `.sources__title` | Mono label — one word, never a sentence |
| `.sources__list` | `<ol>`, unstyled; the numbers are `.source__ref` boxes, not list markers |
| `.source` | One citation: ref box, link, chunk id |
| `.source__ref` | The boxed ordinal. Chrome-bordered, never accent |
| `.source__link` | `<button>` when the chunk belongs to a project with a case study (it opens the real dialog); `<a href>` otherwise |
| `.source__id` | The chunk id, verbatim. Breaks anywhere — ids are long and must not push the row wide |

## Variants

None. A citation is either resolvable or it is not rendered.

## Tokens

`--accent` (hover/focus only), `--chrome-border-strong`, `--chrome-label`,
`--chrome-label-strong`, `--content-primary`, `--font-mono`, `--rule`, `--text-2xs`,
`--text-sm`, `--space-1`, `--space-2`, `--space-3`, `--tracking-wide-2xl`,
`--weight-semibold`

No `prefers-color-scheme`. Both hover colours flip through their own `dark` token values.

## Where the ids come from

A chunk id reaches this list only after `validateProvenance` in `lib/knowledge/schema.js`
has confirmed **a tool actually returned it during that turn**. Referential validity is not
enough: the corpus is small enough for a model to guess a well-formed, resolvable, entirely
unread id, so gate 2 proves the id is real and gate 3 proves it was read. Ids that fail are
stripped server-side, and a `sources` block with nothing left is dropped.

That is why this component has no "unavailable source" state to design. There is no such
thing here — an unverified citation never reaches the browser.

## A11y

- Real `<ol>`/`<li>`: announced as a list with its count.
- `.source__ref` is inside the `<li>`, so the ordinal is read as content rather than being
  invented by a CSS counter a screen reader would skip.
- `.source__link` is a `<button>` when it opens the dialog and an `<a>` when it navigates —
  never an `<a>` with a click handler and no `href`.
- Focus and hover share the same treatment; the border, not colour alone, carries the state.

## AI notes

- Cite what a tool returned, nothing else. An id that was not retrieved is stripped, and the
  answer is weaker for having claimed it.
- One `.sources` block per answer, always last.
- Never truncate or prettify `.source__id`. The whole point is that a reader can paste it
  into `content/dist/content.json` and find the passage.
- Do not accent `.source__ref`. Accent has five sanctioned places (`tokens.json` `$doc`) and
  a citation ordinal is not one of them.
