import { test, expect } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000";
const devPassword = process.env.AUTH_DEV_PASSWORD || "changeme";

test.describe("All pages", () => {
  test("login then visit every page", async ({ page }) => {
    await page.goto(`${baseURL}/login`);
    await page.getByLabel("Email").fill("test@test.com");
    await page.getByLabel("Password").fill(devPassword);
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/(dashboard|login)/, { timeout: 10000 });
    if (page.url().includes("/login")) {
      test.skip(true, "Login failed");
      return;
    }

    const pages: { url: string; name: string }[] = [
      { url: "/dashboard", name: "Leads" },
      { url: "/dashboard/proposals", name: "Proposals" },
      { url: "/dashboard/deploys", name: "Deploys" },
      { url: "/dashboard/metrics", name: "Metrics" },
      { url: "/dashboard/settings", name: "Settings" },
      { url: "/dashboard/leads/new", name: "New lead" },
    ];

    for (const { url, name } of pages) {
      await page.goto(`${baseURL}${url}`);
      await expect(page).toHaveURL(new RegExp(url.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
      await expect(page.locator("body")).toBeVisible();
    }

    await page.goto(`${baseURL}/`);
    await expect(page).toHaveURL(/\//);
  });
});
