// ─── modules/community/repositories.ts ───────────────────────────────────────
// WORKER B — repository interfaces (interfaces ONLY, no implementation).
// The Supabase implementation lives in `supabaseRepos.ts` later and must
// implement these exact interfaces — no UI rewrites needed at swap time.
// `communityClient.ts` is the single swap point.

import type {
  CommunitySubmission,
  Identity,
  ScoreEvent,
  SubmissionStatus,
  VoteSummary,
} from "./types";

export interface CreateSubmissionInput {
  name: string;
  description: string;
  lat: number;
  lng: number;
  categorySlug: string;
  proposedStatus: CommunitySubmission["proposedStatus"];
  evidence: CommunitySubmission["evidence"];
  attestation: true;
}

export interface SubmissionRepository {
  create(d: CreateSubmissionInput): Promise<CommunitySubmission>;
  /** Guest-local outbox: submissions not yet received by moderators. */
  listOutbox(): Promise<CommunitySubmission[]>;
  /** Moderation queue view (server-side once Supabase is connected). */
  listQueue(status?: SubmissionStatus): Promise<CommunitySubmission[]>;
  updateStatus(
    id: string,
    status: SubmissionStatus,
    opts?: { rejectionReason?: string; reviewerNote?: string },
  ): Promise<void>;
}

export interface VoteRepository {
  getSummary(pinId: string): Promise<VoteSummary>;
  cast(pinId: string, kind: "confirm" | "seen"): Promise<VoteSummary>;
  retract(pinId: string): Promise<VoteSummary>;
}
// HARD RULE (§1.2): no method on VoteRepository may read or write any honesty
// status. VoteSummary carries no status field, and the Supabase implementation
// must keep vote counters on a separate data path from the status column —
// votes create moderator *suggestions* at thresholds (≥25 confirms), never
// status changes.

export interface CommentRepository {
  /**
   * Honest stub: comments require accounts (spec §4.2 is NEEDS-SUPABASE).
   * The local implementation returns [] and the UI explains that comments
   * open after launch.
   */
  list(pinId: string): Promise<never[]>;
}

export interface LeaderboardRepository {
  submitScore(e: ScoreEvent): Promise<void>;
  seasonBoard(
    seasonKey: string,
  ): Promise<{ displayName: string; total: number; guest: boolean }[]>;
}

export interface ProfileRepository {
  getOrCreate(
    identity: Identity,
  ): Promise<{ displayName: string; role: string }>;
}

export interface Repositories {
  submissions: SubmissionRepository;
  votes: VoteRepository;
  comments: CommentRepository;
  leaderboard: LeaderboardRepository;
  profiles: ProfileRepository;
}
