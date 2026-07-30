/* ============================================================
   Menu — the bar's navigation, unfolded to a full-screen sheet.

   Self-contained on purpose. The layer machinery in js/main.js (LIFO
   Escape, inert, a body lock derived from stack depth) is index-only,
   and this menu ships on every page — so it carries its own trap
   rather than importing one. The two cannot fight: the menu's sheet
   covers the bar, the drawer's sheet covers the bar, and each one's
   trigger lives under the other's sheet, so at most one of them can
   ever be open. Mutual exclusion by construction, not by bookkeeping.

   PRESENTATION STAYS IN CSS. This file toggles exactly one attribute —
   `data-open` on `.menu` — plus the trigger's `aria-expanded`. The
   slide, the visibility delay, the reduced-motion behaviour and the
   scroll lock (`body:has(.menu[data-open])`) all read off that
   attribute, which is why they cannot disagree with it.
   ============================================================ */
(() => {
  const menu = document.querySelector("[data-menu]");
  if (!menu) return;
  const sheet = menu.querySelector(".menu__sheet");
  const openers = [...document.querySelectorAll("[data-menu-open]")];
  if (!sheet || !openers.length) return;

  /* Same collection rule as main.js's trap, minus the composer-specific
     entries the drawer needed: this sheet holds links and one button. */
  const FOCUSABLE = 'a[href], button, [tabindex]:not([tabindex="-1"])';
  const focusables = () =>
    [...sheet.querySelectorAll(FOCUSABLE)].filter((el) => !el.disabled);

  let returnTo = null;
  const isOpen = () => menu.hasAttribute("data-open");

  /* `aria-modal` alone is the weak form of a modal: a screen reader that
     does not honour it can swipe through the whole covered page, and the
     open menu was measured leaving every region of the page in the
     accessibility tree. `inert` is the strong form — it removes the
     background from the tree AND the tab order — and it is what main.js
     already applies under the drawer. Everything beside the menu goes
     inert; anything that carried the attribute before we opened keeps it
     on close. */
  const inerted = [];
  function setInert() {
    for (const el of document.body.children) {
      if (el === menu || el.tagName === "SCRIPT" || el.hasAttribute("inert")) continue;
      el.setAttribute("inert", "");
      inerted.push(el);
    }
  }
  function clearInert() {
    while (inerted.length) inerted.pop().removeAttribute("inert");
  }

  /* The same visibility test main.js uses, for the same measured reason:
     `offsetParent` reports a control inside a `visibility: hidden` or
     display-hidden ancestor as present, and a no-op `.focus()` strands
     the reader on <body>. */
  const isVisible = (el) =>
    el instanceof HTMLElement && el.isConnected &&
    (typeof el.checkVisibility === "function"
      ? el.checkVisibility({ visibilityProperty: true, contentVisibilityAuto: true })
      : el.offsetParent !== null);

  function open(opener) {
    if (isOpen()) return;
    returnTo = opener || openers[0];
    menu.setAttribute("data-open", "");
    openers.forEach((b) => b.setAttribute("aria-expanded", "true"));
    setInert();
    sheet.focus({ preventScroll: true });
  }

  function close() {
    if (!isOpen()) return;
    menu.removeAttribute("data-open");
    openers.forEach((b) => b.setAttribute("aria-expanded", "false"));
    clearInert();
    /* Before the CSS flips the sheet to `visibility: hidden` 280ms from
       now — leaving focus inside it until then would hand it to <body>.
       The fallback matters on the growth path below: a trigger hidden by
       the breakpoint no-ops `.focus()`, and the reader is mid-page. */
    if (isVisible(returnTo)) returnTo.focus();
  }

  openers.forEach((btn) =>
    btn.addEventListener("click", () => (isOpen() ? close() : open(btn)))
  );

  menu.addEventListener("click", (e) => {
    if (e.target.closest("[data-menu-close]")) { close(); return; }
    /* A link navigates within the page; a menu left open over its own
       destination is a reader trapped under chrome. */
    if (e.target.closest(".menu__nav a")) close();
  });

  document.addEventListener("keydown", (e) => {
    if (!isOpen()) return;
    if (e.key === "Escape") { close(); return; }
    if (e.key !== "Tab") return;

    const items = focusables();
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];

    /* Focus can sit outside the sheet with the menu open — the sheet
       itself holds it right after open(), and `tabindex="-1"` keeps the
       sheet out of this list. Walk in rather than out. */
    if (!sheet.contains(document.activeElement) || document.activeElement === sheet) {
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

  /* A rotation can carry the viewport past the breakpoint with the menu
     open. Above it the trigger is display:none and the bar's links are
     back — an open sheet would cover a page that no longer offers a way
     to close it. The media query is the same 700px the CSS uses; keeping
     them apart would let one move without the other.

     BOTH listeners, deliberately. `change` on the query is the precise
     signal, and it was measured NOT firing under an emulated viewport
     resize while the CSS media queries re-evaluated correctly — so the
     sheet stayed open over a bar whose trigger had gone. `resize` is the
     coarse signal that cannot be skipped; the guard inside makes the
     pair idempotent. */
  const wide = window.matchMedia("(min-width: 700px)");
  const onWide = () => { if (wide.matches) close(); };
  wide.addEventListener("change", onWide);
  window.addEventListener("resize", onWide);
})();
