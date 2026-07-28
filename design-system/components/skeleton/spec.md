---
{
  "id": "skeleton",
  "status": "stable",
  "since": "initial",
  "a11y": "Rails and strips are decoration: js/automata.js sets aria-hidden on every one, and content never goes in them."
}
---

# Skeleton (sheet / band / rail / well / strip / square)

The page's structural system: a 24-square-wide sheet (12 under 760px). Every band splits
into rail (2 squares) / well (20 squares) / rail (2 squares). Squares are REAL `.sq` divs
sized by the same fr tracks as the layout — grid lines are inset box-shadows. **Never use
borders in skeleton elements**: borders change track math; inset shadows don't.

## Pattern

```html
<main class="sheet">
  <section class="band sec">
    <header class="sec__head">…</header>
    <!-- .rail--l / .rail--r are injected by js/automata.js -->
    <div class="well">…content on solid paper…</div>
  </section>
  <div class="strip" aria-hidden="true"></div>  <!-- 2-square living separator -->
</main>
```

## Elements

| Class | Role |
| --- | --- |
| `.sheet` | 90rem max sheet, paper surface, hairline inset edges |
| `.band` | `2fr 20fr 2fr` grid (mobile `1fr 10fr 1fr`); `.sec__head` spans all columns |
| `.rail` (`--l`/`--r`) | JS-filled columns of whole squares; leftover height stays plain paper. `contain: size` — see below |
| `.well` (`--flush`) | Solid-paper content column — squares never sit under text |
| `.strip` | Full-width 2-square window between sections |
| `.sq` | One square: `aspect-ratio: 1`, inset right/bottom lines, hover = accent |

## Squares engine contract (site js/automata.js)

Injects rails into every `.band` that has a `.well`, fills rails/strips with `.sq` divs,
and runs Conway's Life over them (rails: +6 hidden columns under the paper; strips: 10
hidden rows, middle 2 shown). Clicking a square seeds life with an accent-blue lineage
that fades over ~10 generations; regions breathe (slow opacity sine) and pause off-screen.
After DOM/layout changes call `window.rebuildCaseSquares()` for dialog rails; page rails
rebuild on resize and font load.

### The well sizes the band. The rail never does.

`.rail` carries `contain: size`, and that declaration is load-bearing — do not remove it.

The engine measures the rail (`clientHeight / squareSize`) to decide how many squares to
make. Without containment those squares feed back into the band's row height, the well
stretches to match, and the next rebuild measures the height it just caused. The loop is
self-confirming, so it settles wherever it happens to land rather than converging on
anything correct: one build that runs before layout has given the rail its real width is
enough to kick it, and a band whose content is 420px tall ends up 36,000px tall with
thousands of squares in it.

`contain: size` makes the rail size purely from the outside — the well's content sets the
row, the rail fills it, and the squares stay a consequence rather than a cause.

The rule for anything added to a band: **content lives in the well.** If a new element
belongs to the band directly, it must be able to size itself without consulting the rails.

### What it costs

`contain: size` is not the fix for the automata. It is the **mitigation for a cost this
design chose to accept**, and the honest framing matters: without it the cost is unbounded,
with it the cost is merely large.

Measured on `index.html` at 1280px, on a clean load:

| | |
| --- | --- |
| `.sq` divs in the document | **496** |
| Total elements in the document | 848 |
| Share of the DOM that is decoration | **58.5%** |
| Cells simulated per generation | **2,128** (4.3× the visible ones) |
| Per-square declaration | `transition: background-color 0.3s linear` |

(Re-measured after the type and spacing scales landed: 508 / 862 / 58.9% / 2,176 before.
The band heights moved by a few pixels and the square count followed, which is the point of
the second consequence below — this number is a function of layout, not of the engine.)

The simulation is deliberately wider than the picture — rails run 6 hidden columns under the
paper and strips run 10 rows to show 2 — so patterns drift in from off-stage instead of
appearing out of nothing at the edge. That is the reason the ratio is 4.3 and not 1, and it
is a design decision, not an accident.

So: three fifths of this page's nodes exist to render a cellular automaton nobody asked for,
each one carrying a colour transition, with Conway's Life stepping continuously behind them.
The engine buys that back where it can — regions pause when scrolled off-screen, the sim
arrays are typed and flat, and repaints are `background-color` only, which stays off the
layout path. It is affordable. It is not free, and a page that inherits this skeleton
inherits the bill.

Two consequences worth stating for anyone extending the system:

- **Any per-element cost you add to `.sq` is multiplied by ~500.** A box-shadow, a filter, a
  second transition property, an event listener per square — none of those are local
  changes. The engine already delegates its clicks to the region for exactly this reason.
- **The node count is a function of band height.** Making a band taller makes squares, and a
  band that sizes itself from its rails makes them without limit. That is the feedback loop
  above, and it is why `contain: size` is load-bearing rather than tidy.

## Tokens

`--accent-rgb` (hover/seed), `--chrome-border`, `--chrome-grid`, `--surface-page`, `--pad`,
`--pad-y`

## AI notes

- Never set widths in px/rem on skeleton elements — everything derives from fr tracks.
- New sections: `<section class="band sec">` + `sec__head` + `well`; rails come free.
- Do not put backgrounds on `.rail`/`.strip` children other than the engine's cell tints.
