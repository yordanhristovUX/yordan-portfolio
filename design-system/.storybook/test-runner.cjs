/* Two automated gates over the same 64 stories, driven by @storybook/test-runner.
 *
 *   node scripts/storybook-gates.mjs --mode a11y      (npm run test:a11y)
 *   node scripts/storybook-gates.mjs --mode visual    (npm run test:visual)
 *
 * The runner script builds `storybook-static/` if it is stale, serves it on an
 * ephemeral port and points `test-storybook --url` at it, so neither gate needs a
 * Storybook dev server running and neither is in the root `npm run check` — that
 * gate's contract is offline, no browsers, no heavy deps. These two live only in
 * design-system/package.json and in the path-filtered design-system workflow.
 *
 * ONE MODE AT A TIME, on purpose. A11y is an assertion and must fail the job;
 * the screenshots are report-only for now (see below). Running both in one pass
 * would put a hard gate and a soft one behind the same exit code, and the soft
 * one would be the one that got read.
 *
 * COMMONJS, IN A `"type": "module"` PACKAGE, ON PURPOSE — hence the `.cjs`. The
 * test-runner loads this through Storybook's `serverRequire`, which is a plain
 * `require()` with an esbuild fallback registered only when the running Node
 * cannot strip types. Whether an ESM `.js` survives that therefore depends on
 * the Node minor: 20 takes the esbuild path and works, 22.12+ and 24 take
 * `require(esm)` and work, and a narrow band in between takes neither. `.cjs`
 * is loadable by every one of them, which is worth more here than matching the
 * import style of the files around it. Do not rename it to `.js`.
 */

const { getStoryContext, waitForPageReady } = require("@storybook/test-runner");
const { checkA11y, configureAxe, injectAxe } = require("axe-playwright");
const { toMatchImageSnapshot } = require("jest-image-snapshot");
const { appendFileSync, mkdirSync } = require("node:fs");
const { dirname, join } = require("node:path");

const MODE = process.env.DS_TEST_MODE ?? "a11y";

/* Absolute, and handed down by the runner script rather than derived from cwd:
   jest's workers inherit the env but not necessarily the directory. */
const SNAPSHOT_DIR = process.env.DS_SNAPSHOT_DIR;
const DIFF_DIR = process.env.DS_DIFF_DIR;
const REPORT = process.env.DS_VISUAL_REPORT;

/* ---------------------------------------------------------------------------
 * Determinism. A screenshot harness is worth exactly what its false-positive
 * rate lets it be worth, so everything that could differ between two runs of the
 * same commit is pinned here rather than hoped for.
 * ------------------------------------------------------------------------- */

const VIEWPORT = { width: 1280, height: 800 };

/* Layout must settle at the final viewport BEFORE the story renders: the
   skeleton stories measure their own box in a rAF and size a canvas from it, so
   a story rendered at one width and screenshotted at another is a different
   drawing, not a resized one. */
const STILL = `
  *, *::before, *::after {
    animation-duration: 0s !important;
    animation-delay: 0s !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0s !important;
    transition-delay: 0s !important;
    caret-color: transparent !important;
  }
  html { scrollbar-width: none; }
  ::-webkit-scrollbar { display: none; }
`;

async function stillPage(page) {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.evaluate((css) => {
    if (document.getElementById("ds-test-still")) return;
    const s = document.createElement("style");
    s.id = "ds-test-still";
    s.textContent = css;
    document.head.appendChild(s);
  }, STILL);
}

/* The canvases are the one genuinely unpinnable region, and they are pinned
   anyway — see __screenshots__/README.md for why they are NOT masked. */
const settle = (page) =>
  page.evaluate(
    () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))
  );

/* ---------------------------------------------------------------------------
 * Report-only visual regression.
 *
 * Decided with the owner: for the first month the screenshots are evidence, not
 * a verdict. A mismatch prints a named block and writes a diff PNG, and the job
 * still exits 0 — because a baseline set nobody has looked at yet is a source of
 * red builds rather than of information.
 *
 * FLIP TO ENFORCING ON 2026-09-01: delete the try/catch in `screenshot()` below
 * and let the matcher throw. Nothing else changes; the exit code starts meaning
 * something. If that date has passed and this comment is still here, the answer
 * is that the flip is overdue, not that the leniency was re-decided.
 * ------------------------------------------------------------------------- */
