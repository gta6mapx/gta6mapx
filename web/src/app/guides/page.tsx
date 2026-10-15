import type { Metadata } from "next";
import Link from "next/link";
import { ARTICLES } from "@/modules/articles/articles";
import SiteHeader from "@/modules/site/SiteHeader";
import SiteFooter from "@/modules/site/SiteFooter";

export const metadata: Metadata = {
  title: "GTA 6 Guides — Every Question Answered | GTA6mapx",
  description:
    "Browse all GTA 6 guides: map, vehicles, characters, release date, price, gameplay and more. Evidence-labeled, constantly updated.",
};

export default function GuidesPage() {
  const guides = ARTICLES.filter((a) => a.content_type === "guide").slice(0, 50);
  const qas = ARTICLES.filter((a) => a.content_type === "qa").slice(0, 30);

  return (
    <main className="min-h-screen bg-[#0a0e14] text-[#e8ecf1]">
      <SiteHeader />
      <div className="max-w-5xl mx-auto px-4 py-10">
        <h1 className="text-3xl md:text-4xl font-bold mb-2">GTA 6 Guides</h1>
        <p className="text-gray-400 mb-8">
          {ARTICLES.length.toLocaleString()} evidence-labeled guides covering every GTA 6 topic.
        </p>

        <h2 className="text-2xl font-bold mb-4">📖 Popular Guides</h2>
        <div className="grid md:grid-cols-2 gap-3 mb-10">
          {guides.map((a) => (
            <Link
              key={a.slug}
              href={`/guides/${a.slug}`}
              className="p-4 bg-white/5 rounded hover:bg-white/10"
            >
              <div className="font-semibold">{a.title}</div>
              <div className="text-sm text-gray-400 mt-1">{a.word_count} words</div>
            </Link>
          ))}
        </div>

        <h2 className="text-2xl font-bold mb-4">❓ Questions Answered</h2>
        <div className="grid md:grid-cols-2 gap-3">
          {qas.map((a) => (
            <Link
              key={a.slug}
              href={`/guides/${a.slug}`}
              className="p-4 bg-white/5 rounded hover:bg-white/10"
            >
              <div className="font-semibold">{a.title}</div>
            </Link>
          ))}
        </div>
      </div>
      <SiteFooter />
    </main>
  );
}
