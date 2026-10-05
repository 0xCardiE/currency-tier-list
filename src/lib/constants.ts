export const TIERS = ["S", "A", "B", "C", "D"] as const;
export type Tier = (typeof TIERS)[number];
export type Kind = "fungible" | "nft";
export type Container = Tier | "pool";

export const CONTAINERS: Container[] = ["S", "A", "B", "C", "D", "pool"];
export const MIN_RANKED = 15;
export const MAX_ON_LIST = 50;

export const TIER_COLOR: Record<Tier, string> = {
  S: "#e15d57",
  A: "#f08c2c",
  B: "#e6c229",
  C: "#3fbe56",
  D: "#3d7ef0",
};

export const TIER_POINTS: Record<Tier, number> = {
  S: 5,
  A: 4,
  B: 3,
  C: 2,
  D: 1,
};

export function isKind(value: string | undefined | null): value is Kind {
  return value === "fungible" || value === "nft";
}

export function isTier(value: string): value is Tier {
  return (TIERS as readonly string[]).includes(value);
}

export function isContainer(value: string): value is Container {
  return (CONTAINERS as readonly string[]).includes(value);
}

export function defaultTitle(kind: Kind) {
  return kind === "nft" ? "My NFT Tier List" : "My Currency Tier List";
}

export function kindLabel(kind: Kind) {
  return kind === "nft" ? "NFTs" : "Currencies";
}

export function kindNoun(kind: Kind, count: number) {
  if (kind === "nft") return count === 1 ? "NFT" : "NFTs";
  return count === 1 ? "currency" : "currencies";
}

export function formatPlatform(platform: string | null) {
  if (!platform) return null;
  return platform.replace(/-/g, " ");
}

export function baseUrl() {
  const raw = process.env.AUTH_URL || process.env.NEXTAUTH_URL || "http://localhost:3000";
  return raw.replace(/\/$/, "");
}

export type Asset = {
  id: string;
  kind: Kind;
  externalId: string;
  name: string;
  symbol: string;
  platform: string | null;
};

export type RankedItem = {
  assetId: string;
  tier: Tier;
};
