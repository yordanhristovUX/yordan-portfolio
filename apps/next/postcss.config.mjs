/* ============================================================
   PostCSS — one plugin, and it exists for one file.

   `@tailwindcss/postcss` is what turns the `@source`/`@theme`/`@tailwind`
   directives in src/app/globals.css into the utility classes the generated
   components in @yordan/design-system/react name. Nothing else in this app
   asks PostCSS for anything: tokens.css, components.css and the four synced
   page stylesheets are plain CSS and pass through untouched — the plugin
   compiles a stylesheet and returns it unchanged when it finds no Tailwind
   feature in it, which is every one of them.

   THAT IS WHY THIS FILE IS A HAZARD WORTH A COMMENT. Adding a PostCSS config
   to a Next app routes EVERY imported stylesheet through this pipeline,
   including copies this app does not own (src/styles/site/*.css, gitignored,
   written by scripts/sync-artifacts.mjs from css/). If a plugin is ever added
   here that rewrites what it is given, it will be rewriting another slice's
   stylesheet on the way in, and the fix for a wrong copy is upstream and a
   re-sync — never a transform on this side of the boundary.
   ============================================================ */
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;
