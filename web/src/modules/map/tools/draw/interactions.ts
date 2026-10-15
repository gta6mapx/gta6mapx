// ─── modules/map/tools/draw/interactions.ts ─────────────────────────────
// Pointer wiring per draw tool (spec §2.1, §2.4, §2.10).
//
// Two input layers:
//   - Native canvas pointer events (pointerdown/move/up/cancel) for pen
//     strokes, rect/circle drags and drag-to-move — this is what gives us
//     pointer capture and unified mouse/touch handling. MapLibre 6.11 does
//     not expose pointer events on the map object itself.
//   - Map events (click/dblclick/mousemove/contextmenu) for the line tool's
//     click-to-place model.
//
// Every coordinate resolves via map.unproject() → lng/lat on the ground
// plane, so sketches are camera-independent and survive 2D/3D toggles
// (spec §1.6). Minimum-geometry guards per spec §2.1. Right-click cancels
// an in-progress sketch only (contextmenu preventDefault is scoped to
// that). On touch, completed shapes auto-exit to navigate (§2.10).

import type { Map as MapLibreMap, MapMouseEvent } from "maplibre-gl";
import type { ActiveTool } from "../shared/toolRuntime";
import { lockDragPanForGesture } from "../shared/mapInteractionLocks";
import type { DrawStore } from "./store";
import { MAX_DRAWINGS } from "./store";
import type { DrawingLayers } from "./layers";
import { DRAW_HIT_LAYER_IDS } from "./layers";
import type {
  DrawFeature,
  DrawStyle,
  DrawToolKind,
  PreviewSketch,
} from "./types";
import {
  buildRectPolygon,
  buildCirclePolygon,
  distanceMeters,
  simplifyStroke,
  distinctVertexCount,
  translateFeature,
  type LngLat,
} from "./geometry";
import { drawStrings as S } from "./sliceStrings";

export interface DrawInteractionDeps {
  store: DrawStore;
  toast: (msg: string) => void;
  activateTool: (tool: ActiveTool) => void;
  /** Current default style (new drawings + previews). */
  getDefaultStyle: () => DrawStyle;
  /** Touch draw mode: one finger draws, two fingers pan/zoom. */
  isTouchDrawMode: () => boolean;
  getLayers: () => DrawingLayers | null;
}

type Tool = DrawToolKind | "select" | null;
/**
 * "suspended" = another tool family (e.g. measure) owns the map — draw
 * interactions stay completely inert, including selection.
 */
export type InteractionTool = Tool | "suspended";

const HIT_PX = 8;
const MIN_DRAG_PX = 4;
const SNAP_CLOSE_PX = 10;

