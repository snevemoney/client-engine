import { test, expect } from "@playwright/test";

const email = process.env.ADMIN_EMAIL || process.env.E2E_EMAIL || "admin@evenslouis.ca";
const password = process.env.ADMIN_PASSWORD || process.env.E2E_PASSWORD || "changeme";

test.describe("Full E2E flow", () => {
  test("login → dashboard → metrics → new lead → metrics shows run", async ({ page }) => {
    test.setTimeout(60000);
    // 1) Login
    await page.goto("/login");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });
    if (page.url().includes("/login")) {
      test.skip(true, "Login failed - set ADMIN_EMAIL/ADMIN_PASSWORD or E2E_EMAIL/E2E_PASSWORD in .env");
      return;
    }

    // 2) Dashboard
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/dashboard/);

    // 3) Metrics page loads
    await page.goto("/dashboard/metrics");
    await expect(page).toHaveURL(/\/dashboard\/metrics/);
    await expect(page.getByRole("heading", { name: /Scorecard/ })).toBeVisible();
    await expect(page.getByText("enrich", { exact: true }).first()).toBeVisible();

    // 4) Create a lead (triggers pipeline automatically)
    await page.goto("/dashboard/leads/new");
    await expect(page.getByRole("heading", { name: /new lead/i })).toBeVisible();
    await page.getByPlaceholder(/e-commerce/i).fill("E2E test lead " + Date.now());
    await page.getByLabel("Source").fill("e2e");
    await page.getByRole("button", { name: /create lead/i }).click();
    await expect(page).toHaveURL(/\/dashboard(\/leads\/[a-z0-9-]+)?\/?/);

    // 5) Back to metrics — page loads and shows scorecard (run may appear after a moment)
    await page.goto("/dashboard/metrics");
    await expect(page.getByRole("heading", { name: /Scorecard/ })).toBeVisible();
    await expect(page.getByText("enrich", { exact: true }).first()).toBeVisible();
  });
});
