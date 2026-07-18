import flat from "../dist/tokens.flat.json";

export default { title: "Tokens/All tokens" };

const groups = {};
for (const [key, t] of Object.entries(flat)) {
  const cat = key.split(".")[0];
  (groups[cat] ??= []).push({ key, ...t });
}

const isColor = (v) => /^(#|rgb|hsl)/.test(v);

function row(t) {
  const shown = t.resolved ?? t.value;
  const swatch = isColor(shown)
    ? `<span style="display:inline-block;width:2.5rem;height:1.5rem;background:${shown};border:1px solid var(--chrome-border);vertical-align:middle"></span>`
    : "";
  return `<tr>
    <td style="padding:.45rem .75rem;border-bottom:1px solid var(--chrome-border)"><code>${t.cssVar}</code></td>
    <td style="padding:.45rem .75rem;border-bottom:1px solid var(--chrome-border)">${swatch}</td>
    <td style="padding:.45rem .75rem;border-bottom:1px solid var(--chrome-border);font-family:var(--font-mono);font-size:.75rem">${t.value}${t.resolved ? ` <span style="color:var(--content-muted)">→ ${t.resolved}</span>` : ""}</td>
  </tr>`;
}

export const Reference = {
  render: () =>
    Object.entries(groups)
      .map(
        ([cat, tokens]) => `
        <h3 class="t-label" style="margin:1.75rem 0 .5rem">${cat}</h3>
        <table style="border-collapse:collapse;width:100%;max-width:60rem">${tokens.map(row).join("")}</table>`
      )
      .join(""),
};
