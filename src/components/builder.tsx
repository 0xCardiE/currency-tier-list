"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  rectIntersection,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { SiteHeader, type Viewer } from "@/components/site-header";
import { CoinFace } from "@/components/coin-face";
import { Logo } from "@/components/logo";
import { signInWithX } from "@/app/actions";
import {
  CONTAINERS,
  MAX_ON_LIST,
  MIN_RANKED,
  TIERS,
  TIER_COLOR,
  defaultTitle,
  kindNoun,
  type Asset,
  type Container,
  type Kind,
  type Tier,
} from "@/lib/constants";

type Draft = {
  title: string;
  containers: Record<Container, string[]>;
  assets: Record<string, Asset>;
  slug: string | null;
  published: boolean;
  tweetId: string | null;
};

type ServerList = {
  slug: string;
  title: string;
  published: boolean;
  tweetId: string | null;
  items: Array<{ assetId: string; tier: Container; asset: Asset }>;
};

const STORAGE_KEY = "currency-tier-list:v1";

function emptyContainers(): Record<Container, string[]> {
  return { S: [], A: [], B: [], C: [], D: [], pool: [] };
}

function emptyDraft(kind: Kind): Draft {
  return {
    title: defaultTitle(kind),
    containers: emptyContainers(),
    assets: {},
    slug: null,
    published: false,
    tweetId: null,
  };
}

function rankedItems(draft: Draft) {
  return TIERS.flatMap((tier) => draft.containers[tier].map((assetId) => ({ assetId, tier })));
}

function placedItems(draft: Draft) {
  return CONTAINERS.flatMap((tier) => draft.containers[tier].map((assetId) => ({ assetId, tier })));
}

function totalCount(draft: Draft) {
  return CONTAINERS.reduce((sum, key) => sum + draft.containers[key].length, 0);
}

function containerOf(draft: Draft, id: string): Container | null {
  for (const key of CONTAINERS) {
    if (draft.containers[key].includes(id)) return key;
  }
  return null;
}

function readLocal(): Record<Kind, Draft> | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<Kind, Draft>;
    if (!parsed.fungible || !parsed.nft) return null;
    return parsed;
  } catch {
    return null;
  }
}

function draftFromServer(list: ServerList, kind: Kind): Draft {
  const containers = emptyContainers();
  const assets: Record<string, Asset> = {};
  for (const item of list.items) {
    containers[item.tier].push(item.assetId);
    assets[item.assetId] = item.asset;
  }
  return {
    title: list.title || defaultTitle(kind),
    containers,
    assets,
    slug: list.slug,
    published: list.published,
    tweetId: list.tweetId,
  };
}

const collisionDetection: CollisionDetection = (args) => {
  const hits = pointerWithin(args);
  return hits.length ? hits : rectIntersection(args);
};

