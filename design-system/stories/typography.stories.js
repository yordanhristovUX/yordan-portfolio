export default { title: "Typography/Scale" };

export const AllLevels = {
  render: () => `
    <div style="display:grid;gap:var(--space-7)">
      <div><span class="t-label">t-display--hero · --text-display-hero</span><div class="t-display t-display--hero">Yordan</div></div>
      <div><span class="t-label">t-display--xl · --text-display-xl</span><div class="t-display t-display--xl">Let's work</div></div>
      <div><span class="t-label">t-display--lg · --text-display</span><div class="t-display t-display--lg">Municipal Mobile App</div></div>
      <div><span class="t-label">t-title · --text-title</span><div class="t-title">Selected work</div></div>
      <div><span class="t-label">t-statement · --text-title</span><p class="t-statement">People don't behave the way they say they will.</p></div>
      <div><span class="t-label">t-lead · --text-lead</span><p class="t-lead">Before tech: 10+ years in the fitness industry — running a gym, coaching athletes.</p></div>
      <div><span class="t-label">t-kicker · --text-base</span><p class="t-kicker">The gym years left habits the work still runs on:</p></div>
      <div><span class="t-label">t-label · --text-xs</span><p class="t-label">Senior Product Designer</p></div>
    </div>`,
};

/* The ramp itself, not the utilities that wear it. Twelve steps split at body:
   four fixed rem below it (chrome must not resize with the window), seven
   clamped above it (a display line has to survive 375px and 1600px). Resize
   the Storybook canvas and only the lower half of this list moves — that is
   the whole design of the scale, visible in one screen. */
const STEPS = [
  ["--text-2xs", "static", "chips · trace · ▪ bullets · citation ordinals"],
  ["--text-xs", "static", "the standard chrome label: nav, buttons, section numbers"],
  ["--text-sm", "static", "small prose: captions, fact labels, code blocks"],
  ["--text-md", "static", "secondary prose: card copy, list items"],
  ["--text-base", "static", "body"],
  ["--text-lead", "fluid", "the reading lede"],
  ["--text-sub", "fluid", "sub-titles: card title, entry role, case-study h3"],
  ["--text-heading", "fluid", "work-index project names"],
  ["--text-title", "fluid", "section titles and the one statement per section"],
  ["--text-display", "fluid", "dialog title, CV name, stat, fact number"],
  ["--text-display-xl", "fluid", "the contact headline"],
  ["--text-display-hero", "fluid", "the hero name, once per site"],
];

export const Steps = {
  render: () => `
    <div style="display:grid;gap:var(--space-4)">
      ${STEPS.map(
        ([token, kind, use]) => `
        <div style="border-bottom:var(--rule);padding-bottom:var(--space-3)">
          <span class="t-label">${token} · ${kind}</span>
          <div style="font-family:var(--font-display);font-weight:800;font-size:var(${token});line-height:1.1;color:var(--content-primary);overflow:hidden;text-overflow:ellipsis">Grumpy wizards</div>
          <p class="t-kicker" style="margin-top:var(--space-1)">${use}</p>
        </div>`
      ).join("")}
    </div>`,
};
