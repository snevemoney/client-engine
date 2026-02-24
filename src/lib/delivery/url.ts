/**
 * Phase 1.4: URL validation helpers for delivery evidence.
 * Manual-first, tolerant but rejects obvious invalid strings.
 */

/**
 * Returns true if input looks like a valid HTTP/HTTPS URL.
 */
export function isValidHttpUrl(input: string): boolean {
  if (!input || typeof input !== "string") return false;
  const s = input.trim();
  if (s.length === 0 || s.length > 2000) return false;
  try {
    const u = new URL(s);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Returns true if input is a valid GitHub URL (repo, PR, commit, issue, etc.).
 */
export function isGitHubUrl(input: string): boolean {
  if (!isValidHttpUrl(input)) return false;
  try {
    const u = new URL(input.trim());
    const host = u.hostname.toLowerCase();
    return host === "github.com" || host === "www.github.com" || host.endsWith(".github.com");
  } catch {
    return false;
  }
}

/**
 * Returns true if input is a valid Loom URL.
 */
export function isLoomUrl(input: string): boolean {
  if (!isValidHttpUrl(input)) return false;
  try {
    const u = new URL(input.trim());
    const host = u.hostname.toLowerCase();
    return host === "loom.com" || host === "www.loom.com" || host.endsWith(".loom.com");
  } catch {
    return false;
  }
}
