/* The three shapes every page repeats — markup reproduced from index.html and
   the generated work pages @ 2e84323. Not design-system components (they have
   no spec.md and no story, and are not new classes either): each is one
   element the pages already write by hand, given a name here so that the page
   files read as their own structure rather than as a list of divs.

   TWO OF THEM ARE NOW WRAPPERS ROUND A GENERATED COMPONENT rather than round a
   class string. `Btn` and `Chips` used to write `class="btn btn--solid"` and
   `class="chip"` for components.css to match; they now call Button, Chip and
   ChipGroup from @yordan/design-system/react, whose cva maps carry the same
   declarations as Tailwind utilities. Nothing about what these two are for has
   changed — they are still this app's local names for a repeated shape, and
   the design system still owns the appearance. What changed is which of the
   two pipelines delivers it. See src/app/globals.css.

   THE IMPORTS NAME `./react/<id>` RATHER THAN THE BARREL, here and in every
   other file in this app. That began as a workaround — `dist/react/theme-
   toggle.tsx` did not parse at 2.6.0 and the barrel re-exports it — and the
   defect is fixed at 2.8.0, so it is now simply the shape this app kept: both
   routes are on the package's `exports` map, nothing about the boundary
   differs, and a per-component import means one broken artefact would cost one
   component rather than the whole tier. */
import { Button, button } from "@yordan/design-system/react/button";
import { Chip, ChipGroup } from "@yordan/design-system/react/chip";

import { AppLink } from "@/components/AppLink";
import { href, isRoute } from "@/lib/routes";
import type { Link } from "@/lib/vanilla-copy";

/** The living separator between two bands. */
export function Strip() {
  return <div className="strip" aria-hidden="true" />;
}

/* Closes the plate on a lattice line. LAST CHILD OF THE BAND, ALWAYS: it is
   auto-placed, and the rails span its row via `.band:has(> .term)`. Its height
   is CSS's one-cell base plus the shortfall js/automata.js measures into
   --term-slack — which is why it is the only element on the page whose height
   is nobody's content, and why it stays here with the automata still to be
   ported: the CSS base is the part that draws. */
export function Term() {
  return <div className="term" aria-hidden="true" />;
}

/* A button-shaped anchor. `variant: "solid"` is the filled one.

   THE ONE PLACE THE TWO LINK MODELS HAVE TO MEET, and the branch below is the
   reconciliation. The generated `Button` renders its OWN <a> when it is given
   an `href` — that is the canonical HTML of components/button/spec.md, and it
   is a plain anchor with no router in it. This app has a router, and
   src/components/AppLink.tsx exists to send its own routes through it.

   So the href decides, exactly as it already does in AppLink:

     a route of this app  → <AppLink>, i.e. next/link's anchor, wearing the
                            class map from `button({ variant })`. The cva map
                            is exported beside the component precisely so a
                            consumer that must own the element can still use
                            the styling.
     everything else      → <Button href>, the generated anchor, because an
                            absolute URL, a mailto: and a bare #anchor were
                            never going through the router anyway.

   Both branches render the same tag with the same class string; what differs
   is who navigates. Removing the branch and always using <Button href> would
   ship a second site that full-page-loads its own routes.

   THERE IS NO `style` PROP, and the absence is deliberate. One existed for one
   caller — the case-study link row, which spaced its buttons with
   `margin-right:.6rem` on every anchor but the last. `actions` owns both gaps
   now, and `scripts/build-content.mjs` dropped `anchor()`'s matching hook when
   it adopted the component: a parameter with no caller is the same defect one
   argument away from returning, so it goes with it. A button that needs
   spacing needs a layout component around it. */
export function Btn({ link, className }: { link: Link; className?: string }) {
  const to = href(link.href);
  const variant = link.variant === "solid" ? "solid" : "default";
  const external = link.external ? { target: "_blank", rel: "noopener" } : {};

  if (isRoute(to)) {
    return (
      <AppLink className={[button({ variant }), className].filter(Boolean).join(" ")} href={to} {...external}>
        {link.label}
      </AppLink>
    );
  }
  return (
    <Button variant={variant} className={className} href={to} {...external}>
      {link.label}
    </Button>
  );
}

/** A plain link inside a `.link-grid` — no `.btn`, same external handling. */
export function GridLink({ link }: { link: Link }) {
  return (
    <AppLink href={href(link.href)} {...(link.external ? { target: "_blank", rel: "noopener" } : {})}>
      {link.label}
    </AppLink>
  );
}

/** A project's tags. The accent tag is the one solid chip in the row. */
export function Chips({ tags, accent }: { tags: string[]; accent?: string | null }) {
  return (
    <ChipGroup>
      {tags.map((t) => (
        <Chip key={t} variant={t === accent ? "solid" : "default"}>
          {t}
        </Chip>
      ))}
    </ChipGroup>
  );
}
