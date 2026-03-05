import { test, expect } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000";
const loginEmail = process.env.E2E_EMAIL || process.env.ADMIN_EMAIL || (process.env.AUTH_DEV_PASSWORD ? "test@test.com" : "admin@evenslouis.ca");
const loginPassword = process.env.E2E_PASSWORD || process.env.ADMIN_PASSWORD || process.env.AUTH_DEV_PASSWORD || "changeme";

test.describe("All pages", () => {
  test("login then visit every page", async ({ page }) => {
    test.setTimeout(180000);
    await page.goto(`${baseURL}/login`);
    await page.getByLabel("Email").fill(loginEmail);
    await page.getByLabel("Password").fill(loginPassword);
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });
    expect(page.url()).not.toContain("/login");

    const pages: { url: string; name: string }[] = [
      { url: "/dashboard", name: "Dashboard" },
      { url: "/dashboard/ops-health", name: "Ops Health" },
      { url: "/dashboard/sales-leak", name: "Sales Leak" },
      { url: "/dashboard/results", name: "Results Ledger" },
      { url: "/dashboard/leads", name: "Leads" },
      { url: "/dashboard/leads/new", name: "New lead" },
      { url: "/dashboard/proposals", name: "Proposals" },
      { url: "/dashboard/build-ops", name: "Build Ops" },
      { url: "/dashboard/metrics", name: "Metrics" },
      { url: "/dashboard/meta-ads", name: "Meta Ads" },
      { url: "/work", name: "Work" },
      { url: "/dashboard/chat", name: "Chat" },
      { url: "/dashboard/learning", name: "Learning" },
      { url: "/dashboard/settings", name: "Settings" },
      { url: "/dashboard/proof", name: "Proof" },
      { url: "/dashboard/checklist", name: "Checklist" },
      { url: "/dashboard/deploys", name: "Deploys" },
      { url: "/dashboard/conversion", name: "Conversion" },
      { url: "/dashboard/knowledge", name: "Knowledge" },
      { url: "/dashboard/internal/qa/notifications", name: "Notifications QA" },
      { url: "/dashboard/internal/qa/scores", name: "Score QA" },
      { url: "/dashboard/risk", name: "Risk" },
      { url: "/dashboard/next-actions", name: "Next Actions" },
      { url: "/dashboard/internal/qa/risk", name: "Risk QA" },
      { url: "/dashboard/internal/qa/next-actions", name: "Next Actions QA" },
    ];

    for (const { url } of pages) {
      await page.goto(`${baseURL}${url}`, { timeout: 45000, waitUntil: "load" });
      await expect(page).toHaveURL(new RegExp(url.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), { timeout: 10000 });
      await expect(page.locator("body")).toBeVisible({ timeout: 5000 });
      await page.waitForTimeout(500);
    }

    await page.goto(`${baseURL}/`);
    await expect(page).toHaveURL(/\//);
  });

  test("visit lead detail and proposal console when ids provided", async ({ page }) => {
    await page.goto(`${baseURL}/login`);
    await page.getByLabel("Email").fill(loginEmail);
    await page.getByLabel("Password").fill(loginPassword);
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });
    expect(page.url()).not.toContain("/login");

    let leadId = process.env.E2E_LEAD_ID;
    const proposalId = process.env.E2E_PROPOSAL_ARTIFACT_ID;
    if (!leadId) {
      const leadsRes = await page.request.get(`${baseURL.replace(/\/$/, "")}/api/leads`);
      const leads = await leadsRes.json();
      leadId = Array.isArray(leads) && leads.length > 0 ? leads[0].id : null;
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
    if (!leadId && !proposalId) {
      await page.goto(`${baseURL}/dashboard/leads`);
      await expect(page).toHaveURL(/\/dashboard\/leads/);
      await expect(page.locator("body")).toBeVisible();
    }
  });
});
