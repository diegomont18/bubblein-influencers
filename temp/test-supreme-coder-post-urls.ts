/**
 * Key question: does supreme_coder/linkedin-post accept specific POST URLs
 * (not just profile URLs) and return inline reactions + comments for those
 * specific posts? If yes, ONE call replaces both fetchProfilePosts AND
 * fetchPostEngagers.
 */
const TOKEN = process.env.APIFY_API_TOKEN;
if (!TOKEN) { console.error("Set APIFY_API_TOKEN"); process.exit(1); }

const POSTS = [
  "https://www.linkedin.com/posts/nathaliaarcuri_apostas-online-j%C3%A1-deixaram-de-ser-um-problema-activity-7446904551946772480-IPZ6",
];

(async () => {
  const url = `https://api.apify.com/v2/acts/supreme_coder~linkedin-post/run-sync-get-dataset-items?token=${encodeURIComponent(TOKEN!)}`;

  // Try passing a post URL directly
  const body = { urls: POSTS };
  console.log(`Calling with: ${JSON.stringify(body)}`);

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(180_000),
  });

  console.log(`status=${res.status}`);
  if (!res.ok) {
    console.log(await res.text());
    return;
  }
  const data = await res.json();
  if (!Array.isArray(data)) {
    console.log(`not an array: ${JSON.stringify(data).slice(0, 400)}`);
    return;
  }
  console.log(`items=${data.length}`);
  if (data.length === 0) return;

  const first = data[0] as Record<string, unknown>;
  console.log(`\nfirst type=${first.type}`);
  console.log(`first url=${first.url}`);
  console.log(`first numLikes=${first.numLikes} numComments=${first.numComments}`);

  const reactions = first.reactions;
  const comments = first.comments;
  console.log(`\nreactions count=${Array.isArray(reactions) ? reactions.length : typeof reactions}`);
  console.log(`comments count=${Array.isArray(comments) ? comments.length : typeof comments}`);

  if (Array.isArray(reactions) && reactions.length > 0) {
    const r0 = reactions[0] as Record<string, unknown>;
    console.log(`\nreaction[0] keys=${JSON.stringify(Object.keys(r0))}`);
    const profile = r0.profile as Record<string, unknown> | undefined;
    if (profile) {
      console.log(`reaction[0].profile keys=${JSON.stringify(Object.keys(profile))}`);
      console.log(`reaction[0].profile sample=${JSON.stringify(profile).slice(0, 500)}`);
    }
  }

  if (Array.isArray(comments) && comments.length > 0) {
    const c0 = comments[0] as Record<string, unknown>;
    console.log(`\ncomment[0] keys=${JSON.stringify(Object.keys(c0))}`);
    const author = c0.author as Record<string, unknown> | undefined;
    if (author) {
      console.log(`comment[0].author keys=${JSON.stringify(Object.keys(author))}`);
      console.log(`comment[0].author sample=${JSON.stringify(author).slice(0, 500)}`);
    }
  }
})();
