import { NextResponse } from "next/server";
import { createServerClient, createServiceClient } from "@/lib/supabase/server";
import { isApifyBlocked } from "@/lib/apify-usage";

interface ScanBody {
  postUrls: string[];
  icpJobTitles: string[];
  icpDepartments: string[];
  icpCompanySizes: string[];
  icpCompanySize?: string;
  icpProfileId?: string;
  urlProfileId?: string;
}

export async function POST(request: Request) {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (await isApifyBlocked()) {
    return NextResponse.json(
      { error: "Limite mensal de créditos Apify atingido. Contate o admin." },
      { status: 503 }
    );
  }

  const body: ScanBody = await request.json();
  const { postUrls, icpJobTitles, icpDepartments, icpCompanySizes = [], icpCompanySize, icpProfileId, urlProfileId } = body;
  const companySizes = icpCompanySizes.length > 0 ? icpCompanySizes : (icpCompanySize ? [icpCompanySize] : []);

  if (!postUrls || postUrls.length === 0) {
    return NextResponse.json({ error: "At least one post URL is required" }, { status: 400 });
  }

  const service = createServiceClient();

  // Check credits and post limit (15 credits per post link)
  const { data: userRole } = await service.from("user_roles").select("credits").eq("user_id", user.id).single();
  if (!userRole || (userRole.credits !== -1 && userRole.credits <= 0)) {
    return NextResponse.json({ error: "Sem creditos disponiveis" }, { status: 403 });
  }

  if (userRole.credits !== -1) {
    const maxPosts = Math.floor(userRole.credits / 15);
    if (maxPosts === 0) {
      return NextResponse.json({ error: "Créditos insuficientes. São necessários pelo menos 15 créditos por link de post." }, { status: 403 });
    }
    if (postUrls.length > maxPosts) {
      return NextResponse.json({ error: `Você pode analisar no máximo ${maxPosts} post(s) com seus ${userRole.credits} créditos (15 créditos por link).` }, { status: 400 });
    }
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
      icp_profile_id: icpProfileId || null,
      url_profile_id: urlProfileId || null,
    })
    .select()
    .single();

  if (scanError || !scan) {
    console.error("[leads] Failed to create scan:", scanError);
    return NextResponse.json({ error: "Failed to create scan" }, { status: 500 });
  }

  const scanParams = { scanId: scan.id, userId: user.id, postUrls, icpJobTitles, icpDepartments, companySizes };

  // Trigger background processing (fire-and-forget)
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || `http://localhost:${process.env.PORT || 3021}`;
  const bgUrl = `${siteUrl}/api/leads/scan-bg`;

  console.log(`[leads] Triggering background scan at ${bgUrl} for scan ${scan.id}`);
  fetch(bgUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(scanParams),
    signal: AbortSignal.timeout(600_000),
  }).catch(() => { /* fire-and-forget */ });

  return NextResponse.json({ scanId: scan.id });
}
