"use client";

// ─── ClueCard.tsx — the per-round clue dossier ──────────────────────────────
// In order: evidence badge + evidence detail (always free) → primary written
// clue (name-masked) → difficulty label. NEVER shows the answer, the region
// name, a photo, or the truth coordinates. Hint 1 reveals `region`; hint 2
// reveals `realWorldInspiration`. Each hint costs 100 pts.

import { EVIDENCE_META } from "@/modules/entities/types";
import { gameStrings as S } from "../strings";
import { HINT_COST, MAX_HINTS_PER_ROUND, DIFFICULTY_LABEL } from "../engine";
import type { GameDifficulty, RoundTarget } from "../gameData";

export default function ClueCard({
  target,
  difficulty,
  roundLabel,
  hintsUsed,
  hintsRevealed,
  onHint,
}: {
  target: RoundTarget;
  difficulty: GameDifficulty;
  roundLabel: string;
  hintsUsed: number;
  /** Which hints have been revealed: index 0 = region, 1 = real-world echo. */
  hintsRevealed: boolean[];
  onHint: (index: 0 | 1) => void;
}) {
  const meta = EVIDENCE_META[target.location.evidence.status];
  const region = (target.location as { region?: string }).region ?? "";
  const echo = target.location.realWorldInspiration;

  return (
    <section
      aria-label={S.dossierTitle}
      className="glass-panel flex flex-col gap-3 rounded-2xl p-4 sm:p-5"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display text-lg tracking-wide text-white">{S.dossierTitle}</h2>
        <span className="font-mono text-xs text-[#8b94a3]">{roundLabel}</span>
      </div>

      {/* Evidence — always free, always visible */}
      <div className="flex flex-wrap items-center gap-2">
        <span className={`badge ${meta.className}`} title={meta.blurb}>
          {meta.label}
        </span>
        <span className="text-xs text-[#8b94a3]">
          {S.evidenceLabel}: {target.location.evidence.detail}
        </span>
      </div>

      {/* Primary clue — name masked */}
      <p className="text-[15px] leading-relaxed text-[#e8ecf1]">
        <span className="mb-1 block font-mono text-[11px] uppercase tracking-widest text-[#8b94a3]">
          {S.clueLabel}
        </span>
        {target.pin.clue}
      </p>

      {/* Difficulty tier label */}
      <p className="text-xs text-[#8b94a3]">
        {S.difficultyLabel}:{" "}
        <span className="font-semibold text-white">{DIFFICULTY_LABEL[difficulty]}</span>
      </p>

      {/* Hints — 2 per round, −100 pts each */}
      <div className="border-t border-white/10 pt-3">
        <p className="mb-2 font-mono text-[11px] uppercase tracking-widest text-[#8b94a3]">
          {S.hintCostNote}
        </p>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => onHint(0)}
            disabled={hintsRevealed[0]}
            className="btn-ghost min-h-11 rounded-xl px-3 py-2.5 text-left text-sm disabled:cursor-default disabled:opacity-100"
          >
            <span className="font-semibold text-[#22d3ee]">{S.hint1Label}</span>
            {hintsRevealed[0] ? (
              <span className="mt-1 block text-white">{region}</span>
            ) : (
              <span className="ml-2 font-mono text-[11px] text-[#8b94a3]">
                {S.hintTapCost(HINT_COST)}
              </span>
            )}
          </button>
          {echo ? (
            <button
              type="button"
              onClick={() => onHint(1)}
              disabled={hintsRevealed[1]}
              className="btn-ghost min-h-11 rounded-xl px-3 py-2.5 text-left text-sm disabled:cursor-default disabled:opacity-100"
            >
              <span className="font-semibold text-[#22d3ee]">{S.hint2Label}</span>
              {hintsRevealed[1] ? (
                <span className="mt-1 block text-white">{echo}</span>
              ) : (
                <span className="ml-2 font-mono text-[11px] text-[#8b94a3]">
                  {S.hintTapCost(HINT_COST)}
                </span>
              )}
            </button>
          ) : (
            <p
              className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-xs text-[#8b94a3]"
              aria-disabled="true"
            >
              <span className="font-semibold text-[#8b94a3]">{S.hint2Label}</span>
              <span className="mt-1 block">{S.hint2Unavailable}</span>
            </p>
          )}
        </div>
        {hintsUsed >= MAX_HINTS_PER_ROUND && (
          <p className="mt-2 text-[11px] text-[#8b94a3]">{S.bothHintsUsed}</p>
        )}
      </div>
    </section>
  );
}
