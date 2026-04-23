import { NextResponse } from "next/server";
import { createServerClient, createServiceClient } from "@/lib/supabase/server";
import { resolveCompanySizes } from "@/lib/company-cache";
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

    const { scanId } = await req.json();
    if (!scanId) return NextResponse.json({ error: "scanId required" }, { status: 400 });

    // Fetch all leads for this scan
    const { data: leads } = await service
      .from("leads_results")
      .select("id, notes")
      .eq("scan_id", scanId);

    if (!leads || leads.length === 0) {
      return NextResponse.json({ error: "No leads found for this scan" }, { status: 404 });
    }

    // Extract company names from leads that don't have company_size yet
    const toEnrich: Array<{ id: string; company: string; notes: Record<string, unknown> }> = [];
    for (const row of leads as Array<{ id: string; notes: unknown }>) {
      const notes = typeof row.notes === "string" ? JSON.parse(row.notes) : (row.notes as Record<string, unknown>);
      const company = String(notes?.company ?? "");
      if (company && !notes?.company_size) {
        toEnrich.push({ id: row.id, company, notes });
      }
    }

    if (toEnrich.length === 0) {
      return NextResponse.json({ enriched: 0, total: leads.length, message: "All leads already enriched" });
    }

    const companyNames = toEnrich.map((r) => r.company);
    console.log(`[leads-enrich] Enriching ${companyNames.length} companies for scan ${scanId}`);

    const companySizes = await resolveCompanySizes(companyNames, user.id, scanId);

    let enriched = 0;
    for (const row of toEnrich) {
      const info = companySizes.get(row.company);
      if (!info) continue;
      const updatedNotes = { ...row.notes, company_size: info.employeeCountRange, company_industry: info.industry };
      await service.from("leads_results").update({ notes: JSON.stringify(updatedNotes) }).eq("id", row.id);
      enriched++;
    }

    console.log(`[leads-enrich] Enriched ${enriched}/${toEnrich.length} leads`);

    return NextResponse.json({ enriched, total: leads.length });
  } catch (err) {
    console.error("[leads-enrich] Error:", err);
    notifyError("leads-enrich", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
