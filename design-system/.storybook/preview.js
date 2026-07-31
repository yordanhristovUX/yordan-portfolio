/* Every story renders on the real tokens + components CSS — the same
   two files the site loads. Fonts are the vendored files the site ships
   (css/fonts/), not Google's CDN: the site left the CDN after a blocked
   fetch silently killed every font-variation-settings call, and the a11y
   and visual gates must not depend on a network fetch for their text
   metrics. Vite resolves the woff2 urls relative to fonts.css; the
   server.fs.allow entry in main.js lets the dev server reach them. */
import "../dist/tokens.css";
import "../css/components.css";
import "../../css/fonts/fonts.css";

export default {
  /* The theme is a global, not a per-story arg: it is a property of the
     document, and every story must be reviewable in both. Switching it
     writes the same data-theme attribute the site writes, so what
     Storybook shows is what ships — no story-only theming path. */
  initialGlobals: { theme: "light" },
  globalTypes: {
    theme: {
      description: "Colour theme",
      toolbar: {
        title: "Theme",
        icon: "mirror",
        items: [
          { value: "light", title: "Light" },
          { value: "dark", title: "Dark" },
        ],
        dynamicTitle: true,
      },
    },
  },
  decorators: [
    (story, context) => {
      document.documentElement.setAttribute("data-theme", context.globals.theme);
      return story();
    },
  ],
  parameters: {
    layout: "padded",
    options: {
      storySort: { order: ["Tokens", "Typography", "Skeleton", "Components"] },
    },
  },
};