export function Builder({ viewer, authUnavailable }: { viewer: Viewer | null; authUnavailable?: boolean }) {
  const [kind, setKind] = useState<Kind>("fungible");
  const [drafts, setDrafts] = useState<Record<Kind, Draft>>({
    fungible: emptyDraft("fungible"),
    nft: emptyDraft("nft"),
  });
  const [ready, setReady] = useState(false);
  const [query, setQuery] = useState("");
  const [catalog, setCatalog] = useState<Asset[]>([]);
  const [catalogError, setCatalogError] = useState(false);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [posting, setPosting] = useState<"image" | "link" | null>(null);
  const [share, setShare] = useState<{
    mode: "image" | "link";
    url: string;
    tweetUrl: string | null;
    tweetError: string | null;
  } | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [stuckId, setStuckId] = useState<string | null>(null);

  useEffect(() => {
    if (!stuckId) return;
    const timer = setTimeout(() => setStuckId(null), 720);
    return () => clearTimeout(timer);
  }, [stuckId]);

  const draftsRef = useRef(drafts);
  const kindRef = useRef(kind);
  useEffect(() => {
    draftsRef.current = drafts;
    kindRef.current = kind;
  }, [drafts, kind]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  useEffect(() => {
    let cancelled = false;
    async function hydrate() {
      const local = readLocal();
      const base: Record<Kind, Draft> = {
        fungible: local?.fungible ?? emptyDraft("fungible"),
        nft: local?.nft ?? emptyDraft("nft"),
      };
      if (viewer) {
        const [fungible, nft] = await Promise.all([loadOwn("fungible"), loadOwn("nft")]);
        if (!cancelled) {
          base.fungible = pickDraft("fungible", fungible, base.fungible);
          base.nft = pickDraft("nft", nft, base.nft);
        }
      }
      if (!cancelled) {
        setDrafts(base);
        setReady(true);
      }
    }
    void hydrate();
    return () => {
      cancelled = true;
    };
  }, [viewer]);

  useEffect(() => {
    if (!ready) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(drafts));
  }, [drafts, ready]);

  async function persist(target: Kind, draft: Draft) {
    const response = await fetch("/api/lists", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: target, title: draft.title, items: placedItems(draft) }),
    });
    const data = (await response.json()) as { error?: string; list?: { slug: string; published: boolean } };
    if (!response.ok) {
      setNotice(data.error ?? "Could not save.");
      return;
    }
    const slug = data.list?.slug;
    if (!slug) return;
    setDrafts((prev) => {
      if (prev[target].slug === slug) return prev;
      return { ...prev, [target]: { ...prev[target], slug } };
    });
  }

  useEffect(() => {
    if (!ready || !viewer) return;
    const timer = setTimeout(() => {
      for (const target of ["fungible", "nft"] as const) {
        const draft = drafts[target];
        const placed = placedItems(draft);
        const ranked = placed.filter((item) => item.tier !== "pool");
        if (draft.published && ranked.length < MIN_RANKED) continue;
        if (placed.length === 0 && !draft.slug) continue;
        void persist(target, draft);
      }
    }, 700);
    return () => clearTimeout(timer);
  }, [drafts, ready, viewer]);

  const catalogKey = kind;
  const catalogState: "loading" | "ready" | "error" =
    loadedKey === catalogKey ? (catalogError ? "error" : "ready") : "loading";

  useEffect(() => {
    let cancelled = false;
    const key = kind;
    fetch(`/api/assets?kind=${kind}`)
      .then(async (response) => {
        if (!response.ok) throw new Error("catalog");
        return response.json() as Promise<{ assets: Asset[] }>;
      })
      .then((data) => {
        if (cancelled) return;
        setCatalog(data.assets);
        setCatalogError(false);
        setLoadedKey(key);
      })
      .catch(() => {
        if (cancelled) return;
        setCatalogError(true);
        setLoadedKey(key);
      });
    return () => {
      cancelled = true;
    };
  }, [kind]);

  function place(assetId: string, to: Container) {
    const currentKind = kindRef.current;
    const draft = draftsRef.current[currentKind];
    const asset = catalog.find((item) => item.id === assetId) ?? draft.assets[assetId];
    if (!asset) return;
    const exists = containerOf(draft, assetId);
    if (exists) {
      if (exists === to) return;
      moveExisting(assetId, exists, to, to);
      return;
    }
    if (totalCount(draft) >= MAX_ON_LIST) {
      setNotice(`A list holds at most ${MAX_ON_LIST} ${kindNoun(currentKind, MAX_ON_LIST)}.`);
      return;
    }
    setNotice(null);
    setStuckId(asset.id);
    setDrafts((prev) => {
      const next = prev[currentKind];
      return {
        ...prev,
        [currentKind]: {
          ...next,
          assets: { ...next.assets, [asset.id]: asset },
          containers: { ...next.containers, [to]: [...next.containers[to], asset.id] },
        },
      };
    });
  }

  function moveExisting(assetId: string, from: Container, to: Container, overId: string) {
    setNotice(null);
    const currentKind = kindRef.current;
    setDrafts((prev) => {
      const draft = prev[currentKind];
      const fromItems = draft.containers[from].filter((id) => id !== assetId);
      const toItems = from === to ? fromItems : [...draft.containers[to]];
      let index = toItems.indexOf(overId);
      if (index < 0) index = toItems.length;
      toItems.splice(index, 0, assetId);
      return {
        ...prev,
        [currentKind]: {
          ...draft,
          containers: {
            ...draft.containers,
            [from]: from === to ? toItems : fromItems,
            [to]: toItems,
          },
        },
      };
    });
  }

  function remove(assetId: string) {
    const currentKind = kindRef.current;
    setDrafts((prev) => {
      const draft = prev[currentKind];
      const containers = { ...draft.containers };
      for (const key of CONTAINERS) containers[key] = containers[key].filter((id) => id !== assetId);
      return { ...prev, [currentKind]: { ...draft, containers } };
    });
  }

  function onDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const over = event.over;
    if (!over) return;
    const overId = String(over.id);
    const draft = draftsRef.current[kindRef.current];
    const to = (CONTAINERS as string[]).includes(overId)
      ? (overId as Container)
      : containerOf(draft, overId);
    if (!to) return;
    const active = String(event.active.id);
    if (active.startsWith("pick:")) {
      place(active.slice(5), to);
      return;
    }
    const from = containerOf(draft, active);
    if (!from) return;
    moveExisting(active, from, to, overId);
  }

  async function publish(mode: "image" | "link") {
    const draft = draftsRef.current[kind];
    if (draft.containers.pool.length) {
      setNotice(`Rank the ${draft.containers.pool.length} still in the pool before posting.`);
      return;
    }
    const items = rankedItems(draft);
    if (items.length < MIN_RANKED || items.length > MAX_ON_LIST) {
      setNotice(`Post between ${MIN_RANKED} and ${MAX_ON_LIST} ${kindNoun(kind, items.length)}.`);
      return;
    }
    setPosting(mode);
    setNotice(null);
    setShare(null);
    try {
      const response = await fetch("/api/lists/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, title: draft.title, items, share: mode }),
      });
      const data = (await response.json()) as {
        error?: string;
        url?: string;
        tweetUrl?: string | null;
        tweetError?: string | null;
        slug?: string;
      };
      if (!response.ok || !data.url || !data.slug) {
        setNotice(data.error ?? "Could not post the list.");
        return;
      }
      setDrafts((prev) => ({
        ...prev,
        [kind]: { ...prev[kind], slug: data.slug ?? prev[kind].slug, published: true },
      }));
      setShare({
        mode,
        url: data.url,
        tweetUrl: data.tweetUrl ?? null,
        tweetError: data.tweetError ?? null,
      });
    } finally {
      setPosting(null);
    }
  }

  const draft = drafts[kind];
  const pool = draft.containers.pool.length;
  const activeAsset = useMemo(() => {
    if (!activeId) return null;
    const id = activeId.startsWith("pick:") ? activeId.slice(5) : activeId;
    return draft.assets[id] ?? catalog.find((asset) => asset.id === id) ?? null;
  }, [activeId, catalog, draft.assets]);

  const placed = new Set(CONTAINERS.flatMap((key) => draft.containers[key]));
  const subject = kind === "nft" ? "NFT collections" : "currencies";
  const visibleCatalog = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return catalog;
    return catalog.filter(
      (asset) =>
        asset.name.toLowerCase().includes(term) ||
        asset.symbol.toLowerCase().includes(term) ||
        asset.externalId.toLowerCase().includes(term),
    );
  }, [catalog, query]);

  return (
    <div className="min-h-screen bg-black text-zinc-100">
      <SiteHeader
        viewer={viewer}
        kind={kind}
        onKindChange={(next) => {
          setKind(next);
          setQuery("");
          setNotice(null);
          setShare(null);
        }}
      />
      <main className="flex w-full flex-col lg:h-[calc(100dvh-4.25rem)] lg:flex-row lg:overflow-hidden">
        <DndContext
          sensors={sensors}
          collisionDetection={collisionDetection}
          onDragStart={(event) => setActiveId(String(event.active.id))}
          onDragCancel={() => setActiveId(null)}
          onDragEnd={onDragEnd}
        >
        <div className="flex min-w-0 flex-1 flex-col gap-4 px-3 py-4 lg:overflow-y-auto lg:px-5">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="min-w-0 flex-1">
              <label className="sr-only" htmlFor="list-title">
                List title
              </label>
              <input
                id="list-title"
                value={draft.title}
                onChange={(event) =>
                  setDrafts((prev) => ({ ...prev, [kind]: { ...prev[kind], title: event.target.value } }))
                }
                className="w-full bg-transparent text-2xl font-semibold tracking-tight text-cyan-300 outline-none"
              />
            </div>
            <PostButton viewer={viewer} posting={posting} onPublish={(mode) => void publish(mode)} />
          </div>

          {authUnavailable ? (
            <p className="rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-sm text-amber-100">
              Sign in with X is not available.
            </p>
          ) : null}
          {notice ? (
            <p className="rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-sm text-amber-100">
              {notice}
            </p>
          ) : null}
          {share?.tweetError ? (
            <p className="rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-sm text-amber-100">
              {share.tweetError}
            </p>
          ) : share?.tweetUrl ? (
            <p className="rounded-lg border border-cyan-400/30 bg-cyan-400/10 px-3 py-2 text-sm text-cyan-50">
              <a className="underline" href={share.tweetUrl} target="_blank" rel="noreferrer">
                View on X
              </a>
              {share.mode === "link" ? (
                <>
                  {" · "}
                  <a className="underline" href={share.url}>
                    Your list
                  </a>{" "}
                  stays at this link and updates when you edit it.
                </>
              ) : null}
            </p>
          ) : null}

            <section className="overflow-hidden rounded-md border border-white/10" aria-label="Tiers">
              {TIERS.map((tier) => (
                <TierLane
                  key={tier}
                  tier={tier}
                  ids={draft.containers[tier]}
                  assets={draft.assets}
                  onRemove={remove}
                />
              ))}
            </section>

            <section className={`rounded-xl border border-[#243044] bg-[#10182a] p-4 ${pool === 0 ? "lg:hidden" : ""}`}>
              <div className="mb-3">
                <h2 className="text-lg font-semibold text-cyan-300">
                  {kind === "nft" ? "NFT pool" : "Currency pool"}
                </h2>
                <p className="text-sm text-zinc-400">
                  {pool === 0
                    ? "Add from the list, then drag onto a tier."
                    : `${pool} waiting to be ranked`}
                </p>
              </div>
              <PoolLane
                ids={draft.containers.pool}
                assets={draft.assets}
                onRemove={remove}
                emptyLabel={
                  kind === "nft"
                    ? "Drag collections here, then onto a tier"
                    : "Drag currencies here, then onto a tier"
                }
              />
            </section>
        </div>

            <CatalogPanel
              kind={kind}
              subject={subject}
              query={query}
              onQuery={setQuery}
              catalogState={catalogState}
              total={catalog.length}
              assets={visibleCatalog}
              placed={placed}
              stuckId={stuckId}
              onAdd={(id) => place(id, "pool")}
            />
            <DragOverlay dropAnimation={null}>
              {activeAsset ? <CoinFace asset={activeAsset} /> : null}
            </DragOverlay>
          </DndContext>
      </main>
    </div>
  );
}

