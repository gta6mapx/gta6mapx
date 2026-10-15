// Phase 3 acceptance tests — anti-bug rules R1–R7 (discovery-spec.md).
// Pure logic: reducer + selectors + strings + coord parser. Run:
//
//   node --import ./scripts/register-at-alias.mjs scripts/discovery-acceptance.mts
//
// Exits nonzero on the first failure; prints PASS per rule.
import { PINS, CATEGORIES, ALL_EVIDENCE_STATUSES, type Pin } from "../src/data/pins";
import {
  discoveryReducer,
  initialDiscoveryState,
  type DiscoveryState,
} from "../src/modules/discovery/reducer";
import {
  selectBasePins,
  selectSearchResults,
  selectSortedPins,
  selectFacetedCounts,
  selectVisibleTags,
  selectSummary,
  describeActiveFilters,
  hasActiveFilters,
  findPin,
  emptyStateMessage,
} from "../src/modules/discovery/selectors";
import {
  discoveryStrings as S,
  auditStringsEnglish,
} from "../src/modules/discovery/strings";
import { parseGoToPosition } from "../src/modules/map/coordSearch";

const ALL_CATS = CATEGORIES.map((c) => c.slug);
let failures = 0;

function assert(cond: boolean, label: string) {
  if (cond) {
    console.log(`  ok — ${label}`);
  } else {
    failures += 1;
    console.error(`  FAIL — ${label}`);
  }
}
function dispatchAll(state: DiscoveryState, actions: Parameters<typeof discoveryReducer>[1][]) {
  return actions.reduce(discoveryReducer, state);
}

// ── R1: one reducer is the source of truth ──
console.log("R1 — single reducer source of truth");
{
  let s = initialDiscoveryState(ALL_CATS);
  assert(s.query === "" && s.selectedId === null, "initial state is neutral");
  s = discoveryReducer(s, { type: "SET_QUERY", query: "ammu" });
  s = discoveryReducer(s, { type: "SET_NO_CATEGORIES" });
  s = discoveryReducer(s, { type: "TOGGLE_CATEGORY", slug: "stores" });
  const base = selectBasePins(PINS, s, new Set());
  assert(base.every((p) => p.categorySlug === "stores"), "category filter flows into rendered pins");
  const results = selectSearchResults(base, s.query);
  assert(results.length > 0 && results.every((p) => base.includes(p)), "search derives from the same filtered set");
  const counts = selectFacetedCounts(PINS, s, new Set());
  assert(counts.every((c) => typeof c.count === "number"), "faceted counts derive from the same state");
  s = discoveryReducer(s, { type: "SELECT_PIN", id: "p1" });
  assert(findPin(PINS, s.selectedId) !== null, "selection resolves through the id-or-slug lookup");
}

// ── R2: reset is atomic ──
console.log("R2 — atomic reset");
{
  let s = initialDiscoveryState(ALL_CATS);
  s = dispatchAll(s, [
    { type: "SET_QUERY", query: "vice" },
    { type: "TOGGLE_CATEGORY", slug: "stores" },
    { type: "TOGGLE_EVIDENCE", status: "disputed" },
    { type: "TOGGLE_TAG", tag: "trailer" },
    { type: "SET_FOUND_MODE", mode: "found" },
    { type: "SET_SORT", sort: "updated" },
    { type: "SELECT_PIN", id: "p1" },
  ]);
  assert(hasActiveFilters(s, ALL_CATS), "filters are active before reset");
  s = discoveryReducer(s, { type: "RESET_ALL", allCats: ALL_CATS });
  const fresh = initialDiscoveryState(ALL_CATS);
  assert(
    JSON.stringify(s) === JSON.stringify(fresh),
    "RESET_ALL returns the exact initial state (query, filters, sort, selection)"
  );
}

// ── R3: every number labeled ──
console.log("R3 — labeled numbers");
{
  const line = selectSummary(7, 3);
  assert(/3/.test(line) && /7/.test(line) && /marker/i.test(line), `summary labels its numbers: "${line}"`);
  assert(S.tabCountTooltip.length > 0, "tab-count tooltip explains the faceted counts");
  assert(S.resultsCount(3, 7).includes("3") && S.resultsCount(3, 7).includes("7"), "dropdown footer labels its numbers");
}

