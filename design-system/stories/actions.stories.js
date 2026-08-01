export default { title: "Components/Actions" };

/* ONE STORY, five buttons. The count is the subject: the defect this block
   replaced was invisible until the row WRAPPED, so a story with two buttons
   would capture the case that already looked right. At the harness's viewport
   these five wrap, and the baseline therefore holds the row gap. */
export const Default = {
  render: () => `
    <div class="actions">
      <a class="btn btn--solid" href="#">GitHub repo ↗</a>
      <a class="btn" href="#">Storybook ↗</a>
      <a class="btn" href="#">Retrieval evaluation →</a>
      <a class="btn" href="#">MCP server →</a>
      <a class="btn" href="#">The Green Street arc →</a>
    </div>`,
};
