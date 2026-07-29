---
{
  "id": "terminator",
  "status": "stable",
  "since": "phase-3",
  "a11y": "Pure decoration: it carries aria-hidden, holds no content and is never focusable or announced — its only job is to be the height nobody's words are using."
}
---

# Terminator

The last row of a plate. It is the only element in a band whose height is **nobody's
content**, which is exactly why it is the one that can absorb a section's remainder and let
the plate end on a lattice line.

A rail's height is its band's height, which is however much text the well holds, so its last
row is a fraction of a cell. Measured on `index.html` at 1280px, the eight rails ran
`40.605 · 12.473 · 39.785 · 32.051 · 29.850 · 15.503 · 7.839 · 25.097` rows — not one of
them whole, and every one of them a half square showing where a section stops. Hand the
fraction to the terminator and the plate closes on a line, so the region under it starts on
one too, and the sheet stays in step all the way down.

## Pattern

```html
<section class="band sec">
  <header class="sec__head">…</header>
  <div class="rail rail--l" aria-hidden="true"></div>
  <div class="well">…</div>
  <div class="rail rail--r" aria-hidden="true"></div>
  <!-- last child of the band, always. Its height is CSS's base plus whatever
       the renderer writes into --term-slack. -->
  <div class="term" aria-hidden="true"></div>
</section>
```

## It closes the plate, not the sheet

`grid-column: 2` puts it in the **well's own column**, so the rails run straight past it on
both sides and keep their life uninterrupted. That is the difference between ending a
section and ending the page: the terminator closes a *plate*, and the automata strip below
still separates one plate from the next. A full-width terminator was the first thing tried
in the prototype and it reads as the end of the document every time.

## Four things the prototype proved

Each of these cost a round of measuring, so none of them is a preference.

**The rails must span its row, and `grid-row: 2 / -1` does not do that.** `-1` addresses the
*explicit* grid; the terminator's row is implicit, so the rails stopped **317px short**.
`auto / span 2` is correct, and it is right for one more reason the prototype did not cover:
the hero band has no `.sec__head`, so its rails sit in row 1, not row 2. A hard `2 /` would
have been wrong there. It is scoped with `:has()` so a band without a terminator keeps
exactly the geometry it has today.

**The diagonal is anchored to `left bottom`.** The terminator is where the remainder lives,
so its own height is deliberately *not* a whole number of cells and the 24px tile has to be
cut somewhere. Tiled from the top, the cut repeat lands on the plate's bottom edge — the one
edge that now sits exactly on a lattice line, and therefore the one place a cut is
conspicuous. Tiled from the bottom, the cut lands where the terminator meets the well,
against a border that already exists. Same fraction, invisible instead of loud.

**It is paper, then ink.** `background-color: var(--surface-page)` under the gradient, for
the same reason `.well` has it: the sheet's lattice is drawn under everything, and a
terminator without paper would show graph *and* diagonal at once. See the "one lattice"
section of `components/skeleton/spec.md`.

**It is fine, not medium.** One cell base, a 24px tile, `--chrome-grid` ink, flush to the
plate. The prototype also carried a 2-cell/48px tile, a `--chrome-border-strong` version
that read as a hazard edge, an accent version and an inset version pulled in to the text
measure. None of them shipped: at one cell the diagonal is the same frequency as the graph
paper it sits under, which is what makes it read as part of the same drawing rather than a
band of stripes glued to the bottom.

## The height is set by JS, and the hook is `--term-slack`

CSS owns the base; the renderer owns the slack. One pass, no iteration:

```js
const root = region.closest(".sheet") ?? region.closest(".band");   // the lattice root
const cell = parseFloat(getComputedStyle(root).backgroundSize);
const top  = root.getBoundingClientRect().top;

for (const term of document.querySelectorAll(".term")) {
  term.style.setProperty("--term-slack", "0px");          // back to the base
}
for (const band of document.querySelectorAll(".band")) {  // measure AFTER every reset
  const term = band.querySelector(":scope > .term");
  const rail = band.querySelector(".rail--l");
  if (!term || !rail) continue;
  const drop  = rail.getBoundingClientRect().bottom - top;
  const short = (cell - (((drop % cell) + cell) % cell)) % cell;
  // already on a line, from either side — leave it alone
  if (short > EPS && short < cell - EPS) {
    term.style.setProperty("--term-slack", short + "px");
  }
}
```

