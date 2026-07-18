export default { title: "Components/Profile" };

export const HeroProfile = {
  render: () => `
    <dl class="profile mono" style="background:var(--surface-page);padding:1rem">
      <div><dt>Focus</dt><dd>AI-ready design systems · platform-scale UX · design-to-code</dd></div>
      <div><dt>Currently</dt><dd>Green Street — commercial real estate analytics</dd></div>
      <div><dt>Previously</dt><dd>10+ years coaching athletes — psychology, motivation, behaviour</dd></div>
      <div><dt>Availability</dt><dd class="is-ok">Open to new projects</dd></div>
    </dl>`,
};
