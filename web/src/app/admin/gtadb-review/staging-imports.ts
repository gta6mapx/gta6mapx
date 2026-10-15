// Local server-only helper: reads the gtadb STAGING JSONs (never imported by
// public routes — the admin review queue is the only sanctioned consumer).

import locationsJson from "@/modules/entities/data/gtadb/locations.json";
import storesJson from "@/modules/entities/data/gtadb/stores.json";
import othersJson from "@/modules/entities/data/gtadb/others.json";
import type { StagedNamedRecord } from "@/modules/entities/data/gtadb/schema";

const all = [
  ...(locationsJson as StagedNamedRecord[]),
  ...(storesJson as StagedNamedRecord[]),
  ...(othersJson as StagedNamedRecord[]),
];

export default all;
