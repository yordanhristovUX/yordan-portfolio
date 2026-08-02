"use client";
/* The theme control — markup per the design system's theme-toggle pattern,
   behaviour ported in src/lib/theme-client.ts (from js/theme.js @ 2e84323).

   It renders exactly what the vanilla pages render, including the deliberately
   vaguer static aria-label: the script names what auto currently RESOLVES to
   and static HTML cannot know the visitor's OS. Replaced on the first apply(),
   which is what the effect below triggers.

   The same component appears twice per page — the satellite puck off the bar's
   right edge, and the one inside the mobile menu — and they cannot disagree,
   because apply() rewrites every [data-theme-toggle] in the document rather
   than any one component's state.

   ── THE COMPONENT R5 COULD NOT SWAP, SWAPPED ──────────────────────────────

   This was the one element of the cutover left on pipeline 1, and the reason
   was an upstream defect rather than a preference: at 2.6.0
   `dist/react/theme-toggle.tsx` did not PARSE — three class strings carried an
   unescaped double quote inside a double-quoted literal
   (`[&[data-state="dark"]_.theme__lamp]:…`) and `tsc` stopped on six TS1005s.
   The emitter normalises those quotes at 2.8.0, and the file compiles, so the
   report is closed and the component joins the tier with the other twenty.

   BOTH CLASSES STAY, and neither is habit. `.theme` is named by
   `.menu__body .theme` — theme-toggle's own authored gap, and the rule that
   minted the census reason `foreign-scope` — and by its `@media print` gap.
   `.theme__lamp` is the SINK of three scoped rules the tier itself emits
   (`[&[data-state='dark']_.theme\_\_lamp]:…`), and a scoped rule names its sink
   by class even when its host wears a utility; it is also the reduced-motion
   gap's target, which stops the auto dial turning. scripts/check-class-hooks.mjs
   computes both requirements rather than taking this comment's word for it.

   The per-component import route is unchanged and now stands on its own merits
   rather than on that defect: `@yordan/design-system/react/theme-toggle` is a
   published subpath, one broken artefact costs one component, and the barrel
   is equally legal for anyone who wants it. */
import { ThemeToggle as Toggle, ThemeToggleLamp } from "@yordan/design-system/react/theme-toggle";
import { useEffect } from "react";

import { startTheme } from "@/lib/theme-client";
import { THEME_TOGGLE_LABEL } from "@/lib/vanilla-copy";

export function ThemeToggle() {
  useEffect(() => {
    startTheme();
  }, []);

  return (
    <Toggle className="theme" data-theme-toggle="" data-state="auto" aria-label={THEME_TOGGLE_LABEL}>
      <ThemeToggleLamp className="theme__lamp" aria-hidden="true" />
    </Toggle>
  );
}
