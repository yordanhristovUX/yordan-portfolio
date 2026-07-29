export default { title: "Skeleton/Terminator" };

/* The terminator is the only element in a band whose height is nobody's
   content, so it is the one that can absorb a section's remainder.
   These stories are in two halves and the pair IS the argument:

   · BASE is what CSS alone gives you — one cell, and the plate still ends
     wherever the words end. That is the state the page is in before the
     renderer runs, and it is deliberately a valid page rather than a broken
     one.
   · SNAPPED runs the measurement pass from components/terminator/spec.md
     against real rects. Nothing is faked: the slack is measured, written to
     --term-slack, and the readout underneath prints the phase it achieved.

   Both are wrapped in a .sheet, because the sheet is the lattice root — the
   graph paper the plate has to land on is drawn there, and a band outside one
   would be measuring against nothing. */

const node = (html) => {
  const t = document.createElement("div");
  t.innerHTML = html.trim();
  return t.firstElementChild;
};

const rootOf = (el) => el.closest(".sheet") ?? el.closest(".band");

/* ---------- the measurement pass, exactly as the spec states it ----------
   Subpixel layout is why EPS exists, and why the guard is TWO-SIDED. Chrome's
   LayoutUnit is 1/64px, so measured on the real page a plain `short > 0` left
   several bands 0.02px out. A plate 0.02px short of a line and a plate 0.02px
   past one mean the same thing — both are on it — and the second reads back as
   a shortfall of 23.98, which would move it a whole cell to fix a rounding
   artefact. Both ends are left alone. */
const EPS = 0.05;

function snap(scope) {
  const root = rootOf(scope.querySelector(".rail") ?? scope);
  if (!root) return;
  const cell = parseFloat(getComputedStyle(root).backgroundSize);
  if (!(cell > 0)) return;

  /* Reset EVERY terminator before measuring ANY of them: a band's position
     depends on the slack of every band above it. */
  const terms = [...scope.querySelectorAll(".term")];
  for (const t of terms) t.style.setProperty("--term-slack", "0px");

  const top = root.getBoundingClientRect().top;
  for (const band of scope.querySelectorAll(".band")) {
    const term = band.querySelector(":scope > .term");
    const rail = band.querySelector(".rail--l");
    if (!term || !rail) continue;
    const drop = rail.getBoundingClientRect().bottom - top;
    const short = (cell - (((drop % cell) + cell) % cell)) % cell;
    if (short > EPS && short < cell - EPS) {
      term.style.setProperty("--term-slack", short.toFixed(3) + "px");
    }
  }
}

/* The readout is the whole point: any number with a fraction in it is a
   partial cell somewhere a reader can see. */
function report(scope, el) {
  const root = rootOf(scope.querySelector(".rail") ?? scope);
  const cell = parseFloat(getComputedStyle(root).backgroundSize) || 0;
  const top = root.getBoundingClientRect().top;
  const rows = [...scope.querySelectorAll(".band")].map((b) => {
    const r = b.querySelector(".rail--l");
    if (!r || !cell) return "–";
    const box = r.getBoundingClientRect();
    const phase = (((box.bottom - top) % cell) + cell) % cell;
    return phase.toFixed(2);
  });
  const bad = rows.filter((r) => r !== "0.00").length;
  el.textContent =
    `cell ${cell}px · each plate's bottom edge, in cells past a lattice line: ` +
    rows.join("  ") +
    (bad ? `  ← ${bad} landing mid-cell` : "  ← every plate closes on a line");
}

const plate = (no, title, note, copy, term = true) => `
  <section class="band sec">
    <header class="sec__head">
      <span class="sec__no mono">${no}</span>
      <h2 class="sec__title t-title">${title}</h2>
      <span class="sec__note">${note}</span>
    </header>
    <div class="rail rail--l" aria-hidden="true"></div>
    <div class="well"><p class="t-lead">${copy}</p></div>
    <div class="rail rail--r" aria-hidden="true"></div>
    ${term ? `<div class="term" aria-hidden="true"></div>` : ""}
  </section>
  <div class="strip" aria-hidden="true"></div>`;

const readout = `
  <p class="t-label" style="padding: var(--space-3) var(--pad); margin: 0"></p>`;

/* ---------- 1. one plate, one cell, nothing measured yet ---------- */

export const Base = {
  name: "Base — one cell, before the renderer",
  render: () => {
    const el = node(`
      <main class="sheet">
        ${plate(
          "01",
          "The base height",
          "flush to the plate",
          `A one-cell diagonal on the same 24px tile as the graph paper it sits over,
           anchored to <code>left bottom</code> and drawn in <code>--chrome-grid</code>.
           This is what the stylesheet alone produces: the terminator is there, it is
           exactly one cell tall, and the plate still ends wherever the words end.
           Nothing here is broken — it is the state the page is in until the
           measurement pass runs.`
        )}
      </main>`);
    return el;
  },
};

/* ---------- 2. the same plates with the pass run over them ---------- */

export const Snapped = {
  name: "Snapped — the remainder absorbed",
  render: () => {
    const el = node(`
      <main class="sheet">
        ${plate("01", "Long", "the well sets the row", "The terminator takes whatever is left over between the bottom of the words and the next lattice line, so the plate closes on the line rather than 11 or 19 pixels past it. Every band on this page has a different remainder, and none of them is visible.")}
        ${plate("02", "Short", "a different remainder", "One sentence, so a different fraction.")}
        ${plate("03", "No terminator", "the control", "This plate has none, and it is the one to compare against: it ends where its text ends, which is what every section did before.", false)}
        ${readout}
      </main>`);
    requestAnimationFrame(() => {
      snap(el);
      requestAnimationFrame(() => report(el, el.querySelector(".t-label")));
    });
    return el;
  },
};

/* ---------- 3. the placement rule, on its own ---------- */

/* `grid-row: 2 / -1` does NOT make the rails span the terminator's row: -1
   addresses the EXPLICIT grid and that row is implicit, so the rails stop
   short. This story is the visible version of that bug and its fix — the
   left rail is given the broken span inline, the right one keeps the
   stylesheet's. */
export const RailSpan = {
  name: "Why the rails span `auto / span 2`",
  render: () => {
    const el = node(`
      <main class="sheet">
        ${plate(
          "04",
          "The rails run past it",
          "left rail: the bug · right rail: the rule",
          `The terminator sits in the well's own column, so the rails run straight past
           it and keep their life uninterrupted — it closes a plate, not the page.
           They only do that if they span its row. The left rail below carries
           <code>grid-row: 2 / -1</code>, which addresses the explicit grid and stops
           317px short of where it should; the right one carries the stylesheet's
           <code>auto / span 2</code>.`
        )}
      </main>`);
    el.querySelector(".rail--l").style.gridRow = "2 / -1";
    return el;
  },
};
