import MapLoader from "@/modules/map/MapLoader";

export const metadata = {
  title: "GTA 6 Interactive Map — GTA6mapx",
  description:
    "Interactive GTA 6 (Leonida) map: collectibles, stores, missions, vehicles. Every pin carries an evidence chain — Rockstar-confirmed, Trailer-confirmed, Leak-reported, or Disputed. Search, filters, coordinate jump, and free progress tracking.",
};

export default function MapPage() {
  // Centered map-panel layout: the illustrated map sits as a panel in the
  // middle of the page with breathing room on all four sides. Ambient neon
  // glows (our own Vice City identity, CSS only) fill the surrounding space.
  // Legal + credits live in the settings drawer and the About modal.
  return (
    <main className="relative flex h-dvh flex-col overflow-hidden bg-[#140f24]">
      {/* Ambient neon atmosphere — original CSS, no assets */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 left-1/4 h-96 w-96 rounded-full bg-[#ff50c5]/10 blur-[120px]" />
        <div className="absolute -bottom-40 right-1/4 h-[28rem] w-[28rem] rounded-full bg-[#8b5cf6]/10 blur-[140px]" />
        <div className="absolute top-1/2 left-1/2 h-[36rem] w-[36rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#8b5cf6]/5 blur-[160px]" />
      </div>
      <MapLoader />
    </main>
  );
}
