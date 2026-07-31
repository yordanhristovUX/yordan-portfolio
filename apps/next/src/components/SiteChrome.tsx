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
   has is a navigation. */
import { useEffect } from "react";

import { initDrawer } from "@/lib/vanilla/drawer";
import { initFab } from "@/lib/vanilla/fab";
import { initMenu } from "@/lib/vanilla/menu";
import { initPeek } from "@/lib/vanilla/peek";

export function SiteChrome() {
  useEffect(() => {
    const teardown = [initMenu(), initFab(), initPeek(), initDrawer()];
    return () => {
      for (const off of teardown) off();
    };
  }, []);

  return null;
}
