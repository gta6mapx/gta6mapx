// Settings + countdown acceptance tests (engagement spec §3.2, §4).
// Run:
//
//   node --import ./scripts/register-at-alias.mjs scripts/settings-acceptance.mts
//
// Exits nonzero on the first failure; prints PASS per section.

import {
  getSettings,
  setSettings,
  resetSettings,
  flushSettings,
  resetSettingsForTests,
  hasStorageWarning,
  DEFAULT_SETTINGS,
  SETTINGS_KEY,
} from "../src/modules/engagement/settings/store";
import {
  loadSettings,
  saveSettings,
} from "../src/modules/map/settings";
import {
  LAUNCH_DATE_ISO,
  LAUNCH_DATE_MS,
  getCountdownParts,
  describeCountdown,
} from "../src/modules/engagement/countdown/launchDate";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

let failures = 0;
function assert(cond: boolean, label: string) {
  if (cond) {
    console.log(`  ok — ${label}`);
  } else {
    failures += 1;
    console.error(`  FAIL — ${label}`);
  }
}
function section(name: string) {
  console.log(`\n[ ${name} ]`);
}

// ─── Fake browser storage (set before any store call re-initializes) ────

const mem = new Map<string, string>();
(globalThis as unknown as { window: unknown }).window = {
  localStorage: {
    getItem: (k: string) => (mem.has(k) ? mem.get(k)! : null),
    setItem: (k: string, v: string) => {
      mem.set(k, String(v));
    },
    removeItem: (k: string) => {
      mem.delete(k);
    },
  },
  addEventListener: () => {},
  removeEventListener: () => {},
};

function reseed() {
  mem.clear();
  resetSettingsForTests();
}

const LEGACY_KEY = "gta6mapx:map-settings";
const LEGEND_KEY = "gta6mapx:legend-collapsed";

function deepEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

// ─── 1. corrupt JSON → defaults ──────────────────────────────────────────
section("corrupt JSON falls back to full defaults");
reseed();
mem.set(SETTINGS_KEY, "{ this is not json");
resetSettingsForTests();
assert(deepEqual(getSettings(), DEFAULT_SETTINGS), "corrupt payload → defaults");

// ─── 2. unknown version → defaults ───────────────────────────────────────
section("unknown schema version falls back to full defaults");
reseed();
mem.set(
  SETTINGS_KEY,
  JSON.stringify({ version: 99, theme: "sunset-boulevard", accent: "lime" })
);
resetSettingsForTests();
assert(deepEqual(getSettings(), DEFAULT_SETTINGS), "version 99 → defaults");
reseed();
mem.set(SETTINGS_KEY, JSON.stringify({ theme: "sunset-boulevard" }));
resetSettingsForTests();
assert(deepEqual(getSettings(), DEFAULT_SETTINGS), "missing version → defaults");

// ─── 3. field whitelist validation ───────────────────────────────────────
section("field whitelist validation");
reseed();
mem.set(
  SETTINGS_KEY,
  JSON.stringify({
    version: 1,
    theme: "hacker",
    accent: "electric-cyan",
    units: "km",
    panelStyle: "hud",
    clustering: "yes",
    grid: false,
    buildings3d: true,
    fovHud: false,
    language: "de",
    bogusField: 123,
    map: { sort: "nonsense", heatmap: true },
  })
);
resetSettingsForTests();
const w = getSettings();
assert(w.theme === "neon-mirage", "bad theme → default (valid fields kept)");
assert(w.accent === "electric-cyan", "valid accent kept");
assert(w.clustering === true, "non-boolean clustering → default");
assert(w.language === "en", "language forced to en");
assert(!("bogusField" in w), "unknown top-level field dropped");
assert(w.map.sort === "name", "bad map.sort → default");
assert(w.map.heatmap === true, "valid map.heatmap kept");

