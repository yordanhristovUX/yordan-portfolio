/* ============================================================
   Peek — the panel that rides the pointer.

   A notable card is deliberately almost empty: an eyebrow and a title. The
   image and the description it also carries are not shown IN the card; they
   are shown in one floating panel that follows the cursor, so the grid stays
   a quiet list of names and the detail arrives where the reader is already
   looking.

   WHY ONE PANEL AND NOT NINE. Nine absolutely-positioned previews would be
   nine boxes to keep off the viewport edges and nine more elements under the
   pointer to confuse `pointerleave`. There is exactly one, it is reused, and
   it is `pointer-events: none` — so it can never sit between the cursor and
   the card it is describing, which is the bug this pattern usually ships with.

   WHAT IT IS NOT. It is not a dialog, it takes no focus, and it traps nothing.
   It carries `aria-hidden`, because everything in it is already in the card
   itself, in reading order, for anything that reads rather than points. A
   screen reader gets the description without this file existing.

   PROGRESSIVE ENHANCEMENT. The markup ships complete: the image and the note
   are in the card. This file moves them into a panel for readers who have a
   pointer. Without JS — or on a touch device — the CSS shows them in the card
   instead, so nothing is behind a gesture the device cannot perform. That
   fallback is `@media (hover: none)` in components.css and it is the reason
   this file may fail without costing anyone the content.
   ============================================================ */
