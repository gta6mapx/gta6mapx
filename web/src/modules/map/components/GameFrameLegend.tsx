"use client";

interface GameFrameLegendProps {
  onDismiss: () => void;
}

/**
 * GameFrameLegend — one-line honesty legend for Real Florida mode.
 * Explains that the dashed game-world outline is an approximate projection.
 * Dismissible; persistence of the dismissal is the parent's job.
 */
export default function GameFrameLegend({ onDismiss }: GameFrameLegendProps) {
  return (
    <div
      role="note"
      className="pointer-events-auto absolute bottom-14 left-1/2 z-20 max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-full border border-white/15 bg-black/60 px-3 py-1.5 text-center text-[11px] text-white/85 shadow-[0_2px_12px_rgba(0,0,0,0.5)] backdrop-blur-md"
    >
      <span className="mr-2">
        Dashed outline ≈ Leonida game world projected onto Florida — approximate.
      </span>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss legend"
        title="Dismiss"
        className="inline-flex min-h-[24px] min-w-[24px] items-center justify-center rounded-full text-white/60 transition-colors hover:bg-white/10 hover:text-white"
      >
        <span aria-hidden="true">×</span>
      </button>
    </div>
  );
}
