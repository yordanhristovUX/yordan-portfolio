export default { title: "Components/Button" };

export const Outline = { render: () => `<a class="btn" href="#">Get in touch</a>` };
export const Solid = { render: () => `<a class="btn btn--solid" href="#">See the work ↓</a>` };
export const Small = { render: () => `<button class="btn btn--small">Close ✕</button>` };
export const Pair = {
  render: () => `
    <div style="display:flex;gap:.75rem">
      <a class="btn btn--solid" href="#">See the work ↓</a>
      <a class="btn" href="#">Get in touch</a>
    </div>`,
};
