"use client";

import { useMemo } from "react";
import useSWR, { mutate } from "swr";
import { REFRESH_SECONDS } from "./config";
import type { Campaign } from "./config";
import type { Me } from "./types";

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { cache: "no-store", ...init });
  const json = await res.json().catch(() => ({ error: `Request failed (${res.status})` }));
  if (res.status === 401 && typeof window !== "undefined" && !location.pathname.startsWith("/login")) {
    location.href = "/login";
  }
  if (!res.ok || json.error) throw new Error(json.error ?? `Request failed (${res.status})`);
  return json as T;
}

export const api = {
  get: <T>(url: string) => request<T>(url),
  send: <T>(url: string, method: "POST" | "PUT" | "PATCH", body: unknown) =>
    request<T>(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
};

export function sheetGet<T>(action: string, params: Record<string, string | undefined> = {}) {
  const q = new URLSearchParams({ action });
  for (const [k, v] of Object.entries(params)) if (v) q.set(k, v);
  return api.get<T>(`/api/sheets?${q}`);
}

/* Live data from one Apps Script action, auto-refreshed. action = null pauses it. */
export function useSheet<T>(action: string | null, params: Record<string, string | undefined> = {}, live = true) {
  const key = action ? ["sheet", action, JSON.stringify(params)] : null;
  return useSWR<T>(key, () => sheetGet<T>(action!, params), {
    refreshInterval: live ? REFRESH_SECONDS * 1000 : 0,
    revalidateOnFocus: true,
    keepPreviousData: true,
  });
}

/* Refresh every live Sheets query after a write. */
export const refreshAllSheets = () => mutate((k) => Array.isArray(k) && k[0] === "sheet");

/* scope "admin" = the admin pages' identity; otherwise the agent signed in on this browser. */
export const useMe = (scope: "admin" | "app" = "app") =>
  useSWR<Me>(scope === "admin" ? "/api/me?scope=admin" : "/api/me", api.get, { revalidateOnFocus: true, refreshInterval: 60_000 });

/* Campaigns from the database (edited in the admin portal). */
export function useCampaigns() {
  const res = useSWR<{ campaigns: Campaign[] }>("/api/campaigns", api.get, { revalidateOnFocus: true, refreshInterval: 120_000 });
  const all = useMemo(() => res.data?.campaigns ?? [], [res.data]);
  const active = useMemo(() => all.filter((c) => c.status === "Active"), [all]);
  return { ...res, all, active, loading: !res.data && !res.error };
}
