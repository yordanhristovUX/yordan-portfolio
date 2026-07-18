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
  parameters: {
    layout: "padded",
    options: {
      storySort: { order: ["Tokens", "Typography", "Skeleton", "Components"] },
    },
  },
};
