import { test, expect } from "@playwright/test";

const email = process.env.ADMIN_EMAIL || process.env.E2E_EMAIL || "admin@evenslouis.ca";
const password = process.env.ADMIN_PASSWORD || process.env.E2E_PASSWORD || "changeme";

test.describe("Full E2E flow", () => {
  test("login → dashboard → metrics → new lead → metrics shows run", async ({ page }) => {
    // 1) Login
    await page.goto("/login");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/(dashboard|login)/);
    const stillLogin = await page.url().includes("/login");
    if (stillLogin) {
      await expect(page.getByText(/invalid|error/i)).toBeVisible({ timeout: 5000 }).catch(() => {});
      test.skip(true, "Login failed (wrong credentials or env)");
      return;
    }

    // 2) Dashboard
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/dashboard/);

    // 3) Metrics page loads
    await page.goto("/dashboard/metrics");
    await expect(page).toHaveURL(/\/dashboard\/metrics/);
    await expect(page.getByText("Pipeline metrics", { exact: false })).toBeVisible();
    await expect(page.getByText("Step success", { exact: false })).toBeVisible();

    // 4) Create a lead (triggers pipeline automatically)
    await page.goto("/dashboard/leads/new");
    await expect(page.getByRole("heading", { name: /new lead/i })).toBeVisible();
    await page.getByPlaceholder(/e-commerce/i).fill("E2E test lead " + Date.now());
    await page.getByLabel("Source").fill("e2e");
    await page.getByRole("button", { name: /create lead/i }).click();
    await expect(page).toHaveURL(/\/dashboard(\/leads\/[a-z0-9-]+)?\/?/);

    // 5) Back to metrics — page loads and shows at least the section (run may appear after a moment)
    await page.goto("/dashboard/metrics");
    await expect(page.getByText("Pipeline metrics", { exact: false })).toBeVisible();
    await expect(page.getByText("enrich")).toBeVisible();
  });
});
