---
{
  "id": "case-body",
  "status": "stable",
  "since": "initial",
  "a11y": "Headings are <h3> under the page's <h1>; the list marker is drawn with ::before, so it is decoration rather than content a screen reader reads out."
}
---

# Case study body

The prose of a case study: headings ruled off from one another, a measure on the paragraphs,
and the same list marker the rest of the site uses. It styles generated content — the body is
authored as markdown under `content/projects/` — so the selectors are element selectors under
one class rather than a class per element.

## Pattern

```html
<div class="well">
  <p class="t-lead">…the project's subtitle…</p>
  <div class="chips">…</div>

  <div class="case-body">
    <h3>Why it matters here</h3>
    <p>Green Street's users are professional analysts…</p>
    <ul>
      <li>WCAG 2.1 AA across two product surfaces</li>
    </ul>
  </div>
</div>
```

## It used to be the case-content block, inside a modal

The five case studies opened in a full-screen modal owned by `js/main.js`, and this block was
the part of that modal which rendered the study itself. **The modal is gone** — the five are
pages at `/work/<id>` — and what survived is the half that was never about being a modal.

The rename came with it. A class ending in "content" belongs to something, and this belongs to
nothing but the prose: it sits inside a `.well` on a project page, and it would be equally
correct anywhere else a project's body is rendered. The rest of that block — the overlay, the
panel, the backdrop, the chrome bar and the scroller around them — is deleted rather than kept
"in case", because a modal nothing opens is a focus trap nobody is maintaining.

The architecture note under `docs/` records why pages replaced it. The short version is that a
modal has no URL, and a case study that cannot be linked to is evidence nobody can cite.

## Elements

| Selector | Role |
| --- | --- |
| `.case-body h3` | A section heading, ruled off above, so the sections read as a stack of plates |
| `.case-body h3:first-child` | The first one loses that rule — a page does not open on a line |
| `.case-body p` | Body copy, held to a measure rather than to the well's full width |
| `.case-body ul` / `li` | The site's list: no native marker, a drawn one |
| `.case-body li::before` | The marker. `::before` rather than a character in the text, so it is decoration and is not read aloud |
| `strong` in either | Lifts to `--content-primary`; the prose around it sits at `--content-body` |

## AI notes

- **Do not add a class per element here.** The content is generated from markdown, so a class
  per element would mean the emitter had to know about styling. Element selectors under one
  root are what keep presentation out of `content/`.
- The measure on `p` is deliberate and narrower than the well. A case study is read rather than
  scanned, and the well is sized for the index.
- A heading here is `<h3>` because the page's `<h1>` is the project title and the section head
  above carries the number. Changing the level breaks the outline before it breaks anything
  visible.

## Tokens

`--content-primary`, `--font-display`, `--primary`, `--rule`, `--text-2xs`, `--text-sub`,
`--space-2`, `--space-3`, `--space-4`, `--space-6`, `--space-7`

`--primary` and `--text-2xs` are the list marker's: it is drawn small and in the brand ink, so
a list reads as a set of marks rather than as punctuation.
