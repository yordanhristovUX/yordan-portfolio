---
{
  "id": "skeleton",
  "status": "stable",
  "since": "initial",
  "a11y": "Rails and strips are decoration: js/automata.js sets aria-hidden on every one, its canvas carries none of the page's meaning, and content never goes in them."
}
---

# Skeleton (sheet / band / rail / well / strip / automata)

The page's structural system: a 24-column sheet (12 under 760px). Every band splits into
rail (2 columns) / well (20 columns) / rail (2 columns). Those tracks are `fr`, and grid
lines inside the skeleton are inset box-shadows. **Never use borders in skeleton
elements**: borders change track math; inset shadows don't.

The rails and the strips are the automata's two regions, and they are **drawn, not built**.
Each hosts exactly one `aria-hidden` `<canvas class="automata">`; the graph paper behind it
is a repeating gradient on the region itself. Where the model used to be one div per cell,
there is now one element per region — see "What it used to cost" below, which is kept as
history because it is the reason several rules in this file exist.

## Pattern

```html
<main class="sheet">
  <section class="band sec">
    <header class="sec__head">…</header>
    <!-- .rail--l / .rail--r and the canvas inside each are injected by
         js/automata.js. The graph paper needs no JS: it is CSS. -->
    <div class="rail rail--l" aria-hidden="true">
      <canvas class="automata"></canvas>
    </div>
    <div class="well">…content on solid paper…</div>
    <div class="rail rail--r" aria-hidden="true">
      <canvas class="automata"></canvas>
    </div>
  </section>
  <!-- 4-cell living separator; the engine injects its canvas too -->
  <div class="strip" aria-hidden="true"></div>
</main>
```

## Elements

| Class | Role |
| --- | --- |
| `.sheet` | 90rem max sheet, paper surface, hairline inset edges |
| `.band` | `2fr 20fr 2fr` grid (mobile `1fr 10fr 1fr`); `.sec__head` spans all columns |
| `.rail` (`--l`/`--r`) | Engine-injected side region. Height comes from the band row; it never gives any back |
| `.well` (`--flush`) | Solid-paper content column — the automata never sits under text |
| `.strip` | Full-width living separator between sections. Four cells tall (three under 760px) |
| `.automata` | The one canvas per region. Absolutely positioned, transparent, `aria-hidden` |

## The lattice is a rhythm step, not an fr fraction

`--space-6` (24px) is the cell. That is the one number the whole automata is a function of,
and it is deliberately **not** derived from the rail's width any more.

The old model sized a square as `railWidth / 2`, so a cell was 53px at 1280px and 60px at
the sheet's full 90rem — the decoration was drawn on a grid nothing else on the page used.
Putting the cell on the spacing ramp instead makes it the top step of the same fixed 4px
ramp every gap, inset and offset inside a component is already built from — the largest
"inside a component" step there is, which is the right scale for decoration that has to
recede. That is what the automata needed in order to read as the paper the page is drawn on
rather than as something running beside it.

The tracks are unchanged: the *layout* is still `fr` all the way down, and the rail is still
exactly two of twenty-four columns wide. Only the lattice inside it is absolute. The two
land on each other at the sheet's full width, which is a nice accident worth recording:
90rem / 24 columns = 60px per column, so a two-column rail is exactly five 24px cells.
Everywhere else the trailing cell is clipped by `overflow: hidden`, which is what graph
paper does at the edge of a sheet.

**The lattice is declared once**, in the graph-paper rule's `background-size`. That is the
only place the cell appears as a resolved length, and it is how `js/automata.js` reads it
back — see the snippet below — instead of restating 24 in JS. The gradient and the canvas
therefore cannot disagree about where a cell starts.

## Graph paper is the fallback AND the grid

One `repeating-linear-gradient` pair on `.rail` and `.strip` draws a 1px `--chrome-grid`
rule at each cell's leading edges, tiled from the region's top-left corner.

- **With JS off** it is the whole effect: a blueprint margin, which is an intentional-looking
  page. The old model showed a grid of ~500 dead divs instead, which is the same picture but
  paid for.
- **With JS on** the canvas draws over it and the cells are translucent, so the lines still
  read through the living population. The canvas has no background of its own for exactly
  that reason — it must not paint the graph paper out.
- Both replace what used to be an `inset -1px -1px` box-shadow on every single square.

## Every rect maps onto cells, by construction

The canvas is `position: absolute; inset: 0; width: 100%; height: 100%` — the region's box
exactly, with the same origin. So cell coordinates are one division away from any client
rect, with no offset term to get wrong and nothing to keep in sync:

```js
const cell = parseFloat(getComputedStyle(region).backgroundSize);   // 24
const r = region.getBoundingClientRect();
const box = el.getBoundingClientRect();
const col0 = Math.floor((box.left - r.left) / cell);
const row0 = Math.floor((box.top  - r.top ) / cell);
```

