import Link from "next/link";
import SiteHeader from "@/modules/site/SiteHeader";
import SiteFooter from "@/modules/site/SiteFooter";
import HubHeader, { HubActions } from "@/modules/site/HubHeader";
import { itemListJsonLd } from "@/modules/seo/jsonld";

export const metadata = {
  title: "GTA 6 Cheats — Honest Status Per Platform | GTA6mapx",
  description:
    "GTA 6 cheat codes: no codes are confirmed yet. We track the honest status per platform and verify every code at launch. No fake codes, ever.",
};

const PLATFORMS = [
  { slug: "ps5", name: "PS5", icon: "🎮", note: "Button-combo cheats expected — none confirmed yet." },
  { slug: "xbox", name: "Xbox Series X|S", icon: "🕹️", note: "Button-combo cheats expected — none confirmed yet." },
  { slug: "pc", name: "PC", icon: "⌨️", note: "Console-command cheats expected — none confirmed yet." },
];

export default function CheatsHub() {
  const jsonLd = itemListJsonLd(
    "GTA 6 Cheats",
    "Honest cheat-code status for GTA 6 per platform.",
    PLATFORMS.map((p) => ({ name: `GTA 6 Cheats — ${p.name}`, url: `/cheats/${p.slug}` }))
  );
  return (
    <main className="min-h-screen bg-[#0a0e14] text-[#e8ecf1]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <SiteHeader />
      <HubHeader
        crumb="Cheats"
        icon="⌨️"
        title="GTA 6 Cheats"
        blurb="The honest truth, up front: no cheat codes are confirmed for GTA 6 yet. Any site listing codes today is making them up. We publish the status per platform and verify every code during our launch-week sprint."
        count={PLATFORMS.length}
        countUnit="platforms tracked"
        showLegend={false}
        actions={<HubActions secondary={{ href: "/weapons", label: "Browse weapons →" }} />}
      />

      <div className="mx-auto max-w-6xl px-4 pb-16">
        <div className="mt-6 rounded-xl border border-yellow-500/30 bg-yellow-500/5 p-4 text-sm leading-relaxed text-yellow-100/90">
          ⏳ <b>Status: unconfirmed.</b> GTA 6 launches November 19, 2026. This page refreshes
          the moment real codes are verified — bookmark it.
        </div>

        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          {PLATFORMS.map((p) => (
            <Link
              key={p.slug}
              href={`/cheats/${p.slug}`}
              className="rounded-xl border border-[#1f2632] bg-[#11161f] p-5 hover:border-green-500 transition block"
            >
              <div className="text-2xl mb-2">{p.icon}</div>
              <h2 className="font-bold">GTA 6 Cheats — {p.name}</h2>
              <p className="mt-1 text-sm text-[#8b94a3] leading-relaxed">{p.note}</p>
              <span className="mt-2 inline-block text-sm text-green-400">Status & details →</span>
            </Link>
          ))}
        </div>

        <section className="mt-10 max-w-3xl">
          <h2 className="text-lg font-bold mb-3">How cheats worked in past GTA games</h2>
          <div className="rounded-xl border border-[#1f2632] bg-[#11161f] p-5 text-sm text-[#c3cad4] leading-relaxed space-y-3">
            <p>
              <b className="text-white">Consoles (PS/Xbox):</b> classic button-combo codes entered
              during gameplay — e.g. weapon, health and wanted-level cheats. Combos were the same
              across the PS3/PS4/PS5 and Xbox generations for each game.
            </p>
            <p>
              <b className="text-white">PC:</b> word-based console commands typed into a cheat console
              (e.g. typing a word for a specific effect) — plus the same button combos via controller.
            </p>
            <p>
              <b className="text-white">The catch:</b> using cheats in past games disabled achievements/trophies
              for that session and blocked some mission ratings. Expect a similar trade-off in GTA 6 —
              <b> but this is not confirmed yet.</b>
            </p>
          </div>
        </section>

        <section className="mt-10 max-w-3xl">
          <h2 className="text-lg font-bold mb-3">Our verification promise</h2>
          <ol className="list-decimal pl-5 space-y-2 text-sm text-[#c3cad4] leading-relaxed">
            <li>At launch, we test every reported code on real hardware — no copy-pasting from other sites.</li>
            <li>Each code gets an evidence label: <b className="text-white">verified</b> (we tested it), <b className="text-white">reported</b> (credible reports, untested), or <b className="text-white">fake</b> (debunked).</li>
            <li>Fake codes get a public debunk note so you never waste time on them.</li>
          </ol>
          <p className="mt-4 text-sm text-[#8b94a3]">
            Meanwhile: <Link href="/map" className="text-green-400 underline">explore the interactive map</Link> ·{" "}
            <Link href="/weapons" className="text-green-400 underline">browse confirmed weapons</Link>
          </p>
        </section>
      </div>
      <SiteFooter />
    </main>
  );
}
