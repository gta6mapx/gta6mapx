import Link from "next/link";
import { notFound } from "next/navigation";
import { CHARACTERS } from "@/modules/entities/data/characters";
import { getCharacter, relatedEntities } from "@/modules/entities/lib/entity";
import SiteHeader from "@/modules/site/SiteHeader";
import SiteFooter from "@/modules/site/SiteFooter";
import EntityDetailLayout from "@/modules/entities/components/EntityDetailLayout";
import { EVIDENCE_META } from "@/modules/entities/types";
import { articleJsonLd, breadcrumbJsonLd } from "@/modules/seo/jsonld";

export function generateStaticParams() {
  return CHARACTERS.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const c = getCharacter(slug);
  if (!c) return {};
  return {
    title: `${c.name} — GTA 6 Character | GTA6mapx`,
    description: `${c.name} (${c.role}) in GTA 6: ${c.summary} Evidence: ${EVIDENCE_META[c.evidence.status].label}.`,
  };
}

export default async function CharacterPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const c = getCharacter(slug);
  if (!c) notFound();
  const related = relatedEntities(c);

  return (
    <main className="min-h-screen bg-[#0a0e14] text-[#e8ecf1]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(articleJsonLd(c, `/characters/${c.slug}`)),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            breadcrumbJsonLd([
              { name: "Home", url: "/" },
              { name: "Characters", url: "/characters" },
              { name: c.name, url: `/characters/${c.slug}` },
            ])
          ),
        }}
      />

      <SiteHeader />

      <EntityDetailLayout
        entity={c}
        hubHref="/characters"
        hubLabel="Characters"
        subLine={c.affiliation ? `${c.role} · ${c.affiliation}` : c.role}
        sprintNote={
          <div className="rounded-xl border border-[#1f2632] bg-[#11161f] p-4 text-sm text-[#8b94a3] leading-relaxed">
            💡 <b className="text-white">Story role:</b> full story details are under wraps until
            Rockstar reveals more. We update this page the moment official bios expand —{" "}
            <Link href="/map" className="text-green-400 underline">track story locations on the map →</Link>
          </div>
        }
        related={related}
        relatedTitle="Related characters"
      />

      <SiteFooter />
    </main>
  );
}
