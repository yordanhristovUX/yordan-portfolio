export default { title: "Components/Section head" };

/* The plate number (`.sec__no`) is gone — the owner removed it; the head is
   title + optional note now. */
export const WithNote = {
  render: () => `
    <header class="sec__head">
      <h2 class="sec__title t-title">Selected work</h2>
      <span class="sec__note">Click a project for the full case study</span>
    </header>`,
};

export const Plain = {
  render: () => `
    <header class="sec__head">
      <h2 class="sec__title t-title">Skills &amp; tools</h2>
    </header>`,
};
