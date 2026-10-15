"use client";

export interface CityDef {
  id: string;
  label: string;
  /** Camera target in [lng, lat] (MapLibre order). */
  center: [number, number];
  zoom: number;
}

// ─── APPROXIMATE — approximate bounds; replace with city-bounds dataset ───
const CITIES: CityDef[] = [
  { id: "vice-city", label: "Vice City", center: [-80.1918, 25.7617], zoom: 12 },
  { id: "port-gellhorn", label: "Port Gellhorn", center: [-80.35, 25.85], zoom: 11 },
  { id: "ambrosia", label: "Ambrosia", center: [-80.05, 25.95], zoom: 11 },
  { id: "leonida-keys", label: "Leonida Keys", center: [-80.1, 25.7], zoom: 11 },
];

interface CityJumpProps {
  active: string | null;
  onJump(city: CityDef): void;
}

/**
 * CityJump — pill row that flies the camera to a city.
 * Active pill carries the pink brand gradient.
 */
export default function CityJump({ active, onJump }: CityJumpProps) {
  return (
    <nav aria-label="Jump to city" className="flex max-w-[46vw] items-center gap-1.5 overflow-x-auto py-0.5 sm:max-w-none">
      {CITIES.map((city) => {
        const isActive = active === city.id;
        return (
          <button
            key={city.id}
            type="button"
            onClick={() => onJump(city)}
            aria-pressed={isActive}
            className={
              isActive
                ? "btn-neon shrink-0 rounded-full bg-gradient-to-r from-[#ff50c5] to-[#a855f7] px-3 py-1.5 font-display text-xs font-normal tracking-wider text-white uppercase shadow-[0_0_18px_rgba(255,80,197,0.35)]"
                : "shrink-0 rounded-full border border-[#1f2632] bg-[#0a0e14]/80 px-3 py-1.5 font-display text-xs tracking-wider text-[#8b94a3] uppercase transition-colors hover:border-[rgba(255,80,197,0.4)] hover:text-[#e8ecf1]"
            }
          >
            {city.label}
          </button>
        );
      })}
    </nav>
  );
}
