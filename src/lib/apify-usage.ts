import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { sendApifyUsageAlert } from "./apify-alerts";

export interface ApifyUsageState {
  monthly_usage_usd: number;
  max_monthly_usage_usd: number;
  billing_cycle_start: string | null;
  billing_cycle_end: string | null;
  checked_at: string;
  alert_70_sent_at: string | null;
  alert_85_sent_at: string | null;
  alert_95_sent_at: string | null;
}

export interface ApifyUsageWithPct extends ApifyUsageState {
  pct: number;
  account_id?: number;
  account_label?: string;
}

const CACHE_TTL_MS = 5 * 60 * 1000;
let cachedStates: ApifyUsageWithPct[] | null = null;
let cachedAt = 0;

function getServiceClient(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function pctOf(state: ApifyUsageState): number {
  if (!state.max_monthly_usage_usd || state.max_monthly_usage_usd <= 0) return 0;
  return (state.monthly_usage_usd / state.max_monthly_usage_usd) * 100;
}

interface ApifyAccount {
  id: number;
  label: string;
  env_key: string;
  enabled: boolean;
}

/**
 * Fetch usage for a single Apify account token.
 */
async function fetchUsageForToken(token: string): Promise<{
  usd: number; maxUsd: number; cycleStart: string | null; cycleEnd: string | null;
} | null> {
  try {
    const res = await fetch("https://api.apify.com/v2/users/me/limits", {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      console.error(`[apify-usage] Apify limits API returned ${res.status}`);
      return null;
    }
    const json = await res.json();
    const data = (json?.data ?? json) as Record<string, unknown>;
    const current = (data.current ?? {}) as Record<string, unknown>;
    const limits = (data.limits ?? {}) as Record<string, unknown>;

    const usd = Number(
      current.monthlyUsageUsd ??
      current.monthly_usage_usd ??
      current.monthlyUsage ??
      0
    );
    const maxUsd = Number(
      limits.maxMonthlyUsageUsd ??
      limits.max_monthly_usage_usd ??
      limits.monthlyUsageLimitUsd ??
      0
    );
    const cycleStart = (data.monthlyUsageCycle as Record<string, unknown> | undefined)?.startAt as string
      ?? (data.billingCycle as Record<string, unknown> | undefined)?.startAt as string
      ?? null;
    const cycleEnd = (data.monthlyUsageCycle as Record<string, unknown> | undefined)?.endAt as string
      ?? (data.billingCycle as Record<string, unknown> | undefined)?.endAt as string
      ?? null;

    return { usd, maxUsd, cycleStart, cycleEnd };
  } catch (err) {
    console.error(`[apify-usage] Failed to fetch limits: ${err instanceof Error ? err.message : err}`);
    return null;
  }
}

/**
 * Fetch the current billing-cycle usage from Apify for all enabled accounts,
 * upsert state rows, fire threshold alerts if any were crossed, and return
 * the updated states.
 */
export async function checkApifyUsage(): Promise<ApifyUsageWithPct> {
  const service = getServiceClient();

  // Load all accounts (enabled or not) so we can report on all of them
  const { data: accountRows } = await service
    .from("apify_accounts")
    .select("id, label, env_key, enabled")
    .order("id");

  const accounts = (accountRows as ApifyAccount[] | null) ?? [];

  // Fallback: if no accounts in DB, use env var directly (legacy behavior)
  if (accounts.length === 0) {
    const token = process.env.APIFY_API_TOKEN;
    if (!token) {
      console.error("[apify-usage] No accounts and APIFY_API_TOKEN not set");
      return readApifyUsageCached();
    }
    accounts.push({ id: 1, label: "Conta 1", env_key: "APIFY_API_TOKEN", enabled: true });
  }

  const results: ApifyUsageWithPct[] = [];

  for (const account of accounts) {
    const token = process.env[account.env_key];
    if (!token) {
      console.warn(`[apify-usage] Token not set for ${account.label} (${account.env_key})`);
      continue;
    }

    const usage = await fetchUsageForToken(token);
    if (!usage) continue;

    const { usd, maxUsd, cycleStart, cycleEnd } = usage;

    const { data: existing } = await service
      .from("apify_usage_state")
      .select("*")
      .eq("id", account.id)
      .single();

    const existingState = existing as ApifyUsageState | null;

    const newCycle =
      existingState?.billing_cycle_start &&
      cycleStart &&
      existingState.billing_cycle_start !== cycleStart;

    const next: Partial<ApifyUsageState> = {
      monthly_usage_usd: usd,
      max_monthly_usage_usd: maxUsd,
      billing_cycle_start: cycleStart,
      billing_cycle_end: cycleEnd,
      checked_at: new Date().toISOString(),
    };
    if (newCycle) {
      next.alert_70_sent_at = null;
      next.alert_85_sent_at = null;
      next.alert_95_sent_at = null;
    }

    const pct = maxUsd > 0 ? (usd / maxUsd) * 100 : 0;
    const merged: ApifyUsageState = {
      monthly_usage_usd: usd,
      max_monthly_usage_usd: maxUsd,
      billing_cycle_start: cycleStart,
      billing_cycle_end: cycleEnd,
      checked_at: next.checked_at!,
      alert_70_sent_at: newCycle ? null : (existingState?.alert_70_sent_at ?? null),
      alert_85_sent_at: newCycle ? null : (existingState?.alert_85_sent_at ?? null),
      alert_95_sent_at: newCycle ? null : (existingState?.alert_95_sent_at ?? null),
    };

    const alertsToFire: Array<70 | 85 | 95> = [];
    if (pct >= 70 && !merged.alert_70_sent_at) alertsToFire.push(70);
    if (pct >= 85 && !merged.alert_85_sent_at) alertsToFire.push(85);
    if (pct >= 95 && !merged.alert_95_sent_at) alertsToFire.push(95);

    const nowIso = new Date().toISOString();
    for (const level of alertsToFire) {
      if (level === 70) { next.alert_70_sent_at = nowIso; merged.alert_70_sent_at = nowIso; }
      if (level === 85) { next.alert_85_sent_at = nowIso; merged.alert_85_sent_at = nowIso; }
      if (level === 95) { next.alert_95_sent_at = nowIso; merged.alert_95_sent_at = nowIso; }
    }

    await service
      .from("apify_usage_state")
      .upsert({ id: account.id, ...next });

    for (const level of alertsToFire) {
      sendApifyUsageAlert(level, merged);
    }

    results.push({ ...merged, pct, account_id: account.id, account_label: account.label });
  }

  // Return the first result for backwards compatibility; cache all results
  const primary = results[0] ?? await readApifyUsageCached();
  cachedStates = results;
  cachedAt = Date.now();
  return primary;
}

/**
 * Read the cached usage state. Uses in-memory cache (<=5 min) first, then
 * falls back to the DB. Does NOT call the Apify API.
 */
export async function readApifyUsageCached(): Promise<ApifyUsageWithPct> {
  const all = await readAllApifyUsageCached();
  return all[0] ?? {
    monthly_usage_usd: 0,
    max_monthly_usage_usd: 0,
    billing_cycle_start: null,
    billing_cycle_end: null,
    checked_at: new Date(0).toISOString(),
    alert_70_sent_at: null,
    alert_85_sent_at: null,
    alert_95_sent_at: null,
    pct: 0,
  };
}

/**
 * Read cached usage for ALL accounts.
 */
export async function readAllApifyUsageCached(): Promise<ApifyUsageWithPct[]> {
  if (cachedStates && cachedStates.length > 0 && Date.now() - cachedAt < CACHE_TTL_MS) {
    return cachedStates;
  }

  const service = getServiceClient();

  // Load accounts to get labels
  const { data: accountRows } = await service
    .from("apify_accounts")
    .select("id, label")
    .order("id");
  const accountMap = new Map<number, string>();
  for (const a of (accountRows ?? []) as Array<{ id: number; label: string }>) {
    accountMap.set(a.id, a.label);
  }

  const { data } = await service
    .from("apify_usage_state")
    .select("*")
    .order("id");

  const rows = (data ?? []) as Array<ApifyUsageState & { id: number }>;

  if (rows.length === 0) {
    return [{
      monthly_usage_usd: 0,
      max_monthly_usage_usd: 0,
      billing_cycle_start: null,
      billing_cycle_end: null,
      checked_at: new Date(0).toISOString(),
      alert_70_sent_at: null,
      alert_85_sent_at: null,
      alert_95_sent_at: null,
      pct: 0,
    }];
  }

  const results = rows.map((row) => ({
    ...row,
    pct: pctOf(row),
    account_id: row.id,
    account_label: accountMap.get(row.id) ?? `Conta ${row.id}`,
  }));

  cachedStates = results;
  cachedAt = Date.now();
  return results;
}

/**
 * Returns true if ALL enabled accounts have reached 95% of the limit.
 * If no usage data exists, fail-open (don't block).
 */
export async function isApifyBlocked(): Promise<boolean> {
  try {
    const states = await readAllApifyUsageCached();
    if (states.length === 0) return false;
    // Blocked only if every account is at 95%+
    return states.every((s) => s.pct >= 95);
  } catch {
    // Fail-open: if we can't read state, don't block users
    return false;
  }
}
