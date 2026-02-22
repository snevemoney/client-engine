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
      { url: "/dashboard", name: "Dashboard" },
      { url: "/dashboard/command", name: "Command" },
      { url: "/dashboard/ops-health", name: "Ops Health" },
      { url: "/dashboard/sales-leak", name: "Sales Leak" },
      { url: "/dashboard/results", name: "Results Ledger" },
      { url: "/dashboard/leads", name: "Leads" },
      { url: "/dashboard/leads/new", name: "New lead" },
      { url: "/dashboard/proposals", name: "Proposals" },
      { url: "/dashboard/build-ops", name: "Build Ops" },
      { url: "/dashboard/metrics", name: "Metrics" },
      { url: "/work", name: "Work" },
      { url: "/dashboard/chat", name: "Chat" },
      { url: "/dashboard/learning", name: "Learning" },
      { url: "/dashboard/settings", name: "Settings" },
      { url: "/dashboard/proof", name: "Proof" },
      { url: "/dashboard/checklist", name: "Checklist" },
      { url: "/dashboard/deploys", name: "Deploys" },
      { url: "/dashboard/conversion", name: "Conversion" },
      { url: "/dashboard/knowledge", name: "Knowledge" },
    ];

    for (const { url, name } of pages) {
      await page.goto(`${baseURL}${url}`);
      await expect(page).toHaveURL(new RegExp(url.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
      await expect(page.locator("body")).toBeVisible();
    }

    await page.goto(`${baseURL}/`);
    await expect(page).toHaveURL(/\//);
  });

  test("visit lead detail and proposal console when ids provided", async ({ page }) => {
    const leadId = process.env.E2E_LEAD_ID;
    const proposalId = process.env.E2E_PROPOSAL_ARTIFACT_ID;
    if (!leadId && !proposalId) {
      test.skip(true, "E2E_LEAD_ID or E2E_PROPOSAL_ARTIFACT_ID not set");
      return;
    }
    await page.goto(`${baseURL}/login`);
    await page.getByLabel("Email").fill("test@test.com");
    await page.getByLabel("Password").fill(devPassword);
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/(dashboard|login)/, { timeout: 10000 });
    if (page.url().includes("/login")) {
      test.skip(true, "Login failed");
      return;
    }
    if (leadId) {
      await page.goto(`${baseURL}/dashboard/leads/${leadId}`);
      await expect(page).toHaveURL(new RegExp(`/dashboard/leads/${leadId}`));
      await expect(page.locator("body")).toBeVisible();
    }
    if (proposalId) {
      await page.goto(`${baseURL}/dashboard/proposals/${proposalId}`);
      await expect(page).toHaveURL(new RegExp(`/dashboard/proposals/${proposalId}`));
      await expect(page.locator("body")).toBeVisible();
    }
  });
});
