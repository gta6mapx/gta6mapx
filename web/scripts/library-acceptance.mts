// web/scripts/library-acceptance.mts
// Acceptance tests for the Intel Library logic layer:
//   src/modules/engagement/library/{library,filtering,urlState}.ts
// Run: node scripts/library-acceptance.mts
// (Node >= 22: native type stripping + ./ts-resolve-hooks.mjs for
// extensionless TS imports and JSON imports.)

import { register } from "node:module";
import assert from "node:assert/strict";

register("./ts-resolve-hooks.mjs", import.meta.url);

const library = await import(
  "../src/modules/engagement/library/library"
);
const filtering = await import(
  "../src/modules/engagement/library/filtering"
);
const urlState = await import(
  "../src/modules/engagement/library/urlState"
);
const vehicles = await import("../src/modules/entities/data/vehicles");
const locations = await import("../src/modules/entities/data/locations");
const weapons = await import("../src/modules/entities/data/weapons");
const characters = await import("../src/modules/entities/data/characters");

const {
  buildDossierIndex,
  buildFacets,
  EVIDENCE_ORDER,
  KIND_ORDER,
} = library;
const {
  countByKind,
  EMPTY_FACETS,
  filterDossiers,
  searchDossiers,
  sortHits,
} = filtering;
const {
  defaultLibraryState,
  facetsForKind,
  libraryStateToParams,
  parseLibraryParams,
} = urlState;

let passed = 0;
let failed = 0;

function check(name: string, fn: () => void): void {
  try {
    fn();
    passed += 1;
    console.log(`  PASS  ${name}`);
  } catch (e) {
    failed += 1;
    console.log(`  FAIL  ${name}`);
    console.log(`        ${e instanceof Error ? e.message : String(e)}`);
  }
}

const dossiers = buildDossierIndex();
const facets = buildFacets();
const total = dossiers.length;
const hits = searchDossiers(dossiers, "");

console.log(`Intel Library acceptance — ${total} dossiers indexed\n`);

check("index covers every entity dataset", () => {
  const expected =
    vehicles.VEHICLES.length +
    locations.LOCATIONS.length +
    weapons.WEAPONS.length +
    characters.CHARACTERS.length;
  assert.equal(total, expected, `index=${total} datasets=${expected}`);
  console.log(
    `        vehicles=${vehicles.VEHICLES.length} locations=${locations.LOCATIONS.length} weapons=${weapons.WEAPONS.length} characters=${characters.CHARACTERS.length}`
  );
});

check("tab counts sum to total", () => {
  const counts = countByKind(hits);
  const sum =
    counts.vehicle + counts.location + counts.weapon + counts.character;
  assert.equal(sum, total, `sum=${sum} total=${total}`);
  assert.equal(counts.vehicle, vehicles.VEHICLES.length);
  assert.equal(counts.location, locations.LOCATIONS.length);
  assert.equal(counts.weapon, weapons.WEAPONS.length);
  assert.equal(counts.character, characters.CHARACTERS.length);
});

check("every dossier has href, microline, summary, tags", () => {
  const hrefRe = /^\/(vehicles|locations|weapons|characters)\/[a-z0-9-]+$/;
  for (const d of dossiers) {
    assert.match(d.href, hrefRe, `bad href: ${d.href}`);
    assert.ok(d.microline.length > 0, `empty microline: ${d.name}`);
    assert.ok(d.summary.length > 0, `empty summary: ${d.name}`);
    assert.ok(d.tags.length > 0, `no tags: ${d.name}`);
  }
});

check("search matches names (substring, case-insensitive)", () => {
  const res = searchDossiers(dossiers, "GrAnGeR");
  assert.ok(res.length >= 1, "expected >= 1 hit for 'granger'");
  assert.ok(
    res.every((h) => h.matchedName || h.matchedTags.length > 0),
    "every hit must flag what matched"
  );
  const names = res.map((h) => h.dossier.name);
  assert.ok(
    names.some((n) => n.includes("Granger")),
    `expected a Granger hit, got: ${names.join(", ")}`
  );
});

