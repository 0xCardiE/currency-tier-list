import { auth } from "@/auth";
import { MIN_RANKED, TIERS, isKind, isTier, type RankedItem, type Tier } from "@/lib/constants";
import { markPublished, saveList } from "@/lib/lists";
import { tierListPng } from "@/lib/tier-image";
import { postTierListTweet, tweetText } from "@/lib/twitter";
import { requestOrigin } from "@/lib/origin";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Sign in with X first." }, { status: 401 });
  }
  const body = (await request.json()) as {
    kind?: string;
    title?: string;
    share?: string;
    items?: Array<{ assetId?: string; tier?: string }>;
  };
  if (!isKind(body.kind)) return Response.json({ error: "Choose currencies or NFTs." }, { status: 400 });
  if (body.share !== "image" && body.share !== "link") {
    return Response.json({ error: "Choose an image or a link." }, { status: 400 });
  }

  const items: RankedItem[] = [];
  for (const item of body.items ?? []) {
    if (!item.assetId || !item.tier || !isTier(item.tier)) {
      return Response.json({ error: "Invalid placement." }, { status: 400 });
    }
    items.push({ assetId: item.assetId, tier: item.tier });
  }
  if (items.length < MIN_RANKED) {
    return Response.json(
      { error: `Rank at least ${MIN_RANKED} before posting.` },
      { status: 400 },
    );
  }

  const saved = await saveList({
    userId: session.user.id,
    authorName: session.user.name ?? null,
    authorImage: session.user.image ?? null,
    kind: body.kind,
    title: body.title ?? "",
    items,
  });
  if ("error" in saved && saved.error) {
    return Response.json({ error: saved.error }, { status: 400 });
  }
  if (!("list" in saved) || !saved.list) {
    return Response.json({ error: "Could not save the list." }, { status: 500 });
  }

  let tweetUrl: string | null = null;
  let tweetError: string | null = null;
  let handle: string | null = null;
  let name: string | null = null;
  let image: string | null = null;
  let tweetId: string | null = null;
  const origin = await requestOrigin();
  try {
    const groups = Object.fromEntries(TIERS.map((tier) => [tier, [] as string[]])) as Record<Tier, string[]>;
    for (const item of saved.list.items) {
      if (isTier(item.tier)) groups[item.tier].push(item.asset.symbol);
    }
    const png = body.share === "image" ? await tierListPng(saved.list.title, groups) : undefined;
    const tweet = await postTierListTweet(
      session.user.id,
      tweetText(body.kind, saved.list.title, saved.list.slug, body.share, origin),
      png,
    );
    tweetId = tweet.tweetId;
    handle = tweet.handle;
    name = tweet.name;
    image = tweet.image;
    tweetUrl = `https://x.com/i/web/status/${tweet.tweetId}`;
  } catch (error) {
    tweetError = error instanceof Error ? error.message : "Could not post to X.";
  }

  await markPublished(saved.list.id, { tweetId, handle, name, image });
  const url = `${origin}/l/${saved.list.slug}`;
  return Response.json({ slug: saved.list.slug, url, tweetUrl, tweetError });
}
