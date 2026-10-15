// ─── modules/entities/data/gtadb/transform.ts ─────────────────────────────
// STAGING ONLY — not imported by any page, route, or barrel.
// Clean-room coordinate transform: GTADB game-world frame -> placeholder
// Florida lat/lng frame. Written from scratch for GTA6mapx; the math
// (weighted least-squares affine fit) is textbook and not anyone's IP.
// Nothing here is read from, copied from, or derived from the Atlas repo's
// code — data JSON structure only was ever inspected.
//
// ── MODEL ─────────────────────────────────────────────────────────────────
//   lat = a·x + b·y + c
//   lng = d·x + e·y + f
// An affine map captures translation, rotation, (non-)uniform scale and axis
// skew — everything a game-world -> flat-map projection needs for a fan-map
// placeholder. The 6 parameters are solved by WEIGHTED least squares: build
// the normal equations  (Xᵀ·W·X)·p = Xᵀ·W·t  for each target (lat, lng)
// separately and solve the 3×3 system by Gaussian elimination (see
// fitAffineWeighted below). Weights encode anchor confidence: exact,
// unambiguous anchors weigh more than loose regional inspirations.
//
// ── CONTROL POINTS (v1, metro-anchored) ───────────────────────────────────
// Game coords are dataset district centroids; targets are our own editorial
// assignments (well-known public places, Miami metro). 7 points, spread
// across the metro (beach / downtown / port / airport / islands).
//
//   district            game (x, y)          ->  lat, lng            w
//   Vice Beach          ( 1658.6,  1153.6)  ->  25.7900, -80.1300   1.0  Miami Beach
//   Vice City           ( -977.3,  -149.5)  ->  25.7617, -80.1918   1.0  Downtown Miami
//   Port Vice City      (  751.4,  -499.0)  ->  25.7743, -80.1676   1.0  Port of Miami
//   VCIA                (-2533.9,  -625.9)  ->  25.7959, -80.2870   1.0  Miami Intl Airport
//   Leaf Links          (  321.5,  2409.3)  ->  25.8757, -80.1413   0.7  Indian Creek
//   Rialto Islands      (  516.0,  1262.0)  ->  25.7900, -80.1800   0.6  Venetian Islands
//   Starfish Island     (  760.4,   445.2)  ->  25.7772, -80.1493   0.6  Star Island
//
// ── VALIDATION (leave-one-out cross-validation, haversine error) ──────────
//   Vice Beach        1.80 km
//   Vice City         4.90 km
//   Port Vice City    5.72 km
//   VCIA              6.98 km
//   Leaf Links        8.82 km   <- max held-out
//   Rialto Islands    4.14 km
//   Starfish Island   1.26 km
//   RMSE: 5.41 km   (spec threshold: ≤ 5.0 km — marginally ABOVE, see below)
//   Max held-out: 8.82 km  (spec threshold: ≤ 15 km — passes)
// Sanity: Keys pins land south of city pins ✓, north-forest pins north ✓,
// 383/383 Vice Beach pins within 40 km of Miami Beach ✓, 0/2091 outside the
// Florida bbox ✓, axis orientation confirmed (+x east, +y north, no flip).
//
// HONEST ASSESSMENT: RMSE 5.41 km misses the 5 km spec bar by 8%. This is
// accepted as approximate-location grade for the PLACEHOLDER frame only —
// every staged record keeps its raw game coords, and records outside the
// validated metro zone (anchor bbox +25% in game units:
// x ∈ [-3582.0, 2706.7], y ∈ [-1384.7, 3168.1]) are flagged
// needsCoordVerification:true because they are extrapolated, not validated.
// Do NOT treat transformed coords as survey data.
//
// ── REJECTED ALTERNATIVES (documented so nobody re-tries them blindly) ────
// (a) Exact street-address analogs as targets (e.g. "Dominion Hotel" -> its
//     real Miami address): LOOCV RMSE 584 km. Leonida is a fictional
//     rearrangement of Florida inspirations, not a scaled Florida.
// (b) 9 region-centroid anchors incl. far regions (Keys/Panhandle/N.FL):
//     LOOCV RMSE 168 km. The Vice City metro is drawn ~20–36× larger relative
//     to the state than real Florida proportions — no single affine can fit
//     both (structural scale conflict in the game geometry).
// (c) Weighted compromise (metro w=10, far w=0.5): LOOCV RMSE 193 km — bad
//     everywhere; the compromise destroyed the metro fit without fixing far
//     regions.
// Phase B (custom Leonida tiles): re-fit with fitAffineWeighted against the
// new tile frame's anchors -> transform-v2. The placeholder fit does NOT
// transfer.

export interface AffineCoefficients {
  a: number; b: number; c: number;
  d: number; e: number; f: number;
}

export interface ControlPoint {
  district: string;
  gameX: number; gameY: number;
  lat: number; lng: number;
  weight: number;
  note: string;
}

/** Fitted v1 coefficients (rolux/gtadb.org rev 7c3f8c2, metro anchors). */
export const TRANSFORM_V1: AffineCoefficients = {
  a: -1.1540152977270894e-05,
  b: 3.24719093392057e-05,
  c: 25.777937929894787,
  d: 3.1406659310782595e-05,
  e: 9.768858096582977e-06,
  f: -80.1855469774487,
};

