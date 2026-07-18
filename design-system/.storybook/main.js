/** Storybook — vanilla HTML stories over the real DS CSS. */
export default {
  framework: "@storybook/html-vite",
  stories: ["../stories/**/*.stories.js"],
  addons: ["@storybook/addon-a11y"],
  core: { disableTelemetry: true },
};
