---
{
  "id": "portfolio-system",
  "index": 1,
  "client": "This site",
  "indexClient": "This Site",
  "title": "Portfolio as a Product",
  "hasCaseStudy": true,

  "tags": ["Designer & Builder", "Design system", "AI-first", "MCP server", "Storybook", "Figma push", "Open source"],
  "accentTag": "Open source",

  "indexTags": ["Design system", "AI-first", "Open source"],
  "indexAccentTag": "Open source",

  "metrics": [
    { "value": "0", "label": "accessibility violations", "kind": "count" }
  ],
  "links": [
    {
      "label": "GitHub repo ↗",
      "href": "https://github.com/yordanhristovUX/yordan-portfolio",
      "variant": "solid",
      "external": true
    },
    {
      "label": "Storybook ↗",
      "href": "https://yordan-design-system.vercel.app",
      "external": true
    },
    { "label": "Retrieval evaluation →", "href": "evals.html" },
    { "label": "MCP server →", "href": "mcp.html" },
    { "label": "The Green Street arc →", "href": "work/greenstreet-ds" }
  ],
  "media": [
    {
      "slot": "pipeline",
      "type": "svg",
      "src": "pipeline.svg",
      "caption": "One source of truth, four consumers, no manual steps between commit and production."
    },
    { "slot": "storybook", "caption": "Storybook — component library live" },
    { "slot": "figma", "caption": "Figma — variables after the first push" }
  ]
}
---

## Summary {#summary}

A portfolio built as a product: repo-first design system, compiled copy, an MCP server and a
chat assistant answering from one corpus, and a published retrieval evaluation. Open source,
no build step in the site.

## Subtitle {#subtitle}

Every claim on this page is inspectable in the same public repository that renders it. If the
system were not real, this page could not exist in the shape it does.

## The idea {#context}

A designer's portfolio usually **describes** process. This one **demonstrates** it: every
button and chip on this page comes from a design system that lives in the same public
repository, documents itself for AI agents, and ships automatically. If I claim to build
AI-ready systems, the claim should be inspectable. And it goes past styling: every word here
is compiled from one authored source, so anything an AI assistant says about me on this site
is traceable to a sentence I actually wrote.

## The system {#system}

- **Repo-first tokens.** One JSON file is the only place a colour is born. Zero-dependency
  scripts generate everything downstream: the CSS custom properties the vanilla pages load,
  the theme the Next.js app builds on, a machine-readable flat file for AI agents, and the
  Figma push.
- **Every component is defined once.** Its variants, states and token bindings live as data
  beside the tokens; one pipeline renders them to CSS for the vanilla site, a second
  generates the typed React components the Next.js site imports. Spec and Storybook story
  still gate every component: governance as scripts, not a platform.

## The pipeline {#system}

{{media:pipeline}}

- **One definition, two renderers.** The component definitions compile twice. The first
  pipeline emits plain CSS classes, and the vanilla pages consume them with two link tags.
  The second emits a Tailwind theme that exposes every token as a native utility, then
  generates one typed React component per definition: the variant map derives from the
  definition's variants, and the utility classes resolve to the theme's tokens. Only
  behaviour is written by hand: focus, keyboard, ARIA. Appearance cannot drift between the
  two sites, because neither of them owns it.
- **GitHub → Vercel.** Three deployments from one public repo, each its own Vercel project,
  rebuilt on every push to main: the static site, the Storybook, and the statically exported
  Next.js front end.
- **Repo → Figma.** Tokens flow one way: an AI agent pushes them as Figma Variables following
  a written, idempotent procedure. Figma is an output, never a source.
- **Repo → AI.** CLAUDE.md routes any agent to the system's README and per-component specs; an
  agent can assemble correct UI from the canonical patterns without seeing the site first.

## The words are a pipeline too {#system}

Every sentence on the site and the CV is authored in one content directory and compiled
outward: the page regions, the five case-study pages, a JSON corpus for retrieval, schema.org
data, and `llms.txt`. Copy is moved verbatim, never rewritten by tooling, and a gate
byte-compares all ten generated files, so a word of drift fails the build.

## Ask the site itself {#system}

The corpus feeds a retrieval layer: BM25 and embeddings over the shipped chunks, eight tools,
and an answer schema whose validation gates reject a claim the corpus cannot support. Two
surfaces consume it. An MCP server lets agents install this portfolio as a tool, and the
on-page assistant answers with structured blocks resolved against the same corpus. Both draw
from what I actually wrote, because nothing else is in the corpus.

## Measured, not claimed {#system}

Retrieval quality is a published number, not a promise. A fixed question set runs against
several retrieval arms, the results table and the method live on the evals page, and a
committed baseline turns a regression into a failing gate. The eval page's own prose is
compiled by the same content pipeline with its figures left as placeholders for the runner to
fill, so the page cannot advertise a number the run did not produce.

## Receipts {#outcome}

{{metric:0}}

- **0 accessibility violations** across the component library: axe-audited per story, WCAG
  2.1 AA contrast decisions documented inside the tokens themselves, and verified in *both*
  themes.
- **{{tokens}} tokens, {{values}} values, {{components}} components.** One token carries its
  light, dark and print values together; each component is enforced as definition + spec +
  story by the build.
- **Dark mode is {{dark}} tokens and zero component rules.** A themed colour carries its dark
  value beside its light one; the build emits the media query and the pinned-theme override.
  There is no `prefers-color-scheme` anywhere in the component CSS: the sharpest test a
  semantic token layer can be put to.
- **Every boundary crossing is a generated artefact with a schema, never a code import.** A
  gate asserts the dependency direction and pins each legal crossing, and the whole check runs
  offline, with no API key and no network.
- **A second front end proves it.** A Next.js + React + TypeScript app renders the same nine
  pages from the published package and corpus alone. It exists to make the boundaries
  falsifiable: the moment it needs another slice's source, the architecture has failed.
- **No build step in the vanilla site.** Two link tags consume the system; view-source shows
  everything.

{{media-grid:storybook,figma}}

## See for yourself {#status}

This is also the personal version of the contract-first system in prototype at Green Street:
the same architecture, with one user.

{{links}}
