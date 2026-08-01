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

   ── THE ONE COMPONENT R5 COULD NOT SWAP, AND IT IS AN UPSTREAM DEFECT ──────

   `@yordan/design-system/react/theme-toggle` (2.6.0) DOES NOT PARSE. Three of
   its class strings carry an unescaped double quote inside a double-quoted
   string literal:

     dist/react/theme-toggle.tsx:44
       "[&[data-state="dark"]_.theme__lamp]:bg-content-primary"

   — and the same at :46 and :47 for `data-state="auto"`. `tsc` reports
   TS1005 "',' expected" six times and the build stops there. It is a QUOTE
   NORMALISATION that one of the emitter's two paths does not apply: an
   attribute suffix on the rule's own root comes out correctly single-quoted
   (`nav.tsx:133` emits `"[&[aria-expanded='true']]:bg-primary"`), while an
   attribute suffix used as the ANCESTOR of a scoped part does not. Only
   theme-toggle writes the second shape today, which is why nothing else in the
   tier is affected. `build.mjs --check` byte-compares the file and never
   parses it, so the design system's own gates are green on it.

   REPORTED, NOT WORKED AROUND. This component therefore stays on pipeline 1 —
   `.theme` and `.theme__lamp` out of components.css, exactly as before the
   cutover, which is also where two of theme-toggle's three authored gaps live
   (`@media print`, and the reduced-motion rule that stops the auto dial
   turning). Nothing here reimplements the missing component and nothing here
   patches the artefact. When the emitter is fixed and the package re-packed,
   this file becomes `<ThemeToggle className="theme"><ThemeToggleLamp
   className="theme__lamp" /></ThemeToggle>` and both classes stay, because
   `.menu__body .theme` — the rule that minted the census reason
   `foreign-scope` — and the two gaps above name them.

   The defect also decided how the whole app imports the tier: every other file
   names `@yordan/design-system/react/<id>` rather than the barrel, because the
   barrel re-exports `./theme-toggle` and would drag the parse error into every
   module that touched it. */
import { useEffect } from "react";

import { startTheme } from "@/lib/theme-client";
import { THEME_TOGGLE_LABEL } from "@/lib/vanilla-copy";

export function ThemeToggle() {
  useEffect(() => {
    startTheme();
  }, []);

  return (
    <button className="theme" data-theme-toggle="" data-state="auto" aria-label={THEME_TOGGLE_LABEL}>
      <span className="theme__lamp" aria-hidden="true" />
    </button>
  );
}
