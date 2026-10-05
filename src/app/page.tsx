import { auth } from "@/auth";
import { Builder } from "@/components/builder";

export const dynamic = "force-dynamic";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ auth?: string }>;
}) {
  const { auth: authState } = await searchParams;
  const session = await auth();
  const viewer = session?.user
    ? { id: session.user.id, name: session.user.name, image: session.user.image }
    : null;
  return <Builder viewer={viewer} authUnavailable={authState === "unavailable"} />;
}
