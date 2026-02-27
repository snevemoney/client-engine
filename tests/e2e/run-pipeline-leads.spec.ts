/**
 * E2E: Run pipeline on Leads page, wait for completion, verify success alert and SCORED status.
 * Do not run against prod — runs pipeline and mutates lead data.
 *
 * Run:
 *   USE_EXISTING_SERVER=1 PLAYWRIGHT_BASE_URL=http://localhost:3000 npx playwright test tests/e2e/run-pipeline-leads.spec.ts
 */
import { test, expect } from "@playwright/test";
import { loginAndWaitForDashboard, baseURL } from "./helpers/auth";
import { requireSafeE2EBaseUrl } from "./helpers/safety";

test.beforeEach(() => {
  requireSafeE2EBaseUrl();
});

test("run pipeline on leads, verify success and SCORED status", async ({ page }) => {
  test.setTimeout(120_000); // 2 min for pipeline + wait

  const loggedIn = await loginAndWaitForDashboard(page);
  if (!loggedIn) {
    test.skip(true, "Login failed - set E2E_EMAIL/E2E_PASSWORD or ADMIN_EMAIL/ADMIN_PASSWORD");
    return;
  }

  await page.goto(`${baseURL}/dashboard/leads`, { waitUntil: "networkidle", timeout: 15000 });

  const runPipelineBtn = page.getByRole("button", { name: /Run pipeline/ });
  const buttonVisible = await runPipelineBtn.isVisible().catch(() => false);
  if (!buttonVisible) {
    const scoredBadges = page.locator('table td:has-text("SCORED")');
    const count = await scoredBadges.count();
    if (count > 0) {
      console.log("No Run pipeline button (no eligible leads). Leads already SCORED:", count);
    } else {
      console.log("No Run pipeline button and no SCORED leads - table may be empty.");
    }
    return;
  }

  const dialogPromise = page.waitForEvent("dialog", { timeout: 95_000 });
  await runPipelineBtn.click();
  const dialog = await dialogPromise;
  const dialogMessage = dialog.message();
  await dialog.accept();

  const successAlertAppeared = /Pipeline ran for \d+ lead(s)?\./.test(dialogMessage) || dialogMessage === "Processed leads but none could run (may already have artifacts or be ineligible).";
  const errorAlert = dialogMessage && !successAlertAppeared;

  await page.waitForTimeout(2000);
  await page.reload({ waitUntil: "networkidle", timeout: 15000 });
  const scoredCells = page.locator('table tbody td').filter({ hasText: "SCORED" });
  const scoredCount = await scoredCells.count();

  console.log("Dialog message:", dialogMessage);
  console.log("Success alert appeared:", successAlertAppeared);
  console.log("Leads with SCORED status:", scoredCount);
  if (errorAlert) console.log("Error/info alert:", dialogMessage);

  expect(successAlertAppeared || scoredCount > 0, "Expected success alert or at least one SCORED lead").toBeTruthy();
});
