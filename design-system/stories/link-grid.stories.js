export default { title: "Components/Link grid" };

export const Channels = {
  render: () => `
    <div class="link-grid" style="background:var(--surface-page)">
      <a href="mailto:hello@example.com">Email</a>
      <a href="tel:+359884614579">+359 884 614 579</a>
      <a href="#" target="_blank" rel="noopener">LinkedIn ↗</a>
      <a href="#" target="_blank" rel="noopener">Resume ↗</a>
    </div>`,
};
