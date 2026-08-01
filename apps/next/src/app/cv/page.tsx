/* ============================================================
   The CV — the same document as cv.html, from the same corpus.

   PRINT IS THE POINT OF THIS PAGE, and it needs nothing from this file: the
   synced css/cv.css carries the layout half of `@media print` and tokens.css
   carries the colour half (every themed colour has a `print` value beside its
   `dark` one). So there is no print stylesheet here, no colour, and no size —
   the CV prints because the design system says how paper works.

   The section rhythm is the vanilla page's and is deliberately irregular: a
   strip after the head and after Skills, and none between 01/02 or 03/04/05.
   The strips hold structural positions, so they did not travel with the
   sections when the owner reordered them. Reproduced rather than regularised.

   PRINT IS ALSO WHY THIS PAGE KEEPS THE MOST DESIGN-SYSTEM CLASSES OF ANY OF
   THE FIVE. css/cv.css's `@media print` block is the largest single consumer
   of them in the repo: it hides `.bar`, `.drawer`, `.foot`, `.link-grid` and
   `.fact__label`, rewrites `.sec__head`, `.entry`, `.entry__list`, `.facts`,
   `.fact`, `.fact__num` and `.fact__title`, and it is a page stylesheet — the
   one thing on this surface this app may not edit. So every one of those names
   stays on its element beside the generated component that now renders it.
   README.md states the rule once; this page is where it earns its keep.
   ============================================================ */
import type { Metadata } from "next";
import { DefinitionRow, DefinitionRowRow } from "@yordan/design-system/react/definition-row";
import { Entry, EntryList, EntryOrg, EntryRole, EntrySpan } from "@yordan/design-system/react/entry";
import { Fact, FactFact, FactLabel, FactTitle } from "@yordan/design-system/react/fact";
import { LinkGrid } from "@yordan/design-system/react/link-grid";
import {
  SectionHead,
  SectionHeadHead,
  SectionHeadNote,
  SectionHeadTitle,
} from "@yordan/design-system/react/section-head";

import { PrintButton } from "@/components/PrintButton";
import { GridLink, Strip, Term } from "@/components/primitives";
import { SiteBar } from "@/components/SiteBar";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteMenu } from "@/components/SiteMenu";
import { education, experience, facts, profile, siteUrl, skillRows } from "@/lib/content";
import {
  CV_BAR,
  CV_MENU_NAV,
  CV_META,
  CV_OPEN_SOURCE,
  CV_SECTIONS,
  FOOTER,
} from "@/lib/vanilla-copy";

import "@/styles/site/cv.css";

export const metadata: Metadata = {
  title: CV_META.title,
  description: CV_META.description,
  alternates: { canonical: "/cv" },
  openGraph: {
    title: CV_META.ogTitle,
    description: CV_META.ogDescription,
    type: "profile",
    url: `${siteUrl}/cv`,
  },
  twitter: { card: "summary" },
};

