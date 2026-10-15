// Phase 4 tools acceptance tests (map-tools-spec.md §8).
// Pure logic: draw geometry, measure geodesic+format, overlay affine+registry,
// strings audits. Run:
//
//   node --import ./scripts/register-at-alias.mts scripts/tools-acceptance.mts
//
// Exits nonzero on the first failure; prints PASS per section.

import {
  buildRectPolygon,
  buildCirclePolygon,
  rebuildCircleFromMeta,
  douglasPeucker,
  simplifyStroke,
  distinctVertexCount,
  translateFeature,
  isValidDrawFeature,
  validateImportFeature,
  CIRCLE_SEGMENTS,
  type LngLat,
} from "../src/modules/map/tools/draw/geometry";
import {
  haversineDistance,
  polylineLength,
  sphericalPolygonArea,
  sphericalCentroid,
} from "../src/modules/map/tools/measure/geodesic";
import {
  formatDistance,
  formatArea,
} from "../src/modules/map/tools/measure/format";
import {
  solveAffine,
  applyAffine,
  imageCornersToLngLat,
} from "../src/modules/map/tools/overlays/userImageOverlay";
import { OverlayRegistry } from "../src/modules/map/tools/overlays/overlayRegistry";
import { auditAllToolsStrings } from "../src/modules/map/tools/strings";
import { DEFAULT_DRAW_STYLE } from "../src/modules/map/tools/draw/palette";
import type { ControlPointPair } from "../src/modules/map/tools/overlays/overlayTypes";
import {
  buildShareDoc,
  decodeSharePayload,
  encodeSharePayload,
  isShareDocEmpty,
  b64urlEncode,
  b64urlDecode,
  MAX_SHARED_ITEMS,
} from "../src/modules/map/tools/share/shareCodec";
import {
  clampDividerPct,
  COMPARE_DIVIDER_MAX,
  COMPARE_DIVIDER_MIN,
  COMPARE_STYLE_LABELS,
  DEFAULT_COMPARE_LEFT,
  DEFAULT_COMPARE_RIGHT,
  resolveStylePair,
} from "../src/modules/map/tools/compare/compareState";
import type { DrawFeature } from "../src/modules/map/tools/draw/types";
import type { Measurement } from "../src/modules/map/tools/measure/types";
import type { OverlayEntry } from "../src/modules/map/tools/overlays/overlayTypes";

let failures = 0;
function assert(cond: boolean, label: string) {
  if (cond) {
    console.log(`  ok — ${label}`);
  } else {
    failures += 1;
    console.error(`  FAIL — ${label}`);
  }
}
const approx = (a: number, b: number, tol: number) => Math.abs(a - b) <= tol;

