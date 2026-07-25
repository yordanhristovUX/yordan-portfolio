---
{
  "id": "green-street",
  "order": 1,
  "role": "Senior Product Designer",
  "org": "Green Street",
  "descriptor": "commercial real estate data and analytics",
  "period": { "start": "2026-01", "end": null, "location": "Sofia", "mode": "Hybrid" },
  "projects": ["greenstreet-ds", "greenstreet-audit"]
}
---

## Highlights {#outcome}

- Redesigned the AI Assistant module and built its design system end to end: a Figma library at
  1:1 parity with the coded components (**~35 and growing**), tokens implemented directly in
  the frontend component library replacing every hardcoded value for **100% token coverage**,
  and a living style guide used for visual testing and design-to-code comparison.
- Wrote custom Claude skills that let AI agents assemble UI from the real design system without
  drift. The TPM team uses them to generate interactive prototypes.
- Wrote and shipped the responsive navigation for the Analytics platform — reviewed and merged
  by engineering, live in production.
- Audited Green Street News and the Analytics & Research Platform against WCAG 2.1 AA and UX
  heuristics: **200+ issue instances** catalogued with severity ratings and a prioritised
  remediation roadmap.
- Building a design-to-code pipeline that generates frontend pages from Figma with AI
  assistance. The internal version is under NDA; the open-source system above is the same
  architecture, public.
