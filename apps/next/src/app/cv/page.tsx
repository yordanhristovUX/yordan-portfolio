/* ============================================================
   The CV — the same document as cv.html, from the same corpus.

   PRINT IS THE POINT OF THIS PAGE, and it needs nothing from this file: the
   synced css/cv.css carries the layout half of `@media print` and tokens.css
   carries the colour half (every themed colour has a `print` value beside its
   `dark` one). So there is no print stylesheet here, no colour, and no size —
   the CV prints because the design system says how paper works.

   The section rhythm is the vanilla page's and is deliberately irregular: a
   strip after the head and after Experience, and none between 01/02 or
   03/04/05. Reproduced rather than regularised.
   ============================================================ */
import type { Metadata } from "next";

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

        {/* ============ 01 OPEN SOURCE ============ */}
        <section className="band sec" id={S.openSource.id}>
          <header className="sec__head">
            <h2 className="sec__title t-title">{S.openSource.title}</h2>
            <span className="sec__note">{S.openSource.note}</span>
          </header>
          <div className="well">
            {profile.prose.openSource.map((para) => (
              <p key={para.slice(0, 40)}>{para}</p>
            ))}
            <p className="cv-facts mono">{profile.prose.openSourceFacts}</p>
            <div className="link-grid">
              {CV_OPEN_SOURCE.links.map((l) => (
                <GridLink key={l.label} link={l} />
              ))}
            </div>
            {/* Paper can't be clicked: the buttons above are replaced by their
                URLs in print. */}
            <p className="print-only mono">{CV_OPEN_SOURCE.printUrls}</p>
          </div>
          <Term />
        </section>

        {/* ============ 02 EXPERIENCE ============ */}
        <section className="band sec" id={S.experience.id}>
          <header className="sec__head">
            <h2 className="sec__title t-title">{S.experience.title}</h2>
          </header>
          <div className="well well--flush">
            {experience.map((e) => (
              <article className="entry" key={e.id}>
                <h3 className="entry__role">{e.role}</h3>
                {/* FORMATTED from {start, end, location, mode} by the
                    generator, never authored — the corpus ships the rendering. */}
                <p className="entry__span">{e.span}</p>
                <p className="entry__org">
                  {e.org}
                  {e.descriptor ? <em> — {e.descriptor}</em> : null}
                </p>
                {e.bullets?.length ? (
                  <ul className="entry__list">
                    {e.bullets.map((b) => (
                      <li key={b.slice(0, 40)}>{b}</li>
                    ))}
                  </ul>
                ) : null}
              </article>
            ))}
          </div>
          <Term />
        </section>

        <Strip />

        {/* ============ 03 SKILLS ============ */}
        <section className="band sec" id={S.skills.id}>
          <header className="sec__head">
            <h2 className="sec__title t-title">{S.skills.title}</h2>
          </header>
          <div className="well well--flush">
            <dl className="tools">
              {skillRows("cv").map((row) => (
                <div className="tools__row" key={row.term}>
                  <dt>{row.term}</dt>
                  <dd>{row.text}</dd>
                </div>
              ))}
            </dl>
          </div>
          <Term />
        </section>

        {/* ============ 04 EDUCATION ============
            `·`-joined rows: the separator is formatting, not content — the
            corpus says so in as many words and does not author the joined
            string. */}
        <section className="band sec" id={S.education.id}>
          <header className="sec__head">
            <h2 className="sec__title t-title">{S.education.title}</h2>
          </header>
          <div className="well well--flush">
            <dl className="tools">
              <div className="tools__row">
                <dt>{education.labels.education}</dt>
                <dd>
                  {education.education.map((e) => `${e.qualification} — ${e.institution}`).join(" · ")}
                </dd>
              </div>
              <div className="tools__row">
                <dt>{education.labels.languages}</dt>
                <dd>{education.languages.map((l) => `${l.language} (${l.level})`).join(" · ")}</dd>
              </div>
            </dl>
          </div>
          <Term />
        </section>

        {/* ============ 05 UNEXPECTED ============ */}
        <section className="band sec sec--tint" id={S.facts.id}>
          <header className="sec__head">
            <h2 className="sec__title t-title">{S.facts.title}</h2>
          </header>
          <div className="well">
            <div className="facts">
              {facts.map((f) => (
                <div className="fact" key={f.id}>
                  <span className="fact__title">{f.title}</span>
                  <span className="fact__label">{f.cv?.label ?? f.label}</span>
                </div>
              ))}
            </div>
          </div>
          <Term />
        </section>
      </main>

      <SiteFooter link={FOOTER.cv} />
    </>
  );
}
