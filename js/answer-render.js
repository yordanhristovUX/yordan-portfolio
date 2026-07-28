/* ============================================================
   Answer blocks → design-system markup.

   The spine of the accuracy story, on the client side:
   `prose` is the ONLY block that carries model-authored text. Every
   other block names content by id, and this file renders it from
   content/dist/content.json — the same source the page itself was
   generated from. The model composes an answer; it does not restate
   facts. So a date on screen came out of content/, not out of a model.

   Two rules that are not style preferences:

     1. `prose` is written with textContent, NEVER innerHTML. The output
        schema already means the model cannot emit markup; this makes it
        true twice.
     2. An id that does not resolve renders NOTHING. The server already
        dropped unresolvable ids (gate 2); if one reaches here the page
        stays silent rather than inventing a placeholder.

   Vanilla, classic `defer`, no modules, no bundler — the same IIFE
   shape as js/main.js. Exposes window.AnswerRender.
   ============================================================ */
(() => {
  const CORPUS_URL = "content/dist/content.json";

  let corpus = null;
  let loading = null;

  /* ---------- Index once, resolve in O(1) ---------- */
  function index(json) {
    return {
      raw: json,
      project: new Map(json.projects.map((p) => [p.id, p])),
      experience: new Map(json.experience.map((e) => [e.id, e])),
      fact: new Map(json.facts.map((f) => [f.id, f])),
      profileTerm: new Map(json.profile.rows.map((r) => [r.term, r])),
      /* Chunk ids are unique as of the id-scheme fix, but a Map keeps
         this indifferent to that: first wins, and both chunks sharing an
         id would carry the same citation anyway. */
      chunk: (() => {
        const m = new Map();
        for (const c of json.chunks) if (!m.has(c.id)) m.set(c.id, c);
        return m;
      })(),
    };
  }

  function load() {
    if (corpus) return Promise.resolve(corpus);
    if (loading) return loading;
    loading = fetch(CORPUS_URL, { credentials: "same-origin" })
      .then((r) => {
        if (!r.ok) throw new Error("content.json " + r.status);
        return r.json();
      })
      .then((json) => (corpus = index(json)))
      .catch((err) => {
        loading = null;
        throw err;
      });
    return loading;
  }

  /* ---------- Element helpers ---------- */
  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };
  const frag = () => document.createDocumentFragment();

  /* ---------- Blocks ---------- */

  /* prose — the one block with the model's own words. Text only. */
  function renderProse(b) {
    return el("p", "chat__prose", b.text);
  }

  /* project — a real .idx__row that opens the REAL case dialog.
     js/main.js owns that dialog, its focus trap and its rail rebuild;
     building a second one here would be the bug this reuses its way out
     of. See design-system/components/row/spec.md for the markup. */
  function renderProject(b) {
    const p = corpus.project.get(b.id);
    if (!p) return null;

    const openable = Boolean(p.hasCaseStudy) && typeof window.openCase === "function";
    const out = frag();

    /* `why` is model-authored — one clause on why this project answers
       the question. It is prose, so it is text, and it sits outside the
       row rather than replacing the row's own authored summary. */
    if (b.why) out.appendChild(el("p", "chat__why", b.why));

    const list = el("ul", "idx");
    list.setAttribute("role", "list");
    const li = el("li");
    const row = document.createElement(openable ? "button" : "div");
    row.className = "idx__row";
    if (openable) {
      row.type = "button";
      row.dataset.project = p.id;
      row.addEventListener("click", () => window.openCase(p.id));
    }

    row.appendChild(el("span", "idx__no mono", String(p.index ?? "").padStart(2, "0")));

    const main = el("span", "idx__main");
    const name = el("span", "idx__name");
    /* `.idx__name` is always `Client <em>— Project</em>` (row spec). */
    name.appendChild(document.createTextNode((p.indexClient || p.client || p.title) + " "));
    if (p.client || p.indexClient) name.appendChild(el("em", null, "— " + (p.indexTitle || p.title)));
    main.appendChild(name);
    main.appendChild(el("span", "idx__desc", p.summary));
    row.appendChild(main);

    const tags = el("span", "idx__tags");
    for (const t of (p.indexTags || p.tags || []).slice(0, 3)) tags.appendChild(el("span", "chip", t));
    row.appendChild(tags);

    if (openable) {
      const go = el("span", "idx__go mono", "View →");
      go.setAttribute("aria-hidden", "true");
      row.appendChild(go);
    }

    li.appendChild(row);
    list.appendChild(li);
    out.appendChild(list);
    return out;
  }

  /* experience — the real CV entry. See components/entry/spec.md:
     source order is role → span → org, which is the reading order. */
  function renderExperience(b) {
    const e = corpus.experience.get(b.entryId);
    if (!e) return null;

    const art = el("article", "entry");
    art.appendChild(el("h3", "entry__role", e.role));
    art.appendChild(el("p", "entry__span", e.span));

    const org = el("p", "entry__org");
    org.appendChild(document.createTextNode(e.org + " "));
    if (e.descriptor) org.appendChild(el("em", null, "— " + e.descriptor));
    art.appendChild(org);

    if (e.bullets?.length) {
      const ul = el("ul", "entry__list");
      for (const line of e.bullets) ul.appendChild(el("li", null, line));
      art.appendChild(ul);
    }
    return art;
  }

  /* facts — the profile <dl>. Term ids are profile rows ("Focus") or
     personal fact ids ("endurance"); the two sets are disjoint. */
  function renderFacts(b) {
    const dl = el("dl", "profile mono");
    let n = 0;
    for (const id of b.termIds) {
      const row = corpus.profileTerm.get(id);
      const fact = row ? null : corpus.fact.get(id);
      if (!row && !fact) continue;
      const div = el("div");
      div.appendChild(el("dt", null, row ? row.term : fact.title));
      const dd = el(
        "dd",
        row && /^open/i.test(row.value) ? "is-ok" : null,
        row ? row.value : fact.value + (fact.unit ? " " + fact.unit : "") + " — " + fact.label
      );
      div.appendChild(dd);
      dl.appendChild(div);
      n++;
    }
    return n ? dl : null;
  }

  /* metric — the framed headline number, inside prose. stat/spec.md. */
  function renderMetric(b) {
    const p = corpus.project.get(b.projectId);
    const m = p?.metrics?.[b.metricIndex];
    if (!m) return null;
    const para = el("p", "chat__metric");
    para.appendChild(el("span", "stat", m.value));
    para.appendChild(document.createTextNode(m.label));
    return para;
  }

  /* tags — chips. The spec allows at most one `--solid` per group, and
     nothing here has earned emphasis, so none of them get it. */
  function renderTags(b) {
    const wrap = el("div", "chips");
    let n = 0;
    for (const label of b.labels) {
      wrap.appendChild(el("span", "chip", label));
      n++;
    }
    return n ? wrap : null;
  }

  /* links — link-grid. Ids are "<projectId>:<index>". */
  function renderLinks(b) {
    const grid = el("div", "link-grid");
    let n = 0;
    for (const id of b.linkIds) {
      const at = String(id).lastIndexOf(":");
      const p = corpus.project.get(String(id).slice(0, at));
      const link = p?.links?.[Number(String(id).slice(at + 1))];
      if (!link) continue;
      const a = el("a", null, link.label);
      a.href = link.href;
      if (link.external) {
        a.target = "_blank";
        a.rel = "noopener";
      }
      grid.appendChild(a);
      n++;
    }
    return n ? grid : null;
  }

  /* media — the labelled placeholder frame. */
  function renderMedia(b) {
    const p = corpus.project.get(b.projectId);
    const slot = p?.media?.find((m) => m.slot === b.slot);
    if (!slot) return null;
    const fig = el("figure", "ph");
    fig.appendChild(el("span", "ph__label", slot.caption));
    return fig;
  }

  /* sources — the citation list. Every id here survived the provenance
     gate, so each one names a passage a tool actually returned. */
  function renderSources(b) {
    const chunks = b.chunkIds.map((id) => corpus.chunk.get(id)).filter(Boolean);
    if (!chunks.length) return null;

    /* Collapsed, like the tool trace: the citation list can be the single
       largest element of an answer — ten slugs under a three-paragraph
       reply — and it is evidence to be checked, not prose to be read. It
       stays one click away, and the count is on the summary so its size
       is visible without opening it. */
    const wrap = el("details", "sources");
    wrap.appendChild(
      el("summary", "sources__title mono", chunks.length === 1 ? "1 source" : chunks.length + " sources")
    );
    const ol = el("ol", "sources__list");

    chunks.forEach((c, i) => {
      const li = el("li", "source");
      li.appendChild(el("span", "source__ref mono", String(i + 1)));

      const label = (c.cite?.label ? c.cite.label + " — " : "") + (c.heading || c.kind);
      const project = c.cite?.project;
      const openable = project && corpus.project.get(project)?.hasCaseStudy && typeof window.openCase === "function";

      if (openable) {
        const btn = el("button", "source__link", label);
        btn.type = "button";
        btn.addEventListener("click", () => window.openCase(project));
        li.appendChild(btn);
      } else {
        const a = el("a", "source__link", label);
        a.href = (c.cite?.page || "/") + (c.cite?.anchor || "");
        li.appendChild(a);
      }

      li.appendChild(el("span", "source__id mono", c.id));
      ol.appendChild(li);
    });

    wrap.appendChild(ol);
    return wrap;
  }

  const RENDERERS = {
    prose: renderProse,
    project: renderProject,
    experience: renderExperience,
    facts: renderFacts,
    metric: renderMetric,
    tags: renderTags,
    links: renderLinks,
    media: renderMedia,
    sources: renderSources,
  };

  /**
   * One block → one DOM node, or null when nothing resolves.
   * Requires load() to have settled.
   */
  function render(block) {
    if (!corpus || !block || !RENDERERS[block.type]) return null;
    try {
      return RENDERERS[block.type](block);
    } catch {
      /* A malformed block is a dropped block, never a broken page. */
      return null;
    }
  }

  window.AnswerRender = { load, render, isReady: () => Boolean(corpus) };
})();
