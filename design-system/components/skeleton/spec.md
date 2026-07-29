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
rail / well / rail, where a rail is **a whole number of 24px lattice cells** and the well
takes what is left. Grid lines inside the skeleton are inset box-shadows. **Never use
borders in skeleton elements**: borders change track math; inset shadows don't.

The rails and the strips are the automata's two regions, and they are **drawn, not built**.
Each hosts exactly one `aria-hidden` `<canvas class="automata">`. The graph paper behind
them is drawn once, by the **lattice root**, and every region is a transparent window onto
it. Where the model used to be one div per cell, there is now one element per region — see
"What it used to cost" below, which is kept as history because it is the reason several
rules in this file exist.

## Pattern

```html
<main class="sheet">
  <section class="band sec">
    <header class="sec__head">…</header>
    <!-- .rail--l / .rail--r and the canvas inside each are injected by
         js/automata.js. The graph paper needs no JS: it is CSS, and it is
         on the .sheet — a rail is a window, not a grid of its own. -->
    <div class="rail rail--l" aria-hidden="true">
      <canvas class="automata"></canvas>
    </div>
    <div class="well">…content on solid paper…</div>
    <div class="rail rail--r" aria-hidden="true">
      <canvas class="automata"></canvas>
    </div>
    <!-- optional: closes the plate on a lattice line. components/terminator/spec.md -->
    <div class="term" aria-hidden="true"></div>
  </section>
  <!-- 4-cell living separator; the engine injects its canvas too -->
  <div class="strip" aria-hidden="true"></div>
</main>
```

## Elements

| Class | Role |
| --- | --- |
| `.sheet` | 90rem max sheet, paper surface, hairline inset edges. **The lattice root**: it draws the graph paper and its own width is a whole number of cells |
| `.band` | rail / well / rail grid; `.sec__head` spans all columns. A band outside a sheet is its own lattice root |
| `.rail` (`--l`/`--r`) | Engine-injected side region. Height comes from the band row; it never gives any back |
| `.well` (`--flush`) | Solid-paper content column — the automata never sits under text. `--flush` removes the **inline** inset only; see "One vertical rhythm" below |
| `.strip` | Full-width living separator between sections. Four cells tall (three under 760px) |
| `.automata` | The one canvas per region. Absolutely positioned, transparent, `aria-hidden` |
| `.term` | Not this component's — [terminator](../terminator/spec.md). Named here because the rails span its row |

## One vertical rhythm, and it is not a colour's to decide

**Every content well is inset by `--pad-y` on the block axis, and that is two lattice cells.**
No section opts out. The horizontal inset (`--pad`) stays fluid, because a measure should
breathe with the viewport; the vertical inset does not, because section rhythm is structure
and structure is measured in cells here.

The rule exists because the page did not have one. `--flush` used to zero *both* axes, so a
section that wanted its grid to reach the rails horizontally also, silently, gave up its
vertical rhythm — and the sections that kept theirs were exactly the tinted ones, because a
tint makes a missing inset *look* broken while plain paper hides it. **The page's vertical
rhythm was therefore being decided by a colour.** Measured on `index.html` at 1280px:

| Section | Tinted | Inset above / below content |
| --- | --- | --- |
| `#about` `#work` `#notable` skills | no | **0 / 0** |
| `#background` `#unexpected` `#contact` | yes | 36 / 36 |

36px was `clamp(2rem, 5vh, 3.5rem)` at a 720px-tall window — **1.5 cells**, off the grid the
terminator exists to keep every plate on, and a different fraction of a cell at every window
height. It is `calc(var(--space-6) * 2)` now, so it is 48px at every viewport and moves with
the lattice if the lattice ever moves, exactly as the strip's height and the rail's width do.

Two things follow:

- **`--flush` means "the content reaches the rails", inline only.** If a grid needs to bleed,
  that is an inline decision and it says nothing about rhythm.
- **`sec--tint` is colour and nothing else.** It was carrying spacing by accident; it does not
  now, and a new tinted section needs no spacing thought at all.

**The one deliberate exception** is the hero, whose well takes `--space-nav` on top to clear
the floating bar. That is chrome clearance rather than section rhythm — it answers to the
bar's height, not to the lattice — and it is the only vertical inset on the page that is not a
whole number of cells. Its *bottom* is `--pad-y` like everything else.

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

