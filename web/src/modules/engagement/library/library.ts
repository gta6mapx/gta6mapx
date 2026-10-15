// ─── modules/engagement/library/library.ts ─────────────────────────────────
// Intel Library: unified dossier index over the curated entity datasets.
// Pure data layer — no DOM, no Next.js. Safe to import from Node scripts.

import type {
  Character,
  Entity,
  Evidence,
  EvidenceStatus,
  GameLocation,
  Vehicle,
  Weapon,
} from "../../entities/types";
import { VEHICLES } from "../../entities/data/vehicles";
import { LOCATIONS } from "../../entities/data/locations";
import { WEAPONS } from "../../entities/data/weapons";
import { CHARACTERS } from "../../entities/data/characters";

export type DossierKind = "vehicle" | "location" | "weapon" | "character";

/** Facet values a dossier carries (null when the facet doesn't apply to its kind). */
export interface DossierFacets {
  region: string | null;
  manufacturer: string | null;
  vclass: string | null;
  wclass: string | null;
  role: string | null;
}

export interface Dossier {
  slug: string;
  name: string;
  kind: DossierKind;
  evidence: Evidence;
  summary: string;
  tags: string[];
  /** Kind-specific microline, e.g. "Benefactor · Sports" / "Vice City · Miami Beach". */
  microline: string;
  /** Deep link to the existing entity route. */
  href: string;
  facets: DossierFacets;
}

export const KIND_ORDER: DossierKind[] = [
  "vehicle",
  "location",
  "weapon",
  "character",
];

export const KIND_LABEL: Record<DossierKind, string> = {
  vehicle: "Vehicle",
  location: "Location",
  weapon: "Weapon",
  character: "Character",
};

export const KIND_PLURAL: Record<DossierKind, string> = {
  vehicle: "Vehicles",
  location: "Locations",
  weapon: "Weapons",
  character: "Characters",
};

/** Eyebrow text on dossier cards (spec §2.2 card anatomy). */
export const KIND_EYEBROW: Record<DossierKind, string> = {
  vehicle: "VEHICLE",
  location: "LOCATION",
  weapon: "WEAPON",
  character: "CHARACTER",
};

const KIND_ROUTE: Record<DossierKind, string> = {
  vehicle: "/vehicles",
  location: "/locations",
  weapon: "/weapons",
  character: "/characters",
};

/** Evidence strength order: rockstar-confirmed → trailer-confirmed → leak-reported → disputed. */
export const EVIDENCE_ORDER: EvidenceStatus[] = [
  "rockstar-confirmed",
  "trailer-confirmed",
  "leak-reported",
  "disputed",
];

type AnyEntity = Vehicle | GameLocation | Weapon | Character;

function microlineFor(e: AnyEntity): string {
  switch (e.kind) {
    case "vehicle":
      return `${e.manufacturer} · ${e.vclass}`;
    case "location":
      return e.realWorldInspiration
        ? `${e.region} · ${e.realWorldInspiration}`
        : e.region;
    case "weapon":
      return e.wclass;
    case "character":
      return e.role;
  }
}

function facetsFor(e: AnyEntity): DossierFacets {
  return {
    region: e.kind === "location" ? e.region : null,
    manufacturer: e.kind === "vehicle" ? e.manufacturer : null,
    vclass: e.kind === "vehicle" ? e.vclass : null,
    wclass: e.kind === "weapon" ? e.wclass : null,
    role: e.kind === "character" ? e.role : null,
  };
}

function toDossier(e: Entity & AnyEntity): Dossier {
  return {
    slug: e.slug,
    name: e.name,
    kind: e.kind,
    evidence: e.evidence,
    summary: e.summary,
    tags: [...e.tags],
    microline: microlineFor(e),
    href: `${KIND_ROUTE[e.kind]}/${e.slug}`,
    facets: facetsFor(e),
  };
}

/** Build the unified dossier index from the curated entity datasets. */
export function buildDossierIndex(): Dossier[] {
  const all: AnyEntity[] = [
    ...VEHICLES,
    ...LOCATIONS,
    ...WEAPONS,
    ...CHARACTERS,
  ];
  return all.map(toDossier);
}

/** Distinct facet values, derived from the data (never invented). */
export interface LibraryFacets {
  regions: string[];
  manufacturers: string[];
  vclasses: string[];
  wclasses: string[];
  roles: string[];
}

export function buildFacets(): LibraryFacets {
  const uniq = (xs: string[]) => [...new Set(xs)].sort();
  return {
    regions: uniq(LOCATIONS.map((l) => l.region)),
    manufacturers: uniq(VEHICLES.map((v) => v.manufacturer)),
    vclasses: uniq(VEHICLES.map((v) => v.vclass)),
    wclasses: uniq(WEAPONS.map((w) => w.wclass)),
    roles: uniq(CHARACTERS.map((c) => c.role)),
  };
}
