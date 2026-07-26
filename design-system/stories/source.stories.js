export default { title: "Components/Source" };

/* Citations. Every id below reached the page only because
   validateProvenance confirmed a tool actually returned it during that
   turn — referential validity is not enough, since the corpus is small
   enough for a model to guess a well-formed, resolvable, entirely unread
   id. There is no "unverified source" state to design: it never renders. */

const source = (n, label, id, tag = "button") =>
  tag === "button"
    ? `<li class="source">
         <span class="source__ref mono">${n}</span>
         <button class="source__link" type="button">${label}</button>
         <span class="source__id mono">${id}</span>
       </li>`
    : `<li class="source">
         <span class="source__ref mono">${n}</span>
         <a class="source__link" href="#top">${label}</a>
         <span class="source__id mono">${id}</span>
       </li>`;

const list = (items) => `
  <div class="sources">
    <p class="sources__title mono">Sources</p>
    <ol class="sources__list">${items}</ol>
  </div>`;

/* A project chunk opens the real case dialog, so its citation is a
   button. A profile chunk navigates, so its citation is an anchor. */
export const Mixed = {
  name: "Project + profile citations",
  render: () =>
    `<div class="well" style="max-width:52rem">${list(
      source(1, "Green Street &mdash; AI-Ready Design System &mdash; Approach", "project:greenstreet-ds#approach-1") +
        source(2, "Green Street &mdash; AI-Ready Design System &mdash; Outcomes", "project:greenstreet-ds#outcome") +
        source(3, "Profile &mdash; Background", "profile#background", "a")
    )}</div>`,
};

export const Single = {
  name: "Single citation",
  render: () =>
    `<div class="well" style="max-width:52rem">${list(
      source(1, "Domestina.bg &mdash; Cleaning Service Marketplace &mdash; Summary", "project:domestina#summary")
    )}</div>`,
};

/* Chunk ids are long by design — `entity#kind-ordinal` — and the row must
   wrap rather than push the answer column wide. */
export const LongIds = {
  name: "Long ids wrap, never widen",
  render: () =>
    `<div class="well" style="max-width:26rem">${list(
      source(1, "Municipality of Malko Tarnovo &mdash; Municipal Mobile App &mdash; System", "project:malko-tarnovo#system-2") +
        source(2, "Spetema Coffee &mdash; Product &amp; Corporate Website &mdash; Approach", "project:spetema#approach-1") +
        source(3, "Experience &mdash; Studio Kipo", "experience:studio-kipo#bullets", "a")
    )}</div>`,
};

/* In context: the sources block is always last inside .chat__answer. */
export const InAnswer = {
  name: "In an answer",
  render: () => `
    <div class="well" style="max-width:52rem">
      <div class="chat__answer">
        <p class="chat__prose">The audit covered two product surfaces and produced a severity-rated
        remediation roadmap for each.</p>
        <p class="chat__metric"><span class="stat">200+</span>Issue instances catalogued</p>
        ${list(
          source(1, "Green Street &mdash; UX &amp; Accessibility Audits &mdash; Summary", "project:greenstreet-audit#summary") +
            source(2, "Green Street &mdash; UX &amp; Accessibility Audits &mdash; Outcomes", "project:greenstreet-audit#outcome-1")
        )}
      </div>
    </div>`,
};
