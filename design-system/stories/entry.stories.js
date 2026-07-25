export default { title: "Components/Entry" };

const entry = ({ role, span, org, note, items = [] }) => `
  <article class="entry">
    <h3 class="entry__role">${role}</h3>
    <p class="entry__span">${span}</p>
    ${org ? `<p class="entry__org">${org}${note ? ` <em>— ${note}</em>` : ""}</p>` : ""}
    ${items.length ? `<ul class="entry__list">${items.map((i) => `<li>${i}</li>`).join("")}</ul>` : ""}
  </article>`;

export const Default = {
  render: () =>
    entry({
      role: "Senior Product Designer",
      span: "Jan 2026 – Present · Sofia",
      org: "Green Street",
      note: "commercial real estate data and analytics",
      items: [
        "Redesigned the AI Assistant module and built its design system end to end.",
        "Tokens implemented in the frontend component library for <strong>100% token coverage</strong> across the module.",
      ],
    }),
};

/* No bullets and no org — the shape education takes. */
export const Minimal = {
  render: () => entry({ role: "UX/UI Design", span: "Telerik Academy" }),
};

/* The case the dates column exists for: several entries in a row, where the
   spans should form a scannable edge rather than being hunted for in prose. */
export const Stacked = {
  render: () => `
    <div class="well well--flush">
      ${entry({
        role: "Senior Product Designer",
        span: "Jan 2026 – Present",
        org: "Green Street",
        items: ["Shipped the responsive navigation for the Analytics platform, reviewed and merged by engineering."],
      })}
      ${entry({
        role: "Senior Product Designer",
        span: "2023 – Dec 2025",
        org: "Studio Kipo",
        note: "sole designer for all client work",
        items: ["Introduced design systems as studio practice. No client asked for one."],
      })}
      ${entry({
        role: "UX Researcher & Consultant",
        span: "2019 – Present",
        org: "Domestina",
        items: ["Bounce rate dropped <strong>40%</strong> after a rebuild of the front page and booking flows."],
      })}
    </div>`,
};

/* A long span must wrap, not crush the role — the layout rule most likely
   to be broken by someone adding a qualifier to a date. */
export const LongSpan = {
  render: () =>
    entry({
      role: "UX Researcher & Consultant",
      span: "2019 – Present · advisory since 2022 · Sofia",
      org: "Domestina",
      items: ["Still consulting on research and flow decisions."],
    }),
};
