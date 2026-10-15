"use client";

// ─── admin/gtadb-review ReviewCard ────────────────────────────────────────────
// One record, one review form. The owner's approve click is the only publish
// path — no auto-anything.

import { useState } from "react";
import { EVIDENCE_META, type EvidenceStatus } from "@/modules/entities/types";
import EvidenceBadge from "@/modules/entities/components/EvidenceBadge";
import type { StagedNamedRecord } from "@/modules/entities/data/gtadb/schema";
import type { DedupeCandidate } from "@/modules/entities/data/gtadb/dedupe-candidates";
import {
  approveRecord,
  rejectRecord,
  reopenRecord,
  unpublishRecord,
} from "./actions";

const STATUSES: EvidenceStatus[] = [
  "rockstar-confirmed",
  "trailer-confirmed",
  "leak-reported",
  "disputed",
];

export default function ReviewCard({
  record,
  dedupe,
  status,
}: {
  record: StagedNamedRecord;
  dedupe?: DedupeCandidate;
  status?: { status: "approved" | "rejected"; at: string; note?: string; slug: string };
}) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [showReject, setShowReject] = useState(false);
  const [reason, setReason] = useState("");

  async function onApprove(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const res = await approveRecord(record.id, new FormData(e.currentTarget));
    setBusy(false);
    setMsg(res.ok ? "✅ Approved & published." : `⛔ ${res.error}`);
    if (res.ok) window.location.reload();
  }

  async function onReject() {
    setBusy(true);
    const res = await rejectRecord(record.id, reason);
    setBusy(false);
    setMsg(res.ok ? "Rejected." : `⛔ ${res.error}`);
    if (res.ok) window.location.reload();
  }

  async function onReopen() {
    setBusy(true);
    const res = await reopenRecord(record.id);
    setBusy(false);
    if (res.ok) window.location.reload();
    else setMsg(`⛔ ${res.error}`);
  }

  async function onUnpublish() {
    if (!confirm(`Unpublish /locations/${record.slug}?`)) return;
    setBusy(true);
    const res = await unpublishRecord(record.slug);
    setBusy(false);
    if (res.ok) window.location.reload();
    else setMsg(`⛔ ${res.error}`);
  }

  const mapUrl = `/map?lat=${record.coords.lat.toFixed(4)}&lng=${record.coords.lng.toFixed(4)}&zoom=14`;

  return (
    <div className="rounded-xl border border-[#1f2632] bg-[#11161f] p-4">
      <div className="flex flex-wrap items-center gap-2 text-xs text-[#8b94a3]">
        <span className="font-mono text-[#5a6270]">{record.id}</span>
        <span className="rounded bg-[#1a2230] px-2 py-0.5">{record.ownerCategory}</span>
        <span className="rounded bg-[#1a2230] px-2 py-0.5">district: {record.district || "—"}</span>
        <span className={`rounded px-2 py-0.5 ${record.needsCoordVerification ? "bg-yellow-500/20 text-yellow-300" : "bg-green-500/10 text-green-400"}`}>
          {record.needsCoordVerification ? "⚠️ coords unverified (extrapolated)" : "✓ coords in validated zone"}
        </span>
        <span className="ml-auto">
          {record.coords.lat.toFixed(4)}, {record.coords.lng.toFixed(4)}{" "}
          <a href={mapUrl} target="_blank" rel="noreferrer" className="text-green-400 hover:underline">
            → open on map
          </a>
        </span>
      </div>

      <div className="mt-2 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold">{record.name}</h3>
          <p className="text-xs text-[#8b94a3]">slug: <span className="font-mono">{record.slug}</span></p>
        </div>
        <EvidenceBadge evidence={{ status: record.evidenceStatus, detail: record.evidenceDetail }} />
      </div>

      <div className="mt-2 flex flex-wrap gap-1">
        {record.gtadbCategory.map((c) => (
          <span key={c} className="rounded bg-[#1a2230] px-2 py-0.5 text-xs text-[#8b94a3]">
            {c}
          </span>
        ))}
        {record.duplicateOf && (
          <span className="rounded bg-red-500/15 px-2 py-0.5 text-xs text-red-300">
            duplicateOf: {record.duplicateOf}
          </span>
        )}
      </div>

      {dedupe && (
        <div className="mt-3 rounded-lg border border-red-500/30 bg-red-500/5 p-3 text-sm">
          <p className="font-bold text-red-300">
            {dedupe.type === "slug-collision" ? "⛔ Slug collision" : "⚠️ Dedupe candidate"} — {dedupe.stagedName}
          </p>
          <p className="mt-1 text-[#c3cad4]">{dedupe.note}</p>
          <p className="mt-1 text-[#8b94a3]">Suggested: {dedupe.suggestedAction}</p>
        </div>
      )}

      {status?.status === "approved" && (
        <div className="mt-3 rounded-lg border border-green-500/30 bg-green-500/5 p-3 text-sm">
          <p className="font-bold text-green-300">✅ Published</p>
          <p className="mt-1 text-[#8b94a3]">
            {status.at} · {status.note}{" "}
            <a href={`/locations/${status.slug}`} target="_blank" rel="noreferrer" className="text-green-400 hover:underline">
              → /locations/{status.slug}
            </a>
          </p>
          <button
            onClick={onUnpublish}
            disabled={busy}
            className="mt-2 rounded bg-red-600/80 px-3 py-1 text-xs font-bold text-white hover:bg-red-600 disabled:opacity-50"
          >
            Unpublish
          </button>
        </div>
      )}

      {status?.status === "rejected" && (
        <div className="mt-3 rounded-lg border border-[#2a3342] bg-[#0d1117] p-3 text-sm">
          <p className="font-bold text-[#8b94a3]">🗑️ Rejected — {status.at}</p>
          <p className="mt-1 text-[#8b94a3]">{status.note}</p>
          <button
            onClick={onReopen}
            disabled={busy}
            className="mt-2 rounded bg-[#232c3b] px-3 py-1 text-xs font-bold text-white hover:bg-[#2c3648] disabled:opacity-50"
          >
            Re-open for review
          </button>
        </div>
      )}

      {(!status || status.status === "rejected") && (
        <form onSubmit={onApprove} className="mt-4 space-y-3">
          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-[#8b94a3]">
              Evidence status (defaults are pessimistic — upgrade only with a citation)
            </label>
            <div className="grid gap-1 sm:grid-cols-2">
              {STATUSES.map((s) => (
                <label key={s} className="flex cursor-pointer items-start gap-2 rounded-lg border border-[#232c3b] p-2 text-xs hover:border-green-500/50">
                  <input
                    type="radio"
                    name="evidenceStatus"
                    value={s}
                    defaultChecked={s === record.evidenceStatus}
                    className="mt-0.5 accent-green-500"
                  />
                  <span>
                    <b className="text-white">{EVIDENCE_META[s].label}</b>
                    <br />
                    <span className="text-[#8b94a3]">{EVIDENCE_META[s].blurb}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-[#8b94a3]">
              Summary — original editorial, ≥ 50 chars
            </label>
            <textarea
              name="summary"
              defaultValue={record.summary}
              rows={3}
              className="w-full rounded-lg border border-[#232c3b] bg-[#0d1117] p-2 text-sm text-white"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-[#8b94a3]">
                Region
              </label>
              <input
                name="region"
                defaultValue={record.region}
                className="w-full rounded-lg border border-[#232c3b] bg-[#0d1117] p-2 text-sm text-white"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-[#8b94a3]">
                Tags (comma-separated)
              </label>
              <input
                name="tags"
                defaultValue={record.tags.join(", ")}
                className="w-full rounded-lg border border-[#232c3b] bg-[#0d1117] p-2 text-sm text-white"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="submit"
              disabled={busy}
              className="rounded-lg bg-green-600 px-4 py-2 text-sm font-bold text-white hover:bg-green-500 disabled:opacity-50"
            >
              {busy ? "Working…" : "✅ Approve & publish → /locations/" + record.slug}
            </button>
            {!showReject ? (
              <button
                type="button"
                onClick={() => setShowReject(true)}
                className="rounded-lg bg-[#232c3b] px-4 py-2 text-sm font-bold text-white hover:bg-[#2c3648]"
              >
                Reject…
              </button>
            ) : (
              <>
                <input
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Rejection reason (≥ 5 chars)"
                  className="flex-1 min-w-[12rem] rounded-lg border border-[#232c3b] bg-[#0d1117] p-2 text-sm text-white"
                />
                <button
                  type="button"
                  onClick={onReject}
                  disabled={busy}
                  className="rounded-lg bg-red-600/80 px-4 py-2 text-sm font-bold text-white hover:bg-red-600 disabled:opacity-50"
                >
                  Confirm reject
                </button>
              </>
            )}
          </div>
          {msg && <p className="text-sm">{msg}</p>}
        </form>
      )}
    </div>
  );
}
