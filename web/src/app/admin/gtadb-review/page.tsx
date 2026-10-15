// ─── /admin/gtadb-review — LOCAL ADMIN ONLY ────────────────────────────────
// Human review queue for gtadb.org-derived staging records (import spec §4.4).
// Not linked from public nav. robots=noindex. Blocked in production by
// middleware. The owner's approve click is the only publish path.

import Link from "next/link";
import type { Metadata } from "next";
import type { StagedNamedRecord } from "@/modules/entities/data/gtadb/schema";
import locations from "./staging-imports"; // local helper (server-side staging reads)
import { DEDUPE_CANDIDATES } from "@/modules/entities/data/gtadb/dedupe-candidates";
import { getReviewStatus } from "./actions";
import ReviewCard from "./ReviewCard";

export const metadata: Metadata = {
  title: "Admin — GTADB review queue",
  robots: { index: false, follow: false },
};

const PAGE_SIZE = 25;

export default async function GtadbReviewPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const bucket = (sp.bucket ?? "all") as string;
  const evidence = (sp.evidence ?? "all") as string;
  const state = (sp.state ?? "all") as string;
  const q = (sp.q ?? "").trim().toLowerCase();
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);

  const all: StagedNamedRecord[] = locations;
  const reviewStatus = await getReviewStatus();
  const dedupeById = new Map(DEDUPE_CANDIDATES.map((d) => [d.stagedId, d]));

  let rows = all;
  if (bucket !== "all") rows = rows.filter((r) => r.ownerCategory === bucket);
  if (evidence !== "all") rows = rows.filter((r) => r.evidenceStatus === evidence);
  if (q) rows = rows.filter((r) => r.name.toLowerCase().includes(q) || r.id.toLowerCase().includes(q));
  if (state !== "all")
    rows = rows.filter((r) => {
      const s = reviewStatus[r.id]?.status;
      if (state === "pending") return !s;
      return s === state;
    });

  const pending = all.filter((r) => !reviewStatus[r.id]);
  const approved = all.filter((r) => reviewStatus[r.id]?.status === "approved");
  const rejected = all.filter((r) => reviewStatus[r.id]?.status === "rejected");

  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const safePage = Math.min(page, pages);
  const slice = rows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const href = (over: Record<string, string>) => {
    const p = new URLSearchParams({ bucket, evidence, state, q: sp.q ?? "", ...over });
    return `/admin/gtadb-review?${p.toString()}`;
  };

  const tab = (label: string, key: string, val: string, count?: number) => {
    const active = (key === "bucket" ? bucket : key === "evidence" ? evidence : state) === val;
    return (
      <Link
        href={href({ [key]: val, page: "1" })}
        className={`rounded-lg px-3 py-1 text-sm font-bold ${active ? "bg-green-600 text-white" : "bg-[#1a2230] text-[#8b94a3] hover:text-white"}`}
      >
        {label}{count !== undefined ? ` (${count})` : ""}
      </Link>
    );
  };

  return (
    <main className="min-h-screen bg-[#0a0e14] text-[#e8ecf1]">
      <div className="mx-auto max-w-5xl px-4 py-8">
        <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/5 p-3 text-sm text-yellow-200/90">
          🔒 Local admin tool — not linked from the public site, noindex, production-blocked by middleware.
          Only your approve click publishes a record. Supabase is not connected — this is the local queue.
        </div>

        <h1 className="mt-4 text-3xl font-extrabold">GTADB review queue</h1>
        <p className="mt-1 text-[#8b94a3]">
          510 staged named records from the gtadb.org-derived dataset (rev 7c3f8c2).
          Pessimistic defaults: leak-reported / disputed. Every published page carries the evidence chain.
        </p>

        <div className="mt-4 grid grid-cols-3 gap-2 text-center text-sm">
          <div className="rounded-lg border border-[#1f2632] bg-[#11161f] p-2">
            <b className="text-xl">{pending.length}</b><br />pending
          </div>
          <div className="rounded-lg border border-green-500/30 bg-[#11161f] p-2">
            <b className="text-xl text-green-400">{approved.length}</b><br />published
          </div>
          <div className="rounded-lg border border-[#1f2632] bg-[#11161f] p-2">
            <b className="text-xl text-[#8b94a3]">{rejected.length}</b><br />rejected
          </div>
        </div>

        <form action="/admin/gtadb-review" method="get" className="mt-4 flex gap-2">
          <input type="hidden" name="bucket" value={bucket} />
          <input type="hidden" name="evidence" value={evidence} />
          <input type="hidden" name="state" value={state} />
          <input
            name="q"
            defaultValue={sp.q ?? ""}
            placeholder="Search name or record id…"
            className="flex-1 rounded-lg border border-[#232c3b] bg-[#0d1117] p-2 text-sm text-white"
          />
          <button className="rounded-lg bg-[#232c3b] px-4 py-2 text-sm font-bold text-white">Search</button>
        </form>

        <div className="mt-3 flex flex-wrap gap-2">
          {tab("All", "state", "all", all.length)}
          {tab("Pending", "state", "pending", pending.length)}
          {tab("Published", "state", "approved", approved.length)}
          {tab("Rejected", "state", "rejected", rejected.length)}
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {tab("locations", "bucket", "locations", all.filter((r) => r.ownerCategory === "locations").length)}
          {tab("stores", "bucket", "stores", all.filter((r) => r.ownerCategory === "stores").length)}
          {tab("others", "bucket", "others", all.filter((r) => r.ownerCategory === "others").length)}
          {tab("bucket: all", "bucket", "all")}
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {tab("leak-reported", "evidence", "leak-reported")}
          {tab("disputed", "evidence", "disputed")}
          {tab("evidence: all", "evidence", "all")}
        </div>

        <p className="mt-4 text-xs text-[#8b94a3]">
          Showing {slice.length} of {rows.length} · page {safePage}/{pages}
        </p>
        <div className="mt-2 space-y-4">
          {slice.map((r) => (
            <ReviewCard key={r.id} record={r} dedupe={dedupeById.get(r.id)} status={reviewStatus[r.id]} />
          ))}
          {slice.length === 0 && <p className="text-[#8b94a3]">No records match the filters.</p>}
        </div>

        <div className="mt-6 flex items-center justify-between">
          {safePage > 1 ? (
            <Link href={href({ page: String(safePage - 1) })} className="rounded-lg bg-[#232c3b] px-4 py-2 text-sm font-bold text-white">← Prev</Link>
          ) : <span />}
          <span className="text-xs text-[#8b94a3]">page {safePage}/{pages}</span>
          {safePage < pages ? (
            <Link href={href({ page: String(safePage + 1) })} className="rounded-lg bg-[#232c3b] px-4 py-2 text-sm font-bold text-white">Next →</Link>
          ) : <span />}
        </div>

        <p className="mt-8 text-xs text-[#8b94a3]">
          Session log: <span className="font-mono">src/modules/entities/data/gtadb/review-decisions.json</span> (committed with the data).
        </p>
      </div>
    </main>
  );
}
