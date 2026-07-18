/* ============================================================
   Blueprint variant — interactions (GSAP)
   Motion language: mechanical, stepped, no bounce. The sheet is
   already drawn; things register into place rather than float.
   ============================================================ */
(() => {
  const RM = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  document.documentElement.classList.add("js");
  gsap.registerPlugin(ScrollTrigger, SplitText);

  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];

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
  if (!RM) {
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

    // The contact headline rises when scrolled to
    gsap.to(".tx__big[data-rise]", {
      y: 0, yPercent: 0, duration: 0.9, ease: "power3.out",
      scrollTrigger: { trigger: ".tx__big", start: "top 88%", once: true },
    });
  }

  /* ---------- Scroll reveals ---------- */
  if (!RM) {
    $$("[data-reveal]").forEach((el) => {
      gsap.to(el, {
        opacity: 1, y: 0, duration: 0.7, ease: "power2.out",
        scrollTrigger: { trigger: el, start: "top 88%", once: true },
      });
    });

    // Work rows: stamp in with a stepped ease
    $$(".idx__row").forEach((el) => {
      gsap.from(el, {
        opacity: 0, duration: 0.45, ease: "steps(5)",
        scrollTrigger: { trigger: el, start: "top 92%", once: true },
      });
    });

    // Section titles: masked line rise, after fonts settle
    document.fonts.ready.then(() => {
      $$(".sec__title").forEach((el) => {
        const split = new SplitText(el, { type: "lines", mask: "lines" });
        gsap.from(split.lines, {
          yPercent: 110, duration: 0.7, ease: "power3.out",
          scrollTrigger: { trigger: el, start: "top 90%", once: true },
        });
      });

      $$("[data-lines]").forEach((el) => {
        const split = new SplitText(el, { type: "lines" });
        gsap.from(split.lines, {
          opacity: 0.12, y: 10, duration: 0.55, ease: "power2.out", stagger: 0.09,
          scrollTrigger: { trigger: el, start: "top 82%", once: true },
        });
      });
      ScrollTrigger.refresh();
    });

    // Counters click upward in whole steps — odometer, not tween
    $$("[data-count]").forEach((el) => {
      const target = +el.dataset.count;
      const obj = { v: 0 };
      gsap.to(obj, {
        v: target, duration: 1.4, ease: "steps(" + Math.min(target, 24) + ")",
        onUpdate: () => (el.textContent = Math.round(obj.v)),
        scrollTrigger: { trigger: el, start: "top 88%", once: true },
      });
    });
  } else {
    $$("[data-count]").forEach((el) => (el.textContent = el.dataset.count));
  }

  /* ---------- Case study page ---------- */
  const overlay = $(".case");
  const panel = $(".case__panel");
  const scrollBox = $(".case__scroll");
  let lastFocused = null;

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

    lastFocused = document.activeElement;
    overlay.hidden = false;
    document.body.classList.add("is-locked");
    requestAnimationFrame(() => window.rebuildCaseSquares?.());

    gsap.fromTo($(".case__backdrop"), { opacity: 0 }, { opacity: 1, duration: RM ? 0 : 0.25 });
    gsap.fromTo(panel, { yPercent: 100 }, {
      yPercent: 0, duration: RM ? 0 : 0.5, ease: "power3.out",
      onComplete: () => panel.focus({ preventScroll: true }),
    });
  }

  function closeCase() {
    gsap.to($(".case__backdrop"), { opacity: 0, duration: RM ? 0 : 0.2 });
    gsap.to(panel, {
      yPercent: 100, duration: RM ? 0 : 0.4, ease: "power2.in",
      onComplete: () => {
        overlay.hidden = true;
        document.body.classList.remove("is-locked");
        lastFocused?.focus();
      },
    });
  }

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
