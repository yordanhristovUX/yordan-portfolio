# content/ — the authoring contract

## What this owns

**Every word on the site and the CV.** If a sentence renders anywhere on
`index.html`, `cv.html`, or on one of the five `work/<id>.html` case-study pages, its source
is a file in this directory. Nothing else is a source of copy.

**Two shipped pages are outside that.** `evals.html`'s numbers-bearing regions are written
by `evals/run.mjs` (from the template in `content/evals.json` — see below), and `mcp.html` is
hand-authored end to end with no generated region at all. So the install page's copy is the
one body of prose on this site that nothing regenerates and no gate compares, which is
exactly why its tool list went stale when two tools were added. If you add a tool, `mcp.html`
is the file that will not tell you.

## The one rule

> **Copy is extracted verbatim. Never rewritten, never "improved", never summarised.**

Every word here was written by the repo owner. The entire point of the pipeline is that an
assistant's claims about him are traceable to something he actually wrote. Rewording a
sentence while moving it silently breaks that guarantee.

If a sentence reads awkwardly, **it ships awkward.** If two descriptions of the same
project differ, **both are preserved** — that is a decision, not an oversight. A project
carries a `{#summary}` (the index row) *and* a `{#subtitle}` (the case-study header) and
they genuinely differ; the site says "Heaviest lift" where the CV says "Heaviest deadlift";
the skills taxonomy is 6 rows on the site and 5 on the CV, mostly differently worded — with
two rows that share a `text` across both surfaces, one of them (`ai-workflows`) because the
owner decided to promote the CV's wording to the site. The
drift problem is solved **structurally** — all variants live adjacent in one file, so
updating one and forgetting the other stops being possible — not editorially. Collapsing
the wording is the owner's decision to make, not an agent's.

## What this consumes

Two generated files from the design system, both emitted by
`design-system/scripts/build.mjs` and neither ever hand-edited:

- `content/system.generated.json` — `{tokens, values, light, dark, print, wide, components,
  componentNames[]}`. Prose interpolates four of them — `{{tokens}}`, `{{values}}`,
  `{{components}}`, `{{dark}}` — so the numbers the site advertises about itself have exactly
  one source.
- `design-system/dist/components.json` — the derived component contract. This build folds it
  into `content/dist/content.json` under `designSystem`, **verbatim**, and reformats nothing.
  It is how the design system reaches the retrieval tools without anything importing it; the
  two design-system MCP tools read it from there.

`{{dark}}` is the newest of the four and it exists because of a failure, not a plan. The
dark-theme count was typed as a literal in two places instead of interpolated, so when the
design system re-aliased its way down to one fewer token nothing flowed, and both the CV and
a case study shipped a false number for as long as nobody re-read them. If you find yourself
typing one of these four figures into a sentence, that is the bug reproducing.

## What this emits

Via `scripts/build-content.mjs`:

- the `<!-- content:NAME -->` regions of `index.html` and `cv.html`
- `work/<id>.html` — the five case studies, **whole files** rather than regions, with every
  reference root-absolute because they are served one directory down
- `content/dist/content.json` — the retrieval index, plus `designSystem` (the component
  contract, folded in verbatim) and `evalsPage` (the `/evals` prose, shipped with its
  `{{evals:…}}` placeholders still in it for `evals/run.mjs` to fill)
- `content/dist/site.jsonld` — schema.org `Person` + `CreativeWork`
- `llms.txt`

`node scripts/build-content.mjs --check` compares all **ten** generated files against
`content/` and fails on a byte of drift. It also asserts that no HTML comment on any of the
four shipped pages contains a nested `<!--`, because comments do not nest and one that does
put a paragraph of developer prose live on the homepage.

**`js/case-studies.js` used to head this list and is gone.** It shipped
`window.CASE_STUDIES` so a modal could render a case study in JavaScript; the five have real
pages now, so it had become a second renderer for content already rendered as HTML — exactly
the drift this pipeline exists to remove. Nothing in `js/` reads it any more, and the
design-system counts gate that used to assert against it now asserts against
`work/portfolio-system.html`, where that paragraph moved.

## File format

### Structured data — `.json`

`profile.json` · `capabilities.json` · `skills.json` · `education.json` · `facts.json` ·
`evals.json`. JSON, not YAML: parsing YAML needs a dependency, and zero-dependency is a
property this repo advertises in public.

`evals.json` is the odd one and is worth a sentence. It holds the "Reading the numbers"
prose for `/evals` as a **template**: the paragraphs are authored here, the figures inside
them are `{{evals:…}}` placeholders, and this build ships them **unsubstituted** into
`content.designSystem`'s neighbour `content.evalsPage`. `scripts/build-content.mjs` may not
read `evals/` — `check-boundaries.mjs` forbids it — so `evals/run.mjs` is what fills them in
when it writes the page. The direction stays `content/` → `lib/knowledge/` → `evals/`, and
the prose still cannot advertise a number the runner did not produce.

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
| `{{tokens}}` `{{values}}` `{{components}}` `{{dark}}` | the design system's own statistics, from `system.generated.json` — **rendered on the page, elided from chunk text** |
| `{{year}}` | `<span id="year">…</span>` (footer copyright; site JS fills the real year) |
| `{{metric:N}}` | the Nth `metrics[]` entry as a `.stat` box, at that point in the body |
| `{{media:slot}}` | the named media slot as a `.ph` figure (or the SVG file, for `"type": "svg"`) |
| `{{media-grid:a,b}}` | two named slots as a `.ph-grid` |
| `{{links}}` | the frontmatter `links[]` as buttons — one renders bare, two or more inside a `<p>` |

