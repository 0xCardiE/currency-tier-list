import { TIERS, isTier, type Tier } from "@/lib/constants";
import { getPublishedList } from "@/lib/lists";
import { tierListImage } from "@/lib/tier-image";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Tier list preview";

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const list = await getPublishedList(slug);
  const title = list?.title ?? "Currency Tier List";
  const grouped = Object.fromEntries(TIERS.map((tier) => [tier, [] as string[]])) as Record<Tier, string[]>;
  for (const item of list?.items ?? []) {
    if (isTier(item.tier)) grouped[item.tier].push(item.asset.symbol);
  }
  return tierListImage(title, grouped);
}
