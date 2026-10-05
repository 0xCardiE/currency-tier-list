import NextAuth from "next-auth";
import Twitter from "next-auth/providers/twitter";
import PostgresAdapter from "@auth/pg-adapter";
import { authPool } from "@/lib/db";

const clientId = process.env.TWITTER_CLIENT_ID || process.env.AUTH_TWITTER_ID;
const clientSecret = process.env.TWITTER_CLIENT_SECRET || process.env.AUTH_TWITTER_SECRET;

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PostgresAdapter(authPool),
  secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
  trustHost: true,
  session: { strategy: "database" },
  providers:
    clientId && clientSecret
      ? [
          Twitter({
            clientId,
            clientSecret,
            authorization: {
              url: "https://x.com/i/oauth2/authorize",
              params: {
                scope: "users.read tweet.read tweet.write media.write offline.access",
              },
            },
          }),
        ]
      : [],
  callbacks: {
    session({ session, user }) {
      session.user.id = String(user.id);
      return session;
    },
  },
});
