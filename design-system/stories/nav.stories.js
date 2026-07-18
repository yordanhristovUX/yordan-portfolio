export default { title: "Components/Nav" };

export const FloatingBar = {
  render: () => `
    <div style="position:relative;height:8rem;background:var(--surface-page)">
      <header class="bar" style="position:absolute">
        <a class="bar__id" href="#">Yordan Hristov</a>
        <nav class="bar__nav" aria-label="Primary">
          <a href="#">Work</a>
          <a href="#">About</a>
          <a href="#">Contact</a>
        </nav>
        <div class="bar__status">
          <span class="bar__dot" aria-hidden="true"></span>
          <span>Available for work — Sofia, <time>14:30</time></span>
        </div>
      </header>
    </div>`,
};
