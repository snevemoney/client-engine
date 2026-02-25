/**
 * Phase 3.6: Adversarial / edge-case API tests for internal routes.
 * Uses authenticated fetch via page.evaluate (cookies from login).
 * Ensures 400 (not 500) for validation failures, sanitized error responses.
 */
import { test, expect } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000";
const url = baseURL.replace(/\/$/, "");
const loginEmail = process.env.E2E_EMAIL || process.env.ADMIN_EMAIL || "admin@evenslouis.ca";
const loginPassword = process.env.E2E_PASSWORD || process.env.ADMIN_PASSWORD || "changeme";

async function authFetch(
  page: { evaluate: (fn: (arg: { url: string; init?: RequestInit }) => Promise<{ status: number; ok: boolean; body: unknown }>) => Promise<{ status: number; ok: boolean; body: unknown }> },
  endpoint: string,
  init?: RequestInit
): Promise<{ status: number; ok: boolean; body: unknown }> {
  return page.evaluate(
    async ({ endpoint, init }) => {
      const res = await fetch(endpoint, { credentials: "include", ...init });
      let body: unknown;
      try {
        body = await res.json();
      } catch {
        body = await res.text();
      }
      return { status: res.status, ok: res.ok, body };
    },
    { endpoint: `${url}${endpoint}`, init }
  );
}