const ENFORCE_FROM = "2026-09-01";

/* A platform folder, because a PNG is a rasterisation and not a fact. Chromium
   on win32 and on linux hint and antialias text differently, so one shared
   baseline set would make every CI run a mismatch and the whole harness noise.
   Baselines are therefore committed per platform; a platform with none reports
   "no baseline" (report-only, so it does not fail) until its set is captured and
   committed. `DS_SNAPSHOT_PLATFORM` lets a container pin the name explicitly. */
const PLATFORM = process.env.DS_SNAPSHOT_PLATFORM ?? process.platform;

function record(entry) {
  if (!REPORT) return;
  mkdirSync(dirname(REPORT), { recursive: true });
  appendFileSync(REPORT, `${JSON.stringify(entry)}\n`);
}

async function screenshot(page, context) {
  const image = await page.screenshot({
    fullPage: true,
    animations: "disabled",
    caret: "hide",
    scale: "css",
  });

  try {
    expect(image).toMatchImageSnapshot({
      customSnapshotsDir: join(SNAPSHOT_DIR, PLATFORM),
      customDiffDir: join(DIFF_DIR, PLATFORM),
      /* The received image goes with the diff, not beside the baseline —
         `__screenshots__/` holds committed expectations and nothing else, or the
         first mismatch quietly adds a `-received.png` to the repo. */
      customReceivedDir: join(DIFF_DIR, PLATFORM, "received"),
      customSnapshotIdentifier: context.id,
      /* 0.1% of pixels, compared with pixelmatch's default perceptual
         threshold. Not a fudge factor for real change: a padding step is
         thousands of pixels and clears this by three orders of magnitude. It is
         here so a single re-hinted glyph edge is not called a regression. */
      failureThreshold: 0.001,
      failureThresholdType: "percent",
      customDiffConfig: { threshold: 0.1 },
      allowSizeMismatch: true,
      storeReceivedOnFailure: true,
    });
    record({ story: context.id, status: "match" });
  } catch (error) {
    const missing = /new snapshot|not written/i.test(error.message ?? "");
    record({
      story: context.id,
      status: missing ? "no-baseline" : "mismatch",
      message: String(error.message ?? error).split("\n").slice(0, 6).join("\n"),
    });
    console.warn(
      [
        "",
        `  visual ${missing ? "NO BASELINE" : "MISMATCH"} — ${context.id}`,
        `  ${String(error.message ?? error).split("\n").slice(0, 4).join("\n  ")}`,
        `  (report-only until ${ENFORCE_FROM}; diff written under test-results/visual-diff/${PLATFORM}/)`,
        "",
      ].join("\n")
    );
  }
}

/* ------------------------------------------------------------------------- */

module.exports = {
  setup() {
    expect.extend({ toMatchImageSnapshot });
  },

  async preVisit(page) {
    await page.setViewportSize(VIEWPORT);
    await stillPage(page);
    if (MODE === "a11y") await injectAxe(page);
  },

  async postVisit(page, context) {
    await waitForPageReady(page); /* load + networkidle + document.fonts.ready */
    await stillPage(page); /* the story replaced <head> content on some routes */
    await settle(page);

    if (MODE === "visual") {
      await screenshot(page, context);
      return;
    }

    /* A story may turn a rule off through the a11y addon's own parameters, which
       is the same switch the Storybook panel reads — there is no second, test-
       only way to silence a violation. Nothing sets one today, and a `disable`
       appearing here is a review conversation, not a config detail. */
    const story = await getStoryContext(page, context);
    if (story.parameters?.a11y?.disable) return;
    await configureAxe(page, { rules: story.parameters?.a11y?.config?.rules });

    await checkA11y(
      page,
      "#storybook-root",
      { detailedReport: true, detailedReportOptions: { html: true } },
      false /* skipFailures: false — a violation fails the run */
    );
  },
};
