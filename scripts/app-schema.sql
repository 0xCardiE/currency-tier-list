-- App data lives in lp_app, in its own schema so the existing research tables stay untouched.
CREATE SCHEMA IF NOT EXISTS tierlist;
SET search_path TO tierlist;

CREATE TABLE IF NOT EXISTS assets (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('fungible', 'nft')),
  external_id TEXT NOT NULL,
  name TEXT NOT NULL,
  symbol TEXT NOT NULL,
  platform TEXT,
  rank INTEGER,
  image_url TEXT,
  content_type TEXT,
  image_bytes BYTEA,
  UNIQUE (kind, external_id)
);

CREATE INDEX IF NOT EXISTS assets_kind_rank_idx ON assets (kind, rank);

CREATE TABLE IF NOT EXISTS lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  author_name TEXT,
  author_handle TEXT,
  author_image TEXT,
  kind TEXT NOT NULL CHECK (kind IN ('fungible', 'nft')),
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  published BOOLEAN NOT NULL DEFAULT FALSE,
  tweet_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, kind)
);

CREATE INDEX IF NOT EXISTS lists_published_kind_idx ON lists (kind, published, updated_at DESC);

CREATE TABLE IF NOT EXISTS list_items (
  list_id UUID NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
  asset_id TEXT NOT NULL REFERENCES assets(id),
  tier TEXT NOT NULL CHECK (tier IN ('S', 'A', 'B', 'C', 'D', 'pool')),
  position INTEGER NOT NULL,
  PRIMARY KEY (list_id, asset_id)
);
