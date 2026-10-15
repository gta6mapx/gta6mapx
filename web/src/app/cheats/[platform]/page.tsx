import Link from "next/link";
import { notFound } from "next/navigation";
import SiteHeader from "@/modules/site/SiteHeader";
import SiteFooter from "@/modules/site/SiteFooter";
import { articleJsonLd, breadcrumbJsonLd } from "@/modules/seo/jsonld";

const PLATFORMS: Record<
  string,
  { name: string; icon: string; input: string; history: string }
> = {
  ps5: {
    name: "PS5",
    icon: "🎮",
    input: "Button combos entered during gameplay (unconfirmed — based on how past GTA games worked).",
    history:
      "Every GTA since the PS2 era used controller button combos for cheats: sequences like weapon spawns, health/armor, wanted-level changes and vehicle spawns. Combos were identical across PlayStation generations for each title.",
  },
  xbox: {
    name: "Xbox Series X|S",
    icon: "🕹️",
    input: "Button combos entered during gameplay (unconfirmed — based on how past GTA games worked).",
    history:
      "Xbox GTA titles mirrored the PlayStation system with controller button combos for the same cheat categories — weapons, health, wanted level, weather and spawns. Expect the same pattern if Rockstar keeps tradition.",
  },
  pc: {
    name: "PC",
    icon: "⌨️",
    input: "Word-based console commands (unconfirmed — based on how past GTA games worked).",
    history:
      "GTA V on PC added a cheat console: typing a word triggered the effect, alongside full controller-combo support. PC also historically gets trainer tools — but those are third-party, not official cheats.",
  },
};

export function generateStaticParams() {
  return Object.keys(PLATFORMS).map((platform) => ({ platform }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ platform: string }>;
}) {
  const { platform } = await params;
  const p = PLATFORMS[platform];
  if (!p) return {};
  return {
    title: `GTA 6 Cheats ${p.name} — Honest Status | GTA6mapx`,
    description: `GTA 6 cheat codes for ${p.name}: no codes confirmed yet. Honest status, how cheats worked in past games, and our launch verification plan. No fake codes.`,
  };
}

export default async function CheatPlatformPage({
  params,
}: {
  params: Promise<{ platform: string }>;
}) {
  const { platform } = await params;
  const p = PLATFORMS[platform];
  if (!p) notFound();

  const entity = {
    slug: `cheats-${platform}`,
    name: `GTA 6 Cheats — ${p.name}`,
    kind: "location" as const,
    evidence: {
      status: "leak-reported" as const,
      detail: "No cheat codes confirmed pre-launch",
    },
    summary: `Cheat-code status for GTA 6 on ${p.name}.`,
    tags: ["cheats", platform],
  };

  return (
    <main className="min-h-screen bg-[#0a0e14] text-[#e8ecf1]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(articleJsonLd(entity, `/cheats/${platform}`)),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            breadcrumbJsonLd([
              { name: "Home", url: "/" },
              { name: "Cheats", url: "/cheats" },
              { name: p.name, url: `/cheats/${platform}` },
            ])
          ),
        }}
      />

      <SiteHeader />

      <div className="mx-auto max-w-3xl px-4 py-8">
        <nav className="text-xs text-[#8b94a3] mb-5" aria-label="Breadcrumb">
          <Link href="/" className="hover:text-white">Home</Link> /{" "}
          <Link href="/cheats" className="hover:text-white">Cheats</Link> /{" "}
          <span className="text-[#c3cad4]">{p.name}</span>
        </nav>

        <div className="flex items-center gap-3">
          <span aria-hidden="true" className="text-3xl">{p.icon}</span>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
            GTA 6 Cheats — {p.name}
          </h1>
        </div>

        <div className="mt-6 rounded-2xl border border-yellow-500/30 bg-gradient-to-b from-yellow-500/[0.07] to-transparent p-5">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <h2 className="text-sm font-bold uppercase tracking-wider text-yellow-200">
              ⏳ Verification status
            </h2>
            <span className="badge badge-speculation">Unconfirmed</span>
          </div>
          <p className="text-sm leading-relaxed text-yellow-100/90">
            Zero cheat codes are verified for GTA 6 on {p.name} yet. If you see a site listing
            codes today, they&apos;re invented. We refresh this page the moment real codes are
            tested at launch.
          </p>
        </div>

        <section className="mt-8">
          <h2 className="text-lg font-bold mb-2">Expected input method</h2>
          <p className="text-sm text-[#c3cad4] leading-relaxed">{p.input}</p>
        </section>

        <section className="mt-6">
          <h2 className="text-lg font-bold mb-2">How it worked in past games</h2>
          <div className="rounded-xl border border-[#1f2632] bg-[#11161f] p-4 text-sm text-[#c3cad4] leading-relaxed">
            <p>{p.history}</p>
            <p className="mt-3 text-[#8b94a3]">
              ⚠️ Historical context only — Rockstar has not confirmed cheat support for GTA 6.
            </p>
          </div>
        </section>

        <section className="mt-6">
          <h2 className="text-lg font-bold mb-2">What we&apos;re watching for</h2>
          <ul className="list-disc pl-5 space-y-2 text-sm text-[#c3cad4] leading-relaxed">
            <li>Official Rockstar statements or manual leaks mentioning cheat input.</li>
            <li>Review copies and early streams — cheats usually surface within days of launch.</li>
            <li>Our launch-week sprint: every reported code tested on real hardware before we publish it.</li>
          </ul>
        </section>

        <div className="mt-8 rounded-xl border border-[#1f2632] bg-[#11161f] p-4 text-sm text-[#8b94a3] leading-relaxed">
          🔔 <b className="text-white">Get notified:</b> join the launch list on the{" "}
          <Link href="/" className="text-green-400 underline">homepage</Link> — we send one
          email when cheat verification goes live. No spam.
        </div>

        <div className="mt-6 flex gap-2 text-sm">
          {Object.entries(PLATFORMS)
            .filter(([slug]) => slug !== platform)
            .map(([slug, other]) => (
              <Link
                key={slug}
                href={`/cheats/${slug}`}
                className="rounded-lg border border-[#1f2632] px-4 py-2 hover:border-green-500"
              >
                {other.icon} {other.name} status →
              </Link>
            ))}
        </div>
      </div>

      <SiteFooter />
    </main>
  );
}
