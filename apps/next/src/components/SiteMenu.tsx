/* The full-screen menu the bar's mobile segment summons — markup reproduced
   from index.html @ 2e84323, rendered through @yordan/design-system/react/menu.

   It covers the bar (the drawer's precedent), which makes menu and drawer
   mutually exclusive by construction. The links are the bar's own, verbatim,
   plus the way home: the sheet covers the bar, so the identity segment must
   not be lost with it.

   The theme control's mobile home is here, above the links — the satellite
   puck hides below 700px because the corner belongs to the chat. The two
   renderings cannot disagree: apply() in src/lib/theme-client.ts rewrites
   every [data-theme-toggle] in the document.

   FOUR OF THIS BLOCK'S SEVEN CLASSES SURVIVE THE SWAP, and each one is named
   by something that is not the React tier — the cutover's rule, stated in full
   in README.md. `menu` is a SPLIT block: three generated regions with three
   authored gaps between them, and the gaps are the reason.

     .menu         the `body:has(.menu[data-open])` scroll lock (a foreign
                   selector — it styles the document, not the component), the
                   reduced-motion gap, and `@media print { display: none }`.
                   Also what src/lib/vanilla/menu.ts opens, via [data-menu].
     .menu__sheet  the same reduced-motion gap, and the port's focus target.
     .menu__nav    `.menu__nav a + a`, the hairline between two links, which is
                   an adjacent sibling and therefore one of the three holes.
                   Also the port's close-on-navigate delegate.
     .menu__body   `theme-toggle`'s own authored gap, `.menu__body .theme` —
                   the rule that minted the census reason `foreign-scope`.

   `.menu__head`, `.menu__title` and `.menu__close` are named by nothing else
   and leave.

   THE PORT'S SELECTORS ARE NOT RE-POINTED, and that is deliberate rather than
   lazy. src/lib/vanilla/menu.ts is a COPY of js/menu.js; its header says a bug
   found in it is fixed upstream and re-copied. Rewriting `.menu__sheet` to a
   data attribute here would fork the copy from its source for a reason the
   source does not have, and the next re-copy would silently undo it. The class
   is what the port queries, so the class stays — which the four classes above
   were going to require anyway. */
import { Menu, MenuBody, MenuClose, MenuHead, MenuNav, MenuSheet, MenuTitle } from "@yordan/design-system/react/menu";

import { AppLink } from "@/components/AppLink";
import { ThemeToggle } from "@/components/ThemeToggle";
import type { Link } from "@/lib/vanilla-copy";
import { MENU } from "@/lib/vanilla-copy";

export function SiteMenu({ nav }: { nav: Link[] }) {
  return (
    <Menu className="menu" id="site-menu" data-menu="">
      <MenuSheet
        className="menu__sheet"
        role="dialog"
        aria-modal="true"
        aria-label={MENU.title}
        tabIndex={-1}
      >
        <MenuHead>
          <MenuTitle>{MENU.title}</MenuTitle>
          <MenuClose type="button" data-menu-close="">
            {MENU.close}
          </MenuClose>
        </MenuHead>
        <MenuBody className="menu__body">
          <ThemeToggle />
          {/* The port closes the sheet on a click on `.menu__nav a`, and a
              <Link> IS an `a` — the delegated listener on `.menu` runs on the
              same click that starts the transition, so the menu closes and the
              route changes without a reload. Verified in a browser rather than
              reasoned about: a menu left open over its own destination is the
              exact failure this rule exists to prevent. */}
          <MenuNav className="menu__nav" aria-label={MENU.title}>
            {nav.map((l) => (
              <AppLink key={l.href + l.label} href={l.href}>
                {l.label}
              </AppLink>
            ))}
          </MenuNav>
        </MenuBody>
      </MenuSheet>
    </Menu>
  );
}
