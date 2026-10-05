import { TIERS, TIER_COLOR, type Asset, type Tier } from "@/lib/constants";
import { CoinFace } from "@/components/coin-face";

export function TierView({
  rows,
}: {
  rows: Record<Tier, Array<{ asset: Asset; detail?: string }>>;
}) {
  return (
    <div className="overflow-hidden rounded-md border border-white/10">
      {TIERS.map((tier) => (
        <div key={tier} className="flex min-h-[108px] border-b border-black/50 last:border-b-0">
          <div
            className="flex w-[92px] shrink-0 items-center justify-center px-2 text-center text-sm font-bold text-white sm:w-28"
            style={{ backgroundColor: TIER_COLOR[tier] }}
          >
            {tier} Tier
          </div>
          <div className="flex flex-1 flex-wrap content-center gap-3 bg-[#0b0f16] px-3 py-3">
            {rows[tier].length === 0 ? (
              <span className="text-sm text-zinc-600">Nothing here yet</span>
            ) : (
              rows[tier].map((item) => (
                <CoinFace key={item.asset.id} asset={item.asset} detail={item.detail} />
              ))
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
