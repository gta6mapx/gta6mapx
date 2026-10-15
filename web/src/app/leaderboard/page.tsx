import type { Metadata } from "next";
import SiteHeader from "@/modules/site/SiteHeader";
import SiteFooter from "@/modules/site/SiteFooter";
import Leaderboard from "@/modules/community/Leaderboard";

export const metadata: Metadata = {
  title: "Leaderboard — Find the Location Seasons | GTA6mapx",
  description:
    "Monthly Find the Location seasons for GTA 6 mappers. Season total = your best round per location. Guest-local for now — account sync coming later.",
};

export default function LeaderboardPage() {
  return (
    <main className="min-h-screen bg-[#0a0e14] text-[#e8ecf1]">
      <SiteHeader />
      <Leaderboard />
      <div className="mx-auto max-w-4xl px-4 pb-10">
        <p className="rounded-2xl border border-white/10 bg-[#11161f] p-4 text-xs leading-relaxed text-[#8b94a3]">
          Fan project — not affiliated with Rockstar Games. This board is a
          device-local demo: monthly seasons, replay decay, and server-side
          scoring arrive with accounts. Email verification will be required for
          the public top-100.
        </p>
      </div>
      <SiteFooter />
    </main>
  );
}