// ─── 4. migration from legacy keys ───────────────────────────────────────
section("migration from legacy gta6mapx:map-settings");
reseed();
mem.set(
  LEGACY_KEY,
  JSON.stringify({
    v: 1,
    mode3d: false,
    units: "imperial",
    theme: "midnight",
    clustering: false,
    baseLayer: "real-florida",
    densityVisible: false,
    grid: { visible: true },
    fovHud: { visible: true },
    sort: "evidence",
    clusterColorMode: "category",
    coordHudCollapsed: true,
    frameLegendDismissed: true,
    heatmap: { visible: true },
    markerColors: { a: "#ff0000" },
    pitchMax: 40,
    bearingSnap: false,
  })
);
mem.set(LEGEND_KEY, "1");
resetSettingsForTests();
const m = getSettings();
assert(m.theme === "midnight-outrun", "legacy theme midnight → midnight-outrun");
assert(m.units === "miles", "legacy units imperial → miles");
assert(m.buildings3d === false, "legacy mode3d → buildings3d");
assert(m.clustering === false, "legacy clustering carried over");
assert(m.grid === true, "legacy grid.visible → grid");
assert(m.fovHud === true, "legacy fovHud.visible → fovHud");
assert(m.map.baseLayer === "real-florida", "legacy baseLayer → map.baseLayer");
assert(m.map.densityVisible === false, "legacy densityVisible → map");
assert(m.map.sort === "evidence", "legacy sort → map.sort");
assert(m.map.clusterColorMode === "category", "legacy clusterColorMode → map");
assert(m.map.coordHudCollapsed === true, "legacy coordHudCollapsed → map");
assert(m.map.frameLegendDismissed === true, "legacy frameLegendDismissed → map");
assert(m.map.heatmap === true, "legacy heatmap.visible → map.heatmap");
assert(m.map.markerColors.a === "#FF0000", "legacy markerColors normalized");
assert(m.map.pitchMax === 40, "legacy pitchMax → map");
assert(m.map.bearingSnap === false, "legacy bearingSnap → map");
assert(m.map.legendCollapsed === true, "legacy legend-collapsed → map.legendCollapsed");
assert(!mem.has(LEGACY_KEY), "legacy settings key deleted after migration");
assert(!mem.has(LEGEND_KEY), "legacy legend key deleted after migration");

// legacy vice → neon-mirage, neon → sunset-boulevard
reseed();
mem.set(LEGACY_KEY, JSON.stringify({ v: 1, theme: "vice" }));
resetSettingsForTests();
assert(getSettings().theme === "neon-mirage", "legacy theme vice → neon-mirage");
reseed();
mem.set(LEGACY_KEY, JSON.stringify({ v: 1, theme: "neon" }));
resetSettingsForTests();
assert(getSettings().theme === "sunset-boulevard", "legacy theme neon → sunset-boulevard");

// ─── 5. reset to defaults ────────────────────────────────────────────────
section("reset to defaults");
reseed();
setSettings({ theme: "sunset-boulevard", accent: "lime" });
flushSettings();
assert(getSettings().theme === "sunset-boulevard", "change applied");
assert(mem.has(SETTINGS_KEY), "change persisted to storage");
resetSettings();
assert(deepEqual(getSettings(), DEFAULT_SETTINGS), "reset → full defaults");
assert(!mem.has(SETTINGS_KEY), "reset clears the settings key");

// ─── 6. legacy map/settings adapter round-trip ───────────────────────────
section("modules/map/settings adapter round-trips through the unified store");
reseed();
saveSettings({
  theme: "midnight",
  units: "imperial",
  mode3d: false,
  grid: { visible: true },
  clusterColorMode: "category",
});
flushSettings();
const u = getSettings();
assert(u.theme === "midnight-outrun", "adapter theme midnight → midnight-outrun");
assert(u.units === "miles", "adapter units imperial → miles");
assert(u.buildings3d === false, "adapter mode3d → buildings3d");
assert(u.grid === true, "adapter grid.visible → grid");
assert(u.map.clusterColorMode === "category", "adapter clusterColorMode → map");
const back = loadSettings();
assert(back.v === 1, "adapter read keeps v: 1");
assert(back.theme === "midnight", "adapter read maps theme back to legacy id");
assert(back.units === "imperial", "adapter read maps units back");
assert(back.mode3d === false, "adapter read maps buildings3d back");
assert(back.grid.visible === true, "adapter read maps grid back");
saveSettings({ theme: "bogus" as never });
assert(getSettings().theme === "midnight-outrun", "adapter drops invalid theme");

