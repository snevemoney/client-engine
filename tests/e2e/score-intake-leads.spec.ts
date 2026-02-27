/**
 * One-off E2E: Score all unscored intake leads.
 * Do not run against prod by default — scores leads (mutation). Use E2E_ALLOW_PROD_SCORE=1 to bypass.
 *
 * Run:
 *   Local:  npm run dev (separate terminal) && PLAYWRIGHT_BASE_URL=http://localhost:3000 npx playwright test tests/e2e/score-intake-leads.spec.ts
 *   Prod:   E2E_ALLOW_PROD_SCORE=1 PLAYWRIGHT_BASE_URL=https://evenslouis.ca USE_EXISTING_SERVER=1 E2E_EMAIL=... E2E_PASSWORD=... npx playwright test tests/e2e/score-intake-leads.spec.ts
 */
import { test, expect } from "@playwright/test";
import { loginAndWaitForDashboard, baseURL } from "./helpers/auth";
import { requireSafeE2EBaseUrl } from "./helpers/safety";

test.beforeEach(() => {
  requireSafeE2EBaseUrl();
});

test("score all unscored intake leads", async ({ page }) => {
  const loggedIn = await loginAndWaitForDashboard(page);
  if (!loggedIn) {
    test.skip(true, "Login failed - set E2E_EMAIL/E2E_PASSWORD or ADMIN_EMAIL/ADMIN_PASSWORD");
    return;
  }

  let totalScored = 0;
  const maxIterations = 200; // Safety cap
  let iterations = 0;

  while (iterations++ < maxIterations) {
    await page.goto(`${baseURL}/dashboard/intake?filter=needs-score`, {
      waitUntil: "networkidle",
      timeout: 15000,
    });

    const table = page.locator("table tbody");
    await table.waitFor({ state: "visible", timeout: 5000 }).catch(() => null);

    const leadLinks = page.locator('table tbody a[href^="/dashboard/intake/"]');
    const count = await leadLinks.count();

    if (count === 0) {
      break;
    }

    const firstLink = leadLinks.first();
    await firstLink.click();

    await expect(page).toHaveURL(/\/dashboard\/intake\/[^/]+$/, { timeout: 8000 });

    const scoreBtn = page.getByRole("button", { name: /Score Lead|Scoring…/ });
    await scoreBtn.click();

    await page
      .getByRole("button", { name: "Scoring…" })
      .waitFor({ state: "visible", timeout: 2000 })
      .catch(() => null);
    await page
      .getByRole("button", { name: /Score Lead/ })
      .waitFor({ state: "visible", timeout: 45000 });

    totalScored++;
    await page.goto(`${baseURL}/dashboard/intake?filter=needs-score`, {
      waitUntil: "networkidle",
      timeout: 15000,
    });
  }

  // eslint-disable-next-line no-console
  console.log(`Scored ${totalScored} intake lead(s).`);
});
