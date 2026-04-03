import type { Handler, HandlerEvent } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
import { fetchPostEngagers } from "../../src/lib/apify";
import { fetchLinkedInProfile } from "../../src/lib/scrapingdog";

interface ScanParams {
  scanId: string;
  userId: string;
  postUrls: string[];
  icpJobTitles: string[];
  icpDepartments: string[];
  companySizes: string[];
}

const COMPANY_SIZE_RANGES: Record<string, [number, number]> = {
  "1-10": [1, 10],
  "11-50": [11, 50],
  "51-200": [51, 200],
  "201-500": [201, 500],
  "501-1000": [501, 1000],
  "1001+": [1001, Infinity],
};

function scoreIcpMatch(
  profile: Record<string, unknown>,
  icpJobTitles: string[],
  icpDepartments: string[],
  icpCompanySizes: string[]
): { score: number; matchedTitles: string[]; matchedDepartments: string[]; companySizeMatch: boolean } {
  const headline = String(profile.headline ?? profile.sub_title ?? "").toLowerCase();
  const role = String(profile.role_current ?? profile.current_company_position ?? "").toLowerCase();
  const about = String(profile.about ?? "").toLowerCase();
  const searchText = `${headline} ${role} ${about}`;

  const matchedTitles = icpJobTitles.filter((title) => searchText.includes(title.toLowerCase()));
  const titleScore = icpJobTitles.length > 0 ? (matchedTitles.length / icpJobTitles.length) * 100 : 50;

  const matchedDepartments = icpDepartments.filter((dept) => searchText.includes(dept.toLowerCase()));
  const deptScore = icpDepartments.length > 0 ? (matchedDepartments.length / icpDepartments.length) * 100 : 50;

  let companySizeMatch = false;
  const companySize = Number(profile.company_size ?? profile.current_company_size ?? 0);
  for (const sizeKey of icpCompanySizes) {
    const range = COMPANY_SIZE_RANGES[sizeKey];
    if (range && companySize >= range[0] && companySize <= range[1]) {
      companySizeMatch = true;
      break;
    }
  }
  const sizeScore = companySizeMatch ? 100 : 0;

  const score = Math.round(titleScore * 0.5 + deptScore * 0.3 + sizeScore * 0.2);
  return { score, matchedTitles, matchedDepartments, companySizeMatch };
}

// LinkedIn internal IDs (ACoAA...) return "Unknown" profiles — skip them
function isInternalLinkedInId(slug: string): boolean {
  return /^acoa[a-z0-9_-]{20,}$/i.test(slug);
}

