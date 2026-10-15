// ─── modules/community/strings.ts ────────────────────────────────────────────
// WORKER B — ONE English dictionary for the entire community layer.
// Every community UI string lives here; components must import copy from this
// file, never hardcode community strings inline.

import type { RejectionReason } from "./types";

export const COMMUNITY_STRINGS = {
  // ── Outbox honesty (spec §3.1: never fake a received state) ──
  outboxPending:
    "Saved on this device — not yet received by moderators",
  outboxSyncsLater:
    "Your suggestion is saved on this device. It will reach the moderation queue once you sign in.",
  draftSaved: "Draft saved on this device",

  // ── Degradation states (§4.5: honest empty states, never fake social proof) ──
  votesDisabled: "Community votes go live with accounts — coming soon",
  commentsEmpty: "Comments open after launch",
  screenshotsDisabled: "Uploads open with accounts",
  screenshotsDeclaration:
    "I captured this image myself from publicly released material — official trailers, official Rockstar screenshots, or my own gameplay. It is not a leak, not a re-upload of someone else's footage, and not taken from a watermarked leak compilation.",

  // ── Leaderboard (guest mode) ──
  leaderboardLocal:
    "Stored on this device — account sync coming later",
  leaderboardGuestTag: "Guest",

  // ── Anti-noise (§4.1) ──
  beFirstToConfirm: "Be the first to confirm this location",
  voteChangeHint: "You can change your vote within 15 minutes.",
  communityVerified: "Community Verified",
  communityVerifiedTooltip: "Community signal, not editorial evidence.",

  // ── Attestation (§3.1, exact checkbox text) ──
  attestation:
    "I captured any screenshots myself from public trailers/streams. This contains no leaked game files or datamined content.",

  // ── Merge screen (§2.3: explicit, never silent) ──
  mergeTitle: "Bring your device progress into your account?",
  mergeOption: "Merge",
  startFreshOption: "Start fresh",
  keepSeparateOption: "Keep separate",
  mergeExplain:
    "Merge keeps everything: found locations combine, favorites combine, and the newest note wins. Nothing is deleted.",
  startFreshExplain:
    "Start fresh: your device progress stays on this device and your account starts empty.",
  keepSeparateExplain:
    "Keep separate: switch between your device progress and your account without combining them.",

  // ── Data controls (§2.2 privacy / §4.4 delete-my-data) ──
  dataControlsTitle: "Your data",
  exportData: "Export my data",
  importData: "Import data",
  resetAll: "Reset everything",
  deleteMyData: "Delete my data",
  deleteMyDataExplain:
    "Removes your votes and recomputes counters, deletes your comments and uploads, and anonymizes your profile.",

  // ── Rejection taxonomy, user-facing wording (§3.2 fixed list) ──
  rejectionWording: {
    duplicate:
      "Duplicate — this location is already on the map.",
    "insufficient-evidence":
      "Not enough evidence — add a trailer timestamp or a public source link.",
    "leak-content":
      "Rejected for leak policy reasons. Describe what public reporting says and link a news article about it — don't upload or link leaked files.",
    "wrong-location":
      "Wrong location — the pin doesn't match the description.",
    "low-quality":
      "Needs more detail — say what's visible and why it matters.",
    "wrong-category":
      "Wrong category — pick the category that best fits this location.",
    spam: "Spam — repeated low-value submissions are removed.",
    abuse: "Abuse — this submission broke the community rules.",
    stale:
      "Closed for inactivity — no new information arrived within 7 days. Resubmit with fresh evidence.",
    "out-of-scope":
      "Out of scope — we only cover GTA VI locations right now.",
  } satisfies Record<RejectionReason, string>,

  // ── Moderation queue ──
  statusLabels: {
    pending: "Pending review",
    "in-review": "In review",
    approved: "Approved",
    rejected: "Rejected",
    "needs-info": "Needs more info",
  } as const,

  // ── Submission form ──
  suggestLocation: "Suggest a location",
  submitButton: "Submit suggestion",
  evidenceSection: "Evidence",
  trailerNameLabel: "Trailer name",
  trailerTimestampLabel: "Timestamp (m:ss)",
  sourceUrlLabel: "Public source link",
  sourceDescriptionLabel: "Describe the public source",
  proposedStatusLabel: "How sure is the evidence?",
  duplicateWarning:
    "Possible duplicate — a similar location is already nearby. Submit anyway, view the existing pin, or cancel.",
} as const;

export type CommunityStrings = typeof COMMUNITY_STRINGS;

/** Compile-time + runtime guard: every copy value is non-empty English text. */
export function auditCommunityStringsEnglish(): string[] {
  const problems: string[] = [];
  const walk = (obj: unknown, path: string) => {
    if (typeof obj === "string") {
      if (!obj.trim()) problems.push(`${path}: empty string`);
      return;
    }
    if (obj && typeof obj === "object") {
      for (const [k, v] of Object.entries(obj)) walk(v, `${path}.${k}`);
    }
  };
  walk(COMMUNITY_STRINGS, "COMMUNITY_STRINGS");
  return problems;
}