test.describe("Internal API adversarial (with auth)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${url}/login`);
    await page.getByLabel("Email").fill(loginEmail);
    await page.getByLabel("Password").fill(loginPassword);
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });
  });

  // --- Scores: compute ---
  test("POST /api/internal/scores/compute missing entityType returns 400", async ({ page }) => {
    const res = await authFetch(page, "/api/internal/scores/compute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entityId: "command_center" }),
    });
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: expect.any(String) });
    expect((res.body as { error?: string }).error).not.toMatch(/stack|at\s+\w+/i);
  });

  test("POST /api/internal/scores/compute missing entityId returns 400", async ({ page }) => {
    const res = await authFetch(page, "/api/internal/scores/compute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entityType: "command_center" }),
    });
    expect(res.status).toBe(400);
  });

  test("POST /api/internal/scores/compute invalid entityType returns 400", async ({ page }) => {
    const res = await authFetch(page, "/api/internal/scores/compute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entityType: "invalid_type", entityId: "command_center" }),
    });
    expect(res.status).toBe(400);
  });

  test("POST /api/internal/scores/compute invalid JSON returns 400", async ({ page }) => {
    const res = await authFetch(page, "/api/internal/scores/compute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not json",
    });
    expect(res.status).toBe(400);
  });

  // --- Scores: history ---
  test("GET /api/internal/scores/history missing entityType returns 400", async ({ page }) => {
    const res = await authFetch(
      page,
      "/api/internal/scores/history?entityId=command_center&range=7d"
    );
    expect(res.status).toBe(400);
  });

  test("GET /api/internal/scores/history missing entityId returns 400", async ({ page }) => {
    const res = await authFetch(
      page,
      "/api/internal/scores/history?entityType=command_center&range=7d"
    );
    expect(res.status).toBe(400);
  });

  test("GET /api/internal/scores/history invalid range clamped to valid", async ({ page }) => {
    const res = await authFetch(
      page,
      "/api/internal/scores/history?entityType=command_center&entityId=command_center&range=invalid"
    );
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ timeline: expect.any(Array), events: expect.any(Array) });
  });

  test("GET /api/internal/scores/history missing range uses default 7d", async ({ page }) => {
    const res = await authFetch(
      page,
      "/api/internal/scores/history?entityType=command_center&entityId=command_center"
    );
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ timeline: expect.any(Array), events: expect.any(Array) });
  });

  // --- Scores: latest ---
  test("GET /api/internal/scores/latest missing entityType returns 400", async ({ page }) => {
    const res = await authFetch(
      page,
      "/api/internal/scores/latest?entityId=command_center"
    );
    expect(res.status).toBe(400);
  });

  test("GET /api/internal/scores/latest missing entityId returns 400", async ({ page }) => {
    const res = await authFetch(
      page,
      "/api/internal/scores/latest?entityType=command_center"
    );
    expect(res.status).toBe(400);
  });

  // --- Scores: summary (uses defaults, no 400 for missing) ---
  test("GET /api/internal/scores/summary without params returns 200 with defaults", async ({
    page,
  }) => {
    const res = await authFetch(page, "/api/internal/scores/summary");
    expect(res.status).toBe(200);
    const b = res.body as Record<string, unknown>;
    expect(b).toHaveProperty("recentEvents");
    expect(Array.isArray(b.recentEvents)).toBe(true);
  });

  // --- Scores: alerts/preferences PUT ---
  test("PUT /api/internal/scores/alerts/preferences invalid cooldown returns 400", async ({
    page,
  }) => {
    const res = await authFetch(page, "/api/internal/scores/alerts/preferences", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cooldownMinutes: -1 }),
    });
    expect(res.status).toBe(400);
  });

  test("PUT /api/internal/scores/alerts/preferences cooldown > 1440 returns 400", async ({
    page,
  }) => {
    const res = await authFetch(page, "/api/internal/scores/alerts/preferences", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cooldownMinutes: 9999 }),
    });
    expect(res.status).toBe(400);
  });

  test("PUT /api/internal/scores/alerts/preferences invalid JSON returns 400", async ({
    page,
  }) => {
    const res = await authFetch(page, "/api/internal/scores/alerts/preferences", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: "not json",
    });
    expect(res.status).toBe(400);
  });

  test("PUT /api/internal/scores/alerts/preferences empty body returns 400", async ({
    page,
  }) => {
    const res = await authFetch(page, "/api/internal/scores/alerts/preferences", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });

  // --- Alerts preferences: focused adversarial (Phase 3.6.2) ---
  test("PUT alerts/preferences unknown keys stripped, valid fields applied", async ({
    page,
  }) => {
    const res = await authFetch(page, "/api/internal/scores/alerts/preferences", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cooldownMinutes: 90, unknownKey: "ignored", __proto__: {} }),
    });
    expect(res.status).toBe(200);
    const body = res.body as Record<string, unknown>;
    expect(body.cooldownMinutes).toBe(90);
    expect(body).not.toHaveProperty("unknownKey");
  });

  test("PUT alerts/preferences events with invalid boolean values ignored", async ({
    page,
  }) => {
    const res = await authFetch(page, "/api/internal/scores/alerts/preferences", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        events: { threshold_breach: "true", sharp_drop: 1, recovery: null },
      }),
    });
    expect(res.status).toBe(400);
  });

  test("PUT alerts/preferences cooldownMinutes as string returns 400", async ({
    page,
  }) => {
    const res = await authFetch(page, "/api/internal/scores/alerts/preferences", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cooldownMinutes: "90" }),
    });
    expect(res.status).toBe(400);
  });

  test("PUT alerts/preferences very large cooldown returns 400", async ({
    page,
  }) => {
    const res = await authFetch(page, "/api/internal/scores/alerts/preferences", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cooldownMinutes: 999999 }),
    });
    expect(res.status).toBe(400);
  });

  test("PUT alerts/preferences malformed JSON returns 400", async ({ page }) => {
    for (const body of ["{", "]", "{\"enabled\": "]) {
      const res = await authFetch(page, "/api/internal/scores/alerts/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body,
      });
      expect(res.status).toBe(400);
    }
  });

  test("PUT alerts/preferences oversized payload with valid field succeeds (junk ignored)", async ({
    page,
  }) => {
    const junk = "x".repeat(50_000);
    const res = await authFetch(page, "/api/internal/scores/alerts/preferences", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cooldownMinutes: 75, junk }),
    });
    expect(res.status).toBe(200);
    expect((res.body as { cooldownMinutes?: number }).cooldownMinutes).toBe(75);
  });

  test("error response shape: no stack trace, no secrets", async ({ page }) => {
    const res = await authFetch(page, "/api/internal/scores/compute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entityType: "bad", entityId: "x" }),
    });
    expect(res.status).toBe(400);
    const body = res.body as Record<string, unknown>;
    const str = JSON.stringify(body);
    expect(str).not.toMatch(/at\s+\w+\s+\(|\.ts:\d+|\.js:\d+/);
    expect(str).not.toMatch(/Bearer\s+[A-Za-z0-9_-]+/);
    expect(str).not.toMatch(/sk_live_|sk_test_|api[_-]?key[:=]/i);
  });

  // --- Malformed JSON ---
  test("POST compute malformed JSON fragments return 400", async ({ page }) => {
    for (const body of ["{", "]", "{\"entityType\":", "null"]) {
      const res = await authFetch(page, "/api/internal/scores/compute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });
      expect(res.status).toBe(400);
      expect((res.body as { error?: string }).error).toBeDefined();
    }
  });

  // --- Wrong types (number for string, etc.) ---
  test("POST compute entityType as number returns 400", async ({ page }) => {
    const res = await authFetch(page, "/api/internal/scores/compute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entityType: 123, entityId: "command_center" }),
    });
    expect(res.status).toBe(400);
  });

  test("POST compute entityId as array returns 400", async ({ page }) => {
    const res = await authFetch(page, "/api/internal/scores/compute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entityType: "command_center", entityId: ["a", "b"] }),
    });
    expect(res.status).toBe(400);
  });
});

