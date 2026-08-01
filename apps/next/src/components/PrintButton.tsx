"use client";
/* The CV's one action — copied from js/cv.js @ 2e84323; fix upstream first.

   `data-print` stays on the button even though this component binds its own
   handler: the attribute is the contract the vanilla page's delegated listener
   uses, and keeping it means the markup of the two surfaces is the same string.

   No GSAP, no reveal, nothing else on this page: a CV is a document. It should
   be readable the instant it renders, and it must survive being printed.

   `.bar__action` LEFT WITH THE R5 SWAP and `data-print` did not, which is the
   distinction the whole cutover turns on: the class was an appearance, and
   appearance now arrives from the generated component; the attribute is a
   contract, and a contract is behaviour. `NavAction` is the same `<button>`
   wearing the same declarations, and it spreads every prop below onto it. */
import { NavAction } from "@yordan/design-system/react/nav";

import { CV_BAR } from "@/lib/vanilla-copy";

export function PrintButton() {
  return (
    <NavAction className="mono" data-print="" onClick={() => window.print()}>
      {CV_BAR.print}
    </NavAction>
  );
}
