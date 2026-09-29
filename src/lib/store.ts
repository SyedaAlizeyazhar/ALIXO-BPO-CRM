import "server-only";

/*
 * Data access. Upstash Redis (Vercel Storage → Upstash KV) is the source of truth;
 * the Google Sheet only receives a copy (see sheet-mirror.ts).
 * Without Redis credentials, local dev falls back to an in-memory demo store.
 */

export class StoreNotConfigured extends Error {}

export async function callStore<T = Record<string, unknown>>(action: string, params: Record<string, unknown> = {}): Promise<T> {
  const { kvConfigured, kvStore } = await import("./store-kv");
  if (kvConfigured()) return (await kvStore(action, params)) as T;
  if (process.env.NODE_ENV !== "production") {
    const { demoSheet } = await import("./store-demo");
    return (await demoSheet(action, params)) as T;
  }
  throw new StoreNotConfigured("Database is not connected. In Vercel: Storage → Upstash (KV) → connect it to this project, then redeploy.");
}
