// ─── modules/map/tools/components/toolbar/ShortcutsDialog.tsx ─────────
// "?" cheat-sheet dialog (spec §6.4). Focus-trapped-ish: autofocuses the
// close button, Esc closes. data-tools-modal marks it so the global
// shortcut hook stands down while open.

"use client";

import { useEffect, useRef } from "react";
import { useTools } from "../../shared/toolRuntime";

interface ShortcutsDialogProps {
  onClose: () => void;
}

export default function ShortcutsDialog({ onClose }: ShortcutsDialogProps) {
  const { strings } = useTools();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "?") {
        e.stopPropagation();
        onClose();
      }
      // Simple focus trap: keep Tab inside the dialog.
      if (e.key === "Tab") {
        const dlg = document.querySelector(
          '[role="dialog"][data-tools-modal="true"]'
        );
        if (!dlg) return;
        const focusables = dlg.querySelectorAll<HTMLElement>(
          'button, [href], [tabindex]:not([tabindex="-1"])'
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  const groups: Array<{
    title: string;
    rows: Array<[string, string]>;
  }> = [
    {
      title: strings.shortcutGroupTools,
      rows: [
        [strings.toolNavigate, "V"],
        [strings.toolPen, "P"],
        [strings.toolLine, "L"],
        [strings.toolRect, "R"],
        [strings.toolCircle, "C"],
        [strings.toolMeasureDistance, "M"],
        [strings.toolMeasureArea, "A"],
        [strings.toolOverlays, "O"],
        [strings.toolDisplay, "D"],
      ],
    },
    {
      title: strings.shortcutGroupEdit,
      rows: [
        [strings.scUndo, "Ctrl/⌘ Z"],
        [strings.scRedo, "Ctrl/⌘ ⇧ Z"],
        [strings.scDelete, "Del"],
      ],
    },
    {
      title: strings.shortcutGroupView,
      rows: [
        [strings.scGrid, "G"],
        [strings.scHeatmap, "H"],
        [strings.scFov, "F"],
        [strings.scZoomIn, "+"],
        [strings.scZoomOut, "−"],
      ],
    },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={strings.shortcutsTitle}
        data-tools-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="glass-panel w-full max-w-md rounded-2xl p-5"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wider text-white">
            {strings.shortcutsTitle}
          </h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label={strings.shortcutsClose}
            className="flex h-9 w-9 items-center justify-center rounded-md border border-white/15 text-white hover:border-[#ff50c5]/60"
          >
            ✕
          </button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {groups.map((g) => (
            <div key={g.title}>
              <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[#8b94a3]">
                {g.title}
              </h3>
              <dl className="space-y-1.5">
                {g.rows.map(([label, key]) => (
                  <div
                    key={label}
                    className="flex items-center justify-between gap-2 text-sm"
                  >
                    <dt className="text-[#c6cdd8]">{label}</dt>
                    <dd>
                      <kbd className="rounded border border-white/15 bg-white/5 px-1.5 py-0.5 font-mono text-[11px] text-white">
                        {key}
                      </kbd>
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