function PostButton({
  viewer,
  posting,
  onPublish,
}: {
  viewer: Viewer | null;
  posting: "image" | "link" | null;
  onPublish: (mode: "image" | "link") => void;
}) {
  if (!viewer) {
    return (
      <form action={signInWithX} className="flex flex-wrap gap-2">
        <button
          type="submit"
          className="cursor-pointer rounded-full bg-cyan-300 px-4 py-2 text-sm font-semibold text-black hover:bg-cyan-200"
        >
          Post image to X
        </button>
        <button
          type="submit"
          className="cursor-pointer rounded-full border border-cyan-300/50 px-4 py-2 text-sm font-semibold text-cyan-100 hover:bg-cyan-300/10"
        >
          Post link to X
        </button>
      </form>
    );
  }
  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() => onPublish("image")}
        disabled={posting !== null}
        className="cursor-pointer rounded-full bg-cyan-300 px-4 py-2 text-sm font-semibold text-black hover:bg-cyan-200 disabled:opacity-60"
      >
        {posting === "image" ? "Posting…" : "Post image to X"}
      </button>
      <button
        type="button"
        onClick={() => onPublish("link")}
        disabled={posting !== null}
        className="cursor-pointer rounded-full border border-cyan-300/50 px-4 py-2 text-sm font-semibold text-cyan-100 hover:bg-cyan-300/10 disabled:opacity-60"
      >
        {posting === "link" ? "Posting…" : "Post link to X"}
      </button>
    </div>
  );
}

