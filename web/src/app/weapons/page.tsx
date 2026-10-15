import { WEAPONS, WEAPON_CLASSES } from "@/modules/entities/data/weapons";
import HubHeader, { HubActions } from "@/modules/site/HubHeader";
import EntityCard from "@/modules/entities/components/EntityCard";
import SiteHeader from "@/modules/site/SiteHeader";
import SiteFooter from "@/modules/site/SiteFooter";
import { itemListJsonLd } from "@/modules/seo/jsonld";

export const metadata = {
  title: "All GTA 6 Weapons List — Confirmed Guns | GTA6mapx",
  description:
    "Every GTA 6 weapon reported so far: trailer-confirmed guns, melee and throwables with honest evidence labels. No fake stats.",
};

export default function WeaponsHub() {
  const jsonLd = itemListJsonLd(
    "GTA 6 Weapons List",
    "All weapons publicly reported for GTA 6, with evidence status.",
    WEAPONS.map((w) => ({ name: w.name, url: `/weapons/${w.slug}` }))
  );
  return (
    <main className="min-h-screen bg-[#0a0e14] text-[#e8ecf1]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <SiteHeader />
      <HubHeader
        crumb="Weapons"
        icon="🔫"
        title="GTA 6 Weapons"
        blurb="Spotted in trailers and the Extended Look. We label exactly how we know each one, and we never invent damage stats."
        count={WEAPONS.length}
        countUnit="weapons"
        actions={<HubActions secondary={{ href: "/vehicles", label: "Browse vehicles →" }} />}
      />
      <div className="mx-auto max-w-6xl px-4 pb-16">
        {WEAPON_CLASSES.map((cls) => {
          const list = WEAPONS.filter((w) => w.wclass === cls);
          if (list.length === 0) return null;
          return (
            <section key={cls} className="mt-10">
              <h2 className="text-lg font-bold mb-3">
                {cls} <span className="text-sm font-normal text-[#8b94a3]">({list.length})</span>
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {list.map((w) => (
                  <EntityCard key={w.slug} entity={w} />
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
