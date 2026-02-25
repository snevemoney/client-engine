/**
 * Phase 2.9 + 3.1: Internal QA pages — Notifications QA, Score QA.
 * Requires login.
 */
import { test, expect } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000";
const loginEmail = process.env.E2E_EMAIL || process.env.ADMIN_EMAIL || "admin@evenslouis.ca";
const loginPassword = process.env.E2E_PASSWORD || process.env.ADMIN_PASSWORD || "changeme";

test.describe("Internal QA pages", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${baseURL}/login`);
    await page.getByLabel("Email").fill(loginEmail);
    await page.getByLabel("Password").fill(loginPassword);
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });
    if (page.url().includes("/login")) {
      test.skip(true, "Login failed - set E2E_EMAIL/E2E_PASSWORD or ADMIN_EMAIL/ADMIN_PASSWORD");
    }
  });

  test("Notifications QA page loads and shows checklist", async ({ page }) => {
    await page.goto(`${baseURL}/dashboard/internal/qa/notifications`, { waitUntil: "load", timeout: 15000 });
    if (page.url().includes("/login")) {
      test.skip(true, "Redirected to login - session may have expired");
      return;
    }
    await expect(page).toHaveURL(/\/dashboard\/internal\/qa\/notifications/);
    await expect(page.locator("h1")).toContainText(/Notifications QA/i, { timeout: 5000 });
    await expect(page.getByRole("heading", { name: "Checklist", exact: true })).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole("button", { name: /Refresh system data/i })).toBeVisible({ timeout: 5000 });
  });

  test("Score QA page loads and compute works", async ({ page }) => {
    await page.goto(`${baseURL}/dashboard/internal/qa/scores`);
    await expect(page).toHaveURL(/\/dashboard\/internal\/qa\/scores/);
    await expect(page.getByRole("heading", { name: /Score QA/i })).toBeVisible();
    const computeBtn = page.getByRole("button", { name: /Compute score now/i });
    await expect(computeBtn).toBeVisible();

    await computeBtn.click();
    await expect(computeBtn).toBeEnabled({ timeout: 15000 });

    await expect(
      page.getByText(/Latest score/i).or(page.getByText(/No score data/i)).or(page.getByText(/\/ 100/))
    ).toBeVisible({ timeout: 5000 });
  });

  test("Score QA: Notifications QA link works", async ({ page }) => {
    await page.goto(`${baseURL}/dashboard/internal/qa/scores`);
    await expect(page.getByRole("link", { name: /Notifications QA/i })).toBeVisible();
    await page.getByRole("link", { name: /Notifications QA/i }).click();
    await expect(page).toHaveURL(/\/dashboard\/internal\/qa\/notifications/);
  });
});
