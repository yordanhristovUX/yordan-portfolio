"use client";
/* The switch for src/app/route-settle.css, and nothing else.

   It sets ONE attribute, ONCE, and never removes it. That is the whole
   component, and the shape is worth a note because the obvious version — add a
   class on navigation, take it off when the animation ends — is more code doing
   a worse job:

     · Per-navigation state needs a timer or an `animationend` listener to clear
       it, and both are a promise about duration made in a second place. The CSS
       already owns the duration; a JS timer that agrees with it today is a
       second copy of the same number waiting to disagree.
     · It would have to survive a navigation that interrupts another one.
     · And it would be wrong about what it is describing. The animation does not
       need to be TOLD to run: `{children}` is replaced on every client
       transition, so the incoming `main.sheet` is a brand-new element, and an
       animation applies to a new element by being in the stylesheet. The only
       thing JS knows that CSS cannot ask is whether this visit has navigated at
       all — one bit, set once. So that is the only thing it says.

   WHY THE FIRST LOAD MUST NOT ANIMATE. A cold load already has an arrival
   signal: the browser blanks, paints and settles, and the reader watched it
   happen. The cue exists to replace the signal that CLIENT navigation removed,
   so firing it on a load the browser already narrated would be motion added for
   its own sake — and this port deliberately does not carry the vanilla site's
   GSAP reveal pass, so a load-in fade would be the one piece of load
   choreography the second surface invented for itself.

   WHY THE EFFECT IS A LAYOUT EFFECT, and the one thing that breaks without it.
   React runs `useEffect` after paint. On the first navigation of a visit that
   ordering is visible: the new page paints at full opacity, the attribute lands,
   and the animation's `both` fill then snaps it back to `opacity: 0` to start —
   a flash of the finished page before the settle. A layout effect runs after the
   DOM is in place and before the browser paints it, so the attribute is already
   there in the frame the new `main` first appears in, and the settle starts from
   its beginning. Every LATER navigation is pure CSS and does not depend on this
   at all — which is exactly why the flash is a first-navigation-only bug and
   exactly the kind that survives a casual look.

   Rendering null, in the root layout, beside the other two behaviours: the
   markup this observes is the pages' own. */
import { useEffect, useLayoutEffect, useRef } from "react";

import { usePathname } from "next/navigation";

/* `useLayoutEffect` warns when React renders it on the server, and a static
   export renders every client component there once. The effect has nothing to
   do during that render — there is no document to mark and no navigation to
   have happened — so the server takes the form that stays quiet. */
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
  }, [pathname]);

  return null;
}
