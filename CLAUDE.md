# Blueprint portfolio

Static site (no build step) + its design system.

**Before touching any UI, read `design-system/README.md`.** In short:

- All colours/fonts/spacing come from `design-system/tokens/tokens.json` → run
  `npm run build` in `design-system/` after token edits. Never write raw palette values in
  CSS — semantic variables only.
- Every component = CSS block + `spec.md` + story (the DS build enforces this).
- `css/style.css` is page layout ONLY; component styles belong in
  `design-system/css/components.css`.
- Figma sync is one-way repo → Figma: `design-system/figma/push-guide.md`.
- Storybook: `npm run storybook` in `design-system/` (port 6006).
- `generated/` is a read-only reference (the complex design system this one simplifies) —
  never edit or build it.
