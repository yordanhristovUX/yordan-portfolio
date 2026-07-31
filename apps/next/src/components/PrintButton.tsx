"use client";
/* The CV's one action — copied from js/cv.js @ 2e84323; fix upstream first.

   `data-print` stays on the button even though this component binds its own
   handler: the attribute is the contract the vanilla page's delegated listener
   uses, and keeping it means the markup of the two surfaces is the same string.

   No GSAP, no reveal, nothing else on this page: a CV is a document. It should
   be readable the instant it renders, and it must survive being printed. */
import { CV_BAR } from "@/lib/vanilla-copy";

export function PrintButton() {
  return (
    <button className="bar__action mono" data-print="" onClick={() => window.print()}>
      {CV_BAR.print}
    </button>
  );
}
