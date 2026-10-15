import { LOCATIONS, LOCATION_REGIONS } from "@/modules/entities/data/locations";
import EntityCard from "@/modules/entities/components/EntityCard";
import SiteHeader from "@/modules/site/SiteHeader";
import SiteFooter from "@/modules/site/SiteFooter";
import { itemListJsonLd } from "@/modules/seo/jsonld";
import HubHeader, { HubActions } from "@/modules/site/HubHeader";

export const metadata = {
  title: "GTA 6 Map Locations — All Leonida Regions | GTA6mapx",
  description:
    "Every GTA 6 location reported so far: Rockstar-confirmed regions, trailer-confirmed districts, and honestly-labeled disputed leaks. With evidence chains.",
};

export default function LocationsHub() {
  const jsonLd = itemListJsonLd(
    "GTA 6 Map Locations",
    "All Leonida locations publicly reported for GTA 6, with evidence status.",
    LOCATIONS.map((l) => ({ name: l.name, url: `/locations/${l.slug}` }))
  );
  return (
    <main className="min-h-screen bg-[#0a0e14] text-[#e8ecf1]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <SiteHeader />
      <HubHeader
        crumb="Locations"
        icon="🗺️"
        title="GTA 6 Map Locations"
        blurb="Rockstar-confirmed regions, trailer-confirmed districts — and disputed leaks labeled as disputed, not as fact."
        count={LOCATIONS.length}
        countUnit="Leonida locations"
        actions={<HubActions secondary={{ href: "/vehicles", label: "Browse vehicles →" }} />}
      />
      <div className="mx-auto max-w-6xl px-4 pb-16">
        {LOCATION_REGIONS.map((region) => {
          const list = LOCATIONS.filter((l) => l.region === region);
          return (
            <section key={region} className="mt-10">
              <h2 className="text-lg font-bold mb-3">
                {region} <span className="text-sm font-normal text-[#8b94a3]">({list.length})</span>
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {list.map((l) => (
                  <EntityCard key={l.slug} entity={l} />
                ))}
              </div>
            </section>
          );
        })}
      </div>
      <SiteFooter />
    </main>
  );
}
