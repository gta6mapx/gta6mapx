// ─── modules/community/scoring.ts ────────────────────────────────────────────
// WORKER D — seasonal leaderboard scoring, pure functions (spec §5.1).
//
// CONTRACT (non-negotiable, spec §5.1):
//   "The game emits score events; the leaderboard computes ranks —
//    the game never writes ranks."
// This module only *computes* from ScoreEvents. It never reads storage,
// never writes ranks, and never reaches into another slice's internals.

import type { ScoreEvent } from "./types";

/**
 * Round score per spec §5.1:
 *   round_score = min(110, (accuracy_0–100 + speed_bonus≤10) × replay_decay)
 *
 * - speed_bonus: ≤10, decaying linearly to 0 over 60 s. Choice of decay
 *   documented: linear is the simplest readable curve that still rewards fast
 *   answers (10 pts at t=0 → 0 pts at t=60 s); the cap and the replay decay
 *   below are what actually keep the board farm-proof, so a fancier curve
 *   buys nothing.
 * - replay_decay: 1.0 / 0.5 / 0.25 / 0 for attempts 1 / 2 / 3 / 4+.
 *   A 4th-or-later attempt scores nothing, so replaying a still can never
 *   add points.
 *
 * Returns an integer. Inputs are clamped defensively (accuracy 0–100,
 * elapsedSec ≥ 0) so raw caller data can never produce an out-of-range score.
 */
export function computeRoundScore(
  accuracy: number /* 0–100 */,
  elapsedSec: number,
  attemptNumber: number,
): number {
  const acc = Number.isFinite(accuracy)
    ? Math.min(100, Math.max(0, accuracy))
    : 0;
  const secs = Number.isFinite(elapsedSec) ? Math.max(0, elapsedSec) : 0;
  const speedBonus = Math.max(0, 10 * (1 - secs / 60));
  const decay =
    attemptNumber <= 1
      ? 1.0
      : attemptNumber === 2
        ? 0.5
        : attemptNumber === 3
          ? 0.25
          : 0;
  return Math.round(Math.min(110, (acc + speedBonus) * decay));
}

/** Monthly season identifier: "YYYY-MM" (e.g. "2026-09"). */
export function seasonKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

/**
 * Best round score per still for one identity. Taking only the best per
 * still is what makes replay-farming worthless by construction — extra
 * attempts on the same still can never raise the total.
 */
export function bestPerStillFor(events: ScoreEvent[]): Map<string, number> {
  const best = new Map<string, number>();
  for (const e of events) {
    const cur = best.get(e.stillId) ?? 0;
    if (e.roundScore > cur) best.set(e.stillId, e.roundScore);
  }
  return best;
}

/** Season total = Σ best round_score per still (spec §5.1). */
export function seasonTotal(bestPerStill: Map<string, number>): number {
  let total = 0;
  for (const s of bestPerStill.values()) total += s;
  return total;
}

/** Convenience: Σ best-per-still over a set of events. */
export function seasonTotalFromEvents(events: ScoreEvent[]): number {
  return seasonTotal(bestPerStillFor(events));
}

/** Leaderboard sort: highest total first. */
export function byTotalDesc(
  a: { total: number },
  b: { total: number },
): number {
  return b.total - a.total;
}

/**
 * Honest, user-facing explanation of how scoring works. Rendered verbatim
 * in the leaderboard's "How scoring works" section.
 */
export const SCORING_EXPLAINER: string[] = [
  "Each round of Find the Location is worth up to 110 points: your accuracy (0–100, based on how close your guess was) plus a speed bonus of up to 10 points for fast answers. Answering within 60 seconds earns the full speed bonus; it fades to zero after that.",
  "Replay decay keeps the board fair. Your first attempt at a location counts in full; a replay of the same location earns half points on the second attempt, a quarter on the third, and nothing from the fourth attempt on. Your season total only ever counts your best round per location — replay-farming can never inflate a rank.",
  "Guests rank normally and carry a grey “Guest” tag. Right now the board is built from game records stored on this device, so only you appear here. When accounts launch, scores will sync and the public top-100 will require a verified email.",
  "Anti-cheat note: the leaderboard computes ranks from score events — the game never writes ranks. Full server-authoritative scoring (the game submits guesses only; true coordinates never reach the client before a submit) arrives with accounts.",
];
