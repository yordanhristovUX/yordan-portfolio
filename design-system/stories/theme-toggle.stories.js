export default { title: "Components/Theme toggle" };

/* The toggle is only ever seen inside the bar, so the stories show it there —
   a bare button on a page background would misrepresent both its chrome and
   its dividing rule. */
// The aria-label strings are the ones js/theme.js actually writes, so the
// stories can be read as the a11y contract rather than an approximation.
const SAYS = {
  auto: ["following your system setting", "light"],
  light: ["light", "dark"],
  dark: ["dark", "auto"],
};
const LABEL = { auto: "Auto", light: "Light", dark: "Dark" };

const inBar = (state) => `
  <header class="bar" style="position:static;transform:none;width:max-content">
    <span class="bar__id">Yordan Hristov</span>
    <nav class="bar__nav"><a href="#">Work</a><a href="#">About</a></nav>
    <button class="theme mono" data-state="${state}"
            aria-label="Theme: ${SAYS[state][0]}. Activate for ${SAYS[state][1]}.">
      <span class="theme__lamp" aria-hidden="true"></span>
      <span class="theme__label">${LABEL[state]}</span>
    </button>
  </header>`;

export const Auto = { render: () => inBar("auto") };
export const Light = { render: () => inBar("light") };
export const Dark = { render: () => inBar("dark") };

/* The three lamps side by side — the states have to be tellable apart at a
   glance and at 9px, which is the whole design risk of this component. */
export const AllStates = {
  render: () => `
    <div style="display:flex;flex-direction:column;gap:1rem;align-items:flex-start">
      ${inBar("auto")}
      ${inBar("light")}
      ${inBar("dark")}
    </div>`,
};
