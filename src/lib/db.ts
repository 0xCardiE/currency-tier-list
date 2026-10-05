import { Pool } from "pg";

const globalForPg = globalThis as unknown as {
  appPool?: Pool;
  authPool?: Pool;
};

function pool(url: string | undefined, name: string) {
  if (!url) throw new Error(`Missing ${name}`);
  return new Pool({
    connectionString: url,
    options: "-c search_path=tierlist",
  });
}

export const appPool =
  globalForPg.appPool ?? pool(process.env.DATABASE_APP_URL, "DATABASE_APP_URL");
export const authPool =
  globalForPg.authPool ?? pool(process.env.DATABASE_AUTH_URL, "DATABASE_AUTH_URL");

if (process.env.NODE_ENV !== "production") {
  globalForPg.appPool = appPool;
  globalForPg.authPool = authPool;
}