check("search matches tags", () => {
  const res = searchDossiers(dossiers, "suv");
  assert.ok(res.length >= 1, "expected >= 1 hit for tag 'suv'");
  assert.ok(
    res.every((h) => h.matchedTags.includes("suv")),
    "every hit must carry the matched tag"
  );
});

check("search is diacritic-insensitive", () => {
  const plain = searchDossiers(dossiers, "ubermacht").map(
    (h) => h.dossier.slug
  );
  const upper = searchDossiers(dossiers, "UBERMACHT").map(
    (h) => h.dossier.slug
  );
  assert.deepEqual(plain, upper, "case must not change results");
  assert.ok(
    plain.some((s) => s.includes("sentinel")),
    `expected the Übermacht Sentinel hit, got: ${plain.join(", ")}`
  );
});

check("evidence filter includes/excludes correctly", () => {
  const all = { evidence: [...EVIDENCE_ORDER], facets: { ...EMPTY_FACETS } };
  const disputedOnly = filterDossiers(
    hits,
    { evidence: ["disputed"], facets: { ...EMPTY_FACETS } },
    "all"
  );
  assert.ok(disputedOnly.length >= 1, "expected >= 1 disputed dossier");
  assert.ok(
    disputedOnly.every((h) => h.dossier.evidence.status === "disputed"),
    "disputed-only filter leaked other statuses"
  );
  const noDisputed = filterDossiers(
    hits,
    {
      evidence: EVIDENCE_ORDER.filter((s) => s !== "disputed"),
      facets: { ...EMPTY_FACETS },
    },
    "all"
  );
  assert.ok(
    noDisputed.every((h) => h.dossier.evidence.status !== "disputed"),
    "excluded status still present"
  );
  assert.equal(noDisputed.length, total - disputedOnly.length);
  const none = filterDossiers(hits, { evidence: [], facets: { ...EMPTY_FACETS } }, "all");
  assert.equal(none.length, 0, "empty evidence selection must yield 0");
  assert.equal(filterDossiers(hits, all, "all").length, total);
});

check("default sort = evidence strength, name breaks ties", () => {
  const sorted = sortHits(hits, "evidence");
  assert.equal(sorted.length, total);
  const rank = (s: (typeof EVIDENCE_ORDER)[number]) =>
    EVIDENCE_ORDER.indexOf(s);
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1].dossier;
    const cur = sorted[i].dossier;
    const dr = rank(cur.evidence.status) - rank(prev.evidence.status);
    assert.ok(dr >= 0, `evidence order violated at index ${i}`);
    if (dr === 0) {
      assert.ok(
        prev.name.localeCompare(cur.name) <= 0,
        `tie not name-sorted at index ${i}: ${prev.name} vs ${cur.name}`
      );
    }
  }
  assert.equal(
    sorted[0].dossier.evidence.status,
    "rockstar-confirmed",
    "strongest evidence must lead"
  );
});

check("name sorts ascend/descend", () => {
  const asc = sortHits(hits, "name-asc").map((h) => h.dossier.name);
  const desc = sortHits(hits, "name-desc").map((h) => h.dossier.name);
  const sortedAsc = [...asc].sort((a, b) => a.localeCompare(b));
  assert.deepEqual(asc, sortedAsc, "name-asc must be A-Z");
  assert.deepEqual(desc, [...sortedAsc].reverse(), "name-desc must be Z-A");
});

check("URL round-trip: state -> params -> state", () => {
  const state = {
    q: "granger",
    kind: "vehicle" as const,
    evidence: ["rockstar-confirmed", "trailer-confirmed"] as (
      | "rockstar-confirmed"
      | "trailer-confirmed"
      | "leak-reported"
      | "disputed"
    )[],
    facets: {
      region: "",
      manufacturer: "Declasse",
      vclass: "SUV",
      wclass: "",
      role: "",
    },
    sort: "name-asc" as const,
  };
  const params = libraryStateToParams(state);
  const qs = params.toString();
  assert.ok(qs.includes("q=granger"), `q missing: ${qs}`);
  assert.ok(qs.includes("kind=vehicles"), `kind missing: ${qs}`);
  assert.ok(
    qs.includes("evidence=rockstar-confirmed%2Ctrailer-confirmed") ||
      qs.includes("evidence=rockstar-confirmed,trailer-confirmed"),
    `evidence missing: ${qs}`
  );
  const back = parseLibraryParams(new URLSearchParams(qs), facets);
  assert.deepEqual(back, state, "round-trip state mismatch");
});

