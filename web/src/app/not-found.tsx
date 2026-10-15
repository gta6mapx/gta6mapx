import Link from "next/link";

export const metadata = {
  title: "Page not found — GTA6mapx",
  description:
    "The page you're looking for doesn't exist on GTA6mapx — the GTA 6 interactive map and database.",
};

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#0a0e14] px-4 text-center text-[#e8ecf1]">
      <p className="text-7xl font-extrabold tracking-tight text-green-500">404</p>
      <h1 className="mt-4 text-2xl font-bold">This street isn&apos;t on the map yet</h1>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-[#8b94a3]">
        The page you&apos;re looking for doesn&apos;t exist — it may have moved,
        or the link was mistyped.
      </p>
      <div className="mt-6 flex gap-3">
        <Link
          href="/"
          className="rounded-lg bg-green-600 px-5 py-2.5 text-sm font-semibold hover:bg-green-500"
        >
          Go home
        </Link>
        <Link
          href="/map"
          className="rounded-lg border border-[#1f2632] px-5 py-2.5 text-sm font-semibold hover:border-green-500"
        >
          Open the map
        </Link>
      </div>
      <p className="mt-10 max-w-md text-[11px] leading-relaxed text-[#8b94a3]">
        Independent fan project. Not affiliated with or endorsed by Rockstar Games or Take-Two Interactive.
      </p>
    </main>
  );
}
