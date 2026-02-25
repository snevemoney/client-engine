"use client";

import { useState, useCallback, useRef, useEffect } from "react";

const RETRY_DELAYS = [300, 800];

function isRetryableStatus(status: number): boolean {
  return status >= 500 || status === 408 || status === 429;
}

function isRetryableError(e: unknown): boolean {
  if (e instanceof TypeError && e.message?.includes("fetch")) return true;
  if (e instanceof Error && (e.name === "AbortError" || e.message?.includes("aborted"))) return false;
  return true;
}

/**
 * Phase 2.6: GET fetch with retries on transient failure.
 * No retry on 4xx (auth/validation). Abort-aware.
 * Fetches on mount and when url changes; aborts on unmount.
 */
export function useRetryableFetch<T>(
  url: string,
  options: {
    retries?: number;
    enabled?: boolean;
  } = {}
) {
  const { retries = 1, enabled = true } = options;
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const runIdRef = useRef(0);

  const refetch = useCallback(async (signal?: AbortSignal) => {
    if (!enabled) return;
    const runId = ++runIdRef.current;
    setLoading(true);
    setError(null);
    const controller = new AbortController();
    const effectiveSignal = signal ?? controller.signal;

    let lastError: string | null = null;
    const maxAttempts = 1 + retries;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      if (effectiveSignal?.aborted || runId !== runIdRef.current) return;
      const delay = RETRY_DELAYS[attempt - 1] ?? 0;
      if (attempt > 0) await new Promise((r) => setTimeout(r, delay));

      try {
        const res = await fetch(url, {
          credentials: "include",
          signal: effectiveSignal,
          cache: "no-store",
        });
        const json = await res.json().catch(() => null);

        if (res.ok) {
          if (runId === runIdRef.current) {
            setData(json as T);
            setError(null);
            setLoading(false);
          }
          return;
        }

        if (!isRetryableStatus(res.status)) {
          lastError = typeof json?.error === "string" ? json.error : `Request failed (${res.status})`;
          break;
        }
        lastError = typeof json?.error === "string" ? json.error : `Request failed (${res.status})`;
      } catch (e) {
        if (!isRetryableError(e)) {
          lastError = e instanceof Error ? e.message : "Request failed";
          break;
        }
        lastError = e instanceof Error ? e.message : "Request failed";
      }
    }

    if (runId === runIdRef.current) {
      setError(lastError ?? "Request failed");
      setLoading(false);
    }
  }, [url, retries, enabled]);

  useEffect(() => {
    if (!enabled || !url) return;
    const controller = new AbortController();
    void refetch(controller.signal); // eslint-disable-line react-hooks/set-state-in-effect -- async fetch, setState in callback
    return () => controller.abort();
  }, [url, enabled, refetch]);

  return { data, loading, error, refetch: () => refetch() };
}
