import { test, expect } from "@playwright/test";
import { loginAndWaitForDashboard } from "./helpers/auth";

/**
 * Hive Phase 0 gate — /pro operator surface (read-only).
 * Run: PLAYWRIGHT_BASE_URL=https://evenslouis.ca/pro CE_E2E_EMAIL=... CE_E2E_PASSWORD=... npx playwright test tests/e2e/hive-gate-pro.spec.ts
 */
test.describe("Hive gate — Client Engine /pro", () => {
  test("login and leads dashboard loads", async ({ page }) => {
    const ok = await loginAndWaitForDashboard(page);
    test.skip(!ok, "Login failed — set CE_E2E_EMAIL / CE_E2E_PASSWORD");

    await page.goto("/dashboard/leads", { waitUntil: "domcontentloaded", timeout: 20000 });
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.locator("body")).toBeVisible();
  });

  test("no prominent auto-send / auto-build controls on leads page", async ({ page }) => {
    const ok = await loginAndWaitForDashboard(page);
    test.skip(!ok, "Login failed");

    await page.goto("/dashboard/leads", { waitUntil: "domcontentloaded", timeout: 20000 });
    const autoSend = page.getByRole("button", { name: /auto.?send|send.?all|auto.?build/i });
    await expect(autoSend).toHaveCount(0);
  });
});
