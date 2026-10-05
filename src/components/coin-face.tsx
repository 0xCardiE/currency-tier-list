"use client";

import type { Asset } from "@/lib/constants";
import { formatPlatform } from "@/lib/constants";
import { Logo } from "@/components/logo";

export function CoinFace({
  asset,
  detail,
  onRemove,
}: {
  asset: Asset;
  detail?: string;
  onRemove?: () => void;
}) {
  const platform = formatPlatform(asset.platform);
  return (
    <div className="group relative flex w-[76px] flex-col items-center gap-1 text-center" title={platform ? `${asset.name} · ${platform}` : asset.name}>
      {onRemove ? (
        <button
          type="button"
          aria-label={`Remove ${asset.name}`}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={onRemove}
          className="absolute -right-1 -top-1 z-10 grid h-5 w-5 cursor-pointer place-items-center rounded-full bg-zinc-900 text-xs text-zinc-300 ring-1 ring-white/20 opacity-0 transition group-hover:opacity-100 focus:opacity-100"
        >
          ×
        </button>
      ) : null}
      <Logo kind={asset.kind} externalId={asset.externalId} name={asset.name} symbol={asset.symbol} />
      <span className="w-full truncate text-[11px] font-semibold uppercase tracking-wide text-zinc-100">
        {asset.symbol}
      </span>
      {detail ? <span className="text-[10px] tabular-nums text-cyan-200/80">{detail}</span> : null}
    </div>
  );
}
