// ─── modules/seo/jsonld.ts ─────────────────────────────────────────────────
// Structured data builders for programmatic SEO pages.

import type { Entity } from "@/modules/entities/types";

const SITE = "https://gta6mapx.com";

export function itemListJsonLd(
  name: string,
  description: string,
  items: { name: string; url: string }[]
) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name,
    description,
    numberOfItems: items.length,
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      url: `${SITE}${item.url}`,
    })),
  };
}

export function articleJsonLd(entity: Entity, url: string) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: `${entity.name} — GTA 6`,
    description: entity.summary,
    mainEntityOfPage: `${SITE}${url}`,
    author: { "@type": "Organization", name: "GTA6mapx" },
    publisher: { "@type": "Organization", name: "GTA6mapx" },
  };
}

export function breadcrumbJsonLd(crumbs: { name: string; url: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.name,
      item: `${SITE}${c.url}`,
    })),
  };
}
