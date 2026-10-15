// Community layer acceptance — WORKER B (repository pattern + Supabase wiring).
// Pure logic: localRepos + strings + type-shape honesty rules. Run:
//
//   node --import ./scripts/register-at-alias.mjs scripts/community-acceptance-b.mts
//
// Exits nonzero on the first failure; prints PASS per group.

import { getRepositories, getIdentity } from "../src/modules/community/communityClient";
import {
  COMMUNITY_STRINGS,
  auditCommunityStringsEnglish,
} from "../src/modules/community/strings";
import type { CommunitySubmission } from "../src/modules/community/types";
import type { CreateSubmissionInput } from "../src/modules/community/repositories";

// ── localStorage shim (mirrors game-flow-sim.mts) ──
const store = new Map<string, string>();
(globalThis as Record<string, unknown>).localStorage = {
  getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
};

let failures = 0;
function assert(cond: boolean, label: string) {
  if (cond) console.log(`  ok — ${label}`);
  else {
    failures++;
    console.error(`  FAIL — ${label}`);
  }
}

const submissionInput: CreateSubmissionInput = {
  name: "Neon arcade on Ocean Drive",
  description: "A neon-lit arcade front clearly visible in the trailer, worth mapping.",
  lat: 25.7829,
  lng: -80.1301,
  categorySlug: "stores",
  proposedStatus: "trailer-confirmed",
  evidence: { sourceType: "trailer", trailerName: "Trailer 2", trailerTimestamp: "1:47" },
  attestation: true,
};

async function main() {
  const repos = getRepositories();

  // ── 1. identity ──
  const id = getIdentity();
  assert(id.mode === "device", "identity mode is device (pre-Supabase)");
  assert(/^gta6mapx-dev-(?:[0-9a-f]{16}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/.test(id.deviceId), "device id shape gta6mapx-dev-<uuidv4>");
  assert(getIdentity().deviceId === id.deviceId, "device id stable across calls");
  const profile = await repos.profiles.getOrCreate(id);
  assert(/^Mapper #[0-9a-f]{4}$/.test(profile.displayName), `guest displayName is Mapper #<4hex> (${profile.displayName})`);
  assert(profile.role === "user", "guest role is user");

  // ── 2. submissions: create → outbox ──
  const created: CommunitySubmission = await repos.submissions.create(submissionInput);
  assert(created.status === "pending", "new submission status is pending");
  assert(created.provenance === "community-submitted", "provenance is community-submitted");
  assert(created.attestation === true, "attestation recorded");
  const outbox = await repos.submissions.listOutbox();
  assert(outbox.some((s) => s.id === created.id), "outbox lists the created submission");
  assert(outbox.every((s) => s.status === "pending"), "outbox entries are pending");
  const pendingQueue = await repos.submissions.listQueue("pending");
  assert(pendingQueue.length === outbox.length, "listQueue('pending') matches outbox");
  await repos.submissions.updateStatus(created.id, "needs-info", { reviewerNote: "test" });
  const after = (await repos.submissions.listOutbox()).find((s) => s.id === created.id)!;
  assert(after.status === "needs-info", "updateStatus changes status");
  assert(after.reviewerNote === "test", "reviewerNote persisted");

  // ── 3. votes: cast / retract within window ──
  const pin = "pin-fixture-1";
  let summary = await repos.votes.getSummary(pin);
  assert(summary.confirms === 0 && summary.myVote === null, "empty summary starts zero");
  summary = await repos.votes.cast(pin, "confirm");
  assert(summary.confirms === 1 && summary.myVote === "confirm", "cast confirm counted");
  summary = await repos.votes.cast(pin, "seen"); // switch: XOR per device
  assert(summary.confirms === 0 && summary.seen === 1 && summary.myVote === "seen", "switch confirm→seen is XOR");
  summary = await repos.votes.retract(pin); // within 15-min window
  assert(summary.seen === 0 && summary.myVote === null, "retract within window removes vote");

  // ── 4. honesty-status rule: votes carry no status and touch none ──
  const keys = Object.keys(summary).sort().join(",");
  assert(keys === "confirms,myVote,pinId,seen", `VoteSummary has no status field (keys: ${keys})`);
  const before: CommunitySubmission = await repos.submissions.create(submissionInput);
  const statusBefore = before.proposedStatus;
  await repos.votes.cast(before.id, "confirm"); // vote at a submission id — votes must not write status
  const reloaded = (await repos.submissions.listOutbox()).find((s) => s.id === before.id)!;
  assert(reloaded.proposedStatus === statusBefore, "voting leaves proposedStatus untouched");
  assert(!("honestyStatus" in reloaded) && !("certainty" in reloaded), "submission carries no editable honesty status");

  // ── 5. leaderboard: submit → seasonBoard desc ──
  const season = "2026-09";
  await repos.leaderboard.submitScore({
    id: "evt-1", stillId: "still-a", accuracy: 90, elapsedSec: 12,
    attemptNumber: 1, roundScore: 95, seasonKey: season, createdAt: new Date().toISOString(),
  });
  await repos.leaderboard.submitScore({
    id: "evt-2", stillId: "still-a", accuracy: 99, elapsedSec: 10,
    attemptNumber: 2, roundScore: 30, seasonKey: season, createdAt: new Date().toISOString(),
  }); // replay decay belongs to the engine; board keeps best-per-still
  await repos.leaderboard.submitScore({
    id: "evt-3", stillId: "still-b", accuracy: 80, elapsedSec: 20,
    attemptNumber: 1, roundScore: 82, seasonKey: season, createdAt: new Date().toISOString(),
  });
  await repos.leaderboard.submitScore({ // idempotency: same id submitted twice
    id: "evt-3", stillId: "still-b", accuracy: 80, elapsedSec: 20,
    attemptNumber: 1, roundScore: 82, seasonKey: season, createdAt: new Date().toISOString(),
  });
  const board = await repos.leaderboard.seasonBoard(season);
  assert(board.length === 1, "one identity on the board");
  assert(board[0].total === 95 + 82, `season total = best-per-still sum (95+82=${board[0].total})`);
  assert(board[0].guest === true, "device identity flagged guest");
  assert(board[0].displayName === profile.displayName, "board uses profile displayName");
  assert((await repos.leaderboard.seasonBoard("1999-01")).length === 0, "other season empty");

  // ── 6. comments honest stub ──
  const comments = await repos.comments.list(pin);
  assert(Array.isArray(comments) && comments.length === 0, "comments stub returns []");
  assert(COMMUNITY_STRINGS.commentsEmpty === "Comments open after launch", "comments copy honest");

  // ── 7. strings audit ──
  const strProblems = auditCommunityStringsEnglish();
  assert(strProblems.length === 0, `community strings all non-empty English (${strProblems.join("; ")})`);
  assert(COMMUNITY_STRINGS.outboxPending.includes("not yet received by moderators"), "outbox honesty copy");
  assert(COMMUNITY_STRINGS.rejectionWording["leak-content"].includes("leak"), "10 rejection reasons present");
  assert(Object.keys(COMMUNITY_STRINGS.rejectionWording).length === 10, "rejection taxonomy covers all 10 reasons");

  console.log(failures === 0 ? "\nPASS — all community acceptance groups" : `\nFAIL — ${failures} assertion(s)`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("FATAL", e);
  process.exit(1);
});
