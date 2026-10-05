import { appPool } from "@/lib/db";
import type { Asset, Kind } from "@/lib/constants";

type AssetRow = {
  id: string;
  kind: Kind;
  external_id: string;
  name: string;
  symbol: string;
  platform: string | null;
};

export function mapAsset(row: AssetRow): Asset {
  return {
    id: row.id,
    kind: row.kind,
    externalId: row.external_id,
    name: row.name,
    symbol: row.symbol,
    platform: row.platform,
  };
}

export async function searchAssets(kind: Kind) {
  const result = await appPool.query<AssetRow>(
    `SELECT id, kind, external_id, name, symbol, platform
     FROM assets
     WHERE kind = $1
     ORDER BY rank ASC NULLS LAST, name ASC`,
    [kind],
  );
  return result.rows.map(mapAsset);
}
