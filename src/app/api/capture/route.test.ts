/**
 * Capture route contract tests — API key auth, validation, dedup, 201.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { db } from "@/lib/db";

vi.mock("@/lib/api-utils", () => ({
  checkStateChangeRateLimit: vi.fn(() => null),
}));

const CAPTURE_PREFIX = "capture-test-";

function makeRequest(body: Record<string, unknown>, apiKey?: string): NextRequest {
  const headers = new Headers();
  if (apiKey) headers.set("x-api-key", apiKey);
  return new NextRequest("http://x/api/capture", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

describe("POST /api/capture", () => {
  const originalKey = process.env.CAPTURE_API_KEY;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CAPTURE_API_KEY = "test-capture-key-123";
  });

  afterEach(async () => {
    process.env.CAPTURE_API_KEY = originalKey;
    await db.lead.deleteMany({ where: { source: "capture", title: { contains: CAPTURE_PREFIX } } });
  });

  it("returns 401 when API key is missing", async () => {
    const { POST } = await import("./route");
    const req = makeRequest({ title: "Test" });
    const res = await POST(req);
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe("Unauthorized");
  });

  it("returns 401 when API key is wrong", async () => {
    const { POST } = await import("./route");
    const req = makeRequest({ title: "Test" }, "wrong-key");
    const res = await POST(req);
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe("Unauthorized");
  });

  it("returns 400 when title is missing", async () => {
    const { POST } = await import("./route");
    const req = makeRequest({}, process.env.CAPTURE_API_KEY);
    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("title");
  });

  it("returns 400 when title is not a string", async () => {
    const { POST } = await import("./route");
    const req = makeRequest({ title: 123 }, process.env.CAPTURE_API_KEY);
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 201 and creates lead with valid body", async () => {
    const { POST } = await import("./route");
    const title = `${CAPTURE_PREFIX} ${Date.now()}`;
    const req = makeRequest(
      { title, source: "test", content: "Need a website", budget: "$5k" },
      process.env.CAPTURE_API_KEY
    );
    const res = await POST(req);
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.message).toBe("created");
    expect(data.leadId).toBeDefined();

    const lead = await db.lead.findUnique({ where: { id: data.leadId } });
    expect(lead?.title).toBe(title);
    expect(lead?.source).toBe("test");
    expect(lead?.budget).toBe("$5k");
  });

  it("returns 200 duplicate when contentHash matches existing lead", async () => {
    const { POST } = await import("./route");
    const title = `${CAPTURE_PREFIX} dedup-${Date.now()}`;
    const url = "https://example.com/job/1";
    const content = "Same content for dedup";

    const req1 = makeRequest(
      { title, url, content, source: "test" },
      process.env.CAPTURE_API_KEY
    );
    const res1 = await POST(req1);
    expect(res1.status).toBe(201);
    const { leadId } = await res1.json();

    const req2 = makeRequest(
      { title: title + "-v2", url, content, source: "test" },
      process.env.CAPTURE_API_KEY
    );
    const res2 = await POST(req2);
    expect(res2.status).toBe(200);
    const data2 = await res2.json();
    expect(data2.message).toBe("duplicate");
    expect(data2.leadId).toBe(leadId);
  });

  it("returns 400 for invalid JSON body", async () => {
    const { POST } = await import("./route");
    const req = new NextRequest("http://x/api/capture", {
      method: "POST",
      headers: { "x-api-key": process.env.CAPTURE_API_KEY! },
      body: "not json {",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("accepts optional fields: budget, timeline, platform, contactName, contactEmail, tags", async () => {
    const { POST } = await import("./route");
    const title = `${CAPTURE_PREFIX} optional-${Date.now()}`;
    const req = makeRequest(
      {
        title,
        budget: "$10k",
        timeline: "2 weeks",
        platform: "web",
        contactName: "Jane",
        contactEmail: "jane@example.com",
        tags: ["urgent", "vip"],
      },
      process.env.CAPTURE_API_KEY
    );
    const res = await POST(req);
    expect(res.status).toBe(201);
    const data = await res.json();
    const lead = await db.lead.findUnique({ where: { id: data.leadId } });
    expect(lead?.budget).toBe("$10k");
    expect(lead?.timeline).toBe("2 weeks");
    expect(lead?.platform).toBe("web");
    expect(lead?.contactName).toBe("Jane");
    expect(lead?.contactEmail).toBe("jane@example.com");
    expect(lead?.tags).toEqual(["urgent", "vip"]);
  });
});
