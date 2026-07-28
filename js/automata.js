/* ============================================================
   Squares engine — the skeleton and the life are one system.
   Every visible square is a real .sq div sized by the layout's own
   fr tracks. Conway's Life runs over those squares in two kinds of
   regions: the side rails of every band (sim extends 6 hidden
   columns "under the paper", so life wanders in and out) and the
   separator strips (sim extends hidden rows above and below).

   Interactions: hovering a square lights it accent-blue (CSS);
   clicking seeds new life there — cells born from a click carry an
   accent-blue lineage that fades toward stone over generations.

   Subtlety: each region breathes — cell opacity rides a slow sine
   (~36 s, phase-offset per region) down to near-invisible.
   ============================================================ */
(() => {
  /* Reduce-motion is re-read on change, exactly as the two inks below are
     re-read on `themechange`. Both are settings the reader can flip while
     the page is open; only one of them was being listened to. */
  const RMQ = window.matchMedia("(prefers-reduced-motion: reduce)");
  let RM = RMQ.matches;
  const MOBILE = window.matchMedia("(max-width: 760px)");

  /* The two inks are read from the design system rather than restated here:
     both flip with the theme, and a hardcoded stone-500 would sink into the
     page the moment the sheet goes dark. Re-read on every theme change. */
  const palette = { cell: "120, 113, 108", accent: "0, 60, 240" };
  function readPalette() {
    const cs = getComputedStyle(document.documentElement);
    const cell = cs.getPropertyValue("--automata-cell-rgb").trim();
    const accent = cs.getPropertyValue("--accent-rgb").trim();
    if (cell) palette.cell = cell;
    if (accent) palette.accent = accent;
  }
  readPalette();

  const TICK = 300;
  const HIDDEN_COLS = 6;         // rail sim columns under the paper
  const STRIP_SIM_ROWS = 10;     // strip sim height (2 visible)

  class Region {
    constructor(el, kind) { // kind: "rail" | "strip"
      this.el = el;
      this.kind = kind;
      this.phase = Math.random() * Math.PI * 2;
      this.running = true;
      this.last = 0;
      this.lastBreath = 0.3;
      this.build();
      el.addEventListener("click", (e) => this.seedAt(e));
    }

    geometry() {
      if (this.kind === "rail") {
        const vc = MOBILE.matches ? 1 : 2;
        const size = this.el.clientWidth / vc;
        const vr = size > 0 ? Math.floor(this.el.clientHeight / size) : 0;
        return { vc, vr, simC: vc + HIDDEN_COLS, simR: Math.max(vr, 3) };
      }
      const vc = MOBILE.matches ? 12 : 24;
      return { vc, vr: 2, simC: vc, simR: STRIP_SIM_ROWS };
    }

    build() {
      const g = this.geometry();
      Object.assign(this, g);
      this.el.style.gridTemplateColumns = `repeat(${g.vc}, 1fr)`;
      this.el.textContent = "";
      this.cells = [];
      const frag = document.createDocumentFragment();
      for (let i = 0; i < g.vc * g.vr; i++) {
        const d = document.createElement("div");
        d.className = "sq";
        d.dataset.i = i;
        frag.appendChild(d);
        this.cells.push(d);
      }
      this.el.appendChild(frag);
      const n = g.simC * g.simR;
      this.a = new Uint8Array(n);
      this.b = new Uint8Array(n);
      this.age = new Uint8Array(n);
      this.blue = new Uint8Array(n);   // accent lineage countdown
      this.blueB = new Uint8Array(n);
      this.gen = 0;
      this.seed();
      this.render(this.lastBreath);
    }

    seed() {
      for (let i = 0; i < this.a.length; i++) this.a[i] = Math.random() < 0.18 ? 1 : 0;
    }

    // visible cell index -> sim index (strips show the middle rows)
    simIndex(vi) {
      const vx = vi % this.vc;
      const vy = (vi / this.vc) | 0;
      if (this.kind === "rail") return vy * this.simC + vx;
      const first = (this.simR - this.vr) >> 1;
      return (first + vy) * this.simC + vx;
    }

    seedAt(e) {
      const t = e.target.closest(".sq");
      if (!t || t.parentElement !== this.el) return;
      const si = this.simIndex(+t.dataset.i);
      const sx = si % this.simC;
      const sy = (si / this.simC) | 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (Math.random() > 0.7) continue;
          const j = ((sy + dy + this.simR) % this.simR) * this.simC +
                    ((sx + dx + this.simC) % this.simC);
          this.a[j] = 1;
          this.age[j] = 0;
          this.blue[j] = 10;
        }
      }
      this.a[si] = 1;
      this.blue[si] = 10;
      this.render(this.lastBreath);
    }

    step() {
      const { a, b, blue, blueB, age, simC: cols, simR: rows } = this;
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
          const next = alive ? (n === 2 || n === 3 ? 1 : 0) : n === 3 ? 1 : 0;
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
          if (Math.random() < 0.04) this.a[i] = 1;
        }
      }
    }

    breath(now) {
      const s = (Math.sin((now / 36000) * Math.PI * 2 + this.phase) + 1) / 2;
      return 0.04 + s * 0.3; // sometimes almost invisible
    }

    render(breath) {
      this.lastBreath = breath;
      const { cells, a, age, blue } = this;
      for (let vi = 0; vi < cells.length; vi++) {
        const si = this.simIndex(vi);
        const el = cells[vi];
        if (!a[si]) {
          if (el.style.backgroundColor) el.style.backgroundColor = "";
          continue;
        }
        if (blue[si] > 0) {
          // Your interventions are visibly yours for a few generations
          el.style.backgroundColor = `rgba(${palette.accent}, ${0.1 + blue[si] * 0.045})`;
        } else {
          const alpha = (0.5 + Math.min(age[si], 8) * 0.05) * breath;
          el.style.backgroundColor = `rgba(${palette.cell}, ${alpha})`;
        }
      }
    }

    frame(now) {
      if (!this.running) return;
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

  const pageRegions = [];
  const caseRegions = [];
  document.querySelectorAll(".rail, .strip").forEach((el) => {
    const region = new Region(el, el.classList.contains("strip") ? "strip" : "rail");
    (el.closest(".case") ? caseRegions : pageRegions).push(region);
  });

  // The case page lays out only when opened — rebuild its squares then.
  window.rebuildCaseSquares = () => caseRegions.forEach((r) => r.build());

  /* ---- Run only what's on screen ---- */
  const all = [...pageRegions, ...caseRegions];
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      const region = all.find((r) => r.el === e.target);
      if (region) region.running = e.isIntersecting;
    }
  });
  all.forEach((r) => io.observe(r.el));

  // Webfonts change section heights — rebuild rails once they settle.
  document.fonts?.ready.then(() => pageRegions.forEach((r) => r.build()));

  // Both inks belong to the theme. Re-read them and repaint the generation
  // that is already on screen — the life goes on, it just changes colour.
  window.addEventListener("themechange", () => {
    readPalette();
    all.forEach((r) => r.render(r.lastBreath));
  });

  let resizeT;
  window.addEventListener("resize", () => {
    clearTimeout(resizeT);
    resizeT = setTimeout(() => {
      pageRegions.forEach((r) => r.build());
      if (!document.querySelector(".case")?.hidden) caseRegions.forEach((r) => r.build());
    }, 200);
  });

  /* ---- Run, or stand still ----
     Under reduce-motion the rails are not animated at all: the loop is
     cancelled rather than left spinning on a no-op branch, and the grid is
     frozen at a settled opacity. Clicks still seed and still render, so the
     squares remain something you can touch — stillness, not deadness.

     Flipping the OS setting mid-visit starts or stops the loop in place.
     The generation on screen is kept either way: turning motion back on
     resumes the life that was already there rather than reseeding it. */
  let rafId = 0;

  function loop(now) {
    if (!document.hidden) all.forEach((r) => r.frame(now));
    rafId = requestAnimationFrame(loop);
  }

  function applyMotion({ initial = false } = {}) {
    if (RM) {
      if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
      // On first load, settle a few generations so stillness is a pattern
      // rather than the random seed. On a later flip, freeze what is there.
      all.forEach((r) => {
        if (initial) for (let i = 0; i < 5; i++) r.step();
        r.render(0.25);
      });
      return;
    }
    if (!rafId) rafId = requestAnimationFrame(loop);
  }

  applyMotion({ initial: true });

  RMQ.addEventListener("change", (e) => {
    RM = e.matches;
    applyMotion();
  });
})();