// ── A1: draw geometry ──
console.log("A1 — draw geometry (pure)");
{
  const rect = buildRectPolygon([-80.2, 25.7], [-80.1, 25.8]);
  assert(rect.type === "Polygon", "rect builds a Polygon");
  assert(rect.coordinates[0].length === 5, "rect ring closes (5 positions)");
  const ring = rect.coordinates[0];
  assert(
    ring[0][0] === -80.2 && ring[2][0] === -80.1,
    "rect corners match drag corners"
  );

  const meta = { center: [-80.19, 25.76] as LngLat, radiusMeters: 500 };
  const { polygon: circle } = buildCirclePolygon(meta.center, meta.radiusMeters);
  assert(
    circle.coordinates[0].length === CIRCLE_SEGMENTS + 1,
    `circle is a ${CIRCLE_SEGMENTS}-gon + closure`
  );
  const rebuilt = rebuildCircleFromMeta(meta);
  assert(
    JSON.stringify(rebuilt) === JSON.stringify(circle),
    "circle re-generation from meta is exact"
  );

  // Douglas–Peucker: straight line collapses, zigzag survives.
  const straight: LngLat[] = Array.from({ length: 50 }, (_, i) => [i, 0]);
  assert(douglasPeucker(straight, 0.5).length === 2, "DP collapses a straight line");
  const noisy: LngLat[] = Array.from({ length: 2000 }, (_, i) => [
    -80.19 + i * 0.00001,
    25.76 + (i % 2 === 0 ? 0.0002 : -0.0002),
  ]);
  const simplified = simplifyStroke(noisy, 0.00005);
  assert(simplified.length < noisy.length, "simplify reduces vertex count");

  const feat = {
    id: "x",
    kind: "line",
    geometry: { type: "LineString", coordinates: [[0, 0], [1, 1]] },
    style: { color: "#FF2E88", thickness: 3, opacity: 90, fill: false, fillOpacity: 20 },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  assert(isValidDrawFeature(feat), "valid draw feature passes validation");
  assert(!isValidDrawFeature({ ...feat, id: 5 }), "bad id fails validation");
  const moved = translateFeature(feat as never, 0.5, -0.25);
  const coords = (moved.geometry as GeoJSON.LineString).coordinates;
  assert(coords[0][0] === 0.5 && coords[0][1] === -0.25, "translate shifts all vertices");
  assert(distinctVertexCount([[0, 0], [0, 0], [1, 1]]) === 2, "distinct vertex count dedupes");

  const badImport = {
    type: "Feature",
    geometry: { type: "Point", coordinates: [0, 0] },
    properties: {},
  };
  const verdict = validateImportFeature(badImport, DEFAULT_DRAW_STYLE);
  assert(
    !verdict.ok && verdict.errors.length > 0,
    "import rejects non LineString/Polygon"
  );
}

// ── A2: measure geodesic + formatting ──
console.log("A2 — measure geodesic + format");
{
  // 1° of latitude on the sphere: R * pi/180 = 111195.08 m (independent of the code path).
  const dLat = haversineDistance([0, 0], [0, 1]);
  assert(approx(dLat, 111195.08, 0.5), `haversine 1° latitude: ${dLat.toFixed(2)} m`);
  const d = haversineDistance([-80.1301, 25.7907], [-80.1918, 25.7617]);
  assert(d > 6000 && d < 8000, `haversine Miami sanity: ${d.toFixed(2)} m`);
  assert(
    approx(
      haversineDistance([-80.19, 25.76], [-80.18, 25.76]),
      haversineDistance([-80.18, 25.76], [-80.19, 25.76]),
      1e-9
    ),
    "haversine is symmetric"
  );
  const total = polylineLength([
    [-80.1301, 25.7907],
    [-80.16, 25.775],
    [-80.1918, 25.7617],
  ]);
  assert(total > d, "polyline total exceeds straight-line distance");

  // 0.01°×0.01° square at 25.77° — spherical excess ≈ planar at this scale.
  const sq: LngLat[] = [
    [-80.19, 25.77],
    [-80.18, 25.77],
    [-80.18, 25.78],
    [-80.19, 25.78],
  ];
  const area = sphericalPolygonArea(sq);
  assert(approx(area, 1113420, 5000), `spherical area sanity: ${area.toFixed(0)} m²`);
  const c = sphericalCentroid(sq);
  assert(
    c !== null && approx(c[0], -80.185, 1e-4) && approx(c[1], 25.775, 1e-4),
    "centroid at square center"
  );

  // Spec §3.5 formatting table — exact strings.
  assert(formatDistance(850, "metric") === "850 m", "metric 850 m");
  assert(formatDistance(1240, "metric") === "1.24 km", "metric 1.24 km");
  assert(formatArea(45200, "metric") === "45,200 m²", "metric 45,200 m²");
  assert(formatArea(1240000, "metric") === "1.24 km²", "metric 1.24 km²");
  assert(formatDistance(850, "imperial") === "2,789 ft", "imperial 2,789 ft");
  assert(formatDistance(2000, "imperial") === "1.24 mi", "imperial 1.24 mi");
  assert(formatArea(45200, "imperial") === "486,529 ft²", "imperial ft² exact conversion");
  assert(formatArea(6e6, "imperial") === "2.32 mi²", "imperial mi² exact conversion");
  assert(formatDistance(999, "metric") === "999 m", "boundary 999 m stays meters");
  assert(formatDistance(1000, "metric") === "1.00 km", "boundary 1000 m → km");
}

// ── A3: overlay 3-corner affine ──
console.log("A3 — overlay affine");
{
  // Known affine: scale-x 2, shear 1, scale-y 3, translate (5,7).
  const pairs: [ControlPointPair, ControlPointPair, ControlPointPair] = [
    { map: [5, 7] as LngLat, img: [0, 0] as [number, number] },
    { map: [205, 7] as LngLat, img: [100, 0] as [number, number] },
    { map: [105, 307] as LngLat, img: [0, 100] as [number, number] },
  ];
  const t = solveAffine(pairs);
  assert(approx(t.a, 2, 1e-9) && approx(t.b, 1, 1e-9), "affine a/b recovered");
  assert(approx(t.c, 0, 1e-9) && approx(t.d, 3, 1e-9), "affine c/d recovered");
  assert(approx(t.tx, 5, 1e-9) && approx(t.ty, 7, 1e-9), "affine translation recovered");
  const back = applyAffine(t, 100, 0);
  assert(approx(back[0], 205, 1e-9) && approx(back[1], 7, 1e-9), "applyAffine round-trips");
  const corners = imageCornersToLngLat(pairs, 100, 200);
  assert(corners.length === 4, "4 image-source corners produced");
  assert(approx(corners[0][0], 5, 1e-9) && approx(corners[0][1], 7, 1e-9), "TL corner exact");
  let threw = false;
  try {
    solveAffine([
      { map: [0, 0] as LngLat, img: [0, 0] as [number, number] },
      { map: [1, 0] as LngLat, img: [50, 0] as [number, number] },
      { map: [2, 0] as LngLat, img: [100, 0] as [number, number] },
    ]);
  } catch (e) {
    threw = (e as Error).message === "degenerate-control-points";
  }
  assert(threw, "collinear control points throw degenerate-control-points");
}

// ── A4: overlay registry ──
console.log("A4 — overlay registry");
{
  const reg = new OverlayRegistry();
  const a = reg.register({ id: "a", name: "A", kind: "user-import", meta: null });
  const b = reg.register({ id: "b", name: "B", kind: "user-import", meta: null });
  assert(reg.getEntries().length === 2, "two entries registered");
  const a2 = reg.register({ id: a.id, name: "A renamed", kind: "user-import", meta: null });
  assert(a2.id === a.id && reg.getEntries().length === 2, "re-register updates, never duplicates");
  assert(reg.rename(a.id, "A2") && reg.getEntry(a.id)?.name === "A2", "rename works");
  assert(!reg.rename(a.id, "  "), "empty rename rejected");
  assert(reg.setOpacity(b.id, 250) && reg.getEntry(b.id)?.opacity === 100, "opacity clamps to 100");
  assert(reg.setOpacity(b.id, -5) && reg.getEntry(b.id)?.opacity === 0, "opacity clamps to 0");
  assert(reg.unregister("nope") === false, "unregister unknown → false");
  assert(reg.unregister(a.id) && reg.getEntries().length === 1, "unregister removes");
}

// ── A5: strings audits (English-only, no empties) ──
console.log("A5 — tools strings audit");
{
  const violations = auditAllToolsStrings();
  if (violations.length > 0) {
    for (const v of violations.slice(0, 10)) console.error(`  violation: ${v}`);
  }
  assert(violations.length === 0, `all tools strings audited (${violations.length} violations)`);
}

// ── A6: share-codec + compare-state (Phase 5 gaps) ──
console.log("A6 — share codec + compare state");
{
  // base64url round-trip, including multi-byte content.
  const tricky = "héllo wörld ✓ {\"a\":[1,2]}";
  assert(b64urlDecode(b64urlEncode(tricky)) === tricky, "base64url round-trips unicode");
  assert(!/[+/=]/.test(b64urlEncode(tricky)), "base64url output is URL-safe");

  const drawing: DrawFeature = {
    id: "d1",
    kind: "rect",
    geometry: {
      type: "Polygon",
      coordinates: [[[-80.20001, 25.70001], [-80.10001, 25.70001], [-80.10001, 25.80001], [-80.20001, 25.80001], [-80.20001, 25.70001]]],
    },
    style: { color: "#FF2E88", thickness: 3, opacity: 90, fill: true, fillOpacity: 20 },
    createdAt: "2026-09-24T10:00:00.000Z",
    updatedAt: "2026-09-24T10:00:00.000Z",
  };
  const measurement: Measurement = {
    id: "m1",
    kind: "distance",
    vertices: [[-80.19, 25.76], [-80.18, 25.77]],
    unit: "metric",
    createdAt: "2026-09-24T11:00:00.000Z",
  };
  const userImport: OverlayEntry = {
    id: "user-import-abc123",
    name: "My map",
    kind: "user-import",
    visible: true,
    opacity: 70,
    order: 0,
    meta: {
      controlPoints: [
        { map: [-80.2, 25.7], img: [0, 0] },
        { map: [-80.1, 25.7], img: [1024, 0] },
        { map: [-80.2, 25.8], img: [0, 768] },
      ],
      fileHash: "deadbeef".repeat(8),
      fileName: "scan.png",
      width: 1024,
      height: 768,
    },
  };
  const tileVersion: OverlayEntry = {
    id: "leonida-v1",
    name: "Leonida v1",
    kind: "tile-version",
    visible: false,
    opacity: 55,
    order: 1,
    meta: { tileUrlTemplate: "https://x/{z}/{x}/{y}.png", attribution: "© test" },
  };

  const { doc, truncated } = buildShareDoc([drawing], [measurement], [userImport, tileVersion]);
  assert(truncated === 0, "no truncation under the cap");
  assert(!isShareDocEmpty(doc), "doc with content is not empty");
  assert(isShareDocEmpty({ v: 1, d: [], m: [], o: [] }), "empty doc detected");

  const payload = encodeSharePayload(doc);
  assert(/^[A-Za-z0-9\-_]+$/.test(payload), "payload is URL-safe");
  const back = decodeSharePayload(payload);
  assert(back !== null, "round-trip decodes");
  if (back) {
    assert(back.d.length === 1 && back.d[0].kind === "rect", "drawing survives round-trip");
    // 4-dp anti-false-precision: 5th decimal is gone.
    const x0 = (back.d[0].g as GeoJSON.Polygon).coordinates[0][0][0];
    assert(x0 === -80.2, `coords rounded to 4dp (got ${x0})`);
    assert(back.d[0].s.c === "#FF2E88" && back.d[0].s.fo === 20, "style survives");
    assert(back.m.length === 1 && back.m[0].kind === "distance", "measurement survives");
    assert(back.m[0].u === "metric", "measurement unit survives");
    assert(back.o.length === 2, "both overlays survive");
    const ui = back.o.find((o) => o.k === "user-import");
    assert(
      !!ui && ui.k === "user-import" && ui.cp.length === 3 && ui.fh.length === 64,
      "user-import placement + file hash survive (no file bytes)"
    );
    const tv = back.o.find((o) => o.k === "tile-version");
    assert(!!tv && tv.k === "tile-version" && tv.id === "leonida-v1" && tv.op === 55, "tile-version delta survives");
  }

  // Truncation: 200 measurements → newest 150 kept.
  const many: Measurement[] = Array.from({ length: 200 }, (_, i) => ({
    id: `m${i}`,
    kind: "distance" as const,
    vertices: [[-80.19, 25.76], [-80.18, 25.77]] as [number, number][],
    unit: "metric" as const,
    createdAt: new Date(Date.UTC(2026, 8, 24, 0, 0, i)).toISOString(),
  }));
  const capped = buildShareDoc([], many, []);
  assert(
    capped.doc.m.length === MAX_SHARED_ITEMS && capped.truncated === 200 - MAX_SHARED_ITEMS,
    `truncation caps at ${MAX_SHARED_ITEMS} newest (kept ${capped.doc.m.length}, dropped ${capped.truncated})`
  );
  // Newest win: first kept item is the latest timestamp.
  assert(
    capped.doc.m[0].t >= capped.doc.m[capped.doc.m.length - 1].t,
    "truncation keeps newest first"
  );

  // Invalid payloads are ignored, never throw.
  assert(decodeSharePayload("") === null, "empty payload ignored");
  assert(decodeSharePayload("!!!not-base64!!!") === null, "garbage ignored");
  assert(decodeSharePayload(b64urlEncode(JSON.stringify({ v: 2 }))) === null, "wrong version ignored");
  assert(decodeSharePayload(b64urlEncode(JSON.stringify({ v: 1 }))) === null, "missing arrays ignored");
  assert(
    decodeSharePayload(b64urlEncode(JSON.stringify({ v: 1, d: [{ kind: "nope" }], m: [], o: [] }))) === null,
    "bad drawing item ignored"
  );
  assert(
    decodeSharePayload(b64urlEncode(JSON.stringify({ v: 1, d: [], m: [{ kind: "distance", v: [[999, 0]], u: "metric", t: 1 }], o: [] }))) === null,
    "out-of-range coords ignored"
  );

  // Divider clamping math.
  assert(clampDividerPct(50) === 50, "divider 50 stays");
  assert(clampDividerPct(-10) === COMPARE_DIVIDER_MIN, "divider clamps to min");
  assert(clampDividerPct(120) === COMPARE_DIVIDER_MAX, "divider clamps to max");
  assert(clampDividerPct(NaN) === 50, "divider NaN → centered");

  // Style-pair defaults + swap-on-duplicate.
  assert(DEFAULT_COMPARE_LEFT === "leonida-dark", "default left = leonida-dark");
  assert(DEFAULT_COMPARE_RIGHT === "real-florida", "default right = real-florida");
  assert(COMPARE_STYLE_LABELS["leonida-dark"] === "Leonida Dark", "left label");
  assert(COMPARE_STYLE_LABELS["real-florida"] === "Real Florida", "right label");
  const swapped = resolveStylePair("leonida-dark", "real-florida", "left", "real-florida");
  assert(swapped.left === "real-florida" && swapped.right === "leonida-dark", "duplicate pick swaps the pair");
  const kept = resolveStylePair("leonida-dark", "real-florida", "right", "real-florida");
  assert(kept.left === "leonida-dark" && kept.right === "real-florida", "same pick is a no-op");
}


if (failures > 0) {
  console.error(`\n${failures} FAILURE(S)`);
  process.exit(1);
}
console.log("\nAll tools acceptance checks passed.");
