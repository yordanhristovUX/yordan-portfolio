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
  }

  /* ---------- The odometer, and why it is gone ----------

     A `[data-count]` loop used to live here: an unexpected fact's numeral
     clicked upward in whole steps on scroll, with a 4s failsafe for a
     ticker throttled by a background tab.

     It was the file's showpiece for the degradation contract at the top.
     The animation wants to start at 0, but "42 km — Marathon finisher" is
     a claim about a person, and a page that says he ran 0 km is not a
     degraded page, it is a FALSE one — worse than blank. So the zero was
     never written by this file: it arrived as the tween's own first frame,
     which meant a stalled ticker left the markup's real figure on screen
     instead of parking a 0 there. The no-motion branch wrote the number
     out directly.

     None of that has a subject any more. The owner removed the numerals
     from the facts — he wanted them small and tidy rather than headline
     figures, and his reasoning is quoted verbatim above `factCell()` in
     scripts/build-content.mjs. So `facts.json` carries no `value`, `unit`
     or `count`, that emitter writes no `.fact__num`, and no element in
     this repo carries `data-count`. Verified across index.html, cv.html,
     mcp.html and evals.html (0 matches each, live), every story, and
     evals/run.mjs's own `.facts` block, which writes its numbers as text.

     The rule the loop encoded is not gone with it, and is the reason this
     note is longer than a deletion needs: **progressive enhancement means
     a script failure yields a static readable page, never a wrong one.**
     Anything reinstated here must still ship its truth in the markup and
     let motion only replace it. `design-system/components/fact/spec.md`
     still documents `data-count` as a live hook; it now documents one
     nothing produces and nothing consumes. */

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
