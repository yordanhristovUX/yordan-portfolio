/* One anchor, two behaviours, decided by the href.

   The vanilla site has one kind of link because it has one kind of navigation:
   every href is a document load. This app has a router, and NOT using it would
   make the second consumer a slower copy of the first — the whole point of
   building it on a framework is to exercise what the framework does.

   So a reference to one of THIS APP'S routes renders `next/link` and navigates
   on the client; everything else — an absolute URL, a mailto:, a tel:, and a
   bare `#anchor`, which is a position on the page already open rather than a
   navigation — renders the plain <a> it always was. `isRoute()` in
   src/lib/routes.ts is the single place that decides which.

   MARKUP PARITY IS UNAFFECTED, and that is why this is a swap rather than a
   redesign: `<Link className="idx__row">` renders `<a class="idx__row">`. Every
   class, every attribute and every DS selector is the same string it was.

   WHAT THE ROUTER CHANGES UNDER THE PORTS, because it is not nothing. A client
   navigation replaces `{children}` while the root layout — and everything
   mounted in it — survives. The bar, the menu, the drawer and the cards are all
   inside `{children}`, so their elements are new after a transition and the
   listeners the ports bound are pointing at detached nodes. src/components/
   SiteChrome.tsx therefore re-initialises on a pathname change, and
   src/components/AutomataLayer.tsx re-scans on the same signal. Those two are
   what make this component safe; adding a <Link> without them would ship a page
   whose menu opens once.

   PREFETCH IS OFF, AND IT IS OFF BECAUSE IT IS BROKEN IN THIS EXPORT rather
   than because it is unwanted. Next 16.2.12's segment-cache prefetch and its
   `output: export` writer disagree about one separator: the client asks for

       /mcp/__next.mcp.__PAGE__.txt            404
       /work/<id>/__next.work.$d$id.txt        404

   and the export wrote those payloads one directory down —
   `/mcp/__next.mcp/__PAGE__.txt` and `/work/<id>/__next.work/$d$id.txt`, both
   of which serve 200. Measured against `npx serve out`, eleven 404s on a single
   pass over four pages. Navigation is unaffected (the click path falls back and
   the transition still happens on the client, marker-verified), so the whole
   effect of leaving it on is console noise and wasted requests. It is upstream
   Next's to fix; `experimental.clientSegmentCache: false` is not a way out
   either — Next 16 rejects the key as invalid.

   The `/evals` case that this file used to special-case has expired rather
   than been folded in: that route is a built page now, so when Next fixes the
   separator and the line above can go, it prefetches like any other. */
import Link from "next/link";
import type { AnchorHTMLAttributes } from "react";

import { isRoute } from "@/lib/routes";

type Props = AnchorHTMLAttributes<HTMLAnchorElement> & { href: string };

export function AppLink({ href, children, ...rest }: Props) {
  if (!isRoute(href)) {
    return (
      <a href={href} {...rest}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} prefetch={false} {...rest}>
      {children}
    </Link>
  );
}
