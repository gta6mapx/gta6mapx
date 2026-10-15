"use client";

interface ProgressMeterProps {
  found: number;
  total: number;
}

/**
 * ProgressMeter — "X of Y found" with a sunset-orange gradient bar.
 * Never an opaque number: the noun is always attached.
 */
export default function ProgressMeter({ found, total }: ProgressMeterProps) {
  const pct = total > 0 ? Math.min(100, Math.max(0, (found / total) * 100)) : 0;

  return (
    <div
      className="glass-panel pointer-events-auto w-full max-w-[280px] px-3.5 py-2.5"
      role="group"
      aria-label="Collection progress"
    >
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-sm font-semibold text-[#e8ecf1]">
          {found} <span className="font-normal text-[#8b94a3]">of {total} found</span>
        </p>
        <p className="font-mono text-xs text-[#ff50c5]" aria-hidden="true">
          {Math.round(pct)}%
        </p>
      </div>
      <div
        className="mt-2 h-2 overflow-hidden rounded-full bg-white/10"
        role="progressbar"
        aria-valuenow={found}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-label={`${found} of ${total} locations found`}
      >
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#ff50c5] via-[#a855f7] to-[#8b5cf6] transition-[width] duration-500"
          style={{ width: `${pct}%`, boxShadow: "0 0 12px rgba(255,80,197,0.55)" }}
        />
      </div>
    </div>
  );
}
