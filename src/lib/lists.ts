import { randomBytes } from "node:crypto";
import { appPool } from "@/lib/db";
import { mapAsset } from "@/lib/assets";
import {
  CONTAINERS,
  MAX_ON_LIST,
  MIN_RANKED,
  TIERS,
  TIER_POINTS,
  defaultTitle,
  isContainer,
  type Asset,
  type Container,
  type Kind,
  type Tier,
} from "@/lib/constants";

export type StoredList = {
  id: string;
  slug: string;
  title: string;
  kind: Kind;
  published: boolean;
  tweetId: string | null;
  authorName: string | null;
  authorHandle: string | null;
  authorImage: string | null;
  updatedAt: string;
  items: Array<{ assetId: string; tier: Container; asset: Asset; position: number }>;
};

type ListRow = {
  id: string;
  slug: string;
  title: string;
  kind: Kind;
  published: boolean;
  tweet_id: string | null;
  author_name: string | null;
  author_handle: string | null;
  author_image: string | null;
  updated_at: Date;
};

function makeSlug() {
  return randomBytes(6).toString("base64url");
}

export function placementError(items: Array<{ assetId: string; tier: string }>, published: boolean) {
  if (items.length > MAX_ON_LIST) return `A list can hold at most ${MAX_ON_LIST}.`;
  const ids = new Set(items.map((item) => item.assetId));
  if (ids.size !== items.length) return "Each coin can only appear once.";
  if (items.some((item) => !isContainer(item.tier))) return "Unknown tier.";
  const ranked = items.filter((item) => item.tier !== "pool").length;
  if (published && ranked < MIN_RANKED) {
    return `A posted list needs at least ${MIN_RANKED}.`;
  }
  return null;
}

async function loadItems(listId: string) {
  const result = await appPool.query(
    `SELECT li.asset_id, li.tier, li.position,
            a.id, a.kind, a.external_id, a.name, a.symbol, a.platform
     FROM list_items li
     JOIN assets a ON a.id = li.asset_id
     WHERE li.list_id = $1
     ORDER BY li.position ASC`,
    [listId],
  );
  return result.rows.map((row) => ({
    assetId: row.asset_id as string,
    tier: row.tier as Container,
    position: row.position as number,
    asset: mapAsset(row),
  }));
}

function toStored(row: ListRow, items: StoredList["items"]): StoredList {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    kind: row.kind,
    published: row.published,
    tweetId: row.tweet_id,
    authorName: row.author_name,
    authorHandle: row.author_handle,
    authorImage: row.author_image,
    updatedAt: row.updated_at.toISOString(),
    items,
  };
}

export async function getOwnList(userId: string, kind: Kind) {
  const result = await appPool.query<ListRow>(
    `SELECT id, slug, title, kind, published, tweet_id, author_name, author_handle, author_image, updated_at
     FROM lists WHERE user_id = $1 AND kind = $2`,
    [userId, kind],
  );
  const row = result.rows[0];
  if (!row) return null;
  return toStored(row, await loadItems(row.id));
}

export async function getPublishedList(slug: string) {
  const result = await appPool.query<ListRow>(
    `SELECT id, slug, title, kind, published, tweet_id, author_name, author_handle, author_image, updated_at
     FROM lists WHERE slug = $1 AND published = true`,
    [slug],
  );
  const row = result.rows[0];
  if (!row) return null;
  return toStored(row, await loadItems(row.id));
}

