// ─── modules/community/Leaderboard.tsx ──────────────────────────────────────
// WORKER D — seasonal leaderboard UI (spec §5.1, §5.3).
// Pre-Supabase: device-local only. The board is built from this device's
// "Find the Location" game records, converted into ScoreEvents and ranked
// with the pure scoring formula — the game never writes ranks.

"use client";

import { useMemo, useState } from "react";
import {
  loadGames,
  loadPlayer,
  type GameRecord,
  type PlayerProfile,
} from "@/modules/engagement/game/storage";
import {
  SCORING_EXPLAINER,
  bestPerStillFor,
  byTotalDesc,
  computeRoundScore,
  seasonKey,
  seasonTotal,
} from "@/modules/community/scoring";
import type { ScoreEvent } from "@/modules/community/types";

const ALL_TIME = "all-time";

/**
 * Converts stored game records into ScoreEvents (the contract in spec §5.1).
 * Two honest defaults are documented here because the stored records predate
 * the season formula:
 * - accuracy: records store `distanceScore` (the game's 0–1000 distance-tier
 *   points), not a 0–100 accuracy, so accuracy = distance points ÷ 10.
 * - attemptNumber: records don't track which attempt a round was, so every
 *   round is treated as a first attempt (attemptNumber: 1). This avoids
 *   mislabeling real rounds as replays.
 * roundScore is recomputed with the season formula so the board matches the
 * "How scoring works" explainer.
 */
function eventsFromGames(games: GameRecord[]): ScoreEvent[] {
  const events: ScoreEvent[] = [];
  for (const g of games) {
    const d = new Date(g.date);
    const sk = Number.isNaN(d.getTime())
      ? seasonKey(new Date())
      : seasonKey(d);
    g.rounds.forEach((r, i) => {
      const accuracy = Math.round(
        Math.min(100, Math.max(0, r.distanceScore / 10)),
      );
      events.push({
        id: `${g.id}:round-${i}`,
        stillId: r.locationSlug,
        accuracy,
        elapsedSec: r.elapsedSec,
        attemptNumber: 1,
        roundScore: computeRoundScore(accuracy, r.elapsedSec, 1),
        seasonKey: sk,
        createdAt: g.date,
      });
    });
  }
  return events;
}

interface BoardRow {
  name: string;
  total: number;
  guest: boolean;
}

export default function Leaderboard() {
  const [games] = useState<GameRecord[]>(() => loadGames());
  const [player] = useState<PlayerProfile>(() => loadPlayer());
  const [season, setSeason] = useState<string>(seasonKey(new Date()));
  const [explainerOpen, setExplainerOpen] = useState(false);

  const events = useMemo(() => eventsFromGames(games), [games]);

  const seasons = useMemo(
    () => [...new Set(events.map((e) => e.seasonKey))].sort().reverse(),
    [events],
  );

  const filtered = useMemo(
    () =>
      season === ALL_TIME
        ? events
        : events.filter((e) => e.seasonKey === season),
    [events, season],
  );

  const rows = useMemo<BoardRow[]>(() => {
    const name =
      player && player.name.trim() ? player.name.trim() : "Guest";
    return [
      {
        name,
        total: seasonTotal(bestPerStillFor(filtered)),
        guest: true, // no accounts yet — every row is a guest row
      },
    ].sort(byTotalDesc);
  }, [filtered, player]);

  if (games === null) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 text-center text-[#8b94a3]">
        Loading your device-local scores…
      </div>
    );
  }

  const hasData = events.length > 0;

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">
            Leaderboard
          </h1>
          <p className="mt-1 text-sm text-[#8b94a3]">
            Stored on this device — account sync coming later.
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm text-[#8b94a3]">
          Season
          <select
            value={season}
            onChange={(e) => setSeason(e.target.value)}
            className="rounded-lg border border-white/10 bg-[#11161f] px-3 py-2 text-[#e8ecf1]"
          >
            <option value={ALL_TIME}>All time</option>
            {seasons.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
      </div>

      {!hasData ? (
        <div className="rounded-2xl border border-white/10 bg-[#11161f] p-10 text-center">
          <p className="text-lg font-semibold">No scores on this device yet</p>
          <p className="mt-2 text-sm text-[#8b94a3]">
            Play Find the Location and your rounds will appear here, ranked by
            the season formula below.
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-[#11161f] p-10 text-center">
          <p className="text-lg font-semibold">No games this season yet</p>
          <p className="mt-2 text-sm text-[#8b94a3]">
            Your rounds for {season} will land here once you play.
          </p>
        </div>
      ) : (
        <ol className="overflow-hidden rounded-2xl border border-white/10 bg-[#11161f]">
          {rows.map((row, i) => (
            <li
              key={row.name}
              className="flex items-center gap-4 border-b border-white/5 px-5 py-4 last:border-0"
            >
              <span className="w-8 text-lg font-extrabold text-[#8b94a3]">
                #{i + 1}
              </span>
              <span className="flex-1 font-semibold">{row.name}</span>
              {row.guest && (
                <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs font-medium text-[#8b94a3]">
                  Guest
                </span>
              )}
              <span className="font-mono text-lg font-bold">
                {row.total.toLocaleString("en-US")}
              </span>
            </li>
          ))}
        </ol>
      )}

      {/* Personal bests — from the game itself (its own scoring), not the season formula */}
      <section className="mt-8 rounded-2xl border border-white/10 bg-[#11161f] p-6">
        <h2 className="text-lg font-bold">Your personal bests</h2>
        <div className="mt-4 grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-2xl font-extrabold">
              {(player?.bestScore ?? 0).toLocaleString("en-US")}
            </div>
            <div className="mt-1 text-xs text-[#8b94a3]">Best game score</div>
          </div>
          <div>
            <div className="text-2xl font-extrabold">
              {player?.bestStreak ?? 0}
            </div>
            <div className="mt-1 text-xs text-[#8b94a3]">Best streak</div>
          </div>
          <div>
            <div className="text-2xl font-extrabold">
              {player?.gamesPlayed ?? 0}
            </div>
            <div className="mt-1 text-xs text-[#8b94a3]">Games played</div>
          </div>
        </div>
        <p className="mt-3 text-xs text-[#8b94a3]">
          From Find the Location, which uses its own in-game scoring — separate
          from the leaderboard season formula above.
        </p>
      </section>

      {/* How scoring works */}
      <section className="mt-8 rounded-2xl border border-white/10 bg-[#11161f] p-6">
        <button
          type="button"
          onClick={() => setExplainerOpen((v) => !v)}
          aria-expanded={explainerOpen}
          className="flex w-full items-center justify-between text-left"
        >
          <h2 className="text-lg font-bold">How scoring works</h2>
          <span className="text-[#8b94a3]">{explainerOpen ? "−" : "+"}</span>
        </button>
        {explainerOpen && (
          <div className="mt-4 space-y-3 text-sm leading-relaxed text-[#c6cdd8]">
            {SCORING_EXPLAINER.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
