export default { title: "Components/Row" };

export const ProjectRows = {
  render: () => `
    <ul class="idx" role="list" style="background:var(--surface-page)">
      <li>
        <button class="idx__row">
          <span class="idx__no mono">01</span>
          <span class="idx__main">
            <span class="idx__name">Green Street <em>— AI-Ready Design System</em></span>
            <span class="idx__desc">1:1 Figma-to-code parity, custom Claude skills, and a prototype pipeline.</span>
          </span>
          <span class="idx__tags"><span class="chip">Design system</span><span class="chip">AI</span></span>
          <span class="idx__go mono" aria-hidden="true">View →</span>
        </button>
      </li>
      <li>
        <button class="idx__row">
          <span class="idx__no mono">02</span>
          <span class="idx__main">
            <span class="idx__name">Domestina <em>— Cleaning Marketplace</em></span>
            <span class="idx__desc">Multi-year, research-led UX — bounce rate down 40%.</span>
          </span>
          <span class="idx__tags"><span class="chip">Research</span><span class="chip">−40% bounce</span></span>
          <span class="idx__go mono" aria-hidden="true">View →</span>
        </button>
      </li>
    </ul>`,
};

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
