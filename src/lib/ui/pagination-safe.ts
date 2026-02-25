/**
 * Phase 2.8.3: Normalize pagination meta from API responses.
 * Handles legacy shapes and missing pagination.
 */

import type { PaginationMeta } from "@/lib/pagination";
import { PAGINATION_DEFAULTS } from "@/lib/pagination";

export type PaginationMetaInput = Partial<PaginationMeta> | null | undefined;

/**
 * Normalize pagination meta from API response.
 * Falls back to single-page when meta missing.
 */
export function normalizePagination(
  meta: PaginationMetaInput,
  itemCount?: number
): PaginationMeta {
  if (meta && typeof meta === "object") {
    const page = Math.max(1, meta.page ?? PAGINATION_DEFAULTS.page);
    const pageSize = Math.min(
      PAGINATION_DEFAULTS.maxPageSize,
      Math.max(1, meta.pageSize ?? PAGINATION_DEFAULTS.pageSize)
    );
    const total = Math.max(0, meta.total ?? itemCount ?? 0);
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    return {
      page,
      pageSize,
      total,
      totalPages,
      hasNext: (meta.hasNext ?? page < totalPages) && page < totalPages,
      hasPrev: (meta.hasPrev ?? page > 1) && page > 1,
    };
  }
  const count = itemCount ?? 0;
  return {
    page: 1,
    pageSize: count || PAGINATION_DEFAULTS.pageSize,
    total: count,
    totalPages: count > 0 ? 1 : 1,
    hasNext: false,
    hasPrev: false,
  };
}
