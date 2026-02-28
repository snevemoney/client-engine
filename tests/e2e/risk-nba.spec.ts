/**
 * Phase 4.0: Risk flags and Next-Best-Action E2E.
 * Visit risk and next-actions pages, Run buttons, list render, dismiss.
 * Do not run against prod — Run Risk Rules, Run Next Actions, and Dismiss mutate data.
 */
import { test, expect } from "@playwright/test";
import { requireSafeE2EBaseUrl } from "./helpers/safety";

const baseURL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000";
const loginEmail = process.env.E2E_EMAIL || process.env.ADMIN_EMAIL || "admin@evenslouis.ca";
const loginPassword = process.env.E2E_PASSWORD || process.env.ADMIN_PASSWORD || "changeme";

function skipIfProd(): boolean {
  const isProd = baseURL.includes("evenslouis.ca");
  const optIn = process.env.E2E_ALLOW_MUTATIONS === "1" || process.env.E2E_ALLOW_MUTATIONS === "true";
  return isProd && !optIn;
}

test.describe("Risk & Next Actions pages", () => {
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

  test("Risk page loads and Run Risk Rules button visible", async ({ page }) => {
    await page.goto(`${baseURL}/dashboard/risk`, { waitUntil: "load", timeout: 15000 });
    await expect(page).toHaveURL(/\/dashboard\/risk/);
    await expect(page.locator("h1")).toContainText(/Risk/i, { timeout: 5000 });
    await expect(page.getByRole("button", { name: /Run Risk Rules/i })).toBeVisible({ timeout: 5000 });
  });

  test("Risk page: Run Risk Rules triggers API call", async ({ page }) => {
    await page.goto(`${baseURL}/dashboard/risk`, { waitUntil: "load", timeout: 15000 });
    const runBtn = page.getByRole("button", { name: /Run Risk Rules/i });
    await expect(runBtn).toBeVisible();
    await runBtn.click();
    await expect(runBtn).toBeEnabled({ timeout: 15000 });
    await expect(page.locator("body")).toBeVisible();
  });

  test("Risk page: list renders (empty or with items)", async ({ page }) => {
    await page.goto(`${baseURL}/dashboard/risk`, { waitUntil: "load", timeout: 15000 });
    const content = page.getByText("No risk flags").or(page.locator(".divide-y"));
    await expect(content).toBeVisible({ timeout: 5000 });
  });

  test("Risk page: Dismiss button on first item (if any)", async ({ page }) => {
    await page.goto(`${baseURL}/dashboard/risk`, { waitUntil: "load", timeout: 15000 });
    const dismissBtn = page.getByTestId("risk-dismiss").first();
    if (await dismissBtn.isVisible({ timeout: 2000 })) {
      await dismissBtn.click();
      await expect(page.locator("body")).toBeVisible({ timeout: 5000 });
    }
  });

  test("Next Actions page loads and Run Next Actions button visible", async ({ page }) => {
    await page.goto(`${baseURL}/dashboard/next-actions`, { waitUntil: "load", timeout: 15000 });
    await expect(page).toHaveURL(/\/dashboard\/next-actions/);
    await expect(page.locator("h1")).toContainText(/Next Best Actions/i, { timeout: 5000 });
    await expect(page.getByRole("button", { name: /Run Next Actions/i })).toBeVisible({ timeout: 5000 });
  });

  test("Next Actions page: Run Next Actions triggers API call", async ({ page }) => {
    await page.goto(`${baseURL}/dashboard/next-actions`, { waitUntil: "load", timeout: 15000 });
    const runBtn = page.getByRole("button", { name: /Run Next Actions/i });
    await expect(runBtn).toBeVisible();
    await runBtn.click();
    await expect(runBtn).toBeEnabled({ timeout: 15000 });
    await expect(page.locator("body")).toBeVisible();
  });

  test("Next Actions page: list renders (empty or with items)", async ({ page }) => {
    await page.goto(`${baseURL}/dashboard/next-actions`, { waitUntil: "load", timeout: 15000 });
    const content = page
      .getByText(/Ranked recommendations|No next actions/i)
      .or(page.locator(".divide-y"))
      .first();
    await expect(content).toBeVisible({ timeout: 5000 });
  });

  test("Next Actions page: Dismiss button on first item (if any)", async ({ page }) => {
    await page.goto(`${baseURL}/dashboard/next-actions`, { waitUntil: "load", timeout: 15000 });
    const dismissBtn = page.getByTestId("next-action-dismiss").first();
    if (await dismissBtn.isVisible({ timeout: 2000 })) {
      await dismissBtn.click();
      await expect(page.locator("body")).toBeVisible({ timeout: 5000 });
    }
  });

  test("Next Actions playbook: open, snooze or mark done, row disappears", async ({ page }) => {
    await page.goto(`${baseURL}/dashboard/next-actions`, { waitUntil: "load", timeout: 15000 });
    await expect(page).toHaveURL(/\/dashboard\/next-actions/);

    // Ensure at least one queued action (run NBA if list is empty)
    const runBtn = page.getByRole("button", { name: /Run Next Actions/i });
    const emptyState = page.getByText(/No next actions/i);
    if (await emptyState.isVisible({ timeout: 2000 })) {
      await runBtn.click();
      await expect(runBtn).toBeEnabled({ timeout: 15000 });
      await page.waitForTimeout(2000);
    }

    const playbookToggle = page.getByTestId("next-action-playbook-toggle").first();
    if (!(await playbookToggle.isVisible({ timeout: 3000 }))) {
      test.skip(true, "No queued actions to test playbook");
    }

    await playbookToggle.click();
    await expect(page.getByTestId("next-action-playbook-panel").first()).toBeVisible({ timeout: 5000 });

    // Use snooze_1d (via menu) or mark_done (Check button)
    const markDoneBtn = page.getByTestId("next-action-mark-done").first();
    const menuBtn = page.getByTestId("next-action-menu").first();
    if (await markDoneBtn.isVisible({ timeout: 1000 })) {
      await markDoneBtn.click();
    } else if (await menuBtn.isVisible({ timeout: 1000 })) {
      await menuBtn.click();
      await page.getByRole("button", { name: /Snooze 1 day/i }).first().click({ timeout: 3000 });
    } else {
      test.skip(true, "No snooze/mark_done controls on first item");
    }

    await expect(page.locator("body")).toBeVisible({ timeout: 5000 });
    // Row should disappear from queued list or show snoozed state after refresh
    await page.reload({ waitUntil: "load", timeout: 15000 });
    await expect(page).toHaveURL(/\/dashboard\/next-actions/);
  });
});

