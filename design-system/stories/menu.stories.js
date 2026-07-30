export default { title: "Components/Menu" };

/* The sheet is `position: fixed; inset: 0` in production — a Storybook canvas
   cannot host that honestly, so the stories pin it into a framed box the same
   way the drawer's stories do: the geometry is the component's, the fixed
   positioning is the page's. `data-open` is forced on, because a closed menu
   is `visibility: hidden` and a story of nothing proves nothing. */
const frame = (inner) => `
  <div style="position:relative;height:28rem;overflow:hidden;background:var(--surface-page)">
    ${inner}
  </div>`;

export const Open = {
  render: () =>
    frame(`
    <div class="menu" data-open style="position:absolute">
      <div class="menu__sheet" role="dialog" aria-modal="true" aria-label="Menu" tabindex="-1">
        <div class="menu__head">
          <span class="menu__title">Menu</span>
          <button class="menu__close" type="button" data-menu-close>Close</button>
        </div>
        <div class="menu__body">
          <nav class="menu__nav" aria-label="Menu">
            <a href="#">Work</a>
            <a href="#">About</a>
            <a href="#">Contact</a>
          </nav>
          <button class="theme" data-theme-toggle data-state="auto" aria-label="Theme: auto.">
            <span class="theme__lamp" aria-hidden="true"></span>
          </button>
        </div>
      </div>
    </div>`),
};

/* The pages whose identity segment is the way back put it in the menu too —
   the sheet covers the bar, and the way back must not be lost with it. */
export const SubPage = {
  name: "Sub-page, with the way back",
  render: () =>
    frame(`
    <div class="menu" data-open style="position:absolute">
      <div class="menu__sheet" role="dialog" aria-modal="true" aria-label="Menu" tabindex="-1">
        <div class="menu__head">
          <span class="menu__title">Menu</span>
          <button class="menu__close" type="button" data-menu-close>Close</button>
        </div>
        <div class="menu__body">
          <nav class="menu__nav" aria-label="Menu">
            <a href="#">← Portfolio</a>
            <a href="#">Experience</a>
            <a href="#">Skills</a>
          </nav>
          <button class="theme" data-theme-toggle data-state="auto" aria-label="Theme: auto.">
            <span class="theme__lamp" aria-hidden="true"></span>
          </button>
        </div>
      </div>
    </div>`),
};

/* The trigger lives in the nav component's block (`.bar__menu`) but only ever
   appears in service of this one, so the pairing is shown here: the segment at
   rest and wearing its `aria-expanded` pressed ink.

   THE CLOSED MENU AT THE END IS NOT DECORATION. `aria-controls="site-menu"` is
   part of the canonical segment, and a story that renders the trigger without
   its target ships a dangling ARIA reference — `aria-valid-attr-value`, which
   axe rates CRITICAL and which the first run of the a11y gate found here. One
   closed `#site-menu` serves both triggers, exactly as one serves the whole
   page: `visibility: hidden` keeps it out of the tree, the tab order and the
   screenshot, and duplicating it per frame would trade this violation for a
   duplicate id. */
export const Trigger = {
  name: "Bar segment (trigger)",
  parameters: {
    /* A VARIANT MATRIX IS NOT A DOCUMENT. This story renders the bar twice to
       put the two `aria-expanded` states side by side, so of course there are
       two banner landmarks — that is the story's whole subject, not a defect in
       the component, which ships one bar per page. Both rules below are
       document-scope assertions and belong to a page-level a11y check over
       index.html / cv.html / mcp.html / evals.html, where a second banner would
       be real. Scoped per story and per rule so it stays a visible decision:
       everything else axe knows still runs here, including the whole of WCAG. */
    a11y: {
      config: {
        rules: [
          { id: "landmark-no-duplicate-banner", enabled: false },
          { id: "landmark-unique", enabled: false },
        ],
      },
    },
  },
  render: () => `
    <div style="display:grid;gap:var(--space-5)">
      ${["false", "true"].map(
        (expanded) => `
      <div style="position:relative;height:5rem;background:var(--surface-page)">
        <header class="bar" style="position:absolute">
          <a class="bar__id" href="#">Yordan Hristov</a>
          <button class="bar__menu" type="button" style="display:flex"
                  data-menu-open aria-controls="site-menu" aria-expanded="${expanded}">Menu</button>
          <button class="bar__action mono" type="button">Ask</button>
        </header>
      </div>`
      ).join("")}
      <div class="menu" id="site-menu" data-menu></div>
    </div>`,
};
