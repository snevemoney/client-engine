import { describe, it, expect, vi, beforeEach } from "vitest";
import { buildChangedFields, sanitizeAuditPayload } from "./log";

describe("audit/log", () => {
  describe("buildChangedFields", () => {
    it("returns empty when before and after match", () => {
      const before = { a: 1, b: "x" };
      const after = { a: 1, b: "x" };
      expect(buildChangedFields(before, after)).toEqual({});
    });

    it("returns diff for changed keys", () => {
      const before = { a: 1, b: "x" };
      const after = { a: 2, b: "x" };
      expect(buildChangedFields(before, after)).toEqual({
        a: { before: 1, after: 2 },
      });
    });

    it("respects allowlist", () => {
      const before = { a: 1, b: "x", c: 3 };
      const after = { a: 2, b: "y", c: 3 };
      expect(buildChangedFields(before, after, ["a"])).toEqual({
        a: { before: 1, after: 2 },
      });
    });
  });

  describe("sanitizeAuditPayload", () => {
    it("delegates to sanitizeMeta", () => {
      const out = sanitizeAuditPayload({ foo: "bar" });
      expect(out).toEqual({ foo: "bar" });
    });

    it("redacts secrets via sanitizeMeta", () => {
      const out = sanitizeAuditPayload({ apiKey: "sk-123", name: "test" });
      expect(out).toEqual({ apiKey: "[redacted]", name: "test" });
    });
  });
});
