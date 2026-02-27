/**
 * E2E mutation safety: require localhost or explicit opt-in before running mutating tests.
 * Prevents accidental data mutation against production.
 */
import { baseURL } from "./auth";

const MUTATION_OPT_IN = "E2E_ALLOW_MUTATIONS";
const PROD_SCORE_OPT_IN = "E2E_ALLOW_PROD_SCORE"; // legacy alias for score-intake-leads

function isLocalhost(url: string): boolean {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    return host === "localhost" || host === "127.0.0.1";
  } catch {
    return false;
  }
}

/**
 * Call at the start of mutating E2E specs (POST/PATCH/PUT/DELETE, or UI that triggers them).
 * Throws if BASE_URL is not localhost and E2E_ALLOW_MUTATIONS is not set.
 *
 * @param opts.allowLocalhostOnly - if true, only localhost is allowed (no prod opt-in)
 * @param opts.baseUrl - override for testing (default: PLAYWRIGHT_BASE_URL or localhost)
 */
export function requireSafeE2EBaseUrl(opts?: { allowLocalhostOnly?: boolean; baseUrl?: string }): void {
  const url = opts?.baseUrl ?? baseURL ?? process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
  if (isLocalhost(url)) return;

  const optIn =
    process.env[MUTATION_OPT_IN] === "1" ||
    process.env[MUTATION_OPT_IN] === "true" ||
    process.env[PROD_SCORE_OPT_IN] === "1" ||
    process.env[PROD_SCORE_OPT_IN] === "true";
  if (!opts?.allowLocalhostOnly && optIn) return;

  const msg =
    opts?.allowLocalhostOnly
      ? `E2E mutation tests require localhost. BASE_URL=${url}. Run against http://localhost:3000.`
      : `E2E mutation tests require localhost or E2E_ALLOW_MUTATIONS=1. BASE_URL=${url}. ` +
        `Set E2E_ALLOW_MUTATIONS=1 to run mutations against non-local (use with caution).`;

  throw new Error(`[E2E Safety] ${msg}`);
}
