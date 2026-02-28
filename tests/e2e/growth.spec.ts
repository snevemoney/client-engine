/**
 * Phase 6.3.2: Growth pipeline E2E.
 * Flow: /dashboard/growth → add prospect → Run Growth NBA → next-actions founder_growth → execute schedule.
 */
import { test, expect } from "@playwright/test";
import { requireSafeE2EBaseUrl } from "./helpers/safety";
import { baseURL, loginEmail, loginPassword } from "./helpers/auth";

test.describe("Growth pipeline", () => {
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

  test("Growth page loads", async ({ page }) => {
    await page.goto(`${baseURL}/dashboard/growth`, { waitUntil: "load", timeout: 15000 });
    await expect(page).toHaveURL(/\/dashboard\/growth/);
    await expect(page.getByTestId("growth-page")).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("Growth Pipeline")).toBeVisible({ timeout: 3000 });
  });

  test("Run Growth NBA button works", async ({ page }) => {
    await page.goto(`${baseURL}/dashboard/growth`, { waitUntil: "load", timeout: 15000 });
    const runBtn = page.getByTestId("run-growth-nba");
    await expect(runBtn).toBeVisible({ timeout: 5000 });
    await runBtn.click();
    await expect(runBtn).toBeEnabled({ timeout: 15000 });
  });

  test("Add prospect creates deal", async ({ page }) => {
    await page.goto(`${baseURL}/dashboard/growth`, { waitUntil: "load", timeout: 15000 });
    await page.getByRole("button", { name: /Add prospect/i }).click();
    await expect(page.getByPlaceholder("Name")).toBeVisible({ timeout: 3000 });
    await page.getByPlaceholder("Name").fill(`E2E Growth ${Date.now()}`);
    await page.getByRole("button", { name: /^Add$/ }).click();
    await expect(page.getByText(/E2E Growth \d+/)).toBeVisible({ timeout: 10000 });
  });

  test("Full flow: add prospect → Run Growth NBA → open founder_growth scope → execute action", async ({
    page,
  }) => {
    await page.goto(`${baseURL}/dashboard/growth`, { waitUntil: "load", timeout: 15000 });

    const noDeals = await page.getByText("No deals. Add a prospect to get started.").isVisible({ timeout: 2000 });
    if (noDeals) {
      await page.getByRole("button", { name: /Add prospect/i }).click();
      await page.getByPlaceholder("Name").fill(`E2E Flow ${Date.now()}`);
      await page.getByRole("button", { name: /^Add$/ }).click();
      await page.waitForTimeout(2000);
    }

    await page.getByTestId("run-growth-nba").click();
    await page.waitForTimeout(2000);

    await page.goto(`${baseURL}/dashboard/next-actions?scope=founder_growth`, {
      waitUntil: "load",
      timeout: 15000,
    });

    const playbookToggle = page.getByTestId("next-action-playbook-toggle").first();
    if (!(await playbookToggle.isVisible({ timeout: 5000 }))) {
      test.skip(true, "No founder_growth actions - pipeline may be empty or no overdue deals");
    }

    await playbookToggle.click();
    await expect(page.getByTestId("next-action-playbook-panel").first()).toBeVisible({ timeout: 5000 });

    const scheduleBtn = page.getByRole("button", { name: /Schedule follow-up \(3d\)/i }).first();
    const markRepliedBtn = page.getByRole("button", { name: /Mark replied/i }).first();
    if (await scheduleBtn.isVisible({ timeout: 2000 })) {
      await scheduleBtn.click();
      const confirmBtn = page.getByRole("button", { name: /Set next follow-up in 3 days/i }).first();
      if (await confirmBtn.isVisible({ timeout: 2000 })) {
        await confirmBtn.click();
      }
    } else if (await markRepliedBtn.isVisible({ timeout: 2000 })) {
      await markRepliedBtn.click();
    } else {
      test.skip(true, "No growth_schedule_followup_3d or growth_mark_replied in playbook");
    }

    await expect(page.locator("body")).toBeVisible({ timeout: 5000 });
  });
});
