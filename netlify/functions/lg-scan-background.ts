import type { Handler, HandlerEvent } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
import { fetchPostEngagers, fetchProfilePosts, fetchLinkedInProfileApify } from "../../src/lib/apify";
import { batchScoreIcpMatch, extractCompaniesFromHeadlines } from "../../src/lib/ai";
import { logApiCost, API_COSTS } from "../../src/lib/api-costs";
import { notifyError } from "../../src/lib/error-notifier";
import { matchesCompanyBlacklist } from "../../src/lib/company-match";

interface ScanParams {
  userId: string;
  profileId: string;
  postsToScan: Array<{ id?: string; post_url: string | null; relevance_score: number | null }>;
  jobTitles: string[];
  departments: string[];
  maxLeads: number;
  fetchMorePosts?: boolean;
  linkedinUrl?: string;
  existingPostUrns?: string[];
}

interface EngagerInfo {
  id: string;
  name: string;
  position: string;
  linkedinUrl: string;
  pictureUrl: string;
  interactions: Map<string, "reaction" | "comment">;
}

function extractSlugOrId(linkedinUrl: string): string {
  const match = linkedinUrl.match(/linkedin\.com\/in\/([^/?#]+)/);
  return match ? match[1].toLowerCase().replace(/\/$/, "") : "";
}

const handler: Handler = async (event: HandlerEvent) => {
  if (!event.body) return { statusCode: 400, body: "Missing body" };

  const params: ScanParams = JSON.parse(event.body);
  const { userId, profileId, jobTitles, departments, maxLeads, fetchMorePosts, linkedinUrl, existingPostUrns } = params;
  let { postsToScan } = params;

  const service = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  try {
    let morePostsFetched = 0;
    let newPostsFound = 0;

    // If repeat scan, fetch more posts from LinkedIn first
    if (fetchMorePosts && linkedinUrl) {
      const existingCount = postsToScan.length;
      const fetchCount = existingCount + 10;
      console.log(`[lg-scan] Fetching ${fetchCount} posts from ${linkedinUrl} (had ${existingCount})...`);

      const morePosts = await fetchProfilePosts(linkedinUrl, fetchCount);
      logApiCost({ userId, source: "leads", searchId: profileId, provider: "apify", operation: "fetchProfilePosts", estimatedCost: API_COSTS.apify.fetchProfilePosts, metadata: { fetchCount, fetched: morePosts.length } });
      morePostsFetched = morePosts.length;
      console.log(`[lg-scan] Apify returned ${morePosts.length} posts`);

      const existingUrns = new Set(existingPostUrns ?? []);
      const newPosts = morePosts.map((p) => {
        const shareUrn = String(p.shareUrn ?? p.entityId ?? "");
        const postUrl = shareUrn.includes("urn:li:") ? `https://www.linkedin.com/feed/update/${shareUrn}` : "";
        const urnId = shareUrn.match(/(\d+)$/)?.[1] ?? "";
        return { post_url: postUrl, text_content: String(p.content ?? p.text ?? p.postText ?? ""), urnId };
      }).filter((p) => p.post_url && p.urnId && !existingUrns.has(p.urnId));

      newPostsFound = newPosts.length;
      console.log(`[lg-scan] Found ${newPosts.length} new posts not yet stored`);

      if (newPosts.length > 0) {
        // Save new posts to DB
        const toInsert = newPosts.map((p) => ({
          profile_id: profileId,
          post_url: p.post_url,
          text_content: p.text_content,
          reactions: 0,
          comments: 0,
          posted_at: "",
        }));
        await service.from("lg_posts").insert(toInsert);

        // Add new posts to postsToScan
        const newPostEntries = newPosts.map((p) => ({ post_url: p.post_url, relevance_score: 50 }));
        postsToScan = [...postsToScan, ...newPostEntries];
        console.log(`[lg-scan] Total posts to scan: ${postsToScan.length} (${newPosts.length} new)`);
      }
    }

    const totalPossibleInteractions = postsToScan.length * 2;
    const engagerMap = new Map<string, EngagerInfo>();

    for (const post of postsToScan) {
      if (!post.post_url) continue;
      console.log(`[lg-scan] Processing post: ${post.post_url}`);
      const { reactions, comments } = await fetchPostEngagers(post.post_url);
      logApiCost({ userId, source: "leads", searchId: profileId, provider: "apify", operation: "fetchPostEngagers", estimatedCost: API_COSTS.apify.fetchPostEngagers, metadata: { postUrl: post.post_url } });

      // Mark post as scanned
      if (post.id) {
        await service.from("lg_posts").update({ scanned: true }).eq("id", post.id);
      }

      for (const r of reactions) {
        const actor = (r.actor && typeof r.actor === "object" ? r.actor : null) as Record<string, unknown> | null;
        if (!actor) continue;
        const actorId = String(actor.id ?? "");
        const actorName = String(actor.name ?? "");
        if (!actorName || actorName.length < 2) continue;
        const existing = engagerMap.get(actorId);
        if (existing) {
          existing.interactions.set(post.post_url!, "reaction");
        } else {
          const interactions = new Map<string, "reaction" | "comment">();
          interactions.set(post.post_url!, "reaction");
          engagerMap.set(actorId, { id: actorId, name: actorName, position: String(actor.position ?? ""), linkedinUrl: String(actor.linkedinUrl ?? ""), pictureUrl: String(actor.pictureUrl ?? ""), interactions });
        }
      }

      for (const c of comments) {
        const actor = (c.actor && typeof c.actor === "object" ? c.actor : null) as Record<string, unknown> | null;
        if (!actor || actor.author === true) continue;
        const actorId = String(actor.id ?? "");
        const actorName = String(actor.name ?? "");
        if (!actorName || actorName.length < 2) continue;
        const existing = engagerMap.get(actorId);
        if (existing) {
          existing.interactions.set(post.post_url!, "comment");
        } else {
          const interactions = new Map<string, "reaction" | "comment">();
          interactions.set(post.post_url!, "comment");
          engagerMap.set(actorId, { id: actorId, name: actorName, position: String(actor.position ?? ""), linkedinUrl: String(actor.linkedinUrl ?? ""), pictureUrl: String(actor.pictureUrl ?? ""), interactions });
        }
      }
    }

    console.log(`[lg-scan] Total engagers: ${engagerMap.size}`);

    // Deduplicate against existing results
    const { data: existingResults } = await service.from("lg_results").select("profile_slug").eq("profile_id", profileId);
    const existingSlugs = new Set((existingResults ?? []).map((r: { profile_slug: string }) => r.profile_slug));

    const allEngagers = Array.from(engagerMap.values())
      .filter((e) => {
        const slug = extractSlugOrId(e.linkedinUrl) || e.id;
        return !existingSlugs.has(slug);
      })
      .slice(0, maxLeads);

    console.log(`[lg-scan] Scoring ${allEngagers.length} new engagers...`);

    let leadCount = 0;
    const BATCH_SIZE = 10;

    for (let batchStart = 0; batchStart < allEngagers.length; batchStart += BATCH_SIZE) {
      if (leadCount >= maxLeads) break;
      const batch = allEngagers.slice(batchStart, batchStart + BATCH_SIZE);
      const batchLeads = batch.map((eng, i) => ({ index: batchStart + i, name: eng.name, headline: eng.position }));
      const aiScores = await batchScoreIcpMatch(batchLeads, jobTitles, departments);
      logApiCost({ userId, source: "leads", searchId: profileId, provider: "openrouter", operation: "batchScoreIcpMatch", estimatedCost: API_COSTS.openrouter.batchScoreIcpMatch, metadata: { batchSize: batch.length } });

      for (let i = 0; i < batch.length; i++) {
        if (leadCount >= maxLeads) break;
        const engager = batch[i];
        const globalIdx = batchStart + i;
        const slug = extractSlugOrId(engager.linkedinUrl) || engager.id;
        const aiResult = aiScores.get(globalIdx);
        const sourcePostUrls = Array.from(engager.interactions.keys());
        let totalInteractions = 0;
        for (const p of postsToScan) {
          if (p.post_url && engager.interactions.has(p.post_url)) totalInteractions++;
        }
        const engagementType = engager.interactions.size > 1 ? "both" :
          Array.from(engager.interactions.values())[0] === "comment" ? "comment" : "reaction";

        try {
          await service.from("lg_results").insert({
            profile_id: profileId, profile_slug: slug, name: engager.name, headline: engager.position,
            job_title: aiResult?.jobTitle ?? engager.position, company: aiResult?.company ?? "",
            linkedin_url: engager.linkedinUrl || `https://linkedin.com/in/${slug}`,
            profile_photo: engager.pictureUrl, icp_score: aiResult?.score ?? 0,
            role_level: aiResult?.roleLevel ?? "observador", engagement_type: engagementType,
            source_post_urls: sourcePostUrls, interaction_count: totalInteractions,
            total_possible_interactions: totalPossibleInteractions,
            notes: { matched_titles: aiResult?.matchedTitles ?? [], matched_departments: aiResult?.matchedDepartments ?? [] },
          });
          leadCount++;
        } catch (err) { console.error(`[lg-scan] Error saving ${engager.name}:`, err); }
      }
    }

    // ------------------------------------------------------------------
    // Enrich company for high-value leads whose company came back empty.
    // Stage 1: read `profiles` cache. Stage 2: Apify profile scraper for
    // the rest, with bounded concurrency. Upsert enriched data back into
    // `profiles` to warm the cache for future scans.
    // ------------------------------------------------------------------
    try {
      // Enrich ALL leads with empty company — observadores too. They appear
      // in the UI and the user expects them to have a company name too.
      // The per-scan cap below keeps cost bounded.
      const MAX_ENRICHMENTS_PER_SCAN = 30;
      const { data: emptyCompanyLeads } = await service
        .from("lg_results")
        .select("id, profile_slug, role_level, linkedin_url, headline, name")
        .eq("profile_id", profileId)
        .eq("company", "")
        .order("icp_score", { ascending: false })  // prioritize highest-value leads first
        .limit(MAX_ENRICHMENTS_PER_SCAN);

      const rows = (emptyCompanyLeads ?? []) as Array<{
        id: string;
        profile_slug: string;
        role_level: string;
        linkedin_url: string | null;
        headline: string | null;
        name: string | null;
      }>;

      if (rows.length > 0) {
        console.log(`[lg-scan] Company enrichment: ${rows.length} leads need company (cap=${MAX_ENRICHMENTS_PER_SCAN})`);

        const slugs = rows.map((r) => r.profile_slug).filter(Boolean);
        const resolved = new Map<string, string>(); // slug → company
        // Enriched profile context we'll reuse for stage 3 (LLM second pass)
        const enrichedContext = new Map<string, string>(); // slug → headline + about

        // Stage 1: profiles cache lookup
        if (slugs.length > 0) {
          const { data: cachedProfiles } = await service
            .from("profiles")
            .select("slug, company_current, headline")
            .in("slug", slugs);
          for (const p of (cachedProfiles ?? []) as Array<{ slug: string | null; company_current: string | null; headline: string | null }>) {
            if (!p.slug) continue;
            if (p.company_current && p.company_current.trim()) {
              resolved.set(p.slug, p.company_current.trim());
            }
            if (p.headline) enrichedContext.set(p.slug, p.headline);
          }
          console.log(`[lg-scan] Company cache: ${resolved.size}/${slugs.length} resolved from profiles table`);
        }

        // Stage 2: Apify profile-scraper (case-preserving URL) with
        // fetchProfilePosts as fallback for inaccessible profiles.
        const toFetch = rows.filter((r) => !resolved.has(r.profile_slug));
        const CONCURRENCY = 5;
        const MAX_POST_FALLBACKS = 10;
        let fallbacksUsed = 0;

        for (let i = 0; i < toFetch.length; i += CONCURRENCY) {
          const batch = toFetch.slice(i, i + CONCURRENCY);
          await Promise.all(batch.map(async (r) => {
            // Prefer the case-preserved URL from the original engager response
            const target = r.linkedin_url && r.linkedin_url.startsWith("http")
              ? r.linkedin_url
              : r.profile_slug;

            let company = "";
            let richHeadline = "";
            let richAbout = "";
            let profileName = "";
            let profilePhoto = "";

            try {
              const result = await fetchLinkedInProfileApify(target);

              if (result.status === 200 && result.data) {
                const data = result.data as Record<string, unknown>;

                // Prefer normalized `company` (from currentPosition), then experience
                if (typeof data.company === "string" && data.company.trim()) {
                  company = data.company.trim();
                } else {
                  const exp = data.experience as Array<Record<string, unknown>> | undefined;
                  if (Array.isArray(exp) && exp.length > 0) {
                    const current = exp.find((e) => e.end_date == null && (e.ends_at == null || e.ends_at === "Present"));
                    const pick = current ?? exp[0];
                    const c = (pick?.company ?? pick?.company_name ?? "") as string;
                    if (c && String(c).trim()) company = String(c).trim();
                  }
                }

                richHeadline = String(data.headline ?? "");
                richAbout = String(data.about ?? "");
                profileName = String(data.name ?? data.fullName ?? "");
                profilePhoto = String(data.profile_photo ?? data.profilePicture ?? "");
              } else if (fallbacksUsed < MAX_POST_FALLBACKS) {
                // Profile-scraper failed (403/404/error shell) — fallback to
                // fetchProfilePosts which accepts the same ACoAA... URLs we
                // already use successfully for the engagers actor.
                fallbacksUsed++;
                console.log(`[lg-scan] enrichment fallback via fetchProfilePosts for target=${target.slice(0, 80)}`);
                const posts = await fetchProfilePosts(
                  target.startsWith("http") ? target : `https://www.linkedin.com/in/${target}/`,
                  1
                );
                if (posts.length > 0) {
                  const author = (posts[0] as Record<string, unknown>).author as Record<string, unknown> | undefined;
                  if (author) {
                    const c = String(author.currentCompany ?? author.companyName ?? author.company ?? "");
                    if (c && c.trim()) company = c.trim();
                    richHeadline = String(author.headline ?? author.position ?? "");
                    profileName = String(author.name ?? author.fullName ?? "");
                    profilePhoto = String(author.profilePicture ?? author.pictureUrl ?? "");
                  }
                }
              }
            } catch (err) {
              console.error(`[lg-scan] enrich target=${target.slice(0, 80)} failed:`, err);
            }

            if (company) resolved.set(r.profile_slug, company);
            if (richHeadline || richAbout) {
              enrichedContext.set(
                r.profile_slug,
                [richHeadline, richAbout].filter(Boolean).join(" | ").slice(0, 600)
              );
            }

            // Cache warming: always upsert whatever we learned (Fase 2.6)
            try {
              await service
                .from("profiles")
                .upsert(
                  {
                    slug: r.profile_slug,
                    name: profileName || r.name || null,
                    headline: richHeadline || r.headline || null,
                    profile_photo: profilePhoto || null,
                    company_current: company || null,
                    last_enriched_at: new Date().toISOString(),
                  },
                  { onConflict: "slug" }
                );
            } catch { /* ignore upsert failures */ }
          }));
        }

        // Stage 3: second-pass LLM on enriched headline+about for leads
        // still missing a company. Cheap (~$0.0002) — worth it.
        const stillEmpty = rows.filter((r) => !resolved.has(r.profile_slug));
        const llmInput = stillEmpty
          .map((r, idx) => {
            const ctx = enrichedContext.get(r.profile_slug) ?? r.headline ?? "";
            if (!ctx || ctx.length < 8) return null;
            return { index: idx, name: r.name ?? "", text: ctx, leadRow: r };
          })
          .filter((x): x is { index: number; name: string; text: string; leadRow: typeof rows[number] } => x !== null);

        if (llmInput.length > 0) {
          console.log(`[lg-scan] Company enrichment LLM pass 2 on ${llmInput.length} leads`);
          const llmResults = await extractCompaniesFromHeadlines(
            llmInput.map((x) => ({ index: x.index, name: x.name, text: x.text }))
          );
          logApiCost({
            userId, source: "leads", searchId: profileId, provider: "openrouter",
            operation: "extractCompaniesFromHeadlines",
            estimatedCost: API_COSTS.openrouter.batchScoreIcpMatch,
            metadata: { leads: llmInput.length },
          });
          llmResults.forEach((company, idx) => {
            const lead = llmInput[idx]?.leadRow;
            if (!lead || !company) return;
            resolved.set(lead.profile_slug, company);
          });
        }

        // Apply resolved companies to lg_results rows
        let updated = 0;
        for (const r of rows) {
          const company = resolved.get(r.profile_slug);
          if (!company) continue;
          await service.from("lg_results").update({ company }).eq("id", r.id);
          updated++;
        }
        console.log(`[lg-scan] Company enrichment: ${updated}/${rows.length} lg_results rows updated`);
      }
    } catch (err) {
      console.error("[lg-scan] Company enrichment step failed:", err);
      notifyError("lg-scan-company-enrichment", err, { userId, profileId });
    }

    // ------------------------------------------------------------------
    // Apply company blacklist: delete any lead whose company matches a
    // company the analyzed profile is associated with (same-company
    // leads are useless). Runs after enrichment so both LLM-extracted
    // and Apify-enriched companies are covered in one pass.
    // ------------------------------------------------------------------
    let blacklistRemoved = 0;
    try {
      const { data: profileRow } = await service
        .from("lg_profiles")
        .select("company_blacklist")
        .eq("id", profileId)
        .single();
      const blacklist = (profileRow?.company_blacklist as string[] | null) ?? [];
      if (blacklist.length > 0) {
        const { data: candidateLeads } = await service
          .from("lg_results")
          .select("id, company")
          .eq("profile_id", profileId)
          .not("company", "is", null)
          .neq("company", "");
        const toRemove = (candidateLeads ?? []).filter((r: { id: string; company: string | null }) =>
          matchesCompanyBlacklist(r.company, blacklist)
        );
        if (toRemove.length > 0) {
          const ids = toRemove.map((r) => r.id);
          await service.from("lg_results").delete().in("id", ids);
          blacklistRemoved = ids.length;
          console.log(`[lg-scan] Company blacklist: removed ${blacklistRemoved} leads matching ${JSON.stringify(blacklist)}`);
        }
      }
    } catch (err) {
      console.error("[lg-scan] Company blacklist step failed:", err);
      notifyError("lg-scan-blacklist", err, { userId, profileId });
    }
    // Adjust the in-memory leadCount so credits and diagnostics reflect
    // only the leads that actually made it into the final list.
    leadCount = Math.max(0, leadCount - blacklistRemoved);

    // Deduct credits
    const { data: userRole } = await service.from("user_roles").select("credits").eq("user_id", userId).single();
    if (userRole && userRole.credits !== -1 && leadCount > 0) {
      const creditsToDeduct = Math.ceil(leadCount / 12);
      const newCredits = Math.max(0, userRole.credits - creditsToDeduct);
      await service.from("user_roles").update({ credits: newCredits }).eq("user_id", userId);
      console.log(`[lg-scan] Credits: ${creditsToDeduct} deducted (${leadCount} leads), ${userRole.credits} -> ${newCredits}`);
      logApiCost({ userId, source: "leads", searchId: profileId, provider: "apify", operation: "credits_deducted", estimatedCost: 0, creditsUsed: creditsToDeduct, metadata: { leadsFound: leadCount } });
    }

    console.log(`[lg-scan] Complete: ${leadCount} leads from ${postsToScan.length} posts`);

    // Send diagnostic email
    notifyError("lg-scan-diagnostic (not an error)", new Error(`Scan completed: ${leadCount} new leads`), {
      userId, profileId,
      fetchMorePosts: !!fetchMorePosts,
      linkedinUrl: linkedinUrl ?? "none",
      existingPostUrnsCount: (existingPostUrns ?? []).length,
      postsToScanCount: postsToScan.length,
      totalEngagers: engagerMap.size,
      existingLeadSlugs: existingSlugs.size,
      newEngagersAfterDedup: allEngagers.length,
      leadsInserted: leadCount,
      blacklistRemoved,
      morePostsFetched,
      newPostsFound,
    });

    await service.from("lg_profiles").update({ scan_status: "complete" }).eq("id", profileId);
  } catch (e) {
    console.error("[lg-scan] Background scan error:", e);
    notifyError("lg-scan-background", e, { userId, profileId, postsCount: postsToScan.length });
    await service.from("lg_profiles").update({ scan_status: "error" }).eq("id", profileId);
  }

  return { statusCode: 202, body: "OK" };
};

export { handler };