export default function Page() {
  const S = CV_SECTIONS;
  const contact = profile.contact;
  /* The site is listed by its own address with the scheme dropped — a
     rendering of `contact.site`, not a second copy of it. */
  const siteLabel = contact.site.replace(/^https?:\/\//, "").replace(/\/$/, "");

  return (
    <>
      <SiteBar
        id={CV_BAR.id}
        nav={[...CV_BAR.nav]}
        /* PRIMARY ACTION BEFORE UTILITY, which is the bar's stated order on
           every page. Print carries no `data-ask`: it is not the chat, so it
           keeps its segment on mobile. */
        action={<PrintButton />}
      />
      <SiteMenu nav={CV_MENU_NAV} />

      <main id="top" className="sheet">
        {/* ============ HEAD ============ */}
        <section className="band cv-head" aria-label={profile.identity.name}>
          <div className="well">
            <p className="cv-head__role t-label">{profile.identity.role}</p>
            <h1 className="cv-head__name t-display t-display--lg">{profile.identity.name}</h1>
            <p className="cv-head__disciplines mono">{profile.identity.disciplines.join(" · ")}</p>

            <ul className="cv-contact mono" role="list">
              <li>
                <a href={`mailto:${contact.email}`}>{contact.email}</a>
              </li>
              <li>
                <a href={contact.phoneHref}>{contact.phone}</a>
              </li>
              <li>
                <a href={contact.site}>{siteLabel}</a>
              </li>
              <li>
                <a href={contact.linkedin} target="_blank" rel="noopener">
                  {contact.linkedinLabel}
                </a>
              </li>
              <li>{profile.identity.location.full}</li>
            </ul>

            <p className="cv-summary t-lead">{profile.prose.cvSummary}</p>
          </div>
          <Term />
        </section>

        <Strip />

        {/* ============ 01 EXPERIENCE ============ */}
        <SectionHead className="band sec" id={S.experience.id}>
          <SectionHeadHead className="sec__head">
            <SectionHeadTitle className="t-title">{S.experience.title}</SectionHeadTitle>
          </SectionHeadHead>
          <div className="well well--flush">
            {experience.map((e) => (
              /* `.entry` and `.entry__list` are cv.css's on paper; `.entry`
                 and `.entry__span` are additionally the drawer's, which
                 re-lays-out an entry it hosts by name. `.entry__role` and
                 `.entry__org` are named by nothing else and left. */
              <Entry className="entry" key={e.id}>
                <EntryRole>{e.role}</EntryRole>
                {/* FORMATTED from {start, end, location, mode} by the
                    generator, never authored — the corpus ships the rendering. */}
                <EntrySpan className="entry__span">{e.span}</EntrySpan>
                <EntryOrg>
                  {e.org}
                  {e.descriptor ? <em> — {e.descriptor}</em> : null}
                </EntryOrg>
                {e.bullets?.length ? (
                  <EntryList className="entry__list">
                    {e.bullets.map((b) => (
                      <li key={b.slice(0, 40)}>{b}</li>
                    ))}
                  </EntryList>
                ) : null}
              </Entry>
            ))}
          </div>
          <Term />
        </SectionHead>

        {/* ============ 02 SKILLS ============ */}
        <SectionHead className="band sec" id={S.skills.id}>
          <SectionHeadHead className="sec__head">
            <SectionHeadTitle className="t-title">{S.skills.title}</SectionHeadTitle>
          </SectionHeadHead>
          <div className="well well--flush">
            <DefinitionRow>
              {skillRows("cv").map((row) => (
                <DefinitionRowRow className="tools__row" key={row.term}>
                  <dt>{row.term}</dt>
                  <dd>{row.text}</dd>
                </DefinitionRowRow>
              ))}
            </DefinitionRow>
          </div>
          <Term />
        </SectionHead>

        <Strip />

        {/* ============ 03 OPEN SOURCE ============ */}
        <SectionHead className="band sec" id={S.openSource.id}>
          <SectionHeadHead className="sec__head">
            <SectionHeadTitle className="t-title">{S.openSource.title}</SectionHeadTitle>
            <SectionHeadNote>{S.openSource.note}</SectionHeadNote>
          </SectionHeadHead>
          <div className="well">
            {profile.prose.openSource.map((para) => (
              <p key={para.slice(0, 40)}>{para}</p>
            ))}
            <p className="cv-facts mono">{profile.prose.openSourceFacts}</p>
            {/* `.link-grid` is spaced by `#open-source .link-grid` in cv.css
                and hidden by its print block. */}
            <LinkGrid className="link-grid">
              {CV_OPEN_SOURCE.links.map((l) => (
                <GridLink key={l.label} link={l} />
              ))}
            </LinkGrid>
            {/* Paper can't be clicked: the buttons above are replaced by their
                URLs in print. */}
            <p className="print-only mono">{CV_OPEN_SOURCE.printUrls}</p>
          </div>
          <Term />
        </SectionHead>

        {/* ============ 04 EDUCATION ============
            `·`-joined rows: the separator is formatting, not content — the
            corpus says so in as many words and does not author the joined
            string. */}
        <SectionHead className="band sec" id={S.education.id}>
          <SectionHeadHead className="sec__head">
            <SectionHeadTitle className="t-title">{S.education.title}</SectionHeadTitle>
          </SectionHeadHead>
          <div className="well well--flush">
            <DefinitionRow>
              <DefinitionRowRow className="tools__row">
                <dt>{education.labels.education}</dt>
                <dd>
                  {education.education.map((e) => `${e.qualification} — ${e.institution}`).join(" · ")}
                </dd>
              </DefinitionRowRow>
              <DefinitionRowRow className="tools__row">
                <dt>{education.labels.languages}</dt>
                <dd>{education.languages.map((l) => `${l.language} (${l.level})`).join(" · ")}</dd>
              </DefinitionRowRow>
            </DefinitionRow>
          </div>
          <Term />
        </SectionHead>

        {/* ============ 05 UNEXPECTED ============ */}
        <SectionHead variant="tint" className="band sec" id={S.facts.id}>
          <SectionHeadHead className="sec__head">
            <SectionHeadTitle className="t-title">{S.facts.title}</SectionHeadTitle>
          </SectionHeadHead>
          <div className="well">
            <Fact className="facts">
              {facts.map((f) => (
                <FactFact className="fact" key={f.id}>
                  <FactTitle className="fact__title">{f.title}</FactTitle>
                  <FactLabel className="fact__label">{f.cv?.label ?? f.label}</FactLabel>
                </FactFact>
              ))}
            </Fact>
          </div>
          <Term />
        </SectionHead>
      </main>

      <SiteFooter link={FOOTER.cv} />
    </>
  );
}
