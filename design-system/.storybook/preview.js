/* Every story renders on the real tokens + components CSS — the same
   two files the site loads. Fonts come from Google, as on the site. */
import "../dist/tokens.css";
import "../css/components.css";

const fonts = document.createElement("link");
fonts.rel = "stylesheet";
fonts.href =
  "https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,700..900&family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600&display=swap";
document.head.appendChild(fonts);

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
