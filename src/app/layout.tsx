import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geist = Geist({
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Currency Tier List",
    template: "%s · Currency Tier List",
  },
  description:
    "Rank currencies and NFT collections from S through D, post the list on X, and see which projects score highest.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geist.className} h-full antialiased`}>
      <body className="min-h-full bg-black text-zinc-100">{children}</body>
    </html>
  );
}
