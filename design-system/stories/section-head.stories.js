export default { title: "Components/Section head" };

export const WithNote = {
  render: () => `
    <header class="sec__head">
      <span class="sec__no mono">02</span>
      <h2 class="sec__title t-title">Selected work</h2>
      <span class="sec__note">Click a project for the full case study</span>
    </header>`,
};

export const Plain = {
  render: () => `
    <header class="sec__head">
      <span class="sec__no mono">05</span>
      <h2 class="sec__title t-title">Skills &amp; tools</h2>
    </header>`,
};
