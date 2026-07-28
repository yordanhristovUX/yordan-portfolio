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
  /* prefers-reduced-motion is a LIVE setting, not a load-time constant.
     This codebase already mandates re-reading themed colour on every
     `themechange` (js/automata.js); a reader who turns "reduce motion" on
     halfway down the page has made the same kind of change, and it is the
     worse one to ignore — a colour preference is taste, this one is often
     a symptom. So RM is re-read on the media query's own change event, and
     every duration below is resolved at the moment its tween is built.

     What CANNOT be re-decided is the `js` class. It is what makes
     css/style.css hide [data-reveal]/[data-rise] so they can be animated
     IN — i.e. a promise that a script will reveal this page's content.
     Adding it later would hide content that is already on screen and make
     it wait for a scroll. So it stays a one-time load decision, and reduce
     turning on afterwards is handled the other way: finish what is in
     flight, and build everything later at duration 0. */
  const RMQ = window.matchMedia("(prefers-reduced-motion: reduce)");
  let RM = RMQ.matches;

  /** Duration resolved per tween, not per page load — that is the point. */
  const dur = (s) => (RM ? 0 : s);

  const HAS_GSAP = typeof gsap !== "undefined" && typeof SplitText !== "undefined";

  if (!HAS_GSAP) {
    console.warn("[portfolio] GSAP unavailable — rendering without motion.");
  }

  // Whether motion is WIRED UP at all. Load-time by necessity, see above.
  const MOTION = HAS_GSAP && !RM;

  if (MOTION) {
    document.documentElement.classList.add("js");
    gsap.registerPlugin(SplitText);
  }

  RMQ.addEventListener("change", (e) => {
    RM = e.matches;
    if (!RM || !HAS_GSAP) return;
    /* Reduce turned ON mid-visit: nothing may be left mid-move. Finish
       every tween running right now; everything built after this moment
       picks up dur() === 0 on its own, including the reveals that have not
       been scrolled to yet. */
    gsap.globalTimeline.getChildren(true, true, true).forEach((t) => t.progress(1));
  });

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
      .from(".hero__role", { opacity: 0, duration: dur(0.4), ease: "steps(4)" })
      .to(".hero [data-rise]", {
        y: 0, yPercent: 0, duration: dur(0.9), ease: "power3.out", stagger: dur(0.12),
      }, "-=0.1")
      .from(".hero__body, .profile", {
        opacity: 0, y: 16, duration: dur(0.7), ease: "power2.out", stagger: dur(0.12),
      }, "-=0.4");

    // Failsafe: if rAF is throttled (background tab), settle the page immediately
    setTimeout(() => { if (intro.progress() < 1) intro.progress(1); }, 4000);

    // The contact headline rises when scrolled to (CSS pre-sets the offset)
    onceInView($(".tx__big"), 88, () =>
      gsap.to(".tx__big[data-rise]", { y: 0, yPercent: 0, duration: dur(0.9), ease: "power3.out" })
    );
  }

  /* ---------- Scroll reveals ----------
     Where the resting state is not already set by CSS, gsap.set establishes it
     up front — otherwise an element below the fold would sit visible and then
     snap to its start state the moment it was observed. */
  if (MOTION) {
    $$("[data-reveal]").forEach((el) =>
      onceInView(el, 88, () =>
        gsap.to(el, { opacity: 1, y: 0, duration: dur(0.7), ease: "power2.out" })
      )
    );

    // Work rows: stamp in with a stepped ease
    $$(".idx__row").forEach((el) => {
      gsap.set(el, { opacity: 0 });
      onceInView(el, 92, () =>
        gsap.to(el, { opacity: 1, duration: dur(0.45), ease: "steps(5)" })
      );
    });

    // Section titles: masked line rise, after fonts settle
    document.fonts.ready.then(() => {
      $$(".sec__title").forEach((el) => {
        const split = new SplitText(el, { type: "lines", mask: "lines" });
        gsap.set(split.lines, { yPercent: 110 });
        onceInView(el, 90, () =>
          gsap.to(split.lines, { yPercent: 0, duration: dur(0.7), ease: "power3.out" })
        );
      });

      $$("[data-lines]").forEach((el) => {
        const split = new SplitText(el, { type: "lines" });
        gsap.set(split.lines, { opacity: 0.12, y: 10 });
        onceInView(el, 82, () =>
          gsap.to(split.lines, {
            opacity: 1, y: 0, duration: dur(0.55), ease: "power2.out", stagger: dur(0.09),
          })
        );
      });
    });

    /* ---------- Counters ----------
       Click upward in whole steps — odometer, not tween.

       The zero belongs to the ANIMATION, not to the document. "42km —
       Marathon finisher" is a fact about a person; if this script never
       runs, or GSAP 404s, or the ticker is throttled to a stop, the page
       must still say 42. A page that says he ran 0km is not a degraded
       page, it is a false one, and false is worse than blank — which is
       the opposite of what the degradation contract at the top of this
       file promises. So nothing here ever writes a number the markup did
       not already assert: the counter is zeroed at the instant it starts
       counting, and only when a tween is actually going to run.

       (Until scripts/build-content.mjs emits the real figure instead of a
       literal `0`, the no-motion branch below still has to correct the
       markup. That assignment is idempotent — it writes exactly what the
       markup will ship — so it can stay or go once the emitter lands.) */
    $$("[data-count]").forEach((el) => {
      const target = +el.dataset.count;
      if (!Number.isFinite(target)) return;
      const land = () => { el.textContent = String(target); };
      onceInView(el, 88, () => {
        if (RM) { land(); return; }
        const obj = { v: 0 };
        /* The zero is never written here. It arrives as the tween's own
           first frame, which means a ticker that never ticks — a throttled
           background tab, a GSAP that loaded but stalled — leaves the
           markup's real figure on screen instead of parking a 0 there for
           four seconds waiting for the failsafe. Motion may replace the
           number; its absence may not. */
        const tw = gsap.to(obj, {
          v: target, duration: 1.4, ease: "steps(" + Math.min(target, 24) + ")",
          onUpdate: () => (el.textContent = String(Math.round(obj.v))),
          onComplete: land,
        });
        /* Same failsafe as the intro timeline: a stalled or throttled
           ticker must never be the reason a fact reads 0. */
        setTimeout(() => { if (tw.progress() < 1) { tw.progress(1); land(); } }, 4000);
      });
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
    gsap.fromTo($(".case__backdrop"), { opacity: 0 }, { opacity: 1, duration: dur(0.25) });
    gsap.fromTo(panel, { yPercent: 100 }, {
      yPercent: 0, duration: dur(0.5), ease: "power3.out",
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

    gsap.to($(".case__backdrop"), { opacity: 0, duration: dur(0.2) });
    gsap.to(panel, {
      yPercent: 100, duration: dur(0.4), ease: "power2.in",
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
