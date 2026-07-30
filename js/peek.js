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
     motion should not be given a box that chases them. Both fall back to the
     CSS, which shows everything in the card. */
  const FINE = window.matchMedia("(hover: hover) and (pointer: fine)");
  const RMQ = window.matchMedia("(prefers-reduced-motion: reduce)");
  if (!FINE.matches) return;

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
