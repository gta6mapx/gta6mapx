"use client";

import dynamic from "next/dynamic";
import { MapThemeProvider } from "@/modules/map/components/MapThemeProvider";

// GameMap is client-only (MapLibre needs WebGL + window).
const GameMap = dynamic(() => import("./GameMap"), {
  ssr: false,
  loading: () => (
    <div className="flex flex-1 items-center justify-center bg-[#0a0a12]">
      <p className="font-mono text-sm text-[#8b94a3]">Preparing the map…</p>
    </div>
  ),
});

export default function MapLoader() {
  return (
    <MapThemeProvider>
      <GameMap />
    </MapThemeProvider>
  );
}