test.describe("Ops / system routes (observability assertions)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${url}/login`);
    await page.getByLabel("Email").fill(loginEmail);
    await page.getByLabel("Password").fill(loginPassword);
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });
  });

  test("GET /api/internal/ops/metrics-summary returns expected shape for 24h", async ({ page }) => {
    const res = await authFetch(
      page,
      "/api/internal/ops/metrics-summary?period=24h"
    );
    expect(res.status).toBe(200);
    const body = res.body as Record<string, unknown>;
    expect(body.period).toBe("24h");
    expect(body.notifications).toBeDefined();
    expect(body.deliveries).toBeDefined();
    expect(body.escalations).toBeDefined();
    expect(body.jobs).toBeDefined();
    const jobs = body.jobs as Record<string, unknown>;
    expect(typeof jobs.staleRunning).toBe("number");
    const str = JSON.stringify(body);
    expect(str).not.toMatch(/DATABASE_URL|SECRET|PASSWORD|api[_-]?key/i);
  });

  test("GET /api/internal/ops/metrics-summary returns expected shape for 7d", async ({ page }) => {
    const res = await authFetch(
      page,
      "/api/internal/ops/metrics-summary?period=7d"
    );
    expect(res.status).toBe(200);
    const body = res.body as Record<string, unknown>;
    expect(body.period).toBe("7d");
  });

  test("GET /api/internal/ops/metrics-summary invalid period returns 400", async ({ page }) => {
    const res = await authFetch(
      page,
      "/api/internal/ops/metrics-summary?period=30d"
    );
    expect(res.status).toBe(400);
  });

  test("GET /api/internal/system/check returns expected shape, no secrets", async ({ page }) => {
    const res = await authFetch(page, "/api/internal/system/check");
    expect(res.status).toBe(200);
    const body = res.body as Record<string, unknown>;
    expect(body.health).toBeDefined();
    const health = body.health as Record<string, unknown>;
    expect(typeof health.hasInAppChannel).toBe("boolean");
    expect(typeof health.hasBaselineEscalationRule).toBe("boolean");
    expect(typeof health.queueConfigured).toBe("boolean");
    expect(typeof health.internalRoutesProtected).toBe("boolean");
    const str = JSON.stringify(body);
    expect(str).not.toMatch(/DATABASE_URL|SECRET|PASSWORD|api[_-]?key/i);
  });
});
