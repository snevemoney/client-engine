"use client";

import { useCallback, useMemo } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

/**
 * Phase 2.8.3: URL-synced query state for list pages.
 * Reads from searchParams, updates via router.replace (no full reload).
 */
export function useUrlQueryState() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const getString = useCallback(
    (key: string, defaultValue = ""): string => {
      const v = searchParams.get(key);
      return v ?? defaultValue;
    },
    [searchParams]
  );

  const getInt = useCallback(
    (key: string, defaultValue: number, opts?: { min?: number; max?: number }): number => {
      const v = searchParams.get(key);
      if (v == null || v === "") return defaultValue;
      const n = parseInt(v, 10);
      if (Number.isNaN(n)) return defaultValue;
      if (opts?.min != null && n < opts.min) return opts.min;
      if (opts?.max != null && n > opts.max) return opts.max;
      return n;
    },
    [searchParams]
  );

  const getPage = useCallback((): number => {
    return getInt("page", DEFAULT_PAGE, { min: 1 });
  }, [getInt]);

  const getPageSize = useCallback((): number => {
    return getInt("pageSize", DEFAULT_PAGE_SIZE, { min: 1, max: MAX_PAGE_SIZE });
  }, [getInt]);

  const update = useCallback(
    (updates: Record<string, string | number | null | undefined>, resetPage = false) => {
      const next = new URLSearchParams(searchParams.toString());
      for (const [k, v] of Object.entries(updates)) {
        if (v == null || v === "" || (typeof v === "string" && !v.trim())) {
          next.delete(k);
        } else {
          next.set(k, String(v));
        }
      }
      if (resetPage) {
        next.set("page", String(DEFAULT_PAGE));
      }
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  const setString = useCallback(
    (key: string, value: string | null, resetPage = false) => {
      update({ [key]: value ?? undefined }, resetPage);
    },
    [update]
  );

  const setInt = useCallback(
    (key: string, value: number | null, resetPage = false) => {
      update({ [key]: value ?? undefined }, resetPage);
    },
    [update]
  );

  const setPage = useCallback(
    (page: number) => {
      if (page < 1) return;
      setInt("page", page, false);
    },
    [setInt]
  );

  const setPageSize = useCallback(
    (pageSize: number) => {
      const clamped = Math.min(MAX_PAGE_SIZE, Math.max(1, pageSize));
      setInt("pageSize", clamped, true);
    },
    [setInt]
  );

  const setSearch = useCallback(
    (search: string) => {
      setString("search", search.trim() || null, true);
    },
    [setString]
  );

  const setFilter = useCallback(
    (key: string, value: string) => {
      setString(key, value === "all" || value === "" ? null : value, true);
    },
    [setString]
  );

  return useMemo(
    () => ({
      getString,
      getInt,
      getPage,
      getPageSize,
      update,
      setString,
      setInt,
      setPage,
      setPageSize,
      setSearch,
      setFilter,
      searchParams,
    }),
    [
      getString,
      getInt,
      getPage,
      getPageSize,
      update,
      setString,
      setInt,
      setPage,
      setPageSize,
      setSearch,
      setFilter,
      searchParams,
    ]
  );
}
