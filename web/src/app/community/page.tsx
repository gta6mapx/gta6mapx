import type { Metadata } from "next";
import Link from "next/link";
import SiteHeader from "@/modules/site/SiteHeader";
import SiteFooter from "@/modules/site/SiteFooter";
import {
  CommunityStatsDashboard,
  OutboxActivityFeed,
} from "@/modules/community/ActivityFeed";

export const metadata: Metadata = {
  title: "Community Hub — Suggest Locations, Vote & Climb | GTA6mapx",
  description:
    "The GTA6mapx community hub: suggest map locations, vote on pins, see what's new, and climb the seasonal leaderboard. Guest-local for now — accounts coming later.",
};

export default function CommunityPage() {
  return (
    <main className="min-h-screen bg-[#0a0e14] text-[#e8ecf1]">
      <SiteHeader />
      <header className="border-b border-[#1f2632] bg-[#11161f]">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:py-10">
          <nav className="mb-3 text-xs text-[#8b94a3]" aria-label="Breadcrumb">
            <Link href="/" className="hover:text-white">
              Home
            </Link>{" "}
            / Community
          </nav>
          <div className="flex items-center gap-3">
            <span aria-hidden="true" className="text-3xl sm:text-4xl">
              🗺️
            </span>
            <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
              Community hub
            </h1>
          </div>
          <p className="mt-3 max-w-2xl leading-relaxed text-[#8b94a3]">
            Help map Leonida: suggest locations, confirm pins, and climb the
            seasonal leaderboard — every contribution labeled by how we know
            it.
          </p>
        </div>
      </header>
      <div className="mx-auto max-w-6xl space-y-12 px-4 pb-16">
        {/* 1. How to contribute */}
        <section>
          <h2 className="mb-3 text-lg font-bold">How to contribute</h2>
          <div className="rounded-2xl border border-white/10 bg-[#11161f] p-6">
            <p className="text-sm leading-relaxed text-[#c6cdd8]">
              Spotted a location in a trailer?{" "}
              <a
                href="/submit"
                className="font-semibold text-white underline decoration-white/40 underline-offset-4 hover:decoration-white"
              >
                Suggest a location
              </a>{" "}
              — add a pin, pick what&apos;s visible, and attach your evidence
              (trailer name + timestamp, or a public news link). Suggestions
              are reviewed by editors; approved pins go live on the map with
              their evidence chain intact.
            </p>
            <p className="mt-2 text-xs text-[#8b94a3]">
              House rules: no leaked files, no re-uploads — describe what
              public reporting says and link a news article about it.
            </p>
          </div>
        </section>

        {/* 2. Stats dashboard */}
        <section>
          <h2 className="mb-3 text-lg font-bold">This week in review</h2>
          <CommunityStatsDashboard />
        </section>

        {/* 3. Activity feed */}
        <section>
          <h2 className="mb-3 text-lg font-bold">Community activity</h2>
          <OutboxActivityFeed />
        </section>

        {/* 4. Contributors directory (opt-in, accounts phase) */}
        <section>
          <h2 className="mb-3 text-lg font-bold">Contributors</h2>
          <div className="rounded-2xl border border-white/10 bg-[#11161f] p-8 text-center">
            <p className="font-semibold">Contributor profiles go live with accounts</p>
            <p className="mt-2 text-sm text-[#8b94a3]">
              Opt-in directory, display name only — never email, IP, or device
              IDs.
            </p>
          </div>
        </section>
      </div>
      <SiteFooter />
    </main>
  );
}
