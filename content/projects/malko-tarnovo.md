---
{
  "id": "malko-tarnovo",
  "index": 5,
  "client": "Municipality of Malko Tarnovo",
  "indexClient": "Malko Tarnovo",
  "title": "Municipal Mobile App",
  "hasCaseStudy": true,

  "tags": ["Product Designer", "Shipped", "Design System", "iOS & Android", "White-label", "Accessibility"],
  "accentTag": "Shipped",

  "indexTags": ["Shipped", "iOS & Android", "Tokens"],

  "metrics": [],
  "links": [
    {
      "label": "View on the App Store ↗",
      "href": "https://apps.apple.com/bg/app/malko-tarnovo-municipality/id6742865585",
      "variant": "solid",
      "external": true
    }
  ],
  "media": [
    { "slot": "cover", "caption": "Cover — app screens on device, 1600×900" },
    { "slot": "tourism", "caption": "Tourism flow — green context" },
    { "slot": "municipal", "caption": "Municipal services — blue context" }
  ]
}
---

## Summary {#summary}

Civic app serving tourists and older residents at once. White-label token system. Live on the
App Store and Google Play.

## Subtitle {#subtitle}

End-to-end design of a cross-platform civic app serving two opposing audiences, tourists and
older residents, live on the App Store and Google Play.

## The challenge {#problem}

Malko Tarnovo is a small municipality in southeast Bulgaria, known for its nature reserves,
historical sites, and an older resident population. Its app had to serve two audiences with
almost opposing needs. **Tourists** are explorers: they want visual richness, maps, and
discovery flows. **Local residents**, many of them older, need municipal services: waste
schedules, announcements, contacts, with large touch targets, minimal cognitive load, and
zero ambiguity.

## Information architecture {#approach}

Research started with how similar municipal apps handle the tourist and resident split,
stakeholder interviews about the most-used services, and a map of the municipality's existing
communications. The resulting information architecture separates the two content domains at
the top level while sharing one navigation pattern and one component library. Users
self-select into a context, tourism or municipal services, and the app never forces them to
declare which they are. The structure was validated with card sorting and flow walkthroughs
before any visual design.

## The dual colour logic {#approach}

**Green** encodes everything tourism: nature reserves, trails, gastronomy, connecting to the
Strandzha region's identity. **Blue** encodes everything administrative, carrying the
institutional calm of government services.

The colour is a wayfinding system, not decoration. A user glancing at a card knows whether it
is a tourist recommendation or a municipal service before reading a word. For older users,
colour becomes a cognitive shortcut. And because the logic lives in semantic tokens rather
than hardcoded values, the entire system can be recoloured for another municipality without
touching a component.

## White-label design system {#system}

- **Semantic colour tokens.** Primary, secondary, surface, border, and status colours as
  variables. Swap the green and blue for any municipality's brand and the change cascades
  through the whole system.
- **Spacing and rounding tokens.** One spacing scale for every padding, margin, and gap, and
  radius values as variables, so the app's character can shift from rounded and friendly to
  sharp and institutional with a single change.
- **Typography system.** Comfortaa, tokenised scale, friendly enough for tourism and readable
  enough for official communications.
- **Icon system.** The municipal logo redesigned on a 64×80 grid aligned to the layout grid,
  coherent from app icon to in-app header.

## Accessibility by default {#system}

- Touch targets at or above 44×44px throughout, the WCAG AAA target size, to accommodate
  older users.
- WCAG 2.1 AA contrast across both colour contexts.
- Hierarchy through size, weight, and spacing, never colour alone.
- Progressive disclosure for dense municipal content: summary cards that expand, not long
  scrolling pages.

{{media-grid:tourism,municipal}}

## Components, not compositions {#approach}

Every screen was built from components rather than one-off compositions, so a component
change propagated across all screens and the developer handoff was a component map instead of
static images. A fully interactive Figma prototype covered the primary flows for both
audiences and served stakeholder review, developer reference, and a final usability
walkthrough before handoff.

## Outcomes {#outcome}

Launched on iOS and Android, publicly available on both stores. The white-label system is a
reusable product: any Bulgarian municipality can deploy it with brand-token changes alone.
The dual colour logic became a reference model for designing civic services for mixed-age
audiences.

{{links}}