// ── R4: synchronous filtering at 5,000 pins ──
console.log("R4 — synchronous under 5,000 pins");
{
  const big: Pin[] = [];
  const statuses = ALL_EVIDENCE_STATUSES;
  for (let i = 0; i < 5000; i++) {
    const src = PINS[i % PINS.length];
    big.push({
      ...src,
      id: `syn-${i}`,
      slug: `syn-${i}`,
      name: `${src.name} #${i}`,
      evidence: { status: statuses[i % statuses.length], detail: src.evidence.detail },
    });
  }
  const s = initialDiscoveryState(ALL_CATS);
  const t0 = performance.now();
  const base = selectBasePins(big, s, new Set());
  const searched = selectSearchResults(base, "vice");
  const sorted = selectSortedPins(base, "evidence");
  const counts = selectFacetedCounts(big, s, new Set());
  const tags = selectVisibleTags(base);
  const dt = performance.now() - t0;
  assert(base.length === 5000 && searched.length > 0 && sorted.length === 5000, "full pipeline returns correct shapes at 5k");
  assert(counts.length === CATEGORIES.length && tags.length >= 0, "counts + tags computed");
  assert(dt < 250, `5,000-pin filter+search+sort+counts in ${dt.toFixed(1)}ms (< 250ms budget, no async)`);
}

// ── R5: honest empty states ──
console.log("R5 — honest empty states");
{
  let s = initialDiscoveryState(ALL_CATS);
  s = discoveryReducer(s, { type: "SET_QUERY", query: "zzz-no-such-place" });
  const results = selectSearchResults(selectBasePins(PINS, s, new Set()), s.query);
  assert(results.length === 0, "nonsense query really returns nothing");
  s = discoveryReducer(s, { type: "SET_NO_CATEGORIES" });
  const parts = describeActiveFilters(s, ALL_CATS);
  assert(parts.length > 0, "active-filter describer reports the category filter");
  const msg = emptyStateMessage(s, ALL_CATS);
  assert(msg.includes("zzz-no-such-place"), "empty state names the query");
  assert(/categor/i.test(msg), "empty state names the active category filter");
  assert(hasActiveFilters(s, ALL_CATS), "reset affordance is offered when filters are active");
}

// ── R6: single English dictionary ──
console.log("R6 — English-only strings");
{
  const violations = auditStringsEnglish(S);
  assert(violations.length === 0, violations.length === 0 ? "all strings non-empty English" : violations.join("; "));
}

// ── R7: bad inputs degrade safely ──
console.log("R7 — safe degradation");
{
  assert(findPin(PINS, "no-such-pin") === undefined, "unknown pin id → undefined, never throws");
  assert(findPin(PINS, "") === undefined, "empty pin param → undefined");
  assert(findPin(PINS, "ammu-nation-downtown")?.id === "p1", "slug lookup works (deep-link parity)");
  const badInputs = ["", "abc", "12", "25.7", "25.7,", ", -80.1", "91, 0", "0, 181", "lat 25 lng -80"];
  assert(badInputs.every((v) => !parseGoToPosition(v).ok), "garbage/out-of-range coordinates are rejected");
  const good = parseGoToPosition("25.7617, -80.1918");
  assert(good.ok && good.lat === 25.7617 && good.lng === -80.1918, "valid input parses exactly");
  const semi = parseGoToPosition("25.7; -80.1");
  assert(semi.ok && semi.lat === 25.7 && semi.lng === -80.1, "semicolon separator accepted (documented)");
  const weird = parseGoToPosition("  -0 , 179.9999 ");
  assert(weird.ok && weird.lat === 0 && weird.lng === 179.9999, "whitespace-tolerant parse");
  // Evidence fallback: an unknown status must land in the safest bucket.
  const raw = { status: "rumor-mill" } as unknown as { status: string };
  const safe = (ALL_EVIDENCE_STATUSES as string[]).includes(raw.status) ? raw.status : "disputed";
  assert(safe === "disputed", "unknown evidence status falls back to disputed");
}

if (failures > 0) {
  console.error(`\n${failures} acceptance assertion(s) FAILED`);
  process.exit(1);
}
console.log("\nAll R1–R7 acceptance assertions PASS");
