import { auth } from "@/auth";
import { getOwnList, saveList } from "@/lib/lists";
import { isContainer, isKind, type Container } from "@/lib/constants";

export const dynamic = "force-dynamic";

async function viewer() {
  const session = await auth();
  if (!session?.user?.id) return null;
  return session.user;
}

export async function GET(request: Request) {
  const user = await viewer();
  if (!user) return Response.json({ error: "Sign in with X first." }, { status: 401 });
  const kind = new URL(request.url).searchParams.get("kind");
  if (!isKind(kind)) return Response.json({ error: "Choose currencies or NFTs." }, { status: 400 });
  const list = await getOwnList(user.id, kind);
  return Response.json({ list });
}

export async function PUT(request: Request) {
  const user = await viewer();
  if (!user) return Response.json({ error: "Sign in with X first." }, { status: 401 });
  const body = (await request.json()) as {
    kind?: string;
    title?: string;
    items?: Array<{ assetId?: string; tier?: string }>;
  };
  if (!isKind(body.kind)) return Response.json({ error: "Choose currencies or NFTs." }, { status: 400 });
  const items: Array<{ assetId: string; tier: Container }> = [];
  for (const item of body.items ?? []) {
    if (!item.assetId || !item.tier || !isContainer(item.tier)) {
      return Response.json({ error: "Invalid placement." }, { status: 400 });
    }
    items.push({ assetId: item.assetId, tier: item.tier });
  }
  try {
    const saved = await saveList({
      userId: user.id,
      authorName: user.name ?? null,
      authorImage: user.image ?? null,
      kind: body.kind,
      title: body.title ?? "",
      items,
    });
    if ("error" in saved && saved.error) {
      return Response.json({ error: saved.error }, { status: 400 });
    }
    return Response.json(saved);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save the list.";
    return Response.json({ error: message }, { status: 500 });
  }
}
