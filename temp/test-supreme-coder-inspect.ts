/**
 * Deep inspection of supreme_coder/linkedin-post — we saw 778 items for
 * 10 maxPosts of one profile. Find out what exactly those items are and
 * whether reactions/comments have real engager actor data.
 */
const TOKEN = process.env.APIFY_API_TOKEN;
if (!TOKEN) { console.error("Set APIFY_API_TOKEN"); process.exit(1); }

const PROFILE = "https://www.linkedin.com/in/nathaliaarcuri/";

(async () => {
  const url = `https://api.apify.com/v2/acts/supreme_coder~linkedin-post/run-sync-get-dataset-items?token=${encodeURIComponent(TOKEN!)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ urls: [PROFILE], maxPosts: 3 }),
    signal: AbortSignal.timeout(240_000),
  });
  console.log(`status=${res.status}`);
  if (!res.ok) {
    console.log(await res.text());
    return;
  }
  const data = await res.json();
  if (!Array.isArray(data)) {
    console.log(`not an array: ${JSON.stringify(data).slice(0, 500)}`);
    return;
  }
  console.log(`total items=${data.length}`);

  // Group by type
  const byType: Record<string, number> = {};
  for (const item of data) {
    const t = String((item as Record<string, unknown>).type ?? "unknown");
    byType[t] = (byType[t] ?? 0) + 1;
  }
  console.log(`items by type=${JSON.stringify(byType)}`);

  // Inspect first item and any item with reactions populated
  const first = data[0] as Record<string, unknown>;
  console.log(`\n=== first item keys ===\n${JSON.stringify(Object.keys(first))}`);

  const reactionsField = first.reactions;
  const commentsField = first.comments;
  console.log(`\nreactions type=${Array.isArray(reactionsField) ? `array(${reactionsField.length})` : typeof reactionsField}`);
  console.log(`comments type=${Array.isArray(commentsField) ? `array(${commentsField.length})` : typeof commentsField}`);

  if (Array.isArray(reactionsField) && reactionsField.length > 0) {
    console.log(`\nfirst reaction sample=${JSON.stringify(reactionsField[0]).slice(0, 600)}`);
  }
  if (Array.isArray(commentsField) && commentsField.length > 0) {
    console.log(`\nfirst comment sample=${JSON.stringify(commentsField[0]).slice(0, 600)}`);
  }

  // author field
  const author = first.author;
  if (author && typeof author === "object") {
    console.log(`\nauthor keys=${JSON.stringify(Object.keys(author as Record<string, unknown>))}`);
    console.log(`author sample=${JSON.stringify(author).slice(0, 400)}`);
  }

  // Look at distinct unrelated item types if any
  const otherTypes = data.filter((d) => {
    const t = String((d as Record<string, unknown>).type ?? "");
    return t && t !== (first.type ?? "");
  });
  if (otherTypes.length > 0) {
    const sampleOther = otherTypes[0] as Record<string, unknown>;
    console.log(`\n=== sample non-first-type item (type=${sampleOther.type}) ===`);
    console.log(`keys=${JSON.stringify(Object.keys(sampleOther))}`);
    console.log(`sample=${JSON.stringify(sampleOther).slice(0, 600)}`);
  }
})();