check("default state serializes to an empty query string", () => {
  assert.equal(libraryStateToParams(defaultLibraryState()).toString(), "");
});

check("invalid params are ignored, never error", () => {
  const bad = parseLibraryParams(
    new URLSearchParams(
      "kind=bogus&evidence=nope,trailer-confirmed&sort=bogus&region=Nowhere&q="
    ),
    facets
  );
  assert.equal(bad.kind, "all");
  assert.deepEqual(bad.evidence, ["trailer-confirmed"]);
  assert.equal(bad.sort, "evidence");
  assert.equal(bad.facets.region, "");
  assert.equal(bad.q, "");
  // every value invalid -> full default
  const worse = parseLibraryParams(
    new URLSearchParams("evidence=nope&kind=nope"),
    facets
  );
  assert.deepEqual(worse.evidence, [...EVIDENCE_ORDER]);
  assert.equal(worse.kind, "all");
});

check("empty-state conditions produce zero results", () => {
  const noHits = searchDossiers(dossiers, "zzz-no-such-thing-xyz");
  assert.equal(noHits.length, 0, "gibberish query must match nothing");
  const crossKind = filterDossiers(
    hits,
    {
      evidence: [...EVIDENCE_ORDER],
      facets: { ...EMPTY_FACETS, manufacturer: "Declasse" },
    },
    "character"
  );
  assert.equal(crossKind.length, 0, "vehicle facet on characters must be empty");
});

check("facetsForKind drops facets of other kinds", () => {
  const f = facetsForKind(
    {
      region: "Vice City",
      manufacturer: "Declasse",
      vclass: "SUV",
      wclass: "Handguns",
      role: "Protagonist",
    },
    "weapon"
  );
  assert.deepEqual(f, {
    region: "",
    manufacturer: "",
    vclass: "",
    wclass: "Handguns",
    role: "",
  });
  const allKept = facetsForKind(
    { region: "Vice City", manufacturer: "", vclass: "", wclass: "", role: "" },
    "all"
  );
  assert.equal(allKept.region, "Vice City");
});

check("end-to-end: deep link filters to trailer-confirmed vehicle SUVs", () => {
  const state = parseLibraryParams(
    new URLSearchParams(
      "kind=vehicles&q=suv&evidence=trailer-confirmed&sort=evidence"
    ),
    facets
  );
  assert.equal(state.kind, "vehicle", "plural kind value must map to vehicle");
  const res = sortHits(
    filterDossiers(
      searchDossiers(dossiers, state.q),
      { evidence: state.evidence, facets: state.facets },
      state.kind
    ),
    state.sort
  );
  assert.ok(res.length >= 1, "expected >= 1 hit");
  assert.ok(
    res.every(
      (h) =>
        h.dossier.kind === "vehicle" &&
        h.dossier.evidence.status === "trailer-confirmed"
    ),
    "deep-link filters must hold on every result"
  );
});

check("searchParamsEqual ignores order, detects real differences", () => {
  const { searchParamsEqual } = urlState;
  assert.ok(searchParamsEqual("q=a&kind=vehicles", "kind=vehicles&q=a"));
  assert.ok(searchParamsEqual("", ""));
  assert.ok(!searchParamsEqual("q=a", "q=b"));
  assert.ok(!searchParamsEqual("q=a", ""));
  assert.ok(!searchParamsEqual("evidence=", ""));
});

check("facet value lists come from the data", () => {
  assert.ok(facets.regions.includes("Vice City"));
  assert.ok(facets.manufacturers.includes("Übermacht"));
  assert.ok(facets.wclasses.includes("Handguns"));
  assert.ok(facets.roles.includes("Protagonist"));
  for (const k of KIND_ORDER) {
    assert.ok(k.length > 0);
  }
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exitCode = failed > 0 ? 1 : 0;
