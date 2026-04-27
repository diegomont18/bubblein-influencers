import { NextResponse } from "next/server";
import { checkAdmin } from "@/lib/auth/check-admin";
import { createServiceClient } from "@/lib/supabase/server";
import { notifyError } from "@/lib/error-notifier";

export const dynamic = "force-dynamic";

export async function GET() {
  const { isAdmin } = await checkAdmin();
  if (!isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const service = createServiceClient();

  // Build user email cache
  const userEmails = new Map<string, string>();
  try {
    const { data: { users } } = await service.auth.admin.listUsers();
    for (const u of users ?? []) {
      userEmails.set(u.id, u.email ?? "—");
    }
  } catch { /* ignore */ }

  // 1. Mapeamento (lg_profiles + lg_options)
  const { data: profiles } = await service
    .from("lg_profiles")
    .select("id, name, linkedin_url, user_id, created_at")
    .order("created_at", { ascending: false });

  const profileIds = (profiles ?? []).map((p) => p.id);

  let optionsMap = new Map<string, { confirmed_at: string | null; competitors: unknown[] }>();
  if (profileIds.length > 0) {
    const { data: opts } = await service
      .from("lg_options")
      .select("profile_id, confirmed_at, competitors")
      .in("profile_id", profileIds);
    for (const o of opts ?? []) {
      const comps = Array.isArray(o.competitors) ? o.competitors : [];
      optionsMap.set(o.profile_id, { confirmed_at: o.confirmed_at, competitors: comps });
    }
  }

  const mapeamentos = (profiles ?? []).map((p) => {
    const opt = optionsMap.get(p.id);
    const selectedComps = (opt?.competitors ?? []).filter(
      (c: unknown) => typeof c === "object" && c !== null && (c as Record<string, unknown>).selected
    ).length;
    return {
      id: p.id,
      name: p.name,
      linkedin_url: p.linkedin_url,
      user_email: userEmails.get(p.user_id) ?? "—",
      created_at: p.created_at,
      confirmed_at: opt?.confirmed_at ?? null,
      competitors_count: selectedComps,
    };
  });

  // 2. Relatórios (sol_reports)
  const { data: reports } = await service
    .from("sol_reports")
    .select("id, profile_id, period_start, period_end, status, created_at")
    .order("created_at", { ascending: false });

  const reportProfileIds = Array.from(new Set((reports ?? []).map((r) => r.profile_id)));
  const reportProfileMap = new Map<string, { name: string; user_id: string }>();
  if (reportProfileIds.length > 0) {
    const { data: rProfiles } = await service
      .from("lg_profiles")
      .select("id, name, user_id")
      .in("id", reportProfileIds);
    for (const p of rProfiles ?? []) {
      reportProfileMap.set(p.id, { name: p.name, user_id: p.user_id });
    }
  }

  // Count posts per report
  const postCountMap = new Map<string, number>();
  if ((reports ?? []).length > 0) {
    const reportIds = (reports ?? []).map((r) => r.id);
    const { data: postCounts } = await service
      .from("sol_posts")
      .select("report_id")
      .in("report_id", reportIds);
    for (const pc of postCounts ?? []) {
      postCountMap.set(pc.report_id, (postCountMap.get(pc.report_id) ?? 0) + 1);
    }
  }

  const relatorios = (reports ?? []).map((r) => {
    const prof = reportProfileMap.get(r.profile_id);
    return {
      id: r.id,
      profile_name: prof?.name ?? "—",
      user_email: userEmails.get(prof?.user_id ?? "") ?? "—",
      period_start: r.period_start,
      period_end: r.period_end,
      status: r.status,
      posts_count: postCountMap.get(r.id) ?? 0,
      created_at: r.created_at,
    };
  });

  // 3. Influencers (casting_lists)
  const { data: castingLists } = await service
    .from("casting_lists")
    .select("id, name, query_theme, created_by, created_at")
    .order("created_at", { ascending: false });

  const listIds = (castingLists ?? []).map((cl) => cl.id);
  const listCountMap = new Map<string, number>();
  if (listIds.length > 0) {
    const { data: listProfiles } = await service
      .from("casting_list_profiles")
      .select("list_id")
      .in("list_id", listIds);
    for (const lp of listProfiles ?? []) {
      listCountMap.set(lp.list_id, (listCountMap.get(lp.list_id) ?? 0) + 1);
    }
  }

  const influencers = (castingLists ?? []).map((cl) => ({
    id: cl.id,
    name: cl.name,
    query_theme: cl.query_theme,
    user_email: cl.created_by ?? "—",
    profiles_count: listCountMap.get(cl.id) ?? 0,
    created_at: cl.created_at,
  }));

  // 4. Leads (lg_profiles with lg_results)
  const leadsCountMap = new Map<string, number>();
  if (profileIds.length > 0) {
    const { data: lgResults } = await service
      .from("lg_results")
      .select("profile_id")
      .in("profile_id", profileIds);
    for (const r of lgResults ?? []) {
      leadsCountMap.set(r.profile_id, (leadsCountMap.get(r.profile_id) ?? 0) + 1);
    }
  }

  const leads = (profiles ?? [])
    .filter((p) => (leadsCountMap.get(p.id) ?? 0) > 0)
    .map((p) => ({
      id: p.id,
      name: p.name,
      linkedin_url: p.linkedin_url,
      user_email: userEmails.get(p.user_id) ?? "—",
      leads_count: leadsCountMap.get(p.id) ?? 0,
      created_at: p.created_at,
    }));

  return NextResponse.json({ mapeamentos, relatorios, influencers, leads });
}

export async function DELETE(request: Request) {
  const { isAdmin } = await checkAdmin();
  if (!isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  try {
    const { type, id } = await request.json();
    if (!type || !id) return NextResponse.json({ error: "type and id required" }, { status: 400 });

    const service = createServiceClient();

    if (type === "mapeamento") {
      await service.from("lg_profiles").delete().eq("id", id);
    } else if (type === "relatorio") {
      await service.from("sol_posts").delete().eq("report_id", id);
      await service.from("sol_reports").delete().eq("id", id);
    } else if (type === "influencer") {
      await service.from("casting_lists").delete().eq("id", id);
    } else if (type === "lead") {
      await service.from("lg_results").delete().eq("profile_id", id);
    } else {
      return NextResponse.json({ error: "Invalid type" }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[dashboard-relatorios] Delete error:", err);
    notifyError("dashboard-relatorios-delete", err);
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}
