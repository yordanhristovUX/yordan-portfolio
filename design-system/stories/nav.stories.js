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
        <button class="bar__action mono" type="button" data-drawer-open="ask-panel"
                aria-controls="ask-panel" aria-expanded="false">Ask</button>
        <button class="theme" data-theme-toggle data-state="auto" aria-label="Theme: auto, following your system setting. Activate to change the theme.">
          <span class="theme__lamp" aria-hidden="true"></span>
        </button>
      </header>
    </div>`,
};

/* The responsive steps, side by side, because the interesting thing about this
   component is what it drops and when. `.bar__clock` is hidden under 1280px and
   `.bar__status` under 1200px by media query, so a story rendered in a narrow
   Storybook canvas would show the narrowest step three times and prove nothing.
   These force each step by hiding the segment directly.

   The measured widths are in components/nav/spec.md. The short version: the Ask
   segment costs 64.0px, the status reveal moved from 1080px to 1200px to pay for
   it, and the bar's worst-case share of the well went DOWN — 81.8% against the
   83.6% it had before the segment existed. */
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
    <button class="bar__action mono" type="button" data-drawer-open="ask-panel"
            aria-controls="ask-panel" aria-expanded="${extra === "open" ? "true" : "false"}">Ask</button>
    <button class="theme" data-theme-toggle data-state="auto" aria-label="Theme: auto, following your system setting. Activate to change the theme.">
      <span class="theme__lamp" aria-hidden="true"></span>
    </button>
  </header>`;

const step = (label, extra) => `
  <div style="position:relative;height:5rem;background:var(--surface-page)">
    <p class="mono" style="position:absolute;bottom:0;color:var(--chrome-label)">${label}</p>
    ${bar(extra)}
  </div>`;

/* A VARIANT MATRIX IS NOT A DOCUMENT — the exemption both stories below carry.
   Each renders the bar two or three times, on purpose, so each renders two or
   three banner landmarks. The component ships ONE bar per page; the
   single-banner assertion is a property of a page and belongs to a page-level
   a11y check over index.html / cv.html / mcp.html / evals.html, where a second
   banner would be a real defect. Disabled per story and per rule rather than in
   the runner's config, so each exemption is a line someone chose to write next
   to the markup that needed it. Everything else axe knows still runs here. */
const matrix = {
  a11y: {
    config: {
      rules: [
        { id: "landmark-no-duplicate-banner", enabled: false },
        { id: "landmark-unique", enabled: false },
      ],
    },
  },
};

export const ResponsiveSteps = {
  parameters: matrix,
  render: () => `
    <div style="display:grid;gap:var(--space-7)">
      ${step("≥ 1280px — everything · 872.1px · 81.8% of the well", "")}
      ${step("1200–1279px — the clock goes first · 816.2px · 81.6% at 1200", "no-clock")}
      ${step("≤ 1199px — the whole status goes · 552.5px · 55.3% at 1199", "no-status")}
    </div>`,
};

/* The Ask segment is a `.bar__action`, and an action that opens something and
   leaves it open wears the hover state for as long as it is open. The rule keys
   off `aria-expanded`, which is the state a screen reader is already being told
   about — so the highlight cannot drift from the announcement.

   The closed `#ask-panel` at the end is what `aria-controls` points at. axe only
   validates that reference once the segment says `aria-expanded="true"` — which
   is exactly what this story exists to show — so this was the one place in the
   set where a dangling reference could fail `aria-valid-attr-value`, and on the
   first run of the a11y gate it did. `visibility: hidden` keeps the panel out of
   the tree, the tab order and the screenshot. */
export const AskExpanded = {
  name: "Ask, expanded",
  parameters: matrix,
  render: () => `
    <div style="display:grid;gap:var(--space-7)">
      ${step("aria-expanded=\"false\" — the drawer is closed", "no-status")}
      ${step("aria-expanded=\"true\" — the drawer is open, and the segment says so", "open")}
      <div class="drawer" id="ask-panel" data-drawer></div>
    </div>`,
};
