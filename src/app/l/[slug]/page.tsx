import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { CopyLink } from "@/components/copy-link";
import { SiteHeader } from "@/components/site-header";
import { TierView } from "@/components/tier-view";
import { TIERS, isTier, type Tier } from "@/lib/constants";
import { getPublishedList } from "@/lib/lists";
import { requestOrigin } from "@/lib/origin";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const list = await getPublishedList(slug);
  if (!list) return { title: "List" };
  const description = `${list.title} — a ${list.kind === "nft" ? "NFT" : "currency"} tier list.`;
  return {
    title: list.title,
    description,
    openGraph: { title: list.title, description },
    twitter: { card: "summary_large_image", title: list.title, description },
  };
}

export default async function ListPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const list = await getPublishedList(slug);
  if (!list) notFound();
  const session = await auth();
  const viewer = session?.user
    ? { id: session.user.id, name: session.user.name, image: session.user.image }
    : null;
  const rows = Object.fromEntries(TIERS.map((tier) => [tier, [] as Array<{ asset: (typeof list.items)[number]["asset"] }>])) as Record<
    Tier,
    Array<{ asset: (typeof list.items)[number]["asset"] }>
  >;
  for (const item of list.items) {
    if (isTier(item.tier)) rows[item.tier].push({ asset: item.asset });
  }
  const url = `${await requestOrigin()}/l/${list.slug}`;
  const author = list.authorHandle ? `@${list.authorHandle}` : list.authorName;

  return (
    <div className="min-h-screen bg-black">
      <SiteHeader viewer={viewer} />
      <main className="mx-auto flex max-w-6xl flex-col gap-5 px-4 py-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">
              {list.kind === "nft" ? "Non-fungible" : "Fungible"}
              {author ? ` · ${author}` : ""}
            </p>
            <h1 className="text-2xl font-semibold text-cyan-300">{list.title}</h1>
          </div>
          <div className="flex items-center gap-2">
            <CopyLink url={url} />
            {list.tweetId ? (
              <a
                href={`https://x.com/i/web/status/${list.tweetId}`}
                className="rounded-md bg-white px-3 py-1.5 text-sm font-semibold text-black"
                target="_blank"
                rel="noreferrer"
              >
                View on X
              </a>
            ) : null}
            <Link href="/" className="rounded-md border border-white/15 px-3 py-1.5 text-sm text-zinc-200">
              Make your own
            </Link>
          </div>
        </div>
        <TierView rows={rows} />
      </main>
    </div>
  );
}
