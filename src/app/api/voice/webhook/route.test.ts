import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { hmacSha256Hex } from "@/lib/crypto/hmac";

vi.mock("@/lib/api-utils", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api-utils")>("@/lib/api-utils");
  return {
    ...actual,
    withRouteTiming: (_name: string, fn: () => Promise<Response>) => fn(),
  };
});

vi.mock("@/lib/voice", () => ({
  logCallOutcome: vi.fn(async () => ({ id: "call-1", created: true })),
  recordOptOut: vi.fn(async () => undefined),
}));

vi.mock("@/lib/db", () => ({
  db: {
    proposal: {
      findUnique: vi.fn(),
    },
  },
}));

const SECRET = "voice-test-secret";

function makeRequest(body: string, headers?: Record<string, string>): NextRequest {
  return new NextRequest("http://x/api/voice/webhook", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body,
  });
}

describe("POST /api/voice/webhook", () => {
  const original = process.env.VOICE_WEBHOOK_SECRET;

  beforeEach(() => {
    vi.resetModules();
    process.env.VOICE_WEBHOOK_SECRET = SECRET;
  });

  afterEach(() => {
    process.env.VOICE_WEBHOOK_SECRET = original;
  });

  it("returns 401 when the secret is unset", async () => {
    delete process.env.VOICE_WEBHOOK_SECRET;
    const { POST } = await import("./route");
    const body = JSON.stringify({ proposalId: "p1", outcome: "no_answer" });
    const res = await POST(makeRequest(body, { "x-voice-signature": hmacSha256Hex(SECRET, body) }));
    expect(res.status).toBe(401);
  });

  it("returns 401 when the signature is missing or wrong", async () => {
    const { POST } = await import("./route");
    const body = JSON.stringify({ proposalId: "p1", outcome: "no_answer" });
    const missing = await POST(makeRequest(body));
    expect(missing.status).toBe(401);
    const wrong = await POST(makeRequest(body, { "x-voice-signature": "00" }));
    expect(wrong.status).toBe(401);
  });

  it("returns 400 for an invalid body after a valid signature", async () => {
    const { POST } = await import("./route");
    const body = JSON.stringify({ outcome: "no_answer" });
    const res = await POST(
      makeRequest(body, { "x-voice-signature": hmacSha256Hex(SECRET, body) })
    );
    expect(res.status).toBe(400);
  });
});
