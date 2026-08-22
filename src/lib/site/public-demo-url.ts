/**
 * Public /work and marketing pages may only link a demo when it is a
 * clearly public marketing URL. Internal product, localhost, and private
 * hosts must never leak to visitors.
 */

const ALLOWED_HOSTS = new Set(["evenslouis.ca", "www.evenslouis.ca"]);

const BLOCKED_PATH_PREFIXES = [
  "/dashboard",
  "/pro",
  "/login",
  "/scorpion",
  "/n8n",
  "/builder",
  "/claw",
  "/api",
] as const;

const PRIVATE_HOST_MARKERS = [
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "[::1]",
  "::1",
  "scorpion",
  "n8n",
  "claw",
];

function isPrivateIpv4(hostname: string): boolean {
  const m = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  const octets = m.slice(1).map(Number);
  if (octets.some((n) => n > 255)) return false;
  const [a, b] = octets;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 169 && b === 254) return true;
  return false;
}

function pathIsBlocked(pathname: string): boolean {
  const path = pathname === "" ? "/" : pathname;
  return BLOCKED_PATH_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

export function isPublicDemoUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  const trimmed = url.trim();
  if (!trimmed) return false;

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return false;
  }

  if (parsed.protocol !== "https:") return false;

  const host = parsed.hostname.toLowerCase();
  if (!ALLOWED_HOSTS.has(host)) return false;
  if (PRIVATE_HOST_MARKERS.some((marker) => host.includes(marker))) return false;
  if (isPrivateIpv4(host)) return false;
  if (pathIsBlocked(parsed.pathname)) return false;

  return true;
}

export function publicDemoUrl(url: string | null | undefined): string | null {
  return isPublicDemoUrl(url) ? url!.trim() : null;
}
