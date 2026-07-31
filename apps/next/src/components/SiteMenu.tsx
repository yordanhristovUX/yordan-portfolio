/* The full-screen menu the bar's mobile segment summons — markup reproduced
   from index.html @ 2e84323.

   It covers the bar (the drawer's precedent), which makes menu and drawer
   mutually exclusive by construction. The links are the bar's own, verbatim,
   plus the way home: the sheet covers the bar, so the identity segment must
   not be lost with it.

   The theme control's mobile home is here, above the links — the satellite
   puck hides below 700px because the corner belongs to the chat. The two
   renderings cannot disagree: apply() in src/lib/theme-client.ts rewrites
   every [data-theme-toggle] in the document.

   MOUNT POINT. Closed by CSS (`visibility: hidden` until `data-open`), and
   nothing here opens it yet — that is the port of js/menu.js, which toggles
   `data-open` on [data-menu] and nothing else visual. The markup, the id and
   the aria wiring are already what it expects. */
import { AppLink } from "@/components/AppLink";
import { ThemeToggle } from "@/components/ThemeToggle";
import type { Link } from "@/lib/vanilla-copy";
import { MENU } from "@/lib/vanilla-copy";

export function SiteMenu({ nav }: { nav: Link[] }) {
  return (
    <div className="menu" id="site-menu" data-menu="">
      <div className="menu__sheet" role="dialog" aria-modal="true" aria-label={MENU.title} tabIndex={-1}>
        <div className="menu__head">
          <span className="menu__title">{MENU.title}</span>
          <button className="menu__close" type="button" data-menu-close="">
            {MENU.close}
          </button>
        </div>
        <div className="menu__body">
          <ThemeToggle />
          {/* The port closes the sheet on a click on `.menu__nav a`, and a
              <Link> IS an `a` — the delegated listener on `.menu` runs on the
              same click that starts the transition, so the menu closes and the
              route changes without a reload. Verified in a browser rather than
              reasoned about: a menu left open over its own destination is the
              exact failure this rule exists to prevent. */}
          <nav className="menu__nav" aria-label={MENU.title}>
            {nav.map((l) => (
              <AppLink key={l.href + l.label} href={l.href}>
                {l.label}
              </AppLink>
            ))}
          </nav>
        </div>
      </div>
    </div>
  );
}
