// ─── modules/engagement/game/engine.ts ───────────────────────────────────────
// Pure game logic for "Find the Location". No React, no maplibre, no DOM.
// Implements the §1.4 scoring bible EXACTLY:
//
//   distanceScore = tier(errorKm)
//   timeBonus     = bracket(elapsedSec)
//   streakMult    = 1 + 0.05 × min(streak, 10)
//   roundScore    = max(0, round((distanceScore + timeBonus) × streakMult) − 100 × hintsUsed)
//
// Streak semantics: the streak BEFORE the current round sets this round's
// multiplier; the streak then updates — increments when the round's
// pre-multiplier subtotal (distanceScore + timeBonus) ≥ 600, resets to 0
// below 600 or on timeout.

import type { GameDifficulty, RoundTarget } from "./gameData";

export const ROUNDS_PER_GAME = 5;
export const ROUND_SECONDS = 90;
export const HINT_COST = 100;
export const MAX_HINTS_PER_ROUND = 2;
export const STREAK_SUBTOTAL_BAR = 600;
export const MAX_GAME_SCORE = 9000; // 5 × (1200 × 1.5)

export interface DistanceTier {
  points: number;
  name: string;
}

/** Distance tiers (haversine km): ≤2 Bullseye 1000 · ≤5 800 · ≤15 600 · ≤40 400 · ≤100 200 · >100 50. */
export function distanceTier(errorKm: number): DistanceTier {
  const km = Number.isFinite(errorKm) ? Math.max(0, errorKm) : 9999;
  if (km <= 2) return { points: 1000, name: "Bullseye" };
  if (km <= 5) return { points: 800, name: "On the block" };
  if (km <= 15) return { points: 600, name: "In the neighborhood" };
  if (km <= 40) return { points: 400, name: "Right county" };
  if (km <= 100) return { points: 200, name: "Same corner of Leonida" };
  return { points: 50, name: "Lost at sea" };
}

/** Time bonus: ≤15 +200 · ≤30 +150 · ≤45 +100 · ≤60 +50 · >60/timeout +0. */
export function timeBonus(elapsedSec: number): number {
  const s = Number.isFinite(elapsedSec) ? Math.max(0, elapsedSec) : ROUND_SECONDS + 1;
  if (s <= 15) return 200;
  if (s <= 30) return 150;
  if (s <= 45) return 100;
  if (s <= 60) return 50;
  return 0;
}

/** streakMult = 1 + 0.05 × min(streak, 10) → 1.05 … 1.50. */
export function streakMultiplier(streak: number): number {
  const clamped = Math.max(0, Math.min(10, Math.floor(streak)));
  return 1 + 0.05 * clamped;
}

export interface RoundScoreInput {
  errorKm: number;
  elapsedSec: number;
  streakBefore: number;
  hintsUsed: number;
  timedOut: boolean;
}

export interface RoundScoreResult {
  distance: DistanceTier;
  distancePts: number;
  timeBonusPts: number;
  streakMult: number;
  hintsUsed: number;
  roundScore: number;
  streakAfter: number;
  timedOut: boolean;
}

/** Scores one round per §1.4. Timeout → 0 points, streak resets to 0. */
export function scoreRound(input: RoundScoreInput): RoundScoreResult {
  const hintsUsed = Math.max(
    0,
    Math.min(MAX_HINTS_PER_ROUND, Math.floor(input.hintsUsed))
  );
  if (input.timedOut) {
    return {
      distance: { points: 0, name: "Timed out" },
      distancePts: 0,
      timeBonusPts: 0,
      streakMult: streakMultiplier(input.streakBefore),
      hintsUsed,
      roundScore: 0,
      streakAfter: 0,
      timedOut: true,
    };
  }
  const distance = distanceTier(input.errorKm);
  const distancePts = distance.points;
  const timeBonusPts = timeBonus(input.elapsedSec);
  const streakMult = streakMultiplier(input.streakBefore);
  const roundScore = Math.max(
    0,
    Math.round((distancePts + timeBonusPts) * streakMult) - HINT_COST * hintsUsed
  );
  const streakAfter = distancePts + timeBonusPts >= STREAK_SUBTOTAL_BAR
    ? input.streakBefore + 1
    : 0;
  return {
    distance,
    distancePts,
    timeBonusPts,
    streakMult,
    hintsUsed,
    roundScore,
    streakAfter,
    timedOut: false,
  };
}

/** Haversine distance in km between two map-frame points. */
export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/** 5-round draw without replacement: Fisher–Yates shuffle, take the first 5. */
export function drawRounds(pool: RoundTarget[], count = ROUNDS_PER_GAME): RoundTarget[] {
  const shuffled = [...pool];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, count);
}

/** Whether a 5-round game can be drawn from this pool. */
export function canStartGame(pool: RoundTarget[]): boolean {
  return pool.length >= ROUNDS_PER_GAME;
}

export const DIFFICULTY_LABEL: Record<GameDifficulty, string> = {
  easy: "Vice City Tour",
  medium: "Leonida Explorer",
  hard: "Deep Cuts",
};
