export function normalizeLinkedInUrl(url: string): string {
  try {
    const parsed = new URL(url.trim());
    // Ensure linkedin.com domain
    const hostname = parsed.hostname.replace(/^www\./, "");
    if (!hostname.endsWith("linkedin.com")) return url.trim();
    // Rebuild clean URL
    const path = parsed.pathname.replace(/\/+$/, "");
    return `https://www.linkedin.com${path}`;
  } catch {
    return url.trim();
  }
}

export function extractSlug(url: string): string | null {
  const normalized = normalizeLinkedInUrl(url);
  const match = normalized.match(/linkedin\.com\/in\/([^/]+)/);
  return match ? match[1] : null;
}

export function isValidLinkedInProfileUrl(url: string): boolean {
  try {
    const parsed = new URL(url.trim());
    const hostname = parsed.hostname.replace(/^www\./, "");
    if (!hostname.endsWith("linkedin.com")) return false;
    return /^\/in\/[a-zA-Z0-9\-_%]+\/?$/.test(parsed.pathname);
  } catch {
    return false;
  }
}