// ─── 7. countdown math ───────────────────────────────────────────────────
section("countdown math (launchDate)");
assert(LAUNCH_DATE_ISO === "2026-11-19", "LAUNCH_DATE_ISO = 2026-11-19");
assert(
  LAUNCH_DATE_MS === Date.parse("2026-11-19T00:00:00Z"),
  "launch instant is UTC midnight"
);
{
  const pre = getCountdownParts(
    LAUNCH_DATE_MS - (2 * 86400 + 3 * 3600 + 4 * 60 + 5) * 1000
  );
  assert(
    !pre.outNow &&
      pre.days === 2 &&
      pre.hours === 3 &&
      pre.minutes === 4 &&
      pre.seconds === 5,
    "pre-launch parts: 2d 3h 4m 5s"
  );
}
{
  const edge = getCountdownParts(LAUNCH_DATE_MS - 1);
  assert(!edge.outNow, "1ms before launch → not outNow");
}
{
  const at = getCountdownParts(LAUNCH_DATE_MS);
  assert(
    at.outNow && at.days === 0 && at.hours === 0 && at.minutes === 0 && at.seconds === 0,
    "launch boundary → OUT NOW, zeroed parts"
  );
}
{
  const post = getCountdownParts(LAUNCH_DATE_MS + 999_999_999);
  assert(
    post.outNow &&
      post.days === 0 &&
      post.hours === 0 &&
      post.minutes === 0 &&
      post.seconds === 0,
    "post-launch → OUT NOW, no negative numbers"
  );
  assert(
    post.days >= 0 && post.hours >= 0 && post.minutes >= 0 && post.seconds >= 0,
    "parts never negative"
  );
}
{
  const desc = describeCountdown(LAUNCH_DATE_MS - 90_000);
  assert(
    desc.includes("until the GTA VI launch"),
    "pre-launch live-region sentence"
  );
  assert(
    describeCountdown(LAUNCH_DATE_MS + 1000) === "GTA VI is out now.",
    "post-launch live-region sentence"
  );
}

// ─── 8. English-only regression on new UI strings ────────────────────────
section("English-only regression (no mixed-language labels in new UI)");
{
  const here = dirname(fileURLToPath(import.meta.url));
  const files = [
    "../src/modules/engagement/settings/SettingsPanel.tsx",
    "../src/modules/engagement/countdown/Countdown.tsx",
    "../src/modules/engagement/credits/AboutModal.tsx",
  ].map((f) => readFileSync(join(here, f), "utf8").toLowerCase());
  // Known leak tokens from the competitor analysis (spec §0).
  const leaked = ["einstellungen", "koordinatensuche", "schließen", "abbrechen", "zur position"];
  for (const token of leaked) {
    assert(
      !files.some((src) => src.includes(token)),
      `no "${token}" in new UI strings`
    );
  }
  assert(
    !files.some((src) => />language</.test(src) || /select language/.test(src)),
    "no visible language selector label rendered"
  );
}

// ─── 9. storage unavailable → in-memory + one-time notice ───────────────
section("storage unavailable degrades silently (in-memory + one-time notice)");
{
  const throwing = {
    getItem: () => {
      throw new Error("denied");
    },
    setItem: () => {
      throw new Error("denied");
    },
    removeItem: () => {
      throw new Error("denied");
    },
  };
  (globalThis as unknown as { window: unknown }).window = {
    localStorage: throwing,
    addEventListener: () => {},
    removeEventListener: () => {},
  };
  resetSettingsForTests();
  let threw = false;
  try {
    setSettings({ theme: "sunset-boulevard", accent: "lime" });
    flushSettings();
  } catch {
    threw = true;
  }
  const s = getSettings();
  assert(!threw, "no throw when storage is blocked");
  assert(
    s.theme === "sunset-boulevard" && s.accent === "lime",
    "settings still work in-memory for the session"
  );
  assert(hasStorageWarning() === true, "one-time storage warning fired");
  // Restore the working fake storage for any later use.
  (globalThis as unknown as { window: unknown }).window = {
    localStorage: {
      getItem: (k: string) => (mem.has(k) ? mem.get(k)! : null),
      setItem: (k: string, v: string) => {
        mem.set(k, String(v));
      },
      removeItem: (k: string) => {
        mem.delete(k);
      },
    },
    addEventListener: () => {},
    removeEventListener: () => {},
  };
}

if (failures > 0) {
  console.error(`\n${failures} FAILURE(S)`);
  process.exit(1);
}
console.log("\nAll settings acceptance checks passed.");