At 90rem the two used to land on each other by accident — 90rem / 24 columns = 60px per
column, so a two-column rail was exactly five 24px cells — and **everywhere else they
missed**. That accident is now the rule: see "The columns snap to the lattice" below.

**The lattice is declared once**, in the graph-paper rule's `background-size` on the lattice
root. That is the only place the cell appears as a resolved length, and it is how
`js/automata.js` reads it back — see the snippet below — instead of restating 24 in JS. The
gradient and the canvas therefore cannot disagree about where a cell starts.

## One lattice, one origin

The graph paper used to be a `repeating-linear-gradient` pair on `.rail` and `.strip`, tiled
from **each region's own top-left corner**. Twenty-one regions meant twenty-one grids, and
where a rail met the strip under it the two were in step only by luck. Measured on
`index.html` at 1280px, the vertical phase of the first six regions down the sheet read
`0 · 14.53 · 22.33 · 17.48 · 12.31 · 20.11` px past a line — six different answers to "where
does a cell start". Horizontally it was worse in a subtler way: every region started at 0 in
its *own* frame, which is precisely why the mismatch was invisible in any one region and
obvious wherever two met.

It is drawn once now, by the **lattice root**, and a region is a transparent window onto it.
A junction cannot be out of step because there is only one grid left to be out of step with.

**There are two lattice roots and the pair is one sentence.** `.sheet` is the page's. A
`.band` that is *not* inside a sheet is its own — that is the case dialog, whose band lives
in its own scroller. It has to be the band rather than the panel because a background on a
scroll container does not scroll with the content lying over it, so the rails would slide
past a stationary grid. `.sheet .band { background-image: none }` hands a band inside a
sheet back to the sheet.

Two consequences for anything drawing on a region:

- **`.strip` lost its `background-color`.** An opaque strip is a lid over the sheet's
  lattice. `.well` keeps its paper for exactly the opposite reason: words are printed *on*
  the sheet, so paper over graph is what a well is. `.term` is paper for the same reason.
- **The origin is the root's, not the region's.** Cell (0,0) starts at the root's top-left,
  so turning a client rect into cell coordinates now needs a phase term. See the engine
  contract below.

What the graph paper is for has not changed:

- **With JS off** it is the whole effect: a blueprint margin, which is an intentional-looking
  page. The old model showed a grid of ~500 dead divs instead, which is the same picture but
  paid for.
- **With JS on** the canvas draws over it and the cells are translucent, so the lines still
  read through the living population. The canvas has no background of its own for exactly
  that reason — it must not paint the graph paper out.
- Both replace what used to be an `inset -1px -1px` box-shadow on every single square.

## The columns snap to the lattice

`2fr 20fr 2fr` makes a rail a fraction of the *container*, which is never a multiple of the
cell. Measured on `index.html`, a rail was **1.302 columns at 375px** — one square and a
third of another, which is the "half a square is showing" complaint exactly — 2.667 at 768,
3.555 at 1024 and 4.444 at 1280.

```css
--rail-track: max(var(--space-6), round(down, calc(100% / 12 + 0.02px), var(--space-6)));
grid-template-columns: var(--rail-track) 1fr var(--rail-track);
```

Five things in that line are load-bearing:

- **`100% / 12`, one expression for both breakpoints.** 2/24 and 1/12 are the same fraction,
  so the 760px media query was never changing a rail's *width*, only the number of columns
  it was described in. The `fr` rules stay as the `@supports` fallback and still say 24 and
  12, because that is still the grid the layout is designed on.
- **A percentage, not `cqi`.** `container-type: inline-size` on `.band` does **not** make the
  band its own query container — a container is a container for its *descendants* — so `cqi`
  in the band's own `grid-template-columns` falls through to the viewport. Measured in
  headless Chrome: a band inside a 1000px parent at a 1280px viewport resolved `8.3333cqi`
  to **106.656px**, i.e. exactly the viewport-derived number the change exists to stop using.
  A percentage in `grid-template-columns` already resolves against the grid container's own
  inline size, so it needs no containment, no new containing block for fixed descendants and
  no extra stacking context.
- **The `max()` floor is not defensive.** `round(down, 23px, 24px)` is `0`, so without it a
  rail vanishes below about 288px of band. One cell is the smallest rail that is still a rail.