function newId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `draw-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function isTypingTarget(t: EventTarget | null): boolean {
  const el = t as HTMLElement | null;
  if (!el || typeof el.tagName !== "string") return false;
  return (
    el.tagName === "INPUT" ||
    el.tagName === "TEXTAREA" ||
    el.tagName === "SELECT" ||
    el.isContentEditable
  );
}

function dialogOpen(): boolean {
  return (
    document.querySelector('[role="dialog"][data-tools-modal="true"]') !== null
  );
}

interface PenState {
  points: LngLat[];
  restoreDrag: (() => void) | null;
  pointerId: number;
}
interface LineState {
  vertices: LngLat[];
  cursor: LngLat | null;
}
interface ShapeState {
  kind: "rect" | "circle";
  startPx: { x: number; y: number };
  startLngLat: LngLat;
  dragging: boolean;
  pendingCorner: LngLat | null;
  restoreDrag: (() => void) | null;
  pointerId: number;
}
interface MoveState {
  id: string;
  startLngLat: LngLat;
  pointerId: number;
  restoreDrag: () => void;
  /** Last applied drag delta (for the pointerup commit). */
  delta: [number, number] | null;
}
/** Armed click-click corner while no pointer is down. */
interface PendingShape {
  kind: "rect" | "circle";
  corner: LngLat;
}

export class DrawInteractions {
  private map: MapLibreMap;
  private deps: DrawInteractionDeps;
  private tool: InteractionTool = null;
  private destroyed = false;

  private pen: PenState | null = null;
  private line: LineState | null = null;
  private shape: ShapeState | null = null;
  private move: MoveState | null = null;
  private pendingShape: PendingShape | null = null;
  private pendingSelectId: string | null = null;
  private pendingDeselect = false;
  private downPx: { x: number; y: number } | null = null;

  /** Session locks owned by this slice (restored on tool change). */
  private touchLockRestore: (() => void) | null = null;
  private dblClickRestore: (() => void) | null = null;

  constructor(map: MapLibreMap, deps: DrawInteractionDeps) {
    this.map = map;
    this.deps = deps;
    const canvas = map.getCanvas();
    canvas.addEventListener("pointerdown", this.onPointerDown);
    canvas.addEventListener("pointermove", this.onPointerMove);
    canvas.addEventListener("pointerup", this.onPointerUp);
    canvas.addEventListener("pointercancel", this.onPointerCancel);
    map.on("click", this.onMapClick);
    map.on("dblclick", this.onMapDblClick);
    map.on("mousemove", this.onMapMouseMove);
    map.on("contextmenu", this.onMapContextMenu);
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("beforeunload", this.onBeforeUnload);
  }

  destroy(): void {
    this.destroyed = true;
    this.cancelSketch();
    const canvas = this.map.getCanvas();
    canvas.removeEventListener("pointerdown", this.onPointerDown);
    canvas.removeEventListener("pointermove", this.onPointerMove);
    canvas.removeEventListener("pointerup", this.onPointerUp);
    canvas.removeEventListener("pointercancel", this.onPointerCancel);
    this.map.off("click", this.onMapClick);
    this.map.off("dblclick", this.onMapDblClick);
    this.map.off("mousemove", this.onMapMouseMove);
    this.map.off("contextmenu", this.onMapContextMenu);
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("beforeunload", this.onBeforeUnload);
    this.restoreSessionLocks();
  }

  // ─── Tool routing ────────────────────────────────────────────────────

  setTool(tool: InteractionTool): void {
    if (this.tool === tool) return;
    this.cancelSketch();
    this.restoreSessionLocks();
    this.tool = tool;
    this.applySessionLocks();
  }

  /** Re-apply session locks when touchDrawMode flips mid-tool. */
  refreshTouchLock(): void {
    this.restoreSessionLocks();
    this.applySessionLocks();
  }

  private applySessionLocks(): void {
    // Line finishes on double-click — doubleClickZoom would zoom instead.
    // (Spec §1.4 lists this lock for measure; line needs it for the same
    // reason.)
    if (this.tool === "line" && this.map.doubleClickZoom.isEnabled()) {
      this.map.doubleClickZoom.disable();
      this.dblClickRestore = () => this.map.doubleClickZoom.enable();
    }
    // Touch draw mode: one finger draws, two fingers pan/zoom — dragPan's
    // one-finger interference goes off for the whole tool session.
    // ("suspended" never locks: another tool owns the map.)
    if (
      (this.tool === "pen" ||
        this.tool === "line" ||
        this.tool === "rect" ||
        this.tool === "circle") &&
      this.deps.isTouchDrawMode() &&
      this.map.dragPan.isEnabled()
    ) {
      this.map.dragPan.disable();
      this.touchLockRestore = () => this.map.dragPan.enable();
    }
  }

  private restoreSessionLocks(): void {
    if (this.dblClickRestore) {
      this.dblClickRestore();
      this.dblClickRestore = null;
    }
    if (this.touchLockRestore) {
      this.touchLockRestore();
      this.touchLockRestore = null;
    }
  }

  // ─── Sketch lifecycle ────────────────────────────────────────────────

  /** Discard in-progress work. Never commits (spec §1.1 cancel semantics). */
  cancelSketch(): void {
    if (this.pen?.restoreDrag) this.pen.restoreDrag();
    if (this.shape?.restoreDrag) this.shape.restoreDrag();
    this.pen = null;
    this.line = null;
    this.shape = null;
    this.pendingShape = null;
    this.pendingSelectId = null;
    this.pendingDeselect = false;
    this.clearPreview();
  }

  private clearPreview(): void {
    this.deps.getLayers()?.setPreview(null);
    this.deps.getLayers()?.setVertexDots([]);
  }

  private sketchInProgress(): boolean {
    return (
      this.pen !== null ||
      (this.line !== null && this.line.vertices.length > 0) ||
      this.shape !== null ||
      this.pendingShape !== null ||
      this.move !== null
    );
  }

  private onBeforeUnload = (e: BeforeUnloadEvent) => {
    if (this.sketchInProgress()) e.preventDefault();
  };

  // ─── Coordinate helpers (all via map.unproject, spec §1.6) ────────────

  /** Container-relative px → lng/lat on the ground plane. */
  private unprojectAt(x: number, y: number): LngLat {
    const ll = this.map.unproject([x, y]);
    return [ll.lng, ll.lat];
  }

  private canvasPoint(e: PointerEvent): { x: number; y: number } {
    const rect = this.map.getCanvas().getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  /** Degrees of longitude per screen pixel at a location. */
  private degreesPerPixel(at: LngLat): number {
    const p = this.map.project([at[0], at[1]]);
    const q = this.map.unproject([p.x + 1, p.y]);
    return Math.max(1e-9, Math.abs(q.lng - at[0]));
  }

  // ─── Hit testing (spec §2.4: nearest feature within 8 px) ────────────

  private hitTest(clientX: number, clientY: number): DrawFeature | null {
    const rect = this.map.getCanvas().getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const box: [[number, number], [number, number]] = [
      [x - HIT_PX, y - HIT_PX],
      [x + HIT_PX, y + HIT_PX],
    ];
    let rendered: ReturnType<MapLibreMap["queryRenderedFeatures"]> = [];
    try {
      rendered = this.map.queryRenderedFeatures(box, {
        layers: [...DRAW_HIT_LAYER_IDS],
      });
    } catch {
      return null;
    }
    const live = this.deps.store.getState().features;
    const candidates = new Map<string, DrawFeature>();
    for (const f of rendered) {
      const id = f.id;
      if (typeof id !== "string" || candidates.has(id)) continue;
      const feat = live.find((d) => d.id === id);
      if (feat) candidates.set(id, feat);
    }
    let best: DrawFeature | null = null;
    let bestD = Infinity;
    for (const feat of candidates.values()) {
      const d = this.pixelDistanceToFeature(x, y, feat);
      if (d <= HIT_PX && d < bestD) {
        bestD = d;
        best = feat;
      }
    }
    return best;
  }

  private pixelDistanceToFeature(
    x: number,
    y: number,
    feat: DrawFeature
  ): number {
    const projectRing = (ring: LngLat[]) =>
      ring.map((c) => {
        const p = this.map.project([c[0], c[1]]);
        return { x: p.x, y: p.y };
      });
    const segDist = (
      px: number,
      py: number,
      ax: number,
      ay: number,
      bx: number,
      by: number
    ): number => {
      const dx = bx - ax;
      const dy = by - ay;
      const lenSq = dx * dx + dy * dy;
      const t =
        lenSq === 0
          ? 0
          : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
      const cx = ax + t * dx;
      const cy = ay + t * dy;
      return Math.hypot(px - cx, py - cy);
    };
    const ringDist = (pts: { x: number; y: number }[]): number => {
      let m = Infinity;
      for (let i = 0; i + 1 < pts.length; i++) {
        m = Math.min(
          m,
          segDist(x, y, pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y)
        );
      }
      return m;
    };
    if (feat.geometry.type === "LineString") {
      return ringDist(projectRing(feat.geometry.coordinates as LngLat[]));
    }
    // Polygon: 0 when inside the outer ring, else edge distance.
    const outer = projectRing(feat.geometry.coordinates[0] as LngLat[]);
    let inside = false;
    for (let i = 0, j = outer.length - 1; i < outer.length; j = i++) {
      const xi = outer[i].x;
      const yi = outer[i].y;
      const xj = outer[j].x;
      const yj = outer[j].y;
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
        inside = !inside;
      }
    }
    return inside ? 0 : ringDist(outer);
  }

  // ─── Commits ─────────────────────────────────────────────────────────

  private commitFeature(
    kind: DrawToolKind,
    label: string,
    geometry: DrawFeature["geometry"],
    meta?: DrawFeature["meta"]
  ): void {
    const style = this.deps.getDefaultStyle();
    const now = new Date().toISOString();
    const feature: DrawFeature = {
      id: newId(),
      kind,
      geometry,
      style: { ...style },
      createdAt: now,
      updatedAt: now,
    };
    if (meta) feature.meta = meta;
    const ok = this.deps.store.commit(label, (list) => [...list, feature]);
    this.clearPreview();
    if (!ok) {
      this.deps.toast(S.drawingLimit(MAX_DRAWINGS));
      return;
    }
    // Auto-select the new drawing so drag-move / style edits are one tap
    // away.
    this.deps.store.setSelected(feature.id);
    this.deps.getLayers()?.setSelected(feature.id);
    if (this.deps.isTouchDrawMode()) {
      // §2.10: touch auto-exits to navigate after each completed shape.
      this.deps.activateTool(null);
    }
  }

  // ─── Native pointer handlers ─────────────────────────────────────────

  private onPointerDown = (e: PointerEvent): void => {
    if (this.destroyed) return;
    const touch = e.pointerType === "touch";
    const drawMode = this.deps.isTouchDrawMode();
    if (this.tool === "pen") {
      // Touch pen drawing is gated behind touch draw mode (spec §2.10);
      // mouse always draws.
      if (touch && !drawMode) return;
      this.penDown(e);
    } else if (this.tool === "rect" || this.tool === "circle") {
      if (touch && !drawMode) return;
      this.shapeDown(e, this.tool);
    } else if (this.tool === null || this.tool === "select") {
      // Selection works on touch regardless of draw mode — a tap is not
      // a pan, so it never conflicts with one-finger panning.
      this.selectDown(e);
    }
    // "suspended": another tool family owns the map — stay inert.
  };

  private onPointerMove = (e: PointerEvent): void => {
    if (this.destroyed) return;
    if (this.pen && e.pointerId === this.pen.pointerId) this.penMove(e);
    else if (this.shape && e.pointerId === this.shape.pointerId)
      this.shapeMove(e);
    else if (this.move && e.pointerId === this.move.pointerId)
      this.moveMove(e);
  };

  private onPointerUp = (e: PointerEvent): void => {
    if (this.destroyed) return;
    if (this.pen && e.pointerId === this.pen.pointerId) this.penUp(e);
    else if (this.shape && e.pointerId === this.shape.pointerId)
      this.shapeUp(e);
    else if (this.move && e.pointerId === this.move.pointerId)
      this.moveUp();
    else if (this.tool === null || this.tool === "select") this.selectUp(e);
  };

  private onPointerCancel = (e: PointerEvent): void => {
    if (this.destroyed) return;
    if (this.pen && e.pointerId === this.pen.pointerId) {
      this.pen.restoreDrag?.();
      this.pen = null;
      this.clearPreview();
    }
    if (this.shape && e.pointerId === this.shape.pointerId) {
      this.shape.restoreDrag?.();
      this.shape = null;
      this.clearPreview();
    }
    if (this.move && e.pointerId === this.move.pointerId) {
      this.move.restoreDrag();
      this.move = null;
      // Restore the un-moved source data.
      this.deps.getLayers()?.sync(this.deps.store.getState().features);
    }
  };

  // ─── Pen (freehand) ──────────────────────────────────────────────────

  private penDown(e: PointerEvent): void {
    if (e.button !== 0 || this.pen) return;
    const { x, y } = this.canvasPoint(e);
    const restoreDrag = lockDragPanForGesture(this.map);
    try {
      this.map.getCanvas().setPointerCapture(e.pointerId);
    } catch {
      /* capture unsupported — stroke still works */
    }
    this.pen = {
      points: [this.unprojectAt(x, y)],
      restoreDrag,
      pointerId: e.pointerId,
    };
  }

  private penMove(e: PointerEvent): void {
    if (!this.pen) return;
    const { x, y } = this.canvasPoint(e);
    this.pen.points.push(this.unprojectAt(x, y));
    const sketch: PreviewSketch = {
      kind: "pen",
      geometry: { type: "LineString", coordinates: this.pen.points },
      style: this.deps.getDefaultStyle(),
    };
    this.deps.getLayers()?.setPreview(sketch);
  }

  private penUp(e: PointerEvent): void {
    const pen = this.pen;
    if (!pen) return;
    this.pen = null;
    pen.restoreDrag?.();
    try {
      this.map.getCanvas().releasePointerCapture(e.pointerId);
    } catch {
      /* noop */
    }
    if (pen.points.length < 2) {
      this.clearPreview();
      return;
    }
    // Freehand simplification pipeline (spec §2.9): radial pre-filter →
    // Douglas–Peucker → 2000-vertex cap, 2 px tolerances via unproject.
    const cx =
      pen.points.reduce((s, p) => s + p[0], 0) / pen.points.length;
    const cy =
      pen.points.reduce((s, p) => s + p[1], 0) / pen.points.length;
    const simplified = simplifyStroke(
      pen.points,
      this.degreesPerPixel([cx, cy])
    );
    if (distinctVertexCount(simplified) < 2) {
      this.clearPreview();
      return;
    }
    this.commitFeature("pen", "draw freehand", {
      type: "LineString",
      coordinates: simplified,
    });
  }

  // ─── Rectangle / circle (drag or click-click) ────────────────────────

  private shapeDown(e: PointerEvent, kind: "rect" | "circle"): void {
    if (e.button !== 0) return;
    // A second pointer while a drag is in flight is ignored; a fresh
    // pointerdown after a tap keeps the armed click-click corner.
    if (this.shape?.restoreDrag) return;
    const pending =
      this.pendingShape && this.pendingShape.kind === kind
        ? this.pendingShape.corner
        : null;
    const { x, y } = this.canvasPoint(e);
    try {
      this.map.getCanvas().setPointerCapture(e.pointerId);
    } catch {
      /* noop */
    }
    this.shape = {
      kind,
      startPx: { x, y },
      startLngLat: this.unprojectAt(x, y),
      dragging: false,
      pendingCorner: pending,
      restoreDrag: lockDragPanForGesture(this.map),
      pointerId: e.pointerId,
    };
  }

  private shapePreviewGeometry(
    kind: "rect" | "circle",
    a: LngLat,
    b: LngLat
  ): PreviewSketch["geometry"] | null {
    if (kind === "rect") {
      if (a[0] === b[0] || a[1] === b[1]) return null;
      return buildRectPolygon(a, b);
    }
    const radius = distanceMeters(a, b);
    if (radius <= 0) return null;
    return buildCirclePolygon(a, radius).polygon;
  }

  private shapeMove(e: PointerEvent): void {
    const s = this.shape;
    if (!s) return;
    const { x, y } = this.canvasPoint(e);
    if (
      !s.dragging &&
      Math.hypot(x - s.startPx.x, y - s.startPx.y) < MIN_DRAG_PX
    ) {
      return;
    }
    s.dragging = true;
    // A real drag supersedes any click-click pending corner.
    s.pendingCorner = null;
    const cur = this.unprojectAt(x, y);
    const geom = this.shapePreviewGeometry(s.kind, s.startLngLat, cur);
    if (!geom) {
      this.clearPreview();
      return;
    }
    const sketch: PreviewSketch = {
      kind: s.kind,
      geometry: geom,
      style: this.deps.getDefaultStyle(),
    };
    this.deps.getLayers()?.setPreview(sketch);
  }

  private shapeUp(e: PointerEvent): void {
    const s = this.shape;
    if (!s) return;
    this.shape = null;
    s.restoreDrag?.();
    try {
      this.map.getCanvas().releasePointerCapture(e.pointerId);
    } catch {
      /* noop */
    }
    const { x, y } = this.canvasPoint(e);
    const end = this.unprojectAt(x, y);
    if (s.dragging) {
      // Drag path: commit on pointerup.
      this.commitShape(s.kind, s.startLngLat, end);
      return;
    }
    // Click-click path: first tap arms the corner, second tap commits.
    if (s.pendingCorner) {
      const corner = s.pendingCorner;
      this.pendingShape = null;
      this.commitShape(s.kind, corner, end);
    } else {
      this.pendingShape = { kind: s.kind, corner: end };
      // Mark the armed corner with a vertex dot.
      this.deps.getLayers()?.setVertexDots([end]);
    }
  }

  private commitShape(kind: "rect" | "circle", a: LngLat, b: LngLat): void {
    this.pendingShape = null;
    if (kind === "rect") {
      if (a[0] === b[0] || a[1] === b[1]) {
        this.clearPreview();
        return; // zero-area guard (spec §2.1)
      }
      this.commitFeature("rect", "draw rectangle", buildRectPolygon(a, b));
    } else {
      const radius = distanceMeters(a, b);
      if (radius <= 0) {
        this.clearPreview();
        return;
      }
      const { polygon, meta } = buildCirclePolygon(a, radius);
      this.commitFeature("circle", "draw circle", polygon, meta);
    }
  }

  // ─── Line (click-to-place) ───────────────────────────────────────────

  private onMapClick = (e: MapMouseEvent): void => {
    if (this.tool !== "line" || this.destroyed) return;
    // Second click of a double-click finishes instead of placing.
    const detail = (e.originalEvent as MouseEvent | undefined)?.detail ?? 1;
    if (detail >= 2) {
      this.finishLine();
      return;
    }
    const p = this.unprojectAt(e.point.x, e.point.y);
    if (!this.line) this.line = { vertices: [], cursor: null };
    // Snap-close hint: clicking the first vertex (≤10 px) finishes.
    if (this.line.vertices.length >= 2) {
      const first = this.line.vertices[0];
      const fp = this.map.project([first[0], first[1]]);
      if (Math.hypot(fp.x - e.point.x, fp.y - e.point.y) <= SNAP_CLOSE_PX) {
        this.finishLine();
        return;
      }
    }
    this.line.vertices.push(p);
    this.updateLinePreview();
  };

  private onMapDblClick = (e: MapMouseEvent): void => {
    if (this.tool !== "line" || this.destroyed) return;
    e.preventDefault();
    this.finishLine();
  };

  private onMapMouseMove = (e: MapMouseEvent): void => {
    if (this.tool !== "line" || !this.line || this.destroyed) return;
    this.line.cursor = this.unprojectAt(e.point.x, e.point.y);
    this.updateLinePreview();
  };

  private updateLinePreview(): void {
    const layers = this.deps.getLayers();
    if (!layers || !this.line || this.line.vertices.length === 0) {
      if (!this.line || this.line.vertices.length === 0) this.clearPreview();
      return;
    }
    const coords =
      this.line.cursor &&
      (this.line.cursor[0] !==
        this.line.vertices[this.line.vertices.length - 1][0] ||
        this.line.cursor[1] !==
          this.line.vertices[this.line.vertices.length - 1][1])
        ? [...this.line.vertices, this.line.cursor]
        : this.line.vertices;
    const sketch: PreviewSketch = {
      kind: "line",
      geometry: { type: "LineString", coordinates: coords },
      style: this.deps.getDefaultStyle(),
      vertices: this.line.vertices,
    };
    layers.setPreview(sketch);
    layers.setVertexDots(this.line.vertices);
  }

  /** Public: the on-screen ✓ button (touch) finishes the line. */
  finishLine(): void {
    const line = this.line;
    this.line = null;
    if (!line || distinctVertexCount(line.vertices) < 2) {
      this.clearPreview();
      if (line && line.vertices.length > 0) {
        // Tried to finish a degenerate line — say why it vanished.
        this.deps.toast(S.lineNeedsTwo);
      }
      return;
    }
    this.commitFeature("line", "draw line", {
      type: "LineString",
      coordinates: line.vertices,
    });
  }

  // ─── Selection + drag-to-move (navigate / select mode, spec §2.4) ────

  private selectDown(e: PointerEvent): void {
    if (e.button !== 0 || this.move) return;
    const { x, y } = this.canvasPoint(e);
    this.downPx = { x, y };
    const hit = this.hitTest(e.clientX, e.clientY);
    const selectedId = this.deps.store.getState().selectedId;
    if (hit && hit.id === selectedId) {
      // Drag-to-move: disable dragPan for the gesture.
      const startLngLat = this.unprojectAt(x, y);
      try {
        this.map.getCanvas().setPointerCapture(e.pointerId);
      } catch {
        /* noop */
      }
      this.move = {
        id: hit.id,
        startLngLat,
        pointerId: e.pointerId,
        restoreDrag: lockDragPanForGesture(this.map),
        delta: null,
      };
    } else if (hit) {
      this.pendingSelectId = hit.id;
    } else {
      this.pendingDeselect = true;
    }
  }

  private moveMove(e: PointerEvent): void {
    const m = this.move;
    if (!m) return;
    const { x, y } = this.canvasPoint(e);
    const cur = this.unprojectAt(x, y);
    const dLng = cur[0] - m.startLngLat[0];
    const dLat = cur[1] - m.startLngLat[1];
    if (dLng === 0 && dLat === 0) return;
    m.delta = [dLng, dLat];
    const moved = this.deps.store
      .getState()
      .features.map((f) =>
        f.id === m.id ? translateFeature(f, dLng, dLat) : f
      );
    this.deps.getLayers()?.sync(moved);
  }

  private moveUp(): void {
    const m = this.move;
    if (!m) return;
    this.move = null;
    m.restoreDrag();
    const layers = this.deps.getLayers();
    if (m.delta && (m.delta[0] !== 0 || m.delta[1] !== 0)) {
      const [dLng, dLat] = m.delta;
      this.deps.store.commit("move drawing", (list) =>
        list.map((f) =>
          f.id === m.id ? translateFeature(f, dLng, dLat) : f
        )
      );
    }
    layers?.sync(this.deps.store.getState().features);
  }

  private selectUp(e: PointerEvent): void {
    const down = this.downPx;
    this.downPx = null;
    if (this.move) {
      // A move gesture was armed but pointerup arrived on a different
      // pointer path — finalize via the shared path.
      return;
    }
    if (!down) return;
    const { x, y } = this.canvasPoint(e);
    const movedPx = Math.hypot(x - down.x, y - down.y);
    if (movedPx >= MIN_DRAG_PX) {
      // It was a pan, not a click.
      this.pendingSelectId = null;
      this.pendingDeselect = false;
      return;
    }
    if (this.pendingSelectId) {
      const id = this.pendingSelectId;
      this.pendingSelectId = null;
      this.deps.store.setSelected(id);
      this.deps.getLayers()?.setSelected(id);
      this.refreshVertexDots();
    } else if (this.pendingDeselect) {
      this.pendingDeselect = false;
      this.deps.store.setSelected(null);
      this.deps.getLayers()?.setSelected(null);
      this.deps.getLayers()?.setVertexDots([]);
    }
  }

  /** Vertex dots for the selected line feature (visual only, v1). */
  refreshVertexDots(): void {
    const layers = this.deps.getLayers();
    if (!layers) return;
    const { features, selectedId } = this.deps.store.getState();
    const feat = features.find((f) => f.id === selectedId);
    if (feat && feat.kind === "line") {
      layers.setVertexDots(feat.geometry.coordinates as LngLat[]);
    } else {
      layers.setVertexDots([]);
    }
  }

  // ─── Map context menu / keyboard ──────────────────────────────────────

  private onMapContextMenu = (e: MapMouseEvent): void => {
    // Right-click cancels an in-progress sketch only (spec §2.1) — the
    // context menu is left alone otherwise.
    if (!this.sketchInProgress()) return;
    e.preventDefault();
    this.cancelSketch();
  };

  private onKeyDown = (e: KeyboardEvent): void => {
    if (this.destroyed || isTypingTarget(e.target) || dialogOpen()) return;
    if (e.key === "Enter" && this.tool === "line") {
      e.preventDefault();
      this.finishLine();
      return;
    }
    if (e.key === "Escape" && this.move) {
      // Cancel an in-progress drag-move (tool is navigate here, so the
      // provider won't exit anything).
      this.move.restoreDrag();
      this.move = null;
      this.deps.getLayers()?.sync(this.deps.store.getState().features);
    }
  };

  // ─── Cross-slice edit operations ─────────────────────────────────────

  /** Delete the selected drawing (undoable). Returns true when deleted. */
  deleteSelected(): boolean {
    const { selectedId } = this.deps.store.getState();
    if (!selectedId) return false;
    const ok = this.deps.store.commit(
      "delete drawing",
      (list) => list.filter((f) => f.id !== selectedId)
    );
    if (ok) {
      this.deps.getLayers()?.setSelected(null);
      this.deps.getLayers()?.setVertexDots([]);
      this.deps.toast(S.deletedDrawing);
    }
    return ok;
  }

  undo(): string | null {
    const label = this.deps.store.undo();
    if (label !== null) this.refreshVertexDots();
    return label;
  }

  redo(): string | null {
    const label = this.deps.store.redo();
    if (label !== null) this.refreshVertexDots();
    return label;
  }
}