export async function saveList(input: {
  userId: string;
  authorName: string | null;
  authorImage: string | null;
  kind: Kind;
  title: string;
  items: Array<{ assetId: string; tier: Container }>;
}) {
  const existing = await appPool.query<{ published: boolean }>(
    `SELECT published FROM lists WHERE user_id = $1 AND kind = $2`,
    [input.userId, input.kind],
  );
  const published = existing.rows[0]?.published ?? false;
  const error = placementError(input.items, published);
  if (error) return { error };

  const ids = input.items.map((item) => item.assetId);
  if (ids.length) {
    const found = await appPool.query(
      `SELECT id FROM assets WHERE kind = $1 AND id = ANY($2::text[])`,
      [input.kind, ids],
    );
    if (found.rowCount !== ids.length) {
      return { error: "Some entries are not in this catalog." };
    }
  }

  const client = await appPool.connect();
  try {
    await client.query("BEGIN");
    const title = input.title.trim().slice(0, 80) || defaultTitle(input.kind);
    const upsert = await client.query<ListRow>(
      `INSERT INTO lists (user_id, kind, title, slug, author_name, author_image)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (user_id, kind) DO UPDATE SET
         title = EXCLUDED.title,
         author_name = COALESCE(EXCLUDED.author_name, lists.author_name),
         author_image = COALESCE(EXCLUDED.author_image, lists.author_image),
         updated_at = now()
       RETURNING id, slug, title, kind, published, tweet_id, author_name, author_handle, author_image, updated_at`,
      [input.userId, input.kind, title, makeSlug(), input.authorName, input.authorImage],
    );
    const list = upsert.rows[0];
    await client.query(`DELETE FROM list_items WHERE list_id = $1`, [list.id]);
    const grouped = new Map<Container, Array<{ assetId: string; tier: Container }>>();
    for (const tier of CONTAINERS) grouped.set(tier, []);
    for (const item of input.items) grouped.get(item.tier)?.push(item);
    for (const tier of CONTAINERS) {
      const group = grouped.get(tier) ?? [];
      for (let position = 0; position < group.length; position += 1) {
        await client.query(
          `INSERT INTO list_items (list_id, asset_id, tier, position) VALUES ($1, $2, $3, $4)`,
          [list.id, group[position].assetId, tier, position],
        );
      }
    }
    await client.query("COMMIT");
    return { list: toStored(list, await loadItems(list.id)) };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function markPublished(
  listId: string,
  meta: { tweetId?: string | null; handle?: string | null; name?: string | null; image?: string | null },
) {
  await appPool.query(
    `UPDATE lists SET
       published = true,
       tweet_id = COALESCE($2, tweet_id),
       author_handle = COALESCE($3, author_handle),
       author_name = COALESCE($4, author_name),
       author_image = COALESCE($5, author_image),
       updated_at = now()
     WHERE id = $1`,
    [listId, meta.tweetId ?? null, meta.handle ?? null, meta.name ?? null, meta.image ?? null],
  );
}

export type ProjectScore = {
  asset: Asset;
  score: number;
  counts: Record<Tier, number>;
};

export async function getConsensus(kind: Kind) {
  const [counts, placements] = await Promise.all([
    appPool.query<{ count: string }>(
      `SELECT COUNT(*)::int AS count FROM lists WHERE published = true AND kind = $1`,
      [kind],
    ),
    appPool.query(
      `SELECT li.asset_id, li.tier, COUNT(*)::int AS votes,
              a.id, a.kind, a.external_id, a.name, a.symbol, a.platform
       FROM list_items li
       JOIN lists l ON l.id = li.list_id
       JOIN assets a ON a.id = li.asset_id
       WHERE l.published = true AND l.kind = $1 AND li.tier <> 'pool'
       GROUP BY li.asset_id, li.tier, a.id, a.kind, a.external_id, a.name, a.symbol, a.platform`,
      [kind],
    ),
  ]);

  const byAsset = new Map<string, { asset: Asset; counts: Record<Tier, number> }>();
  for (const row of placements.rows) {
    const current = byAsset.get(row.asset_id) ?? {
      asset: mapAsset(row),
      counts: { S: 0, A: 0, B: 0, C: 0, D: 0 },
    };
    current.counts[row.tier as Tier] = row.votes;
    byAsset.set(row.asset_id, current);
  }

  const ranked: ProjectScore[] = [];
  for (const entry of byAsset.values()) {
    let score = 0;
    for (const tier of TIERS) score += entry.counts[tier] * TIER_POINTS[tier];
    ranked.push({ asset: entry.asset, score, counts: entry.counts });
  }
  ranked.sort(
    (a, b) =>
      b.score - a.score ||
      b.counts.S - a.counts.S ||
      b.counts.A - a.counts.A ||
      a.asset.name.localeCompare(b.asset.name),
  );

  const recent = await appPool.query(
    `SELECT slug, title, kind, author_name, author_handle, updated_at
     FROM lists
     WHERE published = true AND kind = $1
     ORDER BY updated_at DESC
     LIMIT 12`,
    [kind],
  );

  return {
    listCount: Number(counts.rows[0]?.count ?? 0),
    ranked,
    recent: recent.rows.map((row) => ({
      slug: row.slug as string,
      title: row.title as string,
      kind: row.kind as Kind,
      authorName: (row.author_name as string | null) ?? null,
      authorHandle: (row.author_handle as string | null) ?? null,
      updatedAt: (row.updated_at as Date).toISOString(),
    })),
  };
}
