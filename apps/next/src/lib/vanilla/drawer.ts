"use client";
/* ============================================================
   The Ask drawer, and the layer stack under it.

   COPIED FROM js/main.js @ 2e84323 — the "Overlay layers" and "The assistant,
   summoned" blocks; fix upstream first. Everything else in that file is motion
   (GSAP, out of scope here), the clock and the year, which are components in
   this app.

   ONE thing on this page covers the reader: the Ask drawer. There used to be
   two — the case-study modal stacked on top of it — and THIS MACHINERY IS KEPT
   AS IT IS, deliberately rather than lazily: it is written for N layers, it is
   correct at N = 1, and the properties below — LIFO Escape, `inert` beneath the
   top, a body lock derived from depth — are the ones a future second layer
   would otherwise have to reinvent. Collapsing it to one layer would save
   nothing and would delete the reasoning.

   THE DRAWER IS PRESENTATION ONLY. This writes `data-open` and no style at all,
   so the CSS keeps sole ownership of the slide, the scrim, the visibility delay
   and the reduced-motion behaviour — which there is "arrive in one frame", not
   "no transition". Anything here that set a style would have to re-decide all
   four, and would get reduce-motion wrong the first time the preference changed
   mid-visit.

   THE BODY LOCK IS DERIVED FROM THE STACK'S DEPTH, and that is not tidiness.
   Computing the class from `layers.length` makes "Escape never leaves a locked
   body with no way out" true by construction rather than by inspection.

   WHAT THE PORT ADDED: `initDrawer()` and a teardown. The drawer's BODY is
   still empty in this app — the chat client is the next phase — so the trap
   below currently collects the Close button and the scrim. That is the correct
   behaviour for the markup that exists, and the collection rule is unchanged,
   which is what matters when the composer arrives.
   ============================================================ */

interface Layer {
  root: HTMLElement;
  initial: HTMLElement;
  returnTo: HTMLElement | null;
  close: () => void;
}

/* `textarea`, `input` and `details > summary` are in this list because the
   drawer puts a composer and two disclosures (the tool trace, the citation
   list) inside a trap. A trap that cannot name the last focusable in its own
   subtree lets Tab walk out of it at that element, and which element is last
   here is decided by a model-composed answer rather than by this file.

   Nothing is filtered on `aria-disabled`, deliberately: the composer carries
   `aria-disabled` + `readOnly` while a request is in flight precisely so it
   KEEPS focus. Only the real `disabled` property is filtered — such an element
   cannot be focused at all. */
const FOCUSABLE = [
  "a[href]",
  "button",
  "input",
  "select",
  "textarea",
  "details > summary",
  '[tabindex]:not([tabindex="-1"])',
].join(", ");

/* `offsetParent !== null` was the old visibility test and it is not one.
   Measured on the live page: a `.source__link` inside a COLLAPSED `<details>`
   reports `offsetParent !== null` and a 357x20 rect while being unreachable by
   Tab, and every control inside the closed drawer reports the same — the drawer
   closes with `visibility: hidden`, which offsetParent does not see. Collecting
   an unreachable element is not cosmetic in a trap: if it lands first or last,
   the wrap focuses something the reader cannot see and the cycle silently
   breaks. */
const isVisible = (el: unknown): el is HTMLElement =>
  el instanceof HTMLElement &&
  el.isConnected &&
  (typeof el.checkVisibility === "function"
    ? el.checkVisibility({ visibilityProperty: true, contentVisibilityAuto: true })
    : el.offsetParent !== null);

