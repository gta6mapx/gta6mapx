// ─── modules/entities/lib/entity.ts ────────────────────────────────────────
// Query helpers over the entity datasets. When Supabase is wired up,
// these become async DB calls with the same signatures.

import { VEHICLES } from "../data/vehicles";
import { LOCATIONS } from "../data/locations";
import { WEAPONS } from "../data/weapons";
import { CHARACTERS } from "../data/characters";
import type { Entity, EvidenceStatus, Vehicle, GameLocation, Weapon, Character } from "../types";

export function getVehicle(slug: string): Vehicle | undefined {
  return VEHICLES.find((v) => v.slug === slug);
}

export function getLocation(slug: string): GameLocation | undefined {
  return LOCATIONS.find((l) => l.slug === slug);
}

export function getWeapon(slug: string): Weapon | undefined {
  return WEAPONS.find((w) => w.slug === slug);
}

export function getCharacter(slug: string): Character | undefined {
  return CHARACTERS.find((c) => c.slug === slug);
}

export function relatedEntities(entity: Entity, n = 4): Entity[] {
  const pool: Entity[] =
    entity.kind === "vehicle"
      ? [...VEHICLES]
      : entity.kind === "location"
        ? [...LOCATIONS]
        : entity.kind === "weapon"
          ? [...WEAPONS]
          : [...CHARACTERS];
  const scored = pool
    .filter((e) => e.slug !== entity.slug)
    .map((e) => ({
      e,
      score: e.tags.filter((t) => entity.tags.includes(t)).length,
    }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);
  const rel = scored.slice(0, n).map((s) => s.e);
  // fill with same-kind entities if not enough tag overlap
  if (rel.length < n) {
    for (const e of pool) {
      if (rel.length >= n) break;
      if (e.slug !== entity.slug && !rel.includes(e)) rel.push(e);
    }
  }
  return rel;
}

export function countByStatus(
  list: Entity[],
  status: EvidenceStatus
): number {
  return list.filter((e) => e.evidence.status === status).length;
}
