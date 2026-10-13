import { describe, it, expect } from "vitest";
import {
  hmacSha256Hex,
  verifyGitHubWebhookSignature,
  verifyHmacSha256Signature,
  firstHeader,
} from "./hmac";

const SECRET = "test-webhook-secret";
const BODY = JSON.stringify({ ok: true, n: 1 });

describe("verifyGitHubWebhookSignature", () => {
  it("accepts a valid sha256= hex header", () => {
    const header = `sha256=${hmacSha256Hex(SECRET, BODY)}`;
    expect(
      verifyGitHubWebhookSignature({ secret: SECRET, signatureHeader: header, rawBody: BODY })
    ).toBe(true);
  });

  it("fails closed when secret is unset", () => {
    const header = `sha256=${hmacSha256Hex(SECRET, BODY)}`;
    expect(
      verifyGitHubWebhookSignature({ secret: undefined, signatureHeader: header, rawBody: BODY })
    ).toBe(false);
    expect(
      verifyGitHubWebhookSignature({ secret: "", signatureHeader: header, rawBody: BODY })
    ).toBe(false);
    expect(
      verifyGitHubWebhookSignature({ secret: "   ", signatureHeader: header, rawBody: BODY })
    ).toBe(false);
  });

  it("rejects a missing or wrong signature", () => {
    expect(
      verifyGitHubWebhookSignature({ secret: SECRET, signatureHeader: null, rawBody: BODY })
    ).toBe(false);
    expect(
      verifyGitHubWebhookSignature({
        secret: SECRET,
        signatureHeader: `sha256=${hmacSha256Hex("other", BODY)}`,
        rawBody: BODY,
      })
    ).toBe(false);
    expect(
      verifyGitHubWebhookSignature({
        secret: SECRET,
        signatureHeader: `sha256=${hmacSha256Hex(SECRET, BODY)}`,
        rawBody: BODY + "x",
      })
    ).toBe(false);
  });
});

describe("verifyHmacSha256Signature", () => {
  it("accepts raw hex or sha256= prefix", () => {
    const hex = hmacSha256Hex(SECRET, BODY);
    expect(
      verifyHmacSha256Signature({ secret: SECRET, signatureHeader: hex, rawBody: BODY })
    ).toBe(true);
    expect(
      verifyHmacSha256Signature({ secret: SECRET, signatureHeader: `sha256=${hex}`, rawBody: BODY })
    ).toBe(true);
  });

  it("fails closed when secret or signature is missing", () => {
    const hex = hmacSha256Hex(SECRET, BODY);
    expect(
      verifyHmacSha256Signature({ secret: undefined, signatureHeader: hex, rawBody: BODY })
    ).toBe(false);
    expect(
      verifyHmacSha256Signature({ secret: SECRET, signatureHeader: null, rawBody: BODY })
    ).toBe(false);
  });
});

describe("firstHeader", () => {
  it("returns the first non-empty header", () => {
    const headers = new Headers({
      "x-voice-signature": "",
      "x-retell-signature": "abc",
    });
    expect(firstHeader(headers, ["x-voice-signature", "x-retell-signature"])).toBe("abc");
    expect(firstHeader(headers, ["x-missing"])).toBeNull();
  });
});
