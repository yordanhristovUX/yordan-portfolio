# Yordan Hristov — Portfolio, built on its own design system

**Live site:** https://yordan-portfolio.vercel.app · **Storybook:** https://yordan-design-system.vercel.app

A senior product designer's portfolio that doesn't just *describe* AI-ready design systems —
it runs on one. Static HTML/CSS/JS with **no build step**, consuming an AI-first, repo-first
design system that lives in this same repository, documents itself for both humans and AI
agents, renders in Storybook, and pushes its tokens to Figma.

```
tokens/tokens.json ──▶ build.mjs ──▶ dist/tokens.css ────▶ the site (2 <link> tags)
   (source of truth)     (zero deps)   dist/tokens.flat.json ─▶ AI agents · Figma push
                                       css/components.css ──▶ site + Storybook
components/*/spec.md  ◀── every component = CSS + AI spec + story (build-enforced)
```

## The design

**Utilitarian brutalism with a blueprint/engineering aesthetic.** Warm stone paper for
content, cold slate for chrome, iron-gall ink as primary, one scarce blueprint-blue accent.
The page skeleton is a 24-square sheet whose side rails are *real* square divs sized by the
layout's own `fr` tracks — and Conway's Game of Life lives on those squares. Hover one and
it lights accent-blue; click to seed new life whose lineage stays visibly yours for a few
generations. "An old sketchbook with machines that help."

## The system (`design-system/`)

- **Repo-first tokens** — [`tokens/tokens.json`](design-system/tokens/tokens.json) is the
  only place a colour is born; a zero-dependency script generates the CSS variables the site
  loads and a flat JSON that AI agents and the Figma push read. 54 tokens, two tiers
  (raw ramps → semantic layer).
- **15 components, triple-enforced** — each is a CSS block + an AI spec
  ([example](design-system/components/button/spec.md)) + a Storybook story; `npm run build`
  fails if any leg is missing.
- **AI-first** — [`CLAUDE.md`](CLAUDE.md) routes agents to
  [`design-system/README.md`](design-system/README.md); every spec carries canonical HTML
  patterns and do/don't rules written for machine consumption.
- **Figma is an output** — one-way repo→Figma variables push, executed by an AI agent via
  the Figma MCP: [`figma/push-guide.md`](design-system/figma/push-guide.md).
- **Storybook** — vanilla-HTML stories over the very CSS the site ships, with the a11y
  addon on every story (0 violations).

## Run it

```sh
npx serve .                      # the site — no build step
cd design-system
npm install
npm run build                    # tokens → dist + coverage check
npm run storybook                # Storybook on :6006
```

## Accessibility

WCAG 2.1 AA is a stated tolerance, not an aspiration: AA-checked contrast baked into the
token choices (documented in tokens.json), full `prefers-reduced-motion` handling, dialog
focus trap/restore, semantic landmarks, keyboard focus rings throughout.

## License

Code is MIT. Case-study texts and personal content are © Yordan Hristov, all rights
reserved. The full story of this repo is a case study on the site itself — *This Site —
Portfolio as a Product*.
