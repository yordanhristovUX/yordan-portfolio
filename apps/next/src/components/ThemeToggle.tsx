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
   than any one component's state. */
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
