# Figma push — full design system (MCP procedure)

One-way sync: **the repo is the source of truth; Figma is an output.** Never import from
Figma back into `tokens/tokens.json`, `css/components.css`, or `components/*/spec.md` by
script — changes happen in the repo first.

This procedure is written for an AI agent (Claude) to execute verbatim under the owner's
Figma session via the Figma MCP. It covers the **whole system**: tokens → styles → pages →
components → template. It is idempotent: running it twice must not duplicate anything, and
running it after a repo change must **edit in place**, not rebuild.

Target file: `Yordan-Hristov-Porfolio-Design-System`, file key `Y8XkJGPy6kFNP0Ary3JOT5`
(ask the owner before writing anywhere else).

## The update contract (read this before any rerun)

| Layer | Matched by | On change | On removal from repo |
| --- | --- | --- | --- |
| Variables | name within collection | mutate value/alias/scopes in place | report only — human deletes |
| Text / effect styles | style name | mutate in place | report only |
| Pages | page name | create if missing | never delete |
| Components / sets | component name on its page | **mutate nodes in place** | report only |
| Doc content, examples, Dialog template | node name | wipe & regenerate freely | n/a |

**Never delete or recreate an existing COMPONENT / COMPONENT_SET node.** Its ID is what
every placed instance points at; delete it and every instance in every file breaks. Small
change (a token, a padding, a font size) → edit the existing nodes inside the variant.
New variant → build it and append into the existing set. Only a structural redesign
justifies a rebuild, and only with the owner's explicit go-ahead in that conversation.
Variable and style IDs survive in-place mutation, which is why bindings never need
re-touching after a token-only rerun.

## Preconditions

1. The Figma MCP connector is **authorized** and `whoami` shows the owner's personal
   account (not a work account). If tools error with auth, stop and ask — do not work around.
2. `dist/tokens.flat.json` is fresh: run `npm run build` in `design-system/` first.
3. Fonts **Archivo, IBM Plex Sans, IBM Plex Mono** are available in Figma (they are, as
   Google Fonts). Every text write loads its font first.
4. Load the `figma-use` skill before any `use_figma` call; for component work also load
   `figma-generate-library`.

## Phase 1 — Tokens (variables)

1. Read `design-system/dist/tokens.flat.json`. Each entry:
   `"<category>.<name>": { cssVar, value, resolved?, description? }`.
2. Ensure **variable collections** exist (one mode, "Value"): `color` · `font` · `space` ·
   `border`. Categories `color-stone`, `color-slate`, `color-ink`, `surface`, `primary`,
   `content`, `chrome`, `action`, `accent` → **color**; `font` → **font**; `space` →
   **space**; `border` → **border**.
3. For every token, create-or-update a variable named `<category>/<name>`:
   - **COLOR** for any value/`resolved` that parses as hex / rgb() / hsl() (use `resolved`
     when present). RGBA floats 0–1. `accent-rgb` is a STRING (triplet, not a colour).
   - **STRING** for everything else (font stacks, clamp() expressions, border shorthands) —
     pushed verbatim; they document intent.
   - Carry `description` over; set WEB code syntax to `var(<cssVar>)`.
4. **Aliases:** where `value` is `var(--x)` and `--x` is a pushed variable, set a Figma
   variable **alias** (semantic layer stays live). Fall back to resolved value if aliasing fails.
