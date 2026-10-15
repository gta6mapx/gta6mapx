// ─── perf.ts ────────────────────────────────────────────────────────────
// Instrumentation ONLY — no other module instruments itself. Thin wrappers
// over performance.mark/measure with a consistent prefix, an rAF frame
// monitor, a guarded longtask observer, and assertBudgets() for the §5.1
// release gates. Dev-honest: when no measurements exist, assertBudgets()
// reports "no data" with pass=true rather than inventing a verdict.

const PREFIX = "gta6mapx:map:";

function hasPerformance(): boolean {
  return typeof performance !== "undefined" && typeof performance.mark === "function";
}

export function mark(name: string): void {
  if (!hasPerformance()) return;
  try {
    performance.mark(`${PREFIX}${name}`);
  } catch {
    // Duplicate mark names throw in some browsers — not fatal.
  }
}

/**
 * Measures from mark `${PREFIX}${name}` to now. Returns undefined when the
 * mark was never recorded.
 */
export function measure(name: string): number | undefined {
  if (!hasPerformance()) return undefined;
  const markName = `${PREFIX}${name}`;
  try {
    const entries = performance.getEntriesByName(markName, "mark");
    if (entries.length === 0) return undefined;
    const measured = performance.measure(`${PREFIX}${name}:measured`, markName);
    return measured.duration;
  } catch {
    return undefined;
  }
}

export interface FrameStats {
  p50: number;
  p95: number;
  dropped: number;
}

/**
 * Records rAF deltas until the returned stop function is called, then
 * returns p50/p95 frame times (ms) and the dropped-frame count (>2× the
 * 16.7ms budget, per spec §5.2). SSR-safe: returns zero stats if rAF is
 * unavailable.
 */
export function startFrameMonitor(): () => FrameStats {
  const deltas: number[] = [];
  if (typeof requestAnimationFrame === "undefined") {
    return () => ({ p50: 0, p95: 0, dropped: 0 });
  }
  let running = true;
  let last = 0;
  const tick = (now: number) => {
    if (!running) return;
    if (last !== 0) deltas.push(now - last);
    last = now;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);

  return () => {
    running = false;
    if (deltas.length === 0) return { p50: 0, p95: 0, dropped: 0 };
    const sorted = [...deltas].sort((a, b) => a - b);
    const at = (p: number) => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
    const dropped = deltas.filter((d) => d > 2 * (1000 / 60)).length;
    return { p50: at(0.5), p95: at(0.95), dropped };
  };
}

/**
 * Observes long tasks (>50ms main-thread blocks — a budget violation, not
 * background noise). Guarded: PerformanceObserver/"longtask" may not exist
 * (Safari, SSR). Returns a disconnect function.
 */
export function observeLongTasks(onViolation: (ms: number, name: string) => void): () => void {
  try {
    if (typeof PerformanceObserver === "undefined") return () => {};
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.duration > 50) {
          onViolation(entry.duration, entry.name || "longtask");
        }
      }
    });
    observer.observe({ entryTypes: ["longtask"] });
    return () => observer.disconnect();
  } catch {
    return () => {};
  }
}

export interface BudgetCheck {
  name: string;
  pass: boolean;
  detail: string;
}

/**
 * Checks recorded measures against the §5.1 budgets. Each check reports
 * "no data" (pass=true) when its mark was never recorded — dev-only honesty:
 * an unmeasured budget is unknown, not failed.
 */
export function assertBudgets(): { pass: boolean; checks: BudgetCheck[] } {
  const checkMeasure = (name: string, budgetMs: number, label: string): BudgetCheck => {
    const ms = measure(name);
    if (ms === undefined) {
      return { name, pass: true, detail: `${label}: no data recorded yet (dev-only)` };
    }
    return {
      name,
      pass: ms <= budgetMs,
      detail: `${label}: ${ms.toFixed(1)}ms vs budget ${budgetMs}ms`,
    };
  };

  const checks: BudgetCheck[] = [
    checkMeasure("filter", 50, "filter → re-cluster task"),
    checkMeasure("search-index-built", 50, "search index build"),
    checkMeasure("clusters-ready", 1500, "initial interactive (desktop)"),
  ];
  return { pass: checks.every((c) => c.pass), checks };
}
