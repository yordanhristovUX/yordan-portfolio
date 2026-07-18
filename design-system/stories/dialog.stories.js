export default { title: "Components/Dialog" };

export const InnerPage = {
  render: () => `
    <div style="position:relative;height:34rem;overflow:hidden">
      <div class="case" style="position:absolute">
        <div class="case__backdrop"></div>
        <div class="case__panel">
          <div class="case__bar">
            <span class="case__index">Case study 03 / Municipality of Malko Tarnovo</span>
            <button class="btn btn--small">Close ✕</button>
          </div>
          <div class="case__scroll">
            <div class="band case__band">
              <div class="well case__well">
                <div class="case__head">
                  <h2 class="case__title t-display t-display--lg">Municipal Mobile App</h2>
                  <p class="case__subtitle">End-to-end design of a cross-platform civic app serving two opposing audiences.</p>
                  <div class="case__meta chips">
                    <span class="chip">Product Designer</span>
                    <span class="chip chip--solid">Shipped</span>
                    <span class="chip">iOS &amp; Android</span>
                  </div>
                </div>
                <div class="case__content">
                  <h3>The challenge</h3>
                  <p>Two audiences with almost opposing needs. <strong>Tourists</strong> are explorers; <strong>local residents</strong> need services with zero ambiguity.</p>
                  <ul>
                    <li><strong>Green</strong> encodes tourism.</li>
                    <li><strong>Blue</strong> encodes administration.</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>`,
};
