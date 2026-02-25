/**
 * Phase 2.6: Shared fetch wrapper for client-side requests.
 * JSON parsing, AbortController, error normalization.
 */

export type FetchJsonOptions = {
  signal?: AbortSignal;
  timeoutMs?: number;
  headers?: Record<string, string>;
};

export type FetchJsonResult<T> = { data: T; ok: true } | { data: null; ok: false; error: string };

function isAbortError(e: unknown): boolean {
  return e instanceof Error && (e.name === "AbortError" || e.message?.includes("aborted"));
}

export async function fetchJson<T = unknown>(
  url: string,
  options: RequestInit & FetchJsonOptions = {}
): Promise<FetchJsonResult<T>> {
  const { signal, timeoutMs, headers: extraHeaders, ...init } = options;
  const controller = new AbortController();
  const signals: AbortSignal[] = [controller.signal];
  if (signal) signals.push(signal);

  if (timeoutMs && timeoutMs > 0) {
    const tid = setTimeout(() => controller.abort(), timeoutMs);
    controller.signal.addEventListener("abort", () => clearTimeout(tid), { once: true });
  }

  const combinedSignal = signals.length === 1 ? signals[0] : (() => {
    const c = new AbortController();
    for (const s of signals) s?.addEventListener?.("abort", () => c.abort(), { once: true });
    return c.signal;
  })();

  try {
    const res = await fetch(url, {
      ...init,
      signal: combinedSignal,
      headers: {
        "Content-Type": "application/json",
        ...extraHeaders,
      },
    } as RequestInit);

    const text = await res.text();
    let data: T;
    try {
      data = (text ? JSON.parse(text) : null) as T;
    } catch {
      if (!res.ok) {
        return { ok: false, data: null, error: text || `Request failed (${res.status})` };
      }
      return { ok: false, data: null, error: "Invalid JSON response" };
    }

    if (!res.ok) {
      const msg = typeof data === "object" && data != null && "error" in data && typeof (data as { error?: unknown }).error === "string"
        ? (data as { error: string }).error
        : `Request failed (${res.status})`;
      return { ok: false, data: null, error: msg };
    }

    return { ok: true, data };
  } catch (e) {
    if (isAbortError(e)) {
      return { ok: false, data: null, error: "Aborted" };
    }
    const msg = e instanceof Error ? e.message : "Request failed";
    return { ok: false, data: null, error: msg };
  }
}

export async function fetchJsonThrow<T = unknown>(
  url: string,
  options?: RequestInit & FetchJsonOptions
): Promise<T> {
  const result = await fetchJson<T>(url, options);
  if (result.ok) return result.data;
  throw new Error(result.error);
}
