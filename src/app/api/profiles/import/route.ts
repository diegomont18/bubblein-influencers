import { NextResponse } from "next/server";
import { createServerClient, createServiceClient } from "@/lib/supabase/server";
import {
  normalizeLinkedInUrl,
  isValidLinkedInProfileUrl,
} from "@/lib/linkedin";

export async function POST(request: Request) {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const urls: string[] = body.urls;
  const tags: string[] = Array.isArray(body.tags) ? body.tags : [];
  const castingKeywords: string | undefined = typeof body.casting_keywords === "string" ? body.casting_keywords : undefined;
  const force: boolean = body.force === true;
  if (!Array.isArray(urls) || urls.length === 0) {
    return NextResponse.json(
      { error: "urls must be a non-empty array" },
      { status: 400 }
    );
  }

  const invalid: string[] = [];
  const validUrls: string[] = [];

  for (const raw of urls) {
    if (isValidLinkedInProfileUrl(raw)) {
      validUrls.push(normalizeLinkedInUrl(raw));
    } else {
      invalid.push(raw);
    }
  }

  // Deduplicate against DB
  const service = createServiceClient();
  const { data: existing } = await service
    .from("profiles")
    .select("id, url")
    .in("url", validUrls);

  const existingMap = new Map((existing ?? []).map((p) => [p.url, p.id]));
  const duplicates: string[] = [];
  const newUrls: string[] = [];

  for (const url of validUrls) {
    if (existingMap.has(url)) {
      duplicates.push(url);
    } else {
      newUrls.push(url);
    }
  }

  // Force re-import: reset existing profiles and re-queue enrichment
  let requeued = 0;
  if (force && duplicates.length > 0) {
    const duplicateIds = duplicates.map((url) => existingMap.get(url)!);

    // Reset profiles to pending
    await service
      .from("profiles")
      .update({ enrichment_status: "pending" })
      .in("id", duplicateIds);

    // Create new enrichment jobs
    const jobs = duplicateIds.map((id) => ({
      profile_id: id,
      status: "queued",
    }));
    await service.from("enrichment_jobs").insert(jobs);
    requeued = duplicateIds.length;
  }

  // Deduplicate within batch
  const uniqueNewUrls = Array.from(new Set(newUrls));

  // Insert profiles + enrichment jobs
  if (uniqueNewUrls.length > 0) {
    const profiles = uniqueNewUrls.map((url) => ({
      url,
      enrichment_status: "pending",
      ...(tags.length > 0 ? { tags } : {}),
      ...(castingKeywords ? { casting_keywords: castingKeywords } : {}),
    }));

    const { data: inserted, error: insertError } = await service
      .from("profiles")
      .insert(profiles)
      .select("id");

    if (insertError) {
      return NextResponse.json(
        { error: insertError.message },
        { status: 500 }
      );
    }

    if (inserted && inserted.length > 0) {
      const jobs = inserted.map((p) => ({
        profile_id: p.id,
        status: "queued",
      }));
      await service.from("enrichment_jobs").insert(jobs);
    }
  }

  const duplicateSlugs = duplicates.map((u) => {
    const match = u.match(/linkedin\.com\/in\/([^/?#]+)/);
    return match?.[1] ?? u;
  });

  return NextResponse.json({
    queued: uniqueNewUrls.length,
    requeued,
    duplicates: force ? 0 : duplicates.length,
    duplicate_urls: force ? [] : duplicateSlugs,
    invalid: invalid.length,
  });
}
