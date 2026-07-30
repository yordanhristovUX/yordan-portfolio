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

  /* ---------- Overlay layers ----------
     ONE thing on this page covers the reader now: the Ask drawer. There used
     to be two — the case-study modal stacked on top of the drawer, because an
     answer inside the drawer rendered rows that opened it, and `z-index: 400`
     under `500` put the case study above the drawer that opened it.

     The case studies are pages now, so an answer's project row is an anchor
     and nothing stacks on the drawer any more. **This layer machinery is kept
     as it is**, and that is deliberate rather than lazy: it is written for N
     layers, it is correct at N = 1, and the properties below — LIFO Escape,
     `inert` beneath the top, a body lock derived from depth — are the ones a
     future second layer would otherwise have to reinvent. Collapsing it to
     one layer would save nothing and would delete the reasoning.

     The stack is LIFO. Escape unwinds exactly ONE layer per press, Tab is
     trapped in the topmost layer only, and every layer beneath the top is
     `inert`, which takes it out of the tab order and the accessibility tree
     for as long as something covers it. `inert` is not a style and not
     visual state; the drawer's only visual state is still `data-open`.

     THE BODY LOCK IS DERIVED FROM THE STACK'S DEPTH, and that is not tidiness.
     `closeCase()` used to remove `is-locked` unconditionally, which with a
     drawer underneath would unlock the page while a modal was still covering
     it — and the mirror-image mistake (never removing it) is a reader left
     with a frozen page and nothing on screen to press. Computing the class
     from `layers.length` makes "Escape never leaves a locked body with no way
     out" true by construction rather than by inspection. */

  /* `textarea`, `input` and `details > summary` are in this list and were not
     in the one it replaces, because the drawer puts a composer and two
     disclosures (the tool trace, the citation list) inside a trap for the
     first time. A trap that cannot name the last focusable in its own subtree
     lets Tab walk out of it at that element, and which element is last here is
     decided by a model-composed answer rather than by this file.

     Nothing is filtered on `aria-disabled`, deliberately: the composer carries
     `aria-disabled` + `readOnly` while a request is in flight precisely so it
     KEEPS focus, and a trap that skipped it would undo the Wave 0 fix from the
     other end. Only the real `disabled` property is filtered — such an element
     cannot be focused at all. */
  const FOCUSABLE = [
    "a[href]", "button", "input", "select", "textarea",
    "details > summary", '[tabindex]:not([tabindex="-1"])',
  ].join(", ");

  /* `offsetParent !== null` was the old visibility test and it is not one.
     Measured on the live page: a `.source__link` inside a COLLAPSED `<details>`
     reports `offsetParent !== null` and a 357x20 rect while being unreachable
     by Tab, and every control inside the closed drawer reports the same — the
     drawer closes with `visibility: hidden`, which offsetParent does not see.
     Collecting an unreachable element is not cosmetic in a trap: if it lands
     first or last, the wrap focuses something the reader cannot see and the
     cycle silently breaks. `checkVisibility()` reads `visibility` and
     `content-visibility` as well as `display`, and it moved the drawer's
     collected set from 10 elements to the 11 that are actually there. The
     fallback for a browser without it is exactly the previous behaviour. */
  const isVisible = (el) =>
    el instanceof HTMLElement && el.isConnected &&
    (typeof el.checkVisibility === "function"
      ? el.checkVisibility({ visibilityProperty: true, contentVisibilityAuto: true })
      : el.offsetParent !== null);

  const focusablesIn = (root) =>
    $$(FOCUSABLE, root).filter((el) => !el.disabled && isVisible(el));

  /** Open overlays, innermost last. Each: { root, initial, returnTo, close }. */
  const layers = [];

  function syncLayers() {
    document.body.classList.toggle("is-locked", layers.length > 0);
    layers.forEach((layer, i) => {
      if (i < layers.length - 1) layer.root.setAttribute("inert", "");
      else layer.root.removeAttribute("inert");
    });
  }

  function pushLayer(layer) {
    layers.push(layer);
    syncLayers();
  }

  function popLayer(layer) {
    const i = layers.indexOf(layer);
    if (i === -1) return false;
    layers.splice(i, 1);
    syncLayers();
    return true;
  }

  /* Focus restoration, checked at the moment of use rather than assumed.
     `returnTo.focus()` is right whenever the reader closes one layer at a time,
     and silently does NOTHING when the target has stopped being focusable —
     measured: an element inside a `visibility: hidden` drawer no-ops the call
     and leaves activeElement where it was. That is the danger, not the call
     itself: `closeCase`'s `overlay.hidden = true` has already blurred the
     scroller to <body> by then, so a no-op restore leaves the reader on <body>
     with the page still locked behind a drawer that is still open — the Wave 0
     defect arriving by a new route. Two ways in: hold Escape and the case
     dialog's 0.4s exit tween is still running when the drawer beneath it
     closes, or the return target is inside a disclosure that is now collapsed.
     So the target is verified and the fallback is whichever layer is still
     open, which is somewhere the reader can always Tab out of. */
  function restoreFocus(returnTo) {
    if (isVisible(returnTo)) { returnTo.focus(); return; }
    const top = layers[layers.length - 1];
    if (top && isVisible(top.initial)) top.initial.focus({ preventScroll: true });
  }

  document.addEventListener("keydown", (e) => {
    const top = layers[layers.length - 1];
    if (!top) return;

    if (e.key === "Escape") { top.close(); return; }
    if (e.key !== "Tab") return;

    const focusables = focusablesIn(top.root);
    if (!focusables.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];

    /* Focus outside the top layer is not hypothetical: applying `inert` to the
       drawer blurs whatever was focused inside it, so for one moment focus is
       on <body> with a modal on screen. Left alone, Tab would then walk into
       the page behind the scrim. */
    if (!top.root.contains(document.activeElement)) {
      (e.shiftKey ? last : first).focus();
      e.preventDefault();
      return;
    }
    if (e.shiftKey && document.activeElement === first) {
      last.focus(); e.preventDefault();
    } else if (!e.shiftKey && document.activeElement === last) {
      first.focus(); e.preventDefault();
    }
  });

  /* ---------- The case studies left this file ----------
     They opened in a full-screen modal that lived here: an overlay, a focus
     trap, a scroller, a rail rebuild and a `window.openCase` the assistant
     called into. All of it is gone. The five case studies are pages at
     /work/<id>, the index rows are anchors, and js/answer-render.js links to
     the same URLs instead of reaching for a global.

     What replaced ~90 lines of modal machinery is an `href`. That is the
     whole trade, and it is worth remembering the next time something on this
     page wants to be "in place": a page already does focus, history, scroll
     restoration, printing and sharing, and does them without being written.
     See docs/PROJECT-PAGES.md. */

  /* ---------- The assistant, summoned ----------
     The drawer was section 06 of this page: something you scrolled past,
     reachable only by scrolling, invisible to anyone who read the top and
     left. It is now a control in the fixed bar, which is why focus
     restoration matters MORE here than in the case dialog — losing it puts
     the reader at the top of ~9000px with the one control they wanted eight
     screens behind them.

     THE DRAWER IS PRESENTATION ONLY. This writes `data-open` and no style at
     all, so the CSS keeps sole ownership of the slide, the scrim, the
     visibility delay and the reduced-motion behaviour — which there is
     "arrive in one frame", not "no transition". Anything here that set a
     style would have to re-decide all four, and would get reduce-motion
     wrong the first time the preference changed mid-visit.

     There is exactly one `[data-chat]` per document (js/chat.js binds one
     instance), so the composer moved into this panel rather than being
     duplicated into it. */
  const drawer = $("[data-drawer]");
  const drawerSheet = drawer ? $(".drawer__sheet", drawer) : null;
  const drawerOpeners = $$("[data-drawer-open]");

  const drawerLayer = {
    root: drawer,
    initial: drawerSheet,
    returnTo: null,
    close: () => closeDrawer(),
  };

  function openDrawer(opener) {
    if (!drawer || drawer.hasAttribute("data-open")) return;
    drawerLayer.returnTo = opener || drawerOpeners[0] || null;
    drawer.setAttribute("data-open", "");
    /* Mirrored, never independent: the bar styles `[aria-expanded="true"]`,
       so the lit segment and the announcement are the same fact. */
    drawerOpeners.forEach((b) => b.setAttribute("aria-expanded", "true"));
    pushLayer(drawerLayer);
    drawerSheet.focus({ preventScroll: true });
  }

  function closeDrawer() {
    if (!drawer || !drawer.hasAttribute("data-open")) return;
    drawer.removeAttribute("data-open");
    drawerOpeners.forEach((b) => b.setAttribute("aria-expanded", "false"));
    popLayer(drawerLayer);
    /* Before the CSS flips the sheet to `visibility: hidden` 280ms from now.
       Leaving focus inside it until then would hand it to <body> instead. */
    restoreFocus(drawerLayer.returnTo);
  }

  if (drawer && drawerSheet) {
    drawerOpeners.forEach((btn) =>
      btn.addEventListener("click", () =>
        drawer.hasAttribute("data-open") ? closeDrawer() : openDrawer(btn)
      )
    );
    /* The scrim carries this attribute too, so a click anywhere off the sheet
       closes. Escape is handled by the shared layer keydown above. */
    $$("[data-drawer-close]", drawer).forEach((el) =>
      el.addEventListener("click", () => closeDrawer())
    );
  }

  /* A request in flight is deliberately NOT aborted by closing the panel.
     js/chat.js owns cancellation and gives it one control — the Stop button —
     because Enter must not become destructive; a close is not an activation of
     that control either. The stream keeps arriving into a hidden panel and the
     answer is there on reopen, which is the outcome a reader who closed a
     panel by accident wants. */
})();
