/* ============================================================
   Automata engine — the skeleton and the life are one system.

   Conway's Life runs in two kinds of region: the side rails of every
   band, and the separator strips. Each region is ONE aria-hidden
   <canvas> lying over the region's own box, where there used to be one
   `.sq` div per cell — 492 of them on index.html at 1280px, 513 of the
   document's 845 elements (60.7%), each carrying a background-color
   transition. The simulation core did not change and must not: typed
   flat arrays, an age ramp, an accent-blue lineage, a toroidal wrap,
   the breath sine, click-to-seed. Only geometry and painting are new.

   That 492 is the div model's own formula re-run against TODAY'S band
   heights, not a reading taken off a live page, and the distinction is
   worth a line because the intermediate state lies. Measured with the
   old engine still running against the new CSS, index.html reported 556
   squares and 61.8% — inflated, because `.rail { contain: size }` had
   already been removed and the div model promptly rebuilt the feedback
   loop that property existed to stop. The last honest div-model reading
   in the spec is 508 / 862 / 58.9%, taken when the property was still
   there. All three describe the same design; only the 492 is measured
   on the same layout as the canvas figures it is compared against.

   THE LATTICE IS NOT DECLARED HERE, AND NEITHER IS ITS ORIGIN. The
   step is `--space-6`, resolved once by the graph paper's
   `background-size` on the LATTICE ROOT — `.sheet`, or a `.band` that
   is not inside one — and read back from the computed style below.
   Restating 24 in this file would let the gradient and the canvas
   disagree about where a cell starts, and they are drawn on top of
   each other.

   The origin is the root's too, which is the half that used to be
   wrong. Cell (0,0) is the root's top-left corner, not the region's,
   so every region draws its first row and column at MINUS its own
   phase — see `build()`. Twenty-one regions used to mean twenty-one
   grids: measured on index.html at 1280px the first six down the sheet
   started their cells at 0 · 14.53 · 22.33 · 17.48 · 12.31 · 20.11 px
   past a line. Taking both numbers from one element is what makes a
   cell boundary in a rail the same line as a cell boundary in the
   strip below it.

   `.rail, .strip` still carry a bare `background-size` in
   components.css. It was a bridge for the read this file no longer
   makes, it has no reader left, and it is the design system's to
   delete.

   WHAT THE CANVAS BUYS AND WHAT IT COSTS. 845 elements become 374 and
   decoration falls from 60.7% of the document to 11.2%. Cells per
   generation go the OTHER way — 2,112 to 4,393, about 2.1× — and that
   is the trade rather than a regression to fix: a 24px lattice is 4.8×
   finer per unit area than the 52.5px squares it replaces, and a cell
   is now an entry in a Uint8Array and part of a batched fillRect
   instead of an element with a transition on it. Measured: ~0.3ms of
   simulation per whole-page generation at the same 300ms tick. The
   figure is `automataStats()`'s to state at the bottom of this file,
   so it gets re-measured rather than re-argued.

   Interactions: hovering a cell lights it accent-blue (this file draws
   it — there is no per-cell element left to carry `:hover`); clicking
   seeds life, and cells born from a click carry an accent lineage that
   fades toward stone over ~10 generations.

   Subtlety: each region breathes — cell opacity rides a slow sine
   (~36 s, phase-offset per region) down to near-invisible.
   ============================================================ */
