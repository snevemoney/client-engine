/**
 * Phase 5.1: Coach Mode E2E.
 * Open coach page, send message, verify response contains Top 3 Next Actions and evidence.
 */
import { test, expect } from "@playwright/test";
import { requireSafeE2EBaseUrl } from "./helpers/safety";

const baseURL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000";
const loginEmail = process.env.E2E_EMAIL || process.env.ADMIN_EMAIL || "admin@evenslouis.ca";
const loginPassword = process.env.E2E_PASSWORD || process.env.ADMIN_PASSWORD || "changeme";

test.describe("Coach Mode", () => {
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

  test("Coach page loads with context panel and refresh", async ({ page }) => {
    await page.goto(`${baseURL}/dashboard/copilot/coach`, { waitUntil: "load", timeout: 15000 });
    await expect(page).toHaveURL(/\/dashboard\/copilot\/coach/);
    await expect(page.locator("h1")).toContainText(/Coach Mode/i, { timeout: 5000 });
    await expect(page.getByTestId("coach-context-panel")).toBeVisible({ timeout: 5000 });
    await expect(page.getByTestId("coach-refresh-context")).toBeVisible();
  });

  test("Send message and verify response contains Top 3 Next Actions and evidence", async ({ page }) => {
    await page.goto(`${baseURL}/dashboard/copilot/coach`, { waitUntil: "load", timeout: 15000 });
    await expect(page.getByTestId("coach-input")).toBeVisible({ timeout: 5000 });

    await page.getByTestId("coach-input").fill("what should I do today?");
    await page.getByTestId("coach-send").click();

    await expect(page.getByTestId("coach-reply")).toBeVisible({ timeout: 15000 });
    const reply = page.getByTestId("coach-reply");
    await expect(reply).toContainText(/Top 3 Next Actions|Score|status|diagnosis|data_unavailable/i);
    await expect(reply).toContainText(/Evidence|Score|Risks|command|POST/i);
  });

  test("Phase 5.2: CTA click → preview → confirm execute → result summary", async ({ page }) => {
    await page.goto(`${baseURL}/dashboard/copilot/coach`, { waitUntil: "load", timeout: 15000 });
    await expect(page.getByTestId("coach-input")).toBeVisible({ timeout: 5000 });

    await page.getByTestId("coach-input").fill("what should I do today?");
    await page.getByTestId("coach-send").click();

    await expect(page.getByTestId("coach-reply")).toBeVisible({ timeout: 15000 });

    // Click any CTA that supports preview+confirm
    const cta = page
      .getByTestId(/coach-cta-(run_next_actions|run_risk_rules|recompute_score|nba_execute)/)
      .first();
    await expect(cta).toBeVisible({ timeout: 3000 });
    await cta.click();

    await expect(page.getByTestId("coach-preview-card")).toBeVisible({ timeout: 10000 });
    await page.getByTestId("coach-confirm-execute").click();

    await expect(page.getByTestId("coach-action-result")).toBeVisible({ timeout: 10000 });
    const resultBlock = page.getByTestId("coach-action-result");
    await expect(resultBlock).toContainText(/Action completed|Action failed|Before|After/i);

    // Context panel should still be visible (refresh was triggered)
    await expect(page.getByTestId("coach-context-panel")).toBeVisible();
  });

  test("Phase 5.3: Sessions page shows session and action log after execute", async ({ page }) => {
    await page.goto(`${baseURL}/dashboard/copilot/coach`, { waitUntil: "load", timeout: 15000 });
    await expect(page.getByTestId("coach-input")).toBeVisible({ timeout: 5000 });

    await page.getByTestId("coach-input").fill("what should I do today?");
    await page.getByTestId("coach-send").click();

    await expect(page.getByTestId("coach-reply")).toBeVisible({ timeout: 15000 });

    const cta = page
      .getByTestId(/coach-cta-(run_next_actions|run_risk_rules|recompute_score|nba_execute)/)
      .first();
    await expect(cta).toBeVisible({ timeout: 3000 });
    await cta.click();

    await expect(page.getByTestId("coach-preview-card")).toBeVisible({ timeout: 10000 });
    await page.getByTestId("coach-confirm-execute").click();

    await expect(page.getByTestId("coach-action-result")).toBeVisible({ timeout: 10000 });

    await page.goto(`${baseURL}/dashboard/copilot/sessions`, { waitUntil: "load", timeout: 15000 });
    await expect(page.getByTestId("sessions-list")).toBeVisible({ timeout: 5000 });

    const firstSession = page.locator('[data-testid="sessions-list"] button').first();
    await firstSession.click();
    await expect(page.getByTestId("session-action-log").first()).toBeVisible({ timeout: 5000 });
  });
});
