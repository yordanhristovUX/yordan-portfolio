"use client";
/* The living skeleton, mounted.

   `initAutomata()` is the port of js/automata.js and does all the work; this
   component owns only its lifetime. Two things it has to get right, and both
   are about this surface rather than about the engine:

   · RESCAN ON NAVIGATION. The vanilla site cannot navigate without a page load,
     so the engine only ever had to be right once. Here a client-side transition
     would replace every `.band` under a running simulation, leaving Regions
     pointing at elements that have left the document and new bands with no
     rails at all. `usePathname()` changes on exactly that event. Today every
     link in this app is a plain <a> — a real navigation, which remounts this
     component and makes the rescan a no-op — and that is the point: the wiring
     is here so that the first <Link> to land does not silently break the
     lattice.

   · DESTROY ON UNMOUNT. The engine holds a rAF loop, an IntersectionObserver, a
     ResizeObserver, three window listeners and the rails it injected. Leaving
     any of them behind would be a second simulation on the next mount.

   It renders nothing. The rails are the engine's to inject and the strips are
   the page's own markup, so there is no DOM here for React to own — which is
   also what keeps React and the engine from arguing over the same nodes. */
import { useEffect, useRef } from "react";

import { usePathname } from "next/navigation";

import type { AutomataHandle } from "@/lib/vanilla/automata";
import { initAutomata } from "@/lib/vanilla/automata";

export function AutomataLayer() {
  const handle = useRef<AutomataHandle | null>(null);
  const pathname = usePathname();
  const mounted = useRef(false);

  useEffect(() => {
    handle.current = initAutomata();
    return () => {
      handle.current?.destroy();
      handle.current = null;
    };
  }, []);

  useEffect(() => {
    /* The first pass is the init above, which has just scanned everything. Only
       a LATER pathname is a document that changed under the engine. */
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    handle.current?.rescan();
  }, [pathname]);

  return null;
}
