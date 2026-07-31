/** Storybook — vanilla HTML stories over the real DS CSS. */
import { fileURLToPath } from "node:url";

export default {
  framework: "@storybook/html-vite",
  stories: ["../stories/**/*.stories.js"],
  addons: ["@storybook/addon-a11y"],
  core: { disableTelemetry: true },
  /* preview.js imports the site's vendored fonts from ../../css/fonts/,
     which sits outside this package — Vite's dev server refuses to serve
     files beyond the project root unless the directory is allow-listed.
     Setting fs.allow disables Vite's workspace-root default, so the entry
     is the repo root, which covers both the fonts and this package. The
     static build is unaffected (assets are bundled). */
  viteFinal(config) {
    config.server ??= {};
    config.server.fs ??= {};
    config.server.fs.allow = [
      ...(config.server.fs.allow ?? []),
      fileURLToPath(new URL("../..", import.meta.url)),
    ];
    return config;
  },
};