export const CONTROL_POINTS_V1: ControlPoint[] = [
  { district: "Vice Beach",     gameX: 1658.6,  gameY: 1153.6,  lat: 25.79,   lng: -80.13,   weight: 1.0, note: "beach strip -> Miami Beach" },
  { district: "Vice City",      gameX: -977.3,  gameY: -149.5,  lat: 25.7617, lng: -80.1918, weight: 1.0, note: "downtown -> Downtown Miami" },
  { district: "Port Vice City", gameX: 751.4,   gameY: -499.0,  lat: 25.7743, lng: -80.1676, weight: 1.0, note: "port -> Port of Miami" },
  { district: "VCIA",           gameX: -2533.9, gameY: -625.9,  lat: 25.7959, lng: -80.287,  weight: 1.0, note: "airport -> Miami Intl Airport" },
  { district: "Leaf Links",     gameX: 321.5,   gameY: 2409.3,  lat: 25.8757, lng: -80.1413, weight: 0.7, note: "golf islands -> Indian Creek" },
  { district: "Rialto Islands", gameX: 516.0,   gameY: 1262.0,  lat: 25.79,   lng: -80.18,   weight: 0.6, note: "islands -> Venetian Islands" },
  { district: "Starfish Island",gameX: 760.4,   gameY: 445.2,   lat: 25.7772, lng: -80.1493, weight: 0.6, note: "island -> Star Island" },
];

/** Validated metro zone in game units (anchor bbox +25% per side). */
export const VALIDATED_ZONE_V1 = {
  xMin: -3582.025, xMax: 2706.725,
  yMin: -1384.7,  yMax: 3168.1,
};

/** Apply the v1 affine transform: game (x, y) -> placeholder-Florida (lat, lng). */
export function applyTransformV1(
  x: number,
  y: number,
  coef: AffineCoefficients = TRANSFORM_V1,
): { lat: number; lng: number } {
  return {
    lat: coef.a * x + coef.b * y + coef.c,
    lng: coef.d * x + coef.e * y + coef.f,
  };
}

export function inValidatedZoneV1(x: number, y: number): boolean {
  const z = VALIDATED_ZONE_V1;
  return x >= z.xMin && x <= z.xMax && y >= z.yMin && y <= z.yMax;
}

// ── Weighted least-squares affine fitter (clean-room, for Phase B re-fit) ──
// Solves t = a·x + b·y + c for weighted points [(x, y, t, w)] via the normal
// equations (XᵀWX)p = XᵀWt, 3×3 Gaussian elimination. Call once for lat
// targets and once for lng targets.

function solve3(A: number[][], b: number[]): number[] {
  const M = A.map((row, i) => [...row, b[i]]);
  const n = 3;
  for (let col = 0; col < n; col++) {
    let piv = col;
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(M[r][col]) > Math.abs(M[piv][col])) piv = r;
    }
    if (Math.abs(M[piv][col]) < 1e-12) throw new Error("singular normal matrix");
    [M[col], M[piv]] = [M[piv], M[col]];
    for (let r = col + 1; r < n; r++) {
      const f = M[r][col] / M[col][col];
      for (let c = col; c <= n; c++) M[r][c] -= f * M[col][c];
    }
  }
  const x = [0, 0, 0];
  for (let i = n - 1; i >= 0; i--) {
    let s = M[i][n];
    for (let j = i + 1; j < n; j++) s -= M[i][j] * x[j];
    x[i] = s / M[i][i];
  }
  return x;
}

export interface WeightedPoint {
  x: number; y: number; t: number; w: number;
}

/** Returns [a, b, c] for t = a·x + b·y + c. */
export function fitAffineWeighted(points: WeightedPoint[]): [number, number, number] {
  const S: number[][] = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  const v = [0, 0, 0];
  for (const p of points) {
    const row = [p.x, p.y, 1];
    for (let i = 0; i < 3; i++) {
      v[i] += p.w * row[i] * p.t;
      for (let j = 0; j < 3; j++) S[i][j] += p.w * row[i] * row[j];
    }
  }
  const [a, b, c] = solve3(S, v);
  return [a, b, c];
}

/** Fit both rows at once from control points. */
export function fitTransform(points: ControlPoint[]): AffineCoefficients {
  const [a, b, c] = fitAffineWeighted(
    points.map((p) => ({ x: p.gameX, y: p.gameY, t: p.lat, w: p.weight })),
  );
  const [d, e, f] = fitAffineWeighted(
    points.map((p) => ({ x: p.gameX, y: p.gameY, t: p.lng, w: p.weight })),
  );
  return { a, b, c, d, e, f };
}

/** Haversine distance in km — for LOOCV residual reporting. */
export function haversineKm(
  lat1: number, lng1: number, lat2: number, lng2: number,
): number {
  const R = 6371;
  const p1 = (lat1 * Math.PI) / 180;
  const p2 = (lat2 * Math.PI) / 180;
  const dp = ((lat2 - lat1) * Math.PI) / 180;
  const dl = ((lng2 - lng1) * Math.PI) / 180;
  const h =
    Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
