import { NextResponse } from "next/server";
import { createServerClient, createServiceClient } from "@/lib/supabase/server";
import { extractSlug } from "@/lib/linkedin";
import { fetchLinkedInProfile } from "@/lib/scrapingdog";
import {
  normalizeProfileData,
  normalizeExperiences,
  calculatePostingFrequency,
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

  // Pick up to 5 queued jobs
  const { data: jobs } = await service
    .from("enrichment_jobs")
    .select("*")
    .eq("status", "queued")
    .order("queued_at", { ascending: true })
    .limit(5);

  if (!jobs || jobs.length === 0) {
    return NextResponse.json({ processed: 0, results: [] });
  }

  // Fetch profile URLs for these jobs
  const profileIds = jobs.map((j) => j.profile_id);
  const { data: profileRows } = await service
    .from("profiles")
    .select("id, url")
    .in("id", profileIds);
  const urlMap = new Map(
    (profileRows ?? []).map((p: { id: string; url: string }) => [p.id, p.url])
  );

  const results: Array<{
    profileId: string;
    status: string;
    error?: string;
  }> = [];

  for (const job of jobs) {
    const profileUrl = urlMap.get(job.profile_id);
    if (!profileUrl) {
      results.push({
        profileId: job.profile_id,
        status: "failed",
        error: "No profile URL",
      });
      continue;
    }

    const slug = extractSlug(profileUrl);
    if (!slug) {
      results.push({
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
    const result = await fetchLinkedInProfile(slug);

    if (result.status === 200 && result.data) {
      // Normalize profile data
      const profileData = normalizeProfileData(result.data);
      const frequency = calculatePostingFrequency(result.data);

      // Classify topics
      const roles = normalizeExperiences(result.data, job.profile_id)
        .map((e) => e.role)
        .filter(Boolean) as string[];

      const topics = await classifyTopics(
        profileData.headline ?? null,
        profileData.about ?? null,
        roles
      );

      // Generate embedding
      const embeddingText = [
        profileData.headline,
        profileData.about,
        ...(topics ?? []),
      ]
        .filter(Boolean)
        .join(" ");
      const embedding = await generateEmbedding(embeddingText);

      // Update profile
      await service
        .from("profiles")
        .update({
          ...profileData,
          topics: topics.length > 0 ? topics : null,
          topics_embedding: embedding
            ? JSON.stringify(embedding)
            : undefined,
          posting_frequency: frequency.label,
          posting_frequency_score: frequency.score,
          enrichment_status: "done",
          raw_data: result.data,
          last_enriched_at: new Date().toISOString(),
        })
        .eq("id", job.profile_id);

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

      results.push({ profileId: job.profile_id, status: "done" });
    } else if (result.status === 202) {
      // Still processing — leave as processing, will retry next run
      await service
        .from("enrichment_jobs")
        .update({ status: "queued", scrapingdog_status: 202 })
        .eq("id", job.id);

      await service
        .from("profiles")
        .update({ enrichment_status: "pending" })
        .eq("id", job.profile_id);

      results.push({ profileId: job.profile_id, status: "retry" });
    } else {
      // Error
      const attempts = job.attempt_count + 1;
      const isFailed = attempts >= 3;

      await service
        .from("enrichment_jobs")
        .update({
          status: isFailed ? "failed" : "queued",
          scrapingdog_status: result.status,
          last_error: result.error ?? `HTTP ${result.status}`,
          completed_at: isFailed ? new Date().toISOString() : null,
        })
        .eq("id", job.id);

      await service
        .from("profiles")
        .update({
          enrichment_status: isFailed ? "failed" : "pending",
        })
        .eq("id", job.profile_id);

      results.push({
        profileId: job.profile_id,
        status: isFailed ? "failed" : "retry",
        error: result.error,
      });
    }
  }

  return NextResponse.json({ processed: jobs.length, results });
}
