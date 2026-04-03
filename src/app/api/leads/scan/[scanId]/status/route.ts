import { NextResponse } from "next/server";
import { createServerClient, createServiceClient } from "@/lib/supabase/server";

export async function GET(
  request: Request,
  { params }: { params: { scanId: string } }
) {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { scanId } = params;
  const service = createServiceClient();

  const { data: scan, error: scanError } = await service
    .from("leads_scans")
    .select("*")
    .eq("id", scanId)
    .single();

  if (scanError || !scan) {
    return NextResponse.json({ error: "Scan not found" }, { status: 404 });
  }

  if (scan.user_id !== user.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  // Fetch leads found so far
  const { data: results } = await service
    .from("leads_results")
    .select("*")
    .eq("scan_id", scanId)
    .order("created_at", { ascending: true });

  const leads = (results ?? []).map((r: Record<string, unknown>) => {
    try {
      const notes = typeof r.notes === "string" ? JSON.parse(r.notes as string) : r.notes;
      return { ...notes, slug: r.profile_slug };
    } catch {
      return { slug: r.profile_slug, ...r };
    }
  });

  return NextResponse.json({
    status: scan.status,
    errorMessage: scan.error_message,
    leads,
    found: leads.length,
    totalEngagers: scan.total_engagers ?? 0,
    postsAnalyzed: (scan.post_urls as string[])?.length ?? 0,
  });
}
