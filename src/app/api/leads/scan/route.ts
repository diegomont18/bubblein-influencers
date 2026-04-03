import { NextResponse } from "next/server";
import { createServerClient, createServiceClient } from "@/lib/supabase/server";

interface ScanBody {
  postUrls: string[];
  icpJobTitles: string[];
  icpDepartments: string[];
  icpCompanySizes: string[];
  icpCompanySize?: string;
}

export async function POST(request: Request) {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body: ScanBody = await request.json();
  const { postUrls, icpJobTitles, icpDepartments, icpCompanySizes = [], icpCompanySize } = body;
  const companySizes = icpCompanySizes.length > 0 ? icpCompanySizes : (icpCompanySize ? [icpCompanySize] : []);

  if (!postUrls || postUrls.length === 0) {
    return NextResponse.json({ error: "At least one post URL is required" }, { status: 400 });
  }

  const service = createServiceClient();

  // Check credits
  const { data: userRole } = await service.from("user_roles").select("credits").eq("user_id", user.id).single();
  if (!userRole || (userRole.credits !== -1 && userRole.credits <= 0)) {
    return NextResponse.json({ error: "Sem creditos disponiveis" }, { status: 403 });
  }

  // Create scan record with status "processing"
  const { data: scan, error: scanError } = await service
    .from("leads_scans")
    .insert({
      user_id: user.id,
      post_urls: postUrls,
      icp_job_titles: icpJobTitles,
      icp_departments: icpDepartments,
      icp_company_size: companySizes.join(","),
      status: "processing",
    })
    .select()
    .single();

  if (scanError || !scan) {
    console.error("[leads] Failed to create scan:", scanError);
    return NextResponse.json({ error: "Failed to create scan" }, { status: 500 });
  }

  // Trigger background function
  const siteUrl = process.env.URL || process.env.NEXT_PUBLIC_SITE_URL || "";
  const bgUrl = `${siteUrl}/.netlify/functions/leads-scan-background`;

  console.log(`[leads] Triggering background scan at ${bgUrl} for scan ${scan.id}`);

  try {
    await fetch(bgUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        scanId: scan.id,
        userId: user.id,
        postUrls,
        icpJobTitles,
        icpDepartments,
        companySizes,
      }),
    });
    console.log(`[leads] Background scan triggered for ${scan.id}`);
  } catch (err) {
    console.error("[leads] Failed to trigger background scan:", err);
    await service.from("leads_scans").update({
      status: "error",
      error_message: "Failed to start background scan",
    }).eq("id", scan.id);
    return NextResponse.json({ error: "Failed to start scan" }, { status: 500 });
  }

  return NextResponse.json({ scanId: scan.id });
}
