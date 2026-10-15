"use client";

import { useState } from "react";
import type { Pin } from "@/data/pins";
import { CATEGORIES } from "@/data/pins";
import EvidenceBadge from "@/modules/entities/components/EvidenceBadge";
import { EVIDENCE_META } from "@/modules/entities/types";
import { EVIDENCE_COLORS } from "../markerLayer";
import { discoveryStrings as S } from "@/modules/discovery/strings";
// NOTE: ../gameCoords is the single coordinate-truth module: every
// coordinate surface formats through it (anti-false-precision policy).
import { formatLatLng, honestCoordString } from "../gameCoords";

interface CaseFilePanelProps {
  pin: Pin | null;
  found: boolean;
  onToggleFound(id: string): void;
  onShare(): void;
  copied: boolean;
  onClose?(): void;
}

/** Original share-arrow glyph. */
function ShareGlyph() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
      <path d="M12 3h4a1 1 0 0 1 1 1v4" />
      <path d="M16 4 9.5 10.5" />
      <path d="M15 11v4.5a1.5 1.5 0 0 1-1.5 1.5h-8A1.5 1.5 0 0 1 4 15.5v-8A1.5 1.5 0 0 1 5.5 6H10" />
    </svg>
  );
}

function copyText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text);
  return new Promise((resolve) => {
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand("copy");
    } catch {
      /* clipboard unavailable — non-fatal */
    }
    document.body.removeChild(ta);
    resolve();
  });
}

