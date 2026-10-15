/**
 * SimpleMap.tsx — 2D canvas fallback map (no WebGL required).
 *
 * Renders when the device's GPU cannot run the MapLibre WebGL map
 * (probe tier "none") or when the WebGL map fails to load in time.
 * Draws the original illustrated Leonida base artwork plus every pin —
 * 517 named markers (grid-clustered with counts, like the reference
 * layout) and the 1,581 unnamed density dots — on a plain 2D canvas
 * with drag-pan, wheel/pinch zoom, click-to-select, and search.
 *
 * Projection reuses the same clean-room gameToMap/mapToGame transform as
 * the WebGL map, so pins land on the drawn landmass identically.
 * All artwork, colors, and wording are original to this project.
 */

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PINS, type Pin } from "@/data/pins";
import { mapToGame, honestCoordString } from "../gameCoords";
import { LEONIDA_BASE_QUAD, LEONIDA_BASE_URL } from "../leonidaBase";
import { EVIDENCE_COLORS, SELECTED_RING_COLOR } from "../markerLayer";
import { EVIDENCE_META } from "@/modules/entities/types";

const IMG = 1600; // base artwork is 1600x1600

/** game coords -> artwork pixel (same quad the WebGL image source uses). */
function gameToPixel(x: number, y: number): { px: number; py: number } {
  const q = LEONIDA_BASE_QUAD;
  return {
    px: ((x - q.xMin) / (q.xMax - q.xMin)) * IMG,
    py: ((q.yMax - y) / (q.yMax - q.yMin)) * IMG,
  };
}

function pinToPixel(p: Pin): { px: number; py: number } {
  const g = mapToGame(p.lat, p.lng);
  return gameToPixel(g.x, g.y);
}

// Cluster bubble colors by count — heat ramp; rendered as glossy
// vertical-gradient bubbles (light top → saturated bottom) with a white
// ring and drop shadow, game-map style.
function clusterColor(n: number): string {
  if (n >= 150) return "#ff4d5e";
  if (n >= 50) return "#ff8a3d";
  if (n >= 12) return "#3ddc84";
  return "#5aa9ff";
}

/** Parse #rrggbb → [r,g,b]. */
function hexRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

