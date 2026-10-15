"use client";

// ─── StartScreen.tsx — pre-game screen ──────────────────────────────────────
// One-line how-to-play, 3 difficulty mode cards with LIVE pool sizes from the
// eligibility filter, first-run name entry (stored locally), keyboard-controls
// disclosure, returning-player best score + games played.

import { useMemo, useState } from "react";
import { gameStrings as S } from "../strings";
import { getEligibleTargets, type GameDifficulty } from "../gameData";
import type { PlayerProfile } from "../storage";

const MODES: { id: GameDifficulty; label: string; blurb: string }[] = [
  { id: "easy", label: S.difficultyEasy, blurb: S.difficultyEasyBlurb },
  { id: "medium", label: S.difficultyMedium, blurb: S.difficultyMediumBlurb },
  { id: "hard", label: S.difficultyHard, blurb: S.difficultyHardBlurb },
];

export default function StartScreen({
  player,
  onSaveName,
  onStart,
  onLeaderboard,
}: {
  player: PlayerProfile;
  onSaveName: (name: string) => void;
  onStart: (difficulty: GameDifficulty) => void;
  onLeaderboard: () => void;
}) {
  const [difficulty, setDifficulty] = useState<GameDifficulty>("medium");
  const [editingName, setEditingName] = useState(player.name === "");
  const [nameDraft, setNameDraft] = useState(player.name);

  const poolSizes = useMemo(() => {
    const sizes = {} as Record<GameDifficulty, number>;
    for (const m of MODES) sizes[m.id] = getEligibleTargets(m.id).length;
    return sizes;
  }, []);

  const returning = player.gamesPlayed > 0;

  const saveName = () => {
    const trimmed = nameDraft.trim().slice(0, 24);
    onSaveName(trimmed);
    setEditingName(false);
  };

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col items-center px-4 py-10 sm:py-14">
      <p className="font-mono text-xs uppercase tracking-[0.3em] text-[#22d3ee]">
        {S.gameEyebrow}
      </p>
      <h1 className="font-display mt-2 text-center text-5xl tracking-wide text-white sm:text-6xl">
        {S.gameName}
      </h1>
      <p className="font-display mt-1 text-xl text-[#ff2d78]">{S.gameTagline}</p>
      <p className="mt-4 max-w-xl text-center text-[15px] leading-relaxed text-[#c3cad4]">
        {S.howToPlay}
      </p>
      <p className="mt-2 font-mono text-xs text-[#8b94a3]">
        {S.fiveRounds} · {S.ninetySeconds} · {S.maxScoreNote}
      </p>

      {/* Callsign — entered once, stored on this device */}
      <div className="glass-panel mt-6 w-full max-w-md rounded-2xl p-4">
        {editingName ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              saveName();
            }}
            className="flex flex-col gap-2"
          >
            <label htmlFor="callsign" className="text-sm font-semibold text-white">
              {S.yourNameLabel}
            </label>
            <div className="flex gap-2">
              <input
                id="callsign"
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                placeholder={S.yourNamePlaceholder}
                maxLength={24}
                autoFocus
                className="min-h-11 min-w-0 flex-1 rounded-lg border border-white/15 bg-white/5 px-3 text-sm text-white placeholder:text-[#5b6472] focus:border-[#22d3ee] focus:outline-none"
              />
              <button type="submit" className="btn-neon min-h-11 rounded-lg px-4 text-sm font-bold">
                {S.saveName}
              </button>
            </div>
            <p className="text-[11px] text-[#8b94a3]">{S.yourNameHint}</p>
          </form>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <p className="min-w-0 text-sm text-[#c3cad4]">
              {S.yourNameLabel}:{" "}
              <span className="truncate font-semibold text-white">
                {player.name || "—"}
              </span>
            </p>
            <button
              type="button"
              onClick={() => {
                setNameDraft(player.name);
                setEditingName(true);
              }}
              className="btn-ghost min-h-11 shrink-0 rounded-lg px-3 text-sm"
            >
              {S.rename}
            </button>
          </div>
        )}
      </div>

      {/* Difficulty cards — live pool sizes */}
      <div
        role="radiogroup"
        aria-label="Difficulty"
        className="mt-6 grid w-full max-w-2xl gap-3 sm:grid-cols-3"
      >
        {MODES.map((m) => {
          const active = difficulty === m.id;
          return (
            <button
              key={m.id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setDifficulty(m.id)}
              className={`min-h-11 rounded-2xl border p-4 text-left transition-colors ${
                active
                  ? "border-[#ff2d78]/70 bg-[rgba(255,45,120,0.08)]"
                  : "glass-panel hover:border-[#22d3ee]/40"
              }`}
            >
              <span className="block text-base font-bold text-white">{m.label}</span>
              <span className="mt-1 block text-xs leading-relaxed text-[#8b94a3]">
                {m.blurb}
              </span>
              <span className="mt-2 block font-mono text-[11px] text-[#22d3ee]">
                {S.poolSize(poolSizes[m.id])}
              </span>
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => onStart(difficulty)}
        className="btn-neon mt-6 min-h-11 rounded-xl px-10 py-3 text-lg font-bold"
      >
        {S.startGame}
      </button>

      {/* Returning player stats + leaderboard link */}
      {returning && (
        <div className="mt-6 flex items-center gap-6">
          <p className="text-sm text-[#8b94a3]">
            {S.bestScore}:{" "}
            <span className="font-mono font-bold text-white">
              {player.bestScore.toLocaleString()}
            </span>
          </p>
          <p className="text-sm text-[#8b94a3]">
            {S.gamesPlayed}:{" "}
            <span className="font-mono font-bold text-white">{player.gamesPlayed}</span>
          </p>
          <button
            type="button"
            onClick={onLeaderboard}
            className="text-sm font-semibold text-[#22d3ee] underline-offset-2 hover:underline"
          >
            {S.viewLeaderboard}
          </button>
        </div>
      )}

      {/* Keyboard controls */}
      <details className="glass-panel mt-8 w-full max-w-2xl rounded-2xl p-4">
        <summary className="cursor-pointer text-sm font-semibold text-white">
          {S.keyboardTitle}
        </summary>
        <p className="mt-2 text-sm leading-relaxed text-[#c3cad4]">
          {S.keyboardControls}
        </p>
      </details>

      <p className="mt-6 text-center font-mono text-[11px] text-[#5b6472]">
        {S.leaderboardNote}
      </p>
    </div>
  );
}
