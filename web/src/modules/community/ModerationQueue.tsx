"use client";

// ─── modules/community/ModerationQueue.tsx ──────────────────────────────────
// WORKER C — guest-local moderation queue preview (community-spec.md §3.2).
// DEV-ONLY: visible only when localStorage `gta6mapx_admin_v1` === "1".
// The production queue lives behind auth + roles (NEEDS-SUPABASE).
//
// Honesty rules enforced here, in code AND copy:
// - Approving sets submission status "approved" only. The default honesty
//   status on publish is leak-reported; rockstar-confirmed can NEVER be
//   granted from this queue.
// - Community votes can never change evidence status — the confirm counter
//   renders on a separate data path and the ≥25 "review suggestion" is
//   display-only.

import { useCallback, useEffect, useMemo, useState } from "react";
import type { CommunitySubmission, RejectionReason, SubmissionStatus } from "./types";
import { getRepositories } from "./communityClient";
import {
  HIGH_INTEREST_CONFIRMS,
  isAdminFlagSet,
  setSubmissionStatus,
} from "./submissionLogic";

const STATUSES: { value: SubmissionStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "in-review", label: "In review" },
  { value: "needs-info", label: "Needs info" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
];

/** Fixed rejection taxonomy with user-facing wording (spec §3.2 / §3.4). */
const REJECTION_REASONS: { value: RejectionReason; wording: string }[] = [
  { value: "duplicate", wording: "This location is already on the map — we've linked your submission to the existing pin." },
  { value: "insufficient-evidence", wording: "We couldn't verify this from the evidence provided. Add a trailer timestamp or a public source link and resubmit." },
  { value: "leak-content", wording: "We can't accept leaked game files or datamined material (legal risk). You're welcome to resubmit describing what public reporting says about this spot, with a news link." },
  { value: "wrong-location", wording: "The evidence points to a different spot than your pin. Check the location and resubmit." },
  { value: "low-quality", wording: "The description is too thin to publish — tell us what's actually visible there and why it matters." },
  { value: "wrong-category", wording: "This belongs in a different category. We've noted it — please resubmit under the right one." },
  { value: "spam", wording: "This looks like spam. Repeated spam leads to account suspension." },
  { value: "abuse", wording: "This submission violates our content rules (profanity/harassment). Repeated violations lead to suspension." },
  { value: "stale", wording: "Closed after 7 days without the requested information. You can resubmit any time with the details." },
  { value: "out-of-scope", wording: "This isn't a map-able location (e.g. a general tip or opinion). Try our guides section instead." },
];

const STATUS_BADGE: Record<SubmissionStatus, string> = {
  pending: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  "in-review": "border-cyan-500/40 bg-cyan-500/10 text-cyan-300",
  approved: "border-green-500/40 bg-green-500/10 text-green-300",
  rejected: "border-red-500/40 bg-red-500/10 text-red-300",
  "needs-info": "border-purple-500/40 bg-purple-500/10 text-purple-300",
};

const inputCls =
  "w-full rounded-lg border border-[#232c3b] bg-[#0d1117] px-3 py-2 text-sm text-white placeholder-[#5b6472] focus:border-cyan-400 focus:outline-none";

function evidenceSummary(s: CommunitySubmission): string {
  const e = s.evidence;
  switch (e.sourceType) {
    case "trailer":
      return `Trailer ${e.trailerName ?? ""} @ ${e.trailerTimestamp ?? ""}`.trim();
    case "leak_report":
      return `Leak report — ${e.sourceUrl ?? ""}`;
    case "rockstar_official":
      return `Rockstar official — ${e.sourceUrl ?? ""}`;
    case "other_public":
      return `Other public — ${(e.sourceDescription ?? "").slice(0, 80)}…`;
  }
}