(() => {
  /* Reduce-motion is re-read on change, exactly as the two inks below are
     re-read on `themechange`. Both are settings the reader can flip while
     the page is open, and a reader who turns motion on mid-visit must not
     be left mid-generation. */
  const RMQ = window.matchMedia("(prefers-reduced-motion: reduce)");
  let RM = RMQ.matches;

  /* The two inks are read from the design system rather than restated here:
     both flip with the theme, and a hardcoded stone-500 would sink into the
     page the moment the sheet goes dark. Re-read on every theme change.

     There is no literal fallback, deliberately. A missing token used to mean
     "paint the last known stone", which is a colour this file would then own;
     it now means "paint nothing", and the graph paper underneath is still a
     blueprint margin. A script that cannot read its ink must degrade to the
     static page, never to a wrong one. */
  const palette = { cell: "", accent: "" };
  function readPalette() {
    const cs = getComputedStyle(document.documentElement);
    palette.cell = cs.getPropertyValue("--automata-cell-rgb").trim();
    palette.accent = cs.getPropertyValue("--accent-rgb").trim();
  }
  readPalette();
  const hasInk = () => palette.cell !== "" && palette.accent !== "";

  const TICK = 300;

  /* OFF-STAGE PADDING — one constant, re-derived, used as columns by a rail
     and as rows by a strip. It was 6 columns when a rail was 2 columns wide:
     off-stage wings three times the size of the picture, which was cheap
     because the picture was tiny. On the --space-6 lattice a rail is ~5
     visible columns, so six would leave more than half of every rail's
     simulation happening where nobody can see it.

     Three is not a compromise between 6 and 0, it is the floor the geometry
     gives you. The off-stage band is one contiguous strip on the torus (the
     visible field's two edges are its two edges), so the question is the
     narrowest band that can hold a complete moving structure entirely out of
     sight. A glider's bounding box is 3×3. At 2 the band cannot contain one
     without it touching both visible edges at once — off-stage stops being a
     place and becomes a seam. At 3 it is a place, 72px of it, and a glider
     takes ~12 generations (≈3.6s at this tick) to cross it and arrive.

     Measured consequence at 1280px: rails fall from 5,236 simulated cells to
     3,808, and off-stage drops from 75% of every rail's simulation to 37.5%. */
  const HIDDEN = 3;

  /* A torus narrower than 3 makes a cell its own neighbour twice over and
     Life stops being Life. Regions this small are clipped edges, not bugs. */
  const MIN_SIM = 3;

  const AGE_STEPS = 8;     // age ramp saturates here
  const BLUE_LIFE = 10;    // accent lineage countdown
  const HOVER_ALPHA = 0.5;
  const SETTLE = 5;        // generations run before a still grid is shown

  /* ALPHA IS PER CELL, fillStyle IS PER DRAW CALL — which is the whole reason
     `--automata-cell-rgb` and `--accent-rgb` stay triplets instead of colours.
     Every living cell lands in one of these buckets, the bucket's colour is
     built once, and every cell in it is filled under that one fillStyle. The
     alternative, `globalAlpha`, is also per-draw-call state, so it would mean
     one draw call per distinct alpha — i.e. the same 19 either way, but with
     the composition happening in the canvas instead of in the token layer. */
  const BUCKETS = AGE_STEPS + 1 + BLUE_LIFE;   // 9 resident + 10 accent = 19
  const styles = new Array(BUCKETS);           // refilled per render, never grown

  /* ---- Walls: content the life has to flow around ----------------------
     Any element whose rect genuinely lies over a region can mark the cells it
     covers permanently dead, so the population goes around the words instead
     of under them. The mapping needs no offset term — the canvas is the
     region's border box with the same origin (components/skeleton/spec.md) —
     so this is one division, recomputed on rebuild rather than per frame.

     TWO FILTERS, and both are about coordinate spaces rather than taste.

     · A rect is only comparable to a region if the two share a nearest
       `position: fixed` ancestor. That is what keeps the floating bar out of
       the page's rails: the bar lies over the sheet in VIEWPORT space, so
       which cells it covers is a function of scroll, not of layout — a wall
       that slid down the rail as you scrolled would be a wiper, and pricing
       it per frame is exactly what this rewrite exists to stop doing. The
       same test lets the case dialog's own well wall the case dialog's own
       rails, because there both sides sit inside the same fixed panel.

     · A rect must cover at least a quarter of a cell for that cell to die.
       Adjacent grid tracks share an edge and report ~0.02px of overlap from
       float rounding; without the inset, one of those would wall an entire
       column that nothing is actually covering.

     MEASURED, so nobody has to trust the mechanism: on index.html today this
     masks ZERO cells at 375, 768 and 1280. The band is `2fr 20fr 2fr` and the
     rails are columns 1 and 3, so a `.well` is BESIDE a rail, never over it —
     the paper is already the region's own edge, which is the strongest form
     of the same rule and the reason the mask has nothing left to do. The code
     stays because it is what makes that a measurement rather than an
     assumption, and because `[data-automata-wall]` is how anything that ever
     does lie over a region (a pull-quote breaking into the margin, a figure
     spanning the band) becomes a wall without touching this file. */
  const WALLS = ".well, .sec__head, [data-automata-wall]";
  const WALL_INSET = 0.25;   // fraction of a cell a rect must cover to kill it

  function fixedRootOf(el) {
    for (let n = el; n && n !== document.documentElement; n = n.parentElement) {
      if (getComputedStyle(n).position === "fixed") return n;
    }
    return null;
  }

  /* ---- The lattice root, for both of the numbers a region needs ----------
     `.sheet` is the page's; a `.band` that is NOT inside one is its own — that
     is the case dialog, whose band lives in its own scroller and therefore has
     to draw its own graph paper. The `?? el` tail is a degradation rather than
     a case that exists: a region with neither ancestor reads its own box, gets
     phase 0, and draws the grid it drew before any of this. */
  const latticeRootOf = (el) => el.closest(".sheet") ?? el.closest(".band") ?? el;

  /* ---- THE TERMINATOR PASS: the vertical half of the lattice --------------
     A rail's height is its band's height, which is however much text the well
     holds, so its last row is a fraction of a cell. Measured on index.html at
     1280px the eight rails ran 40.605 · 13.454 · 39.785 · 32.051 · 29.850 ·
     15.503 · 7.839 · 25.097 rows — not one of them whole, and every one of them
     a half square showing where a section stops.

     The `.term` is the only element in a plate whose height is nobody's
     content, so it is where the remainder goes. It has a one-cell base in
     components.css and a `--term-slack` hole; this writes the hole.

     WRITE `--term-slack`, NEVER `height`. The base then stays in the
     stylesheet, `0px` is a real reset rather than a removeProperty that has to
     guess what CSS wanted, and — the reason it matters beyond tidiness — a
     renderer that never runs leaves a valid 24px terminator on the page rather
     than a broken one. A script failure has to degrade to the static page, not
     to a wrong one.

     FOUR THINGS, each of which cost a round of measuring somewhere:

     · RESET EVERY TERMINATOR BEFORE MEASURING ANY OF THEM. A band's position is
       the sum of everything above it, so a reset interleaved with the
       measurements measures a page that is half adjusted.

     · MEASURE AGAINST THE ROOT, NOT AGAINST THE RAIL'S OWN HEIGHT. Those are
       the same number only while every band above happens to be in step.
       Measuring from the root's top makes it true by construction, and it is
       what drives the strips to phase 0 all the way down the sheet.

     · THE GUARD IS TWO-SIDED AND THAT IS NOT PARANOIA. Layout is subpixel —
       Chrome's LayoutUnit is 1/64px — so a plain `short > 0` leaves bands 0.02px
       out, which reads back as a bottom phase of 23.98 rather than 0. A plate
       0.02px short of a line and a plate 0.02px past one are both ON it;
       adding 23.98px to the second would move it a whole cell for a rounding
       artefact. At EPS = 0.05 the residual is 1/1200 of a cell.

     · IT CANNOT PING-PONG, and the reset is why. Every run resets to the base
       first, so each pass is a pure function of the un-slacked layout rather
       than an adjustment to the last one — there is no carried value for a
       second run to grow or alternate. Run it twice and the second pass writes
       the same pixels as the first.

     One pass, not an iteration: `getBoundingClientRect()` flushes layout, so
     walking the bands in document order measures band N with every band above
     it already settled. */
  const TERM_EPS = 0.05;

  /* "This phase is a real remainder, not a rounding artefact." Both ends of the
     range mean the same thing — 0.02 short of a line and 0.02 past one are both
     ON it — so every test of a phase in this file goes through here. */
  const offLattice = (phase, cell) => phase > TERM_EPS && phase < cell - TERM_EPS;

  function settleTerminators(scope) {
    const plates = [];
    for (const band of scope.querySelectorAll(".band")) {
      const term = band.querySelector(":scope > .term");
      const rail = band.querySelector(":scope > .rail--l");
      if (!term || !rail) continue;          // no terminator, or a band with no well
      term.style.setProperty("--term-slack", "0px");
      plates.push({ band, term, rail });
    }
    for (const { band, term, rail } of plates) {
      /* `closest` matches self, so for a band this resolves to its .sheet if it
         has one and to the band itself if it does not — the dialog's case. */
      const root = latticeRootOf(band);
      const cell = parseFloat(getComputedStyle(root).backgroundSize);
      const box = rail.getBoundingClientRect();
      /* A zero box is survivable and expected: every region is `display: none`
         on paper and the dialog's band has no layout until it opens. Leaving
         the slack at its reset 0px is the right answer in both. */
      if (!(cell > 0) || !(box.height > 0)) continue;
      const drop = box.bottom - root.getBoundingClientRect().top;
      const short = (cell - (((drop % cell) + cell) % cell)) % cell;
      if (offLattice(short, cell)) term.style.setProperty("--term-slack", short + "px");
    }
  }

  /* Collected ONCE per rebuild pass, not once per region: 21 regions × 9 wells
     would be 189 ancestor walks and 189 layout reads for an answer that is the
     same every time. */
  function collectWalls(root = document) {
    const out = [];
    for (const el of root.querySelectorAll(WALLS)) {
      const rect = el.getBoundingClientRect();
      if (!rect.width || !rect.height) continue;
      out.push({ el, rect, fixedRoot: fixedRootOf(el) });
    }
    return out;
  }

  class Region {
    constructor(el, kind) { // kind: "rail" | "strip"
      this.el = el;
      this.kind = kind;
      this.phase = Math.random() * Math.PI * 2;
      this.running = true;
      this.last = 0;
      this.lastBreath = 0.3;
      this.hover = -1;
      this.ready = false;
      this.masked = 0;

      /* The region is decoration and so is its canvas. Both say so, because
         the rails are injected here and a strip's attribute is in markup that
         a future page might forget. */
      el.setAttribute("aria-hidden", "true");
      let canvas = el.querySelector("canvas.automata");
      if (!canvas) {
        canvas = document.createElement("canvas");
        canvas.className = "automata";
        el.appendChild(canvas);
      }
      canvas.setAttribute("aria-hidden", "true");
      this.canvas = canvas;
      this.ctx = canvas.getContext("2d");

      this.build();
      el.addEventListener("click", (e) => this.seedAt(e));
      /* Hover is this file's to draw now. There is no per-cell element left,
         so there is nothing for `.sq:hover` to match — the CSS rule that used
         to do this went with the divs. */
      el.addEventListener("pointermove", (e) => this.hoverAt(e));
      el.addEventListener("pointerleave", () => this.setHover(-1));
    }

    /* CSS owns the box, this owns the bitmap — never the other way round.
       A zero box is survivable and expected: every region is `display: none`
       on paper, and the dialog's band has no layout until it opens. */
    build(walls) {
      this.ready = false;
      const el = this.el;
      /* BOTH NUMBERS COME FROM THE ROOT. The step used to be read off the
         region's own `background-size` and the origin was implicitly the
         region's own corner, which is the same mistake twice: it made this
         region's grid a grid, rather than a window onto the page's one grid.
         A rail and the strip below it were then in step only by luck. */
      const root = latticeRootOf(el);
      const cell = parseFloat(getComputedStyle(root).backgroundSize);
      const box = el.getBoundingClientRect();
      const w = box.width;
      const h = box.height;
      if (!(cell > 0) || !(w > 0) || !(h > 0) || !this.ctx) return;

      /* How far this region's corner sits past the last lattice line. Drawing
         starts at MINUS this, so a cell boundary in a rail is the same line as
         a cell boundary in the strip below it — the sheet is one continuous
         space of squares rather than twenty-one adjacent ones. `phaseX` is 0
         for every region at every width (the columns snap); `phaseY` is what
         the band above ended on, and the terminator drives most of it to 0. */
      const rr = root.getBoundingClientRect();
      const phaseX = (((box.left - rr.left) % cell) + cell) % cell;
      const phaseY = (((box.top - rr.top) % cell) + cell) % cell;

      this.cell = cell;
      this.w = w;
      this.h = h;
      this.phaseX = phaseX;
      this.phaseY = phaseY;

      /* The bitmap is device pixels, the box stays authoritative. Clamped at 2
         on purpose: the ink is axis-aligned rectangles on an integer lattice,
         so past 2 there is no edge left to resolve, and the rails alone are
         ~1.2M CSS pixels — at dpr 3 that is 42MB of backing store for
         decoration. Re-read on every rebuild, so a zoom or a monitor change
         re-scales rather than blurring. */
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.canvas.width = Math.round(w * dpr);
      this.canvas.height = Math.round(h * dpr);
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      /* `ceil`, not `floor`: the trailing cell is clipped by the region's
         `overflow: hidden`, which is what graph paper does at the edge of a
         sheet. Half a cell of life at the bottom of a rail is correct.

         The phase is added before the ceiling because the grid now starts
         OUTSIDE the box, at -phase, so covering the box takes one more cell
         whenever the region does not begin on a line. Both partial cells, the
         leading one and the trailing one, are clipped the same way. */
      const cols = Math.max(1, Math.ceil((w + phaseX) / cell));
      const rows = Math.max(1, Math.ceil((h + phaseY) / cell));
      this.cols = cols;
      this.rows = rows;

      if (this.kind === "rail") {
        this.simC = cols + HIDDEN;
        this.simR = Math.max(rows, MIN_SIM);
        this.firstRow = 0;
      } else {
        this.simC = Math.max(cols, MIN_SIM);
        this.simR = Math.max(rows + HIDDEN, MIN_SIM);
        this.firstRow = (this.simR - rows) >> 1;   // strips show the middle rows
      }

      const n = this.simC * this.simR;
      this.a = new Uint8Array(n);
      this.b = new Uint8Array(n);
      this.age = new Uint8Array(n);
      this.blue = new Uint8Array(n);
      this.blueB = new Uint8Array(n);
      this.wall = new Uint8Array(n);

      /* visible index -> sim index, resolved once. It used to be recomputed
         per cell per frame; it is the same table every time. */
      const visN = cols * rows;
      this.vis = new Int32Array(visN);
      for (let vy = 0; vy < rows; vy++) {
        for (let vx = 0; vx < cols; vx++) {
          this.vis[vy * cols + vx] = (this.firstRow + vy) * this.simC + vx;
        }
      }

      // Painting scratch — allocated with the grid, never per frame.
      this.cellBucket = new Int8Array(visN);
      this.order = new Int32Array(visN);
      this.bCount = new Int32Array(BUCKETS);
      this.bStart = new Int32Array(BUCKETS + 1);
      this.bCur = new Int32Array(BUCKETS);

      this.markWalls(box, walls || collectWalls());
      this.gen = 0;
      this.ready = true;
      this.seed();
      /* Under reduce-motion nothing will ever advance this grid, so a fresh
         seed would be frozen ON the random noise it starts from. Settling it
         here rather than once at startup is the fix for a case the old engine
         missed: a resize, or the webfont rebuild that lands a moment after
         load, replaced the settled picture with raw noise and there was no
         loop left to work it out. Measured in a forced-reduce frame: 0
         generations on screen before, SETTLE after every rebuild now. */
      if (RM) for (let i = 0; i < SETTLE; i++) this.step();
      this.render(this.lastBreath);
    }

    markWalls(box, walls) {
      /* The phase terms are the whole of what changed here: a rect maps onto
         cells against the ROOT's grid now, so an offset that used to be zero by
         construction has to be carried explicitly. */
      const { cell, cols, rows, phaseX, phaseY } = this;
      const inset = cell * WALL_INSET;
      const mine = fixedRootOf(this.el);
      let masked = 0;
      for (const wall of walls) {
        if (wall.fixedRoot !== mine) continue;                     // different space
        if (wall.el === this.el || wall.el.contains(this.el) || this.el.contains(wall.el)) continue;
        const r = wall.rect;
        if (Math.min(box.right, r.right) - Math.max(box.left, r.left) <= inset) continue;
        if (Math.min(box.bottom, r.bottom) - Math.max(box.top, r.top) <= inset) continue;
        const c0 = Math.max(0, Math.floor((r.left - box.left + phaseX + inset) / cell));
        const c1 = Math.min(cols - 1, Math.ceil((r.right - box.left + phaseX - inset) / cell) - 1);
        const r0 = Math.max(0, Math.floor((r.top - box.top + phaseY + inset) / cell));
        const r1 = Math.min(rows - 1, Math.ceil((r.bottom - box.top + phaseY - inset) / cell) - 1);
        for (let vy = r0; vy <= r1; vy++) {
          for (let vx = c0; vx <= c1; vx++) {
            const si = this.vis[vy * cols + vx];
            if (!this.wall[si]) { this.wall[si] = 1; masked++; }
          }
        }
      }
      this.masked = masked;
    }

    seed() {
      const { a, wall } = this;
      for (let i = 0; i < a.length; i++) a[i] = !wall[i] && Math.random() < 0.18 ? 1 : 0;
    }

    /* Pointer -> cell. The canvas is the region's box with the same origin, so
       this is a division and the phase — no element to hit-test, because there
       is no element. The phase has to be here as well as in `render`, or the
       cell you light on hover is not the cell under the cursor. */
    cellAt(e) {
      if (!this.ready) return -1;
      const box = this.el.getBoundingClientRect();
      const vx = Math.floor((e.clientX - box.left + this.phaseX) / this.cell);
      const vy = Math.floor((e.clientY - box.top + this.phaseY) / this.cell);
      if (vx < 0 || vy < 0 || vx >= this.cols || vy >= this.rows) return -1;
      return vy * this.cols + vx;
    }

    setHover(vi) {
      if (this.hover === vi) return;
      this.hover = vi;
      if (this.ready) this.render(this.lastBreath);
    }

    hoverAt(e) {
      if (e.pointerType === "touch") return;   // a tap is a click, not a hover
      this.setHover(this.cellAt(e));
    }

    seedAt(e) {
      const vi = this.cellAt(e);
      if (vi < 0) return;
      const si = this.vis[vi];
      const sx = si % this.simC;
      const sy = (si / this.simC) | 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (Math.random() > 0.7) continue;
          const j = ((sy + dy + this.simR) % this.simR) * this.simC +
                    ((sx + dx + this.simC) % this.simC);
          if (this.wall[j]) continue;
          this.a[j] = 1;
          this.age[j] = 0;
          this.blue[j] = BLUE_LIFE;
        }
      }
      if (!this.wall[si]) {
        this.a[si] = 1;
        this.blue[si] = BLUE_LIFE;
      }
      this.render(this.lastBreath);
    }

    /* ---- Conway, unchanged. Walls are dead cells that stay dead, so they
       are already absent from every neighbour sum: nothing here has to know
       about them except the one line that refuses to let a birth happen. ---- */
    step() {
      const { a, b, blue, blueB, age, wall, simC: cols, simR: rows } = this;
      for (let y = 0; y < rows; y++) {
        const up = ((y - 1 + rows) % rows) * cols;
        const mid = y * cols;
        const dn = ((y + 1) % rows) * cols;
        for (let x = 0; x < cols; x++) {
          const l = (x - 1 + cols) % cols;
          const r = (x + 1) % cols;
          const i0 = up + l, i1 = up + x, i2 = up + r;
          const i3 = mid + l, i4 = mid + r;
          const i5 = dn + l, i6 = dn + x, i7 = dn + r;
          const n = a[i0] + a[i1] + a[i2] + a[i3] + a[i4] + a[i5] + a[i6] + a[i7];
          const alive = a[mid + x];
          let next = alive ? (n === 2 || n === 3 ? 1 : 0) : n === 3 ? 1 : 0;
          if (wall[mid + x]) next = 0;
          b[mid + x] = next;
          if (next) {
            if (alive) {
              age[mid + x] = Math.min(age[mid + x] + 1, 12);
              blueB[mid + x] = blue[mid + x] > 0 ? blue[mid + x] - 1 : 0;
            } else {
              age[mid + x] = 0;
              // Newborns inherit the strongest neighbouring lineage, faded one step
              const m = Math.max(blue[i0], blue[i1], blue[i2], blue[i3], blue[i4], blue[i5], blue[i6], blue[i7]);
              blueB[mid + x] = m > 0 ? m - 1 : 0;
            }
          } else {
            age[mid + x] = 0;
            blueB[mid + x] = 0;
          }
        }
      }
      [this.a, this.b] = [this.b, this.a];
      [this.blue, this.blueB] = [this.blueB, this.blue];
      this.gen++;
      // Gentle re-sprinkle so a region never goes permanently still
      if (this.gen % 150 === 0) {
        for (let i = 0; i < this.a.length; i++) {
          if (!this.wall[i] && Math.random() < 0.04) this.a[i] = 1;
        }
      }
    }

    breath(now) {
      const s = (Math.sin((now / 36000) * Math.PI * 2 + this.phase) + 1) / 2;
      return 0.04 + s * 0.3; // sometimes almost invisible
    }

    /* ---- Paint ----
       One clearRect, then a counting sort of the living cells into the 19
       alpha buckets, then one fillStyle and a run of fillRects per bucket that
       has anything in it. Nothing is allocated: every array below was sized
       with the grid.

       The fill is inset 1px from the cell's leading edges, which is where the
       graph paper draws its rules. So the gradient's lines are never painted
       over — the cell sits INSIDE its square rather than on top of it — and
       the translucency does the rest wherever a line and a cell do meet.

       And the leading edges are the ROOT'S, which is what `-phase` buys: the
       square a cell is drawn inside is the same square the gradient drew, so
       the 1px inset lands on the same 1px rule it was measured against. Drawn
       from the region's own corner instead, the inset would sit a few pixels
       off the line everywhere the region does not start on one. */
    render(breath) {
      this.lastBreath = breath;
      const ctx = this.ctx;
      if (!this.ready || !ctx) return;
      ctx.clearRect(0, 0, this.w, this.h);
      if (!hasInk()) return;

      for (let k = 0; k <= AGE_STEPS; k++) {
        styles[k] = `rgba(${palette.cell}, ${((0.5 + k * 0.05) * breath).toFixed(4)})`;
      }
      for (let v = 1; v <= BLUE_LIFE; v++) {
        // Your interventions are visibly yours for a few generations
        styles[AGE_STEPS + v] = `rgba(${palette.accent}, ${(0.1 + v * 0.045).toFixed(4)})`;
      }

      const { a, age, blue, vis, cellBucket, order, bCount, bStart, bCur, cols, cell,
              phaseX, phaseY } = this;
      const n = vis.length;
      bCount.fill(0);

      for (let i = 0; i < n; i++) {
        const si = vis[i];
        if (!a[si]) { cellBucket[i] = -1; continue; }
        const bucket = blue[si] > 0
          ? AGE_STEPS + Math.min(blue[si], BLUE_LIFE)
          : Math.min(age[si], AGE_STEPS);
        cellBucket[i] = bucket;
        bCount[bucket]++;
      }

      bStart[0] = 0;
      for (let k = 0; k < BUCKETS; k++) {
        bStart[k + 1] = bStart[k] + bCount[k];
        bCur[k] = bStart[k];
      }
      for (let i = 0; i < n; i++) {
        const bucket = cellBucket[i];
        if (bucket >= 0) order[bCur[bucket]++] = i;
      }

      const size = cell - 1;
      const x0 = 1 - phaseX;   // cell 0's leading edge + the graph paper's rule
      const y0 = 1 - phaseY;
      for (let k = 0; k < BUCKETS; k++) {
        if (!bCount[k]) continue;
        ctx.fillStyle = styles[k];
        for (let j = bStart[k]; j < bStart[k + 1]; j++) {
          const i = order[j];
          ctx.fillRect((i % cols) * cell + x0, ((i / cols) | 0) * cell + y0, size, size);
        }
      }

      if (this.hover >= 0 && this.hover < n) {
        ctx.fillStyle = `rgba(${palette.accent}, ${HOVER_ALPHA})`;
        ctx.fillRect((this.hover % cols) * cell + x0, ((this.hover / cols) | 0) * cell + y0, size, size);
      }
    }

    frame(now) {
      if (!this.running || !this.ready) return;
      if (now - this.last < TICK) return;
      this.last = now;
      this.step();
      this.render(RM ? 0.25 : this.breath(now));
    }
  }

  /* ---- Inject rails into every band that has a well ---- */
  function injectRails(root) {
    root.querySelectorAll(".band").forEach((band) => {
      const well = band.querySelector(".well");
      if (!well || band.querySelector(".rail")) return;
      const l = document.createElement("div");
      l.className = "rail rail--l";
      l.setAttribute("aria-hidden", "true");
      const r = document.createElement("div");
      r.className = "rail rail--r";
      r.setAttribute("aria-hidden", "true");
      band.insertBefore(l, well);
      well.after(r);
    });
  }

  injectRails(document);
  /* ORDER, AND IT IS THE ONE ORDERING IN THIS FILE THAT IS NOT NEGOTIABLE.
     The rails have to exist before the terminators can be measured against
     them, and the terminators have to settle before any canvas is sized —
     the slack moves the rails, so a bitmap built first is a bitmap built for
     a height that is about to change. Nothing is drawn yet at this point:
     the Region constructors below are what build the canvases. */
  settleTerminators(document);

  const pageRegions = [];
  const caseRegions = [];
  document.querySelectorAll(".rail, .strip").forEach((el) => {
    const region = new Region(el, el.classList.contains("strip") ? "strip" : "rail");
    (el.closest(".case") ? caseRegions : pageRegions).push(region);
  });
  const all = [...pageRegions, ...caseRegions];

  /* The dialog's band is its own lattice root, so its slack is independent of
     the page's and the two settle separately. Null on the three pages that
     ship no case dialog, where `caseRegions` is empty anyway. */
  const caseEl = document.querySelector(".case");

  /* ONE REBUILD PATH, sequenced once, rather than a second listener that also
     wants to know when layout moved: settle the slack, THEN read the walls it
     just moved, THEN size the bitmaps. Every trigger below goes through here. */
  function rebuild(regions, scope) {
    if (!regions.length) return;
    settleTerminators(scope);
    const walls = collectWalls();
    regions.forEach((r) => r.build(walls));
  }

  // The case page lays out only when opened — rebuild its cells then.
  window.rebuildCaseSquares = () => rebuild(caseRegions, caseEl ?? document);

  /* ---- Run only what's on screen ---- */
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      const region = all.find((r) => r.el === e.target);
      if (region) region.running = e.isIntersecting;
    }
  });
  all.forEach((r) => io.observe(r.el));

  /* Webfonts change section heights, so they change every plate's remainder
     too — this is a re-settle as much as a rebuild, and it goes through the
     same path rather than getting a terminator pass of its own. */
  document.fonts?.ready.then(() => rebuild(pageRegions, document));

  // Both inks belong to the theme. Re-read them and repaint the generation
  // that is already on screen — the life goes on, it just changes colour.
  window.addEventListener("themechange", () => {
    readPalette();
    all.forEach((r) => r.render(r.lastBreath));
  });

  /* Debounced, and the debounce is now doing two jobs: it coalesces a drag into
     one rebuild, and it means the terminator pass runs after the resize has
     stopped rather than during it. The pass cannot ping-pong either way — it
     resets to the base before every measurement, so a run is a pure function of
     the un-slacked layout and there is no carried value to oscillate. */
  let resizeT;
  window.addEventListener("resize", () => {
    clearTimeout(resizeT);
    resizeT = setTimeout(() => {
      rebuild(pageRegions, document);
      if (caseEl && !caseEl.hidden) rebuild(caseRegions, caseEl);
    }, 200);
  });

  /* ---- Run, or stand still ----
     Under reduce-motion the regions are not animated at all: the loop is
     cancelled rather than left spinning on a no-op branch, and the grid is
     frozen at a settled opacity. Clicks still seed and still render, so the
     cells remain something you can touch — stillness, not deadness.

     Flipping the OS setting mid-visit starts or stops the loop in place.
     The generation on screen is kept either way: turning motion back on
     resumes the life that was already there rather than reseeding it — and
     turning it ON freezes what is on screen rather than re-settling, because
     the reader is looking at that. Settling a NEW grid belongs to build(),
     which is the only place that knows a grid is new. */
  let rafId = 0;

  function loop(now) {
    if (!document.hidden) all.forEach((r) => r.frame(now));
    rafId = requestAnimationFrame(loop);
  }

  function applyMotion() {
    if (RM) {
      if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
      all.forEach((r) => r.render(0.25));
      return;
    }
    if (!rafId) rafId = requestAnimationFrame(loop);
  }

  applyMotion();

  RMQ.addEventListener("change", (e) => {
    RM = e.matches;
    applyMotion();
  });

  /* ---- What this costs, stated by the thing that spends it ----
     The div model's numbers had to be reverse-engineered from layout every
     time anyone wanted them, which is why the spec's cost table carries a
     hand derivation. The engine can just say. Returns live totals for the
     four figures the skeleton spec is gated on. */
  window.automataStats = () => {
    const live = all.filter((r) => r.ready);
    const sum = (f) => live.reduce((t, r) => t + f(r), 0);
    return {
      regions: all.length,
      built: live.length,
      lattice: live[0]?.cell ?? null,
      /* The two the lattice is actually gated on. `offPhaseX` is 0 at every
         width — that is what the column snapping bought — and `offPhaseY` is
         the count of regions the terminator could not drive onto a line,
         which is one per `.sec__head` and nothing else. Reported rather than
         asserted, so a regression is a number instead of a look.

         TWO-SIDED, for the same reason the terminator's own guard is: a region
         0.016px PAST a line reads back as a phase of 23.984, and counting that
         as off-lattice would report a rounding artefact as a defect. Measured
         at 375px, where the work band lands there. */
      offPhaseX: live.filter((r) => offLattice(r.phaseX, r.cell)).length,
      offPhaseY: live.filter((r) => offLattice(r.phaseY, r.cell)).length,
      terminators: document.querySelectorAll(".term").length,
      cellsPerGeneration: sum((r) => r.simC * r.simR),
      visibleCells: sum((r) => r.cols * r.rows),
      maskedByWalls: sum((r) => r.masked),
      offStageCells: sum((r) => r.simC * r.simR - r.cols * r.rows),
      generations: sum((r) => r.gen),
      bitmapMegapixels: +(sum((r) => r.canvas.width * r.canvas.height) / 1e6).toFixed(2),
      running: rafId !== 0,
      reducedMotion: RM,
    };
  };
})();
