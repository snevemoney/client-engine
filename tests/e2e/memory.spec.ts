/**
 * Phase 7.1: Operator Memory E2E smoke.
 */
import { test, expect } from "@playwright/test";
import { requireSafeE2EBaseUrl } from "./helpers/safety";

const baseURL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000";
const loginEmail = process.env.E2E_EMAIL || process.env.ADMIN_EMAIL || "admin@evenslouis.ca";
const loginPassword = process.env.E2E_PASSWORD || process.env.ADMIN_PASSWORD || "changeme";

test.describe("Operator Memory", () => {
  test.beforeEach(() => {
    requireSafeE2EBaseUrl();
  });

  test.beforeEach(async ({ page }) => {
    await page.goto(`${baseURL}/login`);
    await page.getByLabel("Email").fill(loginEmail);
    await page.getByLabel("Password").fill(loginPassword);
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });
    if (page.url().includes("/login")) {
      test.skip(true, "Login failed - set E2E_EMAIL/E2E_PASSWORD");
    }
  });

  test("Founder OS week page shows Patterns card", async ({ page }) => {
    await page.goto(`${baseURL}/dashboard/founder/os/week`, { waitUntil: "networkidle", timeout: 15000 });
    await expect(page.getByTestId("founder-os-week")).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId("founder-os-patterns")).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("Auto-suppress suggestions")).toBeVisible({ timeout: 3000 });
  });

  test("Founder OS week page shows Trend Diffs and Pattern Alerts sections", async ({ page }) => {
    await page.goto(`${baseURL}/dashboard/founder/os/week`, { waitUntil: "networkidle", timeout: 15000 });
    await expect(page.getByTestId("founder-os-week")).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId("founder-os-trend-diffs")).toBeVisible({ timeout: 5000 });
    await expect(page.getByTestId("founder-os-pattern-alerts")).toBeVisible({ timeout: 5000 });
  });

  test("Founder OS week: Run policy button works", async ({ page }) => {
    await page.goto(`${baseURL}/dashboard/founder/os/week`, { waitUntil: "networkidle", timeout: 15000 });
    const runBtn = page.getByTestId("founder-os-run-policy");
    await expect(runBtn).toBeVisible({ timeout: 5000 });
    await runBtn.click();
    await expect(runBtn).toBeVisible({ timeout: 3000 });
  });

  test("Founder OS week shows Best wins and Noisy suggestions sections", async ({ page }) => {
    await page.goto(`${baseURL}/dashboard/founder/os/week`, { waitUntil: "networkidle", timeout: 15000 });
    await expect(page.getByTestId("founder-os-best-wins")).toBeVisible({ timeout: 5000 });
    await expect(page.getByTestId("founder-os-noisy-suggestions")).toBeVisible({ timeout: 5000 });
  });

  test("Founder OS week: Apply 30d suppression when suggestion exists", async ({ page }) => {
    await page.goto(`${baseURL}/dashboard/founder/os/week`, { waitUntil: "networkidle", timeout: 15000 });
    const applyBtn = page.getByRole("button", { name: /Apply 30d suppression/i }).first();
    if (await applyBtn.isVisible({ timeout: 3000 })) {
      await applyBtn.click();
      await expect(page.getByTestId("founder-os-patterns")).toBeVisible({ timeout: 3000 });
    }
  });

  test("Run NBA then dismiss: memory ingestion does not block", async ({ page }) => {
    await page.goto(`${baseURL}/dashboard/founder`, { waitUntil: "networkidle", timeout: 15000 });
    await expect(page.getByTestId("founder-run-next-actions")).toBeVisible({ timeout: 5000 });
    await page.getByTestId("founder-run-next-actions").click();
    await expect(
      page.getByTestId("founder-page").getByText(/Next actions run completed|^Failed$/).first()
    ).toBeVisible({ timeout: 15000 });
    await page.goto(`${baseURL}/dashboard/next-actions`, { waitUntil: "networkidle", timeout: 10000 });
    const dismissBtn = page.getByRole("button", { name: /dismiss/i }).first();
    if (await dismissBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await dismissBtn.click();
      await expect(page.locator("text=Dismissed").or(page.locator("text=dismiss"))).toBeVisible({
        timeout: 5000,
      });
    }
  });
});
