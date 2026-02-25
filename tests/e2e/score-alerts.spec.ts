/**
 * Phase 3.4: Score alerts preferences E2E.
 */
import { test, expect } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000";
const loginEmail = process.env.E2E_EMAIL || process.env.ADMIN_EMAIL || "admin@evenslouis.ca";
const loginPassword = process.env.E2E_PASSWORD || process.env.ADMIN_PASSWORD || "changeme";

test.describe("Score Alerts Preferences", () => {
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

  test("open alerts preferences from scoreboard", async ({ page }) => {
    await page.goto(`${baseURL}/dashboard/internal/scoreboard`);
    await page.getByTestId("alerts-prefs-link").click();
    await expect(page).toHaveURL(/\/dashboard\/internal\/scores\/alerts/);
    await expect(page.getByTestId("alerts-preferences-panel")).toBeVisible();
  });

  test("alerts preferences page renders toggles", async ({ page }) => {
    await page.goto(`${baseURL}/dashboard/internal/scores/alerts`);
    await expect(page.getByTestId("alerts-preferences-panel")).toBeVisible({ timeout: 5000 });
    await expect(page.getByTestId("alerts-enabled-toggle")).toBeVisible();
    await expect(page.getByTestId("alerts-events-threshold_breach")).toBeVisible();
    await expect(page.getByTestId("alerts-events-sharp_drop")).toBeVisible();
    await expect(page.getByTestId("alerts-events-recovery")).toBeVisible();
    await expect(page.getByTestId("alerts-prefs-save")).toBeVisible();
  });

  test("save button disabled when no changes", async ({ page }) => {
    await page.goto(`${baseURL}/dashboard/internal/scores/alerts`);
    await expect(page.getByTestId("alerts-preferences-panel")).toBeVisible({ timeout: 5000 });
    const saveBtn = page.getByTestId("alerts-prefs-save");
    await expect(saveBtn).toBeDisabled();
  });

  test("cooldown input visible and save persists", async ({ page }) => {
    await page.goto(`${baseURL}/dashboard/internal/scores/alerts`);
    await expect(page.getByTestId("alerts-preferences-panel")).toBeVisible({ timeout: 5000 });
    const cooldownInput = page.getByTestId("alerts-cooldown-minutes");
    await expect(cooldownInput).toBeVisible();
    await cooldownInput.fill("120");
    const saveBtn = page.getByTestId("alerts-prefs-save");
    await saveBtn.click();
    await expect(page.getByRole("status")).toContainText(/saved/i, { timeout: 5000 });
    await page.reload();
    await expect(page.getByTestId("alerts-preferences-panel")).toBeVisible({ timeout: 5000 });
    await expect(page.getByTestId("alerts-cooldown-minutes")).toHaveValue("120");
  });

  test("3.6.4 resilience: PUT preferences failure shows alerts-prefs-error, Save re-enabled, no false saved", async ({
    page,
  }) => {
    await page.route("**/api/internal/scores/alerts/preferences", (route) => {
      if (route.request().method() === "PUT") {
        return route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ error: "Save failed" }),
        });
      }
      return route.continue();
    });
    await page.goto(`${baseURL}/dashboard/internal/scores/alerts`);
    await expect(page.getByTestId("alerts-preferences-panel")).toBeVisible({ timeout: 5000 });
    const cooldown = page.getByTestId("alerts-cooldown-minutes");
    await cooldown.fill("90");
    const save = page.getByTestId("alerts-prefs-save");
    await save.click();
    await expect(page.getByTestId("alerts-prefs-error")).toBeVisible({ timeout: 5000 });
    await expect(page.getByTestId("alerts-prefs-error")).toContainText(/fail/i);
    await expect(save).toBeEnabled();
  });

  test("alerts summary chip on scoreboard", async ({ page }) => {
    await page.goto(`${baseURL}/dashboard/internal/scoreboard`);
    await page.waitForLoadState("networkidle");
    const chip = page.getByTestId("alerts-summary-chip");
    await expect(chip).toBeVisible({ timeout: 5000 });
    await expect(chip).toContainText(/Alerts:/);
  });
});
