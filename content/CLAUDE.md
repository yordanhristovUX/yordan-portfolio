# content/ — the authoring contract

## What this owns

**Every word on the site and the CV.** If a sentence renders anywhere on
`index.html`, `cv.html`, or inside a case-study dialog, its source is a file in this
directory. Nothing else is a source of copy.

## The one rule

> **Copy is extracted verbatim. Never rewritten, never "improved", never summarised.**

Every word here was written by the repo owner. The entire point of the pipeline is that an
assistant's claims about him are traceable to something he actually wrote. Rewording a
sentence while moving it silently breaks that guarantee.

If a sentence reads awkwardly, **it ships awkward.** If two descriptions of the same
project differ, **both are preserved** — that is a decision, not an oversight. A project
carries a `{#summary}` (the index row) *and* a `{#subtitle}` (the case-study header) and
they genuinely differ; the site says "Heaviest lift" where the CV says "Heaviest deadlift";
the skills taxonomy is 6 rows on the site and 5 differently-worded rows on the CV. The
drift problem is solved **structurally** — all variants now live adjacent in one file, so
updating one and forgetting the other stops being possible — not editorially. Collapsing
the wording is the owner's decision to make, not an agent's.

## What this consumes

`content/system.generated.json` — `{tokens, values, components}`, emitted by
`design-system/scripts/build.mjs`. Never hand-edited. Prose interpolates it with
`{{tokens}}`, `{{values}}`, `{{components}}`, so the numbers the site advertises about
itself have exactly one source.

## What this emits

Via `scripts/build-content.mjs`:

- `js/case-studies.js` — `window.CASE_STUDIES`, unchanged API
- the `<!-- content:NAME -->` regions of `index.html` and `cv.html`
- `content/dist/content.json` — the retrieval index
- `content/dist/site.jsonld` — schema.org `Person` + `CreativeWork`
- `llms.txt`

## File format

### Structured data — `.json`

`profile.json` · `capabilities.json` · `skills.json` · `education.json` · `facts.json`.
JSON, not YAML: parsing YAML needs a dependency, and zero-dependency is a property this
repo advertises in public.

### Prose entities — `.md` with JSON frontmatter

`projects/*.md` · `experience/*.md`.

````markdown
---
{
  "id": "greenstreet-audit",
  "index": 2,
  "client": "Green Street",
  "title": "UX & Accessibility Audits",
  "hasCaseStudy": true,
  "tags": ["Senior Product Designer", "Accessibility", "WCAG 2.1 AA"],
  "accentTag": "WCAG 2.1 AA",
  "indexTags": ["Accessibility", "Audit", "WCAG AA"],
  "metrics": [{ "value": "200+", "label": "Issue instances catalogued", "kind": "count" }],
  "media": [{ "slot": "cover", "caption": "Cover — annotated audit findings, 1600×900" }]
}
---

## Summary {#summary}

WCAG 2.1 AA audits of two product surfaces — editorial and data-dense analytics.

## Why it matters here {#context}

Green Street's users are professional analysts…
````

**Frontmatter holds ONLY structural data** — ids, short labels, short tag arrays, dates,
booleans, URLs, metric values. **No paragraphs. No multi-line strings. Ever.** JSON forbids
a literal newline inside a string, so the format enforces this for free; that is why the
DX objection to JSON ("no multi-line strings") is not a cost here — prose simply does not
live in frontmatter.

**Body is sections.** Every section is `## Free heading text {#kind}`. The heading text is
yours and is rendered to the reader; the `{#kind}` slug is the machine classification that
lets a tool return `sections.outcome` instead of pattern-matching on English.

Closed set of kinds — anything else fails the build:

`summary` · `subtitle` · `context` · `problem` · `approach` · `system` · `outcome` · `status`

Kinds may repeat within a file (two `{#approach}` sections is fine and common).

`{#summary}` and `{#subtitle}` are consumed elsewhere and are **not** rendered into the
case-study body: `{#summary}` is the index-row description and the card body;
`{#subtitle}` is the case-study header line.

### Inline markup — a small subset, no raw HTML

| Source | Renders |
| --- | --- |
| `**bold**` | `<strong>` |
| `*em*` | `<em>` |
| `` `code` `` | `<code>` |
| `[text](url)` | `<a href="url">` |

Everything else is HTML-escaped. **No content file may contain raw HTML.** Write a literal
`&` — the generator emits `&amp;`.

Paragraphs may be soft-wrapped: consecutive non-blank lines join with a single space.
Lists are `- ` items; continuation lines indent.

### Placeholders

| Placeholder | Effect |
| --- | --- |
| `{{tokens}}` `{{values}}` `{{components}}` | the design system's own statistics, from `system.generated.json` |
| `{{year}}` | `<span id="year">…</span>` (footer copyright; site JS fills the real year) |
| `{{metric:N}}` | the Nth `metrics[]` entry as a `.stat` box, at that point in the body |
| `{{media:slot}}` | the named media slot as a `.ph` figure (or the SVG file, for `"type": "svg"`) |
| `{{media-grid:a,b}}` | two named slots as a `.ph-grid` |
| `{{links}}` | the frontmatter `links[]` as buttons — one renders bare, two or more inside a `<p>` |

A media slot named `cover` is emitted automatically at the top of the case study; it needs
no placeholder.

## Rules the build asserts

- every project has a `{#summary}` section
- every case-study project also has a `{#subtitle}` section
- every `{#kind}` slug is in the closed set
- `accentTag` is a member of `tags`; `indexAccentTag` is a member of `indexTags`
- project ids are unique; every `period` has a `start`
- no directive references a missing metric, media slot, or link

## Things that are formatted, not authored

Do not type these — they are rendered from structured data, and typing them creates the
drift the pipeline exists to remove.

- `.entry__span` — `"Jan 2026 – Present · Sofia · Hybrid"` is formatted from
  `period: {start, end, note, location, mode}`.
- the `·`-joined education and language strings — formatted from the arrays.
- `"02 / Green Street"` in `js/case-studies.js` — formatted from `index` + `client`.

## Divergences that are deliberate

Preserve both sides of each of these; they are the author's, not artefacts.

| Field | Site | CV / case study |
| --- | --- | --- |
| project description | `{#summary}` | `{#subtitle}` |
| project tags | `indexTags` | `tags` |
| project client / title | `indexClient` / `indexTitle` | `client` / `title` |
| the "Power" fact label | "Heaviest lift" | "Heaviest deadlift" (`cv.label`) |
| skills taxonomy | 6 groups, `skills.groups.*.site` | 5 groups, `skills.groups.*.cv` |

## How to verify in isolation

```sh
node design-system/scripts/build.mjs      # refresh system.generated.json first
node scripts/build-content.mjs            # write every artefact
node scripts/build-content.mjs --check    # the CI gate — fails if anything is stale
npx serve .                               # open /, open all six case studies, print /cv
```

## What this must never do

- **Never** reword, tighten, expand or "fix" a sentence while moving it.
- **Never** hand-edit a generated file to make `--check` pass. Fix the source.
- **Never** put raw HTML in a content file.
- **Never** put a paragraph in frontmatter.
- **Never** import from `lib/`, `api/` or `js/`. Content is a leaf that emits artefacts;
  its consumers read those artefacts, never these files.
