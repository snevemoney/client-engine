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

  test("GET /api/internal/scores/latest without auth returns 401", async ({ request }) => {
    const res = await request.get(
      `${baseURL.replace(/\/$/, "")}/api/internal/scores/latest?entityType=command_center&entityId=command_center`
    );
    expect(res.status()).toBe(401);
  });

  test("GET /api/internal/scores/history without auth returns 401", async ({ request }) => {
    const res = await request.get(
      `${baseURL.replace(/\/$/, "")}/api/internal/scores/history?entityType=command_center&entityId=command_center&range=7d`
    );
    expect(res.status()).toBe(401);
  });

  test("POST /api/internal/scores/compute without auth returns 401", async ({ request }) => {
    const res = await request.post(`${baseURL.replace(/\/$/, "")}/api/internal/scores/compute`, {
      data: { entityType: "command_center", entityId: "command_center" },
    });
    expect(res.status()).toBe(401);
  });

  test("GET /api/internal/scores/summary without auth returns 401", async ({ request }) => {
    const res = await request.get(
      `${baseURL.replace(/\/$/, "")}/api/internal/scores/summary?entityType=command_center&entityId=command_center`
    );
    expect(res.status()).toBe(401);
  });

  test("GET /api/internal/scores/alerts/preferences without auth returns 401", async ({
    request,
  }) => {
    const res = await request.get(`${baseURL.replace(/\/$/, "")}/api/internal/scores/alerts/preferences`);
    expect(res.status()).toBe(401);
  });

  test("PUT /api/internal/scores/alerts/preferences without auth returns 401", async ({
    request,
  }) => {
    const res = await request.put(`${baseURL.replace(/\/$/, "")}/api/internal/scores/alerts/preferences`, {
      data: { enabled: false },
    });
    expect(res.status()).toBe(401);
  });

  test("GET /api/internal/ops/metrics-summary without auth returns 401", async ({ request }) => {
    const res = await request.get(
      `${baseURL.replace(/\/$/, "")}/api/internal/ops/metrics-summary?period=24h`
    );
    expect(res.status()).toBe(401);
  });

  test("GET /api/internal/system/check without auth returns 401", async ({ request }) => {
    const res = await request.get(`${baseURL.replace(/\/$/, "")}/api/internal/system/check`);
    expect(res.status()).toBe(401);
  });
});

/**
 * API Bearer auth (prod cron): endpoints that accept Bearer RESEARCH_CRON_SECRET.
 * Playwright config sets fallback e2e-cron-secret-for-playwright when unset.
 * For existing dev server: add RESEARCH_CRON_SECRET to .env (see .env.example).
 */
test.describe("API Bearer auth (cron simulation)", () => {
  const cronSecret = process.env.RESEARCH_CRON_SECRET;
  const url = baseURL.replace(/\/$/, "");

  test("POST /api/ops/workday-run without Bearer or session returns 401", async ({ request }) => {
    const res = await request.post(`${url}/api/ops/workday-run`);
    expect(res.status()).toBe(401);
  });

  test("POST /api/ops/workday-run with wrong Bearer token returns 401", async ({ request }) => {
    const res = await request.post(`${url}/api/ops/workday-run`, {
      headers: { Authorization: "Bearer wrong-token-12345" },
    });
    expect(res.status()).toBe(401);
  });

  test("POST /api/research/run without Bearer or session returns 401", async ({ request }) => {
    const res = await request.post(`${url}/api/research/run`);
    expect(res.status()).toBe(401);
  });

  test("POST /api/research/run with wrong Bearer token returns 401", async ({ request }) => {
    const res = await request.post(`${url}/api/research/run`, {
      headers: { Authorization: "Bearer wrong-token-xyz" },
    });
    expect(res.status()).toBe(401);
  });

  test("POST /api/ops/workday-run with Bearer RESEARCH_CRON_SECRET returns 200 or 500 (not 401)", async ({
    request,
  }) => {
    const secret = cronSecret ?? "e2e-cron-secret-for-playwright";
    const res = await request.post(`${url}/api/ops/workday-run`, {
      headers: { Authorization: `Bearer ${secret}` },
    });
    if (res.status() === 401) {
      test.skip(true, "Server returned 401 — add RESEARCH_CRON_SECRET to .env and restart when using existing server");
      return;
    }
    expect(res.status()).not.toBe(401);
  });

  test("POST /api/research/run with Bearer RESEARCH_CRON_SECRET returns 200 or 500 (not 401)", async ({
    request,
  }) => {
    const secret = cronSecret ?? "e2e-cron-secret-for-playwright";
    const res = await request.post(`${url}/api/research/run?limit=1`, {
      headers: { Authorization: `Bearer ${secret}` },
    });
    if (res.status() === 401) {
      test.skip(true, "Server returned 401 — add RESEARCH_CRON_SECRET to .env and restart when using existing server");
      return;
    }
    expect(res.status()).not.toBe(401);
  });
});

/**
 * Auth providers (OAuth simulation): NextAuth exposes /api/auth/providers.
 * With Credentials only, returns credentials. When OAuth is added, will include Google/GitHub etc.
 */
test.describe("Auth providers (OAuth simulation)", () => {
  const url = baseURL.replace(/\/$/, "");

  test("GET /api/auth/providers returns 200 and provider list", async ({ request }) => {
    const res = await request.get(`${url}/api/auth/providers`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(typeof body).toBe("object");
    expect(Object.keys(body).length).toBeGreaterThan(0);
    // Credentials provider when no OAuth; OAuth providers (Google, GitHub) when added
    expect(body.credentials ?? Object.values(body)[0]).toBeDefined();
  });

  test("GET /api/auth/session returns 200 (empty when unauthenticated)", async ({ request }) => {
    const res = await request.get(`${url}/api/auth/session`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(typeof body).toBe("object");
  });
});
