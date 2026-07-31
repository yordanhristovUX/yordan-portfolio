"use client";
/* ============================================================
   Ask FAB — the chat pill at the bottom corner, mobile only.

   COPIED FROM js/fab.js @ 2e84323; fix upstream first.

   One job: the pill folds to a circle with the assistant's face when the reader
   scrolls DOWN, and any scroll UP brings the full pill back, wherever they are
   — the owner's rule. Near the top (within two lattice cells, 48px) it is
   always the full pill. This file toggles exactly one attribute —
   `data-collapsed` on the FAB — and CSS owns the fold, the timing and the
   reduced-motion behaviour, the same contract every other control here holds.

   An earlier version ignored direction and keyed on "am I past the top" alone;
   the owner corrected it — reading down, the label is noise, but the moment you
   scroll back up you are looking for something, and the full pill should be one
   of the things you find. `scrollY` is clamped at 0 so iOS rubber-band at the
   top cannot register as movement. No rAF throttle on purpose — the handler is
   a few reads, and the attribute is written only on a state change. A mid-page
   load (scroll restoration) starts expanded: direction is unknowable until the
   first real scroll, and the label is the friendlier default.

   THE PORT ADDED a teardown and nothing else.
   ============================================================ */

export function initFab(): () => void {
  const fab = document.querySelector<HTMLElement>("[data-ask-fab]");
  if (!fab) return () => {};

  const THRESHOLD = 48;
  let lastY = Math.max(0, window.scrollY);
  let collapsed: boolean | null = null;

  const apply = (c: boolean) => {
    if (c === collapsed) return;
    collapsed = c;
    if (c) fab.setAttribute("data-collapsed", "");
    else fab.removeAttribute("data-collapsed");
  };

  const update = () => {
    const y = Math.max(0, window.scrollY);
    if (y <= THRESHOLD) apply(false); // the top is always the pill
    else if (y > lastY) apply(true); // reading down — fold away
    else if (y < lastY) apply(false); // looking back up — full pill
    lastY = y;
  };

  window.addEventListener("scroll", update, { passive: true });
  update();

  return () => {
    window.removeEventListener("scroll", update);
    fab.removeAttribute("data-collapsed");
  };
}
