// ─── modules/map/tools/measure/store.ts ─────────────────────────────
// Sole state owner for the measure slice: sketch, finished measurements,
// selection, undo/redo over finished-measurement mutations, and persistence.
//
// Undo/redo uses the snapshot pattern (spec §2.5, shared with drawings):
// before every committed mutation (add/delete/clear) the measurement list
// is snapshotted (≤50 deep). Right-click / the mobile Undo chip pops ONE
// SKETCH VERTEX — never the mutation stack.

"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
} from "react";
import { useTools } from "../shared/toolRuntime";
import { measureStrings } from "./sliceStrings";
import {
  MAX_MEASUREMENTS,
  MEASURE_STORAGE_KEY,
  type Measurement,
  type MeasureHistoryEntry,
  type MeasureKind,
  type MeasureVertex,
  type MeasurementsDoc,
} from "./types";

const HISTORY_DEPTH = 50;
const SAVE_DEBOUNCE_MS = 500;

interface MeasureState {
  measurements: Measurement[]; // newest first
  sketchTool: MeasureKind | null;
  sketchVertices: MeasureVertex[];
  sketchCursor: MeasureVertex | null;
  selectedId: string | null;
  undoStack: MeasureHistoryEntry[];
  redoStack: MeasureHistoryEntry[];
}

const initialState: MeasureState = {
  measurements: [],
  sketchTool: null,
  sketchVertices: [],
  sketchCursor: null,
  selectedId: null,
  undoStack: [],
  redoStack: [],
};

/** Snapshot before a committed mutation; any new mutation clears redo. */
function pushHistory(state: MeasureState, label: string): MeasureState {
  const entry: MeasureHistoryEntry = {
    measurements: structuredClone(state.measurements),
    label,
    at: new Date().toISOString(),
  };
  return {
    ...state,
    undoStack: [...state.undoStack, entry].slice(-HISTORY_DEPTH),
    redoStack: [],
  };
}

type Action =
  | { type: "sketch/start"; kind: MeasureKind }
  | { type: "sketch/add"; vertex: MeasureVertex }
  | { type: "sketch/pop" }
  | { type: "sketch/cursor"; cursor: MeasureVertex | null }
  | { type: "sketch/clear" }
  | { type: "measure/commit"; measurement: Measurement }
  | { type: "measure/delete"; id: string }
  | { type: "measure/clear" }
  | { type: "select"; id: string | null }
  | { type: "undo" }
  | { type: "redo" }
  | { type: "restore"; measurements: Measurement[] };

function reducer(state: MeasureState, action: Action): MeasureState {
  switch (action.type) {
    case "sketch/start":
      return {
        ...state,
        sketchTool: action.kind,
        sketchVertices: [],
        sketchCursor: null,
        selectedId: null,
      };
    case "sketch/add": {
      if (!state.sketchTool) return state;
      const last = state.sketchVertices[state.sketchVertices.length - 1];
      const v = action.vertex;
      // Dedupe: double-fires at the same pixel must not stack vertices.
      if (
        last &&
        Math.abs(last[0] - v[0]) < 1e-9 &&
        Math.abs(last[1] - v[1]) < 1e-9
      ) {
        return state;
      }
      return { ...state, sketchVertices: [...state.sketchVertices, v] };
    }
    case "sketch/pop":
      return state.sketchVertices.length === 0
        ? state
        : { ...state, sketchVertices: state.sketchVertices.slice(0, -1) };
    case "sketch/cursor":
      return { ...state, sketchCursor: action.cursor };
    case "sketch/clear":
      return state.sketchTool === null
        ? state
        : { ...state, sketchTool: null, sketchVertices: [], sketchCursor: null };
    case "measure/commit": {
      const withHistory = pushHistory(
        state,
        `add ${action.measurement.kind} measurement`
      );
      return {
        ...withHistory,
        measurements: [action.measurement, ...withHistory.measurements].slice(
          0,
          MAX_MEASUREMENTS
        ),
        sketchTool: null,
        sketchVertices: [],
        sketchCursor: null,
        selectedId: null,
      };
    }
    case "measure/delete": {
      if (!state.measurements.some((m) => m.id === action.id)) return state;
      const withHistory = pushHistory(state, "delete measurement");
      return {
        ...withHistory,
        measurements: withHistory.measurements.filter(
          (m) => m.id !== action.id
        ),
        selectedId:
          withHistory.selectedId === action.id ? null : withHistory.selectedId,
      };
    }
    case "measure/clear": {
      if (state.measurements.length === 0) return state;
      const withHistory = pushHistory(state, "clear measurements");
      return { ...withHistory, measurements: [], selectedId: null };
    }
    case "select":
      return { ...state, selectedId: action.id };
    case "undo": {
      if (state.undoStack.length === 0) return state;
      const prev = state.undoStack[state.undoStack.length - 1];
      const redoEntry: MeasureHistoryEntry = {
        measurements: structuredClone(state.measurements),
        label: prev.label,
        at: new Date().toISOString(),
      };
      return {
        ...state,
        measurements: prev.measurements,
        selectedId: null,
        undoStack: state.undoStack.slice(0, -1),
        redoStack: [...state.redoStack, redoEntry].slice(-HISTORY_DEPTH),
      };
    }
    case "redo": {
      if (state.redoStack.length === 0) return state;
      const next = state.redoStack[state.redoStack.length - 1];
      const undoEntry: MeasureHistoryEntry = {
        measurements: structuredClone(state.measurements),
        label: next.label,
        at: new Date().toISOString(),
      };
      return {
        ...state,
        measurements: next.measurements,
        selectedId: null,
        redoStack: state.redoStack.slice(0, -1),
        undoStack: [...state.undoStack, undoEntry].slice(-HISTORY_DEPTH),
      };
    }
    case "restore":
      return {
        ...state,
        measurements: action.measurements.slice(0, MAX_MEASUREMENTS),
        selectedId: null,
      };
  }
}

