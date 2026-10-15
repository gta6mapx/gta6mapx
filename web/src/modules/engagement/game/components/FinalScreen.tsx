"use client";

// ─── FinalScreen.tsx — end-of-game stats, replay, text share ───────────────
// Stats: game total (max 9,000), best round, average error km, hints used,
// final streak. "New best!" badge when the player beats their record.
// Buttons: Play again (same difficulty), Change difficulty, View leaderboard.
// Share copies the spec's text summary.

import { useState } from "react";
import { gameStrings as S } from "../strings";
import { DIFFICULTY_LABEL, MAX_GAME_SCORE } from "../engine";
import type { GameDifficulty } from "../gameData";
import type { RoundRecord } from "../storage";

export interface FinalStats {
  totalScore: number;
  bestRound: number;
  avgErrorKm: number | null;
  hintsUsed: number;
  finalStreak: number;
  difficulty: GameDifficulty;
  rounds: RoundRecord[];
}

export default function FinalScreen({
  stats,
  isNewBest,
  onPlayAgain,
  onChangeDifficulty,
  onLeaderboard,
}: {
  stats: FinalStats;
  isNewBest: boolean;
  onPlayAgain: () => void;
  onChangeDifficulty: () => void;
  onLeaderboard: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const share = async () => {
    const text = S.shareText(stats.totalScore, DIFFICULTY_LABEL[stats.difficulty]);
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* clipboard blocked — still show the text */
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2500);
  };

  const stat = (label: string, value: string, accent = false) => (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-center">
      <p className="font-mono text-[11px] uppercase tracking-widest text-[#8b94a3]">
        {label}
      </p>
      <p
        className={`mt-1 font-mono text-xl font-bold ${accent ? "text-[#22d3ee]" : "text-white"}`}
      >
        {value}
      </p>
    </div>
  );

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col items-center px-4 py-10 sm:py-14">
      <p className="font-mono text-xs uppercase tracking-[0.3em] text-[#22d3ee]">
        {S.gameOver}
      </p>
      <h1 className="font-display mt-2 text-center text-5xl tracking-wide text-white">
        {stats.totalScore.toLocaleString()}
      </h1>
      <p className="mt-1 font-mono text-xs text-[#8b94a3]">
        / {MAX_GAME_SCORE.toLocaleString()} max
      </p>
      {isNewBest && (
        <p
          role="status"
          className="badge-confirmed badge mt-3 px-3 py-1.5 text-sm font-bold"
        >
          {S.newBest}
        </p>
      )}

      <div className="mt-6 grid w-full grid-cols-2 gap-3 sm:grid-cols-4">
        {stat(S.bestRound, stats.bestRound.toLocaleString(), true)}
        {stat(S.finalStreak, String(stats.finalStreak))}
        {stat(
          S.avgError,
          stats.avgErrorKm === null ? "—" : `${stats.avgErrorKm.toFixed(1)} km`
        )}
        {stat(S.hintsUsed, String(stats.hintsUsed))}
      </div>

      {/* Per-round recap */}
      <ol className="mt-6 w-full space-y-2">
        {stats.rounds.map((r, i) => (
          <li
            key={i}
            className="glass-panel flex items-center justify-between gap-3 rounded-xl px-3 py-2"
          >
            <span className="min-w-0">
              <span className="mr-2 font-mono text-[11px] text-[#8b94a3]">
                R{i + 1}
              </span>
              <span className="truncate text-sm text-[#e8ecf1]">
                {r.errorKm === null
                  ? S.roundTimeout
                  : `${r.errorKm.toFixed(1)} km`}
              </span>
            </span>
            <span className="shrink-0 font-mono text-sm font-bold text-[#22d3ee]">
              {r.roundScore.toLocaleString()}
            </span>
          </li>
        ))}
      </ol>

      <div className="mt-6 flex w-full flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={onPlayAgain}
          className="btn-neon min-h-11 flex-1 rounded-xl px-4 py-2.5 font-bold"
        >
          {S.playAgain}
        </button>
        <button
          type="button"
          onClick={onChangeDifficulty}
          className="btn-ghost min-h-11 flex-1 rounded-xl px-4 py-2.5 font-semibold"
        >
          {S.changeDifficulty}
        </button>
        <button
          type="button"
          onClick={onLeaderboard}
          className="btn-ghost min-h-11 flex-1 rounded-xl px-4 py-2.5 font-semibold"
        >
          {S.viewLeaderboard}
        </button>
      </div>

      <button
        type="button"
        onClick={share}
        className="btn-ghost mt-2 min-h-11 rounded-xl px-6 py-2.5 text-sm font-semibold"
      >
        {copied ? S.shareCopied : S.shareLabel}
      </button>
      {copied && (
        <p className="mt-2 max-w-md rounded-lg border border-white/10 bg-white/[0.03] p-2 text-center text-xs text-[#8b94a3]">
          {S.shareText(stats.totalScore, DIFFICULTY_LABEL[stats.difficulty])}
        </p>
      )}

      <p className="mt-6 text-center font-mono text-[11px] text-[#5b6472]">
        {S.leaderboardNote}
      </p>
    </div>
  );
}
