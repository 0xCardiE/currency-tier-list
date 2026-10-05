"use client";

import { useState } from "react";

export function Logo({
  kind,
  externalId,
  name,
  symbol,
  className,
}: {
  kind: string;
  externalId: string;
  name: string;
  symbol: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const frame = className ?? "h-14 w-14";
  if (failed) {
    return (
      <span
        className={`grid place-items-center rounded-full bg-[#1b2740] text-[11px] font-bold tracking-wide text-zinc-100 ${frame}`}
      >
        {symbol.slice(0, 4)}
      </span>
    );
  }
  return (
    // Stored logos are already small; skip the image optimizer.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/api/logo/${kind}/${externalId}`}
      alt={name}
      width={56}
      height={56}
      loading="lazy"
      className={`${frame} rounded-full bg-[#152033] object-cover ring-1 ring-white/10`}
      onError={() => setFailed(true)}
    />
  );
}
