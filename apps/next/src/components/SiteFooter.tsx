/* The footer — markup and words reproduced from index.html / cv.html @ 2e84323,
   rendered through @yordan/design-system/react/footer.

   Two lines, one of which differs per page: the portfolio points at the source,
   the CV and the MCP page point back at the portfolio. The copyright line is
   the same on all three, and the year in the middle of it is live — see
   src/components/Year.tsx.

   `.foot` STAYS on the element. `footer` is a block generated whole, so the
   class carries nothing components.css would not also say as a utility — but
   css/cv.css hides it in `@media print` ("the copyright line repeats the
   header"), and a page stylesheet is a consumer this app does not own. That is
   the cutover's rule from README.md, and it is the only reason needed.

   `.mono` is NOT a design-system component class and is not affected by the
   swap either way: typography is a layer of utility classes generated from
   tokens/typography.json, and design-system/README.md states why it has no
   React form and never will. */
import { Footer } from "@yordan/design-system/react/footer";

import { AppLink } from "@/components/AppLink";
import { Year } from "@/components/Year";
import { href } from "@/lib/routes";
import type { Link } from "@/lib/vanilla-copy";
import { FOOTER } from "@/lib/vanilla-copy";

export function SiteFooter({ link }: { link: Link }) {
  const [before, after] = FOOTER.copyright;
  return (
    <Footer className="foot mono">
      <span>
        {before}
        <Year fallback={FOOTER.fallbackYear} />
        {after}
      </span>
      <AppLink href={href(link.href)} {...(link.external ? { target: "_blank", rel: "noopener" } : {})}>
        {link.label}
      </AppLink>
    </Footer>
  );
}
