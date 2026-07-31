"use client";
/* The page's four behaviours, mounted once.

   The vanilla site loads js/menu.js, js/fab.js, js/peek.js and the drawer half
   of js/main.js as four `defer` scripts, and every one of them opens with a
   `querySelector` guard that returns when its markup is not on the page — which
   is why cv.html can load the menu and not the fab without either knowing about
   the other. The ports keep that contract exactly, so one component in the root
   layout is the same arrangement rather than a new one: on /cv there is no
   `[data-ask-fab]` and no `.card--reveal`, so two of these four return
   immediately, as their originals do.

   THE ORDER IS THE VANILLA'S. Peek runs before the automata because it is the
   one behaviour that puts an element in the document, and the automata measures
   the document. (It appends a `position: fixed` panel, so it cannot move the
   lattice — but the ordering is what makes that a property of the CSS rather
   than of luck, and the reason the peek sheet is authored markup in the first
   place is that an earlier version injected structure and slid every band below
   the cards off the grid.)

   Each init returns its own teardown. That is the port's addition: the
   originals never removed a listener because the only teardown a page script
   has is a navigation.

   AND THAT TEARDOWN IS WHY THIS RE-RUNS ON EVERY PATHNAME CHANGE. A client
   navigation keeps the root layout — this component with it — and replaces
   `{children}`, which is where the bar, the menu, the drawer, the fab and the
   cards all live. Their elements are NEW after a transition, so listeners bound
   to the old ones are pointing at detached nodes: without this dependency the
   menu would open on the first page of a visit and on no other. Re-init is the
   whole fix, and it is cheap — four querySelector guards and a handful of
   listeners — because every port already knows how to take itself off the page
   it was bound to. */
import { useEffect } from "react";

import { usePathname } from "next/navigation";

import { initDrawer } from "@/lib/vanilla/drawer";
import { initFab } from "@/lib/vanilla/fab";
import { initMenu } from "@/lib/vanilla/menu";
import { initPeek } from "@/lib/vanilla/peek";

export function SiteChrome() {
  const pathname = usePathname();

  useEffect(() => {
    const teardown = [initMenu(), initFab(), initPeek(), initDrawer()];
    return () => {
      for (const off of teardown) off();
    };
  }, [pathname]);

  return null;
}
