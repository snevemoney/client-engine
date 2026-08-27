/**
 * Small fetch wrapper with bounded retries for transient HTTP / network failures.
 * Does not retry most 4xx. Used by outbound notify / Resend paths.
 */

const RETRY_STATUSES = new Set([408, 429, 500, 502, 503, 504]);

export type FetchWithRetryOptions = {
  retries?: number;
  backoffMs?: number[];
};

export async function fetchWithRetry(
  input: RequestInfo | URL,
  init?: RequestInit,
  opts?: FetchWithRetryOptions
): Promise<Response> {
  const retries = opts?.retries ?? 2;
  const backoff = opts?.backoffMs ?? [300, 1200];
  let lastError: unknown;
  let lastResponse: Response | undefined;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      lastResponse = await fetch(input, init);
      if (lastResponse.ok || !RETRY_STATUSES.has(lastResponse.status) || attempt === retries) {
        return lastResponse;
      }
    } catch (err) {
      lastError = err;
      if (attempt === retries) throw err;
    }
    const delay = backoff[Math.min(attempt, backoff.length - 1)] ?? 300;
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  if (lastResponse) return lastResponse;
  throw lastError instanceof Error ? lastError : new Error("fetchWithRetry failed");
}
