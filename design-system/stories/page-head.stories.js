export default { title: "Components/Page head" };

/* ONE STORY, and the story count moving 62 → 64 is two components rather than
   two variants: this block has no variants by design (see the spec), so a
   second story would be a second baseline capturing the same pixels. The band
   and the well are here because the component's first rule is about the well —
   render the parts on their own and the nav clearance has nothing to apply to. */
export const Default = {
  render: () => `
    <section class="band page-head" aria-labelledby="page-head-title">
      <div class="well">
        <p class="page-head__kicker t-label">Green Street</p>
        <h1 class="page-head__title t-display t-display--lg" id="page-head-title">A design system for a bank</h1>
        <p class="page-head__lede t-lead">
          One paragraph. What the work was, in the words the case study goes on to prove.
        </p>
        <div class="page-head__meta">
          <div class="chips"><span class="chip">Design system</span><span class="chip">Figma</span><span class="chip chip--solid">Shipped</span></div>
        </div>
      </div>
    </section>`,
};
