"use client";

// ─── LeaderboardView.tsx — personal-bests leaderboard (Phase 1) ────────────
// Top 10 games + lifetime stats. Everything is local-only: the header says
// "Your personal records — stored on this device". Inline rename for the
// player name.

import { useState } from "react";
import { gameStrings as S } from "../strings";
import { DIFFICULTY_LABEL } from "../engine";
import { loadGames, type PlayerProfile, type GameRecord } from "../storage";

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

export default function LeaderboardView({
  player,
  onSaveName,
  onBack,
}: {
  player: PlayerProfile;
  onSaveName: (name: string) => void;
  onBack: () => void;
}) {
  const [games] = useState<GameRecord[]>(() => loadGames());
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(player.name);

  const top = [...games].sort((a, b) => b.totalScore - a.totalScore).slice(0, 10);
  const avgScore =
    player.gamesPlayed > 0 ? Math.round(player.totalScore / player.gamesPlayed) : 0;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col px-4 py-10">
      <button
        type="button"
        onClick={onBack}
        className="self-start text-sm font-semibold text-[#22d3ee] underline-offset-2 hover:underline"
      >
        ← {S.backToGame}
      </button>
      <h1 className="font-display mt-2 text-4xl tracking-wide text-white">
        {S.leaderboardTitle}
      </h1>
      <p className="mt-1 text-sm text-[#8b94a3]">{S.leaderboardNote}</p>

      {/* Identity + inline rename */}
      <div className="glass-panel mt-4 flex items-center justify-between gap-3 rounded-2xl p-4">
        {editingName ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              onSaveName(nameDraft.trim().slice(0, 24));
              setEditingName(false);
            }}
            className="flex w-full gap-2"
          >
            <input
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              aria-label={S.yourNameLabel}
              maxLength={24}
              autoFocus
              className="min-h-11 min-w-0 flex-1 rounded-lg border border-white/15 bg-white/5 px-3 text-sm text-white placeholder:text-[#5b6472] focus:border-[#22d3ee] focus:outline-none"
            />
            <button type="submit" className="btn-neon min-h-11 rounded-lg px-4 text-sm font-bold">
              {S.saveName}
            </button>
          </form>
        ) : (
          <>
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
          </>
        )}
      </div>

      {/* Lifetime stats */}
      <h2 className="mt-6 font-mono text-xs uppercase tracking-[0.25em] text-[#8b94a3]">
        {S.lifetimeStats}
      </h2>
      <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {[
          [S.gamesPlayed, String(player.gamesPlayed)],
          [S.bestScore, player.bestScore.toLocaleString()],
          [S.bestStreak, String(player.bestStreak)],
          [S.averageScore, avgScore.toLocaleString()],
          [S.totalScore, player.totalScore.toLocaleString()],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-center">
            <p className="font-mono text-[10px] uppercase tracking-widest text-[#8b94a3]">
              {label}
            </p>
            <p className="mt-1 font-mono text-lg font-bold text-white">{value}</p>
          </div>
        ))}
      </div>

      {/* Top 10 games */}
      <h2 className="mt-6 font-mono text-xs uppercase tracking-[0.25em] text-[#8b94a3]">
        {S.topGames}
      </h2>
      {top.length === 0 ? (
        <p className="glass-panel mt-2 rounded-2xl p-6 text-center text-sm text-[#8b94a3]">
          {S.noGamesYet}
        </p>
      ) : (
        <ol className="mt-2 space-y-2">
          {top.map((g, i) => (
            <li
              key={g.id}
              className="glass-panel flex items-center justify-between gap-3 rounded-xl px-3 py-2.5"
            >
              <span className="flex min-w-0 items-baseline gap-2">
                <span className="font-mono text-xs text-[#8b94a3]">#{i + 1}</span>
                <span className="truncate text-sm text-[#e8ecf1]">
                  {DIFFICULTY_LABEL[g.difficulty]} · {formatDate(g.date)}
                </span>
              </span>
              <span className="shrink-0 text-right">
                <span className="block font-mono text-sm font-bold text-[#22d3ee]">
                  {g.totalScore.toLocaleString()}
                </span>
                <span className="block font-mono text-[10px] text-[#8b94a3]">
                  streak {g.bestStreak} · {g.hintsUsed} hints
                </span>
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
