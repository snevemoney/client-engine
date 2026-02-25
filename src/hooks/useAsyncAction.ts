"use client";

import { useState, useCallback, useRef } from "react";
import { toErrorMessage } from "@/lib/ui/error-message";

export type AsyncActionCallbacks<T> = {
  onMutate?: () => void;
  onSuccess?: (data: T) => void;
  onError?: (err: string) => void;
  onSettled?: () => void;
};

export type ToastFn = (message: string, type?: "success" | "error") => void;

/**
 * Phase 2.6: Mutation action wrapper with pending lock and double-click protection.
 */
export function useAsyncAction<T, Args extends unknown[]>(
  fn: (...args: Args) => Promise<T>,
  options: {
    actionKey?: string;
    optimistic?: boolean;
    onMutate?: () => void;
    onSuccess?: (data: T) => void;
    onError?: (err: string) => void;
    onSettled?: () => void;
    toast?: ToastFn;
    successMessage?: string;
  } = {}
) {
  const {
    actionKey = "default",
    optimistic = false,
    onMutate,
    onSuccess,
    onError,
    onSettled,
    toast,
    successMessage,
  } = options;

  const [pending, setPending] = useState(false);
  const pendingRef = useRef(false);

  const execute = useCallback(
    async (...args: Args): Promise<T | null> => {
      if (pendingRef.current) return null;
      pendingRef.current = true;
      setPending(true);

      let optimisticRollback: (() => void) | undefined;
      if (optimistic && onMutate) {
        onMutate();
        optimisticRollback = () => {
          onError?.("Rolled back");
        };
      }
      onMutate?.();

      try {
        const result = await fn(...args);
        onSuccess?.(result);
        if (successMessage) toast?.(successMessage, "success");
        return result;
      } catch (e) {
        const msg = toErrorMessage(e);
        onError?.(msg);
        toast?.(msg, "error");
        if (optimisticRollback) optimisticRollback();
        return null;
      } finally {
        pendingRef.current = false;
        setPending(false);
        onSettled?.();
      }
    },
    [fn, actionKey, optimistic, onMutate, onSuccess, onError, onSettled, toast, successMessage]
  );

  return { execute, pending };
}
