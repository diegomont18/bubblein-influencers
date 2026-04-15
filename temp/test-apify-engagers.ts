/**
 * Test script to find an Apify actor that returns individual post reactions/comments.
 * Run with: npx tsx temp/test-apify-engagers.ts
 */

const TOKEN = process.env.APIFY_API_TOKEN;
if (!TOKEN) {
  console.error("Set APIFY_API_TOKEN env var");
  process.exit(1);
}

const TEST_PROFILE = "https://www.linkedin.com/in/fabianosalgado/";
const TEST_ACTIVITY_ID = "7439638232826552320";
const TEST_POST_URL = "https://www.linkedin.com/posts/fabianosalgado_uma-das-coisas-que-mais-consome-efici%C3%AAncia-activity-7439638232826552320-3USq";

async function tryActor(name: string, body: Record<string, unknown>) {
  const url = `https://api.apify.com/v2/acts/${name}/run-sync-get-dataset-items?token=${TOKEN}`;
  console.log(`\n=== Testing actor: ${name} ===`);
  console.log(`Body: ${JSON.stringify(body)}`);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(120_000),
    });

    console.log(`Status: ${res.status}`);

    if (res.status === 200 || res.status === 201) {
      const data = await res.json();
      console.log(`Response: isArray=${Array.isArray(data)}, length=${Array.isArray(data) ? data.length : 'N/A'}`);

      if (Array.isArray(data) && data.length > 0) {
        const first = data[0] as Record<string, unknown>;
        console.log(`First item keys: ${Object.keys(first).join(", ")}`);

        // Check for reactions
        if (Array.isArray(first.reactions)) {
          console.log(`✅ reactions array: ${first.reactions.length} items`);
          if (first.reactions.length > 0) {
            console.log(`First reaction: ${JSON.stringify(first.reactions[0]).slice(0, 400)}`);
          }
        }
        if (Array.isArray(first.comments)) {
          console.log(`✅ comments array: ${first.comments.length} items`);
          if (first.comments.length > 0) {
            console.log(`First comment: ${JSON.stringify(first.comments[0]).slice(0, 400)}`);
          }
        }

        // Check engagement object
        if (first.engagement && typeof first.engagement === "object") {
          console.log(`engagement: ${JSON.stringify(first.engagement).slice(0, 300)}`);
        }

        // Check socialContent
        if (first.socialContent && typeof first.socialContent === "object") {
          console.log(`socialContent: ${JSON.stringify(first.socialContent).slice(0, 300)}`);
        }

        // Check reactionIds / commentIds
        if (Array.isArray(first.reactionIds)) {
          console.log(`reactionIds: ${first.reactionIds.length} items, sample: ${JSON.stringify(first.reactionIds.slice(0, 3))}`);
        }
        if (Array.isArray(first.commentIds)) {
          console.log(`commentIds: ${first.commentIds.length} items, sample: ${JSON.stringify(first.commentIds.slice(0, 3))}`);
        }

        // Print first item sample
        console.log(`\nFull first item sample:\n${JSON.stringify(first).slice(0, 1000)}`);
      } else if (!Array.isArray(data)) {
        console.log(`Response (object): ${JSON.stringify(data).slice(0, 500)}`);
      }
    } else {
      const text = await res.text();
      console.log(`Error body: ${text.slice(0, 500)}`);
    }
  } catch (err) {
    console.error(`Exception: ${err}`);
  }
}

async function main() {
  // Test 1: harvestapi~linkedin-profile-posts with scrapeReactions (current approach)
  await tryActor("harvestapi~linkedin-profile-posts", {
    targetUrls: [TEST_PROFILE],
    maxPosts: 1,
    maxReactions: 50,
    maxComments: 50,
    scrapeReactions: true,
    scrapeComments: true,
    includeQuotePosts: false,
    includeReposts: false,
  });

  // Test 2: Same actor but with the POST URL directly
  await tryActor("harvestapi~linkedin-profile-posts", {
    targetUrls: [TEST_POST_URL],
    maxPosts: 1,
    maxReactions: 50,
    maxComments: 50,
    scrapeReactions: true,
    scrapeComments: true,
  });

  // Test 3: harvestapi~linkedin-post-search (already used for casting post mode)
  await tryActor("harvestapi~linkedin-post-search", {
    searchQueries: [`"${TEST_ACTIVITY_ID}"`],
    maxResults: 1,
    scrapeReactions: true,
    scrapeComments: true,
  });

  // Test 4: Try harvestapi~linkedin-post-reactions (might exist)
  await tryActor("harvestapi~linkedin-post-reactions", {
    postUrls: [TEST_POST_URL],
    maxReactions: 50,
  });

  // Test 5: Try harvestapi~linkedin-post-comments (might exist)
  await tryActor("harvestapi~linkedin-post-comments", {
    postUrls: [TEST_POST_URL],
    maxComments: 50,
  });

  // Test 6: Try curious_coder~linkedin-post-search with reactions
  await tryActor("curious_coder~linkedin-post-search", {
    urls: [TEST_POST_URL],
    scrapeReactions: true,
    scrapeComments: true,
  });

  // Test 7: harvestapi~linkedin-profile-posts with activityUrn format
  await tryActor("harvestapi~linkedin-profile-posts", {
    targetUrls: [`urn:li:activity:${TEST_ACTIVITY_ID}`],
    maxPosts: 1,
    maxReactions: 50,
    maxComments: 50,
    scrapeReactions: true,
    scrapeComments: true,
  });

  console.log("\n=== Done ===");
}

main().catch(console.error);
