import Link from "next/link";
import { notFound } from "next/navigation";
import { ARTICLES, getArticle, getRelatedArticles } from "@/modules/articles/articles";
import SiteHeader from "@/modules/site/SiteHeader";
import SiteFooter from "@/modules/site/SiteFooter";

export function generateStaticParams() {
  return ARTICLES.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const a = getArticle(slug);
  if (!a) return {};
  return {
    title: `${a.title} | GTA6mapx`,
    description: a.meta_description,
    alternates: { canonical: `https://gta6mapx.com/guides/${a.slug}` },
  };
}

// Simple markdown-to-HTML for our generated content
function renderContent(md: string): string {
  return md
    .split("\n\n")
    .map((block) => {
      const t = block.trim();
      if (t.startsWith("## ")) return `<h2>${t.slice(3)}</h2>`;
      if (t.startsWith("# ")) return `<h1>${t.slice(2)}</h1>`;
      if (t.startsWith("- ")) {
        const items = t.split("\n").map((l) => `<li>${l.replace(/^- /, "")}</li>`).join("");
        return `<ul>${items}</ul>`;
      }
      // inline links [text](url)
      const withLinks = t.replace(
        /\[([^\]]+)\]\(([^)]+)\)/g,
        '<a href="$2">$1</a>'
      );
      // bold
      const withBold = withLinks.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
      return `<p>${withBold}</p>`;
    })
    .join("\n");
}

export default async function GuidePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const a = getArticle(slug);
  if (!a) notFound();
  const related = getRelatedArticles(a);

  // Extract FAQs from content for FAQPage schema
  const faqs: { q: string; a: string }[] = [];
  const faqMatch = a.content.match(/## (?:FAQ|Frequently Asked Questions|Questions)/i);
  if (faqMatch) {
    const faqSection = a.content.slice(faqMatch.index);
    const qaPairs = faqSection.match(/\*\*([^*?]+\?)\*\*\s*\n+([^#*]+)/g) || [];
    for (const pair of qaPairs.slice(0, 8)) {
      const qm = pair.match(/\*\*([^*?]+\?)\*\*/);
      const am = pair.match(/\*\*[^*?]+\?\*\*\s*\n+([^#*]+)/);
      if (qm && am) faqs.push({ q: qm[1].trim(), a: am[1].trim().slice(0, 500) });
    }
  }

  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: a.title,
    description: a.meta_description,
    author: { "@type": "Organization", name: "GTA6mapx", url: "https://gta6mapx.com" },
    publisher: { "@type": "Organization", name: "GTA6mapx", url: "https://gta6mapx.com" },
    datePublished: a.created_at,
    dateModified: a.created_at,
    mainEntityOfPage: `https://gta6mapx.com/guides/${a.slug}`,
    wordCount: a.word_count,
    inLanguage: "en",
    about: a.keyword,
  };

  const faqSchema = faqs.length > 0 ? {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  } : null;

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://gta6mapx.com" },
      { "@type": "ListItem", position: 2, name: "Guides", item: "https://gta6mapx.com/guides" },
      { "@type": "ListItem", position: 3, name: a.keyword, item: `https://gta6mapx.com/guides/${a.slug}` },
    ],
  };

  return (
    <main className="min-h-screen bg-[#0a0e14] text-[#e8ecf1]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }}
      />
      {faqSchema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
        />
      )}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <SiteHeader />
      <article className="max-w-3xl mx-auto px-4 py-10">
        <nav className="text-sm text-gray-400 mb-6">
          <Link href="/" className="hover:text-white">Home</Link>
          {" / "}
          <Link href="/guides" className="hover:text-white">Guides</Link>
          {" / "}
          <span className="text-gray-200">{a.keyword}</span>
        </nav>
        <h1 className="text-3xl md:text-4xl font-bold mb-4">{a.title}</h1>
        <div className="flex gap-3 text-sm text-gray-400 mb-8">
          <span className="px-2 py-1 bg-blue-900/40 rounded">
            {a.content_type === "guide" ? "📖 Guide" : a.content_type === "qa" ? "❓ Q&A" : "🔥 Topic"}
          </span>
          <span>{a.word_count} words</span>
        </div>
        <div
          className="article-content prose prose-invert max-w-none"
          dangerouslySetInnerHTML={{ __html: renderContent(a.content) }}
        />
        <div className="mt-10 p-4 bg-yellow-900/20 border border-yellow-700/40 rounded">
          <p className="text-sm text-yellow-200/90">
            <strong>Transparency note:</strong> Entity data on this site is labeled by evidence
            level (Rockstar-confirmed / Trailer-confirmed / Leak-reported / Disputed).
            Map data credits <a href="https://gtadb.org" className="underline">gtadb.org</a> (CC BY 4.0).
          </p>
        </div>
        {related.length > 0 && (
          <div className="mt-10">
            <h2 className="text-xl font-bold mb-4">Related Guides</h2>
            <div className="grid gap-3">
              {related.map((r) => (
                <Link
                  key={r.slug}
                  href={`/guides/${r.slug}`}
                  className="p-3 bg-white/5 rounded hover:bg-white/10"
                >
                  {r.title}
                </Link>
              ))}
            </div>
          </div>
        )}
      </article>
      <SiteFooter />
    </main>
  );
}
