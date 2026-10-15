// ─── modules/community/VoteButtons.tsx ─────────────────────────────────────
// WORKER D — per-marker community signals: Confirm + Seen (spec §4.1, §4.5).
//
// Graceful degradation [NO-SUPABASE]: no accounts exist yet, so the buttons
// are DISABLED with honest copy — never fake social proof. The enabled path
// is sketched below (commented, ready) for the Supabase phase.

"use client";

interface VoteButtonsProps {
  pinId: string;
}

/*
 * ── ENABLED PATH (commented, ready — flip when Supabase accounts land) ──
 *
 * Data seam (Worker B owns these; import when enabled):
 *   import { getRepositories } from "./communityClient";
 *   import { getIdentity } from "./communityClient";
 *
 * Behavior per spec §4.1:
 * - One confirm XOR seen per identity per pin. A user may hold one Confirm
 *   AND one Seen on the same pin (different questions), and may change
 *   Confirm↔Seen, but never both simultaneously.
 *   → repos.votes.cast(pinId, "confirm" | "seen") / repos.votes.retract(pinId)
 * - 15-minute undo window: retract() only succeeds within 15 min of the vote;
 *   after that the vote is immutable to the voter (moderators can invalidate
 *   with an audit entry).
 * - Anti-noise display: counters hidden below 5 total votes — show
 *   "Be the first to confirm this location", never "1 of 1".
 * - Community Verified badge at ≥10 distinct confirms, visually subordinate
 *   to the honesty badge, tooltip: "Community signal, not editorial evidence."
 *
 * HARD RULE (spec §1.2): votes can NEVER change a pin's honesty status —
 * not at 10 votes, not at 10,000. Vote endpoints have no code path to the
 * status column; the honesty badge renders from a separate data path than
 * the vote counters, so a vote surge can never visually imply a status change.
 */

export default function VoteButtons({ pinId }: VoteButtonsProps) {
  return (
    <div data-pin-id={pinId} className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
      <p className="text-sm font-semibold">Is this pin accurate?</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled
          aria-disabled="true"
          title="Community votes go live with accounts — coming soon"
          className="cursor-not-allowed rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-[#8b94a3] opacity-60"
        >
          ✓ Confirm location
        </button>
        <button
          type="button"
          disabled
          aria-disabled="true"
          title="Community votes go live with accounts — coming soon"
          className="cursor-not-allowed rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-[#8b94a3] opacity-60"
        >
          👁 I&apos;ve seen this
        </button>
      </div>
      <p className="mt-3 text-xs text-[#8b94a3]">
        Community votes go live with accounts — coming soon.
      </p>
      <p className="mt-1 text-xs text-[#8b94a3]">
        Confirm answers “Is this pin accurate?” — Seen answers “Have you
        encountered this?”. Votes never change a pin&apos;s evidence status.
      </p>
    </div>
  );
}
