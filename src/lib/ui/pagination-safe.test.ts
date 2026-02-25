import { describe, it, expect } from "vitest";
import { normalizePagination } from "./pagination-safe";

describe("normalizePagination", () => {
  it("returns defaults when meta is null", () => {
    const r = normalizePagination(null, 0);
    expect(r.page).toBe(1);
    expect(r.pageSize).toBe(25);
    expect(r.total).toBe(0);
    expect(r.totalPages).toBe(1);
    expect(r.hasNext).toBe(false);
    expect(r.hasPrev).toBe(false);
  });

  it("uses itemCount when meta missing", () => {
    const r = normalizePagination(null, 42);
    expect(r.total).toBe(42);
    expect(r.totalPages).toBe(1);
  });

  it("uses meta when present", () => {
    const r = normalizePagination(
      { page: 2, pageSize: 10, total: 25, totalPages: 3, hasNext: true, hasPrev: true },
      0
    );
    expect(r.page).toBe(2);
    expect(r.pageSize).toBe(10);
    expect(r.total).toBe(25);
    expect(r.totalPages).toBe(3);
    expect(r.hasNext).toBe(true);
    expect(r.hasPrev).toBe(true);
  });

  it("clamps pageSize to max 100", () => {
    const r = normalizePagination(
      { page: 1, pageSize: 200, total: 500, totalPages: 5, hasNext: true, hasPrev: false },
      0
    );
    expect(r.pageSize).toBe(100);
  });

  it("ensures page at least 1", () => {
    const r = normalizePagination(
      { page: 0, pageSize: 25, total: 10, totalPages: 1, hasNext: false, hasPrev: false },
      0
    );
    expect(r.page).toBe(1);
  });
});
