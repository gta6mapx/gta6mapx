// ─── modules/engagement/game/storage.ts ─────────────────────────────────────
// localStorage persistence for "Find the Location". Follows the useFound.ts
// pattern: lazy JSON read/write, try/catch on all storage access, validation
// + defaults fallback. Phase 1 is personal-records-only (no accounts exist).
//
// Keys:
//   gta6mapx_guessgame_player_v1 — { name, createdAt, gamesPlayed, bestScore, bestStreak, totalScore }
//   gta6mapx_guessgame_games_v1  — game records, newest first, capped at 50 (FIFO evict)

import type { GameDifficulty } from "./gameData";

const PLAYER_KEY = "gta6mapx_guessgame_player_v1";
const GAMES_KEY = "gta6mapx_guessgame_games_v1";

export interface PlayerProfile {
  name: string;
  createdAt: string;
  gamesPlayed: number;
  bestScore: number;
  bestStreak: number;
  totalScore: number;
}

export interface RoundRecord {
  locationSlug: string;
  guessLngLat: [number, number] | null;
  truthLngLat: [number, number];
  errorKm: number | null;
  elapsedSec: number;
  hintsUsed: number;
  distanceScore: number;
  timeBonus: number;
  roundScore: number;
}

export interface GameRecord {
  id: string;
  date: string;
  difficulty: GameDifficulty;
  rounds: RoundRecord[];
  totalScore: number;
  bestStreak: number;
  avgErrorKm: number;
  hintsUsed: number;
}

const DEFAULT_PLAYER: PlayerProfile = {
  name: "",
  createdAt: "",
  gamesPlayed: 0,
  bestScore: 0,
  bestStreak: 0,
  totalScore: 0,
};

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isNum(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

function validatePlayer(raw: unknown): PlayerProfile | null {
  if (!isObject(raw)) return null;
  return {
    name: typeof raw.name === "string" ? raw.name : "",
    createdAt: typeof raw.createdAt === "string" ? raw.createdAt : "",
    gamesPlayed: isNum(raw.gamesPlayed) ? Math.max(0, Math.floor(raw.gamesPlayed)) : 0,
    bestScore: isNum(raw.bestScore) ? Math.max(0, Math.floor(raw.bestScore)) : 0,
    bestStreak: isNum(raw.bestStreak) ? Math.max(0, Math.floor(raw.bestStreak)) : 0,
    totalScore: isNum(raw.totalScore) ? Math.max(0, Math.floor(raw.totalScore)) : 0,
  };
}

function validateRound(raw: unknown): RoundRecord | null {
  if (!isObject(raw)) return null;
  if (typeof raw.locationSlug !== "string") return null;
  const guess =
    Array.isArray(raw.guessLngLat) &&
    raw.guessLngLat.length === 2 &&
    isNum(raw.guessLngLat[0]) &&
    isNum(raw.guessLngLat[1])
      ? ([raw.guessLngLat[0], raw.guessLngLat[1]] as [number, number])
      : null;
  const truth =
    Array.isArray(raw.truthLngLat) &&
    raw.truthLngLat.length === 2 &&
    isNum(raw.truthLngLat[0]) &&
    isNum(raw.truthLngLat[1])
      ? ([raw.truthLngLat[0], raw.truthLngLat[1]] as [number, number])
      : null;
  if (!truth) return null;
  return {
    locationSlug: raw.locationSlug,
    guessLngLat: guess,
    truthLngLat: truth,
    errorKm: isNum(raw.errorKm) ? raw.errorKm : null,
    elapsedSec: isNum(raw.elapsedSec) ? raw.elapsedSec : 0,
    hintsUsed: isNum(raw.hintsUsed) ? Math.max(0, Math.floor(raw.hintsUsed)) : 0,
    distanceScore: isNum(raw.distanceScore) ? Math.floor(raw.distanceScore) : 0,
    timeBonus: isNum(raw.timeBonus) ? Math.floor(raw.timeBonus) : 0,
    roundScore: isNum(raw.roundScore) ? Math.floor(raw.roundScore) : 0,
  };
}

function validateGame(raw: unknown): GameRecord | null {
  if (!isObject(raw)) return null;
  if (typeof raw.id !== "string" || typeof raw.date !== "string") return null;
  if (raw.difficulty !== "easy" && raw.difficulty !== "medium" && raw.difficulty !== "hard") {
    return null;
  }
  if (!Array.isArray(raw.rounds)) return null;
  const rounds: RoundRecord[] = [];
  for (const r of raw.rounds) {
    const rec = validateRound(r);
    if (rec) rounds.push(rec);
  }
  return {
    id: raw.id,
    date: raw.date,
    difficulty: raw.difficulty,
    rounds,
    totalScore: isNum(raw.totalScore) ? Math.floor(raw.totalScore) : 0,
    bestStreak: isNum(raw.bestStreak) ? Math.floor(raw.bestStreak) : 0,
    avgErrorKm: isNum(raw.avgErrorKm) ? raw.avgErrorKm : 0,
    hintsUsed: isNum(raw.hintsUsed) ? Math.floor(raw.hintsUsed) : 0,
  };
}

/** Lazy read; any failure (missing/corrupt/unavailable) falls back to defaults. */
export function loadPlayer(): PlayerProfile {
  try {
    const raw = localStorage.getItem(PLAYER_KEY);
    if (!raw) return { ...DEFAULT_PLAYER };
    const parsed: unknown = JSON.parse(raw);
    return validatePlayer(parsed) ?? { ...DEFAULT_PLAYER };
  } catch {
    return { ...DEFAULT_PLAYER };
  }
}

export function savePlayer(profile: PlayerProfile): void {
  try {
    localStorage.setItem(PLAYER_KEY, JSON.stringify(profile));
  } catch {
    /* storage unavailable — profile keeps working in-memory */
  }
}

/** Lazy read; corrupt entries are dropped, never half-applied. */
export function loadGames(): GameRecord[] {
  try {
    const raw = localStorage.getItem(GAMES_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const out: GameRecord[] = [];
    for (const g of parsed) {
      const rec = validateGame(g);
      if (rec) out.push(rec);
    }
    return out;
  } catch {
    return [];
  }
}

/** Newest first, capped at 50 (FIFO evict of the oldest). */
export function saveGameRecord(game: GameRecord): GameRecord[] {
  const games = loadGames();
  const next = [game, ...games].slice(0, 50);
  try {
    localStorage.setItem(GAMES_KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable */
  }
  return next;
}

/** Applies a finished game to the profile: gamesPlayed + bests. Returns the updated profile. */
export function applyGameToPlayer(profile: PlayerProfile, game: GameRecord): PlayerProfile {
  const next: PlayerProfile = {
    ...profile,
    name: profile.name,
    createdAt: profile.createdAt || game.date,
    gamesPlayed: profile.gamesPlayed + 1,
    bestScore: Math.max(profile.bestScore, game.totalScore),
    bestStreak: Math.max(profile.bestStreak, game.bestStreak),
    totalScore: profile.totalScore + game.totalScore,
  };
  savePlayer(next);
  return next;
}
