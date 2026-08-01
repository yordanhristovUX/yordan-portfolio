"use client";
/* ARRIVAL. The two halves of "you are on a new page now", for the router that
   deleted the browser's own way of saying it.

   THE REPORT: clicking a case study from halfway down the index "feels as I am
   on the same page, but I am not". Measured on the built site, from 1534px down
   the index at 1280×800, and it turned out to be two separate things:

     1. THE SCROLL TO THE TOP IS A SMOOTH SCROLL, and it took 746ms. css/
        style.css opens with `html { scroll-behavior: smooth }` — vanilla's, and
        right there, where the only thing it can catch is an in-page anchor,
        because that site cannot navigate without a document load. Here it also
        catches the ROUTER's scroll to the top, so clicking a case study spent
        three quarters of a second flying up through the new page's content.
        That is not a slow arrival; it is the exact sensation of scrolling
        around inside one long document, which is what the owner reported.
     2. THE SWAP ITSELF IS INSTANT AND SILENT. `{children}` is replaced in
        place: the bar does not move, the paper does not blink, and nothing
        marks the moment the document became a different document.

   So: jump instead of scroll, and let the new sheet settle in. The first is the
   larger half of the fix and is pure correction — restoring what a document
   load did — while the second is the cue. Neither is a loading indicator, and
   the absence is deliberate: on a static export with the payload already in
   hand, nothing is loading, and a progress bar over an instant swap would be an
   animation about work that is not happening.

   ── HALF ONE: THE JUMP ────────────────────────────────────────────────────
   `behavior: "instant"` rather than removing the smooth scroll, because smooth
   is CORRECT for the thing it was written for. "See the work ↓", the bar's
   Experience/Skills anchors and the menu's links all glide, on both surfaces,
   and they should keep gliding. Only the router's own reset is overridden, and
   only where the vanilla site would not have scrolled at all.

   AND ONLY WHEN THE DESTINATION HAS NO FRAGMENT. `/#work` and `/#contact` are
   this app's routes — src/lib/routes.ts says so, and the work pages' bar links
   to both — so a navigation can legitimately be asking for a POSITION on the
   next page rather than its top. Forcing 0 there would break the one link on
   every case study that says "All work". The hash is read from `location`
   rather than from the router because `usePathname()` does not carry it.

   ── HALF TWO: THE SETTLE ──────────────────────────────────────────────────
   One attribute, set once, never removed, which is the whole of this half. The
   obvious version — add a class per navigation, take it off when the animation
   ends — is more code doing a worse job: it needs a timer or an `animationend`
   listener to clear it, and that is the CSS's duration copied into a second
   place to disagree with later. It also would not be describing anything real.
   The animation does not need to be TOLD to run: `{children}` is replaced on
   every client transition, so the incoming `main.sheet` is a brand-new element,
   and an animation applies to a new element by being in the stylesheet. The one
   thing JS knows that CSS cannot ask is whether this visit has navigated at
   all. One bit. So that is all it says, and every navigation after the first is
   pure CSS. (Verified rather than assumed: React does replace the node — the
   second navigation of a visit still attaches `route-settle`, with the
   attribute already long set.)

   WHY A COLD LOAD MUST NOT ANIMATE. The browser already narrated it: blank,
   paint, settle. The cue exists to replace the signal that CLIENT navigation
   removed, so firing it on a load that never lost one would be motion for its
   own sake — and this port deliberately does not carry the vanilla site's GSAP
   reveal pass, so a load-in fade would be the one piece of load choreography
   the second surface invented for itself.

   WHY A LAYOUT EFFECT, and the one thing that breaks without it. React runs
   `useEffect` after paint, and both halves are visible if they land late: the
   new page would paint once at the old scroll position and at full opacity,
   and only then jump and restart the settle from `opacity: 0`. A layout effect
   runs after the DOM is in place and before the browser paints it, so the new
   `main` is at the top and already settling in the first frame it exists. The
   scroll half needs this on EVERY navigation; the settle half only on the
   first of a visit, which is exactly the sort of flash that survives a casual
   look.

   Renders nothing, in the root layout beside the other two behaviours. */
import { useEffect, useLayoutEffect, useRef } from "react";

import { usePathname } from "next/navigation";

/* `useLayoutEffect` warns when React renders it on the server, and a static
   export renders every client component there once. The effect has nothing to
   do during that render — no document to mark, no navigation to have happened
   — so the server takes the form that stays quiet. */
const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

export function RouteSettle() {
  const pathname = usePathname();
  const navigated = useRef(false);

  useIsomorphicLayoutEffect(() => {
    /* The first run is the initial mount — the pathname the visit STARTED on,
       which is a document load rather than a transition. Only a later value is
       a navigation. (The same guard, for the same reason, as the one in
       src/components/AutomataLayer.tsx.) */
    if (!navigated.current) {
      navigated.current = true;
      return;
    }
    document.documentElement.setAttribute("data-routed", "");
    if (!window.location.hash) window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [pathname]);

  return null;
}
