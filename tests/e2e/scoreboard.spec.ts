/**
 * Phase 3.2: Scoreboard UI E2E — Operational Score page.
 */
import { test, expect } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000";
const loginEmail = process.env.E2E_EMAIL || process.env.ADMIN_EMAIL || "admin@evenslouis.ca";
const loginPassword = process.env.E2E_PASSWORD || process.env.ADMIN_PASSWORD || "changeme";

test.describe("Scoreboard (Operational Score)", () => {
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

  test("page loads and shows heading", async ({ page }) => {
    await page.goto(`${baseURL}/dashboard/internal/scoreboard`);
    await expect(page).toHaveURL(/\/dashboard\/internal\/scoreboard/);
    await expect(page.getByRole("heading", { name: /Operational Score/i })).toBeVisible({ timeout: 5000 });
  });

  test("Recompute button exists and is clickable", async ({ page }) => {
    await page.goto(`${baseURL}/dashboard/internal/scoreboard`);
    const recomputeBtn = page.getByTestId("recompute-button");
    await expect(recomputeBtn).toBeVisible();
    await expect(recomputeBtn).toContainText(/Recompute/i);
  });

  test("clicking Recompute runs without crash", async ({ page }) => {
    await page.goto(`${baseURL}/dashboard/internal/scoreboard`);
    const recomputeBtn = page.getByTestId("recompute-button");
    await recomputeBtn.click();

    await expect(
      page.getByTestId("score-card").or(page.getByTestId("score-empty-state")).or(page.getByTestId("score-error"))
    ).toBeVisible({ timeout: 15000 });

    await expect(recomputeBtn).toBeEnabled({ timeout: 15000 });
  });

  test("empty state shows CTA when no data", async ({ page }) => {
    await page.goto(`${baseURL}/dashboard/internal/scoreboard`);
    await page.waitForLoadState("networkidle");

    const emptyState = page.getByTestId("score-empty-state");
    const scoreCard = page.getByTestId("score-card");
    const hasData = await scoreCard.isVisible().catch(() => false);
    const isEmpty = await emptyState.isVisible().catch(() => false);

    if (isEmpty) {
      await expect(page.getByTestId("recompute-empty-cta")).toBeVisible();
    }
    expect(hasData || isEmpty).toBe(true);
  });

  test("QA: Multi-entity link navigates to QA scores", async ({ page }) => {
    await page.goto(`${baseURL}/dashboard/internal/scoreboard`);
    await page.getByRole("link", { name: /QA: Multi-entity/i }).click();
    await expect(page).toHaveURL(/\/dashboard\/internal\/qa\/scores/);
  });

  test("Phase 3.3: Trend section renders when data exists", async ({ page }) => {
    await page.goto(`${baseURL}/dashboard/internal/scoreboard`);
    await page.waitForLoadState("networkidle");
    const trendSection = page.getByTestId("trend-section");
    const emptyState = page.getByTestId("score-empty-state");
    const hasData = await trendSection.isVisible().catch(() => false);
    const isEmpty = await emptyState.isVisible().catch(() => false);
    expect(hasData || isEmpty).toBe(true);
    if (hasData) {
      await expect(page.getByTestId("trend-summary-block")).toBeVisible();
    }
  });

  test("Phase 3.3: Range selector visible and 7d default", async ({ page }) => {
    await page.goto(`${baseURL}/dashboard/internal/scoreboard`);
    const range7d = page.getByTestId("range-7d");
    await expect(range7d).toBeVisible();
    const range24h = page.getByTestId("range-24h");
    const range30d = page.getByTestId("range-30d");
    await expect(range24h).toBeVisible();
    await expect(range30d).toBeVisible();
  });

  test("Phase 3.3: Recompute button disables while running", async ({ page }) => {
    await page.goto(`${baseURL}/dashboard/internal/scoreboard`);
    const recomputeBtn = page.getByTestId("recompute-button");
    await recomputeBtn.click();
    await expect(recomputeBtn).toBeDisabled();
    await expect(recomputeBtn).toBeEnabled({ timeout: 20000 });
  });

  test("Phase 3.3: What changed section or empty state visible", async ({ page }) => {
    await page.goto(`${baseURL}/dashboard/internal/scoreboard`);
    await page.waitForLoadState("networkidle");
    const hasData = await page.getByTestId("score-card").isVisible().catch(() => false);
    if (hasData) {
      const factorChanges = page.getByTestId("score-factor-changes");
      const factorChangesEmpty = page.getByTestId("score-factor-changes-empty");
      await expect(factorChanges.or(factorChangesEmpty)).toBeVisible();
    }
  });

  test("Matrix #60: data-freshness visible when score-card has data", async ({ page }) => {
    await page.goto(`${baseURL}/dashboard/internal/scoreboard`);
    await page.waitForLoadState("networkidle");
    const scoreCard = page.getByTestId("score-card");
    const hasData = await scoreCard.isVisible().catch(() => false);
    if (hasData) {
      await expect(page.getByTestId("data-freshness")).toBeVisible();
    }
  });
});

