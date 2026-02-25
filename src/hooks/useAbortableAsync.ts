"use client";

import { useState, useCallback, useRef } from "react";

/**
 * Phase 2.6: Run async requests with stale request cancellation.
 * Aborts prior request when run() is called again before prior completes.
 */
export function useAbortableAsync<T, Args extends unknown[]>(
  fn: (signal: AbortSignal, ...args: Args) => Promise<T>
) {
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<T | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const runIdRef = useRef(0);

  const cancel = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
  }, []);

  const run = useCallback(
    async (...args: Args): Promise<T | null> => {
      if (abortRef.current) abortRef.current.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      const runId = ++runIdRef.current;
      setIsRunning(true);
      setError(null);

      try {
        const result = await fn(controller.signal, ...args);
        if (controller.signal.aborted || runId !== runIdRef.current) return null;
        setData(result);
        setError(null);
        return result;
      } catch (e) {
        if (controller.signal.aborted || runId !== runIdRef.current) return null;
        const msg = e instanceof Error ? e.message : "Request failed";
        if (e instanceof Error && (e.name === "AbortError" || e.message?.includes("aborted"))) {
          return null;
        }
        setError(msg);
        throw e;
      } finally {
        if (runId === runIdRef.current) {
          setIsRunning(false);
          abortRef.current = null;
        }
      }
    },
    [fn]
  );

  return { run, cancel, isRunning, error, data };
}