- **The `0.02px` is not a fudge, and it is the sharpest thing measured in this pass.**
  Rounding *down* a value a hair under a multiple drops a **whole cell**, and `100% / 12`
  lands one LayoutUnit short of a multiple exactly when the band is a multiple of 288px.
  Measured in headless Chrome without it:

  | Band | Ideal share | `round(down, …)` | Should be |
  | --- | --- | --- | --- |
  | 1440 | 120.000 | **96** | 120 |
  | 1152 | 96.000 | **72** | 96 |
  | 864 | 72.000 | **48** | 72 |
  | 576 | 48.000 | **24** | 48 |

  1440 is the sheet at its 90rem maximum, so the failure is every desktop above it — the
  rail would have gone *backwards*, from 4.444 columns to 4 where the old accident already
  gave it 5. With the epsilon all four are correct, and 1439 still resolves to 96, so it
  rescues an exact multiple without ever promoting a real remainder. One LayoutUnit is
  1/64px; 0.02px is that plus a hair, which is the smallest quantity the engine can be
  wrong by and far below anything a rail can be seen to gain.
- **`@supports`**, because `round()` is Chrome 130+ / Firefox 127+ / Safari 15.4+. Without
  it the `fr` tracks stand and the page behaves exactly as it did before.

### Snapping the rails is not enough on its own

`rail + well + rail = W`. If both rails are multiples of the cell then the well is one *only
when W is*. Otherwise the left rail lands on a line, the well swallows the remainder, and
the **right** rail starts mid-cell — a half square at the inner edge of every right margin,
which is worse than what it replaces. The strip has the same defect from the same cause:
measured **52.708 columns** at 1280px.

So the lattice root rounds its own inline size down to a whole number of cells and centres
the 0–23px left over (0–11.5px a side) against the page's sunken ground — which is what
already happened above 90rem, where the sheet is 1440px = exactly 60 cells. It is scoped
`@media screen`: `--chrome-grid` prints as `transparent` and every region is `display: none`
on paper, so a snapped sheet on paper would be up to 24px of measure given up for a grid
that is not there. One place, rather than a reset a future page stylesheet can forget.

Measured on `index.html`, before → after:

| Viewport | Sheet | Rail width | Rail cols | Strip cols | Right rail's phase |
| --- | --- | --- | --- | --- | --- |
| 375 | 375 → **360** | 31.25 → **24** | 1.302 → **1.000** | 15.625 → **15.000** | 7.75 → **0** |
| 768 | 768 → **768** | 64 → **48** | 2.667 → **2.000** | 32.000 → **32.000** | 8.00 → **0** |
| 1024 | 1024 → **1008** | 85.33 → **72** | 3.555 → **3.000** | 42.667 → **42.000** | 2.66 → **0** |
| 1280 | 1280 → **1272** | 106.66 → **96** | 4.444 → **4.000** | 53.333 → **53.000** | 21.33 → **0** |
| 1440+ | 1440 | 120 | 5.000 | 60.000 | 0 |

There is no partial cell left anywhere on the horizontal axis, at any width. The vertical
axis is the terminator's — `components/terminator/spec.md`.

## Every rect maps onto cells — now with one phase term

The canvas is `position: absolute; inset: 0; width: 100%; height: 100%` — the region's box
exactly, with the same origin. So cell coordinates are one division away from any client
rect. What is new is that the *lattice's* origin is the root's, not the region's, so the
division picks up an offset:

```js
const root = region.closest(".sheet") ?? region.closest(".band");   // the lattice root
const cell = parseFloat(getComputedStyle(root).backgroundSize);     // 24
const rr = root.getBoundingClientRect();
const r  = region.getBoundingClientRect();
const phaseX = (((r.left - rr.left) % cell) + cell) % cell;   // 0 on every rail today
const phaseY = (((r.top  - rr.top ) % cell) + cell) % cell;

const box = el.getBoundingClientRect();
const col0 = Math.floor((box.left - r.left + phaseX) / cell);
const row0 = Math.floor((box.top  - r.top  + phaseY) / cell);
```

`phaseX` is `0` for every rail and strip on a snapped sheet — that is what the column
snapping bought. `phaseY` is whatever the band above happened to end on, and driving it to
`0` is the terminator's job.

