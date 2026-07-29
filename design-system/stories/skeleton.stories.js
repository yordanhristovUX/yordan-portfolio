export default { title: "Skeleton/Band, rails & strips" };

/* The skeleton's decoration is a canvas now, not ~500 divs. These stories are
   therefore in two halves, and both are worth looking at:

   · the FALLBACK stories render the exact markup the page ships minus the
     canvas — which is what a reader with JS off sees. It has to look
     intentional on its own, because it is the whole effect for that reader.
   · the PAINTED stories inject a canvas and draw one settled generation with
     the same contract js/automata.js has to hold: the lattice is read from the
     LATTICE ROOT's computed background-size, the region's phase against that
     root is measured rather than assumed, the inks are read from the design
     system, and the bitmap is the box times the device pixel ratio.

   Nothing here is the engine — there is no loop, no click seeding and no
   breath. It is a still frame, so that what the CSS guarantees is reviewable
   without the site's JS in the room.

   EVERY STORY IS WRAPPED IN A .sheet, including the ones that are only showing
   a strip. That is not framing: the sheet is where the graph paper is drawn
   now, so a region outside one is a window onto nothing and the story would
   quietly stop testing the thing it is named after. */

/* ---------- the three reads the engine also does ---------- */

/* The lattice root — the one element that draws the grid. `.sheet` is the
   page's; a `.band` outside a sheet (the case dialog's) is its own. */
const rootOf = (el) => el.closest(".sheet") ?? el.closest(".band");

/* The lattice, from the one place it exists as a resolved length. The graph
   paper's tile IS the cell, so a story cannot drift from the stylesheet.

   The ROOT is the only source. This used to fall back to the region itself
   (`rootOf(el) ?? el`), which worked while `.rail, .strip` carried a bare
   `background-size` as a bridge; that declaration is gone, so reading a region
   now yields NaN and the fallback would silently mean "cell = 0". Degrading to
   0 when there is no root is the same contract `phaseOf` below already has. */
const cellOf = (el) => {
  const root = rootOf(el);
  return root ? parseFloat(getComputedStyle(root).backgroundSize) || 0 : 0;
};

/* A region's offset into the root's grid. Zero horizontally on a snapped
   sheet; vertically it is whatever the band above ended on, which is what the
   terminator exists to drive to zero. Drawing at -phase is what puts a cell in
   the root's square rather than in the region's own corner. */
function phaseOf(region, cell) {
  const root = rootOf(region);
  if (!root || !cell) return { x: 0, y: 0 };
  const rr = root.getBoundingClientRect();
  const r = region.getBoundingClientRect();
  return {
    x: (((r.left - rr.left) % cell) + cell) % cell,
    y: (((r.top - rr.top) % cell) + cell) % cell,
  };
}

/* Never a colour literal, here or anywhere. Both inks flip with the theme, and
   Storybook's theme global re-runs the story, so each render re-reads them —
   the same discipline as listening for `themechange` on the site. */
const ink = (name) =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim();

/* ---------- a still frame of Life ---------- */

/* Deterministic, so a visual diff of this story means something changed in the
   CSS rather than in a random seed. */
const rand = (s) => () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);

function still(cols, rows, wall, seed, gens) {
  const n = cols * rows;
  const next = new Uint8Array(n);
  const rnd = rand(seed);
  let a = new Uint8Array(n);
  for (let i = 0; i < n; i++) a[i] = !wall[i] && rnd() < 0.34 ? 1 : 0;

  for (let g = 0; g < gens; g++) {
    for (let y = 0; y < rows; y++) {
      const up = ((y - 1 + rows) % rows) * cols;
      const mid = y * cols;
      const dn = ((y + 1) % rows) * cols;
      for (let x = 0; x < cols; x++) {
        const l = (x - 1 + cols) % cols;
        const r = (x + 1) % cols;
        const live =
          a[up + l] + a[up + x] + a[up + r] + a[mid + l] + a[mid + r] +
          a[dn + l] + a[dn + x] + a[dn + r];
        /* A wall cell is dead and stays dead. That is the whole of "content
           becomes a wall": life is computed around it, not over it. */
        next[mid + x] = wall[mid + x] ? 0 : a[mid + x] ? (live === 2 || live === 3 ? 1 : 0) : live === 3 ? 1 : 0;
      }
    }
    a.set(next);
  }
  return a;
}

/* Any client rect → cells. This is the formula components/skeleton/spec.md
   states, run against a real rect rather than described — if the canvas ever
   stops being the region's box exactly, this story goes visibly wrong. The
   phase is the one term that is new: cells are the ROOT's, not the region's. */
function rectToCells(region, box, cell, cols, rows, wall, phase) {
  const r = region.getBoundingClientRect();
  const c0 = Math.max(0, Math.floor((box.left - r.left + phase.x) / cell));
  const c1 = Math.min(cols, Math.ceil((box.right - r.left + phase.x) / cell));
  const y0 = Math.max(0, Math.floor((box.top - r.top + phase.y) / cell));
  const y1 = Math.min(rows, Math.ceil((box.bottom - r.top + phase.y) / cell));
  for (let y = y0; y < y1; y++) for (let x = c0; x < c1; x++) wall[y * cols + x] = 1;
}

/* Inject the canvas the engine would inject, then draw one generation into it
   once layout has given the region a box. */
