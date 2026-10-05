import { readFileSync } from "node:fs";
import { Pool } from "pg";
import { isNotInvestable, loadExcludedIds } from "./investable.mjs";

const key = process.env.COINGECKO_API_KEY;
const appUrl = process.env.DATABASE_APP_URL;
const authUrl = process.env.DATABASE_AUTH_URL;

if (!key || !appUrl || !authUrl) {
  console.error("Missing COINGECKO_API_KEY, DATABASE_APP_URL, or DATABASE_AUTH_URL");
  process.exit(1);
}

const authPool = new Pool({
  connectionString: authUrl,
  options: "-c search_path=tierlist",
});
const appPool = new Pool({
  connectionString: appUrl,
  options: "-c search_path=tierlist",
});

async function cg(path) {
  const response = await fetch(`https://pro-api.coingecko.com/api/v3${path}`, {
    headers: { "x-cg-pro-api-key": key },
  });
  if (!response.ok) {
    throw new Error(`${path} -> ${response.status} ${await response.text()}`);
  }
  return response.json();
}

async function download(url) {
  if (!url) return null;
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const bytes = Buffer.from(await response.arrayBuffer());
    if (!bytes.length || bytes.length > 1_500_000) return null;
    const contentType = (response.headers.get("content-type") || "image/png").split(";")[0];
    if (!contentType.startsWith("image/")) return null;
    return { bytes, contentType };
  } catch {
    return null;
  }
}

async function mapPool(items, limit, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  async function run() {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await worker(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: limit }, run));
  return results;
}

async function main() {
  await authPool.query(readFileSync(new URL("./schema.sql", import.meta.url), "utf8"));
  await appPool.query(readFileSync(new URL("./app-schema.sql", import.meta.url), "utf8"));
  console.log("Schema ready");

  const excluded = await loadExcludedIds(cg);
  console.log(`Skipping ${excluded.size} stablecoins and wrapped tokens`);

  const coins = [];
  const seenCoins = new Set();
  for (let page = 1; page <= 40 && coins.length < 2000; page += 1) {
    const batch = await cg(
      `/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=250&page=${page}&sparkline=false`,
    );
    if (!Array.isArray(batch) || batch.length === 0) break;
    for (const coin of batch) {
      if (seenCoins.has(coin.id) || isNotInvestable(coin, excluded)) continue;
      seenCoins.add(coin.id);
      coins.push(coin);
      if (coins.length >= 2000) break;
    }
    console.log(`  coins page ${page}: ${coins.length} investable`);
    if (batch.length < 250) break;
  }

  const nfts = [];
  const seenNfts = new Set();
  for (let page = 1; page <= 8 && nfts.length < 1000; page += 1) {
    let batch;
    try {
      batch = await cg(`/nfts/markets?per_page=250&page=${page}`);
    } catch (error) {
      console.warn(`NFT page ${page} failed`, error.message);
      break;
    }
    if (!Array.isArray(batch) || batch.length === 0) break;
    for (const nft of batch) {
      if (seenNfts.has(nft.id)) continue;
      seenNfts.add(nft.id);
      nfts.push(nft);
      if (nfts.length >= 1000) break;
    }
    console.log(`  nfts page ${page}: ${nfts.length}`);
    if (batch.length < 250) break;
  }

  const records = [
    ...coins.map((coin) => ({
      kind: "fungible",
      externalId: coin.id,
      name: coin.name,
      symbol: String(coin.symbol || coin.name).toUpperCase(),
      platform: null,
      rank: coin.market_cap_rank ?? null,
      imageUrl: coin.image ? String(coin.image).replace("/large/", "/small/") : null,
    })),
    ...nfts.map((nft, index) => ({
      kind: "nft",
      externalId: nft.id,
      name: nft.name,
      symbol: String(nft.symbol || nft.name).slice(0, 12).toUpperCase(),
      platform: nft.asset_platform_id ?? null,
      rank: index + 1,
      imageUrl: nft.image?.small_2x || nft.image?.small || null,
    })),
  ];

  const stored = await appPool.query(
    `SELECT kind, external_id FROM assets WHERE image_bytes IS NOT NULL`,
  );
  const haveLogo = new Set(stored.rows.map((row) => `${row.kind}:${row.external_id}`));
  const missing = records.filter((record) => !haveLogo.has(`${record.kind}:${record.externalId}`));
  console.log(`Downloading ${missing.length} new logos (${records.length - missing.length} already stored)...`);
  let done = 0;
  const downloaded = await mapPool(missing, 20, async (record) => {
    const image = await download(record.imageUrl);
    done += 1;
    if (done % 50 === 0 || done === missing.length) {
      console.log(`  logos ${done}/${missing.length}`);
    }
    return { ...record, image };
  });
  const withImages = [
    ...records.filter((record) => haveLogo.has(`${record.kind}:${record.externalId}`)).map((record) => ({
      ...record,
      image: null,
    })),
    ...downloaded,
  ];

  const client = await appPool.connect();
  try {
    await client.query("BEGIN");
    for (const record of withImages) {
      await client.query(
        `INSERT INTO assets (
           id, kind, external_id, name, symbol, platform, rank, image_url, content_type, image_bytes
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         ON CONFLICT (id) DO UPDATE SET
           name = EXCLUDED.name,
           symbol = EXCLUDED.symbol,
           platform = EXCLUDED.platform,
           rank = EXCLUDED.rank,
           image_url = EXCLUDED.image_url,
           content_type = COALESCE(EXCLUDED.content_type, assets.content_type),
           image_bytes = COALESCE(EXCLUDED.image_bytes, assets.image_bytes)`,
        [
          `${record.kind}:${record.externalId}`,
          record.kind,
          record.externalId,
          record.name,
          record.symbol,
          record.platform,
          record.rank,
          record.imageUrl,
          record.image?.contentType ?? null,
          record.image?.bytes ?? null,
        ],
      );
    }
    const existing = await client.query(
      `SELECT id, external_id, name FROM assets WHERE kind = 'fungible'`,
    );
    const removeIds = existing.rows
      .filter((row) => isNotInvestable({ id: row.external_id, name: row.name }, excluded))
      .map((row) => row.id);
    if (removeIds.length) {
      await client.query(`DELETE FROM list_items WHERE asset_id = ANY($1::text[])`, [removeIds]);
      await client.query(`DELETE FROM assets WHERE id = ANY($1::text[])`, [removeIds]);
      console.log(`Removed ${removeIds.length} stablecoins and wrapped tokens`);
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  const counts = await appPool.query(
    `SELECT kind, COUNT(*)::int AS count,
            COUNT(image_bytes)::int AS with_logo
     FROM assets GROUP BY kind ORDER BY kind`,
  );
  console.table(counts.rows);
  await authPool.end();
  await appPool.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
