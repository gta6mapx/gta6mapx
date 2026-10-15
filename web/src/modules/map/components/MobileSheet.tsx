"use client";

import { useRef, type ReactNode } from "react";

interface MobileSheetProps {
  onClose(): void;
  children: ReactNode;
  actionBar?: ReactNode;
}

/**
 * MobileSheet — bottom sheet restyled per the design system (§9):
 * rounded-t glass, 62dvh max, drag-handle swipe-to-dismiss.
 * Swipe-down-to-dismiss via Pointer Events — no gesture library.
 * Only the drag handle captures the gesture (touch-action: none on the
 * handle only); the sheet body keeps native scroll.
 */
export default function MobileSheet({ onClose, children, actionBar }: MobileSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ startY: number; active: boolean } | null>(null);

  const setSheetY = (dy: number, animate: boolean) => {
    const el = sheetRef.current;
    if (!el) return;
    el.style.transition = animate ? "transform 0.25s ease-out" : "none";
    el.style.transform = dy > 0 ? `translateY(${dy}px)` : "";
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    drag.current = { startY: e.clientY, active: true };
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* pointer already released on some mobile browsers */
    }
    setSheetY(0, false);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const s = drag.current;
    if (!s?.active) return;
    const dy = e.clientY - s.startY;
    if (dy > 0) setSheetY(dy, false); // drag down only
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const s = drag.current;
    if (!s?.active) return;
    drag.current = null;
    const dy = e.clientY - s.startY;
    if (dy > 90) onClose(); // flung far enough → dismiss
    else setSheetY(0, true); // snap back
  };

  const onPointerCancel = () => {
    drag.current = null;
    setSheetY(0, true);
  };

  return (
    <div
      ref={sheetRef}
      role="dialog"
      aria-modal="false"
      aria-label="Details"
      className="glass-panel fixed inset-x-0 bottom-0 z-30 flex max-h-[62dvh] flex-col overflow-hidden rounded-t-2xl border-b-0 md:hidden"
    >
      {/* Drag handle — the only touch-action:none zone */}
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        aria-hidden="true"
        title="Drag down to close"
        className="shrink-0 cursor-grab touch-none py-3 active:cursor-grabbing"
      >
        <div className="mx-auto h-1 w-10 rounded-full bg-[#2a3342]" />
      </div>

      {/* Scrollable content */}
      <div className="min-h-0 flex-1 overflow-y-auto px-4">{children}</div>

      {/* Sticky action bar */}
      {actionBar && (
        <div
          className="shrink-0 border-t border-white/10 bg-black/30 px-4 py-3"
          style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
        >
          {actionBar}
        </div>
      )}
    </div>
  );
}