A media slot named `cover` is emitted automatically at the top of the case study; it needs
no placeholder.

### The stats placeholders go two ways, and that is the point

A `{{tokens}}`/`{{values}}`/`{{components}}`/`{{dark}}` placeholder is **substituted** into
everything a reader sees — the page regions, the case studies, `llms.txt`, the non-chunk
fields of `content.json` — and **elided** from the retrieval chunks, where the placeholder is
replaced by nothing and the surrounding whitespace collapses.

That decoupling is load-bearing. `scripts/build-vectors.mjs` fingerprints the corpus as a
digest of the shipped chunk text. While the digits sat inside chunk text, adding one
component or renaming one token changed that digest, invalidated the committed embedding
cache, and cost a billed Voyage rebuild *and* a moved eval baseline — a pure design-system
change reaching all the way into the retrieval evaluation. Eliding the digits makes chunk
text invariant under a count change, so the digest holds and the published numbers stay
comparable.

Eliding rather than leaving `{{tokens}}` in place matters too: the placeholder would become a
BM25 term, would be embedded as noise, and — worst — `search_content` hands `chunk.text` to a
model, which would then quote *"Dark mode is {{dark}} tokens"* at a reader.

Nothing is lost by losing the digit, because these are structured data rather than prose.
`get_system_facts` returns `content.system` directly, so *"how many tokens?"* is answered by
the tool layer — the same argument `/evals` already makes for location and availability,
which are structured fields that deliberately appear in no chunk.

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
- the work-index row's `01`, `02`, … in `index.html` — formatted from `index`, and paired
  with the row's own name and client rather than concatenated into one string. (This bullet
  used to read `"02 / Green Street"` in `js/case-studies.js`. Both halves of that are gone:
  the file was retired with the modal, and the owner removed the section plate numbers from
  every page. The ordinal survives only in the work index, because those rows are an ordered
  list.)

## Divergences that are deliberate

Preserve both sides of each of these; they are the author's, not artefacts.

| Field | Site | CV / case study |
| --- | --- | --- |
| project description | `{#summary}` | `{#subtitle}` |
| project tags | `indexTags` | `tags` |
| project client / title | `indexClient` / `indexTitle` | `client` / `title` |
| ~~the "Power" fact label~~ | ~~"Heaviest lift"~~ | ~~"Heaviest deadlift" (`cv.label`)~~ — **retired, see below** |
| skills taxonomy | 6 groups, `skills.groups.*.site` | 5 groups, `skills.groups.*.cv` — except `ai-workflows`, whose `text` the owner has promoted to the site verbatim, and `engineering`, which has always shared a `text` and differs only in `term` |

**The "Power" fact divergence is retired, and the reason is worth keeping.** The site said
"Heaviest lift" where the CV said "Heaviest deadlift" — a real editorial decision, because
"lift" read better beside "I ship heavy things" and "deadlift" was the precise word a CV
wants. Both were *captions for a numeral*: the block rendered a large `250` with `kg` beneath
it, and the label named what the number measured. The owner then removed the numerals — the
labels are now whole sentences, and his own sentence contains the word "deadlift". So the
caption had nothing left to caption and the distinction it drew had already been made inside
the sentence. Both surfaces now read "I can deadlift 250 kg". **This is recorded rather than
silently deleted because a retired divergence and a forgotten one look identical in a diff**,
and the next reader of `facts.json` would otherwise have no way to tell whether the two
surfaces match by decision or by accident.

**"Differently-worded" was never entirely true, and that is the useful part of this row.**
`engineering` has shared its `text` across both surfaces since the taxonomy was authored;
nobody noticed, because the sentence sat in a table asserting the opposite. A divergence
table is only worth having if the absence of a divergence is recorded in it too — otherwise
the next agent reads "differently-worded", finds two rows that are not, and has to guess
whether it is looking at a bug or at a decision. Nothing checks this table; it is prose, and
it is only as true as the last person to read `skills.json` beside it.

## How to verify in isolation

```sh
node design-system/scripts/build.mjs      # refresh system.generated.json first
node scripts/build-content.mjs            # write every artefact
node scripts/build-content.mjs --check    # the CI gate — fails if anything is stale
npx serve .                               # open /, open all five case studies, print /cv
```

## What this must never do

- **Never** reword, tighten, expand or "fix" a sentence while moving it.
- **Never** hand-edit a generated file to make `--check` pass. Fix the source.
- **Never** put raw HTML in a content file.
- **Never** put a paragraph in frontmatter.
- **Never** import from `lib/`, `api/` or `js/`. Content is a leaf that emits artefacts;
  its consumers read those artefacts, never these files.
