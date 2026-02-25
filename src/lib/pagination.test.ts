import { describe, it, expect } from "vitest";
import {
  parsePaginationParams,
  buildPaginationMeta,
  paginatedResponse,
  PAGINATION_DEFAULTS,
} from "./pagination";

describe("pagination", () => {
  describe("parsePaginationParams", () => {
    it("uses defaults when no params", () => {
      const params = parsePaginationParams(new URLSearchParams());
      expect(params.page).toBe(PAGINATION_DEFAULTS.page);
      expect(params.pageSize).toBe(PAGINATION_DEFAULTS.pageSize);
      expect(params.skip).toBe(0);
    });

    it("parses page and pageSize", () => {
      const params = parsePaginationParams(new URLSearchParams("page=3&pageSize=50"));
      expect(params.page).toBe(3);
      expect(params.pageSize).toBe(50);
      expect(params.skip).toBe(100);
    });

    it("caps pageSize at max", () => {
      const params = parsePaginationParams(new URLSearchParams("pageSize=200"));
      expect(params.pageSize).toBe(PAGINATION_DEFAULTS.maxPageSize);
    });

    it("ensures page >= 1", () => {
      const params = parsePaginationParams(new URLSearchParams("page=0"));
      expect(params.page).toBe(1);
    });
  });

  describe("buildPaginationMeta", () => {
    it("computes totalPages and hasNext/hasPrev", () => {
      const params = { page: 2, pageSize: 25, skip: 25 };
      const meta = buildPaginationMeta(100, params);
      expect(meta.total).toBe(100);
      expect(meta.totalPages).toBe(4);
      expect(meta.hasNext).toBe(true);
      expect(meta.hasPrev).toBe(true);
    });

    it("hasPrev false on first page", () => {
      const params = { page: 1, pageSize: 25, skip: 0 };
      const meta = buildPaginationMeta(50, params);
      expect(meta.hasPrev).toBe(false);
      expect(meta.hasNext).toBe(true);
    });

    it("hasNext false on last page", () => {
      const params = { page: 2, pageSize: 25, skip: 25 };
      const meta = buildPaginationMeta(50, params);
      expect(meta.hasNext).toBe(false);
      expect(meta.hasPrev).toBe(true);
    });
  });

  describe("paginatedResponse", () => {
    it("returns items and pagination", () => {
      const items = [{ id: "1" }, { id: "2" }];
      const pagination = { page: 1, pageSize: 25, total: 2, totalPages: 1, hasNext: false, hasPrev: false };
      const res = paginatedResponse(items, pagination);
      expect(res.items).toEqual(items);
      expect(res.pagination).toEqual(pagination);
    });
  });
});
