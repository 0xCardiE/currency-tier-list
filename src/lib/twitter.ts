import { authPool } from "@/lib/db";
import { baseUrl, type Kind } from "@/lib/constants";

type AccountRow = {
  id: number;
  access_token: string | null;
  refresh_token: string | null;
  expires_at: string | number | null;
};

function twitterCreds() {
  const clientId = process.env.TWITTER_CLIENT_ID || process.env.AUTH_TWITTER_ID;
  const clientSecret = process.env.TWITTER_CLIENT_SECRET || process.env.AUTH_TWITTER_SECRET;
  return { clientId, clientSecret };
}

export function twitterConfigured() {
  const { clientId, clientSecret } = twitterCreds();
  return Boolean(clientId && clientSecret);
}

function expiresSoon(expiresAt: string | number | null) {
  if (!expiresAt) return false;
  let seconds = Number(expiresAt);
  if (Number.isNaN(seconds)) return false;
  if (seconds > 10_000_000_000) seconds = Math.floor(seconds / 1000);
  return seconds < Math.floor(Date.now() / 1000) + 60;
}

async function refreshAccessToken(account: AccountRow) {
  const { clientId, clientSecret } = twitterCreds();
  if (!clientId || !clientSecret || !account.refresh_token) {
    throw new Error("Sign in with X again to refresh posting access.");
  }
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: account.refresh_token,
    client_id: clientId,
  });
  const response = await fetch("https://api.x.com/2/oauth2/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
    },
    body,
  });
  const payload = (await response.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    error_description?: string;
    detail?: string;
  };
  if (!response.ok || !payload.access_token) {
    throw new Error(payload.error_description || payload.detail || "X refused to refresh the login.");
  }
  const expiresAt = Math.floor(Date.now() / 1000) + (payload.expires_in ?? 7200);
  await authPool.query(
    `UPDATE accounts
     SET access_token = $2, refresh_token = $3, expires_at = $4
     WHERE id = $1`,
    [account.id, payload.access_token, payload.refresh_token ?? account.refresh_token, expiresAt],
  );
  return payload.access_token;
}

async function accessTokenFor(userId: string) {
  const result = await authPool.query<AccountRow>(
    `SELECT id, access_token, refresh_token, expires_at
     FROM accounts
     WHERE "userId" = $1 AND provider = 'twitter'
     ORDER BY id DESC
     LIMIT 1`,
    [userId],
  );
  const account = result.rows[0];
  if (!account?.access_token) {
    throw new Error("Sign in with X before posting.");
  }
  if (expiresSoon(account.expires_at)) return refreshAccessToken(account);
  return account.access_token;
}

export async function twitterProfile(userId: string) {
  const token = await accessTokenFor(userId);
  const response = await fetch(
    "https://api.x.com/2/users/me?user.fields=username,name,profile_image_url",
    { headers: { Authorization: `Bearer ${token}` } },
  );
  const payload = (await response.json()) as {
    data?: { username?: string; name?: string; profile_image_url?: string };
    detail?: string;
    title?: string;
  };
  if (!response.ok) {
    throw new Error(payload.detail || payload.title || "Could not read the X profile.");
  }
  return { token, profile: payload.data ?? {} };
}

export function tweetText(
  kind: Kind,
  title: string,
  slug: string,
  share: "image" | "link",
  origin = baseUrl(),
) {
  const subject = kind === "nft" ? "NFT" : "currency";
  if (share === "image") return `${title}\n\nMy ${subject} tier list.`.slice(0, 280);
  const url = `${origin}/l/${slug}`;
  const text = `${title}\n\nMy ${subject} tier list.\n${url}`;
  if (text.length <= 280) return text;
  return `${title.slice(0, 200)}\n${url}`;
}

async function uploadTweetImage(token: string, image: Buffer) {
  const form = new FormData();
  form.append("media", new Blob([new Uint8Array(image)], { type: "image/png" }), "tier-list.png");
  form.append("media_category", "tweet_image");
  const response = await fetch("https://api.x.com/2/media/upload", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  const payload = (await response.json()) as {
    data?: { id?: string | number };
    detail?: string;
    title?: string;
    errors?: Array<{ message?: string }>;
  };
  const mediaId = payload.data?.id;
  if (!response.ok || mediaId == null) {
    if (response.status === 401 || response.status === 403) {
      throw new Error("Sign in with X again to allow image posts.");
    }
    throw new Error(
      payload.errors?.[0]?.message || payload.detail || payload.title || "X did not accept the image.",
    );
  }
  return String(mediaId);
}

export async function postTierListTweet(userId: string, text: string, image?: Buffer) {
  const { token, profile } = await twitterProfile(userId);
  const mediaId = image ? await uploadTweetImage(token, image) : null;
  const response = await fetch("https://api.x.com/2/tweets", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(mediaId ? { text, media: { media_ids: [mediaId] } } : { text }),
  });
  const payload = (await response.json()) as {
    data?: { id?: string };
    detail?: string;
    title?: string;
    errors?: Array<{ message?: string }>;
  };
  if (!response.ok || !payload.data?.id) {
    const message =
      payload.errors?.[0]?.message ||
      payload.detail ||
      payload.title ||
      "X did not accept the post.";
    throw new Error(message);
  }
  return {
    tweetId: payload.data.id,
    handle: profile.username ?? null,
    name: profile.name ?? null,
    image: profile.profile_image_url ?? null,
  };
}
