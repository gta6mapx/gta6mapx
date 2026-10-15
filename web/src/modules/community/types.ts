// ─── modules/community/types.ts ─────────────────────────────────────────────
// WORKER B — community layer types (Phase 6). Every repository and UI file in
// the community layer shares these; they mirror the community-spec.md
// vocabulary exactly. Honest statuses are set by editors only — see the
// honesty-status rule in community-spec.md §1.2.

/** Leak Transparency Engine statuses — set by editors only. */
export type HonestyStatus =
  | "rockstar-confirmed"
  | "trailer-confirmed"
  | "leak-reported"
  | "disputed";

/** Moderation state machine for a community submission. */
export type SubmissionStatus =
  | "pending"
  | "in-review"
  | "approved"
  | "rejected"
  | "needs-info";

/** Evidence matrix source types (spec §3.1). */
export type SourceType =
  | "trailer"
  | "leak_report"
  | "rockstar_official"
  | "other_public";

/**
 * Statuses a submitter may propose. Submitters can NEVER propose
 * `rockstar-confirmed` — the form does not offer it (§1.2 rule 2).
 */
export type ProposedStatus = "trailer-confirmed" | "leak-reported" | "disputed";

/** Shared identity contract (§1.1). Device mode is the only mode pre-Supabase. */
export interface Identity {
  mode: "device" | "account";
  deviceId: string;
  userId?: string;
}

/** Evidence fields for a "Suggest a location" submission (spec §3.1). */
export interface SubmissionEvidence {
  sourceType: SourceType;
  trailerName?: string;
  trailerTimestamp?: string; // m:ss format
  sourceUrl?: string;
  sourceDescription?: string;
}

/**
 * A community-submitted location. Pre-Supabase these live in a guest-local
 * outbox honestly labeled "not yet received by moderators". `attestation`
 * is always true — the submit flow requires the checkbox.
 */
export interface CommunitySubmission {
  id: string;
  name: string;
  description: string;
  lat: number;
  lng: number;
  categorySlug: string;
  proposedStatus: ProposedStatus;
  evidence: SubmissionEvidence;
  attestation: true;
  attestationAt: string; // ISO timestamp of the checkbox tick
  status: SubmissionStatus;
  rejectionReason?: string;
  reviewerNote?: string;
  provenance: "community-submitted";
  displayName: string;
  confirms: number;
  reports: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Per-pin community signals. Deliberately carries NO honesty-status field:
 * votes can never change a status (§1.2) — the VoteRepository interface
 * has no code path to any status column.
 */
export interface VoteSummary {
  pinId: string;
  confirms: number;
  seen: number;
  myVote: "confirm" | "seen" | null;
}

/**
 * One scored game round emitted by the guessing game. The game emits events;
 * the leaderboard computes ranks — the game never writes ranks (§5.1).
 */
export interface ScoreEvent {
  id: string; // event-id idempotency key
  stillId: string;
  accuracy: number; // 0–100
  elapsedSec: number;
  attemptNumber: number;
  roundScore: number;
  seasonKey: string; // YYYY-MM
  createdAt: string;
}

/** Fixed rejection taxonomy with user-facing wording (spec §3.2). */
export type RejectionReason =
  | "duplicate"
  | "insufficient-evidence"
  | "leak-content"
  | "wrong-location"
  | "low-quality"
  | "wrong-category"
  | "spam"
  | "abuse"
  | "stale"
  | "out-of-scope";
