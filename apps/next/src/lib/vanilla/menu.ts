"use client";
/* ============================================================
   Menu — the bar's navigation, unfolded to a full-screen sheet.

   COPIED FROM js/menu.js @ 2e84323; fix upstream first. A bug found here is
   reported against js/menu.js, fixed there by its owner, and re-copied — never
   fixed only in this copy.

   Self-contained on purpose. The layer machinery in drawer.ts (LIFO Escape,
   inert, a body lock derived from stack depth) is the index's, and this menu
   ships on every page — so it carries its own trap rather than importing one.
   The two cannot fight: the menu's sheet covers the bar, the drawer's sheet
   covers the bar, and each one's trigger lives under the other's sheet, so at
   most one of them can ever be open. Mutual exclusion by construction, not by
   bookkeeping.

   PRESENTATION STAYS IN CSS. This file toggles exactly one attribute —
   `data-open` on `.menu` — plus the trigger's `aria-expanded`. The slide, the
   visibility delay, the reduced-motion behaviour and the scroll lock
   (`body:has(.menu[data-open])`) all read off that attribute, which is why they
   cannot disagree with it.

   WHAT THE PORT ADDED, and nothing else changed: the IIFE became `initMenu()`
   returning a teardown, because a React effect that mounts a listener owes the
   next unmount its removal. Every listener the original attached is removed by
   the returned function, and an open menu is closed by it — otherwise a
   navigation would leave the page inert behind a sheet that no longer has a
   script.
   ============================================================ */

export function initMenu(): () => void {
  const menu = document.querySelector<HTMLElement>("[data-menu]");
  if (!menu) return () => {};
  const sheet = menu.querySelector<HTMLElement>(".menu__sheet");
  const openers = [...document.querySelectorAll<HTMLElement>("[data-menu-open]")];
  if (!sheet || !openers.length) return () => {};

  /* Same collection rule as the drawer's trap, minus the composer-specific
     entries the drawer needed: this sheet holds links and one button. */
  const FOCUSABLE = 'a[href], button, [tabindex]:not([tabindex="-1"])';
  const focusables = () =>
    [...sheet.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
      (el) => !(el as HTMLButtonElement).disabled
    );

  let returnTo: HTMLElement | null = null;
  const isOpen = () => menu.hasAttribute("data-open");

  /* `aria-modal` alone is the weak form of a modal: a screen reader that does
     not honour it can swipe through the whole covered page, and the open menu
     was measured leaving every region of the page in the accessibility tree.
     `inert` is the strong form — it removes the background from the tree AND
     the tab order. Everything beside the menu goes inert; anything that carried
     the attribute before we opened keeps it on close. */
  const inerted: Element[] = [];
  function setInert() {
    for (const el of document.body.children) {
      if (el === menu || el.tagName === "SCRIPT" || el.hasAttribute("inert")) continue;
      el.setAttribute("inert", "");
      inerted.push(el);
    }
  }
  function clearInert() {
    while (inerted.length) inerted.pop()?.removeAttribute("inert");
  }

  /* The same visibility test the drawer uses, for the same measured reason:
     `offsetParent` reports a control inside a `visibility: hidden` or
     display-hidden ancestor as present, and a no-op `.focus()` strands the
     reader on <body>. */
  const isVisible = (el: HTMLElement | null): el is HTMLElement =>
    el instanceof HTMLElement &&
    el.isConnected &&
    (typeof el.checkVisibility === "function"
      ? el.checkVisibility({ visibilityProperty: true, contentVisibilityAuto: true })
      : el.offsetParent !== null);

  function open(opener: HTMLElement) {
    if (isOpen()) return;
    returnTo = opener || openers[0];
    menu!.setAttribute("data-open", "");
    openers.forEach((b) => b.setAttribute("aria-expanded", "true"));
    setInert();
    sheet!.focus({ preventScroll: true });
  }

  function close() {
    if (!isOpen()) return;
    menu!.removeAttribute("data-open");
    openers.forEach((b) => b.setAttribute("aria-expanded", "false"));
    clearInert();
    /* Before the CSS flips the sheet to `visibility: hidden` 280ms from now —
       leaving focus inside it until then would hand it to <body>. The fallback
       matters on the growth path below: a trigger hidden by the breakpoint
       no-ops `.focus()`, and the reader is mid-page. */
    if (isVisible(returnTo)) returnTo.focus();
  }

  const onOpenerClick = (btn: HTMLElement) => () => (isOpen() ? close() : open(btn));
  const openerHandlers = openers.map((btn) => {
    const handler = onOpenerClick(btn);
    btn.addEventListener("click", handler);
    return { btn, handler };
  });

  const onMenuClick = (e: MouseEvent) => {
    const target = e.target as Element | null;
    if (target?.closest("[data-menu-close]")) {
      close();
      return;
    }
    /* A link navigates within the page; a menu left open over its own
       destination is a reader trapped under chrome. */
    if (target?.closest(".menu__nav a")) close();
  };
  menu.addEventListener("click", onMenuClick);

  const onKeydown = (e: KeyboardEvent) => {
    if (!isOpen()) return;
    if (e.key === "Escape") {
      close();
      return;
    }
    if (e.key !== "Tab") return;

    const items = focusables();
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];

    /* Focus can sit outside the sheet with the menu open — the sheet itself
       holds it right after open(), and `tabindex="-1"` keeps the sheet out of
       this list. Walk in rather than out. */
    if (!sheet!.contains(document.activeElement) || document.activeElement === sheet) {
      (e.shiftKey ? last : first).focus();
      e.preventDefault();
      return;
    }
    if (e.shiftKey && document.activeElement === first) {
      last.focus();
      e.preventDefault();
    } else if (!e.shiftKey && document.activeElement === last) {
      first.focus();
      e.preventDefault();
    }
  };
  document.addEventListener("keydown", onKeydown);

  /* A rotation can carry the viewport past the breakpoint with the menu open.
     Above it the trigger is display:none and the bar's links are back — an open
     sheet would cover a page that no longer offers a way to close it. The media
     query is the same 700px the CSS uses; keeping them apart would let one move
     without the other.

     BOTH listeners, deliberately. `change` on the query is the precise signal,
     and it was measured NOT firing under an emulated viewport resize while the
     CSS media queries re-evaluated correctly — so the sheet stayed open over a
     bar whose trigger had gone. `resize` is the coarse signal that cannot be
     skipped; the guard inside makes the pair idempotent. */
  const wide = window.matchMedia("(min-width: 700px)");
  const onWide = () => {
    if (wide.matches) close();
  };
  wide.addEventListener("change", onWide);
  window.addEventListener("resize", onWide);

  return () => {
    close();
    for (const { btn, handler } of openerHandlers) btn.removeEventListener("click", handler);
    menu.removeEventListener("click", onMenuClick);
    document.removeEventListener("keydown", onKeydown);
    wide.removeEventListener("change", onWide);
    window.removeEventListener("resize", onWide);
  };
}
