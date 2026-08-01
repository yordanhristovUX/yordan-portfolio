/* The floating bar — markup reproduced from index.html / cv.html / mcp.html /
   work/*.html @ 2e84323, rendered through @yordan/design-system/react/nav.

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
   right edge is.

   WHY `.bar` AND `.bar__dot` SURVIVE THE SWAP AND THE OTHER EIGHT PARTS DO
   NOT. The rule for the whole cutover is in README.md: a design-system class
   stays on a swapped element exactly when something OTHER than the React tier
   addresses it by that name. Here that is two things and only two —

     .bar       three page stylesheets hide it in `@media print` (cv.css,
                mcp.css, evals.css), and a page stylesheet is not this app's
                to edit;
     .bar__dot  the reduced-motion block of components.css — `@component none`,
                one of the six blocks that will never have a React form —
                cancels its `blink`.

   `.bar__id`, `.bar__nav`, `.bar__menu`, `.bar__status`, `.bar__clock`,
   `.bar__action`, `.bar__face` and `.bar__action-label` are named by nothing
   outside nav's own definition, so they leave with the swap and their
   appearance arrives as utilities instead.

   `NavId` IS NOT USED AS A COMPONENT, for the reason `Btn` documents at
   length: it renders its own `<a>`, and this app's own routes have to go
   through next/link. The cva function is exported beside the component
   precisely so a consumer that must own the element can still wear the class
   map — so `navId()` goes onto `AppLink`. */
import type { ReactNode } from "react";

import { Nav, NavMenu, NavNav, navId } from "@yordan/design-system/react/nav";

import { AppLink } from "@/components/AppLink";
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
    <Nav className="bar">
      <AppLink className={navId()} href={id.href}>
        {id.label}
      </AppLink>
      <NavNav aria-label="Primary">
        {nav.map((l) => (
          <AppLink key={l.href + l.label} href={l.href}>
            {l.label}
          </AppLink>
        ))}
      </NavNav>
      {status}
      {action}
      {/* The nav's mobile form: below 700px the links fold into this segment
          and the full-screen menu it summons. A word, not a hamburger — the
          owner's decision. The port of js/menu.js finds this by
          `[data-menu-open]` and knows nothing about how it is styled, which is
          why the swap costs the binding nothing. */}
      <NavMenu type="button" data-menu-open="" aria-controls="site-menu" aria-expanded="false">
        {MENU.open}
      </NavMenu>
      <ThemeToggle />
    </Nav>
  );
}
