---
{
  "id": "meta",
  "index": 6,
  "client": "This site",
  "indexClient": "This Site",
  "title": "Portfolio as a Product",
  "hasCaseStudy": true,

  "tags": ["Designer & Builder", "Design system", "AI-first", "Storybook", "Figma push", "Open source"],
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
    }
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

An AI-ready design system that ships itself: repo-first tokens, Storybook, one-way Figma push,
auto-deploys — all open source.

## Subtitle {#subtitle}

The site you are reading runs on its own AI-ready, repo-first design system — open source,
rendered in Storybook, pushed to Figma, deployed on every commit. The portfolio is the case
study.

## The idea {#context}

A designer's portfolio usually **describes** process. This one **demonstrates** it: every
button, chip, and square on this page comes from a design system that lives in the same public
repository, documents itself for AI agents, and ships automatically. If I claim to build
AI-ready systems, the claim should be inspectable.

## The system {#system}

- **Repo-first tokens.** One JSON file is the only place a colour is born. A zero-dependency
  script generates the CSS variables this very page loads, plus a machine-readable flat file
  for AI agents and the Figma push.
- **Every component is three things.** A CSS block, an AI spec (canonical HTML pattern +
  do/don't rules), and a Storybook story. The build fails if any of the three is missing —
  governance as a 90-line script, not a platform.
- **The skeleton is the concept.** A 24-square sheet whose rails are real square divs sized by
  the layout's own fr-tracks — and Conway's Game of Life lives on them. Click a square: the
  life you seed is born blueprint-blue and its lineage fades to stone.

## The pipeline {#system}

{{media:pipeline}}

- **GitHub → Vercel.** Two deployments from one public repo: this site (pure static, no build)
  and the Storybook, rebuilt on every push to main.
- **Repo → Figma.** Tokens flow one way — an AI agent pushes them as Figma Variables following
  a written, idempotent procedure. Figma is an output, never a source.
- **Repo → AI.** CLAUDE.md routes any agent to the system's README and per-component specs; an
  agent can assemble correct UI from the canonical patterns without seeing the site first.

## Receipts {#outcome}

{{metric:0}}

- **0 accessibility violations** across the component library — axe-audited per story, WCAG
  2.1 AA contrast decisions documented inside the tokens themselves, and verified in *both*
  themes.
- **{{tokens}} tokens, {{values}} values, {{components}} components** — one token carries its
  light, dark and print values together; each component is enforced as CSS + AI spec + story by
  the build.
- **Dark mode is 24 tokens and zero component rules.** A themed colour carries its dark value
  beside its light one; the build emits the media query and the pinned-theme override. There is
  no `prefers-color-scheme` anywhere in the component CSS — the sharpest test a semantic token
  layer can be put to.
- **No build step in the site.** Two link tags consume the system; view-source shows
  everything.

{{media-grid:storybook,figma}}

## See for yourself {#status}

{{links}}
