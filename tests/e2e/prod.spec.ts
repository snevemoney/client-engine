/**
 * Production audit: health, DB checks, every page, key flows, silent fails, render speed.
 * Run against prod: USE_EXISTING_SERVER=1 PLAYWRIGHT_BASE_URL=https://evenslouis.ca E2E_EMAIL=... E2E_PASSWORD=... npm run test:e2e tests/e2e/prod.spec.ts
 */
import { test, expect } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000";
const devPassword = process.env.AUTH_DEV_PASSWORD || "changeme";
const email = process.env.E2E_EMAIL || process.env.ADMIN_EMAIL || (process.env.AUTH_DEV_PASSWORD ? "test@test.com" : "admin@evenslouis.ca");
const password = process.env.E2E_PASSWORD || process.env.ADMIN_PASSWORD || devPassword;

/** Max ms for critical pages to reach load (prod may be slower). */
const RENDER_TIMEOUT_MS = 15000;

const ALL_PAGES = [
  "/",
  "/login",
  "/dashboard",
  "/dashboard/command",
  "/dashboard/ops-health",
  "/dashboard/sales-leak",
  "/dashboard/results",
  "/dashboard/leads",
  "/dashboard/leads/new",
  "/dashboard/proposals",
  "/dashboard/build-ops",
  "/dashboard/metrics",
  "/work",
  "/dashboard/chat",
  "/dashboard/learning",
  "/dashboard/settings",
  "/dashboard/proof",
  "/dashboard/checklist",
  "/dashboard/deploys",
  "/dashboard/conversion",
  "/dashboard/knowledge",
];

test.describe("Production: health and database", () => {
  test("GET /api/health returns 200, ok true, all checks (db, pipelineTables, authSecret, nextAuthUrl)", async ({
    request,
  }) => {
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
});

test.describe("Production: public pages (no login)", () => {
  test("home and login return 200 and render", async ({ page }) => {
    for (const path of ["/", "/login"]) {
      const res = await page.goto(`${baseURL}${path}`, { waitUntil: "domcontentloaded" });
      expect(res?.status()).toBe(200);
      await expect(page.locator("body")).toBeVisible();
    }
  });
});

test.describe("Production: every page + silent fails + speed (with login)", () => {
  test("login then every dashboard page loads, no silent fail, critical pages within render timeout", async ({
    page,
  }) => {
    await page.goto(`${baseURL}/login`);
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/(dashboard|command)/, { timeout: 15000 });
    if (page.url().includes("/login")) {
      test.skip(true, "Login failed — set E2E_EMAIL and E2E_PASSWORD for prod");
      return;
    }

    // Silent-fail: protected APIs return 200 with expected shape (not 200 + empty/error body)
    const leadsRes = await page.request.get(`${baseURL.replace(/\/$/, "")}/api/leads`);
    expect(leadsRes.status()).toBe(200);
    const leadsBody = await leadsRes.json();
    expect(Array.isArray(leadsBody)).toBe(true);

    const commandRes = await page.request.get(`${baseURL.replace(/\/$/, "")}/api/ops/command`);
    expect(commandRes.status()).toBe(200);
    const commandBody = await commandRes.json();
    expect(commandBody).toBeDefined();
    expect(typeof commandBody === "object" || Array.isArray(commandBody)).toBe(true);

    // Every page: load and visible (skip / and /login already done; do dashboard and work)
    const pagesToLoad = ALL_PAGES.filter((p) => p !== "/" && p !== "/login");
    const criticalForSpeed = ["/dashboard/command", "/dashboard/leads", "/dashboard/metrics"];

    for (const path of pagesToLoad) {
      const start = Date.now();
      const res = await page.goto(`${baseURL}${path}`, {
        waitUntil: "domcontentloaded",
        timeout: RENDER_TIMEOUT_MS,
      });
      const elapsed = Date.now() - start;

      expect(res?.status()).toBeLessThan(500);
      await expect(page.locator("body")).toBeVisible();

      if (criticalForSpeed.includes(path) && elapsed > RENDER_TIMEOUT_MS) {
        throw new Error(`${path} took ${elapsed}ms (max ${RENDER_TIMEOUT_MS}ms)`);
      }
    }
  });
});

test.describe("Production: key flow (create lead → metrics)", () => {
  test("login → metrics → new lead → redirect → metrics shows enrich", async ({ page }) => {
    await page.goto(`${baseURL}/login`);
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/(dashboard|command)/, { timeout: 15000 });
    if (page.url().includes("/login")) {
      test.skip(true, "Login failed");
      return;
    }

    await page.goto(`${baseURL}/dashboard/metrics`);
    await expect(page).toHaveURL(/\/dashboard\/metrics/);
    await expect(page.getByText("Pipeline metrics", { exact: false })).toBeVisible({ timeout: 10000 });

    await page.goto(`${baseURL}/dashboard/leads/new`);
    await expect(page.getByRole("heading", { name: /new lead/i })).toBeVisible();
    await page.getByPlaceholder(/e-commerce/i).fill("Prod audit " + Date.now());
    await page.getByLabel("Source").fill("prod-audit");
    await page.getByRole("button", { name: /create lead/i }).click();
    await expect(page).toHaveURL(/\/(dashboard\/leads\/[a-z0-9-]+|dashboard)/, { timeout: 15000 });

    await page.goto(`${baseURL}/dashboard/metrics`);
    await expect(page.getByText("Pipeline metrics", { exact: false })).toBeVisible();
    await expect(page.getByText("enrich")).toBeVisible({ timeout: 10000 });
  });
});
