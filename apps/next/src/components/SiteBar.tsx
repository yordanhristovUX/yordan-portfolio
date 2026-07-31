/* The floating bar — markup reproduced from index.html / cv.html / mcp.html /
   work/*.html @ 2e84323.

   ONE component for four pages, because the bar is one component: what differs
   between them is the identity segment, the links and which action sits in the
   middle, and every one of those is data. The segment ORDER is not — it is the
   nav component's stated rule that every seam is owned by the segment on its
   right, and that primary action comes before utility. So:

     bar__id · bar__nav · [status] · [action] · bar__menu · theme

   `bar__menu` is at the VERY RIGHT of the docked bar by the owner's decision,
   which is why it sits after the action in the DOM: tab order and visual order
   must agree. The theme puck is a SATELLITE of the bar, not a segment —
   absolutely positioned off its right edge — and it lives in here because the
   bar is centred and shrink-wrapped, so nothing outside it can know where its
   right edge is. */
import type { ReactNode } from "react";

import { ThemeToggle } from "@/components/ThemeToggle";
import type { Link } from "@/lib/vanilla-copy";
import { MENU } from "@/lib/vanilla-copy";

export function SiteBar({
  id,
  nav,
  status,
  action,
}: {
  id: Link;
  nav: Link[];
  status?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <header className="bar">
      <a className="bar__id" href={id.href}>
        {id.label}
      </a>
      <nav className="bar__nav" aria-label="Primary">
        {nav.map((l) => (
          <a key={l.href + l.label} href={l.href}>
            {l.label}
          </a>
        ))}
      </nav>
      {status}
      {action}
      {/* The nav's mobile form: below 700px the links fold into this segment
          and the full-screen menu it summons. A word, not a hamburger — the
          owner's decision. MOUNT POINT: the toggle behaviour is the port of
          js/menu.js and lands with the chrome run; the markup, the ids and the
          aria wiring are already what that port expects to find. */}
      <button className="bar__menu" type="button" data-menu-open="" aria-controls="site-menu" aria-expanded="false">
        {MENU.open}
      </button>
      <ThemeToggle />
    </header>
  );
}