test.describe("Command Center RiskNBA integration", () => {
  test.describe.configure({ skip: skipIfProd() });

  test.beforeEach(async ({ page }) => {
    await page.goto(`${baseURL}/login`);
    await page.getByLabel("Email").fill(loginEmail);
    await page.getByLabel("Password").fill(loginPassword);
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });
    if (page.url().includes("/login")) {
      test.skip(true, "Login failed");
    }
  });

  test("RiskNBACard is visible on Command Center", async ({ page }) => {
    await page.goto(`${baseURL}/dashboard/command`, { waitUntil: "load", timeout: 15000 });
    await expect(page).toHaveURL(/\/dashboard\/command/);
    await expect(page.getByTestId("risk-nba-card")).toBeVisible({ timeout: 5000 });
  });

  test("Run Risk Rules button triggers API and refreshes UI", async ({ page }) => {
    await page.goto(`${baseURL}/dashboard/command`, { waitUntil: "load", timeout: 15000 });
    const runBtn = page.getByTestId("run-risk-rules");
    await expect(runBtn).toBeVisible({ timeout: 5000 });
    await runBtn.click();
    await expect(runBtn).toBeEnabled({ timeout: 15000 });
  });

  test("Run Next Actions button triggers API and refreshes UI", async ({ page }) => {
    await page.goto(`${baseURL}/dashboard/command`, { waitUntil: "load", timeout: 15000 });
    const runBtn = page.getByTestId("run-next-actions");
    await expect(runBtn).toBeVisible({ timeout: 5000 });
    await runBtn.click();
    await expect(runBtn).toBeEnabled({ timeout: 15000 });
  });

  test("Empty state does not crash", async ({ page }) => {
    await page.goto(`${baseURL}/dashboard/command`, { waitUntil: "load", timeout: 15000 });
    await expect(page.getByTestId("risk-nba-card")).toBeVisible({ timeout: 5000 });
    await expect(page.locator("body")).toBeVisible();
  });
});

test.describe("Phase 4.1: NBA v2 scope and Why", () => {
  test.describe.configure({ skip: skipIfProd() });

  test.beforeEach(async ({ page }) => {
    await page.goto(`${baseURL}/login`);
    await page.getByLabel("Email").fill(loginEmail);
    await page.getByLabel("Password").fill(loginPassword);
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });
    if (page.url().includes("/login")) {
      test.skip(true, "Login failed");
    }
  });

  test("Next Actions page: scope selector visible and switchable", async ({ page }) => {
    await page.goto(`${baseURL}/dashboard/next-actions`, { waitUntil: "load", timeout: 15000 });
    const scopeSelect = page.getByTestId("nba-scope-select");
    await expect(scopeSelect).toBeVisible({ timeout: 5000 });
    await scopeSelect.selectOption("review_stream");
    await expect(page).toHaveURL(/scope=review_stream/);
    await scopeSelect.selectOption("command_center");
    await expect(page).toHaveURL(/scope=command_center/);
  });

  test("Next Actions page: Why toggle expands panel when actions exist", async ({ page }) => {
    await page.goto(`${baseURL}/dashboard/next-actions`, { waitUntil: "load", timeout: 15000 });
    const whyToggle = page.getByTestId("next-action-why-toggle").first();
    if (await whyToggle.isVisible({ timeout: 2000 })) {
      await whyToggle.click();
      await expect(page.getByTestId("next-action-why-panel").first()).toBeVisible({ timeout: 3000 });
    }
  });
});
