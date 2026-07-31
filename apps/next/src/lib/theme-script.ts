/* ============================================================
   The no-flash theme script — copied from index.html @ 2e84323; fix upstream
   first.

   Byte-for-byte the script the vanilla pages run in <head>, comments included,
   because what it does is subtle enough that the comments are part of it. It
   must stay INLINE and BLOCKING: a deferred script runs after the first frame,
   which is exactly the flash of the wrong theme it exists to prevent. Next
   emits it as-is via dangerouslySetInnerHTML in the root layout, above
   everything React hydrates.

   It reads `localStorage.theme` — the same key, the same two accepted values,
   the same silent fall-through when storage is disabled — so a reader who
   pinned a theme on the vanilla site and lands here sees what they pinned.
   src/components/ThemeToggle.tsx owns the control and the persistence from
   there, exactly as js/theme.js does.

   THE TWO COLOURS ARE NOT LITERALS HERE, and that is the one deliberate
   difference from the page it was copied from. index.html carries `#f5f5f4`
   and `#1c1917` in its theme-color metas with a note explaining that they are
   the only value available before the stylesheet is parsed. That reasoning is
   sound and the values are still tokens — so this app reads them out of the
   design system's published tokens.flat.json instead of retyping them, which
   is both the no-colour-literals-in-TS rule and a live check that the two
   surfaces agree: change --surface-page in tokens.json and this follows.
   ============================================================ */
import tokens from "@yordan/design-system/tokens.flat.json";

interface FlatToken {
  cssVar: string;
  value: string;
  resolved?: string;
  dark?: string;
  darkResolved?: string;
}

const flat = tokens as Record<string, FlatToken>;

function surfacePage(): { light: string; dark: string } {
  const token = flat["surface.surface-page"];
  const light = token?.resolved;
  const dark = token?.darkResolved;
  if (!light || !dark) {
    throw new Error(
      "@yordan/design-system/tokens.flat.json: surface.surface-page is missing `resolved` or `darkResolved`.\n" +
        "  The browser chrome colour comes from that token and this app writes no colour literal to stand in for it."
    );
  }
  return { light, dark };
}

/** The paper colour, light and dark, for the two `theme-color` metas. */
export const THEME_COLORS = surfacePage();

export const NO_FLASH_THEME = `
    try {
      var t = localStorage.getItem("theme");
      if (t === "light" || t === "dark") {
        document.documentElement.setAttribute("data-theme", t);
        /* Same frame, same script: the browser chrome has to agree with the
           paper, and a deferred fix would be a visible flash of the wrong
           chrome rather than a wrong colour forever. \`not all\` never matches,
           \`all\` always does, so the pinned tag wins whatever the OS says. */
        var m = document.querySelectorAll('meta[name="theme-color"]');
        for (var i = 0; i < m.length; i++) {
          m[i].media = m[i].getAttribute("data-theme-color") === t ? "all" : "not all";
        }
      }
    } catch (e) { /* storage disabled — fall through to prefers-color-scheme */ }
  `;
