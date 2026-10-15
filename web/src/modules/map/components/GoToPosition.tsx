"use client";

import { useId, useState } from "react";
import { discoveryStrings as S } from "@/modules/discovery/strings";
import { parseGoToPosition } from "../coordSearch";

interface GoToPositionProps {
  open: boolean;
  onClose(): void;
  /** Called only with validated, in-range coordinates. */
  onGo(lat: number, lng: number): void;
}

/** Original crosshair glyph. */
function CrosshairGlyph() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" className="h-4 w-4" aria-hidden="true">
      <circle cx="10" cy="10" r="6" />
      <path d="M10 1.5v3M10 15.5v3M1.5 10h3M15.5 10h3" />
    </svg>
  );
}

/**
 * GoToPosition — "⌖ Go to position" dialog (spec §3.8). Input labels the
 * frame it expects; out-of-bounds input shows an inline error naming the
 * valid range — never flies to a nonsense location (R7).
 */
export default function GoToPosition({ open, onClose, onGo }: GoToPositionProps) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const inputId = useId();

  if (!open) return null;

  const submit = () => {
    const res = parseGoToPosition(value);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setError(null);
    onGo(res.lat, res.lng);
    setValue("");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={S.goToPositionTitle}>
      <button
        type="button"
        aria-label={S.cancel}
        onClick={onClose}
        className="absolute inset-0 bg-black/60"
      />
      <div className="glass-panel relative w-full max-w-sm rounded-2xl p-5">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[rgba(255,80,197,0.12)] text-[#ff50c5]">
            <CrosshairGlyph />
          </span>
          <h2 className="text-base font-bold text-white">{S.goToPositionTitle}</h2>
        </div>

        <label htmlFor={inputId} className="mt-4 block text-xs font-medium text-[#8b94a3]">
          {S.goToPositionHint}
        </label>
        <input
          id={inputId}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
            if (e.key === "Escape") onClose();
          }}
          placeholder={S.goToPositionPlaceholder}
          inputMode="decimal"
          autoFocus
          aria-invalid={error !== null}
          aria-describedby={error ? `${inputId}-error` : undefined}
          className="mt-1.5 h-11 w-full rounded-lg border border-[#1f2632] bg-black/30 px-3 font-mono text-sm text-[#e8ecf1] placeholder:text-[#5b6472] focus:border-[#8b5cf6] focus:outline-none"
        />
        {error && (
          <p id={`${inputId}-error`} role="alert" className="mt-2 text-xs leading-snug text-[#fca5a5]">
            {error}
          </p>
        )}

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="btn-ghost h-11 flex-1 rounded-[10px] border border-[#1f2632] text-sm font-semibold text-[#c3cad4]"
          >
            {S.cancel}
          </button>
          <button
            type="button"
            onClick={submit}
            className="btn-neon h-11 flex-1 rounded-[10px] bg-gradient-to-r from-[#ff50c5] to-[#a855f7] text-sm font-bold text-white shadow-[0_0_20px_rgba(255,80,197,0.35)] transition hover:brightness-110"
          >
            {S.goToPositionGo}
          </button>
        </div>
      </div>
    </div>
  );
}
