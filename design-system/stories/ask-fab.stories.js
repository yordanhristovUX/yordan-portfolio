export default { title: "Components/Ask FAB" };

/* `position: fixed` and the ≤699px reveal are the page's business — the
   stories pin the pill into a framed corner and force `display: flex` the
   same way the nav stories force their responsive steps. Both states are
   shown side by side because the fold is the whole component. */
const corner = (attrs) => `
  <div style="position:relative;height:8rem;background:var(--surface-page)">
    <button class="ask-fab" type="button" aria-label="Ask my Bot" ${attrs}
            style="position:absolute;display:flex">
      <img class="ask-fab__face" src="../assets/avatar.svg" alt="" aria-hidden="true"
           width="80" height="80">
      <span class="ask-fab__label">Ask my Bot</span>
    </button>
  </div>`;

export const States = {
  name: "Pill, and folded to the face",
  render: () => `
    <div style="display:grid;gap:var(--space-5)">
      ${corner("")}
      ${corner("data-collapsed")}
    </div>`,
};