That is what makes **content into walls** expressible: the engine can take any element's
rect — a well, the floating bar that lies over the sheet, the drawer — mark the cells it
covers dead, and life will flow around it instead of through it. Which rects earn that is
`js/automata.js`'s decision; this file's job is to guarantee the mapping is exact at every
breakpoint and after every resize.

The `.well` is the one that matters, and it is already a wall in the strongest possible
sense for a rail: the rail's box stops where the paper starts, so the paper is the region's
own edge. Content has never been allowed to sit on the automata (see the rule below), and
now the automata cannot be drawn under content either.

## Sizing: CSS owns the box, JS owns the bitmap

Neither region takes its size from what is inside it, and that is the whole design.

| Region | Width | Height |
| --- | --- | --- |
| `.rail` | the band's `2fr` track | the band row, which the `.well`'s content sets |
| `.strip` | the sheet | `calc(var(--space-6) * 4)` — three cells under 760px |

Both are therefore definite before a single cell exists, which is what a device-pixel-ratio
multiply needs: the engine sets `canvas.width = round(cssWidth * dpr)` and scales the
context, and there is no arrangement in which the answer depends on what it then draws.

`.strip` is the one that changed. It used to have no height of its own at all — it was two
rows of `aspect-ratio: 1` squares, and the squares were the height. Hand it a canvas child
under that arrangement and it collapses to nothing. Four cells is a stated number because a
separator's job is to be a fixed beat between sections, and a multiple of the lattice so the
last row of cells is never a sliver.

### The well sizes the band. The rail never does. (This used to need a property.)

`.rail` carried `contain: size` for most of this system's life, and it was load-bearing.
**It is gone, and the rule it protected is now a fact about the markup rather than a
declaration someone could delete.** The lesson is worth keeping in full, because it is the
sharpest failure this repo has recorded and the shape of it recurs:

> The engine measured the rail (`clientHeight / squareSize`) to decide how many squares to
> make. Without containment those squares fed back into the band's row height, the well
> stretched to match, and the next rebuild measured the height it had just caused. The loop
> is self-confirming, so it settles wherever it happens to land rather than converging on
> anything correct: one build that runs before layout has given the rail its real width is
> enough to kick it, and a band whose content is 420px tall ends up **36,000px tall with
> thousands of squares in it**.
>
> `contain: size` made the rail size purely from the outside — the well's content set the
> row, the rail filled it, and the squares stayed a consequence rather than a cause.

What replaces it is that there is nothing left to feed back. A rail's only child is a canvas
that is `position: absolute`, so the rail's in-flow content is empty and its intrinsic height
is zero whatever the automata is doing; and a canvas's bitmap is set *from* its box, never
the other way round. The failure is not prevented now, it is unbuildable.

Two things follow for anyone extending the system:

- **The rule survives the property.** Content lives in the well. If a new element belongs to
  the band directly it must be able to size itself without consulting the rails, and if
  anything is ever put *in flow* inside a rail, the loop above is available again. That is
  now caught by review rather than by a declaration, which is a deliberate trade: the
  declaration was mitigating a cost the design has since stopped paying.
- **The same failure exists from the other side and has no structural fix.** An unbounded
  content column grows the row exactly as a rail used to. That is why `.chat__thread`
  carries a max-height — see `components/chat/spec.md`.

## Automata engine contract (site js/automata.js)

Injects rails into every `.band` that has a `.well`, injects one canvas into every rail and
strip, and runs Conway's Life over a cell grid whose origin is the region's top-left corner.
The simulation is deliberately wider than the picture — rails run hidden columns under the
paper, strips run hidden rows above and below — so patterns drift in from off-stage instead
of appearing out of nothing at the edge.

What the engine must hold up, all of it a consequence of the CSS above:

| | |
| --- | --- |
| Cell size | read from the computed `background-size` of the region; never a literal |
| Bitmap | `canvas.width/height = round(cssPx × devicePixelRatio)`, context scaled to match |
| Ink | `--automata-cell-rgb` and `--accent-rgb`, read with `getComputedStyle`, **re-read on the `themechange` window event** |
| Hover | the canvas has no per-cell hit area, so the accent hover tint is the engine's to draw. It used to be a CSS `:hover` on the square |
| Click | seeds life, with an accent lineage that fades over ~10 generations. Hit-test against the canvas rect, not an element |
| Off-screen | regions pause; the page still breathes (a slow opacity sine, ~36s, phase-offset per region) |
| Reduced motion | the loop is **cancelled**, not left spinning on a no-op branch, and re-armed if the reader flips the setting back. Nothing in this file assumes a moving canvas |
| Rebuild | on resize and on `document.fonts.ready`; after DOM/layout changes in the dialog, `window.rebuildCaseSquares()` |
| Guard | a zero box must be survivable. The dialog's band has no layout until it opens, and every region is `display: none` on paper — a rebuild in either state measures 0 and must not divide by it |