function TierLane({
  tier,
  ids,
  assets,
  onRemove,
}: {
  tier: Tier;
  ids: string[];
  assets: Record<string, Asset>;
  onRemove: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: tier });
  return (
    <div className="flex min-h-[108px] border-b border-black/50 last:border-b-0">
      <div
        className="flex w-[92px] shrink-0 items-center justify-center text-sm font-bold text-white sm:w-28"
        style={{ backgroundColor: TIER_COLOR[tier] }}
      >
        {tier} Tier
      </div>
      <div
        ref={setNodeRef}
        className={`flex flex-1 flex-wrap content-center gap-3 bg-[#0b0f16] px-3 py-3 ${isOver ? "outline outline-2 outline-cyan-300/70" : ""}`}
      >
        {ids.length === 0 ? <span className="text-sm text-zinc-600">Drop here</span> : null}
        {ids.map((id) =>
          assets[id] ? (
            <DraggableChip key={id} asset={assets[id]} onRemove={() => onRemove(id)} />
          ) : null,
        )}
      </div>
    </div>
  );
}

function PoolLane({
  ids,
  assets,
  onRemove,
  emptyLabel,
}: {
  ids: string[];
  assets: Record<string, Asset>;
  onRemove: (id: string) => void;
  emptyLabel: string;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: "pool" });
  return (
    <div
      ref={setNodeRef}
      className={`flex min-h-28 flex-wrap content-center gap-3 rounded-lg border border-dashed border-white/15 bg-[#0c121e] p-3 ${isOver ? "outline outline-2 outline-cyan-300/70" : ""}`}
    >
      {ids.length === 0 ? (
        <p className="w-full text-center text-sm text-zinc-500">{emptyLabel}</p>
      ) : null}
      {ids.map((id) =>
        assets[id] ? <DraggableChip key={id} asset={assets[id]} onRemove={() => onRemove(id)} /> : null,
      )}
    </div>
  );
}

