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
  "links": [
    { "label": "Portfolio as a Product →", "href": "work/portfolio-system" },
    {
      "label": "GitHub repo ↗",
      "href": "https://github.com/yordanhristovUX/yordan-portfolio",
      "external": true
    }
  ],
  "media": [
    { "slot": "cover", "caption": "Cover — design system overview, 1600×900" },
    { "slot": "figma-library", "caption": "Figma library — components & tokens" },
    { "slot": "shipped-nav", "caption": "Shipped navigation, live in production" }
  ]
}
---

## Summary {#summary}

Green Street's first design system, and the steps that took it from a Figma library into
production: a shipped navigation component, an AI prototype pipeline for the TPM team, and a
product module rebuilt at 1:1 Figma parity with 100% token coverage.

## Subtitle {#subtitle}

A design system built in Figma, proven in production one green light at a time, now growing
into a git-based system that designers, developers and AI agents read from the same source.

## The brief {#context}

Green Street is a leading commercial real estate data and analytics company. I was hired to
build their first design system. They had a UI kit and some Figma variables, but the drift
between design files and the shipped product was severe; the UX audit found 16 variations of
the primary button alone.

The system I delivered covers colour, spacing, border radius and typography with a two-level
token architecture: primitives, including full Tailwind-style colour ramps, and a semantic
layer on top. Text styles are built from the tokens. The base components mirror the shadcn/ui
inventory, so every component in the library corresponds to a real coded component, and the
set works as a self-sufficient design system.

## The problem {#problem}

The system had one problem: it could not reach the codebase. Leadership backed initiatives
that bring revenue, and rebuilding the front end around a new component library was not on
the roadmap for the next year or more. That left the design system as a Figma artefact. It
changed nothing about the development cycle. We still lost hours helping developers get the
front end to look similar to the designs, and it was never an exact match. A design system
that only exists in Figma is a picture of a design system.

## First production code {#approach}

I started with the smallest thing I could ship myself. The header of our platform needed
better responsive navigation, so I asked a senior developer to let me build it, explained my
front-end experience and how I work with agents, and we agreed on a simple deal: I open a PR,
he reviews it. I designed the navigation in Figma, used Claude to learn the codebase's APIs,
conventions and style requirements, and wrote the component to match the design exactly, in
both pixels and behaviour. The PR was reviewed, approved and merged. It runs in production
today.

{{media-grid:figma-library,shipped-nav}}

## The TPM prototype pipeline {#approach}

The second step was for the TPM team. They were already using AI tools to mock new features,
but stakeholders hesitated to approve mocks that looked nothing like our platform. I built
them a component library based on my design system and shadcn, with tokens, layouts,
navigation, patterns and design rules, and an agent that assembles feature mocks from those
parts. Custom Claude skills handle the maintenance: extracting components from Figma, adding
new ones when a feature needs them, keeping tokens in sync. The library never targeted
production, so it didn't matter that it wasn't built on our Vue stack. The mocks now look
like the product, approvals go through, and TPMs iterate in minutes instead of waiting on
design time.

## The AI Assistant module {#system}

Then I was given the redesign of our AI Assistant, a chat module that connects to our own MCP
server and answers with text, charts, tables, cards and downloadable content. While designing
I read its codebase to learn the limitations, and found something better: the module is a
capsule. Its components are written in Vue 3, compiled to Web Components and rendered inside
a shadow DOM, so nothing inside it leaks into the rest of the platform.

That made it the perfect place to build the way I had been arguing for. The module was still
in beta. I took the plan to the project manager, the dev team lead and the global software
teams manager, and got a green light to prove it in one PR.

The design side came first: a small design system with only the tokens and components this
tool needs, every screen built from components, every component built on tokens, and every
description and decision documented to be read by agents as much as by people.

Then the PR. Every design token became a variable. Text styles became predefined mixins.
Every icon joined the library. Every existing component was refactored to remove hardcoded
values; some needed simple replacement, some needed behavioural work. I also built a
styleguide that renders the real components from the code, so I could verify every gap and
spacing in the inspector myself.

The work ran as a phased plan written by Claude and executed by different agents, with me
reviewing between phases. Figma MCP supplied the tokens and designs, but on complex
components its output drifts from the design, so every component was checked by hand against
the old hardcoded values.

After some sleepless nights and readjustments, all 35 components were on the token
architecture, written in SCSS variables and mixins, at 1:1 parity with Figma and 100% token
coverage, with functionality fully preserved and automated tests in the PR. For QA I added a
small agent that reads the repo and drafts acceptance criteria and manual test suggestions
per component.

The PR was accepted. The team kept building on the tokens and base components, and the module
now has a design system its developers and their agents can both read.

## In progress: the git-based system {#status}

That case earned a bigger mandate: not just the design system, but the workflow around it.
What I'm building now, prototyped but not yet approved, is a contract-first, git-based
system. Tokens and components live in the repository as the master copy, with design
decisions and their rationales recorded beside them. Every change is a pull request, verified
in CI. Each build generates a machine-readable contract, and every surface is produced from
that contract: the component package, the styleguide, an MCP endpoint for agents, and the
Figma library, which is pushed automatically. Designers keep designing in Figma; the
repository holds the truth. Because everything flows one way, two copies of a fact cannot
disagree.

## Outcomes {#outcome}

- The responsive navigation is merged and live in production.
- The AI Assistant module runs on tokens: 35 components, 1:1 Figma parity, 100% coverage, and
  the team keeps building on them.
- TPM prototypes now look like the product, and approvals go through.
- A contract-first, git-based design system exists as a working prototype, awaiting approval.

The proof that this architecture works is the page you are reading. A personal version of the
same system builds this portfolio: tokens, components and every word of copy live in one
public repository, CI verifies every generated artefact, and pipelines emit the site, the
Storybook, the Figma variables and an MCP server that answers from the same source. It is
smaller than the Green Street plan because its only user is me, not because it does less.

{{links}}
