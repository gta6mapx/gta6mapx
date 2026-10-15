import type { Metadata } from "next";
import GameScreen from "@/modules/engagement/game/components/GameScreen";

export const metadata: Metadata = {
  title: "Find the Location — GTA 6 Guessing Game — GTA6mapx",
  description:
    "Pinpoint Leonida: read the clue dossier, drop a pin on our 3D map, and score on accuracy, speed, and hint frugality. 5 rounds, honest evidence labels, your records stored on this device.",
};

export default function FindTheLocationPage() {
  return (
    <main className="flex min-h-dvh flex-col bg-[#0a0a12]">
      <GameScreen />
    </main>
  );
}
