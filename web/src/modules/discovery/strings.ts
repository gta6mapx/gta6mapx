// ─── modules/discovery/strings.ts ──────────────────────────────────────────
// R6 — ONE language. Every discovery UI string lives here, in English.
// No mixed-language fallbacks, no untranslated keys leaking through.
// Components must import copy from this file, never hardcode discovery
// strings inline.

export const discoveryStrings = {
  searchPlaceholder: "Search locations…",
  searchLabel: "Search map locations",
  clearSearch: "Clear search",
  searchResultsLabel: "Search results",
  resultsCount: (shown: number, total: number) =>
    `Showing ${shown} of ${total} markers`,
  tabCountTooltip: "Matches your other filters",
  filterFootnote:
    "Filters combine: any option within a group, all groups together.",
  evidenceFilterLabel: "Evidence",
  categoryFilterLabel: "Filter by category",
  tagFilterLabel: "Tags",
  tagFilterCollapsed: (n: number) => `Tags (${n})`,
  foundFilterLabel: "Progress",
  foundAll: "All",
  foundOnly: "Found",
  foundNotYet: "Not found",
  sortLabel: "Sort",
  sortName: "Name A–Z",
  sortEvidence: "Strongest evidence first",
  sortUpdated: "Recently updated",
  sortRegion: "By region",
  resetAll: "Reset all",
  all: "All",
  none: "None",
  clearSearchAndFilters: "Clear search & filters",
  noResults: (query: string) => `No locations match "${query}".`,
  noResultsWithFilters: (query: string, filters: string) =>
    `No locations match "${query}" with ${filters}.`,
  noResultsNoQuery: (filters: string) => `No locations match ${filters}.`,
  goToPosition: "Go to position",
  goToPositionTitle: "Jump to coordinates",
  goToPositionPlaceholder: "25.7617, -80.1918",
  goToPositionHint: "Latitude, longitude in the current map frame.",
  goToPositionErrorRange:
    "Out of range — latitude −90…90, longitude −180…180.",
  goToPositionErrorFormat: "Enter coordinates as “lat, lng”, e.g. 25.7617, -80.1918.",
  goToPositionGo: "Go",
  cancel: "Cancel",
  openFullIntel: "Open full intel →",
  intelUpdated: (date: string) => `Intel updated ${date}`,
  progressSavedNote: "Progress saves on this device — no account needed.",
  disputedCaution:
    "Caution: this comes from a questioned source. Included for transparency — not as fact.",
  availabilityNote: (label: string) => `Reported ${label}`,
  shareView: "Share this view",
  sharePin: "Share this pin",
  linkCopied: "Link copied",
  coordsCopied: "Coordinates copied",
  copyCoords: "Copy",
  copied: "Copied",
  pinNotOnMap: "That location isn't on the map yet.",
  clusterModeLabel: "Cluster color",
  clusterModeEvidence: "Evidence",
  clusterModeCategory: "Category",
  densityLabel: "Community pins",
  densityNote: "positions approximate",
  selectPinHint:
    "Select a pin to open its case file — evidence chain, coordinates and source.",
} as const;

export type DiscoveryStrings = typeof discoveryStrings;

/**
 * R6 acceptance helper: every entry is a non-empty string or a function
 * returning one. The acceptance test also scans for leaked non-English
 * tokens (the competitor shipped German labels inside English mode).
 */
const NON_ENGLISH_TOKENS = [
  "koordinaten",
  "zur position",
  "anwenden",
  "suchen",
  "schließen",
];

export function auditStringsEnglish(strings: DiscoveryStrings): string[] {
  const violations: string[] = [];
  const check = (value: string, key: string) => {
    if (typeof value !== "string" || value.trim().length === 0) {
      violations.push(`${key}: empty or not a string`);
      return;
    }
    const lower = value.toLowerCase();
    for (const token of NON_ENGLISH_TOKENS) {
      if (lower.includes(token)) violations.push(`${key}: contains "${token}"`);
    }
  };
  for (const [key, value] of Object.entries(strings)) {
    if (typeof value === "function") {
      // Probe template functions with representative args.
      try {
        const probed = (value as (...a: never[]) => string)(
          ...(["x", "y"].slice(0, value.length) as never[])
        );
        check(probed, key);
      } catch {
        violations.push(`${key}: template function threw on probe args`);
      }
    } else {
      check(value, key);
    }
  }
  return violations;
}
