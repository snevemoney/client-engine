/**
 * Canonicalize sourceUrl for dedupe: strip tracking params and hash.
 */
export function canonicalizeSourceUrl(url: string): string {
  try {
    const u = new URL(url);
    u.hash = "";
    u.searchParams.delete("utm_source");
    u.searchParams.delete("utm_medium");
    u.searchParams.delete("utm_campaign");
    u.searchParams.delete("utm_content");
    u.searchParams.delete("utm_term");
    u.searchParams.delete("ref");
    u.searchParams.delete("fbclid");
    u.searchParams.delete("gclid");
    return u.toString();
  } catch {
    return url;
  }
}