export function initDrawer(): () => void {
  const drawer = document.querySelector<HTMLElement>("[data-drawer]");
  const drawerSheet = drawer ? drawer.querySelector<HTMLElement>(".drawer__sheet") : null;
  const drawerOpeners = [...document.querySelectorAll<HTMLElement>("[data-drawer-open]")];
  if (!drawer || !drawerSheet) return () => {};

  const focusablesIn = (root: HTMLElement) =>
    [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
      (el) => !(el as HTMLButtonElement).disabled && isVisible(el)
    );

  /** Open overlays, innermost last. */
  const layers: Layer[] = [];

  function syncLayers() {
    document.body.classList.toggle("is-locked", layers.length > 0);
    layers.forEach((layer, i) => {
      if (i < layers.length - 1) layer.root.setAttribute("inert", "");
      else layer.root.removeAttribute("inert");
    });
  }

  function pushLayer(layer: Layer) {
    layers.push(layer);
    syncLayers();
  }

  function popLayer(layer: Layer) {
    const i = layers.indexOf(layer);
    if (i === -1) return false;
    layers.splice(i, 1);
    syncLayers();
    return true;
  }

  /* Focus restoration, checked at the moment of use rather than assumed.
     `returnTo.focus()` silently does NOTHING when the target has stopped being
     focusable — measured: an element inside a `visibility: hidden` drawer
     no-ops the call and leaves activeElement where it was. That is the danger,
     not the call itself. So the target is verified and the fallback is
     whichever layer is still open, which is somewhere the reader can always Tab
     out of. */
  function restoreFocus(returnTo: HTMLElement | null) {
    if (isVisible(returnTo)) {
      returnTo.focus();
      return;
    }
    const top = layers[layers.length - 1];
    if (top && isVisible(top.initial)) top.initial.focus({ preventScroll: true });
  }

  const drawerLayer: Layer = {
    root: drawer,
    initial: drawerSheet,
    returnTo: null,
    close: () => closeDrawer(),
  };

  function openDrawer(opener: HTMLElement | null) {
    if (drawer!.hasAttribute("data-open")) return;
    drawerLayer.returnTo = opener || drawerOpeners[0] || null;
    drawer!.setAttribute("data-open", "");
    /* Mirrored, never independent: the bar styles `[aria-expanded="true"]`, so
       the lit segment and the announcement are the same fact. */
    drawerOpeners.forEach((b) => b.setAttribute("aria-expanded", "true"));
    pushLayer(drawerLayer);
    drawerSheet!.focus({ preventScroll: true });
  }

  function closeDrawer() {
    if (!drawer!.hasAttribute("data-open")) return;
    drawer!.removeAttribute("data-open");
    drawerOpeners.forEach((b) => b.setAttribute("aria-expanded", "false"));
    popLayer(drawerLayer);
    /* Before the CSS flips the sheet to `visibility: hidden` 280ms from now.
       Leaving focus inside it until then would hand it to <body> instead. */
    restoreFocus(drawerLayer.returnTo);
  }

  const onKeydown = (e: KeyboardEvent) => {
    const top = layers[layers.length - 1];
    if (!top) return;

    if (e.key === "Escape") {
      top.close();
      return;
    }
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
      last.focus();
      e.preventDefault();
    } else if (!e.shiftKey && document.activeElement === last) {
      first.focus();
      e.preventDefault();
    }
  };
  document.addEventListener("keydown", onKeydown);

  const openerHandlers = drawerOpeners.map((btn) => {
    const handler = () => (drawer.hasAttribute("data-open") ? closeDrawer() : openDrawer(btn));
    btn.addEventListener("click", handler);
    return { btn, handler };
  });

  /* The scrim carries this attribute too, so a click anywhere off the sheet
     closes. Escape is handled by the shared layer keydown above. */
  const closerHandlers = [...drawer.querySelectorAll<HTMLElement>("[data-drawer-close]")].map((el) => {
    const handler = () => closeDrawer();
    el.addEventListener("click", handler);
    return { el, handler };
  });

  return () => {
    closeDrawer();
    document.removeEventListener("keydown", onKeydown);
    for (const { btn, handler } of openerHandlers) btn.removeEventListener("click", handler);
    for (const { el, handler } of closerHandlers) el.removeEventListener("click", handler);
    document.body.classList.remove("is-locked");
  };
}
