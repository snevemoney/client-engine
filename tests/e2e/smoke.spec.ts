import { test, expect } from "@playwright/test";

/**
 * Smoke: health endpoint must return ok: true.
 * Run with: PIPELINE_DRY_RUN=1 npx playwright test tests/e2e/smoke.spec.ts
 * Or as part of: npm run smoke
 */
test("GET /api/health returns ok true and all checks", async ({ request }) => {
  const baseURL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000";
  const res = await request.get(`${baseURL.replace(/\/$/, "")}/api/health`);
  const body = await res.json();
  expect(res.status()).toBe(200);
  expect(body.ok).toBe(true);
  expect(body.checks).toBeDefined();
  expect(body.checks.db).toBeDefined();
  expect(body.checks.pipelineTables).toBeDefined();
  expect(body.checks.authSecret).toBeDefined();
  expect(body.checks.nextAuthUrl).toBeDefined();
  expect(body.checks.db.ok).toBe(true);
  expect(body.checks.pipelineTables.ok).toBe(true);
  expect(body.checks.authSecret.ok).toBe(true);
  expect(body.checks.nextAuthUrl.ok).toBe(true);
});
