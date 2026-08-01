/* Jest config for @storybook/test-runner — picked up by name from the cwd
 * the gates run in (see executeJestPlaywright's `test-runner-jest*` glob).
 *
 * One override, and only on Windows paths: the default testMatch globs are
 * built with path.join, so they arrive full of backslashes. Jest "fixes"
 * them with replacePathSepForGlob, which keeps `\.` as a glob escape — so a
 * checkout whose path contains a dot-leading directory (a git worktree under
 * `.claude/worktrees/`, say) yields a pattern segment like `repo\.claude`
 * that can never match the real `repo/.claude`, and the runner finds zero
 * tests. Re-slashing every backslash ourselves leaves nothing for jest to
 * misread. On POSIX paths this is a byte-for-byte no-op.
 *
 * CommonJS in a `"type": "module"` package, hence `.cjs` — jest loads this
 * file with require(). Same reasoning as .storybook/test-runner.cjs.
 */

const { getJestConfig } = require("@storybook/test-runner");

const config = getJestConfig();

module.exports = {
  ...config,
  testMatch: (config.testMatch ?? []).map((glob) => glob.replace(/\\/g, "/")),
};
