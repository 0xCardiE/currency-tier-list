import { appPool } from "@/lib/db";
import { isKind } from "@/lib/constants";

export async function GET(
  _request: Request,
  context: { params: Promise<{ kind: string; externalId: string }> },
) {
  const { kind, externalId } = await context.params;
  if (!isKind(kind)) return new Response("Not found", { status: 404 });

  const result = await appPool.query<{ content_type: string | null; image_bytes: Buffer | null }>(
    `SELECT content_type, image_bytes FROM assets WHERE kind = $1 AND external_id = $2`,
    [kind, externalId],
  );
  const row = result.rows[0];
  if (!row?.image_bytes) return new Response("Not found", { status: 404 });

  return new Response(new Uint8Array(row.image_bytes), {
    headers: {
      "Content-Type": row.content_type || "image/png",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
