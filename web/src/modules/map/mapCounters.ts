// ─── mapCounters.ts ─────────────────────────────────────────────────────
// The honest-counter model (spec §4.4). The ONLY module that formats counts
// for UI. Rules: denominators never change silently; "shown" means named
// pins passing filters; the density line is a separate concept and never
// folds into named counts; while loading, counters show "…" — never "0"
// (0 would be a lie).

export interface CounterInputs {
  totalNamed: number;
  shownNamed: number;
  densityTotal: number;
  densityVisible: boolean;
  foundCount: number;
  loading: boolean;
}

export interface CounterView {
  filterBar: string;
  densityLine: string;
  progressLine: string;
}

export function computeCounters(i: CounterInputs): CounterView {
  const filterBar = i.loading
    ? "…"
    : `${i.shownNamed} of ${i.totalNamed} locations shown${
        i.totalNamed - i.shownNamed > 0 ? ` — ${i.totalNamed - i.shownNamed} filtered out` : ""
      }`;

  const densityLine = i.loading ? "…" : `+${i.densityTotal} community pins`;

  const progressLine = i.loading ? "…" : `${i.foundCount} of ${i.totalNamed} found`;

  return { filterBar, densityLine, progressLine };
}
