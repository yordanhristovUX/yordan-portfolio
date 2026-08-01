export default { title: "Components/Definition row" };

export const DefinitionRows = {
  render: () => `
    <dl class="tools" style="background:var(--surface-page)">
      <div class="tools__row">
        <dt>Design</dt>
        <dd>Figma, design systems, component architecture, token systems</dd>
      </div>
      <div class="tools__row">
        <dt>Accessibility</dt>
        <dd>WCAG 2.1 AA, screen reader testing, semantic HTML review</dd>
      </div>
    </dl>`,
};
