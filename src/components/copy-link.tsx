"use client";

import { useState } from "react";

export function CopyLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="rounded-md border border-white/15 px-3 py-1.5 text-sm text-zinc-200 hover:bg-white/5"
      onClick={async () => {
        await navigator.clipboard.writeText(url);
        setCopied(true);
      }}
    >
      {copied ? "Copied" : "Copy link"}
    </button>
  );
}