/** Mix two hex colors; t=0 → a, t=1 → b. */
function mixHex(a: string, b: string, t: number): string {
  const ca = hexRgb(a);
  const cb = hexRgb(b);
  const m = ca.map((v, i) => Math.round(v + (cb[i] - v) * t));
  return `#${m.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

/** Classic teardrop map-pin path: round head tapering to a tip at (x, tipY). */
function teardropPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  tipY: number,
  r: number
) {
  const cy = tipY - r * 1.45;
  const spread = r * 0.82;
  const meetY = cy + r * 0.55;
  ctx.beginPath();
  ctx.moveTo(x, tipY);
  ctx.lineTo(x - spread, meetY);
  ctx.arc(
    x,
    cy,
    r,
    Math.atan2(meetY - cy, -spread),
    Math.atan2(meetY - cy, spread),
    false
  );
  ctx.closePath();
}

type View = { cx: number; cy: number; scale: number };
type PlacedPin = { pin: Pin; px: number; py: number };

export default function SimpleMap() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const viewRef = useRef<View>({ cx: IMG / 2, cy: IMG / 2, scale: 0.5 });
  const placedRef = useRef<PlacedPin[]>([]);
  const densityRef = useRef<{ px: number; py: number }[]>([]);
  const rafRef = useRef<number>(0);
  const gestureRef = useRef<{
    pointers: Map<number, { x: number; y: number }>;
    moved: number;
    downAt: number;
    pinchDist: number;
  }>({ pointers: new Map(), moved: 0, downAt: 0, pinchDist: 0 });

  const [imgReady, setImgReady] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);
  const [selected, setSelected] = useState<Pin | null>(null);
  const [query, setQuery] = useState("");
  const [zoomTick, setZoomTick] = useState(0); // re-render popup anchor on view change
  const [wrapSize, setWrapSize] = useState({ w: 0, h: 0 });

  // Precompute named-pin pixel positions once.
  const placed: PlacedPin[] = useMemo(
    () => PINS.map((pin) => ({ pin, ...pinToPixel(pin) })),
    []
  );
  useEffect(() => {
    placedRef.current = placed;
  }, [placed]);

  const fitScale = useCallback((): number => {
    const wrap = wrapRef.current;
    const r = wrap?.getBoundingClientRect();
    return r ? (Math.min(r.width, r.height) / IMG) * 0.98 : 0.5;
  }, []);

  const clampView = useCallback((v: View) => {
    const fit = 0.5; // recomputed by callers; this is a floor guard only
    void fit;
    v.scale = Math.min(Math.max(v.scale, 0.05), 12);
    const margin = IMG * 0.9;
    v.cx = Math.min(Math.max(v.cx, IMG / 2 - margin), IMG / 2 + margin);
    v.cy = Math.min(Math.max(v.cy, IMG / 2 - margin), IMG / 2 + margin);
  }, []);

  const fitView = useCallback(() => {
    viewRef.current = { cx: IMG / 2, cy: IMG / 2, scale: fitScale() };
    setZoomTick((t) => t + 1);
  }, [fitScale]);

  // ── Canvas painter ──
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    const img = imgRef.current;
    if (!canvas || !wrap) return;
    const rect = wrap.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.round(rect.width));
    const h = Math.max(1, Math.round(rect.height));
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const v = viewRef.current;

    // Deep-space backdrop with a soft violet core — gives the panel depth.
    const bg = ctx.createRadialGradient(
      w / 2, h / 2, 0,
      w / 2, h / 2, Math.max(w, h) * 0.75
    );
    bg.addColorStop(0, "#151128");
    bg.addColorStop(1, "#070512");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    if (img) {
      const size = IMG * v.scale;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, (0 - v.cx) * v.scale + w / 2, (0 - v.cy) * v.scale + h / 2, size, size);
    }

    const toS = (px: number, py: number) => ({
      x: (px - v.cx) * v.scale + w / 2,
      y: (py - v.cy) * v.scale + h / 2,
    });

    const fit = (Math.min(w, h) / IMG) * 0.98;

    // Density dots (only when zoomed in enough to matter).
    if (v.scale > fit * 1.4) {
      ctx.fillStyle = "rgba(148,163,184,0.55)";
      for (const d of densityRef.current) {
        const s = toS(d.px, d.py);
        if (s.x < -4 || s.y < -4 || s.x > w + 4 || s.y > h + 4) continue;
        ctx.beginPath();
        ctx.arc(s.x, s.y, 1.4, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Teardrop map pin with white ring, inner core glyph, and drop shadow.
    const drawPin = (pl: PlacedPin, sx: number, sy: number) => {
      const isSel = selected?.id === pl.pin.id;
      const r = isSel ? 10 : 8;
      const color = EVIDENCE_COLORS[pl.pin.evidence.status];
      const cy = sy - r * 1.45;
      ctx.save();
      ctx.shadowColor = "rgba(0,0,0,0.5)";
      ctx.shadowBlur = 6;
      ctx.shadowOffsetY = 2;
      teardropPath(ctx, sx, sy, r);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.restore();
      ctx.lineWidth = 2;
      ctx.strokeStyle = "rgba(255,255,255,0.95)";
      teardropPath(ctx, sx, sy, r);
      ctx.stroke();
      // white core glyph in the head
      ctx.beginPath();
      ctx.arc(sx, cy, r * 0.38, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,255,255,0.95)";
      ctx.fill();
      if (isSel) {
        ctx.beginPath();
        ctx.arc(sx, cy, r + 6, 0, Math.PI * 2);
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = SELECTED_RING_COLOR;
        ctx.stroke();
      }
    };

    // Named pins: grid-cluster when zoomed out, individual when zoomed in.
    if (v.scale > fit * 3.2) {
      for (const pl of placedRef.current) {
        const s = toS(pl.px, pl.py);
        if (s.x < -24 || s.y < -24 || s.x > w + 24 || s.y > h + 24) continue;
        drawPin(pl, s.x, s.y);
      }
    } else {
      const cell = 76;
      const grid = new Map<string, PlacedPin[]>();
      for (const pl of placedRef.current) {
        const s = toS(pl.px, pl.py);
        if (s.x < -60 || s.y < -60 || s.x > w + 60 || s.y > h + 60) continue;
        const key = `${Math.floor(s.x / cell)},${Math.floor(s.y / cell)}`;
        const arr = grid.get(key);
        if (arr) arr.push(pl);
        else grid.set(key, [pl]);
      }
      for (const arr of grid.values()) {
        let sx = 0;
        let sy = 0;
        for (const pl of arr) {
          const s = toS(pl.px, pl.py);
          sx += s.x;
          sy += s.y;
        }
        sx /= arr.length;
        sy /= arr.length;
        if (arr.length === 1) {
          drawPin(arr[0], sx, sy);
        } else {
          // Glossy cluster bubble: vertical gradient, white ring, drop shadow.
          const n = arr.length;
          const r = Math.min(34, 17 + Math.sqrt(n) * 2.4);
          const base = clusterColor(n);
          const grad = ctx.createLinearGradient(0, sy - r, 0, sy + r);
          grad.addColorStop(0, mixHex(base, "#ffffff", 0.38));
          grad.addColorStop(0.55, base);
          grad.addColorStop(1, mixHex(base, "#000000", 0.22));
          ctx.save();
          ctx.shadowColor = "rgba(0,0,0,0.45)";
          ctx.shadowBlur = 14;
          ctx.shadowOffsetY = 4;
          ctx.beginPath();
          ctx.arc(sx, sy, r, 0, Math.PI * 2);
          ctx.fillStyle = grad;
          ctx.fill();
          ctx.restore();
          ctx.lineWidth = 2;
          ctx.strokeStyle = "rgba(255,255,255,0.9)";
          ctx.beginPath();
          ctx.arc(sx, sy, r, 0, Math.PI * 2);
          ctx.stroke();
          // top gloss highlight
          ctx.beginPath();
          ctx.ellipse(sx, sy - r * 0.52, r * 0.52, r * 0.26, 0, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(255,255,255,0.22)";
          ctx.fill();
          ctx.fillStyle = "#fff";
          const fs = Math.max(13, Math.min(19, r * 0.56));
          ctx.font = `800 ${fs}px ui-rounded, "SF Pro Rounded", system-ui, sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(String(n), sx, sy + 1);
        }
      }
    }
  }, [selected]);

  const scheduleRender = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(render);
  }, [render]);

  // Best-effort density dots (1,581 unnamed pins).
  useEffect(() => {
    let cancelled = false;
    fetch("/data/pins-only.geojson")
      .then((r) => (r.ok ? r.json() : null))
      .then((fc) => {
        if (cancelled || !fc?.features) return;
        const pts: { px: number; py: number }[] = [];
        for (const f of fc.features) {
          const c = f.geometry?.coordinates;
          if (!Array.isArray(c)) continue;
          const g = mapToGame(c[1], c[0]);
          pts.push(gameToPixel(g.x, g.y));
        }
        densityRef.current = pts;
        scheduleRender();
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [scheduleRender]);

  // Load base artwork.
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      setImgReady(true);
      fitView();
      scheduleRender();
    };
    img.onerror = () => setImgFailed(true);
    img.src = LEONIDA_BASE_URL;
    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [fitView, scheduleRender]);

  // Resize → redraw + track size for the popup anchor.
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const ro = new ResizeObserver(() => {
      const r = wrap.getBoundingClientRect();
      setWrapSize({ w: r.width, h: r.height });
      scheduleRender();
    });
    ro.observe(wrap);
    const r = wrap.getBoundingClientRect();
    setWrapSize({ w: r.width, h: r.height });
    return () => ro.disconnect();
  }, [scheduleRender]);

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  const zoomAt = useCallback(
    (mx: number, my: number, factor: number, w: number, h: number) => {
      const v = viewRef.current;
      const before = v.scale;
      v.scale = Math.min(Math.max(v.scale * factor, 0.05), 12);
      const px = v.cx + (mx - w / 2) / before;
      const py = v.cy + (my - h / 2) / before;
      v.cx = px - (mx - w / 2) / v.scale;
      v.cy = py - (my - h / 2) / v.scale;
      clampView(v);
      scheduleRender();
      setZoomTick((t) => t + 1);
    },
    [clampView, scheduleRender]
  );

  // Non-passive wheel listener (React's onWheel is passive → preventDefault warns).
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onWheelNative = (e: WheelEvent) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      zoomAt(e.clientX - rect.left, e.clientY - rect.top, Math.pow(1.0015, -e.deltaY), rect.width, rect.height);
    };
    canvas.addEventListener("wheel", onWheelNative, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheelNative);
  }, [zoomAt]);

  // ── Tap → select pin or zoom into cluster ──
  const handleTap = useCallback(
    (x: number, y: number, w: number, h: number) => {
      const v = viewRef.current;
      const fit = (Math.min(w, h) / IMG) * 0.98;
      if (v.scale > fit * 3.2) {
        let best: Pin | null = null;
        let bestD = 20;
        for (const pl of placedRef.current) {
          const sx = (pl.px - v.cx) * v.scale + w / 2;
          const sy = (pl.py - v.cy) * v.scale + h / 2;
          const d = Math.hypot(sx - x, sy - y);
          if (d < bestD) {
            bestD = d;
            best = pl.pin;
          }
        }
        setSelected(best);
        scheduleRender();
        return;
      }
      const cell = 76;
      const grid = new Map<string, PlacedPin[]>();
      for (const pl of placedRef.current) {
        const sx = (pl.px - v.cx) * v.scale + w / 2;
        const sy = (pl.py - v.cy) * v.scale + h / 2;
        if (sx < -60 || sy < -60 || sx > w + 60 || sy > h + 60) continue;
        const key = `${Math.floor(sx / cell)},${Math.floor(sy / cell)}`;
        const arr = grid.get(key);
        if (arr) arr.push(pl);
        else grid.set(key, [pl]);
      }
      let bestC: PlacedPin[] | null = null;
      let bestCd = 42;
      let ccx = 0;
      let ccy = 0;
      for (const arr of grid.values()) {
        let ax = 0;
        let ay = 0;
        for (const pl of arr) {
          ax += (pl.px - v.cx) * v.scale + w / 2;
          ay += (pl.py - v.cy) * v.scale + h / 2;
        }
        ax /= arr.length;
        ay /= arr.length;
        const d = Math.hypot(ax - x, ay - y);
        if (d < bestCd) {
          bestCd = d;
          bestC = arr;
          ccx = ax;
          ccy = ay;
        }
      }
      if (bestC && bestC.length > 1) {
        // Zoom into the cluster (screen center → cluster image coords).
        const px = v.cx + (ccx - w / 2) / v.scale;
        const py = v.cy + (ccy - h / 2) / v.scale;
        v.cx = px;
        v.cy = py;
        v.scale = Math.min(v.scale * 2.2, 12);
        clampView(v);
        setSelected(null);
      } else if (bestC && bestC.length === 1) {
        setSelected(bestC[0].pin);
      } else {
        setSelected(null);
      }
      scheduleRender();
    },
    [clampView, scheduleRender]
  );

  // ── Gestures ──
  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    const g = gestureRef.current;
    const rect = canvasRef.current!.getBoundingClientRect();
    g.pointers.set(e.pointerId, { x: e.clientX - rect.left, y: e.clientY - rect.top });
    g.moved = 0;
    g.downAt = Date.now();
    if (g.pointers.size === 2) {
      const [a, b] = [...g.pointers.values()];
      g.pinchDist = Math.hypot(a.x - b.x, a.y - b.y);
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const g = gestureRef.current;
    const pt = g.pointers.get(e.pointerId);
    if (!pt) return;
    const rect = canvasRef.current!.getBoundingClientRect();
    const nx = e.clientX - rect.left;
    const ny = e.clientY - rect.top;
    const dx = nx - pt.x;
    const dy = ny - pt.y;
    g.moved += Math.abs(dx) + Math.abs(dy);
    g.pointers.set(e.pointerId, { x: nx, y: ny });
    const v = viewRef.current;
    if (g.pointers.size === 1) {
      v.cx -= dx / v.scale;
      v.cy -= dy / v.scale;
      clampView(v);
      scheduleRender();
      setZoomTick((t) => t + 1);
    } else if (g.pointers.size === 2) {
      const [a, b] = [...g.pointers.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      if (g.pinchDist > 0 && dist > 0) {
        zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, dist / g.pinchDist, rect.width, rect.height);
      }
      g.pinchDist = dist;
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const g = gestureRef.current;
    const wasTap = g.pointers.size === 1 && g.moved < 6 && Date.now() - g.downAt < 450;
    const rect = canvasRef.current!.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    g.pointers.delete(e.pointerId);
    g.pinchDist = 0;
    if (wasTap) handleTap(x, y, rect.width, rect.height);
  };

  // ── Search ──
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    return PINS.filter((p) => p.name.toLowerCase().includes(q)).slice(0, 8);
  }, [query]);

  const flyToPin = (pin: Pin) => {
    const g = mapToGame(pin.lat, pin.lng);
    const { px, py } = gameToPixel(g.x, g.y);
    viewRef.current.cx = px;
    viewRef.current.cy = py;
    viewRef.current.scale = Math.max(viewRef.current.scale, fitScale() * 4.5);
    clampView(viewRef.current);
    setSelected(pin);
    setQuery("");
    scheduleRender();
    setZoomTick((t) => t + 1);
  };

  const copyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* clipboard unavailable — non-fatal */
    }
  };

  // Popup anchor (recomputed when the view changes; effects may read refs).
  const [popupPos, setPopupPos] = useState<{ x: number; y: number } | null>(null);
  useEffect(() => {
    if (!selected || wrapSize.w === 0 || !wrapRef.current) {
      setPopupPos(null);
      return;
    }
    const g = mapToGame(selected.lat, selected.lng);
    const { px, py } = gameToPixel(g.x, g.y);
    const v = viewRef.current;
    setPopupPos({
      x: Math.min(Math.max((px - v.cx) * v.scale + wrapSize.w / 2, 150), wrapSize.w - 150),
      y: Math.min(Math.max((py - v.cy) * v.scale + wrapSize.h / 2, 120), wrapSize.h - 40),
    });
  }, [selected, zoomTick, wrapSize]);

  return (
    <div ref={wrapRef} className="absolute inset-0 overflow-hidden bg-[#0b0916]">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full touch-none"
        style={{ cursor: "grab" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        aria-label="2D Leonida map"
      />
      {!imgReady && !imgFailed && (
        <div className="absolute inset-0 flex items-center justify-center">
          <p className="text-sm text-[#8b94a3]">Loading map artwork…</p>
        </div>
      )}
      {imgFailed && (
        <div className="absolute inset-0 flex items-center justify-center p-6 text-center">
          <p className="max-w-sm text-sm text-[#8b94a3]">
            Map artwork failed to load. Check your connection and refresh the page.
          </p>
        </div>
      )}

      {/* 2D-mode badge */}
      <div className="absolute left-3 top-3 rounded-full border border-white/10 bg-black/55 px-3 py-1 text-[11px] font-semibold text-white backdrop-blur">
        2D map <span className="font-normal text-[#8b94a3]">· {PINS.length} locations</span>
      </div>

      {/* Search */}
      <div className="absolute right-3 top-3 w-60">
        <div className="relative">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.2}
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#5b6472]"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" strokeLinecap="round" />
          </svg>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search locations…"
            aria-label="Search locations"
            className="w-full rounded-xl border border-white/10 bg-black/60 py-2 pl-9 pr-3 text-sm text-white shadow-lg backdrop-blur placeholder:text-[#5b6472] focus:border-[#ff50c5]/70 focus:outline-none"
          />
        </div>
        {results.length > 0 && (
          <ul className="mt-2 max-h-60 overflow-y-auto rounded-xl border border-white/10 bg-[#141020]/95 shadow-2xl backdrop-blur-xl">
            {results.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => flyToPin(p)}
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-white/10"
                >
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: EVIDENCE_COLORS[p.evidence.status] }}
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-white">
                      {p.name}
                    </span>
                    <span
                      className="block text-[10px] font-semibold uppercase tracking-wider"
                      style={{ color: EVIDENCE_COLORS[p.evidence.status] }}
                    >
                      {EVIDENCE_META[p.evidence.status].label}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Selected-pin popup — glassmorphism card */}
      {selected && popupPos && (
        <div
          className="absolute z-10 w-72 -translate-x-1/2 rounded-2xl border border-white/10 bg-[#171126]/95 p-4 shadow-[0_16px_50px_rgba(0,0,0,0.55)] backdrop-blur-xl"
          style={{ left: popupPos.x, top: popupPos.y }}
        >
          <div className="flex items-start gap-3">
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl shadow-lg"
              style={{ backgroundColor: EVIDENCE_COLORS[selected.evidence.status] }}
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5 text-white" fill="currentColor" aria-hidden="true">
                <path d="M12 2C8.1 2 5 5.1 5 9c0 5.2 7 13 7 13s7-7.8 7-13c0-3.9-3.1-7-7-7Zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5Z" />
              </svg>
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-extrabold text-white">{selected.name}</p>
              <p
                className="mt-0.5 text-[10px] font-bold uppercase tracking-widest"
                style={{ color: EVIDENCE_COLORS[selected.evidence.status] }}
              >
                {EVIDENCE_META[selected.evidence.status].label}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setSelected(null);
                scheduleRender();
              }}
              aria-label="Close"
              className="rounded-full p-1 text-[#8b94a3] hover:bg-white/10 hover:text-white"
            >
              ✕
            </button>
          </div>
          <p className="mt-3 flex items-center gap-1.5 font-mono text-[11px] text-white/60">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-3.5 w-3.5" aria-hidden="true">
              <circle cx="12" cy="12" r="7" />
              <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
              <path d="M12 2v3M12 19v3M2 12h3M19 12h3" strokeLinecap="round" />
            </svg>
            {honestCoordString(selected.lat, selected.lng)}
          </p>
          <button
            type="button"
            onClick={() => copyText(honestCoordString(selected.lat, selected.lng))}
            className="mt-3 w-full rounded-xl bg-[#ff50c5] py-2 text-xs font-extrabold uppercase tracking-wider text-white shadow-[0_4px_18px_rgba(255,80,197,0.4)] transition hover:bg-[#ff6ad1]"
          >
            Copy coords
          </button>
        </div>
      )}

      {/* Zoom controls */}
      <div className="absolute bottom-3 right-3 flex flex-col items-center gap-2">
        <button
          type="button"
          aria-label="Zoom in"
          onClick={() => {
            const r = wrapRef.current!.getBoundingClientRect();
            zoomAt(r.width / 2, r.height / 2, 1.4, r.width, r.height);
          }}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-black/60 text-xl font-light text-white shadow-lg backdrop-blur transition hover:border-[#ff50c5]/60"
        >
          +
        </button>
        <button
          type="button"
          aria-label="Zoom out"
          onClick={() => {
            const r = wrapRef.current!.getBoundingClientRect();
            zoomAt(r.width / 2, r.height / 2, 1 / 1.4, r.width, r.height);
          }}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-black/60 text-xl font-light text-white shadow-lg backdrop-blur transition hover:border-[#ff50c5]/60"
        >
          −
        </button>
        <button
          type="button"
          aria-label="Reset view"
          onClick={() => {
            fitView();
            scheduleRender();
          }}
          className="rounded-full border border-white/10 bg-black/60 px-3 py-1.5 text-[11px] font-bold text-white shadow-lg backdrop-blur transition hover:border-[#ff50c5]/60"
        >
          Reset
        </button>
      </div>

      {/* Fan-project note */}
      <p className="absolute bottom-3 left-3 max-w-[220px] text-[10px] leading-snug text-[#5b6472]">
        Fan project — not affiliated with Rockstar Games. Locations are approximate.
      </p>
    </div>
  );
}