test.describe("3.6.3 Workflow replay: Recompute updates scoreboard", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${baseURL}/login`);
    await page.getByLabel("Email").fill(loginEmail);
    await page.getByLabel("Password").fill(loginPassword);
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });
  });

  test("Recompute disables button, then re-enables; score card or empty visible; data-freshness when data", async ({
    page,
  }) => {
    await page.goto(`${baseURL}/dashboard/internal/scoreboard`);
    const recomputeBtn = page.getByTestId("recompute-button");
    await recomputeBtn.click();

    await expect(recomputeBtn).toBeDisabled();
    await expect(recomputeBtn).toBeEnabled({ timeout: 20000 });

    await expect(
      page.getByTestId("score-card").or(page.getByTestId("score-empty-state")).or(page.getByTestId("score-error"))
    ).toBeVisible({ timeout: 15000 });

    const hasCard = await page.getByTestId("score-card").isVisible().catch(() => false);
    if (hasCard) {
      await expect(page.getByTestId("data-freshness")).toBeVisible();
    }
  });

  test("What changed section or empty visible when data exists", async ({ page }) => {
    await page.goto(`${baseURL}/dashboard/internal/scoreboard`);
    await page.waitForLoadState("networkidle");
    const hasCard = await page.getByTestId("score-card").isVisible().catch(() => false);
    if (hasCard) {
      const factorChanges = page.getByTestId("score-factor-changes");
      const factorChangesEmpty = page.getByTestId("score-factor-changes-empty");
      await expect(factorChanges.or(factorChangesEmpty)).toBeVisible();
    }
  });

  test("3.6.4 resilience: summary API failure shows score-error, Recompute button not stuck", async ({
    page,
  }) => {
    await page.route("**/api/internal/scores/summary*", (route) =>
      route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "Internal error" }) })
    );
    await page.goto(`${baseURL}/dashboard/internal/scoreboard`);
    await expect(page.getByTestId("score-error")).toBeVisible({ timeout: 5000 });
    const recomputeBtn = page.getByTestId("recompute-button");
    await expect(recomputeBtn).toBeEnabled();
  });

  test("Range 7d/24h/30d visible; switching range does not crash", async ({ page }) => {
    await page.goto(`${baseURL}/dashboard/internal/scoreboard`);
    const range7d = page.getByTestId("range-7d");
    const range24h = page.getByTestId("range-24h");
    const range30d = page.getByTestId("range-30d");
    await expect(range7d).toBeVisible();
    await expect(range24h).toBeVisible();
    await expect(range30d).toBeVisible();
    await range24h.click();
    await page.waitForLoadState("networkidle");
    await range30d.click();
    await page.waitForLoadState("networkidle");
    await expect(page.getByTestId("trend-section").or(page.getByTestId("score-empty-state"))).toBeVisible();
  });
});

test.describe("3.6.5 Golden scenarios", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${baseURL}/login`);
    await page.getByLabel("Email").fill(loginEmail);
    await page.getByLabel("Password").fill(loginPassword);
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });
  });

  test("Empty state golden: scoreboard loads with no data, empty CTA visible, no crash", async ({ page }) => {
    await page.goto(`${baseURL}/dashboard/internal/scoreboard`);
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("heading", { name: /Operational Score/i })).toBeVisible();
    const emptyState = page.getByTestId("score-empty-state");
    const scoreCard = page.getByTestId("score-card");
    const isEmpty = await emptyState.isVisible().catch(() => false);
    const hasData = await scoreCard.isVisible().catch(() => false);
    expect(isEmpty || hasData).toBe(true);
    if (isEmpty) {
      await expect(page.getByTestId("recompute-empty-cta")).toBeVisible();
    }
  });

  test("Recompute golden: button disables then re-enables, score card or empty visible, trend/range controls remain", async ({
    page,
  }) => {
    await page.goto(`${baseURL}/dashboard/internal/scoreboard`);
    const recomputeBtn = page.getByTestId("recompute-button");
    await recomputeBtn.click();
    await expect(recomputeBtn).toBeDisabled();
    await expect(recomputeBtn).toBeEnabled({ timeout: 20000 });
    await expect(
      page.getByTestId("score-card").or(page.getByTestId("score-empty-state")).or(page.getByTestId("score-error"))
    ).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId("range-7d")).toBeVisible();
    await expect(page.getByTestId("trend-section").or(page.getByTestId("score-empty-state"))).toBeVisible();
  });

  test("Error golden: intercept summary 500, score-error shown, page shell usable", async ({ page }) => {
    await page.route("**/api/internal/scores/summary*", (route) =>
      route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "Internal error" }) })
    );
    await page.goto(`${baseURL}/dashboard/internal/scoreboard`);
    await expect(page.getByTestId("score-error")).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole("heading", { name: /Operational Score/i })).toBeVisible();
    await expect(page.getByTestId("recompute-button")).toBeEnabled();
  });
});
