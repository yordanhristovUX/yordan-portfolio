---
{
  "id": "greenstreet-audit",
  "index": 3,
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

UX and WCAG 2.1 AA audits of two product surfaces: an editorial platform and a data-dense
analytics platform. 200+ issue instances covering accessibility, consistency, visual
hierarchy, and UI patterns, ordered into a remediation roadmap.

## Subtitle {#subtitle}

End-to-end UX and accessibility audits of an editorial platform and a data-dense analytics
platform: WCAG 2.1 AA compliance plus consistency, hierarchy, layout, and pattern choice,
delivered as severity-rated, annotated remediation roadmaps.

## Why it matters here {#context}

Green Street's users are professional analysts, investors, and brokers making high-stakes
financial decisions. Many work across multiple screens for hours; some use assistive
technologies. For a data company, an unlabelled filter or a contrast failure is a
credibility gap.

## Green Street News: the editorial platform {#approach}

- **Colour contrast.** Systematic review against WCAG 2.1 AA thresholds across article
  bodies, bylines, timestamps, and navigation.
- **Semantic structure.** Heading hierarchy that reads correctly in a screen reader, not only
  on the page.
- **Keyboard navigation.** Focus traps, missing indicators, mouse-only elements.
- **Labelling.** Icon-only buttons, ambiguous "read more" links, unlabelled form controls.

## Analytics & Research Platform: data-dense {#approach}

- **Data tables.** Header scope, captions, sortable column accessibility, nested headers.
- **Charts.** Text alternatives, colour-only encoding, keyboard-accessible data views.
- **Filters and faceted search.** Keyboard operability, focus management, live region
  announcements.
- **Dynamic content.** Explicit focus management for async loading, panels, and modals.
- **Full AA sweep.** A criterion-by-criterion review of all 50 success criteria that apply at
  Level AA.

## The UX track {#approach}

Accessibility was one lens. The other was UX and UI quality across both products:
consistency of components and styles, colour and typography hierarchy, layout, and the
choice of UI patterns. This is where the drift showed at its clearest: the audit catalogued
16 variations of the primary button alone, and the most inconsistent patterns later became
the first components standardised in the design system.

## Deliverables {#outcome}

{{metric:0}}

Issue instances catalogued across the two surfaces. Every finding carries a severity rating
(Critical / Major / Minor), an annotated screenshot, a recommended fix, and an estimate of
engineering effort; accessibility findings also cite the WCAG criterion they fail. Each
finding is mapped to the platform workflow it affects, so engineering unblocks the most-used
analytical paths first. The output is a prioritised remediation roadmap, not a list of
complaints.

{{media-grid:findings,figma-docs}}

## Outcomes {#outcome}

- Both products have a clear, actionable roadmap to WCAG 2.1 AA compliance.
- Cross-product observations shaped component prioritisation in the AI-ready design system:
  the most inconsistent patterns became the first to be standardised.
- A repeatable audit methodology for every new product surface as the platform grows.
- Once the design system lands, accessibility stops being an audit finding and becomes a
  build-time guarantee: every component passes its accessibility checks before it can ship,
  enforced by CI gates.