// ─── Persistence validation ─────────────────────────────────────────────

function isValidVertex(v: unknown): v is MeasureVertex {
  return (
    Array.isArray(v) &&
    v.length === 2 &&
    v.every((n) => typeof n === "number" && Number.isFinite(n))
  );
}

function isValidMeasurement(m: unknown): m is Measurement {
  if (typeof m !== "object" || m === null) return false;
  const o = m as Record<string, unknown>;
  return (
    typeof o.id === "string" &&
    (o.kind === "distance" || o.kind === "area") &&
    Array.isArray(o.vertices) &&
    o.vertices.every(isValidVertex) &&
    (o.unit === "metric" || o.unit === "imperial") &&
    typeof o.createdAt === "string"
  );
}

/** Returns the measurement list, or null when the doc is unusable. */
function validateMeasurementsDoc(doc: unknown): Measurement[] | null {
  if (typeof doc !== "object" || doc === null) return null;
  const o = doc as Record<string, unknown>;
  if (o.version !== 1 || !Array.isArray(o.measurements)) return null;
  if (!o.measurements.every(isValidMeasurement)) return null;
  return o.measurements as Measurement[];
}

// ─── Context ────────────────────────────────────────────────────────────

export interface MeasureActions {
  startSketch: (kind: MeasureKind) => void;
  addVertex: (v: MeasureVertex) => void;
  popVertex: () => void;
  setCursor: (v: MeasureVertex | null) => void;
  /** Discard the in-progress sketch (cancel — never commits). */
  cancelSketch: () => void;
  commit: (m: Measurement) => void;
  deleteMeasurement: (id: string) => void;
  deleteSelected: () => void;
  /** Returns the number cleared (0 when empty). */
  clearAll: () => number;
  select: (id: string | null) => void;
  undo: () => void;
  redo: () => void;
}

interface MeasureStoreValue {
  state: MeasureState;
  actions: MeasureActions;
}

const MeasureStoreContext = createContext<MeasureStoreValue | null>(null);

export function useMeasureStore(): MeasureStoreValue {
  const v = useContext(MeasureStoreContext);
  if (!v) throw new Error("useMeasureStore() must be used inside <MeasureProvider>");
  return v;
}

export function MeasureProvider({ children }: { children: React.ReactNode }) {
  const { toast } = useTools();
  const [state, dispatch] = useReducer(reducer, initialState);
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  });
  const corruptToasted = useRef(false);
  const quotaWarned = useRef(false);

  // Restore once on mount (client-only, spec §1.3). Corruption → discard +
  // one-time toast; never throw to the user.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(MEASURE_STORAGE_KEY);
      if (raw !== null) {
        const parsed: unknown = JSON.parse(raw);
        const measurements = validateMeasurementsDoc(parsed);
        if (measurements) {
          dispatch({ type: "restore", measurements });
        } else if (!corruptToasted.current) {
          corruptToasted.current = true;
          toast(measureStrings.corrupt);
        }
      }
    } catch {
      if (!corruptToasted.current) {
        corruptToasted.current = true;
        toast(measureStrings.corrupt);
      }
    }
    // toast is runtime-stable; run once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist raw vertices only (never computed totals), debounced 500 ms
  // after committed changes — never during sketching.
  useEffect(() => {
    const t = window.setTimeout(() => {
      try {
        const doc: MeasurementsDoc = {
          version: 1,
          savedAt: new Date().toISOString(),
          measurements: stateRef.current.measurements,
        };
        window.localStorage.setItem(MEASURE_STORAGE_KEY, JSON.stringify(doc));
      } catch (err) {
        if (
          err instanceof DOMException &&
          err.name === "QuotaExceededError" &&
          !quotaWarned.current
        ) {
          quotaWarned.current = true;
          toast(measureStrings.storageFull);
        }
      }
    }, SAVE_DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [state.measurements, toast]);

  const actions = useMemo<MeasureActions>(
    () => ({
      startSketch: (kind) => dispatch({ type: "sketch/start", kind }),
      addVertex: (v) => dispatch({ type: "sketch/add", vertex: v }),
      popVertex: () => dispatch({ type: "sketch/pop" }),
      setCursor: (v) => dispatch({ type: "sketch/cursor", cursor: v }),
      cancelSketch: () => dispatch({ type: "sketch/clear" }),
      commit: (m) => dispatch({ type: "measure/commit", measurement: m }),
      deleteMeasurement: (id) => dispatch({ type: "measure/delete", id }),
      deleteSelected: () => {
        const id = stateRef.current.selectedId;
        if (id) dispatch({ type: "measure/delete", id });
      },
      clearAll: () => {
        const n = stateRef.current.measurements.length;
        if (n > 0) dispatch({ type: "measure/clear" });
        return n;
      },
      select: (id) => dispatch({ type: "select", id }),
      undo: () => dispatch({ type: "undo" }),
      redo: () => dispatch({ type: "redo" }),
    }),
    []
  );

  const value = useMemo(() => ({ state, actions }), [state, actions]);
  return (
    <MeasureStoreContext.Provider value={value}>
      {children}
    </MeasureStoreContext.Provider>
  );
}