const handler: Handler = async (event: HandlerEvent) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const params: ScanParams = JSON.parse(event.body || "{}");
  const { scanId, userId, postUrls, icpJobTitles, icpDepartments, companySizes } = params;

  const service = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    const seenSlugs = new Set<string>();
    let leadCount = 0;
    let totalEngagers = 0;
    let skippedInternal = 0;

    // Check credits
    const { data: userRole } = await service.from("user_roles").select("credits").eq("user_id", userId).single();

    for (const postUrl of postUrls) {
      console.log(`[leads] Processing post: ${postUrl}`);
      const { reactions, comments } = await fetchPostEngagers(postUrl);

      const engagers: Array<{ slug: string; type: "reaction" | "comment"; postUrl: string }> = [];

      for (const r of reactions) {
        const actor = (r.actor && typeof r.actor === "object" ? r.actor : {}) as Record<string, unknown>;
        const profileUrl = String(actor.linkedinUrl ?? actor.url ?? actor.profileUrl ?? r.profileUrl ?? r.url ?? "");
        const match = profileUrl.match(/linkedin\.com\/in\/([^/?#]+)/);
        if (match) {
          const slug = match[1].toLowerCase().replace(/\/$/, "");
          if (isInternalLinkedInId(slug)) { skippedInternal++; continue; }
          if (!seenSlugs.has(slug)) {
            seenSlugs.add(slug);
            engagers.push({ slug, type: "reaction", postUrl });
          }
        }
      }

      for (const c of comments) {
        const actor = (c.actor && typeof c.actor === "object" ? c.actor : {}) as Record<string, unknown>;
        const author = (c.author && typeof c.author === "object" ? c.author : {}) as Record<string, unknown>;
        const profileUrl = String(
          actor.linkedinUrl ?? actor.url ?? actor.profileUrl
          ?? c.authorProfileUrl ?? c.profileUrl ?? c.url
          ?? author.url ?? author.profileUrl ?? author.linkedinUrl ?? ""
        );
        const directSlug = String(actor.publicIdentifier ?? author.public_identifier ?? "");
        const match = profileUrl.match(/linkedin\.com\/in\/([^/?#]+)/);
        const extractedSlug = match ? match[1] : directSlug;
        if (extractedSlug) {
          const slug = extractedSlug.toLowerCase().replace(/\/$/, "");
          if (isInternalLinkedInId(slug)) { skippedInternal++; continue; }
          if (seenSlugs.has(slug)) {
            const existing = engagers.find((e) => e.slug === slug);
            if (existing) existing.type = "both" as "reaction";
          } else {
            seenSlugs.add(slug);
            engagers.push({ slug, type: "comment", postUrl });
          }
        }
      }

      totalEngagers += engagers.length;
      console.log(`[leads] Found ${engagers.length} unique engagers from ${postUrl} (skipped ${skippedInternal} internal IDs)`);

      for (const engager of engagers) {
        // Check credits
        if (userRole && userRole.credits !== -1) {
          const { data: currentCredits } = await service
            .from("user_roles").select("credits").eq("user_id", userId).single();
          if (currentCredits && currentCredits.credits <= 0) {
            console.log("[leads] Credits exhausted");
            break;
          }
        }

        try {
          await new Promise((r) => setTimeout(r, 1000));

          const result = await fetchLinkedInProfile(engager.slug);
          if (!result || !result.data) continue;
          const profileData = result.data;

          const name = String(profileData.fullName ?? profileData.full_name ?? profileData.name ?? "");
          // Skip profiles with no real name (Unknown/empty)
          if (!name || name === "Unknown" || name.length < 2) {
            console.log(`[leads] Skipping ${engager.slug}: no real name`);
            continue;
          }

          const { score, matchedTitles, matchedDepartments, companySizeMatch } = scoreIcpMatch(
            profileData, icpJobTitles, icpDepartments, companySizes
          );

          const followers = Number(profileData.followers ?? profileData.follower_count ?? 0);
          const headline = String(profileData.headline ?? profileData.sub_title ?? "");
          const company = String(profileData.company ?? profileData.current_company ?? "");
          const location = String(profileData.location ?? "");
          const profilePhoto = String(profileData.profile_photo ?? profileData.profile_pic_url ?? "");
          const jobTitle = String(profileData.role_current ?? profileData.current_company_position ?? profileData.title ?? "");

          const lead = {
            slug: engager.slug,
            name,
            headline,
            job_title: jobTitle,
            company,
            location,
            followers,
            linkedin_url: `https://linkedin.com/in/${engager.slug}`,
            profile_photo: profilePhoto,
            icp_score: score,
            matched_titles: matchedTitles,
            matched_departments: matchedDepartments,
            company_size_match: companySizeMatch,
            engagement_type: engager.type,
            source_post_url: engager.postUrl,
          };

          await service.from("leads_results").insert({
            scan_id: scanId,
            profile_slug: engager.slug,
            notes: JSON.stringify(lead),
            icp_score: score,
            engagement_type: engager.type,
            source_post_url: engager.postUrl,
          });

          // Deduct credit
          if (userRole && userRole.credits !== -1) {
            await service
              .from("user_roles")
              .update({ credits: Math.max(0, (userRole.credits as number) - 1) })
              .eq("user_id", userId);
          }

          leadCount++;
        } catch (err) {
          console.error(`[leads] Error processing ${engager.slug}:`, err);
        }
      }
    }

    // Update scan totals and status
    await service
      .from("leads_scans")
      .update({ total_engagers: totalEngagers, matched_leads: leadCount, status: "complete" })
      .eq("id", scanId);

    console.log(`[leads] Scan complete. ${leadCount} leads from ${totalEngagers} engagers (${skippedInternal} internal IDs skipped)`);

  } catch (e) {
    console.error("[leads] Background scan error:", e);
    await service.from("leads_scans").update({
      status: "error",
      error_message: String(e),
    }).eq("id", scanId);
  }

  return { statusCode: 202, body: "OK" };
};

export { handler };
