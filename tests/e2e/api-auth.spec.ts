import { test, expect } from "@playwright/test";

/**
 * API auth audit: protected endpoints must return 401 when called without a session.
 * Uses a real lead ID for routes that require one (must exist in DB).
 */
const baseURL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000";
const leadId = process.env.E2E_LEAD_ID || "cmlvq7e5z0000v5nwmoijvi5z";

test.describe("API auth (401 without session)", () => {
  test("GET /api/health is public and returns 200", async ({ request }) => {
    const res = await request.get(`${baseURL.replace(/\/$/, "")}/api/health`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  test("GET /api/leads without auth returns 401", async ({ request }) => {
    const res = await request.get(`${baseURL.replace(/\/$/, "")}/api/leads`);
    expect(res.status()).toBe(401);
  });

  test("POST /api/leads without auth returns 401", async ({ request }) => {
    const res = await request.post(`${baseURL.replace(/\/$/, "")}/api/leads`, {
      data: { title: "Test", source: "e2e" },
    });
    expect(res.status()).toBe(401);
  });

  test("GET /api/leads/[id] without auth returns 401", async ({ request }) => {
    const res = await request.get(`${baseURL.replace(/\/$/, "")}/api/leads/${leadId}`);
    expect(res.status()).toBe(401);
  });

  test("GET /api/artifacts/[id] without auth returns 401", async ({ request }) => {
    const res = await request.get(`${baseURL.replace(/\/$/, "")}/api/artifacts/${leadId}`);
    expect(res.status()).toBe(401);
  });

  test("GET /api/proof without auth returns 401", async ({ request }) => {
    const res = await request.get(`${baseURL.replace(/\/$/, "")}/api/proof`);
    expect(res.status()).toBe(401);
  });

  test("GET /api/checklist without auth returns 401", async ({ request }) => {
    const res = await request.get(`${baseURL.replace(/\/$/, "")}/api/checklist`);
    expect(res.status()).toBe(401);
  });

  test("GET /api/knowledge without auth returns 401", async ({ request }) => {
    const res = await request.get(`${baseURL.replace(/\/$/, "")}/api/knowledge`);
    expect(res.status()).toBe(401);
  });

  test("GET /api/learning without auth returns 401", async ({ request }) => {
    const res = await request.get(`${baseURL.replace(/\/$/, "")}/api/learning`);
    expect(res.status()).toBe(401);
  });

  test("GET /api/brief without auth returns 401", async ({ request }) => {
    const res = await request.get(`${baseURL.replace(/\/$/, "")}/api/brief`);
    expect(res.status()).toBe(401);
  });

  test("GET /api/ops/command without auth returns 401", async ({ request }) => {
    const res = await request.get(`${baseURL.replace(/\/$/, "")}/api/ops/command`);
    expect(res.status()).toBe(401);
  });

  test("POST /api/pipeline/run without auth returns 401", async ({ request }) => {
    const res = await request.post(`${baseURL.replace(/\/$/, "")}/api/pipeline/run`, {
      data: { leadId, reason: "e2e" },
    });
    expect(res.status()).toBe(401);
  });

  test("POST /api/leads/[id]/copilot without auth returns 401", async ({ request }) => {
    const res = await request.post(`${baseURL.replace(/\/$/, "")}/api/leads/${leadId}/copilot`, {
      data: { question: "Test?" },
    });
    expect(res.status()).toBe(401);
  });

  test("POST /api/proof/generate without auth returns 401", async ({ request }) => {
    const res = await request.post(`${baseURL.replace(/\/$/, "")}/api/proof/generate`, {
      data: { leadId: "any" },
    });
    expect(res.status()).toBe(401);
  });

  test("POST /api/checklist/generate without auth returns 401", async ({ request }) => {
    const res = await request.post(`${baseURL.replace(/\/$/, "")}/api/checklist/generate`, {
      data: {},
    });
    expect(res.status()).toBe(401);
  });
});