function DraggableChip({ asset, onRemove }: { asset: Asset; onRemove: () => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: asset.id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform) }}
      className={`cursor-grab touch-none ${isDragging ? "opacity-40" : ""}`}
      {...listeners}
      {...attributes}
    >
      <CoinFace asset={asset} onRemove={onRemove} />
    </div>
  );
}

function CatalogPanel({
  kind,
  subject,
  query,
  onQuery,
  catalogState,
  total,
  assets,
  placed,
  stuckId,
  onAdd,
}: {
  kind: Kind;
  subject: string;
  query: string;
  onQuery: (value: string) => void;
  catalogState: "loading" | "ready" | "error";
  total: number;
  assets: Asset[];
  placed: Set<string>;
  stuckId: string | null;
  onAdd: (id: string) => void;
}) {
  const countLabel =
    query.trim() && catalogState === "ready"
      ? `${assets.length} of ${total}`
      : catalogState === "ready"
        ? `${total} ${kind === "nft" ? "collections" : "coins"}`
        : "";
  return (
    <aside className="flex min-h-0 flex-col border-white/10 px-3 pb-6 lg:h-full lg:w-[24rem] lg:shrink-0 lg:overflow-hidden lg:border-l lg:bg-[#0c1018] lg:px-3 lg:py-4">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold text-cyan-300">
          {kind === "nft" ? "Available NFTs" : "Available coins"}
        </h2>
        <p className="text-xs tabular-nums text-zinc-400">{countLabel}</p>
      </div>
      <label className="sr-only" htmlFor="asset-search">
        Search {subject}
      </label>
      <input
        id="asset-search"
        value={query}
        onChange={(event) => onQuery(event.target.value)}
        placeholder={kind === "nft" ? "Search NFT collections" : "Search currencies"}
        className="mb-3 w-full rounded-lg border border-white/10 bg-[#121826] px-3 py-2 text-sm outline-none ring-cyan-400/40 placeholder:text-zinc-500 focus:ring-2"
      />
      {catalogState === "error" ? (
        <p className="text-sm text-red-300">The catalog did not load.</p>
      ) : catalogState === "loading" ? (
        <p className="text-sm text-zinc-500">Loading {subject}…</p>
      ) : assets.length === 0 ? (
        <p className="text-sm text-zinc-500">No matches.</p>
      ) : (
        <div className="grid max-h-[70vh] grid-cols-4 gap-x-1 gap-y-3 overflow-y-auto sm:grid-cols-6 md:grid-cols-8 lg:max-h-none lg:flex-1 lg:grid-cols-4 lg:pr-1">
          {assets.map((asset) => (
            <CatalogCard
              key={asset.id}
              asset={asset}
              added={placed.has(asset.id)}
              stuck={stuckId === asset.id}
              onAdd={() => onAdd(asset.id)}
            />
          ))}
        </div>
      )}
    </aside>
  );
}

