import { describe, it, expect } from "vitest";
import { sanitizeMeta, sanitizeErrorMessage, safeFingerprint } from "./sanitize";

describe("sanitize", () => {
  describe("sanitizeMeta", () => {
    it("returns null for null/undefined", () => {
      expect(sanitizeMeta(null)).toBeNull();
      expect(sanitizeMeta(undefined)).toBeNull();
    });

    it("wraps primitives in value key", () => {
      expect(sanitizeMeta("hello")).toEqual({ value: "hello" });
      expect(sanitizeMeta(42)).toEqual({ value: "42" });
    });

    it("redacts secret keys (case-insensitive)", () => {
      const out = sanitizeMeta({ apiKey: "sk-123", name: "foo" });
      expect(out).toEqual({ apiKey: "[redacted]", name: "foo" });
    });

    it("truncates long strings", () => {
      const long = "a".repeat(600);
      const out = sanitizeMeta({ text: long });
      expect((out!.text as string).length).toBeLessThanOrEqual(501);
      expect((out!.text as string).endsWith("…")).toBe(true);
    });

    it("strips undefined", () => {
      const out = sanitizeMeta({ a: 1, b: undefined, c: "x" });
      expect(out).toEqual({ a: 1, c: "x" });
    });

    it("handles nested objects", () => {
      const out = sanitizeMeta({ config: { password: "secret", ok: true } });
      expect(out).toEqual({ config: { password: "[redacted]", ok: true } });
    });

    it("redacts configJson (prod security)", () => {
      const out = sanitizeMeta({ configJson: '{"webhookUrl":"https://x.com/secret"}' });
      expect(out?.configJson).toBe("[redacted]");
    });

    it("redacts webhook_url keys", () => {
      const out = sanitizeMeta({ webhook_url: "https://hooks.slack.com/secret" });
      expect(out?.webhook_url).toBe("[redacted]");
    });
  });

  describe("sanitizeErrorMessage", () => {
    it("returns Unknown error for null/undefined", () => {
      expect(sanitizeErrorMessage(null)).toBe("Unknown error");
      expect(sanitizeErrorMessage(undefined)).toBe("Unknown error");
    });

    it("returns string as-is when short", () => {
      expect(sanitizeErrorMessage("Something failed")).toBe("Something failed");
    });

    it("truncates long strings", () => {
      const long = "x".repeat(600);
      expect(sanitizeErrorMessage(long).length).toBeLessThanOrEqual(500);
    });

    it("extracts message from Error", () => {
      expect(sanitizeErrorMessage(new Error("DB connection failed"))).toBe("DB connection failed");
    });

    it("redacts Bearer tokens in error message", () => {
      expect(sanitizeErrorMessage("Auth failed: Bearer sk-abc123xyz")).toBe(
        "Auth failed: [redacted]"
      );
    });

    it("redacts webhook URLs in error message", () => {
      const msg = "Webhook failed: https://hooks.slack.com/services/T00/B00/secret";
      expect(sanitizeErrorMessage(msg)).toContain("[url redacted]");
      expect(sanitizeErrorMessage(msg)).not.toContain("secret");
    });

    it("redacts API key patterns in error message", () => {
      expect(sanitizeErrorMessage("Invalid sk_live_abc123")).toContain("[redacted]");
      expect(sanitizeErrorMessage("Invalid sk_live_abc123")).not.toContain("sk_live");
    });

    it("3.6.4 regression: redacts query-string secrets (webhook URLs with params)", () => {
      const msg = "Failed: https://hooks.slack.com/services/T00/B00/abc?token=secret123";
      expect(sanitizeErrorMessage(msg)).toContain("[url redacted]");
      expect(sanitizeErrorMessage(msg)).not.toMatch(/token=secret|secret123/);
    });

    it("3.6.4 regression: nested Error message (Error with serialized object)", () => {
      const err = new Error('{"url":"https://hooks.slack.com/x","key":"sk_live_xyz"}');
      const out = sanitizeErrorMessage(err);
      expect(out).not.toContain("sk_live");
      expect(out).not.toContain("hooks.slack");
    });

    it("3.6.4 regression: long tokens truncated and redacted", () => {
      const longToken = "sk_live_" + "x".repeat(200);
      const out = sanitizeErrorMessage(longToken);
      expect(out).not.toContain("sk_live");
      expect(out.length).toBeLessThanOrEqual(500);
    });

    it("3.6.4 regression: mixed secrets in one string", () => {
      const msg = "Auth Bearer sk-xyz failed; webhook https://hooks.slack.com/secret also failed";
      const out = sanitizeErrorMessage(msg);
      expect(out).not.toContain("sk-xyz");
      expect(out).not.toContain("secret");
      expect(out).toContain("[redacted]");
      expect(out).toContain("[url redacted]");
    });
  });

  describe("safeFingerprint", () => {
    it("returns empty for no parts", () => {
      expect(safeFingerprint([])).toBe("");
    });

    it("returns deterministic hash for parts", () => {
      const fp1 = safeFingerprint(["a", "b", 1]);
      const fp2 = safeFingerprint(["a", "b", 1]);
      expect(fp1).toBe(fp2);
      expect(fp1).toMatch(/^fp_[a-z0-9]+$/);
    });

    it("filters null/undefined/empty", () => {
      const fp = safeFingerprint(["a", null, undefined, "", "b"]);
      expect(fp).toMatch(/^fp_/);
    });
  });
});
