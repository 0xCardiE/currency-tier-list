"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signInWithX, signOutAction } from "@/app/actions";
import { KindSwitch } from "@/components/kind-switch";
import type { Kind } from "@/lib/constants";

export type Viewer = {
  id: string;
  name?: string | null;
  image?: string | null;
};

export function SiteHeader({
  viewer,
  kind,
  onKindChange,
  kindHrefBase,
}: {
  viewer: Viewer | null;
  kind?: Kind;
  onKindChange?: (kind: Kind) => void;
  kindHrefBase?: string;
}) {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-30 border-b border-white/5 bg-[#0c1322]/95 backdrop-blur">
      <div className="mx-auto flex w-full flex-wrap items-center gap-3 px-4 py-3 lg:px-6">
        <Link href="/" className="flex items-center gap-2 text-cyan-300">
          <BarsIcon />
          <span className="text-lg font-semibold tracking-tight">Currency Tier List</span>
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          <HeaderLink href="/" active={pathname === "/"}>
            Make
          </HeaderLink>
          <HeaderLink href="/community" active={pathname.startsWith("/community")}>
            Stats
          </HeaderLink>
        </nav>
        {kind ? (
          <div className="order-last w-full sm:order-none sm:ml-auto sm:w-auto">
            <KindSwitch kind={kind} onChange={onKindChange} hrefBase={kindHrefBase} />
          </div>
        ) : (
          <div className="sm:ml-auto" />
        )}
        <AuthControl viewer={viewer} />
      </div>
    </header>
  );
}

function HeaderLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`rounded-md px-2.5 py-1 ${active ? "text-white" : "text-zinc-400 hover:text-zinc-200"}`}
    >
      {children}
    </Link>
  );
}

function AuthControl({ viewer }: { viewer: Viewer | null }) {
  if (viewer) {
    return (
      <div className="flex items-center gap-2">
        {viewer.image ? (
          // Profile photos come from X.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={viewer.image} alt="" className="h-8 w-8 rounded-full object-cover" />
        ) : null}
        <span className="max-w-32 truncate text-sm text-zinc-200">{viewer.name || "Signed in"}</span>
        <form action={signOutAction}>
          <button type="submit" className="cursor-pointer rounded-md px-2 py-1 text-sm text-zinc-400 hover:text-white">
            Sign out
          </button>
        </form>
      </div>
    );
  }
  return (
    <form action={signInWithX}>
      <button
        type="submit"
        className="cursor-pointer rounded-full bg-white px-3 py-1.5 text-sm font-semibold text-black hover:bg-zinc-200"
      >
        Sign in with X
      </button>
    </form>
  );
}

function BarsIcon() {
  const colors = ["#e15d57", "#f08c2c", "#e6c229", "#3fbe56", "#3d7ef0"];
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
      {colors.map((color, index) => (
        <rect key={color} x="2" y={2 + index * 4} width={18 - index * 2} height="3" rx="1" fill={color} />
      ))}
    </svg>
  );
}
