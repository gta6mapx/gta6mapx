// Community acceptance tests — Worker D (leaderboard scoring §5.1).
// Pure logic only: scoring formula, seasons, best-per-still, sort order.
// Run:
//
//   node --import ./scripts/register-game-hooks.mjs scripts/community-acceptance-d.mts
//
// Exits nonzero on the first failure; prints PASS per group.

import {
  SCORING_EXPLAINER,
  bestPerStillFor,
  byTotalDesc,
  computeRoundScore,
  seasonKey,
  seasonTotal,
  seasonTotalFromEvents,
} from "../src/modules/community/scoring";
import type { ScoreEvent } from "../src/modules/community/types";

let failures = 0;

function assert(cond: boolean, label: string) {
  if (cond) {
    console.log(`  ok — ${label}`);
  } else {
    failures += 1;
    console.error(`  FAIL — ${label}`);
  }
}

// ── 1. Replay decay ──
console.log("1. replay decay");
assert(computeRoundScore(100, 0, 1) === 110, "attempt 1 → (100+10)×1.0 = 110");
assert(computeRoundScore(100, 0, 2) === 55, "attempt 2 → (100+10)×0.5 = 55");
assert(computeRoundScore(100, 0, 3) === 28, "attempt 3 → (100+10)×0.25 = 27.5 → 28");
assert(computeRoundScore(100, 0, 4) === 0, "attempt 4 → 0 (scores nothing)");
assert(computeRoundScore(100, 0, 99) === 0, "attempt 99 → 0");

// ── 2. Cap + speed bonus decay ──
console.log("2. cap + speed bonus");
assert(computeRoundScore(100, 0, 1) === 110, "capped at 110");
assert(computeRoundScore(90, 0, 1) === 100, "90 + 10 bonus = 100");
assert(computeRoundScore(80, 30, 1) === 85, "30 s → bonus 5 → 85");
assert(computeRoundScore(80, 60, 1) === 80, "60 s → bonus 0 → 80");
assert(computeRoundScore(80, 120, 1) === 80, "bonus never goes negative");
assert(computeRoundScore(0, 0, 1) === 10, "0 accuracy still earns the speed bonus");
assert(Number.isInteger(computeRoundScore(77, 17, 2)), "result is an integer");

// ── 3. Season key format ──
console.log("3. seasonKey");
assert(seasonKey(new Date(2026, 8, 24)) === "2026-09", "Sep 2026 → 2026-09");
assert(/^\d{4}-\d{2}$/.test(seasonKey(new Date())), "format is YYYY-MM");
assert(seasonKey(new Date(2026, 0, 5)) === "2026-01", "January zero-padded");

// ── 4. Season total = Σ best per still ──
console.log("4. seasonTotal");
assert(seasonTotal(new Map([["a", 50], ["b", 110]])) === 160, "sums both bests");
assert(seasonTotal(new Map()) === 0, "empty → 0");

const mkEvent = (id: string, stillId: string, roundScore: number, sk: string): ScoreEvent => ({
  id,
  stillId,
  accuracy: 50,
  elapsedSec: 10,
  attemptNumber: 1,
  roundScore,
  seasonKey: sk,
  createdAt: "2026-09-24T00:00:00.000Z",
});

{
  const events: ScoreEvent[] = [
    mkEvent("e1", "vice-beach", 40, "2026-09"),
    mkEvent("e2", "vice-beach", 90, "2026-09"), // replay of same still
    mkEvent("e3", "malibu-club", 20, "2026-09"),
    mkEvent("e4", "vice-beach", 110, "2026-08"), // other season, ignored
  ];
  const sept = events.filter((e) => e.seasonKey === "2026-09");
  const best = bestPerStillFor(sept);
  assert(best.get("vice-beach") === 90, "best per still keeps the max (90, not 40)");
  assert(best.get("malibu-club") === 20, "other still kept");
  assert(seasonTotalFromEvents(sept) === 110, "season total = 90 + 20 (replay-farming worthless)");
}

// ── 5. Leaderboard sorts desc ──
console.log("5. sort order");
{
  const rows = [
    { name: "a", total: 50 },
    { name: "b", total: 110 },
    { name: "c", total: 75 },
  ].sort(byTotalDesc);
  assert(rows[0].total === 110 && rows[1].total === 75 && rows[2].total === 50, "desc by total");
}

// ── 6. Explainer copy present ──
console.log("6. explainer");
assert(SCORING_EXPLAINER.length >= 3, `explainer has ${SCORING_EXPLAINER.length} paragraphs`);
assert(
  SCORING_EXPLAINER.every((p) => p.length > 40),
  "every explainer paragraph is substantive",
);

if (failures > 0) {
  console.error(`\n${failures} FAILURE(S)`);
  process.exit(1);
}
console.log("\nAll community acceptance (D) tests passed.");
