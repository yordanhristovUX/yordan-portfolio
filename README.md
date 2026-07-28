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
  only place a colour, a type size or a spacing step is born; a zero-dependency script
  generates the CSS variables the site loads and a flat JSON that AI agents and the Figma
  push read. 82 tokens carrying 140 values across light, dark and print, in two tiers
  (raw ramps → semantic layer).
- **Light, dark and paper from one source** — a themed token carries its `dark` value (and,
  where it matters, its `print` value) beside its light one; the build emits the media
  query, the pinned-theme override, and the print block. The entire dark theme is 23
  re-aliased semantic tokens and **zero** per-component dark rules — the sharpest test a
  semantic tier can be put to. No stylesheet anywhere contains a colour for print, and
  since the type scale landed, none contains a literal `font-size` either: paper gets its
  own pt sizes down the same pipe the colours use. `scripts/check-css.mjs` enforces it.
- **19 components, triple-enforced** — each is a CSS block + an AI spec
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
npx serve .                      # the site — no build step; / and /cv
cd design-system
npm install
npm run build                    # tokens → dist + coverage check
npm run storybook                # Storybook on :6006
```

`/cv` is the CV: same tokens, same components, light and dark on screen, and a real print
stylesheet — the colour half of which lives in `tokens.json`, not in the page.

## The MCP server (`api/mcp.js`)

The portfolio is also a **remote MCP server**: six read-only tools over the same content
index the site is built from, served over streamable HTTP. Add it to Claude Code —

```sh
claude mcp add --transport http yordan https://yordan-portfolio.vercel.app/api/mcp
```

— or to `claude_desktop_config.json`:

```json
{ "mcpServers": { "yordan": { "url": "https://yordan-portfolio.vercel.app/api/mcp" } } }
```

Then ask your own Claude "what did Yordan do at Domestina?" and it answers from
`get_project`, not from a chat widget on someone else's page. Setup, the tool table and the
reasoning are at [`/mcp`](mcp.html).

The tools are not implemented in `api/`. They live in `lib/knowledge/` as pure functions over
`content/dist/content.json`, and **both** consumers import that one module — the site's own
assistant calls it in process, this endpoint exposes it to everyone else. One core, two
surfaces, so a tool bug cannot exist on one and not the other. MCP here is a *distribution*
surface, not the web chat's internal boundary; `api/CLAUDE.md` says why routing the chat
through it was rejected.

Every tool is read-only by construction — no writes, no side effects, no state, no auth, no
API key on the server's side. That is what bounds the worst case of a public endpoint to cost
rather than to data.

## Accessibility

WCAG 2.1 AA is a stated tolerance, not an aspiration: AA-checked contrast baked into the
token choices **in both themes** (documented in tokens.json next to the values it justifies),
full `prefers-reduced-motion` handling, dialog focus trap/restore, semantic landmarks,
keyboard focus rings throughout.

The site also degrades rather than breaks: GSAP is vendored rather than fetched from a CDN,
and `main.js` only hides the animated-in elements once GSAP is confirmed loaded — so a
missing or blocked script yields a static, fully readable page instead of a blank one.

## License

Code is MIT. Case-study texts and personal content are © Yordan Hristov, all rights
reserved. The full story of this repo is a case study on the site itself — *This Site —
Portfolio as a Product*.
