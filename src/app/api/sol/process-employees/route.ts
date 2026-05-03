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
  followers?: number;
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
      const needsPhotoRetry = !!emp.headline && !emp.profilePicUrl;

      if (!isPending && !needsPhotoRetry) {
        enriched.push(emp);
        continue;
      }

      // Photo-only retry: re-fetch profile (skip cache) but don't re-fetch posts
      if (needsPhotoRetry) {
        console.log(`[process-employees] Photo retry ${emp.slug}`);
        try {
          const result = await fetchLinkedInProfileCached(emp.slug, solCostCtx, { skipCache: true });
          if (result.status === 200 && result.data) {
            const pic = String(result.data.profilePicture ?? result.data.profile_pic_url ?? "");
            const followers = typeof result.data.followers === "number" ? result.data.followers
              : typeof result.data.follower_count === "number" ? (result.data.follower_count as number)
              : emp.followers;
            enriched.push({ ...emp, profilePicUrl: pic || emp.profilePicUrl, followers });
          } else {
            enriched.push(emp);
          }
        } catch (err) {
          console.error(`[process-employees] Photo retry failed ${emp.slug}:`, err);
          enriched.push(emp);
        }
        continue;
      }

      console.log(`[process-employees] Enriching ${emp.slug}`);
      try {
        const result = await fetchLinkedInProfileCached(emp.slug, solCostCtx);

        if (result.status === 200 && result.data) {
          const d = result.data;
          const empPosts = await fetchProfilePostsCached(`https://www.linkedin.com/in/${emp.slug}/`, 20);
          logApiCost({
            userId: ownerId,
            source: "sol",
            provider: "apify",
            operation: "fetchProfilePosts",
            estimatedCost: API_COSTS.apify.fetchProfilePosts,
            metadata: { slug: emp.slug, context: "process-employees", actorUserId: user.id },
          });

          const followers = typeof d.followers === "number" ? d.followers
            : typeof d.follower_count === "number" ? (d.follower_count as number)
            : undefined;

          enriched.push({
            name: String(d.name ?? d.fullName ?? emp.name),
            slug: emp.slug,
            headline: String(d.headline ?? ""),
            linkedinUrl: emp.linkedinUrl,
            profilePicUrl: String(d.profilePicture ?? d.profile_pic_url ?? ""),
            postsPerMonth: computePostsPerMonth(empPosts),
            followers,
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
