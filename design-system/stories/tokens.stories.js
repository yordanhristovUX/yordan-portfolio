import flat from "../dist/tokens.flat.json";

export default { title: "Tokens/All tokens" };

const groups = {};
for (const [key, t] of Object.entries(flat)) {
  const cat = key.split(".")[0];
  (groups[cat] ??= []).push({ key, ...t });
}

const isColor = (v) => /^(#|rgb|hsl)/.test(v);

const cell = "padding:.45rem .75rem;border-bottom:1px solid var(--chrome-border)";
const mono = "font-family:var(--font-mono);font-size:.75rem";

const swatch = (v) =>
  isColor(v)
    ? `<span style="display:inline-block;width:2.5rem;height:1.5rem;background:${v};border:1px solid var(--chrome-border);vertical-align:middle"></span>`
    : "";

function row(t) {
  const light = t.resolved ?? t.value;
  const dark = t.darkResolved ?? t.dark ?? light;
  // A token that never changes is worth showing as unchanged rather than
  // blank — "themed" and "not themed" are both facts about a token.
  const themed = dark !== light;
  return `<tr>
    <td style="${cell}"><code>${t.cssVar}</code></td>
    <td style="${cell}">${swatch(light)}</td>
    <td style="${cell};${themed ? "" : "opacity:.35"}">${swatch(dark)}</td>
    <td style="${cell};${mono}">
      ${t.value}${t.resolved ? ` <span style="color:var(--content-muted)">→ ${t.resolved}</span>` : ""}
      ${themed ? `<br><span style="color:var(--accent)">dark: ${t.dark ?? "(via alias)"}${t.darkResolved ? ` → ${t.darkResolved}` : ""}</span>` : ""}
    </td>
  </tr>`;
}

const head = `<tr>
  <th style="${cell};text-align:left" class="t-label">Token</th>
  <th style="${cell};text-align:left" class="t-label">Light</th>
  <th style="${cell};text-align:left" class="t-label">Dark</th>
  <th style="${cell};text-align:left" class="t-label">Value</th>
</tr>`;

export const Reference = {
  render: () =>
    Object.entries(groups)
      .map(
        ([cat, tokens]) => `
        <h3 class="t-label" style="margin:1.75rem 0 .5rem">${cat}</h3>
        <table style="border-collapse:collapse;width:100%;max-width:60rem">${head}${tokens
          .map(row)
          .join("")}</table>`
      )
      .join(""),
};

/* The themed tokens on their own — the whole surface area of dark mode in
   one screen, which is the point worth making: it is a short list. */
export const ThemedOnly = {
  render: () => {
    const themed = Object.values(groups)
      .flat()
      .filter((t) => (t.darkResolved ?? t.dark) !== undefined);
    return `
      <h3 class="t-label" style="margin:0 0 .5rem">${themed.length} tokens change between themes</h3>
      <p class="t-kicker" style="margin-bottom:1.25rem">Everything else — the raw ramps, fonts, spacing — is theme-independent. Tokens marked <em style="color:var(--accent)">(via alias)</em> carry no dark value of their own; they inherit one by pointing at a token that does.</p>
      <table style="border-collapse:collapse;width:100%;max-width:60rem">${head}${themed
        .map(row)
        .join("")}</table>`;
  },
};
