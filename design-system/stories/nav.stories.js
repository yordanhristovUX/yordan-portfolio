export default { title: "Components/Nav" };

export const FloatingBar = {
  render: () => `
    <div style="position:relative;height:8rem;background:var(--surface-page)">
      <header class="bar" style="position:absolute">
        <a class="bar__id" href="#">Yordan Hristov</a>
        <nav class="bar__nav" aria-label="Primary">
          <a href="#">Work</a>
          <a href="#">About</a>
          <a href="#">Contact</a>
        </nav>
        <div class="bar__status">
          <span class="bar__dot" aria-hidden="true"></span>
          <span>Available for work — Sofia<span class="bar__clock">, <time>14:30</time></span></span>
        </div>
        <button class="theme mono" data-theme-toggle data-state="auto" aria-label="Theme: auto, following your system setting. Activate to change the theme.">
          <span class="theme__lamp" aria-hidden="true"></span>
          <span class="theme__label">Auto</span>
        </button>
      </header>
    </div>`,
};

/* The three responsive steps, side by side, because the interesting thing about
   this component is what it drops and when. `.bar__clock` is hidden under
   1280px and `.bar__status` under 1080px by media query, so a story rendered in
   a narrow Storybook canvas would show the narrowest step three times and prove
   nothing. These force each step by hiding the segment directly. */
const bar = (extra = "") => `
  <header class="bar" style="position:absolute">
    <a class="bar__id" href="#">Yordan Hristov</a>
    <nav class="bar__nav" aria-label="Primary">
      <a href="#">Work</a><a href="#">About</a><a href="#">Contact</a>
    </nav>
    <div class="bar__status"${extra === "no-status" ? ' style="display:none"' : ""}>
      <span class="bar__dot" aria-hidden="true"></span>
      <span>Available for work — Sofia<span class="bar__clock" style="display:${
        extra === "" ? "inline" : "none"
      }">, <time>14:30</time></span></span>
    </div>
    <button class="theme mono" data-theme-toggle data-state="auto" aria-label="Theme: auto, following your system setting. Activate to change the theme.">
      <span class="theme__lamp" aria-hidden="true"></span>
      <span class="theme__label">Auto</span>
    </button>
  </header>`;

export const ResponsiveSteps = {
  render: () => `
    <div style="display:grid;gap:var(--space-7)">
      <div style="position:relative;height:5rem;background:var(--surface-page)">
        <p class="mono" style="position:absolute;bottom:0;color:var(--chrome-label)">≥ 1280px — everything</p>
        ${bar("")}
      </div>
      <div style="position:relative;height:5rem;background:var(--surface-page)">
        <p class="mono" style="position:absolute;bottom:0;color:var(--chrome-label)">1080–1279px — the clock goes first</p>
        ${bar("no-clock")}
      </div>
      <div style="position:relative;height:5rem;background:var(--surface-page)">
        <p class="mono" style="position:absolute;bottom:0;color:var(--chrome-label)">≤ 1079px — the whole status goes</p>
        ${bar("no-status")}
      </div>
    </div>`,
};
