/**
 * Test script: validate datadoping/linkedin-post-reactions-scraper-no-cookie
 * as a cheaper ($1.20/1k vs $2.00/1k) replacement for harvestapi reactions.
 *
 * Run: npx tsx temp/test-datadoping-reactions.ts
 * Requires: APIFY_API_TOKEN env var
 */

const TOKEN = process.env.APIFY_API_TOKEN;
if (!TOKEN) {
  console.error("Set APIFY_API_TOKEN env var");
  process.exit(1);
}

// A few known-good permalinks to test (feel free to swap)
const TEST_POSTS = [
  "https://www.linkedin.com/posts/dedalus-prime_dedalus-genai-cloud-activity-7442189035197919233-lTBH",
  "https://www.linkedin.com/posts/nathaliaarcuri_apostas-online-j%C3%A1-deixaram-de-ser-um-problema-activity-7446904551946772480-IPZ6",
];

async function testActor(postUrl: string) {
  console.log(`\n=== datadoping reactions: ${postUrl.slice(0, 80)} ===`);
  const url = `https://api.apify.com/v2/acts/datadoping~linkedin-post-reactions-scraper-no-cookie/run-sync-get-dataset-items?token=${encodeURIComponent(TOKEN!)}`;

  // Input format is a guess — consult the actor's README for exact shape.
  const inputVariants: Array<{ name: string; body: Record<string, unknown> }> = [
    { name: "postUrl (string)", body: { postUrl } },
    { name: "postUrls (array)", body: { postUrls: [postUrl] } },
    { name: "url (string)", body: { url: postUrl } },
    { name: "urls (array)", body: { urls: [postUrl] } },
    { name: "startUrls (array objects)", body: { startUrls: [{ url: postUrl }] } },
  ];

  for (const variant of inputVariants) {
    console.log(`\n--- try: ${variant.name} ---`);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(variant.body),
        signal: AbortSignal.timeout(120_000),
      });
      console.log(`status=${res.status}`);
      const text = await res.text();
      if (res.status === 200 || res.status === 201) {
        try {
          const data = JSON.parse(text);
          if (Array.isArray(data)) {
            console.log(`items=${data.length}`);
            if (data.length > 0) {
              console.log(`first keys=${JSON.stringify(Object.keys(data[0]))}`);
              console.log(`first sample=${JSON.stringify(data[0]).slice(0, 800)}`);
            }
            return;
          }
        } catch {
          console.log(`body not JSON: ${text.slice(0, 400)}`);
        }
      } else {
        console.log(`error body=${text.slice(0, 400)}`);
      }
    } catch (err) {
      console.log(`exception: ${err instanceof Error ? err.message : err}`);
    }
  }
}

(async () => {
  for (const p of TEST_POSTS) {
    await testActor(p);
    break; // stop after first to save cost during discovery
  }
})();
