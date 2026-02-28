/**
 * Phase 6.1: Founder Mode E2E smoke.
 */
import { test, expect } from "@playwright/test";
import { requireSafeE2EBaseUrl } from "./helpers/safety";

const baseURL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000";
const loginEmail = process.env.E2E_EMAIL || process.env.ADMIN_EMAIL || "admin@evenslouis.ca";
const loginPassword = process.env.E2E_PASSWORD || process.env.ADMIN_PASSWORD || "changeme";

test.describe("Founder Mode", () => {
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

  test("Founder page loads and shows Today's Plan", async ({ page }) => {
    await page.goto(`${baseURL}/dashboard/founder`, { waitUntil: "load", timeout: 15000 });
    await expect(page).toHaveURL(/\/dashboard\/founder/);
    await expect(page.getByTestId("founder-page")).toBeVisible({ timeout: 5000 });
    await expect(page.getByTestId("founder-todays-plan")).toBeVisible({ timeout: 5000 });
    await expect(page.getByTestId("founder-business-health")).toBeVisible({ timeout: 3000 });
    await expect(page.getByTestId("founder-execution")).toBeVisible({ timeout: 3000 });
  });

  test("Click Run Next Actions works", async ({ page }) => {
    await page.goto(`${baseURL}/dashboard/founder`, { waitUntil: "load", timeout: 15000 });
    await expect(page.getByTestId("founder-run-next-actions")).toBeVisible({ timeout: 5000 });
    await page.getByTestId("founder-run-next-actions").click();
    await expect(
      page.getByTestId("founder-page").getByText(/Next actions run completed|^Failed$/).first()
    ).toBeVisible({ timeout: 15000 });
  });
});

test.describe("Founder OS", () => {
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

  test("Founder OS hub loads", async ({ page }) => {
    await page.goto(`${baseURL}/dashboard/founder/os`, { waitUntil: "load", timeout: 15000 });
    await expect(page).toHaveURL(/\/dashboard\/founder\/os/);
    await expect(page.getByTestId("founder-os-hub")).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("Current Quarter")).toBeVisible({ timeout: 3000 });
    await expect(page.getByText("Current Week")).toBeVisible({ timeout: 3000 });
  });

  test("Generate suggestions works", async ({ page }) => {
    await page.goto(`${baseURL}/dashboard/founder/os/week?generate=1`, { waitUntil: "networkidle", timeout: 15000 });
    await expect(page.getByTestId("founder-os-week")).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole("button", { name: /generate suggestions/i })).toBeVisible({ timeout: 5000 });
  });

  test("Save week plan persists and reload shows it", async ({ page }) => {
    await page.goto(`${baseURL}/dashboard/founder/os/week`, { waitUntil: "networkidle", timeout: 15000 });
    await expect(page.getByTestId("founder-os-week")).toBeVisible({ timeout: 10000 });
    const input = page.locator('input[placeholder="Outcome 1"]').first();
    await input.waitFor({ state: "visible", timeout: 5000 });
    await input.fill("Test outcome from E2E");
    await page.getByRole("button", { name: /^Save$/ }).first().click();
    await expect(page.getByText("Saved.")).toBeVisible({ timeout: 10000 });
    await page.reload({ waitUntil: "networkidle" });
    await expect(page.locator('input[placeholder="Outcome 1"]').first()).toHaveValue("Test outcome from E2E", {
      timeout: 10000,
    });
  });
});
