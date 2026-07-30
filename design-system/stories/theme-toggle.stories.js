export default { title: "Components/Theme toggle" };

/* The toggle is only ever seen inside the bar, so the stories show it there —
   a bare button on a page background would misrepresent both its chrome and
   its dividing rule. */

/* These two functions are the same arithmetic js/theme.js runs, restated here
   so the stories are the a11y contract rather than an approximation of it. The
   accessible name is not a property of the state alone: it depends on what the
   visitor's system resolves `auto` to, which is exactly the fact the old
   version of this file got wrong by hardcoding "Activate for light." on a
   control that, on a light system, activates into light. */
const next = (state, sys) =>
  state === "auto" ? (sys === "dark" ? "light" : "dark") : state === sys ? "auto" : sys;

const is = (state, sys) => (state === "auto" ? `auto, currently ${sys}` : state);
const to = (state, sys) =>
  state === "auto" ? `auto (your system setting, currently ${sys})` : state;

const name = (state, sys) =>
  `Theme: ${is(state, sys)}. Activate for ${to(next(state, sys), sys)}.`;

const LABEL = { auto: "Auto", light: "Light", dark: "Dark" };

/* `aria-label="Primary"` because that is what components/nav/spec.md's canonical
   bar carries and what all four pages ship. It was missing here, which made this
   file's borrowed bar a near-copy of the pattern rather than the pattern. */
const inBar = (state, sys = "light") => `
  <header class="bar" style="position:static;transform:none;width:max-content">
    <span class="bar__id">Yordan Hristov</span>
    <nav class="bar__nav" aria-label="Primary"><a href="#">Work</a><a href="#">About</a></nav>
    <button class="theme mono" data-state="${state}" aria-label="${name(state, sys)}">
      <span class="theme__lamp" aria-hidden="true"></span>
      <span class="theme__label">${LABEL[state]}</span>
    </button>
  </header>`;

export const Auto = { render: () => inBar("auto") };
export const Light = { render: () => inBar("light") };
export const Dark = { render: () => inBar("dark") };

/* A VARIANT MATRIX IS NOT A DOCUMENT — the exemption the two stories below
   carry. Both borrow the bar to show the toggle where it actually lives, and
   both render it three and six times respectively, so both render that many
   `<nav>`s and (in AllStates) that many banner landmarks. Nothing is wrong with
   the component: a page has one bar. The single-banner and unique-landmark
   assertions belong to a page-level a11y check over the four shipped pages.
   Per story, per rule, next to the markup that needs it — everything else axe
   knows, including the whole of WCAG, still runs over these two. */
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

/* The three lamps side by side — the states have to be tellable apart at a
   glance and at 9px, which is the whole design risk of this component. */
export const AllStates = {
  parameters: matrix,
  render: () => `
    <div style="display:flex;flex-direction:column;gap:1rem;align-items:flex-start">
      ${inBar("auto")}
      ${inBar("light")}
      ${inBar("dark")}
    </div>`,
};

/* Three states against two system settings. The lamp is identical down each
   column — the difference lives entirely in the accessible name and in which
   press does what, so this story prints both rather than relying on the
   rendering to show a difference it cannot show. */
export const AccessibleNameMatrix = {
  parameters: matrix,
  render: () => `
    <div style="display:grid;gap:var(--space-6)">
      ${["light", "dark"]
        .map(
          (sys) => `
        <section>
          <p class="mono" style="color:var(--chrome-label);margin-bottom:var(--space-3)">
            System preference: ${sys} — cycle is auto → ${next("auto", sys)} → ${next(
            next("auto", sys),
            sys
          )} → auto
          </p>
          <div style="display:flex;flex-direction:column;gap:var(--space-4);align-items:flex-start">
            ${["auto", next("auto", sys), next(next("auto", sys), sys)]
              .map(
                (state) => `
              <div>
                ${inBar(state, sys)}
                <p class="mono" style="color:var(--chrome-label);margin-top:var(--space-2)">
                  ${name(state, sys)}
                  ${
                    (state === "auto" ? sys : state) ===
                    (next(state, sys) === "auto" ? sys : next(state, sys))
                      ? "&nbsp;— the one press that cannot change the page"
                      : ""
                  }
                </p>
              </div>`
              )
              .join("")}
          </div>
        </section>`
        )
        .join("")}
    </div>`,
};
