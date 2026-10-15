import Link from "next/link";
import type { Vehicle, GameLocation, Weapon, Character } from "../types";
import EvidenceBadge from "./EvidenceBadge";

/**
 * EntityCard — one database entry on a hub page.
 * Badge wraps below the title on narrow screens (flex-wrap) so the title
 * column never gets squeezed on mobile.
 */
export default function EntityCard({
  entity,
}: {
  entity: Vehicle | GameLocation | Weapon | Character;
}) {
  const href =
    entity.kind === "vehicle"
      ? `/vehicles/${entity.slug}`
      : entity.kind === "location"
        ? `/locations/${entity.slug}`
        : entity.kind === "weapon"
          ? `/weapons/${entity.slug}`
          : `/characters/${entity.slug}`;
  const sub =
    entity.kind === "vehicle"
      ? `${entity.manufacturer} · ${entity.vclass}`
      : entity.kind === "location"
        ? entity.region
        : entity.kind === "weapon"
          ? entity.wclass
          : entity.role;
  return (
    <Link
      href={href}
      className="group block rounded-xl border border-[#1f2632] bg-[#11161f] p-4 transition hover:-translate-y-0.5 hover:border-green-500 hover:shadow-lg hover:shadow-green-500/10"
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
        <h3 className="font-bold leading-tight group-hover:text-green-400 transition">
          {entity.name}
        </h3>
        <EvidenceBadge evidence={entity.evidence} />
      </div>
      <p className="mt-1 text-xs text-[#8b94a3]">{sub}</p>
      <p className="mt-2 text-sm text-[#8b94a3] leading-relaxed line-clamp-2">
        {entity.summary}
      </p>
    </Link>
  );
}
