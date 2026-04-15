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
}

const CACHE_TTL_MS = 5 * 60 * 1000;
let cachedState: ApifyUsageWithPct | null = null;
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

/**
 * Fetch the current billing-cycle usage from Apify, upsert the singleton
 * state row, fire threshold alerts if any were crossed, and return the
 * updated state. Idempotent at the alert level — each threshold can only
 * trigger once per billing cycle.
 */
export async function checkApifyUsage(): Promise<ApifyUsageWithPct> {
  const token = process.env.APIFY_API_TOKEN;
  if (!token) {
    console.error("[apify-usage] APIFY_API_TOKEN not set");
    return readApifyUsageCached();
  }

  let usd = 0;
  let maxUsd = 0;
  let cycleStart: string | null = null;
  let cycleEnd: string | null = null;

  try {
    const res = await fetch("https://api.apify.com/v2/users/me/limits", {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      console.error(`[apify-usage] Apify limits API returned ${res.status}`);
      return readApifyUsageCached();
    }
    const json = await res.json();
    const data = (json?.data ?? json) as Record<string, unknown>;
    const current = (data.current ?? {}) as Record<string, unknown>;
    const limits = (data.limits ?? {}) as Record<string, unknown>;

    // The Apify API currently exposes monthly usage in USD under
    // `monthlyUsageUsd` / `maxMonthlyUsageUsd`. Support alternate spellings
    // as a safety net if the response shape drifts.
    usd = Number(
      current.monthlyUsageUsd ??
      current.monthly_usage_usd ??
      current.monthlyUsage ??
      0
    );
    maxUsd = Number(
      limits.maxMonthlyUsageUsd ??
      limits.max_monthly_usage_usd ??
      limits.monthlyUsageLimitUsd ??
      0
    );
    cycleStart = (data.monthlyUsageCycle as Record<string, unknown> | undefined)?.startAt as string
      ?? (data.billingCycle as Record<string, unknown> | undefined)?.startAt as string
      ?? null;
    cycleEnd = (data.monthlyUsageCycle as Record<string, unknown> | undefined)?.endAt as string
      ?? (data.billingCycle as Record<string, unknown> | undefined)?.endAt as string
      ?? null;
  } catch (err) {
    console.error(`[apify-usage] Failed to fetch limits: ${err instanceof Error ? err.message : err}`);
    return readApifyUsageCached();
  }

  const service = getServiceClient();
  const { data: existing } = await service
    .from("apify_usage_state")
    .select("*")
    .eq("id", 1)
    .single();

  const existingState = existing as ApifyUsageState | null;

  // Reset alerts if a new billing cycle has begun
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

  // Determine if we need to fire alerts
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
    .upsert({ id: 1, ...next });

  for (const level of alertsToFire) {
    sendApifyUsageAlert(level, merged);
  }

  const result: ApifyUsageWithPct = { ...merged, pct };
  cachedState = result;
  cachedAt = Date.now();
  return result;
}

/**
 * Read the cached usage state. Uses in-memory cache (≤5 min) first, then
 * falls back to the DB. Does NOT call the Apify API.
 */
export async function readApifyUsageCached(): Promise<ApifyUsageWithPct> {
  if (cachedState && Date.now() - cachedAt < CACHE_TTL_MS) {
    return cachedState;
  }

  const service = getServiceClient();
  const { data } = await service
    .from("apify_usage_state")
    .select("*")
    .eq("id", 1)
    .single();

  const state = (data as ApifyUsageState | null) ?? {
    monthly_usage_usd: 0,
    max_monthly_usage_usd: 0,
    billing_cycle_start: null,
    billing_cycle_end: null,
    checked_at: new Date(0).toISOString(),
    alert_70_sent_at: null,
    alert_85_sent_at: null,
    alert_95_sent_at: null,
  };

  const result: ApifyUsageWithPct = { ...state, pct: pctOf(state) };
  cachedState = result;
  cachedAt = Date.now();
  return result;
}

/**
 * Returns true if monthly usage has reached 95% of the limit. Called by
 * user-facing search entry points to reject new requests before Apify itself
 * rejects them. Uses the cached state — the cron check function refreshes it
 * every 15 minutes.
 */
export async function isApifyBlocked(): Promise<boolean> {
  try {
    const state = await readApifyUsageCached();
    return state.pct >= 95;
  } catch {
    // Fail-open: if we can't read state, don't block users
    return false;
  }
}
