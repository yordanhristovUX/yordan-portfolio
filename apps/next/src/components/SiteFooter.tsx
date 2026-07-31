/* The footer — markup and words reproduced from index.html / cv.html @ 2e84323.

   Two lines, one of which differs per page: the portfolio points at the source,
   the CV and the MCP page point back at the portfolio. The copyright line is
   the same on all three, and the year in the middle of it is live — see
   src/components/Year.tsx. */
import { Year } from "@/components/Year";
import { href } from "@/lib/routes";
import type { Link } from "@/lib/vanilla-copy";
import { FOOTER } from "@/lib/vanilla-copy";

export function SiteFooter({ link }: { link: Link }) {
  const [before, after] = FOOTER.copyright;
  return (
    <footer className="foot mono">
      <span>
        {before}
        <Year fallback={FOOTER.fallbackYear} />
        {after}
      </span>
      <a
        href={href(link.href)}
        {...(link.external ? { target: "_blank", rel: "noopener" } : {})}
      >
        {link.label}
      </a>
    </footer>
  );
}
