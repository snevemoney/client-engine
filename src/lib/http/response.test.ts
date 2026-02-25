import { describe, it, expect } from "vitest";
import { okJson, errorJson, noStoreHeaders, shortCacheHeaders } from "./response";

describe("response", () => {
  describe("okJson", () => {
    it("returns 200 with JSON", async () => {
      const res = okJson({ foo: 1 });
      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Type")).toContain("application/json");
      const body = await res.json();
      expect(body).toEqual({ foo: 1 });
    });
    it("allows custom status and headers", async () => {
      const res = okJson({ id: "x" }, { status: 201, headers: { "X-Custom": "y" } });
      expect(res.status).toBe(201);
      expect(res.headers.get("X-Custom")).toBe("y");
    });
  });

  describe("errorJson", () => {
    it("returns stable shape", async () => {
      const res = errorJson("Bad request", 400);
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe(true);
      expect(body.message).toBe("Bad request");
    });
    it("includes extra fields", async () => {
      const res = errorJson("Rate limit", 429, { retryAfterSeconds: 60 });
      const body = await res.json();
      expect(body.retryAfterSeconds).toBe(60);
      expect(res.headers.get("Retry-After")).toBe("60");
    });
  });

  describe("noStoreHeaders", () => {
    it("returns no-store", () => {
      const h = noStoreHeaders();
      expect(h).toBeDefined();
      expect(new Headers(h).get("Cache-Control")).toContain("no-store");
    });
  });

  describe("shortCacheHeaders", () => {
    it("returns max-age with default", () => {
      const h = shortCacheHeaders();
      expect(new Headers(h).get("Cache-Control")).toContain("max-age=30");
    });
    it("uses custom seconds", () => {
      const h = shortCacheHeaders(60);
      expect(new Headers(h).get("Cache-Control")).toContain("max-age=60");
    });
  });
});
