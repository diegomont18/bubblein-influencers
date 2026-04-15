/**
 * Test script: validate supreme_coder/linkedin-post as a cheaper
 * ($1.20/1k vs $2.00/1k) replacement for harvestapi profile posts fetching.
 *
 * Run: npx tsx temp/test-supreme-coder-posts.ts
 * Requires: APIFY_API_TOKEN env var
 */

const TOKEN = process.env.APIFY_API_TOKEN;
if (!TOKEN) {
  console.error("Set APIFY_API_TOKEN env var");
  process.exit(1);
}

const TEST_PROFILES = [
  "https://www.linkedin.com/in/nathaliaarcuri/",
  "https://www.linkedin.com/in/ricardo-amoroso-413420/",
];

async function testActor(profileUrl: string) {
  console.log(`\n=== supreme_coder posts: ${profileUrl} ===`);
  const url = `https://api.apify.com/v2/acts/supreme_coder~linkedin-post/run-sync-get-dataset-items?token=${encodeURIComponent(TOKEN!)}`;

  const inputVariants: Array<{ name: string; body: Record<string, unknown> }> = [
    { name: "profileUrls (array)", body: { profileUrls: [profileUrl], maxPosts: 10 } },
    { name: "urls (array)", body: { urls: [profileUrl], maxPosts: 10 } },
    { name: "startUrls (array objects)", body: { startUrls: [{ url: profileUrl }], maxPosts: 10 } },
    { name: "profileUrl (string)", body: { profileUrl, maxPosts: 10 } },
    { name: "linkedinUrl (string)", body: { linkedinUrl: profileUrl, limit: 10 } },
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
              console.log(`first sample=${JSON.stringify(data[0]).slice(0, 1200)}`);
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
  for (const p of TEST_PROFILES) {
    await testActor(p);
    break;
  }
})();
