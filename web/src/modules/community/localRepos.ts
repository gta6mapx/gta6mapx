// ─── modules/community/localRepos.ts ─────────────────────────────────────────
// WORKER B — guest-local localStorage implementations of the community
// repositories. Pre-Supabase: everything is device-local, zero network calls.
// All writes are try/catch — quota exceeded means the write is refused, never
// silently lost.

import type {
  CommunitySubmission,
  Identity,
  ScoreEvent,
  SubmissionStatus,
  VoteSummary,
} from "./types";
import type {
  CommentRepository,
  CreateSubmissionInput,
  LeaderboardRepository,
  ProfileRepository,
  Repositories,
  SubmissionRepository,
  VoteRepository,
} from "./repositories";
import { getDeviceId } from "./communityClient";

export const OUTBOX_KEY = "gta6mapx_submission_outbox_v1";
export const VOTES_KEY = "gta6mapx_votes_v1";
export const SCORES_KEY = "gta6mapx_scores_v1";
export const PROFILE_KEY = "gta6mapx_profile_v1";

const UNDO_WINDOW_MS = 15 * 60 * 1000; // 15-minute undo window (§4.1)

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw == null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function nowIso(): string {
  return new Date().toISOString();
}

function newId(): string {
  return (
    "sub-" +
    Date.now().toString(36) +
    "-" +
    Math.random().toString(36).slice(2, 10)
  );
}

// ─── Submissions ────────────────────────────────────────────────────────────

class LocalSubmissionRepository implements SubmissionRepository {
  async create(d: CreateSubmissionInput): Promise<CommunitySubmission> {
    const profile = await localProfileRepo.getOrCreate({
      mode: "device",
      deviceId: getDeviceId(),
    });
    const submission: CommunitySubmission = {
      id: newId(),
      name: d.name,
      description: d.description,
      lat: d.lat,
      lng: d.lng,
      categorySlug: d.categorySlug,
      proposedStatus: d.proposedStatus,
      evidence: d.evidence,
      attestation: true,
      attestationAt: nowIso(),
      status: "pending",
      provenance: "community-submitted",
      displayName: profile.displayName,
      confirms: 0,
      reports: 0,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    const outbox = read<CommunitySubmission[]>(OUTBOX_KEY, []);
    outbox.push(submission);
    write(OUTBOX_KEY, outbox);
    return submission;
  }

  async listOutbox(): Promise<CommunitySubmission[]> {
    return read<CommunitySubmission[]>(OUTBOX_KEY, []);
  }

  async listQueue(status?: SubmissionStatus): Promise<CommunitySubmission[]> {
    const outbox = read<CommunitySubmission[]>(OUTBOX_KEY, []);
    return status ? outbox.filter((s) => s.status === status) : outbox;
  }

  async updateStatus(
    id: string,
    status: SubmissionStatus,
    opts?: { rejectionReason?: string; reviewerNote?: string },
  ): Promise<void> {
    const outbox = read<CommunitySubmission[]>(OUTBOX_KEY, []);
    const idx = outbox.findIndex((s) => s.id === id);
    if (idx === -1) return;
    outbox[idx] = {
      ...outbox[idx],
      status,
      rejectionReason: opts?.rejectionReason,
      reviewerNote: opts?.reviewerNote,
      updatedAt: nowIso(),
    };
    write(OUTBOX_KEY, outbox);
  }
}

// ─── Votes ──────────────────────────────────────────────────────────────────
// One confirm XOR seen per pin per device. 15-minute undo window: retract
// allowed within the window; store votedAt.

interface VoteRecord {
  kind: "confirm" | "seen";
  votedAt: string;
}

interface VoteStore {
  mine: Record<string, VoteRecord>; // pinId → my vote
  totals: Record<string, { confirms: number; seen: number }>;
}

class LocalVoteRepository implements VoteRepository {
  private store(): VoteStore {
    return read<VoteStore>(VOTES_KEY, { mine: {}, totals: {} });
  }

  private summarize(pinId: string, store: VoteStore): VoteSummary {
    const t = store.totals[pinId] ?? { confirms: 0, seen: 0 };
    return {
      pinId,
      confirms: t.confirms,
      seen: t.seen,
      myVote: store.mine[pinId]?.kind ?? null,
    };
  }

  async getSummary(pinId: string): Promise<VoteSummary> {
    return this.summarize(pinId, this.store());
  }

  async cast(
    pinId: string,
    kind: "confirm" | "seen",
  ): Promise<VoteSummary> {
    const store = this.store();
    const prev = store.mine[pinId];
    const t = (store.totals[pinId] ??= { confirms: 0, seen: 0 });
    if (prev) {
      if (prev.kind === "confirm") t.confirms = Math.max(0, t.confirms - 1);
      else t.seen = Math.max(0, t.seen - 1);
    }
    store.mine[pinId] = { kind, votedAt: nowIso() };
    if (kind === "confirm") t.confirms += 1;
    else t.seen += 1;
    write(VOTES_KEY, store);
    return this.summarize(pinId, store);
  }

