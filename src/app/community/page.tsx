import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/auth";
import { Logo } from "@/components/logo";
import { SiteHeader } from "@/components/site-header";
import { getConsensus } from "@/lib/lists";
import { TIERS, TIER_COLOR, TIER_POINTS, type Kind } from "@/lib/constants";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Stats",
  description: "Projects ranked by points from posted tier lists, with a breakdown of each tier.",
};

export default async function CommunityPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string }>;
}) {
  const { kind: raw } = await searchParams;
  const kind: Kind = raw === "nft" ? "nft" : "fungible";
  const session = await auth();
  const viewer = session?.user
    ? { id: session.user.id, name: session.user.name, image: session.user.image }
    : null;
  const consensus = await getConsensus(kind);
  const subject = kind === "nft" ? "NFTs" : "currencies";

  return (
    <div className="min-h-screen bg-black">
      <SiteHeader
        viewer={viewer}
        kind={kind}
        kindHrefBase="/community"
      />
      <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-6">
        <div>
          <h1 className="text-2xl font-semibold text-cyan-300">Top {subject}</h1>
          <p className="mt-1 text-sm text-zinc-400">
            From {consensus.listCount} posted {consensus.listCount === 1 ? "list" : "lists"}.
          </p>
          <p className="mt-2 flex flex-wrap gap-2 text-xs font-semibold">
            {TIERS.map((tier) => (
              <span key={tier} className="rounded px-2 py-1 text-white" style={{ backgroundColor: TIER_COLOR[tier] }}>
                {tier} = {TIER_POINTS[tier]}
              </span>
            ))}
          </p>
        </div>
        {consensus.ranked.length === 0 ? (
          <p className="text-sm text-zinc-500">
            No lists posted yet.{" "}
            <Link href="/" className="text-cyan-300 underline">
              Make one
            </Link>
          </p>
        ) : (
          <ol className="divide-y divide-white/10 overflow-hidden rounded-lg border border-white/10">
            {consensus.ranked.map((entry, index) => (
              <li key={entry.asset.id} className="bg-[#0b0f16] px-3 py-3">
                <div className="flex items-center gap-3">
                  <span className="w-6 text-right text-sm tabular-nums text-zinc-500">{index + 1}</span>
                  <Logo
                    kind={entry.asset.kind}
                    externalId={entry.asset.externalId}
                    name={entry.asset.name}
                    symbol={entry.asset.symbol}
                    className="h-10 w-10"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-zinc-100">{entry.asset.name}</p>
                    <p className="text-xs uppercase tracking-wide text-zinc-500">{entry.asset.symbol}</p>
                  </div>
                  <p className="text-sm font-semibold tabular-nums text-cyan-200">{entry.score} pts</p>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5 pl-9">
                  {TIERS.map((tier) => (
                    <span
                      key={tier}
                      className="rounded px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-white"
                      style={{ backgroundColor: TIER_COLOR[tier] }}
                    >
                      {tier} {entry.counts[tier]}
                    </span>
                  ))}
                </div>
              </li>
            ))}
          </ol>
        )}
        <section>
          <h2 className="mb-3 text-sm font-medium text-cyan-300">Recent lists</h2>
          {consensus.recent.length === 0 ? (
            <p className="text-sm text-zinc-500">No lists posted yet.</p>
          ) : (
            <ul className="divide-y divide-white/10 rounded-lg border border-white/10">
              {consensus.recent.map((list) => (
                <li key={list.slug} className="flex flex-wrap items-baseline justify-between gap-2 px-3 py-3">
                  <Link href={`/l/${list.slug}`} className="font-medium text-zinc-100 hover:text-cyan-200">
                    {list.title}
                  </Link>
                  <span className="text-sm text-zinc-500">
                    {list.kind === "nft" ? "NFTs" : "Currencies"}
                    {list.authorHandle ? ` · @${list.authorHandle}` : list.authorName ? ` · ${list.authorName}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
