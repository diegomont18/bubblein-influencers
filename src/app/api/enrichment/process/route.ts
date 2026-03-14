import { NextResponse } from "next/server";
import { createServerClient, createServiceClient } from "@/lib/supabase/server";
import { extractSlug } from "@/lib/linkedin";
import { fetchLinkedInProfile } from "@/lib/scrapingdog";
import { fetchProfilePosts } from "@/lib/apify";
import {
  normalizeProfileData,
  normalizeExperiences,
  calculatePostingFrequency,
  calculateEngagementMetrics,
  computeEngagementFromPosts,
  buildCurrentJob,
  calculateCreatorScore,
} from "@/lib/normalize";
import { classifyTopics, generateEmbedding } from "@/lib/ai";

export async function POST(request: Request) {
  // Auth: either logged-in user or CRON_SECRET header
  const cronSecret = request.headers.get("x-cron-secret");
  if (cronSecret !== process.env.CRON_SECRET) {
    const supabase = createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const service = createServiceClient();

  const BATCH_SIZE = 5;
  const MAX_TOTAL = 100;

  const allResults: Array<{
    profileId: string;
    slug?: string;
    status: string;
    error?: string;
    scrapingdog_status?: number;
    topics?: string[];
    has_embedding?: boolean;
  }> = [];

  let totalProcessed = 0;

  while (totalProcessed < MAX_TOTAL) {
    // Pick up to BATCH_SIZE queued jobs
    const { data: jobs } = await service
      .from("enrichment_jobs")
      .select("*")
      .eq("status", "queued")
      .order("queued_at", { ascending: true })
      .limit(BATCH_SIZE);

    if (!jobs || jobs.length === 0) {
      if (totalProcessed === 0) {
        console.log("[enrichment] No queued jobs found");
      }
      break;
    }

    console.log(`[enrichment] Found ${jobs.length} queued job(s) to process (batch, total so far: ${totalProcessed})`);

    // Fetch profile URLs for these jobs
    const profileIds = jobs.map((j) => j.profile_id);
    const { data: profileRows } = await service
      .from("profiles")
      .select("id, url")
      .in("id", profileIds);
    const urlMap = new Map(
      (profileRows ?? []).map((p: { id: string; url: string }) => [p.id, p.url])
    );

    for (const job of jobs) {
      const profileUrl = urlMap.get(job.profile_id);
      console.log(`[enrichment] Job ${job.id}: profile_id=${job.profile_id} url=${profileUrl ?? "MISSING"} attempt=${job.attempt_count + 1}`);

      if (!profileUrl) {
        console.error(`[enrichment] Job ${job.id}: No profile URL found — skipping`);
        allResults.push({
          profileId: job.profile_id,
          status: "failed",
          error: "No profile URL",
        });
        continue;
      }

      const slug = extractSlug(profileUrl);
      if (!slug) {
        console.error(`[enrichment] Job ${job.id}: Could not extract slug from URL "${profileUrl}"`);
        allResults.push({
          profileId: job.profile_id,
          status: "failed",
          error: "Invalid URL slug",
        });
        await service
          .from("enrichment_jobs")
          .update({
            status: "failed",
            last_error: "Invalid URL slug",
            completed_at: new Date().toISOString(),
          })
          .eq("id", job.id);
        continue;
      }

      // Mark processing
      await service
        .from("enrichment_jobs")
        .update({
          status: "processing",
          started_at: new Date().toISOString(),
          attempt_count: job.attempt_count + 1,
        })
        .eq("id", job.id);

      await service
        .from("profiles")
        .update({ enrichment_status: "processing" })
        .eq("id", job.profile_id);

      // Call Scrapingdog
      console.log(`[enrichment] Job ${job.id}: Calling ScrapingDog for slug="${slug}"`);
      const result = await fetchLinkedInProfile(slug);
      console.log(`[enrichment] Job ${job.id}: ScrapingDog response status=${result.status}${result.error ? ` error="${result.error}"` : ""}`);

      if (result.status === 200 && result.data) {
        // Normalize profile data
        const profileData = normalizeProfileData(result.data);
        const frequency = calculatePostingFrequency(result.data);

        // Try inline engagement first; if null, fetch posts via Apify
        let engagement = calculateEngagementMetrics(result.data);
        if (engagement.avgLikes == null && engagement.avgComments == null) {
          const profileUrl = `https://www.linkedin.com/in/${slug}/`;
          console.log(`[enrichment] Job ${job.id}: Fetching posts via Apify for ${profileUrl}`);
          const posts = await fetchProfilePosts(profileUrl);
          if (posts.length > 0) {
            engagement = computeEngagementFromPosts(posts);
          }
        }

        const currentJob = buildCurrentJob(profileData.role_current, profileData.company_current);

        const creatorScore = calculateCreatorScore({
          followers_count: profileData.followers_count,
          avg_likes_per_post: engagement.avgLikes,
          avg_comments_per_post: engagement.avgComments,
          posting_frequency_score: frequency.score,
        });
        console.log(`[enrichment] Job ${job.id}: creator_score=${creatorScore}`);

        // Classify topics
        const roles = normalizeExperiences(result.data, job.profile_id)
          .map((e) => e.role)
          .filter(Boolean) as string[];

        console.log(`[enrichment] Job ${job.id}: Classifying topics...`);
        const topics = await classifyTopics(
          profileData.headline ?? null,
          profileData.about ?? null,
          roles
        );
        console.log(`[enrichment] Job ${job.id}: Topics: ${JSON.stringify(topics)}`);

        // Generate embedding
        const embeddingText = [
          profileData.headline,
          profileData.about,
          ...(topics ?? []),
        ]
          .filter(Boolean)
          .join(" ");
        console.log(`[enrichment] Job ${job.id}: Generating embedding...`);
        const embedding = await generateEmbedding(embeddingText);
        console.log(`[enrichment] Job ${job.id}: Embedding: ${embedding ? `${embedding.length} dims` : "none"}`);

        // Update profile
        const { error: updateErr } = await service
          .from("profiles")
          .update({
            ...profileData,
            current_job: currentJob,
            edited_fields: [],
            topics: topics.length > 0 ? topics : null,
            topics_embedding: embedding
              ? JSON.stringify(embedding)
              : undefined,
            posting_frequency: frequency.label,
            posting_frequency_score: frequency.score,
            avg_likes_per_post: engagement.avgLikes,
            avg_comments_per_post: engagement.avgComments,
            creator_score: creatorScore,
            enrichment_status: "done",
            raw_data: result.data,
            last_enriched_at: new Date().toISOString(),
          })
          .eq("id", job.profile_id);

        if (updateErr) {
          console.error(`[enrichment] Job ${job.id}: Profile update failed: ${updateErr.message}`);
        }

        // Save experiences
        const experiences = normalizeExperiences(result.data, job.profile_id);
        if (experiences.length > 0) {
          // Delete old experiences first
          await service
            .from("profile_experiences")
            .delete()
            .eq("profile_id", job.profile_id);
          await service.from("profile_experiences").insert(experiences);
        }

        // Mark job done
        await service
          .from("enrichment_jobs")
          .update({
            status: "done",
            scrapingdog_status: 200,
            completed_at: new Date().toISOString(),
          })
          .eq("id", job.id);

        console.log(`[enrichment] Job ${job.id}: ✓ Done`);
        allResults.push({
          profileId: job.profile_id,
          slug,
          status: "done",
          scrapingdog_status: 200,
          topics,
          has_embedding: !!embedding,
        });
      } else if (result.status === 202) {
        // Still processing — leave as queued, will retry next run
        await service
          .from("enrichment_jobs")
          .update({ status: "queued", scrapingdog_status: 202 })
          .eq("id", job.id);

        await service
          .from("profiles")
          .update({ enrichment_status: "pending" })
          .eq("id", job.profile_id);

        console.log(`[enrichment] Job ${job.id}: 202 — re-queued for async retry`);
        allResults.push({
          profileId: job.profile_id,
          slug,
          status: "retry",
          scrapingdog_status: 202,
        });
      } else {
        // Error
        const attempts = job.attempt_count + 1;
        const isFailed = attempts >= 3;
        const errorMsg = result.error ?? `HTTP ${result.status}`;

        console.error(`[enrichment] Job ${job.id}: Error — status=${result.status} error="${errorMsg}" attempt=${attempts}/3 → ${isFailed ? "FAILED" : "re-queued"}`);

        await service
          .from("enrichment_jobs")
          .update({
            status: isFailed ? "failed" : "queued",
            scrapingdog_status: result.status,
            last_error: errorMsg,
            completed_at: isFailed ? new Date().toISOString() : null,
          })
          .eq("id", job.id);

        await service
          .from("profiles")
          .update({
            enrichment_status: isFailed ? "failed" : "pending",
          })
          .eq("id", job.profile_id);

        allResults.push({
          profileId: job.profile_id,
          slug,
          status: isFailed ? "failed" : "retry",
          error: errorMsg,
          scrapingdog_status: result.status,
        });
      }
    }

    totalProcessed += jobs.length;
  }

  const errorCount = allResults.filter((r) => r.status === "failed" || r.error).length;
  console.log(`[enrichment] All batches complete: processed=${totalProcessed} done=${allResults.filter((r) => r.status === "done").length} retry=${allResults.filter((r) => r.status === "retry").length} errors=${errorCount}`);

  return NextResponse.json({ processed: totalProcessed, results: allResults, errors: errorCount });
}
