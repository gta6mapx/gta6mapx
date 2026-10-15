// Phase 6 community acceptance — merged runner for all four slice suites.
// Runs a/b/c/d in one process and reports the combined result.
//
// Run:
//   node --import ./scripts/register-at-alias.mjs scripts/community-acceptance.mts
//
// Each slice suite prints its own PASS/FAIL lines; this runner prints the
// summary and exits non-zero if any suite failed.

import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const suites = [
  "community-acceptance-a.mts", // guest continuity foundation
  "community-acceptance-b.mts", // repository pattern seam
  "community-acceptance-c.mts", // submission form + moderation gates
  "community-acceptance-d.mts", // scoring + leaderboard
];

let failed = 0;
for (const suite of suites) {
  console.log(`\n===== ${suite} =====`);
  const res = spawnSync(
    process.execPath,
    ["--import", join(here, "register-at-alias.mjs"), join(here, suite)],
    { stdio: "inherit" }
  );
  if (res.status !== 0) {
    console.log(`SUITE FAILED: ${suite}`);
    failed++;
  } else {
    console.log(`SUITE OK: ${suite}`);
  }
}

console.log(`\n===== community-acceptance: ${failed === 0 ? "ALL PASS" : `${failed} SUITE(S) FAILED`} =====`);
process.exit(failed === 0 ? 0 : 1);
