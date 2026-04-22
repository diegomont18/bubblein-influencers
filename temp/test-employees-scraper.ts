/**
 * Test: LinkedIn Company Employees Scraper — get employee profiles.
 * Run: npx tsx temp/test-employees-scraper.ts
 */
const TOKEN = process.env.APIFY_API_TOKEN;
if (!TOKEN) { console.error("Set APIFY_API_TOKEN"); process.exit(1); }

const COMPANY_URL = "https://www.linkedin.com/company/dedalus-prime/";

const ACTORS = [
  "apimaestro~linkedin-company-employees-scraper-no-cookies",
  "harvestapi~linkedin-company-employees",
];

async function testActor(actorName: string) {
  console.log(`\n=== Testing: ${actorName} ===`);
  const url = `https://api.apify.com/v2/acts/${actorName}/run-sync-get-dataset-items?token=${encodeURIComponent(TOKEN!)}`;

  const variants = [
    { name: "companyUrl + limit", body: { companyUrl: COMPANY_URL, limit: 10 } },
    { name: "urls array + limit", body: { urls: [COMPANY_URL], limit: 10 } },
    { name: "url string + limit", body: { url: COMPANY_URL, limit: 10 } },
    { name: "startUrls + count", body: { startUrls: [{ url: COMPANY_URL }], count: 10 } },
    { name: "companyUrls + maxEmployees", body: { companyUrls: [COMPANY_URL], maxEmployees: 10 } },
  ];

  for (const v of variants) {
    console.log(`\n--- ${v.name} ---`);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(v.body),
        signal: AbortSignal.timeout(180_000),
      });
      console.log(`status=${res.status}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          console.log(`employees found=${data.length}`);
          const first = data[0] as Record<string, unknown>;
          console.log(`keys=${JSON.stringify(Object.keys(first))}`);
          console.log(`first=${JSON.stringify(first).slice(0, 800)}`);
          if (data.length > 1) {
            console.log(`second=${JSON.stringify(data[1]).slice(0, 400)}`);
          }
          return;
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
