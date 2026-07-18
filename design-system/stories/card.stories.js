export default { title: "Components/Card" };

export const TypedGrid = {
  render: () => `
    <div class="card-grid" style="background:var(--surface-page)">
      <article class="card">
        <span class="card__type">Analytics platform</span>
        <h3 class="card__title">Ubistats Football</h3>
        <p>Research → design system → UI → usability testing.</p>
      </article>
      <article class="card">
        <span class="card__type">Fintech</span>
        <h3 class="card__title">Payment / Crypto / Stocks</h3>
        <p>Full IA for a unified crypto, fiat, and stocks platform.</p>
      </article>
      <article class="card">
        <span class="card__type">Corporate website</span>
        <h3 class="card__title">Paraflow</h3>
        <p>Custom site with Laravel CMS for an enterprise IT integrator.</p>
      </article>
    </div>`,
};

export const RuledGrid = {
  render: () => `
    <div class="card-grid" style="background:var(--surface-page)">
      <article class="card card--ruled">
        <h3 class="card__title">AI-ready design systems</h3>
        <p>Component libraries with 1:1 parity to coded components.</p>
      </article>
      <article class="card card--ruled">
        <h3 class="card__title">Platform-scale UX</h3>
        <p>Whole product surfaces — audited for consistency and usability.</p>
      </article>
      <article class="card card--ruled">
        <h3 class="card__title">Design-to-code</h3>
        <p>The handoff gap, bridged with AI-powered tooling.</p>
      </article>
    </div>`,
};
