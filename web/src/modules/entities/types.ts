// ─── modules/entities — shared entity model ────────────────────────────────
// Every entity carries its EVIDENCE CHAIN. This is our differentiator:
// competitors present leaks as facts — we label exactly how we know.

export type EvidenceStatus =
  | "rockstar-confirmed" // Rockstar officially announced
  | "trailer-confirmed" // clearly visible in official trailer/promo (publicly reported)
  | "leak-reported" // seen in leaked footage (unverified)
  | "disputed"; // leak whose authenticity is questioned

export interface Evidence {
  status: EvidenceStatus;
  detail: string; // e.g. "Trailer 2 @ 0:42" or "Gameplay leak, Aug 2026"
  sourceUrl?: string;
}

export interface Entity {
  slug: string;
  name: string;
  kind: "vehicle" | "location" | "weapon" | "character";
  evidence: Evidence;
  summary: string; // original editorial summary — never copied
  tags: string[];
}

export interface Vehicle extends Entity {
  kind: "vehicle";
  manufacturer: string;
  vclass: string; // Sports, SUV, Muscle, ...
  isNewModel: boolean; // new to the series (reported)
  ultimateEditionExclusive?: boolean;
}

export interface GameLocation extends Entity {
  kind: "location";
  region: string; // parent region, e.g. "Vice City"
  realWorldInspiration?: string;
}

export interface Weapon extends Entity {
  kind: "weapon";
  wclass: string; // Handguns, Shotguns, SMGs, ...
  ultimateEditionExclusive?: boolean;
}

export interface Character extends Entity {
  kind: "character";
  role: string; // Protagonist, Supporting
  affiliation?: string; // crew/org, when publicly reported
}

export const EVIDENCE_META: Record<
  EvidenceStatus,
  { label: string; className: string; blurb: string }
> = {
  "rockstar-confirmed": {
    label: "Rockstar-confirmed",
    className: "badge-confirmed",
    blurb: "Officially confirmed by Rockstar Games.",
  },
  "trailer-confirmed": {
    label: "Trailer-confirmed",
    className: "badge-trailer",
    blurb: "Clearly visible in an official trailer or promo — publicly reported, not yet detailed by Rockstar.",
  },
  "leak-reported": {
    label: "Leak-reported",
    className: "badge-likely",
    blurb: "Spotted in leaked footage. Unverified — treat as rumor until launch.",
  },
  disputed: {
    label: "Disputed leak",
    className: "badge-disputed",
    blurb: "Comes from a leak whose authenticity has been questioned. Included for transparency, not as fact.",
  },
};

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
