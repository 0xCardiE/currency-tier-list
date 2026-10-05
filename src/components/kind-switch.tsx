"use client";

import Link from "next/link";
import type { Kind } from "@/lib/constants";

export function KindSwitch({
  kind,
  onChange,
  hrefBase,
}: {
  kind: Kind;
  onChange?: (kind: Kind) => void;
  hrefBase?: string;
}) {
  const options: Array<{ id: Kind; title: string; subtitle: string }> = [
    { id: "fungible", title: "Currencies", subtitle: "Fungible" },
    { id: "nft", title: "NFTs", subtitle: "Non-fungible" },
  ];

  return (
    <div className="grid grid-cols-2 rounded-xl bg-black/50 p-1 ring-1 ring-white/10" role="tablist" aria-label="Catalog">
      {options.map((option) => {
        const selected = kind === option.id;
        const className = `rounded-lg px-4 py-2 text-left transition ${
          selected ? "bg-[#163044] text-cyan-200 shadow-sm" : "text-zinc-400 hover:text-zinc-200"
        }`;
        const body = (
          <>
            <span className="block text-sm font-semibold leading-none">{option.title}</span>
            <span className="mt-1 block text-[10px] uppercase tracking-[0.14em] text-current/70">
              {option.subtitle}
            </span>
          </>
        );
        if (onChange) {
          return (
            <button
              key={option.id}
              type="button"
              role="tab"
              aria-selected={selected}
              className={className}
              onClick={() => onChange(option.id)}
            >
              {body}
            </button>
          );
        }
        const href =
          option.id === "fungible" ? hrefBase || "/" : `${hrefBase || "/"}?kind=nft`;
        return (
          <Link key={option.id} href={href} role="tab" aria-selected={selected} className={className}>
            {body}
          </Link>
        );
      })}
    </div>
  );
}