5. **Prune check (report, don't delete):** list variables with no matching token.

## Phase 2 — Styles

Text styles are named after the CSS levels and updated by name. Sizes are the **desktop
max** of each clamp (rem × 16); Figma cannot set Archivo's `wdth` axis (site uses 105–115)
— plain Archivo weights are the accepted approximation.

| Style | Font | Size / LH / LS | Case |
| --- | --- | --- | --- |
| `display/hero` | Archivo Black | 168 / 90% / −2% | UPPER |
| `display/xl` | Archivo Black | 120 / 95% / −1.5% | UPPER |
| `display/lg` | Archivo Black | 54 / 95% / −1.5% | UPPER |
| `title` | Archivo ExtraBold | 46 / 100% / −1% | UPPER |
| `statement` | Archivo ExtraBold | 43 / 115% | sentence |
| `lead` | IBM Plex Sans Regular | 22 / 155% | — |
| `kicker` | IBM Plex Sans Regular | 16 / 160% | — |
| `label` | IBM Plex Mono Medium | 12.5 / 150% / +12% | UPPER |
| `body` | IBM Plex Sans Regular | 16 / 160% | — |

Effect style `chrome/bar`: inner shadow 0/0/0 spread 1 `#94a3b8` + drop shadow 5/5/0
`rgba(15,23,42,0.15)` — the nav bar "object lying on the sheet".

Descriptions on styles carry the CSS class they mirror. If `components.css` changes a
level, update the matching style in place — never create a parallel style.

## Phase 3 — Page skeleton

Create-if-missing, never delete, keep this order:

`Cover` · `Foundations / Color` · `Foundations / Typography` · `Foundations / Skeleton grid`
· `--- Components ---` · `Button` · `Chip` · `Card` · `Section head` · `Row` · `Fact` ·
`Stat` · `Media` · `Link grid` · `Profile` · `Nav bar` · `Footer` · `--- Templates ---` ·
`Template / Dialog`

Foundations content (swatch grids with alias annotations, type specimens, skeleton
explainer) is doc content: safe to wipe & regenerate on every run. Root doc frames carry
stable names (`primitives`, `semantics`, `type-specimen`, `skeleton-explainer`, `cover`).

## Phase 4 — Components

Source of truth: `css/components.css` (geometry, tokens) + `components/<name>/spec.md`
(variants, usage rules → component **descriptions**). Every fill/stroke binds a variable;
QA must find **zero unbound solid paints** inside components. rem × 16 → px; clamp at
desktop max.

Inventory (stable names — the idempotency keys):

| Component (page) | Variants | Properties |
| --- | --- | --- |
| `Button` (Button) | Style=Outline/Solid × Size=Default/Small × State=Default/Hover | Label |
| `Chip` (Chip) | Style=Outline/Solid | Label |
| `Card` (Card) | Style=Eyebrow/Ruled | Title, Body, Eyebrow |
| `Section head` (Section head) | — | Number, Title, Note, Show note |
| `Row / Project` (Row) | State=Default/Hover | Number, Client, Project, Description, Show tags |
| `Row / Definition` (Row) | — | Term, Definition |
| `Fact` (Fact) | — | Number, Unit, Show unit, Title, Label |
| `Stat` (Stat) | — | Number |
| `Media` (Media) | Ratio=16:9 / 4:3 | Label |
| `Link grid item` (Link grid) | State=Default/Hover | Label |
| `Profile item` (Profile) | Value=Default/OK | Term, Value |
| `Nav bar` (Nav bar) | — | Name, Status, Show status |
| `Footer` (Footer) | — | Left, Right |

Update flow per component: find the set/component by name on its page → if missing, build
it → if present, diff against CSS/spec and mutate only what changed (edits reach every
placed instance automatically). New variant: build a matching component and append to the
set. Spec'd-away variant: **report**, don't delete. Example frames next to components
(`example / …`) are doc content — regenerate freely.

Build gotchas (learned 2026-07-19): `figma.createAutoLayout()` frames default to a white
fill — clear `fills` on inner containers or hover surfaces bleed white. Figma strokes are
one paint per node — a frame needing a 2px ink top rule *and* a 1px hairline bottom needs
the rule on a nested wrap (see Card ruled title). `counterAxisAlignItems` has no
`STRETCH`; use `layoutSizingVertical = 'FILL'` on children (Nav bar cells).

## Phase 5 — Template / Dialog

Composed **only from instances** (Button, Chip, Media, Stat) plus plain text — never from
detached copies. Safe to wipe & regenerate; it's derived output. If the owner has manually
edited the template since the last push, ask before regenerating.

## Phase 6 — Verification

- Variables: count matches `tokens.flat.json`; spot-check `surface/surface-page` aliases
  `color-stone/stone-100`, `accent/accent` ≈ rgb(0, 60, 240).
- Styles: 9 text styles + `chrome/bar` present by name.
- Components: all 13 present with variant counts per the inventory; binding audit finds
  zero unbound visible SOLID paints inside components; no unnamed nodes.
- Report a summary table: created / updated / aliased / skipped / pruned-candidates.

## Unit conversion table

| CSS | Figma |
| --- | --- |
| hex / rgb() / hsl() | COLOR, RGBA floats 0–1 |
| `1rem` | 16 (×16) |
| `clamp(a, b, c)` | c (desktop max), noted in description |
| `200ms` | FLOAT 200 (strip unit) |
| var()/clamp() as token value | STRING verbatim (or alias) |
| `font-variation-settings: "wdth" N` | not settable — nearest static weight |

## State (last full push)

2026-07-19: 54 variables (19 live aliases) · 9 text styles + 1 effect style · 19 pages ·
13 component sets, zero unbound paints. First push was tokens-only; components and styles
were added the same day under this contract.
