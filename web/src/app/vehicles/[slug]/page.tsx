import Link from "next/link";
import { notFound } from "next/navigation";
import { VEHICLES } from "@/modules/entities/data/vehicles";
import { getVehicle, relatedEntities } from "@/modules/entities/lib/entity";
import SiteHeader from "@/modules/site/SiteHeader";
import SiteFooter from "@/modules/site/SiteFooter";
import EntityDetailLayout, {
  SprintNote,
  UltimateEditionBadge,
} from "@/modules/entities/components/EntityDetailLayout";
import { EVIDENCE_META } from "@/modules/entities/types";
import { articleJsonLd, breadcrumbJsonLd } from "@/modules/seo/jsonld";

export function generateStaticParams() {
  return VEHICLES.map((v) => ({ slug: v.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const v = getVehicle(slug);
  if (!v) return {};
  return {
    title: `${v.name} — GTA 6 Vehicle | GTA6mapx`,
    description: `${v.name} (${v.manufacturer} ${v.vclass}) in GTA 6: ${v.summary} Evidence: ${EVIDENCE_META[v.evidence.status].label}.`,
  };
}

export default async function VehiclePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const v = getVehicle(slug);
  if (!v) notFound();
  const related = relatedEntities(v);

  return (
    <main className="min-h-screen bg-[#0a0e14] text-[#e8ecf1]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(articleJsonLd(v, `/vehicles/${v.slug}`)),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            breadcrumbJsonLd([
              { name: "Home", url: "/" },
              { name: "Vehicles", url: "/vehicles" },
              { name: v.name, url: `/vehicles/${v.slug}` },
            ])
          ),
        }}
      />

      <SiteHeader />

      <EntityDetailLayout
        entity={v}
        hubHref="/vehicles"
        hubLabel="Vehicles"
        subLine={`${v.manufacturer} · ${v.vclass}`}
        badgeExtras={
          <>
            {v.ultimateEditionExclusive && <UltimateEditionBadge />}
            {v.isNewModel && (
              <span className="text-xs text-[#8b94a3]">New to the series (reported)</span>
            )}
          </>
        }
        sprintNote={
          <SprintNote>
            Full specs (price, top speed, spawn spots) unlock after our launch-week
            verification sprint. <Link href="/map" className="underline">Track it on the map →</Link>
          </SprintNote>
        }
        related={related}
        relatedTitle="Related vehicles"
      />

      <SiteFooter />
    </main>
  );
}
