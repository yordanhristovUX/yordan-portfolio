---
{
  "id": "greenstreet-ds",
  "index": 2,
  "client": "Green Street",
  "title": "AI-ready design systems and Agentic workflows",
  "hasCaseStudy": true,

  "tags": ["Senior Product Designer", "Design Systems", "AI Workflows", "Figma-to-code", "WCAG", "Production code"],
  "accentTag": "Production code",

  "indexTags": ["Design system", "AI", "Production code"],

  "metrics": [],
  "links": [],
  "media": [
    { "slot": "cover", "caption": "Cover — design system overview, 1600×900" },
    { "slot": "figma-library", "caption": "Figma library — components & tokens" },
    { "slot": "shipped-nav", "caption": "Shipped navigation, live in production" }
  ]
}
---

## Summary {#summary}

~35 components at 1:1 Figma-to-code parity, 100% token coverage, custom Claude skills, and a
prototype pipeline the whole TPM team uses. Production navigation shipped.

## Subtitle {#subtitle}

Infrastructure that lets AI generate production-faithful UI: 1:1 Figma-to-code parity, custom
Claude skills, and a prototype pipeline for the whole TPM team.

## The problem {#problem}

Green Street is a leading commercial real estate data and analytics company. I was brought in
to redesign the AI Assistant module, and found that PM wireframes, design files, and coded
components lived in separate worlds — a component could look one way in Figma and behave
completely differently in production.

- **Fragmented handoff.** No enforced relationship between mockups, design, and code.
- **AI couldn't read the system.** Every AI-generated UI drifted from the actual components.
- **No prototype pipeline.** TPMs pulled design resources into every minor exploration.

## The approach {#approach}

**Audit and architecture.** A full audit of the component landscape — duplication,
inconsistency, missing states, accessibility failures — then a token-first architecture with
semantic naming. Every component exposes its full range of states, so AI and developers never
need to guess.

**1:1 Figma-to-code parity.** A Figma library of **~35 components and growing**, each mapping
exactly to a coded component: same name, same props, same variants. I drove the alignment with
engineering — attending standups and reviewing implementations to catch drift early.

**Tokens in the frontend, not just the design file.** I implemented the tokens directly in the
frontend component library, replacing every hardcoded value for **100% token coverage across
the module**. A design system that only exists in Figma is a picture of a design system.

**A living style guide.** Every token and every component, rendered from the real
implementation — used for visual regression testing and for design-to-code comparison, so
drift is something you can see rather than something you discover in review.

**Custom Claude skills.** A persistent knowledge layer that teaches Claude to read the token
structure, assemble the correct native components, respect spacing and hierarchy, and generate
prototypes faithful to the real system. No drift. No invented components.

**TPM prototype pipeline.** A PM describes a screen; the pipeline assembles a working
interactive prototype from real system components. The feedback loop between product thinking
and validated interaction went from days to minutes.

## Shipping production code {#system}

I authored the complete responsive navigation component for the Green Street Analytics
platform — built with Claude Code guided by the custom skills, reviewed and approved by the
engineering team, and live in production. Not a prototype: production frontend code serving
real users.

{{media-grid:figma-library,shipped-nav}}

## Outcomes {#outcome}

- TPMs generate accurate prototypes without design involvement in every cycle.
- A single source of truth between Figma and code — translation ambiguity eliminated.
- Every new component added becomes immediately AI-accessible.
- A design-to-code pipeline in progress: from Figma screen to reviewed frontend implementation.

This work sits at the intersection of deep Figma craft, frontend architecture, and applied AI
expertise — not using off-the-shelf tools, but building the tools themselves.
