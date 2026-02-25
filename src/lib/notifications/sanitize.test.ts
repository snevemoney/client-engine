import { describe, it, expect } from "vitest";
import { sanitizeNotificationMeta } from "./sanitize";

describe("sanitizeNotificationMeta", () => {
  it("redacts token", () => {
    const out = sanitizeNotificationMeta({ token: "secret123" });
    expect(out).toEqual({ token: "[redacted]" });
  });

  it("redacts apiKey", () => {
    const out = sanitizeNotificationMeta({ apiKey: "sk-xxx" });
    expect(out).toEqual({ apiKey: "[redacted]" });
  });

  it("redacts authorization", () => {
    const out = sanitizeNotificationMeta({ authorization: "Bearer xxx" });
    expect(out).toEqual({ authorization: "[redacted]" });
  });

  it("redacts nested secret keys", () => {
    const out = sanitizeNotificationMeta({
      config: { password: "pwd", nested: { accessToken: "tok" } },
    });
    expect(out?.config).toEqual({ password: "[redacted]", nested: { accessToken: "[redacted]" } });
  });

  it("redacts url-like keys", () => {
    const out = sanitizeNotificationMeta({ webhookUrl: "https://x.com/secret" });
    expect(out?.webhookUrl).toBe("[redacted]");
  });

  it("preserves safe strings", () => {
    const out = sanitizeNotificationMeta({ title: "Hello", count: 5 });
    expect(out).toEqual({ title: "Hello", count: 5 });
  });

  it("handles arrays", () => {
    const out = sanitizeNotificationMeta({ items: [{ token: "x" }, { name: "a" }] });
    expect(out?.items).toEqual([{ token: "[redacted]" }, { name: "a" }]);
  });

  it("returns null for null/undefined", () => {
    expect(sanitizeNotificationMeta(null)).toBeNull();
    expect(sanitizeNotificationMeta(undefined)).toBeNull();
  });

  it("redacts bearer tokens", () => {
    const out = sanitizeNotificationMeta({ Authorization: "Bearer sk-abc123xyz" });
    expect(out?.Authorization).toBe("[redacted]");
  });

  it("redacts raw webhook URLs in payload", () => {
    const out = sanitizeNotificationMeta({
      url: "https://discord.com/api/webhooks/123/secret-token",
      webhookUrl: "https://hooks.slack.com/secret",
    });
    expect(out?.url).toBe("[redacted]");
    expect(out?.webhookUrl).toBe("[redacted]");
  });

  it("never leaks API keys in nested error response", () => {
    const errorResponse = {
      error: "Unauthorized",
      apiKey: "sk-live-xxx",
      headers: { authorization: "Bearer tok" },
    };
    const out = sanitizeNotificationMeta(errorResponse);
    expect(out?.apiKey).toBe("[redacted]");
    expect(out?.headers).toBeDefined();
    const headers = out?.headers as Record<string, unknown>;
    expect(headers?.authorization).toBe("[redacted]");
  });
});