function formatUpdatedAt(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

const AVAILABILITY_LABEL: Record<string, string> = {
  open: "open",
  closed: "closed",
  demolished: "demolished",
  cancelled: "cancelled",
  enterable: "enterable",
};

function entityPath(pin: Pin): string | null {
  if (!pin.entityRef) return null;
  // kinds: vehicle|location|weapon|character → /vehicles, /locations, …
  return `/${pin.entityRef.kind}s/${pin.entityRef.slug}`;
}

/**
 * CaseFilePanel — the dossier detail panel (spec §3.7), in our original
 * case-file design language:
 *  1. Header (name · category chip · evidence badge · intel-updated)
 *  2. Evidence chain (status + source detail + disputed caution)
 *  3. Media block (original abstract plate — never third-party stills)
 *  4. Intel summary (honesty-labeled)
 *  5. Location block (region · coordinates)
 *  6. Entity deep-link ("Open full intel →")
 *  7. Actions (mark found · share · copy coords)
 *  8. Footer note (local progress)
 */
export default function CaseFilePanel({
  pin,
  found,
  onToggleFound,
  onShare,
  copied,
  onClose,
}: CaseFilePanelProps) {
  const [coordCopied, setCoordCopied] = useState(false);

  if (!pin) {
    return (
      <section
        aria-label="Case file"
        className="glass-panel hud-corner pointer-events-auto w-[320px] max-w-full p-5"
      >
        <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#8b94a3]">
          Case file
        </p>
        <p className="mt-2 text-sm text-[#c3cad4]">{S.selectPinHint}</p>
      </section>
    );
  }

  const category = CATEGORIES.find((c) => c.slug === pin.categorySlug);
  const meta = EVIDENCE_META[pin.evidence.status];
  const statusColor = EVIDENCE_COLORS[pin.evidence.status];
  const intelPath = entityPath(pin);

  const copyCoords = async () => {
    await copyText(honestCoordString(pin.lat, pin.lng));
    setCoordCopied(true);
    window.setTimeout(() => setCoordCopied(false), 1600);
  };

  return (
    <section
      aria-label={`Case file: ${pin.name}`}
      className="glass-panel hud-corner pointer-events-auto flex w-[320px] max-w-full flex-col gap-3.5 p-4"
    >
      {/* 1 — Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#8b94a3]">
            Case file
          </p>
          <h2 className="mt-1 text-lg font-extrabold leading-tight text-[#e8ecf1]">
            {pin.name}
          </h2>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            {category && (
              <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] font-semibold text-[#c3cad4]">
                <span aria-hidden="true">{category.icon} </span>
                {category.name}
              </span>
            )}
            <EvidenceBadge evidence={pin.evidence} />
          </div>
          <p className="mt-1 text-[11px] text-[#5b6472]">
            {S.intelUpdated(formatUpdatedAt(pin.updatedAt))}
          </p>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close case file"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-lg leading-none text-[#8b94a3] transition-colors hover:bg-white/5 hover:text-white"
          >
            ×
          </button>
        )}
      </div>

      {/* 2 — Evidence chain (our differentiator — most prominent after name) */}
      <div aria-label="Evidence chain" className="flex flex-col gap-2">
        <div className="flex items-center gap-2.5 rounded-lg border border-white/5 bg-black/20 px-3 py-2">
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: statusColor, boxShadow: `0 0 8px ${statusColor}` }}
            aria-hidden="true"
          />
          <span className="w-14 shrink-0 text-[11px] font-bold uppercase tracking-[0.08em] text-[#8b94a3]">
            Status
          </span>
          <span className="text-sm font-semibold text-[#e8ecf1]" title={meta.blurb}>
            {meta.label}
          </span>
        </div>
        <div className="flex items-center gap-2.5 rounded-lg border border-white/5 bg-black/20 px-3 py-2">
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-full bg-[#8b5cf6]"
            style={{ boxShadow: "0 0 8px #8b5cf6" }}
            aria-hidden="true"
          />
          <span className="w-14 shrink-0 text-[11px] font-bold uppercase tracking-[0.08em] text-[#8b94a3]">
            Source
          </span>
          {pin.sourceUrl ? (
            <a
              href={pin.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="min-w-0 flex-1 truncate text-sm text-[#8b5cf6] underline-offset-2 hover:underline"
            >
              {pin.evidence.detail}
            </a>
          ) : (
            <span className="min-w-0 flex-1 truncate text-sm text-[#e8ecf1]">
              {pin.evidence.detail}
            </span>
          )}
        </div>
        {pin.evidence.status === "disputed" && (
          <p
            role="note"
            className="rounded-lg border border-[rgba(252,165,165,0.25)] bg-[rgba(239,68,68,0.08)] px-3 py-2 text-xs leading-snug text-[#fca5a5]"
          >
            {S.disputedCaution}
          </p>
        )}
        {pin.availability && (
          <p className="px-1 text-xs text-[#8b94a3]">
            {S.availabilityNote(AVAILABILITY_LABEL[pin.availability] ?? pin.availability)}
          </p>
        )}
      </div>

      {/* 3 — Media block: original abstract plate, never a third-party still */}
      <figure>
        <div className="relative aspect-video overflow-hidden rounded-[10px] border border-[rgba(255,80,197,0.25)]">
          <div
            className="absolute inset-0 bg-gradient-to-br from-[#33143c] via-[#161226] to-[#0a1826]"
            aria-hidden="true"
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(60% 50% at 70% 20%, rgba(255,80,197,0.28), transparent 70%), radial-gradient(50% 45% at 25% 80%, rgba(139,92,246,0.18), transparent 70%)",
            }}
            aria-hidden="true"
          />
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
            <span className="text-4xl" aria-hidden="true">
              {category?.icon ?? "📍"}
            </span>
            <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#8b94a3]">
              Intel plate
            </span>
          </div>
        </div>
        <figcaption className="mt-1.5 text-[11px] text-[#8b94a3]">
          Intel plate — imagery at launch
        </figcaption>
      </figure>

      {/* 4 — Intel summary */}
      <p className="text-sm leading-relaxed text-[#c3cad4]">{pin.description}</p>

      {/* 5 — Location block: region + mono coordinates, copy-on-click */}
      <button
        type="button"
        onClick={copyCoords}
        title={S.copyCoords}
        className="group flex items-center gap-2 rounded-lg border border-white/5 bg-black/20 px-3 py-2 text-left transition-colors hover:border-[rgba(139,92,246,0.35)]"
      >
        <span className="min-w-0 flex-1 truncate font-mono text-xs text-[#8b5cf6]">
          {pin.region} · {formatLatLng(pin.lat, pin.lng)}{" "}
          <span className="text-[#8b94a3]">· #{pin.id}</span>
        </span>
        <span className="shrink-0 text-[11px] uppercase tracking-wider text-[#8b94a3] group-hover:text-[#8b5cf6]">
          {coordCopied ? S.copied : S.copyCoords}
        </span>
      </button>

      {/* 6 — Entity deep-link */}
      {intelPath && (
        <a
          href={intelPath}
          className="block rounded-lg border border-[rgba(255,80,197,0.25)] bg-[rgba(255,80,197,0.06)] px-3 py-2.5 text-center text-sm font-bold text-[#ff8fb3] transition-colors hover:border-[rgba(255,80,197,0.5)] hover:text-white"
        >
          {S.openFullIntel}
        </a>
      )}

      {/* 7 — Actions */}
      <div className="flex items-center gap-2">
        {found ? (
          <button
            type="button"
            onClick={() => onToggleFound(pin.id)}
            aria-pressed={true}
            className="btn-ghost h-11 flex-1 rounded-[10px] border border-[#1f2632] text-sm font-semibold text-[#c3cad4] transition-colors hover:border-[rgba(255,80,197,0.6)] hover:text-white"
          >
            ✓ Found — undo
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onToggleFound(pin.id)}
            aria-pressed={false}
            className="btn-neon h-11 flex-1 rounded-[10px] bg-gradient-to-r from-[#ff50c5] to-[#a855f7] text-sm font-bold text-white shadow-[0_0_20px_rgba(255,80,197,0.35)] transition hover:brightness-110 active:scale-[0.99]"
          >
            Mark as found
          </button>
        )}
        <button
          type="button"
          onClick={onShare}
          aria-label={S.sharePin}
          title={copied ? S.linkCopied : S.sharePin}
          className={`btn-ghost flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] border border-[#1f2632] transition-colors ${
            copied ? "text-[#8b5cf6]" : "text-[#c3cad4] hover:border-[rgba(255,80,197,0.6)] hover:text-white"
          }`}
        >
          <ShareGlyph />
        </button>
      </div>

      {/* 8 — Footer note */}
      <p className="text-center text-[11px] text-[#5b6472]">{S.progressSavedNote}</p>
    </section>
  );
}
