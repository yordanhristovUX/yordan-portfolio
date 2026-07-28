/* ============================================================
   Blueprint variant — interactions (GSAP)
   Motion language: mechanical, stepped, no bounce. The sheet is
   already drawn; things register into place rather than float.

   Degradation contract: `css/style.css` hides [data-reveal] and
   [data-rise] behind the `js` class so they can be animated in. That
   class is therefore only added once GSAP is CONFIRMED loaded — if it
   is missing, the rules never match and the page renders as static
   content instead of a permanently blank one. Everything outside the
   motion blocks (clock, case studies, focus handling) runs either way.
   ============================================================ */
(() => {
  const RM = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const HAS_GSAP = typeof gsap !== "undefined" && typeof SplitText !== "undefined";

  if (!HAS_GSAP) {
    console.warn("[portfolio] GSAP unavailable — rendering without motion.");
  }

  // The one condition that governs whether anything moves.
  const MOTION = HAS_GSAP && !RM;

  if (MOTION) {
    document.documentElement.classList.add("js");
    gsap.registerPlugin(SplitText);
  }

  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];

  /* ---------- Scroll triggering ----------
     Every trigger on this page is "fire once when this scrolls into view",
     which is what IntersectionObserver is. `pct` is the point down the
     viewport the element's top must cross — the same geometry ScrollTrigger
     writes as `start: "top 88%"`, expressed as a negative bottom root margin.
     One observer per distinct threshold, not per element. */
  const CB = Symbol("inview");
  const observers = new Map();
  function onceInView(el, pct, fn) {
    const margin = `0px 0px -${100 - pct}% 0px`;
    let io = observers.get(margin);
    if (!io) {
      io = new IntersectionObserver((entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          io.unobserve(e.target);
          e.target[CB]();
        }
      }, { rootMargin: margin });
      observers.set(margin, io);
    }
    el[CB] = fn;
    io.observe(el);
  }

  /* ---------- Clock ---------- */
  $("#year").textContent = new Date().getFullYear();
  const fmtTime = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit", minute: "2-digit", timeZone: "Europe/Sofia",
  });
  const clockEl = $("#local-time");
  const tickClock = () => (clockEl.textContent = fmtTime.format(new Date()));
  tickClock();
  setInterval(tickClock, 30_000);

  /* ---------- Intro: the hero registers into place ---------- */
  if (MOTION) {
    const intro = gsap.timeline();
    intro
      .from(".hero__role", { opacity: 0, duration: 0.4, ease: "steps(4)" })
      .to(".hero [data-rise]", {
        y: 0, yPercent: 0, duration: 0.9, ease: "power3.out", stagger: 0.12,
      }, "-=0.1")
      .from(".hero__body, .profile", {
        opacity: 0, y: 16, duration: 0.7, ease: "power2.out", stagger: 0.12,
      }, "-=0.4");

    // Failsafe: if rAF is throttled (background tab), settle the page immediately
    setTimeout(() => { if (intro.progress() < 1) intro.progress(1); }, 4000);

    // The contact headline rises when scrolled to (CSS pre-sets the offset)
    onceInView($(".tx__big"), 88, () =>
      gsap.to(".tx__big[data-rise]", { y: 0, yPercent: 0, duration: 0.9, ease: "power3.out" })
    );
  }

  /* ---------- Scroll reveals ----------
     Where the resting state is not already set by CSS, gsap.set establishes it
     up front — otherwise an element below the fold would sit visible and then
     snap to its start state the moment it was observed. */
  if (MOTION) {
    $$("[data-reveal]").forEach((el) =>
      onceInView(el, 88, () =>
        gsap.to(el, { opacity: 1, y: 0, duration: 0.7, ease: "power2.out" })
      )
    );

    // Work rows: stamp in with a stepped ease
    $$(".idx__row").forEach((el) => {
      gsap.set(el, { opacity: 0 });
      onceInView(el, 92, () =>
        gsap.to(el, { opacity: 1, duration: 0.45, ease: "steps(5)" })
      );
    });

    // Section titles: masked line rise, after fonts settle
    document.fonts.ready.then(() => {
      $$(".sec__title").forEach((el) => {
        const split = new SplitText(el, { type: "lines", mask: "lines" });
        gsap.set(split.lines, { yPercent: 110 });
        onceInView(el, 90, () =>
          gsap.to(split.lines, { yPercent: 0, duration: 0.7, ease: "power3.out" })
        );
      });

      $$("[data-lines]").forEach((el) => {
        const split = new SplitText(el, { type: "lines" });
        gsap.set(split.lines, { opacity: 0.12, y: 10 });
        onceInView(el, 82, () =>
          gsap.to(split.lines, {
            opacity: 1, y: 0, duration: 0.55, ease: "power2.out", stagger: 0.09,
          })
        );
      });
    });

    // Counters click upward in whole steps — odometer, not tween
    $$("[data-count]").forEach((el) => {
      const target = +el.dataset.count;
      const obj = { v: 0 };
      onceInView(el, 88, () =>
        gsap.to(obj, {
          v: target, duration: 1.4, ease: "steps(" + Math.min(target, 24) + ")",
          onUpdate: () => (el.textContent = Math.round(obj.v)),
        })
      );
    });
  } else {
    // No motion: the numbers are the content, so they arrive already counted.
    $$("[data-count]").forEach((el) => (el.textContent = el.dataset.count));
  }

  /* ---------- Case study page ---------- */
  const overlay = $(".case");
  const panel = $(".case__panel");
  const scrollBox = $(".case__scroll");
  let lastFocused = null;

  /* The scroller is the element that actually holds the case study —
     ~2150px of it below the fold — and it is the only thing in the dialog
     with `overflow-y: auto`. The panel's own overflow is `visible`, so
     focusing the PANEL leaves the scroller as a descendant of the focused
     element rather than an ancestor of it, and no key the reader presses
     has anywhere to go: `<body>` is locked, the trap collects one control,
     and Page Down does nothing. Making the scroller focusable is what
     turns the dialog back into something you can read with a keyboard
     (WCAG 2.1.1). The trap needs no change — it picks the scroller up on
     its own, because it collects `[tabindex]:not([tabindex="-1"])`.

     `tabindex`, `role` and `aria-label` live in the MARKUP, not here — a
     keyboard path should not depend on a script having run. This file only
     narrows the label to the open case's title, which is the one part that
     is genuinely dynamic. */

  function openCase(id) {
    const data = window.CASE_STUDIES[id];
    if (!data) return;

    $(".case__index").textContent = "Case study " + data.index;
    $(".case__title").textContent = data.title;
    $(".case__subtitle").textContent = data.subtitle;
    $(".case__meta").innerHTML = data.meta
      .map((m) => `<span class="chip${data.accentMeta?.includes(m) ? " chip--solid" : ""}">${m}</span>`)
      .join("");
    $(".case__content").innerHTML = data.content;
    scrollBox.scrollTop = 0;
    scrollBox.setAttribute("aria-label", data.title + " — case study");

    lastFocused = document.activeElement;
    overlay.hidden = false;
    document.body.classList.add("is-locked");
    requestAnimationFrame(() => window.rebuildCaseSquares?.());

    if (!HAS_GSAP) {
      scrollBox.focus({ preventScroll: true });
      return;
    }
    gsap.fromTo($(".case__backdrop"), { opacity: 0 }, { opacity: 1, duration: RM ? 0 : 0.25 });
    gsap.fromTo(panel, { yPercent: 100 }, {
      yPercent: 0, duration: RM ? 0 : 0.5, ease: "power3.out",
      onComplete: () => scrollBox.focus({ preventScroll: true }),
    });
  }

  function closeCase() {
    const dismiss = () => {
      overlay.hidden = true;
      document.body.classList.remove("is-locked");
      lastFocused?.focus();
    };

    if (!HAS_GSAP) { dismiss(); return; }

    gsap.to($(".case__backdrop"), { opacity: 0, duration: RM ? 0 : 0.2 });
    gsap.to(panel, {
      yPercent: 100, duration: RM ? 0 : 0.4, ease: "power2.in",
      onComplete: dismiss,
    });
  }

  /* The dialog is the site's, not the chat's. js/answer-render.js builds
     `.idx__row`s for the assistant's `project` blocks and opens THIS
     dialog with them — same focus trap, same rail rebuild, same content.
     A second dialog would be a second set of bugs. */
  window.openCase = openCase;

  $$("[data-project]").forEach((btn) =>
    btn.addEventListener("click", () => openCase(btn.dataset.project))
  );
  $$("[data-case-close]").forEach((el) => el.addEventListener("click", closeCase));

  document.addEventListener("keydown", (e) => {
    if (overlay.hidden) return;
    if (e.key === "Escape") closeCase();
    if (e.key === "Tab") {
      const focusables = $$('button, a[href], [tabindex]:not([tabindex="-1"])', overlay)
        .filter((el) => el.offsetParent !== null);
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        last.focus(); e.preventDefault();
      } else if (!e.shiftKey && document.activeElement === last) {
        first.focus(); e.preventDefault();
      }
    }
  });
})();