**The two inks stay rgb triplets**, and a canvas makes the case for that stronger rather
than weaker. Alpha varies per cell — an age ramp times the breath, plus the accent lineage
countdown — so `globalAlpha`, which is per-draw-call state, would mean one draw call per
distinct alpha anyway. A triplet lets the engine build one `fillStyle` per alpha bucket and
fill every cell in that bucket at once. Neither ink is consumed by this component's CSS, so
neither appears in the token list below; both are `tokens.json`'s and the engine's.

## Print

The automata does not print, and the decision has two halves in two different places
deliberately.

**Its colour is already handled by tokens**, with nothing in any stylesheet: `--chrome-grid`
has a `print` value of `transparent`, so the graph paper disappears on paper without a print
rule existing anywhere. That is the general law — a colour that differs on paper is a token.

**Its geometry is handled by each page stylesheet**, because a canvas is not a background.
The squares used to tint themselves with `background-color`, which browsers drop from a
printout by default; a canvas prints as a raster image, and left alone it would put a grey
wash down both margins and across every separator. So `.rail, .strip { display: none }`
belongs in the `@media print` block of every page that ships a sheet — layout only, no
colour. `css/cv.css`, `css/mcp.css` and `css/evals.css` have carried that line for other
reasons since before there was a canvas; `css/style.css` did not, and now does.

## What it used to cost — kept as the record

Measured on `index.html` at 1280px, on a clean load, under the div model:

| | |
| --- | --- |
| Decoration divs in the document | **508** |
| Total elements in the document | 862 |
| Share of the DOM that is decoration | **58.9%** |
| Cells simulated per generation | **2,176** (4.3× the visible ones) |
| Per-square declaration | `transition: background-color 0.3s linear` |

(An earlier measurement, before the type and spacing scales landed, read 496 / 848 / 58.5% /
2,128. The band heights moved by a few pixels and the square count followed — which was the
point: under that model the node count was a function of layout, not of the engine.)

Three fifths of the page's nodes existed to render a cellular automaton nobody asked for,
each one carrying a colour transition. The engine bought that back where it could — regions
paused off-screen, the sim arrays were typed and flat, repaints were `background-color` only
— and it was affordable. It was never free, and every page that inherited this skeleton
inherited the bill.

**What the canvas model costs instead.** Arithmetic from the same measurement, not a new
one — the numbers below move with whatever the engine settles on:

| | Divs | Canvas |
| --- | --- | --- |
| Elements in the document | 862 | **375** (−508 squares, +21 canvases) |
| Decoration's share of them | 58.9% | **11.2%** (21 regions + 21 canvases) |
| Cells simulated per generation | 2,176 | **≈6,100** at a 24px lattice |

The cell count goes *up*, by about 2.8×, and that is the trade being made rather than a
regression to fix: a 24px lattice is 4.9× finer per unit area than the 53px squares it
replaces, and cells are now entries in a typed array and `fillRect` calls instead of
elements with transitions on them. Roughly 20,000 cell updates a second at the 300ms tick,
of which only the living ones are ever painted.

The derivation, so the figure can be re-run rather than trusted. The 2,176 above decomposes
exactly: 16 rails at (2 visible + 6 hidden) columns × 182 rows total = 1,456, plus 3 strips
at 24 columns × 10 simulated rows = 720. At a 24px lattice and the same band heights, the
rails become (5 + 6) × ~405 rows = 4,455 and the strips 54 × 10 × 3 = 1,620.

**One number in that is now out of proportion and is the engine's to re-derive.** The six
hidden columns were chosen when a rail was 2 columns wide — they were the sim's off-stage
wings, three times the picture. Against 5 visible columns they are still six, so more than
half of every rail's simulation is now spent off-stage. Three would give the same "patterns
drift in from somewhere" effect and take the rail from 4,455 cells to 3,240.

The two consequences the old model came with are worth restating in their new form:

- **Per-cell cost is no longer multiplied by 500 — it is multiplied by 6,000.** It just
  costs arithmetic instead of nodes. The thing to watch is the lattice: cells per region go
  as 1/cell², so halving the cell step quadruples the simulation everywhere at once, and the
  off-stage padding, which is pure cost and appears in no picture. Those two are what a gate
  on this component should bound now; the visible column count was a proxy for node weight,
  and there is no node weight left for it to proxy.
- **The node count is no longer a function of band height.** A taller band means more *cells*,
  not more elements, and a band that sized itself from its rails is no longer expressible.

## Tokens

`--chrome-border`, `--chrome-grid` (the graph paper), `--space-6` (the lattice),
`--surface-page`, `--pad`, `--pad-y`

## AI notes

- Never set a px width or height on a skeleton element — the horizontal layout is fr tracks
  and nothing else. Vertical is the well's content, except the strip, which is a stated
  multiple of the lattice.
- The lattice is `--space-6`, declared once. Change it there and the graph paper, the strip
  height and the engine's cell size all move together; change it anywhere else and they
  won't.
- New sections: `<section class="band sec">` + `sec__head` + `well`; rails come free.
- Nothing goes inside a `.rail` or a `.strip` but the engine's canvas. Anything in flow there
  brings back a failure this system spent a long time learning about.
