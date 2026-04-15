// Normalize a company name for blacklist matching. Removes accents,
// lowercases, strips common legal suffixes (LLC, Inc, Ltda, S.A., etc.),
// collapses whitespace, removes punctuation. Two names that represent the
// same company should normalize to the same string.
//
// Example:
//   "Acme Inc." / "ACME, inc" / "Acme  Inc" → "acme"
//   "Banco do Brasil S/A" / "Banco do Brasil" → "banco do brasil"

const LEGAL_SUFFIX_RE =
  /\b(s\.?\s*a\.?|s\.?\s*\/\s*a\.?|ltda\.?|limited|llc|l\.?l\.?c\.?|inc\.?|incorporated|corp\.?|corporation|co\.?|company|gmbh|ag|bv|pty|plc|sas|sarl|oy|ab|nv|mei|eireli|me|epp|holdings?|group|grupo)\b/gi;

export function normalizeCompanyName(raw: string | null | undefined): string {
  if (!raw) return "";
  let s = String(raw);
  // Strip accents
  s = s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  // Lowercase
  s = s.toLowerCase();
  // Drop legal suffixes
  s = s.replace(LEGAL_SUFFIX_RE, " ");
  // Drop punctuation → space
  s = s.replace(/[.,;:/\\()[\]{}"'`~!@#$%^&*+=|?<>]/g, " ");
  // Collapse whitespace
  s = s.replace(/\s+/g, " ").trim();
  // A single very-common token is too generic to blacklist reliably — drop
  // it (e.g., "inc" alone, "group" alone) so we don't nuke unrelated leads.
  if (s.length <= 2) return "";
  return s;
}

/**
 * Build a deduplicated, normalized blacklist array from any number of raw
 * company names. Empty / too-generic entries are dropped.
 */
export function buildCompanyBlacklist(names: Array<string | null | undefined>): string[] {
  const out = new Set<string>();
  for (const n of names) {
    const norm = normalizeCompanyName(n);
    if (norm) out.add(norm);
  }
  return Array.from(out);
}

/**
 * True if `candidate` matches any entry in a normalized blacklist.
 * Uses substring match in both directions so "Acme Corp" matches
 * "Acme" and vice versa (common for LinkedIn headlines).
 */
export function matchesCompanyBlacklist(
  candidate: string | null | undefined,
  blacklist: string[]
): boolean {
  if (!candidate || blacklist.length === 0) return false;
  const norm = normalizeCompanyName(candidate);
  if (!norm) return false;
  for (const bl of blacklist) {
    if (norm === bl) return true;
    if (norm.includes(bl) || bl.includes(norm)) return true;
  }
  return false;
}
