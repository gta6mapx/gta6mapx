// Full-game flow simulation — mirrors GameScreen's logic path exactly:
// draw 5 rounds → score each via engine → build GameRecord → persist via
// storage (localStorage shim) → reload and verify. Run:
//
//   node --import ./scripts/register-game-hooks.mjs scripts/game-flow-sim.mts
import {
  getEligibleTargets,
  type GameDifficulty,
} from "../src/modules/engagement/game/gameData";
import {
  ROUNDS_PER_GAME,
  canStartGame,
  drawRounds,
  haversineKm,
  scoreRound,
} from "../src/modules/engagement/game/engine";
import {
  applyGameToPlayer,
  loadGames,
  loadPlayer,
  saveGameRecord,
  savePlayer,
  type GameRecord,
  type RoundRecord,
} from "../src/modules/engagement/game/storage";

// ── localStorage shim ──
const store = new Map<string, string>();
(globalThis as Record<string, unknown>).localStorage = {
  getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
};

let failures = 0;
function assert(cond: boolean, label: string) {
  if (cond) console.log(`  ok — ${label}`);
  else {
    failures++;
    console.error(`  FAIL — ${label}`);
  }
}

for (const diff of ["easy", "medium", "hard"] as GameDifficulty[]) {
  const pool = getEligibleTargets(diff);
  assert(canStartGame(pool), `${diff}: pool drawable (${pool.length})`);
  const rounds = drawRounds(pool, ROUNDS_PER_GAME);
  assert(rounds.length === 5, `${diff}: 5 rounds drawn`);
  assert(new Set(rounds.map((r) => r.location.slug)).size === 5, `${diff}: no repeats`);
}

console.log("simulating a full medium game…");
// Simulate realistic play: vary error/time/hints across 5 rounds.
const plan = [
  { err: 1.2, sec: 12, hints: 0 }, // bullseye, fast
  { err: 4.0, sec: 28, hints: 1 }, // worked-example round
  { err: 30, sec: 55, hints: 2 }, // far, slow, 2 hints
  { err: 150, sec: 70, hints: 0 }, // lost at sea
  { err: 8, sec: 40, hints: 1 }, // neighborhood
];
const pool = getEligibleTargets("medium");
const rounds = drawRounds(pool, ROUNDS_PER_GAME);
let streak = 0;
let total = 0;
let bestStreak = 0;
const records: RoundRecord[] = [];
rounds.forEach((target, i) => {
  const truth: [number, number] = [target.pin.lng, target.pin.lat];
  // Place the guess `err` km north of truth (approx, small distances).
  const guessLat = truth[1] + plan[i].err / 111.32;
  const guess: [number, number] = [truth[0], guessLat];
  const errorKm = haversineKm(guess[1], guess[0], truth[1], truth[0]);
  const score = scoreRound({
    errorKm,
    elapsedSec: plan[i].sec,
    streakBefore: streak,
    hintsUsed: plan[i].hints,
    timedOut: false,
  });
  streak = score.streakAfter;
  bestStreak = Math.max(bestStreak, streak);
  total += score.roundScore;
  records.push({
    locationSlug: target.location.slug,
    guessLngLat: guess,
    truthLngLat: truth,
    errorKm,
    elapsedSec: plan[i].sec,
    hintsUsed: plan[i].hints,
    distanceScore: score.distancePts,
    timeBonus: score.timeBonusPts,
    roundScore: score.roundScore,
  });
  console.log(
    `  round ${i + 1}: ${target.location.slug} → err ${errorKm.toFixed(1)} km, ` +
      `${score.roundScore} pts (streak ${streak})`
  );
});

// Worked-example family cross-check (round 2: 4 km, 28 s, 1 hint, streak 1):
// (800+150)×1.05 = 997.5 → 998 − 100 = 898.
{
  const r2 = records[1];
  const s2 = scoreRound({ errorKm: r2.errorKm!, elapsedSec: 28, streakBefore: 1, hintsUsed: 1, timedOut: false });
  assert(s2.roundScore === 898, `round 2 = 898 (got ${s2.roundScore})`);
}

const errors = records.map((r) => r.errorKm!);
const game: GameRecord = {
  id: "gg-sim-1",
  date: new Date().toISOString(),
  difficulty: "medium",
  rounds: records,
  totalScore: total,
  bestStreak,
  avgErrorKm: errors.reduce((a, b) => a + b, 0) / errors.length,
  hintsUsed: records.reduce((a, r) => a + r.hintsUsed, 0),
};
assert(total > 0 && total <= 9000, `total ${total} in range`);
assert(game.hintsUsed === 4, "hints total = 4");

// Persist exactly like GameScreen does.
saveGameRecord(game);
const before = loadPlayer();
const isNewBest = total > before.bestScore && total > 0;
const after = applyGameToPlayer(before, game);
savePlayer(after);

// Reload from the shim and verify round-trip.
const reloadedGames = loadGames();
const reloadedPlayer = loadPlayer();
assert(reloadedGames.length === 1, "1 game persisted");
assert(reloadedGames[0].totalScore === total, "game total survives reload");
assert(reloadedPlayer.gamesPlayed === 1, "gamesPlayed = 1");
assert(reloadedPlayer.bestScore === (isNewBest ? total : 0), "bestScore updated");
assert(reloadedPlayer.bestStreak === bestStreak, "bestStreak persisted");
assert(
  reloadedPlayer.totalScore === total,
  "totalScore accumulates"
);

// Timeout game: 5 timeouts → 0 total, streak 0.
const toRounds = drawRounds(pool, ROUNDS_PER_GAME);
const toRecords: RoundRecord[] = toRounds.map((target) => {
  const truth: [number, number] = [target.pin.lng, target.pin.lat];
  const s = scoreRound({ errorKm: 9999, elapsedSec: 90, streakBefore: 0, hintsUsed: 0, timedOut: true });
  assert(s.roundScore === 0 && s.streakAfter === 0, "timeout scores 0, resets streak");
  return {
    locationSlug: target.location.slug,
    guessLngLat: null,
    truthLngLat: truth,
    errorKm: null,
    elapsedSec: 90,
    hintsUsed: 0,
    distanceScore: 0,
    timeBonus: 0,
    roundScore: 0,
  };
});
const toGame: GameRecord = {
  id: "gg-sim-2",
  date: new Date().toISOString(),
  difficulty: "hard",
  rounds: toRecords,
  totalScore: 0,
  bestStreak: 0,
  avgErrorKm: 0,
  hintsUsed: 0,
};
saveGameRecord(toGame);
assert(loadGames().length === 2, "2 games persisted, newest first");
assert(loadGames()[0].id === "gg-sim-2", "newest game first");
const p2 = applyGameToPlayer(loadPlayer(), toGame);
assert(p2.gamesPlayed === 2, "gamesPlayed = 2 after timeout game");
assert(p2.bestScore === total, "bestScore survives a 0-point game");

if (failures > 0) {
  console.error(`\n${failures} FAILURE(S)`);
  process.exit(1);
}
console.log("\nFull-game flow simulation passed.");
