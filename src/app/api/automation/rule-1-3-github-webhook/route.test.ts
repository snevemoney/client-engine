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

const SECRET = "github-test-secret";

function makeRequest(body: string, signature?: string): NextRequest {
  const headers = new Headers({ "content-type": "application/json" });
  if (signature) headers.set("x-hub-signature-256", signature);
  return new NextRequest("http://x/api/automation/rule-1-3-github-webhook", {
    method: "POST",
    headers,
    body,
  });
}

describe("POST /api/automation/rule-1-3-github-webhook", () => {
  const original = process.env.GITHUB_WEBHOOK_SECRET;

  beforeEach(() => {
    vi.resetModules();
    process.env.GITHUB_WEBHOOK_SECRET = SECRET;
  });

  afterEach(() => {
    process.env.GITHUB_WEBHOOK_SECRET = original;
  });

  it("returns 401 when secret is unset (fail closed)", async () => {
    delete process.env.GITHUB_WEBHOOK_SECRET;
    const { POST } = await import("./route");
    const body = JSON.stringify({ ref: "refs/heads/main" });
    const res = await POST(makeRequest(body, `sha256=${hmacSha256Hex(SECRET, body)}`));
    expect(res.status).toBe(401);
  });

  it("returns 401 when signature is missing", async () => {
    const { POST } = await import("./route");
    const res = await POST(makeRequest(JSON.stringify({ ref: "refs/heads/main" })));
    expect(res.status).toBe(401);
  });

  it("skips non-main refs after a valid signature", async () => {
    const { POST } = await import("./route");
    const body = JSON.stringify({ ref: "refs/heads/feature" });
    const res = await POST(makeRequest(body, `sha256=${hmacSha256Hex(SECRET, body)}`));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.message).toMatch(/Skipped/);
  });
});
