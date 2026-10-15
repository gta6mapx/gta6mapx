import { CHARACTERS } from "@/modules/entities/data/characters";
import HubHeader, { HubActions } from "@/modules/site/HubHeader";
import EntityCard from "@/modules/entities/components/EntityCard";
import SiteHeader from "@/modules/site/SiteHeader";
import SiteFooter from "@/modules/site/SiteFooter";
import { itemListJsonLd } from "@/modules/seo/jsonld";

export const metadata = {
  title: "GTA 6 Characters — Lucia, Jason & Cast | GTA6mapx",
  description:
    "Every GTA 6 character confirmed so far: Lucia Caminos, Jason Duval and the Leonida supporting cast — honestly sourced from Rockstar's official reveals.",
};

export default function CharactersHub() {
  const jsonLd = itemListJsonLd(
    "GTA 6 Characters",
    "Characters confirmed for GTA 6 by Rockstar Games.",
    CHARACTERS.map((c) => ({ name: c.name, url: `/characters/${c.slug}` }))
  );
  const protagonists = CHARACTERS.filter((c) => c.role === "Protagonist");
  const supporting = CHARACTERS.filter((c) => c.role !== "Protagonist");
  return (
    <main className="min-h-screen bg-[#0a0e14] text-[#e8ecf1]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <SiteHeader />
      <HubHeader
        crumb="Characters"
        icon="🧑‍🤝‍🧑"
        title="GTA 6 Characters"
        blurb="Revealed through Rockstar's official materials. Dual protagonists, Bonnie-and-Clyde style — every entry labeled by how we know it."
        count={CHARACTERS.length}
        countUnit="characters"
        actions={<HubActions secondary={{ href: "/cheats", label: "Cheat status →" }} />}
      />
      <div className="mx-auto max-w-6xl px-4 pb-16">
        <section className="mt-10">
          <h2 className="text-lg font-bold mb-3">Protagonists</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {protagonists.map((c) => (
              <EntityCard key={c.slug} entity={c} />
            ))}
          </div>
        </section>
        <section className="mt-10">
          <h2 className="text-lg font-bold mb-3">
            Supporting cast <span className="text-sm font-normal text-[#8b94a3]">({supporting.length})</span>
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {supporting.map((c) => (
              <EntityCard key={c.slug} entity={c} />
            ))}
          </div>
        </section>
      </div>
      <SiteFooter />
    </main>
  );
}
