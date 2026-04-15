/**
 * Retry with the correct field name: post_urls (snake_case, plural).
 */
const TOKEN = process.env.APIFY_API_TOKEN;
if (!TOKEN) { console.error("Set APIFY_API_TOKEN"); process.exit(1); }

const POST = "https://www.linkedin.com/posts/dedalus-prime_dedalus-genai-cloud-activity-7442189035197919233-lTBH";

(async () => {
  const url = `https://api.apify.com/v2/acts/datadoping~linkedin-post-reactions-scraper-no-cookie/run-sync-get-dataset-items?token=${encodeURIComponent(TOKEN!)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ post_urls: [POST] }),
    signal: AbortSignal.timeout(180_000),
  });
  console.log(`status=${res.status}`);
  const text = await res.text();
  if (res.ok) {
    const data = JSON.parse(text);
    if (Array.isArray(data)) {
      console.log(`items=${data.length}`);
      if (data.length > 0) {
        console.log(`first keys=${JSON.stringify(Object.keys(data[0]))}`);
        console.log(`first sample=${JSON.stringify(data[0]).slice(0, 1500)}`);
        if (data.length > 1) {
          console.log(`\nsecond keys=${JSON.stringify(Object.keys(data[1]))}`);
          console.log(`second sample=${JSON.stringify(data[1]).slice(0, 600)}`);
        }
      }
    }
  } else {
    console.log(`error=${text.slice(0, 600)}`);
  }
})();