(() => {
  const cards = document.querySelectorAll(".card--reveal");
  if (!cards.length) return;

  /* A coarse pointer has no hover to track and a reader who asked for less
     motion should not be given a box that chases them. */
  const FINE = window.matchMedia("(hover: hover) and (pointer: fine)");
  const RMQ = window.matchMedia("(prefers-reduced-motion: reduce)");

  /* ---------- Tap mode: the peek SHEET ----------
     The mobile translation of the cursor panel: the grid stays a quiet list
     of collapsed cards, and the detail arrives on ONE reusable bottom sheet.
     THIS FILE CREATES NOTHING. The sheet is authored in index.html beside
     the drawer, the trigger is authored in each card by the content build,
     and CSS decides where the trigger shows — so the page's geometry after
     scripts is the geometry before them. The first version injected both
     and collapsed the cards from here, which changed heights AFTER
     js/automata.js had measured the lattice and slid every band below the
     cards off the grid. Structure in markup is the fix, not a preference.

     The sheet is a real dialog where the cursor panel is deliberately not
     one: it takes focus, traps Tab, closes on Escape, scrim tap or its
     Close segment, and sets the background inert — the same modal contract
     the menu holds. Close-on-scroll was considered and rejected: dismissing
     a surface with the gesture used to read it is a trap, and the page
     behind is scroll-locked anyway. A tap anywhere on a card delegates to
     its trigger. */
  if (!FINE.matches) {
    const sheet = document.querySelector("[data-peek-sheet]");
    const triggers = [...document.querySelectorAll("[data-card-more]")];
    if (!sheet || !triggers.length) return;
    const panel = sheet.querySelector(".peek-sheet__panel");
    const sTitle = sheet.querySelector(".peek-sheet__title");
    const sImg = sheet.querySelector(".peek-sheet__frame img");
    const sNote = sheet.querySelector(".peek-sheet__note");
    let returnTo = null;
    const inerted = [];
    const isOpen = () => sheet.hasAttribute("data-open");

    function openSheet(card, trigger) {
      const title = card.querySelector(".card__title")?.textContent.trim() ?? "";
      const note = card.querySelector(".card__note")?.textContent.trim() ?? "";
      const src = card.querySelector(".card__media img")?.getAttribute("src");
      sTitle.textContent = title;
      panel.setAttribute("aria-label", title);
      if (src) { sImg.src = src; sImg.hidden = false; }
      else { sImg.removeAttribute("src"); sImg.hidden = true; }
      sNote.textContent = note;
      returnTo = trigger;
      sheet.setAttribute("data-open", "");
      for (const el of document.body.children) {
        if (el === sheet || el.tagName === "SCRIPT" || el.hasAttribute("inert")) continue;
        el.setAttribute("inert", "");
        inerted.push(el);
      }
      panel.focus({ preventScroll: true });
    }

    function closeSheet() {
      if (!isOpen()) return;
      sheet.removeAttribute("data-open");
      while (inerted.length) inerted.pop().removeAttribute("inert");
      if (returnTo && returnTo.isConnected) returnTo.focus();
    }

    sheet.addEventListener("click", (e) => {
      if (e.target.closest("[data-sheet-close]")) closeSheet();
    });
    document.addEventListener("keydown", (e) => {
      if (!isOpen()) return;
      if (e.key === "Escape") { closeSheet(); return; }
      if (e.key !== "Tab") return;
      const items = [...panel.querySelectorAll('a[href], button')];
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (!panel.contains(document.activeElement) || document.activeElement === panel) {
        (e.shiftKey ? last : first).focus(); e.preventDefault(); return;
      }
      if (e.shiftKey && document.activeElement === first) { last.focus(); e.preventDefault(); }
      else if (!e.shiftKey && document.activeElement === last) { first.focus(); e.preventDefault(); }
    });

    for (const btn of triggers) {
      const card = btn.closest(".card--reveal");
      if (!card) continue;
      btn.addEventListener("click", () => openSheet(card, btn));
      card.addEventListener("click", (e) => {
        if (e.target.closest("[data-card-more]")) return;
        btn.click();
      });
    }
    return;
  }

  const panel = document.createElement("div");
  panel.className = "peek";
  panel.setAttribute("aria-hidden", "true");
  panel.hidden = true;
  panel.innerHTML = '<span class="peek__frame"><img alt="" decoding="async"></span><p class="peek__text"></p>';
  const img = panel.querySelector("img");
  const text = panel.querySelector(".peek__text");
  document.body.appendChild(panel);

  const OFFSET = 20;          // clear of the cursor, so the panel never sits under it
  let raf = 0;
  let x = 0, y = 0;
  let active = null;

  /* Positioned in a rAF rather than on every pointermove: a move fires far more
     often than the display refreshes, and writing `transform` each time is work
     the compositor throws away. `left/top` are never touched — a transform does
     not invalidate layout, and this panel is over the whole page. */
  function place() {
    raf = 0;
    const w = panel.offsetWidth;
    const h = panel.offsetHeight;
    /* Flip rather than clamp. A panel pinned to the viewport edge stops
       tracking the pointer and reads as stuck; one that flips to the other side
       of the cursor keeps the relationship the reader is using to understand
       what it belongs to. */
    const left = x + OFFSET + w > window.innerWidth ? x - OFFSET - w : x + OFFSET;
    const top = y + OFFSET + h > window.innerHeight ? y - OFFSET - h : y + OFFSET;
    panel.style.transform = `translate3d(${Math.max(8, left)}px, ${Math.max(8, top)}px, 0)`;
  }

  function onMove(e) {
    x = e.clientX;
    y = e.clientY;
    if (!raf) raf = requestAnimationFrame(place);
  }

  function show(card) {
    const src = card.querySelector(".card__media img")?.getAttribute("src");
    const note = card.querySelector(".card__note")?.textContent.trim() ?? "";
    const title = card.querySelector(".card__title")?.textContent.trim() ?? "";
    if (src) {
      img.src = src;
      img.hidden = false;
    } else {
      img.removeAttribute("src");
      img.hidden = true;
    }
    text.textContent = note || title;
    active = card;
    panel.hidden = false;
    /* Placed before it is revealed, or the first frame paints at the previous
       card's position and the panel appears to jump across the screen. */
    place();
    /* A style flush, not a rAF. The transition needs a resolved `opacity: 0`
       to start from, and un-hiding plus setting the attribute in one task
       gives it none — the panel would snap rather than fade. Reading a layout
       property forces that resolution synchronously.

       rAF was the obvious way to get the same frame boundary and it is the
       wrong one: it does not fire in a tab that is not compositing, which
       leaves the panel populated, un-hidden and permanently transparent. That
       is unreachable for a real reader — you cannot hover an unrendered tab —
       but a reveal that depends on a frame being painted in order to become
       visible is a circular dependency, and this costs nothing to remove. */
    void panel.offsetWidth;
    panel.setAttribute("data-open", "");
  }

  function hide() {
    active = null;
    panel.removeAttribute("data-open");
    if (RMQ.matches) panel.hidden = true;
  }

  /* `transitionend` rather than a timeout, so the panel is only removed from
     the box tree once it has actually finished fading — and only if nothing
     re-opened it in the meantime. */
  panel.addEventListener("transitionend", (e) => {
    if (e.propertyName === "opacity" && !panel.hasAttribute("data-open")) panel.hidden = true;
  });

  for (const card of cards) {
    card.addEventListener("pointerenter", (e) => {
      if (e.pointerType !== "mouse") return;
      x = e.clientX;
      y = e.clientY;
      show(card);
    });
    card.addEventListener("pointermove", onMove);
    card.addEventListener("pointerleave", hide);
  }

  /* Scrolling with the pointer parked over a card moves the card out from
     under it without firing pointerleave, which would strand the panel. */
  window.addEventListener("scroll", () => { if (active) hide(); }, { passive: true });

  /* A pointer that stops being fine mid-visit — a laptop docked to a touch
     screen — should not leave a panel behind. */
  FINE.addEventListener("change", () => { if (!FINE.matches) hide(); });
})();
