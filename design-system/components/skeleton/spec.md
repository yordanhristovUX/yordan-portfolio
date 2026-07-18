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
| `.rail` (`--l`/`--r`) | JS-filled columns of whole squares; leftover height stays plain paper |
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

## Tokens

`--surface-page`, `--chrome-border`, `--chrome-grid`, `--accent-rgb` (hover/seed), `--pad`, `--pad-y`

## AI notes

- Never set widths in px/rem on skeleton elements — everything derives from fr tracks.
- New sections: `<section class="band sec">` + `sec__head` + `well`; rails come free.
- Do not put backgrounds on `.rail`/`.strip` children other than the engine's cell tints.
