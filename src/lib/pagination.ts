/**
 * Phase 2.8: Shared pagination utilities for list APIs.
 * Consistent query params and response shape.
 */

export const PAGINATION_DEFAULTS = {
  page: 1,
  pageSize: 25,
  maxPageSize: 100,
} as const;

export type PaginationParams = {
  page: number;
  pageSize: number;
  skip: number;
};

export type PaginationMeta = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
};

/**
 * Parse page and pageSize from URL search params.
 * Defaults: page=1, pageSize=25, max 100.
 */
export function parsePaginationParams(
  searchParams: URLSearchParams | { get: (k: string) => string | null }
): PaginationParams {
  const page = Math.max(1, parseInt(searchParams.get("page") ?? String(PAGINATION_DEFAULTS.page), 10) || PAGINATION_DEFAULTS.page);
  const rawSize = parseInt(searchParams.get("pageSize") ?? String(PAGINATION_DEFAULTS.pageSize), 10) || PAGINATION_DEFAULTS.pageSize;
  const pageSize = Math.min(PAGINATION_DEFAULTS.maxPageSize, Math.max(1, rawSize));
  const skip = (page - 1) * pageSize;
  return { page, pageSize, skip };
}

/**
 * Build pagination meta from total count and params.
 */
export function buildPaginationMeta(
  total: number,
  params: PaginationParams
): PaginationMeta {
  const totalPages = Math.max(1, Math.ceil(total / params.pageSize));
  return {
    page: params.page,
    pageSize: params.pageSize,
    total,
    totalPages,
    hasNext: params.page < totalPages,
    hasPrev: params.page > 1,
  };
}

/**
 * Standard paginated response shape.
 */
export function paginatedResponse<T>(
  items: T[],
  pagination: PaginationMeta
): { items: T[]; pagination: PaginationMeta } {
  return { items, pagination };
}