function CatalogCard({
  asset,
  added,
  stuck,
  onAdd,
}: {
  asset: Asset;
  added: boolean;
  stuck: boolean;
  onAdd: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `pick:${asset.id}`,
    disabled: added,
  });
  return (
    <div
      ref={setNodeRef}
      title={asset.name}
      onClick={() => {
        if (added || window.innerWidth >= 1024) return;
        onAdd();
      }}
      className={`flex cursor-grab flex-col items-center gap-1 [content-visibility:auto] [contain-intrinsic-size:72px_88px] ${added ? "opacity-35" : ""} ${stuck ? "stick-blink" : ""} ${isDragging ? "opacity-40" : ""}`}
      {...listeners}
      {...attributes}
    >
      <Logo
        kind={asset.kind}
        externalId={asset.externalId}
        name={asset.name}
        symbol={asset.symbol}
        className="h-14 w-14"
      />
      <span className="w-full truncate text-center text-[11px] font-semibold uppercase tracking-wide text-zinc-100">
        {asset.symbol}
      </span>
    </div>
  );
}

async function loadOwn(kind: Kind): Promise<ServerList | null> {
  const response = await fetch(`/api/lists?kind=${kind}`);
  if (!response.ok) return null;
  const data = (await response.json()) as { list: ServerList | null };
  return data.list;
}

function pickDraft(kind: Kind, server: ServerList | null, local: Draft) {
  const localCount = placedItems(local).length;
  if (localCount > 0) return local;
  if (server) return draftFromServer(server, kind);
  return local;
}
