const SKIP_CATEGORIES = [
  "stablecoins",
  "wrapped-tokens",
  "bridged-tokens",
  "yield-bearing-stablecoins",
  "bridged-stablecoins",
  "usd-stablecoin",
  "eur-stablecoin",
  "crypto-backed-stablecoin",
  "fiat-backed-stablecoin",
  "algorithmic-stablecoin",
  "commodity-backed-stablecoin",
  "us-treasury-backed-stablecoin",
];

export async function loadExcludedIds(cg) {
  const ids = new Set();
  for (const category of SKIP_CATEGORIES) {
    for (let page = 1; page <= 6; page += 1) {
      let rows = [];
      try {
        rows = await cg(
          `/coins/markets?vs_currency=usd&category=${category}&order=market_cap_desc&per_page=250&page=${page}&sparkline=false`,
        );
      } catch (error) {
        console.warn(`Skip ${category} page ${page}: ${error.message}`);
        break;
      }
      if (!Array.isArray(rows) || rows.length === 0) break;
      for (const row of rows) ids.add(row.id);
      if (rows.length < 250) break;
    }
  }
  return ids;
}

export function isNotInvestable(coin, excludedIds) {
  const id = String(coin.id || "").toLowerCase();
  const name = String(coin.name || "").toLowerCase();
  if (excludedIds.has(coin.id) || excludedIds.has(id)) return true;
  if (id.startsWith("wrapped-") || id.includes("-wrapped-")) return true;
  if (/\bwrapped\b/.test(name)) return true;
  if (name.includes("stablecoin")) return true;
  return false;
}
