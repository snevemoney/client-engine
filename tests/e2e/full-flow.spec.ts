import { test, expect, type Page } from "@playwright/test";
import { requireSafeE2EBaseUrl } from "./helpers/safety";

const email = process.env.ADMIN_EMAIL || process.env.E2E_EMAIL || "admin@evenslouis.ca";
const password = process.env.ADMIN_PASSWORD || process.env.E2E_PASSWORD || "changeme";

/**
 * Next.js server `redirect()` (e.g. /dashboard → /dashboard/founder) can abort
 * a following page.goto with net::ERR_ABORTED. Land on the path anyway.
 */
async function gotoPath(page: Page, path: string) {
  try {
    await page.goto(path, { waitUntil: "domcontentloaded" });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (!message.includes("ERR_ABORTED")) throw err;
  }
  await expect(page).toHaveURL(new RegExp(path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
}

test.describe("Full E2E flow", () => {
  test.beforeEach(() => {
    requireSafeE2EBaseUrl();
  });

  test("login → dashboard → metrics → new lead → metrics shows run", async ({ page }) => {
    test.setTimeout(60000);
    // 1) Login
    await page.goto("/login");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });
    await page.waitForLoadState("domcontentloaded");

    // 2) Metrics page loads
    await gotoPath(page, "/dashboard/metrics");
    await expect(page.getByRole("heading", { name: /Scorecard/ })).toBeVisible();
    await expect(page.getByText("enrich", { exact: true }).first()).toBeVisible();

    // 3) Create a lead (triggers pipeline automatically)
    await gotoPath(page, "/dashboard/leads/new");
    await expect(page.getByRole("heading", { name: /new lead/i })).toBeVisible();
    await page.getByPlaceholder(/e-commerce/i).fill("E2E test lead " + Date.now());
    await page.getByLabel("Source").fill("e2e");
    await page.getByRole("button", { name: /create lead/i }).click();
    await expect(page).toHaveURL(/\/dashboard(\/leads\/[a-z0-9-]+)?\/?/);

    // 4) Back to metrics — page loads and shows scorecard (run may appear after a moment)
    await gotoPath(page, "/dashboard/metrics");
    await expect(page.getByRole("heading", { name: /Scorecard/ })).toBeVisible();
    await expect(page.getByText("enrich", { exact: true }).first()).toBeVisible();
  });
});
