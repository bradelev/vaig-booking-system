/**
 * System configuration — reads from system_config table.
 */
import { createAdminClient } from "@/lib/supabase/admin";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any;

let configCache: Record<string, string> | null = null;
let cacheExpiry = 0;
const CACHE_TTL = 60_000; // 1 minute

export async function getConfig(): Promise<Record<string, string>> {
  const now = Date.now();
  if (configCache && now < cacheExpiry) return configCache;

  const client = createAdminClient() as AnyClient;

  const { data } = await client.from("system_config").select("key, value");
  const cfg: Record<string, string> = {};
  for (const row of data ?? []) {
    cfg[row.key as string] = row.value as string;
  }

  configCache = cfg;
  cacheExpiry = now + CACHE_TTL;
  return cfg;
}

export async function getConfigValue(key: string, fallback = ""): Promise<string> {
  const cfg = await getConfig();
  return cfg[key] ?? fallback;
}

export function clearConfigCache(): void {
  configCache = null;
}
