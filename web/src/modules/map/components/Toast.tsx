"use client";

interface ToastProps {
  message: string | null;
}

/**
 * Toast — bottom-center transient message with a cyan accent.
 * Parent controls visibility and auto-dismiss by setting `message` to null.
 */
export default function Toast({ message }: ToastProps) {
  if (!message) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-8 z-50 flex justify-center px-4">
      <div
        role="status"
        aria-live="polite"
        className="glass-panel flex max-w-md items-center gap-2.5 border-l-2 border-l-[#8b5cf6] px-4 py-2.5 text-sm text-[#e8ecf1] shadow-[0_8px_32px_rgba(0,0,0,0.6)]"
      >
        <span
          className="h-2 w-2 shrink-0 rounded-full bg-[#8b5cf6]"
          style={{ boxShadow: "0 0 10px #8b5cf6" }}
          aria-hidden="true"
        />
        <span className="min-w-0">{message}</span>
      </div>
    </div>
  );
}
