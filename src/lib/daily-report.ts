import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { formatBrPhone } from "@/lib/phone";

const REPORT_RECIPIENTS = ["diego@aihubstudio.com", "eva.campos@vecsy.co"];

function getService() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch { return iso; }
}

function fmtDateShort(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  } catch { return iso; }
}

export interface ReportData {
  newUsers: Array<{
    email: string;
    created_at: string;
    role: string;
    company_name?: string | null;
    phone?: string | null;
    sales_contact_interest?: boolean | null;
  }>;
  castingSearches: Array<{ user_email: string; name: string; query_theme: string; created_at: string }>;
  leadsScans: Array<{ user_email: string; total_engagers: number; matched_leads: number; created_at: string }>;
  lgProfiles: Array<{ user_email: string; name: string; linkedin_url: string; created_at: string }>;
  apiCosts: { total: number; byProvider: Record<string, number>; bySource: Record<string, number> };
  summary: { newUsersCount: number; totalActions: number; totalCostUsd: number; totalCostBrl: number };
}

export async function collectDailyReport(periodStart: Date, periodEnd: Date): Promise<ReportData> {
  const service = getService();
  const startIso = periodStart.toISOString();

  // Fetch all users for email resolution
  const { data: { users: authUsers } } = await service.auth.admin.listUsers({ perPage: 500 });
  const userEmailMap = new Map<string, string>();
  for (const u of authUsers ?? []) {
    userEmailMap.set(u.id, u.email ?? "unknown");
  }

  // 1. New users (created in period)
  const newUsers: ReportData["newUsers"] = [];
  for (const u of authUsers ?? []) {
    if (new Date(u.created_at) >= periodStart && new Date(u.created_at) < periodEnd) {
      const { data: roleData } = await service
        .from("user_roles")
        .select("role, company_name, phone, sales_contact_interest")
        .eq("user_id", u.id)
        .single();
      newUsers.push({
        email: u.email ?? "unknown",
        created_at: u.created_at,
        role: (roleData?.role as string) ?? "user",
        company_name: (roleData?.company_name as string | null) ?? null,
        phone: (roleData?.phone as string | null) ?? null,
        sales_contact_interest:
          typeof roleData?.sales_contact_interest === "boolean"
            ? (roleData.sales_contact_interest as boolean)
            : null,
      });
    }
  }

  // 2. Casting searches
  const { data: castingRaw } = await service
    .from("casting_lists")
    .select("created_by, name, query_theme, created_at")
    .gte("created_at", startIso)
    .order("created_at", { ascending: false });

  const castingSearches = (castingRaw ?? []).map((r) => ({
    user_email: userEmailMap.get(r.created_by as string) ?? "unknown",
    name: (r.name as string) || "",
    query_theme: (r.query_theme as string) || "",
    created_at: r.created_at as string,
  }));

  // 3. Leads scans
  const { data: leadsRaw } = await service
    .from("leads_scans")
    .select("user_id, total_engagers, matched_leads, created_at")
    .gte("created_at", startIso)
    .order("created_at", { ascending: false });

  const leadsScans = (leadsRaw ?? []).map((r) => ({
    user_email: userEmailMap.get(r.user_id as string) ?? "unknown",
    total_engagers: (r.total_engagers as number) ?? 0,
    matched_leads: (r.matched_leads as number) ?? 0,
    created_at: r.created_at as string,
  }));

  // 4. LG profiles
  const { data: lgRaw } = await service
    .from("lg_profiles")
    .select("user_id, name, linkedin_url, created_at")
    .gte("created_at", startIso)
    .order("created_at", { ascending: false });

  const lgProfiles = (lgRaw ?? []).map((r) => ({
    user_email: userEmailMap.get(r.user_id as string) ?? "unknown",
    name: (r.name as string) || "",
    linkedin_url: (r.linkedin_url as string) || "",
    created_at: r.created_at as string,
  }));

  // 5. API costs
  const { data: costsRaw } = await service
    .from("api_costs")
    .select("provider, source, estimated_cost")
    .gte("created_at", startIso);

  const byProvider: Record<string, number> = {};
  const bySource: Record<string, number> = {};
  let totalCost = 0;
  for (const c of (costsRaw ?? []) as Array<{ provider: string; source: string; estimated_cost: number }>) {
    const cost = Number(c.estimated_cost);
    totalCost += cost;
    byProvider[c.provider] = (byProvider[c.provider] ?? 0) + cost;
    bySource[c.source] = (bySource[c.source] ?? 0) + cost;
  }

  const totalActions = castingSearches.length + leadsScans.length + lgProfiles.length;

  return {
    newUsers,
    castingSearches,
    leadsScans,
    lgProfiles,
    apiCosts: { total: totalCost, byProvider, bySource },
    summary: {
      newUsersCount: newUsers.length,
      totalActions,
      totalCostUsd: totalCost,
      totalCostBrl: totalCost * 5,
    },
  };
}

