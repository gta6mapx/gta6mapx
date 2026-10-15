import type { MetadataRoute } from "next";
import { LOCATIONS } from "@/modules/entities/data/locations";
import { VEHICLES } from "@/modules/entities/data/vehicles";
import { CHARACTERS } from "@/modules/entities/data/characters";
import { WEAPONS } from "@/modules/entities/data/weapons";
import { ARTICLES } from "@/modules/articles/articles";

const BASE = "https://gta6mapx.com";

// Static pages with SEO priority
const STATIC_PAGES: { path: string; priority: number; changefreq: "daily" | "weekly" | "monthly" }[] = [
  { path: "", priority: 1.0, changefreq: "daily" },
  { path: "/map", priority: 0.9, changefreq: "daily" },
  { path: "/locations", priority: 0.9, changefreq: "weekly" },
  { path: "/vehicles", priority: 0.9, changefreq: "weekly" },
  { path: "/weapons", priority: 0.8, changefreq: "weekly" },
  { path: "/characters", priority: 0.8, changefreq: "weekly" },
  { path: "/cheats", priority: 0.8, changefreq: "weekly" },
  { path: "/library", priority: 0.7, changefreq: "weekly" },
  { path: "/guides", priority: 0.9, changefreq: "daily" },
  { path: "/community", priority: 0.6, changefreq: "daily" },
  { path: "/leaderboard", priority: 0.5, changefreq: "daily" },
  { path: "/game/find-the-location", priority: 0.6, changefreq: "monthly" },
  { path: "/submit", priority: 0.4, changefreq: "monthly" },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const staticUrls: MetadataRoute.Sitemap = STATIC_PAGES.map((p) => ({
    url: `${BASE}${p.path}`,
    lastModified: now,
    changeFrequency: p.changefreq,
    priority: p.priority,
  }));

  const locationUrls: MetadataRoute.Sitemap = LOCATIONS.map((l) => ({
    url: `${BASE}/locations/${l.slug}`,
    lastModified: now,
    changeFrequency: "monthly" as const,
    priority: 0.7,
  }));

  const vehicleUrls: MetadataRoute.Sitemap = VEHICLES.map((v) => ({
    url: `${BASE}/vehicles/${v.slug}`,
    lastModified: now,
    changeFrequency: "monthly" as const,
    priority: 0.7,
  }));

  const characterUrls: MetadataRoute.Sitemap = CHARACTERS.map((c) => ({
    url: `${BASE}/characters/${c.slug}`,
    lastModified: now,
    changeFrequency: "monthly" as const,
    priority: 0.6,
  }));

  const weaponUrls: MetadataRoute.Sitemap = WEAPONS.map((w) => ({
    url: `${BASE}/weapons/${w.slug}`,
    lastModified: now,
    changeFrequency: "monthly" as const,
    priority: 0.6,
  }));

  const guideUrls: MetadataRoute.Sitemap = ARTICLES.map((a) => ({
    url: `${BASE}/guides/${a.slug}`,
    lastModified: now,
    changeFrequency: "weekly" as const,
    priority: a.content_type === "guide" ? 0.8 : 0.6,
  }));

  return [...staticUrls, ...locationUrls, ...vehicleUrls, ...characterUrls, ...weaponUrls, ...guideUrls];
}
