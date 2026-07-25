---
{
  "id": "greenstreet-audit",
  "index": 2,
  "client": "Green Street",
  "title": "UX & Accessibility Audits",
  "hasCaseStudy": true,

  "tags": ["Senior Product Designer", "Accessibility", "UX Audit", "WCAG 2.1 AA", "Two products"],
  "accentTag": "WCAG 2.1 AA",

  "indexTags": ["Accessibility", "Audit", "WCAG AA"],

  "metrics": [
    { "value": "200+", "label": "Issue instances catalogued", "kind": "count" }
  ],
  "links": [],
  "media": [
    { "slot": "cover", "caption": "Cover — annotated audit findings, 1600×900" },
    { "slot": "findings", "caption": "Findings report — severity ratings" },
    { "slot": "figma-docs", "caption": "Annotated Figma documentation" }
  ]
}
---

## Summary {#summary}

WCAG 2.1 AA audits of two product surfaces — editorial and data-dense analytics. 200+ issue
instances catalogued with severity ratings and a prioritised remediation roadmap.

## Subtitle {#subtitle}

End-to-end WCAG 2.1 AA audits of two distinct product surfaces — an editorial platform and a
data-dense analytics platform — with severity-rated, annotated remediation roadmaps.

## Why it matters here {#context}

Green Street's users are professional analysts, investors, and brokers making high-stakes
financial decisions — many across multiple screens for hours, some with assistive
technologies. For a data company, an unlabelled filter or a contrast failure isn't just an
accessibility issue. It's a credibility gap.

## Green Street News — editorial {#approach}

- **Colour contrast** — systematic review against WCAG 2.1 AA thresholds across article
  bodies, bylines, timestamps, and navigation.
- **Semantic structure** — heading hierarchy that means something to a screen reader, not just
  visually.
- **Keyboard navigation** — focus traps, missing indicators, mouse-only elements.
- **Labelling** — icon-only buttons, ambiguous "read more" links, unlabelled form controls.

## Analytics & Research Platform — data-dense {#approach}

- **Data tables** — header scope, captions, sortable column accessibility, nested headers.
- **Charts** — text alternatives, colour-only encoding, keyboard-accessible data views.
- **Filters & faceted search** — keyboard operability, focus management, live region
  announcements.
- **Dynamic content** — explicit focus management for async loading, panels, and modals.
- **Full AA sweep** — criterion-by-criterion review of all 50 AA success criteria.

## Deliverables {#outcome}

{{metric:0}}

Issue instances catalogued across the two surfaces. Every finding documented with a severity
rating (Critical / Major / Minor), WCAG criterion reference, annotated screenshot, recommended
fix, and estimated engineering effort — plus a mapping to the platform workflow it affects, so
engineering unblocks the most-used analytical paths first. The output is a prioritised
remediation roadmap, not a list of complaints.

{{media-grid:findings,figma-docs}}

## Outcomes {#outcome}

- Both products now have a clear, actionable roadmap to WCAG 2.1 AA compliance.
- Cross-product observations shaped component prioritisation in the AI-ready design system —
  the most inconsistent patterns became the first to be standardised.
- A repeatable audit methodology for every new product surface as the platform grows.