  async retract(pinId: string): Promise<VoteSummary> {
    const store = this.store();
    const prev = store.mine[pinId];
    if (prev) {
      const ageMs = Date.now() - new Date(prev.votedAt).getTime();
      if (ageMs <= UNDO_WINDOW_MS) {
        const t = (store.totals[pinId] ??= { confirms: 0, seen: 0 });
        if (prev.kind === "confirm") t.confirms = Math.max(0, t.confirms - 1);
        else t.seen = Math.max(0, t.seen - 1);
        delete store.mine[pinId];
        write(VOTES_KEY, store);
      }
    }
    return this.summarize(pinId, store);
  }
}

// ─── Comments (honest stub) ─────────────────────────────────────────────────

const localCommentRepo: CommentRepository = {
  async list(): Promise<never[]> {
    // Comments require accounts (spec §4.2 NEEDS-SUPABASE). Local returns [].
    return [];
  },
};

// ─── Leaderboard ────────────────────────────────────────────────────────────
// Season total = Σ best round_score per still per identity (§5.1) —
// replay-farming is worthless by construction.

interface ScoreRow {
  event: ScoreEvent;
  identityKey: string;
}

class LocalLeaderboardRepository implements LeaderboardRepository {
  async submitScore(e: ScoreEvent): Promise<void> {
    const rows = read<ScoreRow[]>(SCORES_KEY, []);
    const identityKey = `device:${getDeviceId()}`;
    if (rows.some((r) => r.event.id === e.id)) return; // event-id idempotency
    rows.push({ event: e, identityKey });
    write(SCORES_KEY, rows);
  }

  async seasonBoard(
    seasonKey: string,
  ): Promise<{ displayName: string; total: number; guest: boolean }[]> {
    const rows = read<ScoreRow[]>(SCORES_KEY, []);
    const best = new Map<string, Map<string, number>>(); // identity → still → best
    for (const r of rows) {
      if (r.event.seasonKey !== seasonKey) continue;
      let byStill = best.get(r.identityKey);
      if (!byStill) {
        byStill = new Map();
        best.set(r.identityKey, byStill);
      }
      byStill.set(
        r.event.stillId,
        Math.max(byStill.get(r.event.stillId) ?? 0, r.event.roundScore),
      );
    }
    const board: { displayName: string; total: number; guest: boolean }[] = [];
    for (const [identityKey, byStill] of best) {
      const total = [...byStill.values()].reduce((a, b) => a + b, 0);
      board.push({
        displayName: await resolveDisplayName(identityKey),
        total,
        guest: identityKey.startsWith("device:"),
      });
    }
    board.sort((a, b) => b.total - a.total);
    return board;
  }
}

// ─── Profiles ───────────────────────────────────────────────────────────────
// Guest displayName = `Mapper #<4 hex>` derived from the device id — friendly,
// non-trackable (spec §7 Q2 recommendation, unified everywhere).

function mapperName(deviceId: string): string {
  let h = 0;
  for (let i = 0; i < deviceId.length; i++) {
    h = (h * 31 + deviceId.charCodeAt(i)) >>> 0;
  }
  return `Mapper #${(h & 0xffff).toString(16).padStart(4, "0")}`;
}

const localProfileRepo: ProfileRepository = {
  async getOrCreate(identity: Identity) {
    if (identity.mode === "device") {
      const stored = read<{ displayName: string; role: string } | null>(
        PROFILE_KEY,
        null,
      );
      if (stored) return stored;
      const profile = { displayName: mapperName(identity.deviceId), role: "user" };
      write(PROFILE_KEY, profile);
      return profile;
    }
    // Account mode arrives with Supabase; local falls back to the device name.
    return { displayName: mapperName(identity.deviceId), role: "user" };
  },
};

async function resolveDisplayName(identityKey: string): Promise<string> {
  if (identityKey.startsWith("device:")) {
    const deviceId = identityKey.slice("device:".length);
    if (deviceId === getDeviceId()) {
      const p = await localProfileRepo.getOrCreate({
        mode: "device",
        deviceId,
      });
      return p.displayName;
    }
    return mapperName(deviceId);
  }
  return "Mapper";
}

export function getLocalRepositories(): Repositories {
  return {
    submissions: new LocalSubmissionRepository(),
    votes: new LocalVoteRepository(),
    comments: localCommentRepo,
    leaderboard: new LocalLeaderboardRepository(),
    profiles: localProfileRepo,
  };
}
