// ─── modules/map/tools/draw/DrawDialogs.tsx ─────────────────────────────
// Custom dialogs for the drawing toolkit (spec §2.6, §2.8). Never
// window.confirm. Each dialog carries data-tools-modal="true" so the
// shared keyboard-shortcut hook treats it as modal, and owns Escape
// (capture phase, stopPropagation) so the ToolsProvider doesn't exit the
// active tool underneath it.

"use client";

import { useEffect, useRef } from "react";
import { drawStrings as S } from "./sliceStrings";

function useDialogKeys(onClose: () => void): React.RefObject<HTMLDivElement | null> {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = ref.current;
    // Focus the safe action first.
    el?.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        e.preventDefault();
        onClose();
      }
    };
    // Capture: runs before the ToolsProvider's bubble-phase Esc handler.
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);
  return ref;
}

function DialogShell({
  onClose,
  labelledBy,
  children,
}: {
  onClose: () => void;
  labelledBy: string;
  children: React.ReactNode;
}) {
  const ref = useDialogKeys(onClose);
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={labelledBy}
        data-tools-modal="true"
        className="glass-panel w-full max-w-sm rounded-xl p-4"
      >
        {children}
      </div>
    </div>
  );
}

/** Clear-all confirm: shows count, Cancel / Delete N (spec §2.6). */
export function ConfirmClearDialog({
  count,
  onCancel,
  onConfirm,
}: {
  count: number;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <DialogShell onClose={onCancel} labelledBy={S.clearDrawingsTitle}>
      <h2 className="text-sm font-bold text-white">{S.clearDrawingsTitle}</h2>
      <p className="mt-2 text-[13px] leading-relaxed text-[#b9c2d0]">
        {S.clearDrawingsBody(count)}
      </p>
      <div className="mt-4 flex justify-end gap-2">
        <button
          type="button"
          data-autofocus
          onClick={onCancel}
          className="flex h-11 items-center rounded-lg border border-white/15 px-4 text-sm font-medium text-white transition-colors hover:border-white/40"
        >
          {S.cancel}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className="flex h-11 items-center rounded-lg border border-[#ff2d78]/60 bg-[#ff2d78]/15 px-4 text-sm font-semibold text-[#ff8fb3] transition-colors hover:bg-[#ff2d78]/25"
        >
          {S.deleteDrawings(count)}
        </button>
      </div>
    </DialogShell>
  );
}

export interface ImportReport {
  ok: number;
  skipped: number;
  errors: string[];
  capped: boolean;
}

/** Import summary + per-file error list (spec §2.8). */
export function ImportReportDialog({
  report,
  limit,
  onClose,
}: {
  report: ImportReport;
  limit: number;
  onClose: () => void;
}) {
  return (
    <DialogShell onClose={onClose} labelledBy={S.importTitle}>
      <h2 className="text-sm font-bold text-white">{S.importTitle}</h2>
      <p className="mt-2 text-[13px] leading-relaxed text-[#b9c2d0]">
        {S.importSummary(report.ok, report.skipped)}
      </p>
      {report.capped && (
        <p className="mt-2 text-[13px] text-[#facc15]">
          {S.importTooMany(limit)}
        </p>
      )}
      {report.errors.length > 0 && (
        <div className="mt-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-white/70">
            {S.importErrors}
          </p>
          <ul className="mt-1 max-h-32 list-disc overflow-y-auto pl-5 text-xs leading-relaxed text-[#b9c2d0]">
            {report.errors.map((err, i) => (
              <li key={i}>{err}</li>
            ))}
          </ul>
        </div>
      )}
      <div className="mt-4 flex justify-end">
        <button
          type="button"
          data-autofocus
          onClick={onClose}
          className="flex h-11 items-center rounded-lg border border-[#22d3ee]/50 bg-[#22d3ee]/10 px-4 text-sm font-semibold text-[#7ee7f7] transition-colors hover:bg-[#22d3ee]/20"
        >
          {S.done}
        </button>
      </div>
    </DialogShell>
  );
}

/** 200-drawing limit notice (spec §2.9). Non-modal, auto-dismissing. */
export function LimitNotice({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 6000);
    return () => clearTimeout(t);
  }, [onClose]);
  return (
    <div
      role="status"
      className="pointer-events-auto absolute left-1/2 top-20 z-30 w-max max-w-[calc(100%-2rem)] -translate-x-1/2 rounded-lg border border-[#facc15]/40 bg-black/80 px-4 py-2.5 text-center font-mono text-xs text-[#facc15] backdrop-blur"
    >
      {S.drawingLimit(200)}
    </div>
  );
}
