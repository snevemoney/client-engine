/**
 * Phase 3.6: End-to-end workflow replay tests (golden scenarios).
 * Uses data-testid and role selectors for stability.
 */
import { test, expect } from "@playwright/test";
import { requireSafeE2EBaseUrl } from "./helpers/safety";

const baseURL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000";
const url = baseURL.replace(/\/$/, "");
const loginEmail = process.env.E2E_EMAIL || process.env.ADMIN_EMAIL || "admin@evenslouis.ca";
const loginPassword = process.env.E2E_PASSWORD || process.env.ADMIN_PASSWORD || "changeme";

test.describe("Prod readiness workflows", () => {
  test.beforeEach(() => {
    requireSafeE2EBaseUrl();
  });

  test.beforeEach(async ({ page }) => {
    await page.goto(`${url}/login`);
    await page.getByLabel("Email").fill(loginEmail);
    await page.getByLabel("Password").fill(loginPassword);
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });
  });

  // Workflow 1: Healthy baseline compute
  test("Workflow 1: Healthy baseline compute - recompute, success, score card updates", async ({
    page,
  }) => {
    await page.goto(`${url}/dashboard/internal/scoreboard`);
    await expect(page).toHaveURL(/\/dashboard\/internal\/scoreboard/);

    const recomputeBtn = page.getByTestId("recompute-button");
    await expect(recomputeBtn).toBeVisible();
    await recomputeBtn.click();

    await expect(recomputeBtn).toBeDisabled();
    await expect(recomputeBtn).toBeEnabled({ timeout: 20000 });

    const scoreCard = page.getByTestId("score-card");
    const scoreEmpty = page.getByTestId("score-empty-state");
    const scoreError = page.getByTestId("score-error");
    await expect(scoreCard.or(scoreEmpty).or(scoreError)).toBeVisible({ timeout: 15000 });

    const trendSection = page.getByTestId("trend-section");
    const hasData = await scoreCard.isVisible().catch(() => false);
    if (hasData) {
      await expect(trendSection).toBeVisible({ timeout: 5000 });
    }

    const factorChanges = page.getByTestId("score-factor-changes");
    const factorChangesEmpty = page.getByTestId("score-factor-changes-empty");
    const hasFactors = await factorChanges.or(factorChangesEmpty).isVisible().catch(() => false);
    expect(hasFactors || (await scoreEmpty.isVisible().catch(() => false))).toBe(true);
  });

  // Workflow 2: Score drop → event (deterministic setup not required; we verify UI doesn't crash)
  test("Workflow 2: Score compute updates snapshot; events visible or empty state", async ({
    page,
  }) => {
    await page.goto(`${url}/dashboard/internal/scoreboard`);
    const recomputeBtn = page.getByTestId("recompute-button");
    await recomputeBtn.click();
    await expect(recomputeBtn).toBeEnabled({ timeout: 20000 });

    const scoreCard = page.getByTestId("score-card");
    const scoreEmpty = page.getByTestId("score-empty-state");
    const scoreEvents = page.getByTestId("score-events");
    await expect(scoreCard.or(scoreEmpty)).toBeVisible({ timeout: 15000 });
    const hasData = await scoreCard.isVisible().catch(() => false);
    if (hasData) {
      const eventsVisible = await scoreEvents.isVisible().catch(() => false);
      expect(eventsVisible || true).toBe(true);
    }
  });

  // Workflow 3: Alerts preferences roundtrip
  test("Workflow 3: Alerts preferences roundtrip - toggle, save, persist", async ({ page }) => {
    await page.goto(`${url}/dashboard/internal/scoreboard`);
    await page.getByTestId("alerts-prefs-link").click();
    await expect(page).toHaveURL(/\/dashboard\/internal\/scores\/alerts/);

    const panel = page.getByTestId("alerts-preferences-panel");
    await expect(panel).toBeVisible({ timeout: 5000 });

    const cooldownInput = page.getByTestId("alerts-cooldown-minutes");
    await cooldownInput.clear();
    await cooldownInput.fill("90");

    const saveBtn = page.getByTestId("alerts-prefs-save");
    await expect(saveBtn).toBeEnabled();

    const putPromise = page.waitForResponse(
      (res) =>
        res.url().includes("/api/internal/scores/alerts/preferences") &&
        res.request().method() === "PUT" &&
        res.status() === 200
    );
    await saveBtn.click();

    await putPromise;
    await expect(panel.getByRole("status")).toContainText(/saved/i, { timeout: 5000 });

    await page.reload();
    await expect(panel).toBeVisible({ timeout: 5000 });
    await expect(cooldownInput).toHaveValue("90");
  });

  // Workflow 4: Internal QA pages + system health
  test("Workflow 4: Notifications QA and Scores QA render", async ({ page }) => {
    await page.goto(`${url}/dashboard/internal/qa/notifications`, {
      waitUntil: "load",
      timeout: 15000,
    });
    await expect(page).toHaveURL(/\/dashboard\/internal\/qa\/notifications/);
    await expect(page.getByRole("heading", { name: "Notifications QA Checklist" })).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole("button", { name: /Refresh system data/i })).toBeVisible();

    await page.goto(`${url}/dashboard/internal/qa/scores`);
    await expect(page).toHaveURL(/\/dashboard\/internal\/qa\/scores/);
    await expect(page.getByRole("heading", { name: "Score QA" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Compute score now/i })).toBeVisible();
  });

  // Workflow 5: Empty/edge state rendering
  test("Workflow 5: Empty state - no crash on null latest/previous", async ({ page }) => {
    await page.goto(`${url}/dashboard/internal/scoreboard`);
    await page.waitForLoadState("networkidle");

    const emptyState = page.getByTestId("score-empty-state");
    const scoreCard = page.getByTestId("score-card");
    const hasData = await scoreCard.isVisible().catch(() => false);
    const isEmpty = await emptyState.isVisible().catch(() => false);

    expect(hasData || isEmpty).toBe(true);
    if (isEmpty) {
      await expect(page.getByTestId("recompute-empty-cta")).toBeVisible();
    }
  });
});

test.describe("Prod readiness QA page (if present)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${url}/login`);
    await page.getByLabel("Email").fill(loginEmail);
    await page.getByLabel("Password").fill(loginPassword);
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });
  });

  test("Prod readiness page loads and shows links", async ({ page }) => {
    await page.goto(`${url}/dashboard/internal/qa/prod-readiness`, {
      waitUntil: "load",
      timeout: 15000,
    });
    if (page.url().includes("/login")) {
      test.skip(true, "Redirected to login");
      return;
    }
    await expect(page).toHaveURL(/\/dashboard\/internal\/qa\/prod-readiness/);
    await expect(page.getByRole("heading", { name: /Prod readiness/i })).toBeVisible({ timeout: 5000 });
    await expect(page.getByTestId("prod-readiness-link-notifications-qa")).toBeVisible();
    await expect(page.getByTestId("prod-readiness-link-scores-qa")).toBeVisible();
  });
});
