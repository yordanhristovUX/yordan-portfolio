export default { title: "Skeleton/Band & squares" };

/* Static demonstration of the skeleton. On the site, js/automata.js fills
   rails and strips with living .sq cells (Conway's Life); here a few cells
   are pre-tinted to show the resident (stone) and seeded (accent) states. */

const sq = (style = "") => `<div class="sq" ${style ? `style="${style}"` : ""}></div>`;
const stone = "background-color: rgba(120, 113, 108, 0.3)";
const blue = "background-color: rgba(var(--accent-rgb), 0.45)";

export const BandWithRails = {
  render: () => `
    <main class="sheet">
      <section class="band sec">
        <header class="sec__head">
          <span class="sec__no mono">01</span>
          <h2 class="sec__title t-title">What I do</h2>
        </header>
        <div class="rail rail--l" style="grid-template-columns:repeat(2,1fr)">
          ${sq()}${sq(stone)}${sq()}${sq()}${sq(stone)}${sq(stone)}${sq()}${sq()}${sq()}${sq(blue)}
        </div>
        <div class="well">
          <p class="t-lead">The middle 20 squares are solid paper — text never sits on the grid.
          The rails either side are real squares where the automata lives.</p>
        </div>
        <div class="rail rail--r" style="grid-template-columns:repeat(2,1fr)">
          ${sq(stone)}${sq()}${sq()}${sq(stone)}${sq()}${sq()}${sq(stone)}${sq(stone)}${sq()}${sq()}
        </div>
      </section>
    </main>`,
};

export const Strip = {
  render: () => `
    <div class="strip" style="grid-template-columns:repeat(24,1fr)">
      ${Array.from({ length: 48 }, (_, i) => sq([3, 7, 8, 20, 21, 33, 40, 41, 42].includes(i) ? stone : i === 27 ? blue : "")).join("")}
    </div>`,
};
