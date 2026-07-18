export default { title: "Components/Media slot" };

export const Cover = {
  render: () => `<figure class="ph"><span class="ph__label">Cover — design system overview, 1600×900</span></figure>`,
};

export const Gallery = {
  render: () => `
    <div class="ph-grid">
      <figure class="ph"><span class="ph__label">Before — original front page</span></figure>
      <figure class="ph"><span class="ph__label">After — trust-first hierarchy</span></figure>
    </div>`,
};

export const Tall = {
  render: () => `<figure class="ph ph--tall"><span class="ph__label">App screens on device</span></figure>`,
};
