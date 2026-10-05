import { auth } from "@/auth";
import { searchAssets } from "@/lib/assets";
import { isKind } from "@/lib/constants";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  await auth();
  const url = new URL(request.url);
  const kind = url.searchParams.get("kind");
  if (!isKind(kind)) {
    return Response.json({ error: "Choose currencies or NFTs." }, { status: 400 });
  }
  const assets = await searchAssets(kind);
  return Response.json({ assets });
}
