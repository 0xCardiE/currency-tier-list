import { ImageResponse } from "next/og";
import { TIERS, TIER_COLOR, type Tier } from "@/lib/constants";

export function tierListImage(title: string, groups: Record<Tier, string[]>) {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "#05070c",
          color: "white",
          padding: 36,
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", fontSize: 42, color: "#67e8f9", marginBottom: 20 }}>{title}</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
          {TIERS.map((tier) => {
            const symbols = groups[tier];
            const shown = symbols.slice(0, 12);
            const extra = symbols.length - shown.length;
            return (
              <div key={tier} style={{ display: "flex", minHeight: 78, border: "1px solid #1f2937" }}>
                <div
                  style={{
                    width: 140,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: TIER_COLOR[tier],
                    fontSize: 28,
                    fontWeight: 700,
                  }}
                >
                  {tier}
                </div>
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    alignItems: "center",
                    gap: 14,
                    padding: "0 18px",
                    fontSize: 24,
                    color: "#e5e7eb",
                  }}
                >
                  {shown.length === 0 ? "—" : shown.join("   ")}
                  {extra > 0 ? `  +${extra}` : ""}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}

export async function tierListPng(title: string, groups: Record<Tier, string[]>) {
  const image = tierListImage(title, groups);
  return Buffer.from(await image.arrayBuffer());
}