export default function ModerationQueue() {
  const [allowed] = useState<boolean>(() => isAdminFlagSet());
  const [rows, setRows] = useState<CommunitySubmission[]>([]);
  const [statusFilter, setStatusFilter] = useState<SubmissionStatus | "all">("all");
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [action, setAction] = useState<"none" | "approve" | "reject" | "escalate">("none");
  const [rejectReason, setRejectReason] = useState<RejectionReason>("insufficient-evidence");
  const [reviewerNote, setReviewerNote] = useState("");

  const refresh = useCallback(async () => {
    const repos = getRepositories();
    const outbox = await repos.submissions.listOutbox();
    setRows(outbox.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
  }, []);

  useEffect(() => {
    // The fetch is async — state updates land after the promise resolves, never
    // synchronously in the effect body (the lint rule can't see through the
    // `refresh` closure, so the disable is scoped and justified here).
    /* eslint-disable-next-line react-hooks/set-state-in-effect */
    if (allowed) void refresh();
  }, [allowed, refresh]);

  const openAction = (id: string, a: "approve" | "reject" | "escalate") => {
    setExpanded(id);
    setAction(a);
    setRejectReason("insufficient-evidence");
    setReviewerNote("");
  };

  const applyAction = async (s: CommunitySubmission) => {
    if (action === "approve") {
      setSubmissionStatus(s.id, "approved");
    } else if (action === "escalate") {
      setSubmissionStatus(s.id, "needs-info", { reviewerNote: reviewerNote.trim() || undefined });
    } else if (action === "reject") {
      setSubmissionStatus(s.id, "rejected", {
        rejectionReason: rejectReason,
        reviewerNote: reviewerNote.trim() || undefined,
      });
    }
    setAction("none");
    setExpanded(null);
    await refresh();
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter(
      (r) =>
        (statusFilter === "all" || r.status === statusFilter) &&
        (!q || r.name.toLowerCase().includes(q) || r.displayName.toLowerCase().includes(q)),
    );
  }, [rows, statusFilter, query]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: rows.length };
    for (const r of rows) c[r.status] = (c[r.status] ?? 0) + 1;
    return c;
  }, [rows]);

  // ─── Restricted access (honest, not fake) ─────────────────────────────────
  if (!allowed) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-red-500/40 bg-red-500/10 text-2xl">
          🔒
        </div>
        <h2 className="mt-4 text-2xl font-extrabold text-white">Restricted access</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-[#8b94a3]">
          This is the moderation queue — visible to the moderation team only. In the
          production site it sits behind accounts and reviewer roles. This preview
          build is a dev-only local tool; it is not linked from the public site and
          is excluded from search indexing.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/5 p-3 text-sm text-yellow-200/90">
        🔒 Local admin tool — not linked from the public site, noindex. Enable with
        localStorage <code className="font-mono">gta6mapx_admin_v1 = &quot;1&quot;</code> (dev-only preview; production uses accounts + reviewer roles). Supabase is not connected — this is the local queue.
      </div>

      <h1 className="mt-4 text-3xl font-extrabold text-white">Community moderation queue</h1>
      <p className="mt-1 text-sm text-[#8b94a3]">
        First human touch target <b className="text-cyan-300">≤48 h</b>. Votes never
        change evidence status — the confirm counter and the honesty badge are
        separate data paths.
      </p>

      {/* Stats */}
      <div className="mt-4 grid grid-cols-3 gap-2 text-center text-sm sm:grid-cols-6">
        {STATUSES.map((s) => (
          <div key={s.value} className="rounded-lg border border-[#1f2632] bg-[#11161f] p-2">
            <b className="text-xl text-white">{counts[s.value] ?? 0}</b>
            <br />
            <span className="text-xs text-[#8b94a3]">{s.label}</span>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {STATUSES.map((s) => (
          <button
            key={s.value}
            onClick={() => setStatusFilter(s.value)}
            className={`rounded-lg px-3 py-1.5 text-sm font-bold ${
              statusFilter === s.value
                ? "bg-cyan-500 text-black"
                : "border border-[#232c3b] bg-[#11161f] text-[#8b94a3] hover:text-white"
            }`}
          >
            {s.label} ({counts[s.value] ?? 0})
          </button>
        ))}
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name or submitter…"
          className={`${inputCls} ml-auto w-full sm:w-64`}
        />
      </div>

      {/* Rows */}
      <div className="mt-4 space-y-3">
        {filtered.map((s) => {
          const isOpen = expanded === s.id;
          const highInterest = s.confirms >= HIGH_INTEREST_CONFIRMS;
          return (
            <article
              key={s.id}
              className="rounded-xl border border-[#1f2632] bg-[#11161f] p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="font-bold text-white">{s.name}</h3>
                  <p className="mt-0.5 text-xs text-[#8b94a3]">
                    {s.displayName} · {s.categorySlug} ·{" "}
                    <span className="font-mono">{s.lat.toFixed(4)}, {s.lng.toFixed(4)}</span> ·{" "}
                    {new Date(s.createdAt).toLocaleString()}
                  </p>
                  <p className="mt-1 text-xs text-[#8b94a3]">
                    Proposed: <b className="text-cyan-300">{s.proposedStatus}</b> ·{" "}
                    {evidenceSummary(s)}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span
                    className={`rounded-full border px-2.5 py-0.5 text-xs font-bold ${STATUS_BADGE[s.status]}`}
                  >
                    {s.status}
                  </span>
                  <span className="text-xs text-[#8b94a3]" title="Community confirms — cannot change evidence status">
                    👍 {s.confirms} confirms
                  </span>
                </div>
              </div>

              {highInterest && (
                <p className="mt-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs font-bold text-amber-200">
                  Review suggestion: high community interest ({s.confirms} confirms).
                  Display-only — votes can never change the evidence status.
                </p>
              )}

              {isOpen && (
                <div className="mt-3 border-t border-[#1f2632] pt-3">
                  <p className="text-sm text-[#c8d0dc]">{s.description}</p>
                  <p className="mt-2 text-xs text-[#8b94a3]">
                    Attestation recorded {new Date(s.attestationAt).toLocaleString()} ·
                    provenance: {s.provenance}
                  </p>
                  {s.rejectionReason && (
                    <p className="mt-2 text-xs text-red-300">
                      Rejected ({s.rejectionReason}):{" "}
                      {REJECTION_REASONS.find((r) => r.value === s.rejectionReason)?.wording}
                      {s.reviewerNote && <span> — Note: {s.reviewerNote}</span>}
                    </p>
                  )}

                  {action === "none" && s.status !== "approved" && s.status !== "rejected" && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        onClick={() => openAction(s.id, "approve")}
                        className="rounded-lg bg-green-600 px-4 py-2 text-sm font-bold text-white hover:bg-green-500"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => openAction(s.id, "reject")}
                        className="rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-500"
                      >
                        Reject
                      </button>
                      <button
                        onClick={() => openAction(s.id, "escalate")}
                        className="rounded-lg border border-purple-500/40 bg-purple-500/10 px-4 py-2 text-sm font-bold text-purple-200 hover:bg-purple-500/20"
                      >
                        Escalate
                      </button>
                    </div>
                  )}

                  {action === "approve" && (
                    <div className="mt-3 rounded-xl border border-green-500/30 bg-green-500/5 p-4">
                      <p className="text-sm font-bold text-green-300">Approve this suggestion?</p>
                      <p className="mt-1 text-xs text-[#c8d0dc]">
                        On publish it becomes a community pin with default honesty status{" "}
                        <b>leak-reported</b>. <b>Rockstar-confirmed can never be granted from
                        this queue</b> — only an editor with a Rockstar citation can set it.
                        Community votes can never change evidence status.
                      </p>
                      <div className="mt-3 flex gap-2">
                        <button
                          onClick={() => void applyAction(s)}
                          className="rounded-lg bg-green-600 px-4 py-2 text-sm font-bold text-white hover:bg-green-500"
                        >
                          Confirm approval
                        </button>
                        <button
                          onClick={() => setAction("none")}
                          className="rounded-lg border border-[#232c3b] px-4 py-2 text-sm font-bold text-white"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {action === "escalate" && (
                    <div className="mt-3 rounded-xl border border-purple-500/30 bg-purple-500/5 p-4">
                      <p className="text-sm font-bold text-purple-200">
                        Escalate — request more info from the submitter (status → needs-info).
                      </p>
                      <label className="mt-2 block text-xs font-semibold text-[#c8d0dc]">
                        What do you need from them?
                      </label>
                      <input
                        value={reviewerNote}
                        onChange={(e) => setReviewerNote(e.target.value)}
                        placeholder="e.g. Which trailer timestamp shows this entrance?"
                        className={`${inputCls} mt-1`}
                      />
                      <div className="mt-3 flex gap-2">
                        <button
                          onClick={() => void applyAction(s)}
                          className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-bold text-white hover:bg-purple-500"
                        >
                          Escalate
                        </button>
                        <button
                          onClick={() => setAction("none")}
                          className="rounded-lg border border-[#232c3b] px-4 py-2 text-sm font-bold text-white"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {action === "reject" && (
                    <div className="mt-3 rounded-xl border border-red-500/30 bg-red-500/5 p-4">
                      <p className="text-sm font-bold text-red-300">Reject — pick a reason (required).</p>
                      <label className="mt-2 block text-xs font-semibold text-[#c8d0dc]">
                        Reason
                      </label>
                      <select
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value as RejectionReason)}
                        className={`${inputCls} mt-1`}
                      >
                        {REJECTION_REASONS.map((r) => (
                          <option key={r.value} value={r.value}>
                            {r.value}
                          </option>
                        ))}
                      </select>
                      <p className="mt-2 rounded-lg border border-[#232c3b] bg-[#0d1117] p-3 text-xs text-[#c8d0dc]">
                        <b className="text-white">Submitter will see:</b> “
                        {REJECTION_REASONS.find((r) => r.value === rejectReason)?.wording}”
                      </p>
                      <label className="mt-2 block text-xs font-semibold text-[#c8d0dc]">
                        Reviewer note (optional, internal)
                      </label>
                      <input
                        value={reviewerNote}
                        onChange={(e) => setReviewerNote(e.target.value)}
                        placeholder="Internal note…"
                        className={`${inputCls} mt-1`}
                      />
                      <div className="mt-3 flex gap-2">
                        <button
                          onClick={() => void applyAction(s)}
                          className="rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-500"
                        >
                          Confirm rejection
                        </button>
                        <button
                          onClick={() => setAction("none")}
                          className="rounded-lg border border-[#232c3b] px-4 py-2 text-sm font-bold text-white"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <button
                onClick={() => {
                  setExpanded(isOpen ? null : s.id);
                  setAction("none");
                }}
                className="mt-2 text-xs font-bold text-cyan-300 hover:underline"
              >
                {isOpen ? "Collapse ▲" : "Details & actions ▼"}
              </button>
            </article>
          );
        })}
        {filtered.length === 0 && (
          <p className="rounded-xl border border-[#1f2632] bg-[#11161f] p-8 text-center text-sm text-[#8b94a3]">
            {rows.length === 0
              ? "The outbox is empty — no suggestions yet. When a visitor submits one from /submit on this device, it lands here."
              : "No submissions match these filters."}
          </p>
        )}
      </div>
    </div>
  );
}
