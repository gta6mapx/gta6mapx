// Game acceptance tests — "Find the Location" (§1.4 scoring bible + honesty).
// Pure logic: engine + gameData eligibility + storage validation + strings audit. Run:
//
//   node --import ./scripts/register-game-hooks.mjs scripts/game-acceptance.mts
//
// Exits nonzero on the first failure; prints PASS per group.

import {
  distanceTier,
  timeBonus,
  streakMultiplier,
  scoreRound,
  haversineKm,
  drawRounds,
  canStartGame,
  ROUNDS_PER_GAME,
} from "../src/modules/engagement/game/engine";
import {
  getEligibleTargets,
  getPin,
  type RoundTarget,
} from "../src/modules/engagement/game/gameData";
import {
  gameStrings as S,
  auditGameStringsEnglish,
} from "../src/modules/engagement/game/strings";
import { LOCATIONS } from "../src/modules/entities/data/locations";

let failures = 0;

function assert(cond: boolean, label: string) {
  if (cond) {
    console.log(`  ok — ${label}`);
  } else {
    failures += 1;
    console.error(`  FAIL — ${label}`);
  }
}

// ── 1. Distance tiers ──
console.log("1. distance tiers");
assert(distanceTier(0).points === 1000 && distanceTier(0).name === "Bullseye", "≤2 km → Bullseye 1000");
assert(distanceTier(2).points === 1000, "boundary 2 km → 1000");
assert(distanceTier(2.01).points === 800, "just over 2 km → 800");
assert(distanceTier(5).points === 800, "boundary 5 km → 800");
assert(distanceTier(15).points === 600, "boundary 15 km → 600");
assert(distanceTier(40).points === 400, "boundary 40 km → 400");
assert(distanceTier(100).points === 200, "boundary 100 km → 200");
assert(distanceTier(100.01).points === 50 && distanceTier(100.01).name === "Lost at sea", ">100 km → 50 Lost at sea");

// ── 2. Time bonus ──
console.log("2. time bonus");
assert(timeBonus(10) === 200, "≤15 s → +200");
assert(timeBonus(15) === 200, "boundary 15 s → +200");
assert(timeBonus(16) === 150, "16 s → +150");
assert(timeBonus(28) === 150, "28 s → +150");
assert(timeBonus(45) === 100, "boundary 45 s → +100");
assert(timeBonus(60) === 50, "boundary 60 s → +50");
assert(timeBonus(61) === 0, ">60 s → +0");

// ── 3. Streak multiplier ──
console.log("3. streak multiplier");
assert(streakMultiplier(0) === 1, "streak 0 → ×1");
assert(streakMultiplier(1) === 1.05, "streak 1 → ×1.05");
assert(streakMultiplier(10) === 1.5, "streak 10 → ×1.50");
assert(streakMultiplier(99) === 1.5, "streak capped at 10 → ×1.50");

// ── 4. Spec worked example ──
console.log("4. worked example (§1.4)");
{
  // Round 3, streak 2, 4 km off, 28 s, 1 hint → (800+150)×1.10 − 100 = 945. Streak becomes 3.
  const r = scoreRound({ errorKm: 4, elapsedSec: 28, streakBefore: 2, hintsUsed: 1, timedOut: false });
  assert(r.distancePts === 800, "distance = 800 (On the block)");
  assert(r.timeBonusPts === 150, "time bonus = 150");
  assert(Math.abs(r.streakMult - 1.1) < 1e-9, "mult = 1.10");
  assert(r.roundScore === 945, "round score = 945");
  assert(r.streakAfter === 3, "streak increments to 3 (950 ≥ 600)");
}

// ── 5. Streak increment/reset thresholds ──
console.log("5. streak thresholds");
{
  // At the 600 bar: distance 600 + time 50 → 650, streak 0 → mult 1.0 → 650 pts
  const inc = scoreRound({ errorKm: 15, elapsedSec: 60, streakBefore: 0, hintsUsed: 0, timedOut: false });
  assert(inc.roundScore === 650, "(600+50)×1 = 650");
  assert(inc.streakAfter === 1, "subtotal 650 ≥ 600 → streak increments");
  // subtotal exactly 600: distance 600 + time 0, streakBefore 4 → mult 1.20 → 720 pts, streak → 5
  const edge = scoreRound({ errorKm: 15, elapsedSec: 61, streakBefore: 4, hintsUsed: 0, timedOut: false });
  assert(edge.roundScore === 720, "exact-600 subtotal: (600+0)×1.20 = 720");
  assert(edge.streakAfter === 5, "subtotal exactly 600 → streak increments");

  // below 600: distance 200 + time 0, streakBefore 4 → mult 1.20 → 240, streak resets
  const reset = scoreRound({ errorKm: 50, elapsedSec: 61, streakBefore: 4, hintsUsed: 0, timedOut: false });
  assert(reset.roundScore === 240, "below-600: (200+0)×1.20 = 240");
  assert(reset.streakAfter === 0, "subtotal 200 < 600 → streak resets to 0");

  // timeout: 0 points, streak resets, multiplier still reported
  const to = scoreRound({ errorKm: 1, elapsedSec: 5, streakBefore: 6, hintsUsed: 2, timedOut: true });
  assert(to.roundScore === 0, "timeout → 0 points");
  assert(to.streakAfter === 0, "timeout → streak resets");
  assert(to.hintsUsed === 2, "timeout keeps hint count (informational)");

  // max per round: (1000+200)×1.5 − 0 = 1800
  const max = scoreRound({ errorKm: 0.5, elapsedSec: 10, streakBefore: 10, hintsUsed: 0, timedOut: false });
  assert(max.roundScore === 1800, "perfect round at streak 10 → 1800");

  // hint deductions
  const h2 = scoreRound({ errorKm: 1, elapsedSec: 20, streakBefore: 0, hintsUsed: 2, timedOut: false });
  assert(h2.roundScore === 1150 - 200, "2 hints → −200 → 950");
  const floor = scoreRound({ errorKm: 500, elapsedSec: 90, streakBefore: 0, hintsUsed: 2, timedOut: false });
  assert(floor.roundScore === 0, "score never goes below 0 (50 − 200 → 0)");
}

