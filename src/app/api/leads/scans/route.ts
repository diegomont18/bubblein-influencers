import { NextResponse } from "next/server";
import { createServerClient, createServiceClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const service = createServiceClient();

  // Fetch all user's scans with result counts
  const { data: scans, error } = await service
    .from("leads_scans")
    .select("id, post_urls, icp_job_titles, icp_departments, icp_company_size, total_engagers, matched_leads, status, created_at, icp_profile_id, url_profile_id, icp_profiles(name), url_profiles(name)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // For each scan, fetch the leads
  const scansWithLeads = await Promise.all(
    (scans ?? []).map(async (scan: Record<string, unknown>) => {
      const { data: results } = await service
        .from("leads_results")
        .select("*")
        .eq("scan_id", scan.id as string)
        .order("created_at", { ascending: true });

      const leads = (results ?? []).map((r: Record<string, unknown>) => {
        try {
          const notes = typeof r.notes === "string" ? JSON.parse(r.notes as string) : r.notes;
          return { ...notes, slug: r.profile_slug };
        } catch {
          return { slug: r.profile_slug, ...r };
        }
      });

      return { ...scan, leads };
    })
  );

  return NextResponse.json({ scans: scansWithLeads });
}
