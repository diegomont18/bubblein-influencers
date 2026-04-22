/**
 * Test: LinkedIn Company Scraper — get company info + similar pages (competitors).
 * Run: npx tsx temp/test-company-scraper.ts
 */
const TOKEN = process.env.APIFY_API_TOKEN;
if (!TOKEN) { console.error("Set APIFY_API_TOKEN"); process.exit(1); }

const COMPANY_URL = "https://www.linkedin.com/company/dedalus-prime/";

// Try two actors: dev_fusion and data-slayer
const ACTORS = [
  "dev_fusion~linkedin-company-scraper",
  "data-slayer~linkedin-company-scraper",
];

async function testActor(actorName: string) {
  console.log(`\n=== Testing: ${actorName} ===`);
  const url = `https://api.apify.com/v2/acts/${actorName}/run-sync-get-dataset-items?token=${encodeURIComponent(TOKEN!)}`;

  // Try a few input variations
  const variants = [
    { name: "urls array", body: { urls: [COMPANY_URL] } },
    { name: "url string", body: { url: COMPANY_URL } },
    { name: "companyUrls", body: { companyUrls: [COMPANY_URL] } },
    { name: "startUrls", body: { startUrls: [{ url: COMPANY_URL }] } },
  ];

  for (const v of variants) {
    console.log(`\n--- ${v.name} ---`);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(v.body),
        signal: AbortSignal.timeout(120_000),
      });
      console.log(`status=${res.status}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          const first = data[0] as Record<string, unknown>;
          console.log(`items=${data.length}`);
          console.log(`keys=${JSON.stringify(Object.keys(first))}`);
          console.log(`sample=${JSON.stringify(first).slice(0, 2000)}`);
          // Check for similar pages / competitors
          const similar = first.similarPages ?? first.similar_pages ?? first.affiliatedPages ?? first.affiliated_pages;
          console.log(`\nsimilarPages type=${Array.isArray(similar) ? `array(${similar.length})` : typeof similar}`);
          if (Array.isArray(similar) && similar.length > 0) {
            console.log(`similarPages[0]=${JSON.stringify(similar[0]).slice(0, 300)}`);
          }
          return; // Success — stop trying other variants
        }
        console.log(`empty or not array: ${String(data).slice(0, 200)}`);
      } else {
        const text = await res.text();
        console.log(`error: ${text.slice(0, 400)}`);
      }
    } catch (err) {
      console.log(`exception: ${err instanceof Error ? err.message : err}`);
    }
  }
}

(async () => {
  for (const actor of ACTORS) {
    await testActor(actor);
  }
})();