// ── 6. Draw without replacement ──
console.log("6. draw without replacement");
{
  const pool = getEligibleTargets("medium");
  assert(pool.length === 30, `medium pool = 30 (got ${pool.length})`);
  const seen = new Set<string>();
  for (let i = 0; i < 500; i++) {
    const draw = drawRounds(pool, ROUNDS_PER_GAME);
    assert(draw.length === ROUNDS_PER_GAME, "draw = 5 rounds");
    const slugs = draw.map((t: RoundTarget) => t.location.slug);
    assert(new Set(slugs).size === ROUNDS_PER_GAME, "no repeats within a draw");
    for (const t of draw) {
      assert(pool.includes(t), "every drawn target comes from the pool");
    }
    slugs.forEach((s) => seen.add(s));
  }
  assert(seen.size === 30, "500 draws cover all 30 pool locations (shuffle is fair)");
  assert(canStartGame(pool), "canStartGame true for full pool");
  assert(!canStartGame(pool.slice(0, 4)), "canStartGame false below 5");
}

// ── 7. Eligibility filter (honesty) ──
console.log("7. eligibility filter");
{
  const easy = getEligibleTargets("easy");
  const medium = getEligibleTargets("medium");
  const hard = getEligibleTargets("hard");
  assert(easy.length === 14, `easy (rockstar-confirmed) = 14 (got ${easy.length})`);
  assert(hard.length === 16, `hard (trailer-confirmed) = 16 (got ${hard.length})`);
  assert(medium.length === 30, `medium (all) = 30 (got ${medium.length})`);
  assert(easy.every((t) => t.location.evidence.status === "rockstar-confirmed"), "easy pool all rockstar-confirmed");
  assert(hard.every((t) => t.location.evidence.status === "trailer-confirmed"), "hard pool all trailer-confirmed");

  const excluded = ["malibu-club", "monument-of-leonida", "lummox-county"];
  for (const slug of excluded) {
    assert(getPin(slug) === undefined, `${slug} has no game pin`);
    assert(!medium.some((t) => t.location.slug === slug), `${slug} excluded from pool`);
  }
  const leakedInData = LOCATIONS.filter(
    (l) => l.kind === "location" && (l.evidence.status === "leak-reported" || l.evidence.status === "disputed")
  );
  assert(leakedInData.length === 3, "data has exactly 3 excluded locations");
  for (const l of leakedInData) {
    assert(!medium.some((t) => t.location.slug === l.slug), `leak/disputed "${l.slug}" excluded`);
  }

  // Every pool target has a pin + the pin flag
  for (const t of medium) {
    assert(t.pin.approximate === true, `${t.location.slug} pin marked approximate`);
    assert(Number.isFinite(t.pin.lat) && Number.isFinite(t.pin.lng), `${t.location.slug} coords finite`);
    assert(t.location.slug === t.pin.locationSlug, `${t.location.slug} pin slug matches`);
  }
}

// ── 8. Clue masking (honesty) ──
console.log("8. clue masking");
// Generic geography nouns are descriptive, not identifying — allowed in clues.
const GENERIC_NOUNS = new Set([
  "county", "island", "key", "keys", "park", "beach", "club", "hotel",
  "motel", "market", "estate", "port", "airport", "drive", "refinery",
  "retreat", "links", "safehouse", "national",
]);
{
  for (const t of getEligibleTargets("medium")) {
    const name = t.location.name;
    const region = (t.location as { region?: string }).region ?? "";
    assert(!t.pin.clue.includes(name), `${t.location.slug} clue hides the answer name`);
    if (region.length > 2) {
      assert(!t.pin.clue.includes(region), `${t.location.slug} clue hides the region name`);
    }
    // Distinctive name fragments (longer than 5 chars, not generic nouns)
    // must not appear either.
    for (const word of name.split(/[\s'-]+/)) {
      if (word.length > 5 && !GENERIC_NOUNS.has(word.toLowerCase())) {
        assert(!t.pin.clue.toLowerCase().includes(word.toLowerCase()), `${t.location.slug} clue hides name fragment "${word}"`);
      }
    }
  }
}

// ── 9. Haversine sanity ──
console.log("9. haversine");
{
  const miamiBeach = haversineKm(25.7617, -80.1918, 25.81, -80.12);
  assert(miamiBeach > 5 && miamiBeach < 15, `Miami→Miami Beach ≈ 9 km (got ${miamiBeach.toFixed(1)})`);
  assert(haversineKm(25, -80, 25, -80) === 0, "same point → 0");
}

// ── 10. Strings audit ──
console.log("10. strings audit");
{
  const violations = auditGameStringsEnglish(S);
  assert(violations.length === 0, `all strings non-empty English (${violations.length} violations${violations.length ? ": " + violations.join("; ") : ""})`);
  const share = S.shareText(4210, "Leonida Explorer");
  assert(
    share === "I scored 4,210 on Find the Location — Leonida Explorer. Can you beat it? gta6mapx.com/game/find-the-location",
    "share text matches spec wording"
  );
}

if (failures > 0) {
  console.error(`\n${failures} FAILURE(S)`);
  process.exit(1);
}
console.log("\nAll game acceptance tests passed.");
