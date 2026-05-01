import { NextResponse } from "next/server";
import { createServerClient, createServiceClient } from "@/lib/supabase/server";
import { fetchLinkedInProfileCached, fetchProfilePostsCached } from "@/lib/apify";
import { logApiCost, API_COSTS } from "@/lib/api-costs";
import { notifyError } from "@/lib/error-notifier";
import { computePostsPerMonth } from "@/lib/find-employees";
import {
  assertCanEdit,
  respondAccessError,
  ResourceAccessError,
} from "@/lib/resource-access";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

interface EmployeeProfile {
  name: string;
  slug: string;
  headline: string;
  linkedinUrl: string;
  profilePicUrl?: string;
  postsPerMonth?: number;
}

export async function POST(request: Request) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let ownerId = user.id;
  try {
    const { profileId } = await request.json();
    if (!profileId) return NextResponse.json({ error: "profileId required" }, { status: 400 });

    try {
      const access = await assertCanEdit(user.id, "lg_profile", profileId);
      ownerId = access.ownerId;
    } catch (err) {
      if (err instanceof ResourceAccessError) return respondAccessError(err);
      throw err;
    }

    const service = createServiceClient();
    const { data: profile } = await service
      .from("lg_profiles")
      .select("id")
      .eq("id", profileId)
      .single();
    if (!profile) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const { data: optionsRow } = await service
      .from("lg_options")
      .select("employee_profiles")
      .eq("profile_id", profileId)
      .single();
    if (!optionsRow) return NextResponse.json({ error: "Options not found" }, { status: 404 });

    const employees = (optionsRow.employee_profiles ?? []) as EmployeeProfile[];
    const enriched: EmployeeProfile[] = [];

    const solCostCtx = { userId: ownerId, source: "sol" as const };

    for (const emp of employees) {
      const isPending = !emp.headline && !emp.profilePicUrl;
      if (!isPending) {
        enriched.push(emp);
        continue;
      }

      console.log(`[process-employees] Enriching ${emp.slug}`);
      try {
        const result = await fetchLinkedInProfileCached(emp.slug, solCostCtx);

        if (result.status === 200 && result.data) {
          const d = result.data;
          const empPosts = await fetchProfilePostsCached(`https://www.linkedin.com/in/${emp.slug}/`, 5);
          logApiCost({
            userId: ownerId,
            source: "sol",
            provider: "apify",
            operation: "fetchProfilePosts",
            estimatedCost: API_COSTS.apify.fetchProfilePosts,
            metadata: { slug: emp.slug, context: "process-employees", actorUserId: user.id },
          });

          enriched.push({
            name: String(d.name ?? d.fullName ?? emp.name),
            slug: emp.slug,
            headline: String(d.headline ?? ""),
            linkedinUrl: emp.linkedinUrl,
            profilePicUrl: String(d.profilePicture ?? d.profile_pic_url ?? ""),
            postsPerMonth: computePostsPerMonth(empPosts),
          });
        } else {
          enriched.push(emp);
        }
      } catch (err) {
        console.error(`[process-employees] Failed to enrich ${emp.slug}:`, err);
        enriched.push(emp);
      }
    }

    const { error: updateError } = await service
      .from("lg_options")
      .update({
        employee_profiles: enriched,
        updated_at: new Date().toISOString(),
      })
      .eq("profile_id", profileId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    const enrichedCount = enriched.filter((e) => !!e.headline).length;
    console.log(`[process-employees] Done: ${enriched.length} employees (${enrichedCount} enriched)`);

    return NextResponse.json({ employees: enriched });
  } catch (err) {
    console.error("[process-employees] Error:", err);
    notifyError("process-employees", err, { userId: user.id });
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
