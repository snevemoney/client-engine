import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fetchJson, fetchJsonThrow } from "./fetch-json";

describe("fetch-json", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("parses valid JSON", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      text: () => Promise.resolve('{"x":1}'),
    });
    const result = await fetchJson<{ x: number }>("/api/foo");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toEqual({ x: 1 });
  });

  it("handles non-ok response with JSON error", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 400,
      text: () => Promise.resolve('{"error":"Bad request"}'),
    });
    const result = await fetchJson("/api/foo");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("Bad request");
  });

  it("handles non-JSON error response", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 500,
      text: () => Promise.resolve("Internal Server Error"),
    });
    const result = await fetchJson("/api/foo");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("Internal Server Error");
  });

  it("fetchJsonThrow throws on error", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 404,
      text: () => Promise.resolve('{"error":"Not found"}'),
    });
    await expect(fetchJsonThrow("/api/foo")).rejects.toThrow("Not found");
  });

  it("handles abort without noisy error", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockRejectedValue(
      Object.assign(new Error("aborted"), { name: "AbortError" })
    );
    const result = await fetchJson("/api/foo");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("Aborted");
  });
});
