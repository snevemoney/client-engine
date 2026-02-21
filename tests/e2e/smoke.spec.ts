import { test, expect } from "@playwright/test";

/**
 * Smoke: health endpoint must return ok: true.
 * Run with: PIPELINE_DRY_RUN=1 npx playwright test tests/e2e/smoke.spec.ts
 * Or as part of: npm run smoke
 */
test("GET /api/health returns ok true", async ({ request }) => {
  const baseURL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000";
  const res = await request.get(`${baseURL.replace(/\/$/, "")}/api/health`);
  const body = await res.json();
  expect(res.status()).toBe(200);
  expect(body.ok).toBe(true);
  expect(body.checks).toBeDefined();
});
