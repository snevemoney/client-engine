import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useUrlQueryState } from "./useUrlQueryState";

const mockReplace = vi.fn();
const mockSearchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace }),
  usePathname: () => "/dashboard/intake",
  useSearchParams: () => mockSearchParams,
}));

describe("useUrlQueryState", () => {
  beforeEach(() => {
    mockReplace.mockClear();
    mockSearchParams.forEach((_, k) => mockSearchParams.delete(k));
  });

  it("parses defaults when URL is empty", () => {
    const { result } = renderHook(() => useUrlQueryState());
    expect(result.current.getPage()).toBe(1);
    expect(result.current.getPageSize()).toBe(25);
    expect(result.current.getString("search")).toBe("");
    expect(result.current.getString("status", "all")).toBe("all");
  });

  it("invalid ints fallback to default", () => {
    mockSearchParams.set("page", "abc");
    mockSearchParams.set("pageSize", "xyz");
    const { result } = renderHook(() => useUrlQueryState());
    expect(result.current.getPage()).toBe(1);
    expect(result.current.getPageSize()).toBe(25);
  });

  it("set string param updates URL", () => {
    const { result } = renderHook(() => useUrlQueryState());
    act(() => {
      result.current.setString("search", "foo");
    });
    expect(mockReplace).toHaveBeenCalled();
    expect(mockReplace.mock.calls[0][0]).toContain("search=foo");
  });

  it("set int param updates URL", () => {
    const { result } = renderHook(() => useUrlQueryState());
    act(() => {
      result.current.setInt("page", 3);
    });
    expect(mockReplace).toHaveBeenCalledWith(
      "/dashboard/intake?page=3",
      expect.any(Object)
    );
  });

  it("remove empty param deletes from URL", () => {
    mockSearchParams.set("search", "x");
    const { result } = renderHook(() => useUrlQueryState());
    act(() => {
      result.current.setString("search", "");
    });
    expect(mockReplace).toHaveBeenCalledWith(
      "/dashboard/intake",
      expect.any(Object)
    );
  });

  it("setSearch with empty string resets page", () => {
    mockSearchParams.set("page", "5");
    const { result } = renderHook(() => useUrlQueryState());
    act(() => {
      result.current.setSearch("test");
    });
    expect(mockReplace).toHaveBeenCalledWith(
      expect.stringContaining("search=test"),
      expect.any(Object)
    );
    expect(mockReplace.mock.calls[0][0]).toContain("page=1");
  });

  it("setFilter with all removes param", () => {
    mockSearchParams.set("status", "qualified");
    const { result } = renderHook(() => useUrlQueryState());
    act(() => {
      result.current.setFilter("status", "all");
    });
    expect(mockReplace).toHaveBeenCalled();
    const url = mockReplace.mock.calls[0][0];
    expect(url).not.toContain("status=");
  });
});
