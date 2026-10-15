import { VEHICLES, VEHICLE_CLASSES } from "@/modules/entities/data/vehicles";
import EntityCard from "@/modules/entities/components/EntityCard";
import SiteHeader from "@/modules/site/SiteHeader";
import SiteFooter from "@/modules/site/SiteFooter";
import HubHeader, { HubActions } from "@/modules/site/HubHeader";
import { itemListJsonLd } from "@/modules/seo/jsonld";

export const metadata = {
  title: "All GTA 6 Vehicles & Cars List — GTA6mapx",
  description:
    "Every GTA 6 vehicle reported so far: trailer-confirmed cars, leak-reported models and Ultimate Edition exclusives. Each with honest evidence labels.",
};

export default function VehiclesHub() {
  const jsonLd = itemListJsonLd(
    "GTA 6 Vehicles List",
    "All vehicles publicly reported for GTA 6, with evidence status.",
    VEHICLES.map((v) => ({ name: v.name, url: `/vehicles/${v.slug}` }))
  );
  return (
    <main className="min-h-screen bg-[#0a0e14] text-[#e8ecf1]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <SiteHeader />
      <HubHeader
        crumb="Vehicles"
        icon="🚗"
        title="GTA 6 Vehicles"
        blurb="Trailer-confirmed cars, leak-reported models and Ultimate Edition exclusives. We label exactly how we know each one."
        count={VEHICLES.length}
        countUnit="vehicles"
        actions={<HubActions secondary={{ href: "/locations", label: "Browse locations →" }} />}
      />
      <div className="mx-auto max-w-6xl px-4 pb-16">
        {VEHICLE_CLASSES.map((cls) => {
          const list = VEHICLES.filter((v) => v.vclass === cls);
          return (
            <section key={cls} className="mt-10">
              <h2 className="text-lg font-bold mb-3">
                {cls} <span className="text-sm font-normal text-[#8b94a3]">({list.length})</span>
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {list.map((v) => (
                  <EntityCard key={v.slug} entity={v} />
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