export async function saveDailyReport(periodStart: Date, periodEnd: Date, data: ReportData): Promise<string> {
  const service = getService();
  const { data: row, error } = await service
    .from("daily_reports")
    .insert({
      period_start: periodStart.toISOString(),
      period_end: periodEnd.toISOString(),
      report_type: "daily",
      data,
    })
    .select("id")
    .single();

  if (error) throw new Error(`Failed to save report: ${error.message}`);
  return row.id;
}

export async function sendDailyReportEmail(periodStart: Date, periodEnd: Date, data: ReportData, reportId: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) { console.warn("[daily-report] RESEND_API_KEY not set, skipping email"); return; }

  const resend = new Resend(apiKey);
  const dateStr = periodEnd.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
  const s = data.summary;

  const providerLines = Object.entries(data.apiCosts.byProvider)
    .map(([p, c]) => `  - ${p}: $${c.toFixed(4)}`)
    .join("\n");
  const sourceLines = Object.entries(data.apiCosts.bySource)
    .map(([src, c]) => `${src}: $${c.toFixed(4)}`)
    .join(" | ");

  const newUserLines = data.newUsers.length > 0
    ? data.newUsers.map((u) => {
        const prefix = u.sales_contact_interest ? "[LEAD] " : "       ";
        const parts: string[] = [];
        if (u.company_name) parts.push(u.company_name);
        if (u.phone) parts.push(formatBrPhone(u.phone));
        const detail = parts.length > 0 ? ` — ${parts.join(" · ")}` : "";
        return `  - ${prefix}${u.email} (${u.role})${detail} — ${fmtDateShort(u.created_at)}`;
      }).join("\n")
    : "  Nenhum novo usuario";

  const castingLines = data.castingSearches.length > 0
    ? data.castingSearches.map((c) => `  - ${c.user_email} — "${c.query_theme || c.name}" — ${fmtDateShort(c.created_at)}`).join("\n")
    : "  Nenhuma busca";

  const leadsLines = data.leadsScans.length > 0
    ? data.leadsScans.map((l) => `  - ${l.user_email} — ${l.total_engagers} engajadores, ${l.matched_leads} leads — ${fmtDateShort(l.created_at)}`).join("\n")
    : "  Nenhum scan";

  const lgLines = data.lgProfiles.length > 0
    ? data.lgProfiles.map((p) => `  - ${p.user_email} — ${p.name} — ${fmtDateShort(p.created_at)}`).join("\n")
    : "  Nenhum perfil";

  const body = `Relatorio Diario — BubbleIn
Periodo: ${fmtDate(periodStart.toISOString())} a ${fmtDate(periodEnd.toISOString())}

═══════════════════════════════════
RESUMO
═══════════════════════════════════
- Novos usuarios: ${s.newUsersCount}
- Acoes realizadas: ${s.totalActions} (${data.castingSearches.length} buscas, ${data.leadsScans.length} scans, ${data.lgProfiles.length} perfis)
- Custo API estimado: $${s.totalCostUsd.toFixed(4)} (R$${s.totalCostBrl.toFixed(2)})

═══════════════════════════════════
NOVOS USUARIOS (${data.newUsers.length})
═══════════════════════════════════
${newUserLines}

═══════════════════════════════════
ATIVIDADE
═══════════════════════════════════

Buscas Casting (${data.castingSearches.length}):
${castingLines}

Scans de Leads (${data.leadsScans.length}):
${leadsLines}

Perfis Analisados (${data.lgProfiles.length}):
${lgLines}

═══════════════════════════════════
CUSTOS API
═══════════════════════════════════
Total: $${s.totalCostUsd.toFixed(4)} (R$${s.totalCostBrl.toFixed(2)})
${providerLines}
Por fonte: ${sourceLines || "Nenhum custo"}

---
Report ID: ${reportId}
`;

  await resend.emails.send({
    from: "BubbleIn Reports <noreply@bubblein.com.br>",
    to: REPORT_RECIPIENTS,
    subject: `[BubbleIn] Relatorio Diario — ${dateStr}`,
    text: body,
  });

  // Mark as sent
  const service = getService();
  await service.from("daily_reports").update({ sent_at: new Date().toISOString() }).eq("id", reportId);
}
