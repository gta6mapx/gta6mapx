// ─── modules/community/ActivityFeed.tsx ────────────────────────────────────
// WORKER D — community hub widgets (spec §5.3).
//
// NOTE: this file is a client module because the hub route (app/community)
// must stay a server component for its metadata, and the stats dashboard +
// activity feed read device-local storage. All reads go through Worker B's
// getRepositories() seam — this file never touches localStorage directly.

"use client";

import { useEffect, useState } from "react";
import { getRepositories } from "./communityClient";
import type { CommunitySubmission } from "./types";

export type FeedKind =
  | "pin-approved"
  | "milestone"
  | "season-closed"
  | "badge-earned";

export interface FeedItem {
  id: string;
  kind: FeedKind; // fixed allowlist only (spec §5.3) — no "view all by user" page
  text: string;
  at: string; // ISO timestamp
}

const KIND_LABEL: Record<FeedKind, string> = {
  "pin-approved": "Pin approved",
  milestone: "Milestone",
  "season-closed": "Season closed",
  "badge-earned": "Badge earned",
};

/** Presentational feed: fixed-allowlist kinds, 30-day public retention note. */
export function ActivityFeed({ items }: { items: FeedItem[] }) {
  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-[#11161f] p-8 text-center">
        <p className="font-semibold">No community activity yet</p>
        <p className="mt-2 text-sm text-[#8b94a3]">
          Approved suggestions will appear here.
        </p>
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#11161f]">
      <ul className="divide-y divide-white/5">
        {items.map((item) => (
          <li key={item.id} className="flex items-start gap-3 px-5 py-4">
            <span className="mt-0.5 shrink-0 rounded-full bg-white/10 px-2.5 py-0.5 text-xs font-medium text-[#8b94a3]">
              {KIND_LABEL[item.kind]}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm">{item.text}</p>
              <p className="mt-1 text-xs text-[#8b94a3]">
                {formatDate(item.at)}
              </p>
            </div>
          </li>
        ))}
      </ul>
      <p className="border-t border-white/5 px-5 py-3 text-xs text-[#8b94a3]">
        Community activity is kept for 30 days.
      </p>
    </div>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "date unknown";
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/**
 * Builds feed items from approved submissions in the device-local outbox.
 * (Pre-Supabase the outbox is honestly "not yet received by moderators", so
 * approved rows only exist if a local reviewer marked them — usually none.)
 */
export function OutboxActivityFeed() {
  const [items, setItems] = useState<FeedItem[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    getRepositories()
      .submissions.listOutbox()
      .then((outbox: CommunitySubmission[]) => {
        if (cancelled) return;
        const approved = outbox
          .filter((s) => s.status === "approved")
          .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
          .slice(0, 20)
          .map((s) => ({
            id: s.id,
            kind: "pin-approved" as FeedKind,
            text: `“${s.name}” was approved and added to the map.`,
            at: s.updatedAt,
          }));
        setItems(approved);
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (items === null) {
    return (
      <div className="rounded-2xl border border-white/10 bg-[#11161f] p-8 text-center text-sm text-[#8b94a3]">
        Loading community activity…
      </div>
    );
  }
  return <ActivityFeed items={items} />;
}

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Stats dashboard (spec §5.3). Device-local demo: counts come from this
 * browser's outbox. Median review time shows "—" until real review data
 * exists — never invented.
 */
export function CommunityStatsDashboard() {
  const [stats, setStats] = useState<{
    outbox: number;
    pending: number;
    approvedThisWeek: number;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    getRepositories()
      .submissions.listOutbox()
      .then((outbox: CommunitySubmission[]) => {
        if (cancelled) return;
        const weekAgo = Date.now() - SEVEN_DAYS_MS;
        setStats({
          outbox: outbox.length,
          pending: outbox.filter(
            (s) => s.status === "pending" || s.status === "in-review",
          ).length,
          approvedThisWeek: outbox.filter(
            (s) =>
              s.status === "approved" &&
              !Number.isNaN(new Date(s.updatedAt).getTime()) &&
              new Date(s.updatedAt).getTime() >= weekAgo,
          ).length,
        });
      })
      .catch(() => {
        if (!cancelled)
          setStats({ outbox: 0, pending: 0, approvedThisWeek: 0 });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const cards = stats
    ? [
        { label: "Suggestions in outbox", value: String(stats.outbox) },
        { label: "Awaiting review", value: String(stats.pending) },
        { label: "Approved this week", value: String(stats.approvedThisWeek) },
        { label: "Median review time", value: "—" },
      ]
    : [
        { label: "Suggestions in outbox", value: "…" },
        { label: "Awaiting review", value: "…" },
        { label: "Approved this week", value: "…" },
        { label: "Median review time", value: "…" },
      ];

  return (
    <div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {cards.map((c) => (
          <div
            key={c.label}
            className="rounded-2xl border border-white/10 bg-[#11161f] p-5 text-center"
          >
            <div className="text-2xl font-extrabold">{c.value}</div>
            <div className="mt-1 text-xs text-[#8b94a3]">{c.label}</div>
          </div>
        ))}
      </div>
      <p className="mt-2 text-xs text-[#8b94a3]">
        Device-local demo — review metrics go live with the moderation queue.
      </p>
    </div>
  );
}
