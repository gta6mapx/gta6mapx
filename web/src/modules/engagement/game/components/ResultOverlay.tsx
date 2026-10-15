"use client";

// ─── ResultOverlay.tsx — per-round result breakdown ─────────────────────────
// Truth pin + guess→truth line are drawn on the map by GameMapView; this
// overlay shows the score breakdown: tier name, error km (1 decimal),
// distance points, time bonus, streak multiplier, hint deductions, round
// total, running total. Always carries the approximate-pin honesty line.

import { gameStrings as S } from "../strings";
import type { RoundScoreResult } from "../engine";

export interface ResultInfo {
  locationName: string;
  score: RoundScoreResult;
  errorKm: number | null;
  elapsedSec: number;
  runningTotal: number;
  isLastRound: boolean;
  timedOut: boolean;
}

export default function ResultOverlay({
  info,
  onNext,
}: {
  info: ResultInfo;
  onNext: () => void;
}) {
  const s = info.score;
  const rows: { label: string; value: string; dim?: boolean }[] = [
    { label: S.tierLine(s.distance.name), value: S.errorKm(info.errorKm ?? 0) },
    { label: S.distancePointsLabel, value: S.distancePoints(s.distancePts) },
    { label: S.timeBonusLabel, value: `+${s.timeBonusPts}` },
    {
      label: S.streakMultLabel,
      value: `×${s.streakMult.toFixed(2)}`,
      dim: s.streakMult === 1,
    },
    ...(s.hintsUsed > 0
      ? [{ label: S.hintsLabel, value: S.hintDeduction(s.hintsUsed) }]
      : []),
  ];
  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-label="Round result"
      className="glass-panel w-full max-w-md rounded-2xl p-5"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-display text-xl tracking-wide text-white">
          {info.locationName}
        </h2>
        <span className="shrink-0 font-mono text-xs text-[#8b94a3]">
          {info.elapsedSec.toFixed(0)}s
        </span>
      </div>
      {info.timedOut && (
        <p className="mt-2 rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          <span className="font-semibold">{S.roundTimeout} </span>
          {S.timeoutNote}
        </p>
      )}
      <dl className="mt-3 space-y-1.5 text-sm">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between gap-3">
            <dt className={r.dim ? "text-[#5b6472]" : "text-[#c3cad4]"}>{r.label}</dt>
            <dd className={`font-mono font-semibold ${r.dim ? "text-[#5b6472]" : "text-white"}`}>
              {r.value}
            </dd>
          </div>
        ))}
      </dl>
      <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-3">
        <span className="text-sm font-semibold uppercase tracking-widest text-[#8b94a3]">
          {S.roundTotal}
        </span>
        <span className="font-display text-3xl text-[#22d3ee]">
          {s.roundScore.toLocaleString()}
        </span>
      </div>
      <p className="mt-1 text-right font-mono text-xs text-[#8b94a3]">
        {S.runningTotal}: {info.runningTotal.toLocaleString()}
      </p>
      <p className="mt-3 text-[11px] leading-snug text-[#8b94a3]">
        {S.approximateHonesty}
      </p>
      <button
        type="button"
        onClick={onNext}
        autoFocus
        className="btn-neon mt-4 min-h-11 w-full rounded-xl px-4 py-2.5 text-base font-bold"
      >
        {info.isLastRound ? S.seeResults : S.nextRound}
      </button>
    </div>
  );
}