Four things about that loop:

- **A custom property, not an inline `height`.** The base stays in `components.css` and JS
  never restates it, and `--term-slack: 0px` is a real reset rather than a `removeProperty`
  that has to guess what the stylesheet wanted. It also means a renderer that never runs
  leaves a valid terminator on the page rather than a broken one.
- **Reset every terminator before measuring any of them.** A band's position depends on the
  slack of every band above it, so a reset interleaved with the measurements measures a
  page that is half-adjusted.
- **The shortfall is measured against the ROOT, not against the rail's own height.** Those
  are the same number only while every band above happens to be in step. Measuring from the
  root's top makes it true by construction, and it is what drives the strips to phase 0 all
  the way down the sheet.
- **`EPS` is not paranoia, and the guard is two-sided.** Layout is subpixel — Chrome's
  LayoutUnit is 1/64px — so measured on `index.html` a plain `short > 0` left several bands
  0.02px out, which reads back as a bottom phase of 23.98 rather than 0. Both ends of the
  range mean the same thing: a plate 0.02px *short* of a line and a plate 0.02px *past* one
  are both on it. Adding 23.98px to the second would move it a whole cell for a rounding
  artefact. `short > EPS && short < cell − EPS` at `EPS = 0.05` leaves both alone; the
  residual is 1/1200 of a cell and nothing can see it.

Re-run it on resize, on `document.fonts.ready` and after any DOM change that moves a band —
the same triggers the automata rebuild uses, and in that order: the terminator moves the
rails, so it has to settle before the canvases are sized.

## What is still fractional, and where it lives

The terminator drives every plate's **bottom** onto a lattice line. It cannot do anything
about the **top**: a rail starts below `.sec__head`, whose height is a wrapped title plus
padding and is not a multiple of the cell. Measured on `index.html` at 1280px after the
pass, every rail's bottom phase is 0 and every strip's top and bottom phase is 0, while the
rails' top phase is 7.80 — one partial row per section, immediately under the head's own 1px
rule, which is the same "cut it against an edge that already exists" argument the diagonal's
bottom anchoring makes.

The hero is the proof that the mechanism is right rather than approximate: it has no head,
so its rail starts at phase 0, and after the pass it measures **42.000 rows** exactly.

Closing that last fraction means snapping `.sec__head`'s height too — a `--head-slack` on
its padding, on the same pass. That is a real option and deliberately not taken here: it
changes a content element's proportions to serve decoration, which is a bigger decision than
this component is allowed to make on its own.

## Variants

None. The prototype's four (medium, strong, accent, inset) were a comparison, not a set —
see "It is fine, not medium" above.

## Tokens

`--space-6` (the lattice: the tile, and the base height), `--surface-page` (the plate),
`--chrome-grid` (the diagonal), `--chrome-border` (the two hairline edges), `--term-slack`

`--term-slack` is **not** a design token and must never be added to `tokens.json`. It is
this component's own hook — a hole in the CSS that the renderer writes a measured pixel
value into. It is listed here because the contract gate reads `var()` uses out of the CSS
and cannot tell a token from a variable; the distinction is that a token is a *decision*
with one source, and this is a *measurement* with one writer.

## a11y

`aria-hidden="true"`, no content, no tab stop. It is a rule drawn on paper. Nothing about
the section's meaning is carried here, and a screen reader that ignored it entirely would
lose nothing — which is the test decoration has to pass.

On paper it does not exist at all: `--chrome-grid` prints as `transparent`, so the diagonal
goes by itself, but the plate and its two hairline edges would print as an empty band under
every section. `.term` therefore joins `.rail, .strip` in the `@media print` block of every
page stylesheet that ships a sheet — layout only, no colour.

## AI notes

- **Last child of the band, always.** It is auto-placed, so a terminator before the well
  lands in the wrong row and takes the rails' span with it.
- **Never write `height` on it from JS.** Write `--term-slack`. A `height` in a style
  attribute takes the base out of the stylesheet and the next person cannot find it.
- **One per band, and only where a plate should close.** A terminator on every band and a
  terminator on none are both coherent; a terminator on some *content* bands and not others
  is a rhythm nobody chose.
- Do not give it a `background-image` that is not the diagonal, and do not remove its
  `background-color`: it sits over the sheet's lattice and the paper is what stops the two
  grids from being visible at once.
