import { NextResponse } from "next/server";
import { createServerClient, createServiceClient } from "@/lib/supabase/server";
import { fetchPostEngagers } from "@/lib/apify";
import { fetchLinkedInProfile } from "@/lib/scrapingdog";

interface ScanBody {
  postUrls: string[];
  icpJobTitles: string[];
  icpDepartments: string[];
  icpCompanySizes: string[];
  icpCompanySize?: string; // legacy single value
}

const COMPANY_SIZE_RANGES: Record<string, [number, number]> = {
  "1-10": [1, 10],
  "11-50": [11, 50],
  "51-200": [51, 200],
  "201-500": [201, 500],
  "501-1000": [501, 1000],
  "1001+": [1001, Infinity],
};

function getFollowersRange(n: number): string {
  if (n < 500) return "0–500";
  if (n < 1000) return "500–1K";
  if (n < 2500) return "1K–2.5K";
  if (n < 5000) return "2.5K–5K";
  if (n < 10000) return "5K–10K";
  if (n < 25000) return "10K–25K";
  if (n < 50000) return "25K–50K";
  if (n < 100000) return "50K–100K";
  if (n < 250000) return "100K–250K";
  if (n < 500000) return "250K–500K";
  if (n < 1000000) return "500K–1M";
  return "1M+";
}

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

  // Job title match (50%)
  const matchedTitles = icpJobTitles.filter((title) => searchText.includes(title.toLowerCase()));
  const titleScore = icpJobTitles.length > 0 ? (matchedTitles.length / icpJobTitles.length) * 100 : 50;

  // Department match (30%)
  const matchedDepartments = icpDepartments.filter((dept) => searchText.includes(dept.toLowerCase()));
  const deptScore = icpDepartments.length > 0 ? (matchedDepartments.length / icpDepartments.length) * 100 : 50;

  // Company size match (20%) — matches if company size falls in ANY selected range
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
  // Support both new multi-select and legacy single value
  const companySizes = icpCompanySizes.length > 0 ? icpCompanySizes : (icpCompanySize ? [icpCompanySize] : []);

  if (!postUrls || postUrls.length === 0) {
    return NextResponse.json({ error: "At least one post URL is required" }, { status: 400 });
  }

  const service = createServiceClient();

  // Check credits
  const { data: userRole } = await service.from("user_roles").select("credits").eq("user_id", user.id).single();
  if (!userRole || (userRole.credits !== -1 && userRole.credits <= 0)) {
    return NextResponse.json({ error: "Sem créditos disponíveis" }, { status: 403 });
  }

  // Create scan record
  const { data: scan } = await service
    .from("leads_scans")
    .insert({
      user_id: user.id,
      post_urls: postUrls,
      icp_job_titles: icpJobTitles,
      icp_departments: icpDepartments,
      icp_company_size: companySizes.join(","),
    })
    .select()
    .single();

  // Setup streaming
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();

  (async () => {
    try {
      const seenSlugs = new Set<string>();
      let leadCount = 0;
      let totalEngagers = 0;

      for (const postUrl of postUrls) {
        if (request.signal.aborted) break;

        console.log(`[leads] Processing post: ${postUrl}`);
        const { reactions, comments } = await fetchPostEngagers(postUrl);

        // Extract unique profile slugs from engagers
        const engagers: Array<{ slug: string; type: "reaction" | "comment"; postUrl: string }> = [];

        for (const r of reactions) {
          // Apify returns: { type: "reaction", actor: { name, linkedinUrl, ... } }
          const actor = (r.actor && typeof r.actor === "object" ? r.actor : {}) as Record<string, unknown>;
          const profileUrl = String(
            actor.linkedinUrl ?? actor.url ?? actor.profileUrl
            ?? r.profileUrl ?? r.url ?? r.linkedInUrl ?? r.linkedinUrl
            ?? ""
          );
          const match = profileUrl.match(/linkedin\.com\/in\/([^/?#]+)/);
          if (match) {
            const slug = match[1].toLowerCase().replace(/\/$/, "");
            if (!seenSlugs.has(slug)) {
              seenSlugs.add(slug);
              engagers.push({ slug, type: "reaction", postUrl });
            }
          }
        }

        for (const c of comments) {
          // Apify returns: { type: "comment", actor: { name, linkedinUrl, ... } }
          const actor = (c.actor && typeof c.actor === "object" ? c.actor : {}) as Record<string, unknown>;
          const author = (c.author && typeof c.author === "object" ? c.author : {}) as Record<string, unknown>;
          const profileUrl = String(
            actor.linkedinUrl ?? actor.url ?? actor.profileUrl
            ?? c.authorProfileUrl ?? c.profileUrl ?? c.url
            ?? author.url ?? author.profileUrl ?? author.linkedinUrl
            ?? ""
          );
          const directSlug = String(actor.publicIdentifier ?? author.public_identifier ?? "");
          const match = profileUrl.match(/linkedin\.com\/in\/([^/?#]+)/);
          const extractedSlug = match ? match[1] : directSlug;
          if (extractedSlug) {
            const slug = extractedSlug.toLowerCase().replace(/\/$/, "");
            if (seenSlugs.has(slug)) {
              // Already seen as reaction — upgrade to "both"
              const existing = engagers.find((e) => e.slug === slug);
              if (existing) existing.type = "both" as "reaction";
            } else {
              seenSlugs.add(slug);
              engagers.push({ slug, type: "comment", postUrl });
            }
          }
        }

        totalEngagers += engagers.length;
        console.log(`[leads] Found ${engagers.length} unique engagers from ${postUrl}`);

        // Process each engager
        for (const engager of engagers) {
          if (request.signal.aborted) break;

          // Check credits
          if (userRole.credits !== -1) {
            const { data: currentCredits } = await service
              .from("user_roles")
              .select("credits")
              .eq("user_id", user.id)
              .single();
            if (currentCredits && currentCredits.credits <= 0) {
              try {
                await writer.write(encoder.encode(JSON.stringify({
                  type: "error",
                  data: { message: "Créditos esgotados durante a busca." },
                }) + "\n"));
              } catch { /* disconnected */ }
              break;
            }
          }

          try {
            // Throttle
            await new Promise((r) => setTimeout(r, 1000));

            const result = await fetchLinkedInProfile(engager.slug);
            if (!result || !result.data) continue;
            const profileData = result.data;

            const { score, matchedTitles, matchedDepartments, companySizeMatch } = scoreIcpMatch(
              profileData,
              icpJobTitles,
              icpDepartments,
              companySizes
            );

            const followers = Number(profileData.followers ?? profileData.follower_count ?? 0);
            const name = String(profileData.fullName ?? profileData.full_name ?? profileData.name ?? "Unknown");
            const headline = String(profileData.headline ?? profileData.sub_title ?? "");
            const company = String(profileData.company ?? profileData.current_company ?? "");
            const location = String(profileData.location ?? "");
            const profilePhoto = String(profileData.profile_photo ?? profileData.profile_pic_url ?? "");

            const lead = {
              slug: engager.slug,
              name,
              headline,
              company,
              location,
              followers,
              followers_range: getFollowersRange(followers),
              linkedin_url: `https://linkedin.com/in/${engager.slug}`,
              profile_photo: profilePhoto,
              icp_score: score,
              matched_titles: matchedTitles,
              matched_departments: matchedDepartments,
              company_size_match: companySizeMatch,
              engagement_type: engager.type,
              source_post_url: engager.postUrl,
            };

            // Save to DB
            if (scan) {
              await service.from("leads_results").insert({
                scan_id: scan.id,
                profile_slug: engager.slug,
                notes: JSON.stringify(lead),
                icp_score: score,
                engagement_type: engager.type,
                source_post_url: engager.postUrl,
              });
            }

            // Deduct credit
            if (userRole.credits !== -1) {
              await service
                .from("user_roles")
                .update({ credits: Math.max(0, (userRole.credits as number) - 1) })
                .eq("user_id", user.id);
            }

            leadCount++;

            // Stream to client
            try {
              await writer.write(encoder.encode(JSON.stringify({ type: "lead", data: lead }) + "\n"));
            } catch { break; }
          } catch (err) {
            console.error(`[leads] Error processing ${engager.slug}:`, err);
          }
        }
      }

      // Update scan totals
      if (scan) {
        await service
          .from("leads_scans")
          .update({ total_engagers: totalEngagers, matched_leads: leadCount })
          .eq("id", scan.id);
      }

      // Send done event
      try {
        await writer.write(encoder.encode(JSON.stringify({
          type: "done",
          data: { totalEngagers, matchedLeads: leadCount, scanId: scan?.id, postsAnalyzed: postUrls.length },
        }) + "\n"));
      } catch { /* disconnected */ }
    } catch (e) {
      console.error("[leads] Scan error:", e);
      try {
        await writer.write(encoder.encode(JSON.stringify({
          type: "error",
          data: { message: String(e) },
        }) + "\n"));
      } catch { /* disconnected */ }
    } finally {
      try { await writer.close(); } catch { /* already closed */ }
    }
  })();

  return new Response(readable, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}
