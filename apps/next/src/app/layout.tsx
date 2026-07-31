/* ============================================================
   The root layout — the four things every page on the vanilla site has in its
   <head>, in the same order and for the same reasons.

   THE CASCADE ORDER IS THE ONE THING TO GET RIGHT. Every vanilla page links,
   in this sequence: the vendored fonts, the design system's tokens, the design
   system's components, then the page's own stylesheet. Tokens must precede
   components (components consume the custom properties), and the page
   stylesheet must come last (it may only position and compose what the two
   above define). Here tokens and components are imported by THIS file and each
   page imports its own stylesheet, so Next emits them in layout-then-page
   order, which is the same order.

   Fonts are a <link> to /fonts/fonts.css rather than an import, and that is
   deliberate: fonts.css addresses its woff2 files relatively, and an import
   would move it to a hashed URL under /_next/static/css/ while the fonts stayed
   in /fonts/. scripts/sync-artifacts.mjs copies the whole directory together
   so the relative references still hold. Archivo's wdth axis IS the display
   voice — with the fonts missing it falls back to something with no wdth axis
   and every font-variation-settings call in components.css silently does
   nothing.
   ============================================================ */
import type { Metadata } from "next";

import { siteUrl } from "@/lib/content";
import { NO_FLASH_THEME, THEME_COLORS } from "@/lib/theme-script";

import "@yordan/design-system/tokens.css";
import "@yordan/design-system/components.css";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* Browser chrome. These two follow the OS, which is correct for a
            reader who has not pinned a theme and WRONG for one who has: pin
            light on a dark OS and you get light paper with dark chrome. The
            inline script below flips `media` so the pinned one always matches,
            and the theme control then replaces the value with the real
            --surface-page. The values come from the design system's published
            tokens (see src/lib/theme-script.ts) — they are what a reader with
            JS off gets, for whom the OS query is the right answer anyway. */}
        <meta
          name="theme-color"
          content={THEME_COLORS.light}
          media="(prefers-color-scheme: light)"
          data-theme-color="light"
        />
        <meta
          name="theme-color"
          content={THEME_COLORS.dark}
          media="(prefers-color-scheme: dark)"
          data-theme-color="dark"
        />
        {/* Theme, before first paint. This must stay inline and blocking: a
            deferred script runs after the first frame, which is exactly the
            flash of the wrong theme it exists to prevent. */}
        <script dangerouslySetInnerHTML={{ __html: NO_FLASH_THEME }} />
        <link rel="stylesheet" href="/fonts/fonts.css" />
      </head>
      <body>{children}</body>
    </html>
  );
}