**The step is read from the root, and only from the root.** `.rail, .strip` used to keep a
bare `background-size: var(--space-6)` with no `background-image` — a bridge that drew
nothing, declared so the engine's older read of a *region's* computed `background-size` could
not go `NaN` and take every canvas down at once. The condition for retiring it was "once the
engine takes both the step and the phase from the root", and that is now the case:
`js/automata.js` resolves the lattice root and reads the step from its computed
`background-size` and the phase from its client rect. **The declaration is gone.** A region
carries no background of its own, which is the rule stated positively: a region is a
transparent window onto the one lattice, and a background on it would be a second grid.
`.term` still carries a `background-size` and that one is load-bearing — it tiles a real
`background-image`, its diagonal.

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
| `.rail` | `max(1 cell, round(down, band/12, 1 cell))` — a whole number of cells | the band row(s) it spans, which the `.well`'s content sets |
| `.strip` | the sheet, which is itself a whole number of cells | `calc(var(--space-6) * 4)` — three cells under 760px |

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
strip, and runs Conway's Life over a cell grid whose origin is **the lattice root's**
top-left corner, offset into each region by that region's phase. The simulation is
deliberately wider than the picture — rails run hidden columns under the paper, strips run
hidden rows above and below — so patterns drift in from off-stage instead of appearing out
of nothing at the edge.

What the engine must hold up, all of it a consequence of the CSS above:

| | |
| --- | --- |
| Cell size | read from the computed `background-size` of the **lattice root** — `region.closest(".sheet") ?? region.closest(".band")` — never a literal. The region still carries the same `background-size` as a bridge; taking it from the root is what makes the step and the origin one answer |
| Lattice phase | `((regionRect.top − rootRect.top) % cell + cell) % cell`, same for `left`. The canvas must draw its first row/column at `−phase` so its cells sit in the root's squares, not in its own. `phaseX` is 0 on every rail and strip today; `phaseY` is not, until the terminator runs |
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
wash down both margins and across every separator. So `.rail, .strip, .term { display: none }`
belongs in the `@media print` block of every page that ships a sheet — layout only, no
colour. `css/cv.css`, `css/mcp.css` and `css/evals.css` have carried that line for other
reasons since before there was a canvas; `css/style.css` did not, and now does. The
terminator joins it for the same reason: its diagonal is `--chrome-grid` and vanishes on
paper by itself, but its plate and its two hairline edges would print as an empty 24px band
under every section.

**The one exception is the sheet's own width, and it is here rather than there on purpose.**
`round(down, 100%, var(--space-6))` exists only to make a grid land, and the grid is not on
paper. Scoping it `@media screen` in `components.css` means a page stylesheet has nothing to
remember — the alternative was a fourth line in four `@media print` blocks and a fifth one
missing the day a fifth page ships.

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

`--rail-track` is in the block too and is **not** a design token: it is this component's own
name for one derived length, declared on `.band` and read twice in the same rule so the
expression is written once. Tokens are born in `tokens.json`; a local custom property that
exists only to avoid repeating an expression is a variable, and the two are listed together
here only because the contract gate reads `var()` uses rather than intentions.

## AI notes

- Never set a px width or height on a skeleton element. The horizontal layout is
  `round(down, …)` against the lattice with an `fr` fallback, and nothing else; vertical is
  the well's content, except the strip and the terminator, which are stated multiples of the
  lattice. A literal px here desynchronises the squares from the layout, which is exactly
  what the rounding exists to stop.
- The lattice is `--space-6`, declared once. Change it there and the graph paper, the rail
  width, the strip height, the terminator's base and the engine's cell size all move
  together; change it anywhere else and they won't.
- **There is one lattice and it belongs to the root.** Do not put a `background-image` on a
  `.rail`, a `.strip` or a `.band` inside a sheet — a second grid is the bug this design
  exists to remove. If something needs to *hide* the lattice, give it paper
  (`background-color: var(--surface-page)`), which is what `.well` and `.term` do.
- New sections: `<section class="band sec">` + `sec__head` + `well`; rails come free. Add a
  `.term` as the last child if the section should end on a lattice line.
- Nothing goes inside a `.rail` or a `.strip` but the engine's canvas. Anything in flow there
  brings back a failure this system spent a long time learning about.