function live(region, { seed = 7, gens = 14, walls = () => [], showWalls = false } = {}) {
  const canvas = document.createElement("canvas");
  canvas.className = "automata";
  canvas.setAttribute("aria-hidden", "true");
  region.appendChild(canvas);

  requestAnimationFrame(() => {
    const cell = cellOf(region);
    const r = region.getBoundingClientRect();
    if (!cell || r.width < 1 || r.height < 1) return; // the engine's own guard
    const phase = phaseOf(region, cell);
    /* One more column and row than the box needs, because a phased grid starts
       before the region does and ends after it. `overflow: hidden` clips both,
       which is what graph paper does at the edge of a sheet. */
    const cols = Math.ceil((r.width + phase.x) / cell);
    const rows = Math.ceil((r.height + phase.y) / cell);

    /* CSS owns the box; JS owns the bitmap. Nothing below can change the box. */
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(r.width * dpr);
    canvas.height = Math.round(r.height * dpr);
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const wall = new Uint8Array(cols * rows);
    for (const box of walls(region)) rectToCells(region, box, cell, cols, rows, wall, phase);

    const a = still(cols, rows, wall, seed, gens);
    const cellInk = ink("--automata-cell-rgb");
    const accent = ink("--accent-rgb");

    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const i = y * cols + x;
        const px = x * cell - phase.x;
        const py = y * cell - phase.y;
        if (showWalls && wall[i]) {
          ctx.fillStyle = `rgba(${accent}, 0.06)`;
          ctx.fillRect(px, py, cell, cell);
          continue;
        }
        if (!a[i]) continue;
        /* One fillStyle per band of alpha, not per cell — the reason the two
           inks are still rgb triplets rather than plain colours. */
        ctx.fillStyle = `rgba(${cellInk}, ${x % 5 === 0 ? 0.42 : 0.28})`;
        ctx.fillRect(px, py, cell, cell);
      }
    }
  });
  return region;
}

/* ---------- markup ---------- */

const band = (copy) => `
  <main class="sheet">
    <section class="band sec">
      <header class="sec__head">
        <span class="sec__no mono">01</span>
        <h2 class="sec__title t-title">What I do</h2>
      </header>
      <div class="rail rail--l" aria-hidden="true"></div>
      <div class="well"><p class="t-lead">${copy}</p></div>
      <div class="rail rail--r" aria-hidden="true"></div>
    </section>
  </main>`;

const node = (html) => {
  const t = document.createElement("div");
  t.innerHTML = html.trim();
  return t.firstElementChild;
};

/* ---------- 1. the scriptless page ---------- */

export const GraphPaperFallback = {
  name: "Fallback (no JS) — graph paper",
  render: () =>
    band(
      `With JS off there is no canvas and no automaton, and the rails are still
       something: one repeating gradient on the 24px lattice, drawn by the
       sheet in the same <code>--chrome-grid</code> ink the squares used to
       draw one line at a time. The rails are windows onto it. Blueprint
       margin, not a grid of dead divs.`
    ),
};

/* The claim this component now makes, in the one place it is falsifiable: a
   rail and the strip under it are two windows onto ONE grid, so their columns
   line up whether or not anyone remembered to make them. Resize the frame —
   the rails stay a whole number of squares wide at every width, and the strip
   never shows a sliver at either end. */
export const OneLattice = {
  name: "One lattice — the rail/strip junction",
  render: () => {
    const el = node(`
      <main class="sheet">
        <section class="band sec">
          <header class="sec__head">
            <span class="sec__no mono">02</span>
            <h2 class="sec__title t-title">One grid, four windows</h2>
            <span class="sec__note">rail · well · rail · strip</span>
          </header>
          <div class="rail rail--l" aria-hidden="true"></div>
          <div class="well"><p class="t-lead">The graph paper used to be drawn by each
            region from its own corner, so a rail and the strip below it agreed only by
            accident — measured at 1280px, the first six regions down the page started
            their cells 0, 14.53, 22.33, 17.48, 12.31 and 20.11px past a line. There is
            one grid now and the regions are holes cut in the paper over it.</p></div>
          <div class="rail rail--r" aria-hidden="true"></div>
        </section>
        <div class="strip" aria-hidden="true"></div>
      </main>`);
    el.querySelectorAll(".rail").forEach((rail, i) => live(rail, { seed: 41 + i * 7 }));
    live(el.querySelector(".strip"), { seed: 61, gens: 11 });
    return el;
  },
};

/* ---------- 2. what the engine draws over it ---------- */

export const BandWithLife = {
  name: "Rails — one canvas each",
  render: () => {
    const el = node(
      band(
        `The middle 20 columns are solid paper — the automata never sits under
         text. Either side, one canvas per rail replaces the ~250 divs that
         used to be here, and the graph paper reads through the living cells
         because the canvas has no background of its own.`
      )
    );
    el.querySelectorAll(".rail").forEach((rail, i) => live(rail, { seed: 3 + i * 11 }));
    return el;
  },
};

export const Strip = {
  name: "Strip — four cells tall",
  render: () => {
    const el = node(`<main class="sheet"><div class="strip" aria-hidden="true"></div></main>`);
    live(el.querySelector(".strip"), { seed: 23, gens: 9 });
    return el;
  },
};

/* ---------- 3. the reason the geometry is specified at all ---------- */

export const ContentIsAWall = {
  name: "Content is a wall (rect → cells)",
  render: () => {
    const el = node(`
      <main class="sheet" style="position:relative">
        <div class="strip" aria-hidden="true"></div>
        <p class="t-label" style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);
           background:var(--surface-page);padding:var(--space-3) var(--space-5);margin:0">
          the machine works around the words
        </p>
      </main>`);
    const strip = el.querySelector(".strip");
    live(strip, {
      seed: 5,
      gens: 16,
      showWalls: true,
      /* Any element's rect, turned into dead cells by division alone. The
         canvas is the region's box exactly, so there is no offset term. */
      walls: () => [el.querySelector(".t-label").getBoundingClientRect()],
    });
    return el;
  },
};
