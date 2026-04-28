import { NextResponse } from "next/server";
import { createServerClient, createServiceClient } from "@/lib/supabase/server";
import { fetchLinkedInProfileCached } from "@/lib/apify";
import { resolveCompanySizes } from "@/lib/company-cache";
import { logApiCost, API_COSTS } from "@/lib/api-costs";
import { notifyError } from "@/lib/error-notifier";

export async function POST(req: Request) {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const service = await createServiceClient();

    // Check admin role
    const { data: userRole } = await service
      .from("user_roles")
      .select("role, credits")
      .eq("user_id", user.id)
      .single();

    if (!userRole || (userRole.role !== "admin" && userRole.credits !== -1)) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const body = await req.json();
    const scanId = body?.scanId;
    console.log("[leads-enrich] Received request. scanId:", scanId);
    if (!scanId) return NextResponse.json({ error: "scanId required" }, { status: 400 });

    // Fetch all leads for this scan
    const { data: leads } = await service
      .from("leads_results")
      .select("id, profile_slug, notes")
      .eq("scan_id", scanId);

    if (!leads || leads.length === 0) {
      return NextResponse.json({ error: "No leads found for this scan" }, { status: 404 });
    }

    console.log(`[leads-enrich] Found ${leads.length} leads for scan ${scanId}`);

    // Step 1: For leads with empty company, fetch LinkedIn profile to extract company
    let profilesFetched = 0;
    for (const row of leads as Array<{ id: string; profile_slug: string; notes: unknown }>) {
      const notes = typeof row.notes === "string" ? JSON.parse(row.notes) : (row.notes as Record<string, unknown>);
      const company = String(notes?.company ?? "");
      if (company) continue; // already has company

      const slug = row.profile_slug || String(notes?.slug ?? "");
      if (!slug) continue;

      try {
        console.log(`[leads-enrich] Fetching profile for ${slug} (no company)`);
        const result = await fetchLinkedInProfileCached(slug);
        const profile = result?.data;
        if (profile) {
          // Extract company from various field names (harvestapi format varies)
          let extractedCompany = "";
          const cp = profile.currentPosition || profile.positions || profile.position;
          const exp = profile.experience || profile.experiences;

          if (cp && Array.isArray(cp) && cp.length > 0) {
            extractedCompany = cp[0]?.companyName || cp[0]?.company || cp[0]?.companyName1 || "";
          }
          if (!extractedCompany && exp && Array.isArray(exp) && exp.length > 0) {
            extractedCompany = exp[0]?.companyName || exp[0]?.company || "";
          }
          if (!extractedCompany && profile.companyName) {
            extractedCompany = String(profile.companyName);
          }
          if (!extractedCompany && profile.company && typeof profile.company === "string") {
            extractedCompany = profile.company;
          }

          if (extractedCompany) {
            // Preserve existing photo, try to get better one from profile if missing
            const existingPhoto = String(notes?.profile_photo ?? "");
            let photo = existingPhoto;
            if (!photo || !photo.startsWith("http")) {
              const candidates = [profile.profilePicture, profile.profile_photo, profile.profile_pic_url, profile.photo];
              for (const c of candidates) {
                const val = typeof c === "string" ? c : typeof c === "object" && c ? Object.values(c).find((v) => typeof v === "string" && String(v).startsWith("http")) as string : "";
                if (val && String(val).startsWith("http")) { photo = String(val); break; }
              }
            }
            const updatedNotes = {
              ...notes,
              company: extractedCompany,
              profile_photo: photo,
              job_title: notes?.job_title || (cp && Array.isArray(cp) && cp[0]?.title) || "",
              headline: notes?.headline || profile.headline || profile.summary || "",
            };
            await service.from("leads_results").update({ notes: JSON.stringify(updatedNotes) }).eq("id", row.id);
            profilesFetched++;
            console.log(`[leads-enrich] ${slug} → company: ${extractedCompany}`);
          }

          logApiCost({
            userId: user.id, source: "leads", searchId: scanId,
            provider: "apify", operation: "fetchLinkedInProfileApify",
            estimatedCost: API_COSTS.apify.fetchLinkedInProfileApify,
            metadata: { slug, context: "enrich" },
          });
        }
      } catch (err) {
        console.error(`[leads-enrich] Failed to fetch profile ${slug}:`, (err as Error).message);
      }
    }

    console.log(`[leads-enrich] Step 1 done: fetched ${profilesFetched} profiles`);

    // Step 2: Re-read leads (now with companies) and resolve company sizes
    const { data: updatedLeads } = await service
      .from("leads_results")
      .select("id, notes")
      .eq("scan_id", scanId);

    const toEnrich: Array<{ id: string; company: string; notes: Record<string, unknown> }> = [];
    for (const row of (updatedLeads ?? []) as Array<{ id: string; notes: unknown }>) {
      const notes = typeof row.notes === "string" ? JSON.parse(row.notes) : (row.notes as Record<string, unknown>);
      const company = String(notes?.company ?? "");
      if (company) {
        toEnrich.push({ id: row.id, company, notes });
      }
    }

    console.log(`[leads-enrich] Step 2: ${toEnrich.length} leads have company for size enrichment`);

    let enriched = 0;
    if (toEnrich.length > 0) {
      const companyNames = toEnrich.map((r) => r.company);
      const companySizes = await resolveCompanySizes(companyNames, user.id, scanId);

      for (const row of toEnrich) {
        const info = companySizes.get(row.company);
        if (!info) continue;
        const updatedNotes = { ...row.notes, company_size: info.employeeCountRange, company_industry: info.industry };
        await service.from("leads_results").update({ notes: JSON.stringify(updatedNotes) }).eq("id", row.id);
        enriched++;
      }
    }

    console.log(`[leads-enrich] Done: ${profilesFetched} profiles fetched, ${enriched}/${toEnrich.length} companies enriched`);

    return NextResponse.json({ enriched, profilesFetched, total: leads.length });
  } catch (err) {
    console.error("[leads-enrich] Error:", err);
    notifyError("leads-enrich", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
