// ─── modules/community/ReportButton.tsx ────────────────────────────────────
// WORKER D — report-a-pin affordance (spec §3.4 threshold rules, §4.5).
// Informational, never fake: the dialog opens and closes, the submit stays
// disabled until accounts exist. Auto-hide at ≥3 reports is configured for
// launch (server-side), not simulated here.

"use client";

import { useState } from "react";

interface ReportButtonProps {
  pinId: string;
}

const REPORT_REASONS = [
  { id: "wrong-location", label: "Wrong location — the pin points to the wrong place" },
  { id: "duplicate", label: "Duplicate — this place is already on the map" },
  { id: "leak-content", label: "Leak content — shows unreleased/leaked material" },
  { id: "spam", label: "Spam or abuse" },
  { id: "other", label: "Other" },
];

export default function ReportButton({ pinId }: ReportButtonProps) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<string | null>(null);

  return (
    <div data-pin-id={pinId}>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 text-xs text-[#8b94a3] transition-colors hover:border-white/25 hover:text-[#e8ecf1]"
      >
        ⚑ Report this pin
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="report-dialog-title"
            className="w-full max-w-md rounded-2xl border border-white/10 bg-[#11161f] p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="report-dialog-title" className="text-lg font-bold">
              Report this pin
            </h2>
            <p className="mt-1 text-xs text-[#8b94a3]">
              What&apos;s wrong with it? Pick the closest reason.
            </p>

            <fieldset className="mt-4 space-y-2">
              <legend className="sr-only">Report reason</legend>
              {REPORT_REASONS.map((r) => (
                <label
                  key={r.id}
                  className={`flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2 text-sm transition-colors ${
                    reason === r.id
                      ? "border-white/30 bg-white/[0.06]"
                      : "border-white/10 hover:border-white/20"
                  }`}
                >
                  <input
                    type="radio"
                    name="report-reason"
                    value={r.id}
                    checked={reason === r.id}
                    onChange={() => setReason(r.id)}
                    className="mt-1"
                  />
                  <span>{r.label}</span>
                </label>
              ))}
            </fieldset>

            <p className="mt-4 text-xs leading-relaxed text-[#8b94a3]">
              Reports need accounts — coming soon. Auto-hide at ≥3 reports is
              configured for launch.
            </p>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setReason(null);
                }}
                className="rounded-lg border border-white/10 px-4 py-2 text-sm text-[#e8ecf1] hover:border-white/25"
              >
                Close
              </button>
              <button
                type="button"
                disabled
                aria-disabled="true"
                title="Reports need accounts — coming soon"
                className="cursor-not-allowed rounded-lg bg-white/10 px-4 py-2 text-sm text-[#8b94a3] opacity-60"
              >
                Submit report
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
