// ─── modules/map/components/chrome/SearchedMarker.ts ───────────────────
// Upgrade for the GoToPosition flow: replaces the ephemeral reticle circle
// with a persistent searched-position marker — a pink GeoJSON circle layer
// plus a dark-glass popup ("Searched position", honest mono readout,
// "Remove marker" button that calls cleanup). Also syncs ?search=lng,lat
// into the URL (other params preserved) and clears it on cleanup.
// Everything is labeled approximate. Pure TypeScript, no React.
// All code below is original (CHROME TEAM, Sep 2026).

import { Popup } from "maplibre-gl";
import type { Map as MLMap } from "maplibre-gl";
import { honestCoordString } from "../../gameCoords";

const SOURCE_ID = "gmx-searched-marker";
const LAYER_ID = "gmx-searched-marker-layer";
const POPUP_CLASS = "gmx-searched-popup";
const REMOVE_ATTR = "data-gmx-remove";

/** Remove any previous searched marker + popup from the map/DOM. */
function removeExisting(map: MLMap): void {
  try {
    if (map.getLayer(LAYER_ID)) map.removeLayer(LAYER_ID);
  } catch {
    /* already gone — non-fatal */
  }
  try {
    if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
  } catch {
    /* already gone — non-fatal */
  }
  for (const el of Array.from(
    document.querySelectorAll(`.${POPUP_CLASS}`)
  )) {
    el.remove();
  }
}

/** Set (or clear, when lat is null) the ?search=lng,lat URL param. */
function syncSearchParam(lng: number, lat: number | null): void {
  try {
    const url = new URL(window.location.href);
    if (lat === null) {
      url.searchParams.delete("search");
    } else {
      url.searchParams.set("search", `${lng.toFixed(5)},${lat.toFixed(5)}`);
    }
    window.history.replaceState(null, "", url.toString());
  } catch {
    /* URL sync is best-effort — non-fatal */
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => {
    switch (c) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      default:
        return "&#39;";
    }
  });
}

function popupHtml(readout: string): string {
  return (
    `<style>` +
    `.${POPUP_CLASS} .maplibregl-popup-content{background:rgba(10,14,20,.94);` +
    `border:1px solid rgba(255,80,197,.4);border-radius:12px;padding:12px 14px;` +
    `color:#e8ecf1;box-shadow:0 8px 32px rgba(0,0,0,.6),0 0 18px rgba(255,80,197,.22);` +
    `backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);}` +
    `.${POPUP_CLASS}.maplibregl-popup-anchor-top .maplibregl-popup-tip{border-bottom-color:rgba(10,14,20,.94);}` +
    `.${POPUP_CLASS}.maplibregl-popup-anchor-bottom .maplibregl-popup-tip{border-top-color:rgba(10,14,20,.94);}` +
    `.${POPUP_CLASS}.maplibregl-popup-anchor-left .maplibregl-popup-tip{border-right-color:rgba(10,14,20,.94);}` +
    `.${POPUP_CLASS}.maplibregl-popup-anchor-right .maplibregl-popup-tip{border-left-color:rgba(10,14,20,.94);}` +
    `</style>` +
    `<div>` +
    `<div style="font-family:var(--font-display),sans-serif;font-size:11px;` +
    `letter-spacing:.14em;text-transform:uppercase;color:#ff7aa8;">Searched position</div>` +
    `<div style="margin-top:2px;font-size:11px;color:#8b94a3;">approximate position</div>` +
    `<div style="margin-top:6px;font-family:ui-monospace,SFMono-Regular,monospace;` +
    `font-size:12px;color:#e8ecf1;">${readout}</div>` +
    `<button type="button" ${REMOVE_ATTR} style="margin-top:10px;height:36px;` +
    `padding:0 14px;border-radius:8px;border:1px solid rgba(255,80,197,.5);` +
    `background:rgba(255,80,197,.12);color:#ffb3cd;font-size:12px;font-weight:600;` +
    `cursor:pointer;">Remove marker</button>` +
    `</div>`
  );
}

/**
 * Mount the searched-position marker. Returns cleanup(), which removes the
 * layer, popup, and the ?search param. Mounting again replaces the marker.
 */
export function mountSearchedMarker(
  map: MLMap,
  lng: number,
  lat: number
): () => void {
  removeExisting(map);

  const data: GeoJSON.FeatureCollection<GeoJSON.Geometry> = {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: {},
        geometry: { type: "Point", coordinates: [lng, lat] },
      },
    ],
  };
  map.addSource(SOURCE_ID, { type: "geojson", data });
  map.addLayer({
    id: LAYER_ID,
    type: "circle",
    source: SOURCE_ID,
    paint: {
      "circle-radius": 11,
      "circle-color": "#ff50c5",
      "circle-opacity": 0.85,
      "circle-stroke-width": 2.5,
      "circle-stroke-color": "#ffffff",
    },
  });

  const popup = new Popup({
    closeButton: false,
    closeOnClick: false,
    className: POPUP_CLASS,
    maxWidth: "280px",
    offset: 20,
  })
    .setLngLat([lng, lat])
    .setHTML(popupHtml(escapeHtml(honestCoordString(lat, lng))))
    .addTo(map);

  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    try {
      popup.remove();
    } catch {
      /* already removed — non-fatal */
    }
    removeExisting(map);
    syncSearchParam(0, null);
  };

  popup
    .getElement()
    .querySelector(`[${REMOVE_ATTR}]`)
    ?.addEventListener("click", cleanup);

  syncSearchParam(lng, lat);
  return cleanup;
}
