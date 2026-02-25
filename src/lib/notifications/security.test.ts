/**
 * Phase 2.9: Security + sanitization verification tests.
 */
import { describe, it, expect } from "vitest";
import { sanitizeNotificationMeta } from "./sanitize";

describe("security: must never log/store raw", () => {
  it("redacts Authorization headers", () => {
    const payload = { headers: { Authorization: "Bearer sk-xxx", "X-API-Key": "key123" } };
    const out = sanitizeNotificationMeta(payload);
    const h = out?.headers as Record<string, unknown>;
    expect(h?.Authorization).toBe("[redacted]");
  });

  it("redacts bearer tokens in any key", () => {
    const payload = { accessToken: "eyJhbGc...", refreshToken: "def456" };
    const out = sanitizeNotificationMeta(payload);
    expect(out?.accessToken).toBe("[redacted]");
    expect(out?.refreshToken).toBe("[redacted]");
  });

  it("redacts API keys", () => {
    const payload = { apiKey: "sk-123", api_key: "key" };
    const out = sanitizeNotificationMeta(payload);
    expect(out?.apiKey).toBe("[redacted]");
    expect(out?.api_key).toBe("[redacted]");
  });

  it("redacts raw webhook URLs", () => {
    const payload = {
      webhookUrl: "https://hooks.slack.com/services/T00/B00/xxx",
      webhook_url: "https://discord.com/api/webhooks/123/abc",
    };
    const out = sanitizeNotificationMeta(payload);
    expect(out?.webhookUrl).toBe("[redacted]");
    expect(out?.webhook_url).toBe("[redacted]");
  });

  it("redacts configJson to avoid secret leakage", () => {
    const payload = { configJson: { url: "https://x.com", token: "secret" } };
    const out = sanitizeNotificationMeta(payload);
    expect(out?.configJson).toBe("[redacted]");
  });

  it("webhook error response is sanitized", () => {
    const mockErrorResponse = {
      status: 401,
      body: { error: "Invalid", token: "leaked", authorization: "Bearer x" },
    };
    const out = sanitizeNotificationMeta(mockErrorResponse);
    const body = out?.body as Record<string, unknown>;
    expect(body?.token).toBe("[redacted]");
    expect(body?.authorization).toBe("[redacted]");
  });

  it("Phase 3.6.2: nested object with Authorization header redacted", () => {
    const payload = {
      response: {
        headers: { Authorization: "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9" },
        status: 401,
      },
    };
    const out = sanitizeNotificationMeta(payload);
    const resp = out?.response as Record<string, unknown>;
    const headers = resp?.headers as Record<string, unknown>;
    expect(headers?.Authorization).toBe("[redacted]");
  });
});
