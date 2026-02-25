import { describe, it, expect } from "vitest";
import { buildRequestKey, fingerprintBody } from "./request-key";

describe("request-key", () => {
  describe("buildRequestKey", () => {
    it("same method+path => same key when no query", () => {
      expect(buildRequestKey("GET", "/api/foo")).toBe(buildRequestKey("GET", "/api/foo"));
    });

    it("different method or path => different key", () => {
      expect(buildRequestKey("GET", "/api/foo")).not.toBe(buildRequestKey("POST", "/api/foo"));
      expect(buildRequestKey("GET", "/api/foo")).not.toBe(buildRequestKey("GET", "/api/bar"));
    });

    it("same query params => same key (sorted)", () => {
      const a = buildRequestKey("GET", "/api", { search: "x", status: "all" });
      const b = buildRequestKey("GET", "/api", { status: "all", search: "x" });
      expect(a).toBe(b);
    });

    it("different query/body => different key", () => {
      const a = buildRequestKey("GET", "/api", { search: "a" });
      const b = buildRequestKey("GET", "/api", { search: "b" });
      expect(a).not.toBe(b);
    });

    it("body fingerprint affects key", () => {
      const a = buildRequestKey("POST", "/api", undefined, "{}");
      const b = buildRequestKey("POST", "/api", undefined, '{"x":1}');
      expect(a).not.toBe(b);
    });
  });

  describe("fingerprintBody", () => {
    it("stringifies objects", () => {
      expect(fingerprintBody({ a: 1 })).toBe('{"a":1}');
    });
    it("returns string as-is", () => {
      expect(fingerprintBody("raw")).toBe("raw");
    });
    it("returns empty for null/undefined", () => {
      expect(fingerprintBody(null)).toBe("");
      expect(fingerprintBody(undefined)).toBe("");
    });
  });
});
