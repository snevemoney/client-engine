import { describe, it, expect, beforeEach } from "vitest";
import { rateLimitByKey, getRequestClientKey } from "./rate-limit";

describe("rate-limit", () => {
  beforeEach(() => {
    // Rate limiter uses module-level map; we can't easily reset.
    // Use unique keys per test to avoid interference.
  });

  describe("rateLimitByKey", () => {
    it("allows first request", () => {
      const r = rateLimitByKey({ key: "test-1", windowMs: 60000, max: 5 });
      expect(r.ok).toBe(true);
      expect(r.remaining).toBe(4);
    });
    it("tracks count within window", () => {
      const key = "test-2-" + Date.now();
      rateLimitByKey({ key, windowMs: 60000, max: 3 });
      rateLimitByKey({ key, windowMs: 60000, max: 3 });
      const r = rateLimitByKey({ key, windowMs: 60000, max: 3 });
      expect(r.ok).toBe(true);
      expect(r.remaining).toBe(0);
    });
    it("rejects when over limit", () => {
      const key = "test-3-" + Date.now();
      for (let i = 0; i < 5; i++) {
        rateLimitByKey({ key, windowMs: 60000, max: 3 });
      }
      const r = rateLimitByKey({ key, windowMs: 60000, max: 3 });
      expect(r.ok).toBe(false);
    });
    it("resets after window", () => {
      const key = "test-4-" + Date.now();
      const now = 1000;
      rateLimitByKey({ key, windowMs: 100, max: 2, now });
      rateLimitByKey({ key, windowMs: 100, max: 2, now });
      const r = rateLimitByKey({ key, windowMs: 100, max: 2, now: now + 150 });
      expect(r.ok).toBe(true);
      expect(r.remaining).toBe(1);
    });
  });

  describe("getRequestClientKey", () => {
    it("prefers userId", () => {
      const req = new Request("http://x", { headers: { "x-forwarded-for": "1.2.3.4" } });
      expect(getRequestClientKey(req, "u123")).toBe("user:u123");
    });
    it("uses x-forwarded-for when no userId", () => {
      const req = new Request("http://x", { headers: { "x-forwarded-for": "1.2.3.4, 5.6.7.8" } });
      expect(getRequestClientKey(req)).toBe("ip:1.2.3.4");
    });
    it("falls back to anonymous", () => {
      const req = new Request("http://x");
      expect(getRequestClientKey(req)).toBe("anonymous");
    });
  });
});
