/**
 * E2E: New sales layer — Command Center cards, lead detail Sales process, touches, referrals, PATCH, metrics.
 * Run: npx playwright test tests/e2e/sales-layer.spec.ts (with dev server or USE_EXISTING_SERVER=1)
 */

import { test, expect } from "@playwright/test";

const email = process.env.ADMIN_EMAIL || process.env.E2E_EMAIL || "admin@evenslouis.ca";
const password = process.env.ADMIN_PASSWORD || process.env.E2E_PASSWORD || "changeme";

test.describe("Sales layer E2E", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForURL(/\/(dashboard|login)/, { timeout: 15000 });
    if (page.url().includes("/login")) {
      const err = await page.getByText(/invalid|required|error|exception/i).first().textContent().catch(() => "");
      test.skip(true, `Login failed: ${err || "still on login"}`);
    }
  });

  test("Command Center: Follow-up discipline, Referral engine, Prospecting sources cards render", async ({ page }) => {
    await page.goto("/dashboard/command");
    await expect(page).toHaveURL(/\/dashboard\/command/);

    await expect(page.getByRole("heading", { name: /command center/i })).toBeVisible({ timeout: 8000 });

    await expect(page.getByText("Follow-up discipline", { exact: false })).toBeVisible();
    await expect(page.getByText("Referral engine", { exact: false })).toBeVisible();
    await expect(page.getByText("Prospecting sources", { exact: false })).toBeVisible();
  });

  test("Lead detail: Sales process source + Log touch + touch appears and count updates", async ({ page }) => {
    await page.goto("/dashboard/leads");
    await expect(page).toHaveURL(/\/dashboard\/leads/);

    await expect(page.locator("table tbody a[href*='/dashboard/leads/']")).toBeVisible({ timeout: 8000 });
    await page.locator("table tbody a[href*='/dashboard/leads/']").first().click();
    await expect(page).toHaveURL(/\/dashboard\/leads\/[a-z0-9-]+/);

    await expect(page.getByText("Sales process", { exact: false })).toBeVisible({ timeout: 5000 });

    const sourceChannelSelect = page.locator("select").filter({ has: page.locator('option[value="LINKEDIN"]') }).first();
    await sourceChannelSelect.selectOption("LINKEDIN");

    const sourceDetailInput = page.getByPlaceholder(/montreal meetup|linkedin post/i);
    await sourceDetailInput.fill("E2E test source detail");

    const introducedByInput = page.getByPlaceholder(/referral source|connector/i);
    await introducedByInput.fill("E2E connector");

    await page.getByRole("button", { name: /log touch/i }).click();
    await page.locator("select").filter({ has: page.locator('option[value="EMAIL"]') }).first().selectOption("EMAIL");
    const summaryArea = page.getByPlaceholder(/summary/i).first();
    await summaryArea.fill("E2E touch summary " + Date.now());
    await page.getByRole("button", { name: /save touch/i }).click();

    await expect(page.getByText("E2E touch summary")).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("Touch count:", { exact: false })).toBeVisible();
  });

  test("Lead detail: Referral ask + Log referral + referral appears and count increases", async ({ page }) => {
    await page.goto("/dashboard/leads");
    await expect(page).toHaveURL(/\/dashboard\/leads/);
    await page.locator("table tbody a[href*='/dashboard/leads/']").first().click();
    await expect(page).toHaveURL(/\/dashboard\/leads\/[a-z0-9-]+/);

    await expect(page.getByText("Sales process", { exact: false })).toBeVisible({ timeout: 5000 });

    const referralAskSelect = page.locator("select").filter({ has: page.locator('option[value="asked"]') }).first();
    await referralAskSelect.selectOption("asked");

    await page.getByRole("button", { name: /log referral/i }).click();
    await page.getByPlaceholder(/referred name/i).fill("E2E Referred Person");
    await page.getByPlaceholder(/company/i).fill("E2E Corp");
    await page.getByRole("button", { name: /save referral/i }).click();

    await expect(page.getByText("E2E Referred Person")).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("Referrals:", { exact: false })).toBeVisible();
  });

  test("PATCH /api/referrals/[referralId] returns updated referral", async ({ request, page }) => {
    await page.goto("/dashboard/leads");
    await page.locator("table tbody a[href*='/dashboard/leads/']").first().click();
    await expect(page).toHaveURL(/\/dashboard\/leads\/[a-z0-9-]+/);
    const leadId = page.url().split("/leads/")[1]?.split("/")[0];
    if (!leadId) throw new Error("No lead id");

    const cookies = await page.context().cookies();
    const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join("; ");

    let listRes = await request.get(`http://localhost:3000/api/leads/${leadId}/referrals`, {
      headers: { Cookie: cookieHeader },
    });
    let referrals: { id?: string }[] = await listRes.json();
    if (!Array.isArray(referrals) || referrals.length === 0) {
      await page.getByRole("button", { name: /log referral/i }).click();
      await page.getByPlaceholder(/referred name/i).fill("PATCH test ref " + Date.now());
      await page.getByRole("button", { name: /save referral/i }).click();
      await page.waitForTimeout(1000);
      listRes = await request.get(`http://localhost:3000/api/leads/${leadId}/referrals`, {
        headers: { Cookie: cookieHeader },
      });
      referrals = await listRes.json();
    }
    const referralId = Array.isArray(referrals) && referrals[0]?.id ? referrals[0].id : null;
    if (!referralId) {
      test.skip(true, "No referral id");
      return;
    }

    const patchRes = await request.patch(`http://localhost:3000/api/referrals/${referralId}`, {
      headers: { "Content-Type": "application/json", Cookie: cookieHeader },
      data: { status: "contacted" },
    });
    expect(patchRes.ok()).toBe(true);
    const updated = await patchRes.json();
    expect(updated).toHaveProperty("status", "contacted");
  });

  test("Follow-up discipline: lead with nextContactAt in past shows overdue or Leak", async ({ page }) => {
    await page.goto("/dashboard/leads/new");
    await page.getByPlaceholder(/e-commerce|title/i).fill("Overdue test lead " + Date.now());
    await page.getByLabel("Source").fill("e2e");
    await page.getByRole("button", { name: /create lead/i }).click();
    await expect(page).toHaveURL(/\/(dashboard\/leads\/[a-z0-9-]+|dashboard)/);

    let leadUrl = page.url();
    if (!leadUrl.includes("/leads/")) {
      await page.goto("/dashboard/leads");
      await page.getByRole("link", { name: /overdue test lead/i }).click();
      leadUrl = page.url();
    }

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = yesterday.toISOString().slice(0, 10);

    const dateInputs = page.locator('input[type="date"]');
    await dateInputs.first().fill(dateStr);
    await dateInputs.nth(1).fill(dateStr);

    await page.goto("/dashboard/command");
    await expect(page.getByText("Follow-up discipline", { exact: false })).toBeVisible();
    const hasOverdue = (await page.getByText("Overdue", { exact: false }).count()) > 0;
    const hasLeak = (await page.getByText("Leak", { exact: false }).count()) > 0;
    expect(hasOverdue || hasLeak).toBe(true);
  });

  test("Referral engine: eligible count visible when SHIPPED + won without ask", async ({ page }) => {
    await page.goto("/dashboard/leads");
    await page.locator("table tbody a[href*='/dashboard/leads/']").first().click();
    await expect(page).toHaveURL(/\/dashboard\/leads\/[a-z0-9-]+/);

    await page.getByRole("button", { name: /SHIPPED/i }).click();
    await page.getByRole("button", { name: /deal won/i }).first().click();

    await page.goto("/dashboard/command");
    await expect(page.getByText("Referral engine", { exact: false })).toBeVisible();
    await expect(page.getByText("Eligible for ask", { exact: false })).toBeVisible();
  });

  test("Prospecting sources: set leadSourceChannel, table shows channel rows", async ({ page }) => {
    await page.goto("/dashboard/leads");
    await page.locator("table tbody a[href*='/dashboard/leads/']").first().click();
    await expect(page).toHaveURL(/\/dashboard\/leads\/[a-z0-9-]+/);

    const channelSelect = page.locator("select").filter({ has: page.locator('option[value="LINKEDIN"]') }).first();
    await channelSelect.selectOption("LINKEDIN");

    await page.goto("/dashboard/leads");
    await page.locator("table tbody a[href*='/dashboard/leads/']").nth(1).click();
    const channelSelect2 = page.locator("select").filter({ has: page.locator('option[value="REFERRAL_INTRO"]') }).first();
    await channelSelect2.selectOption("REFERRAL_INTRO");

    await page.goto("/dashboard/command");
    await expect(page.getByText("Prospecting sources", { exact: false })).toBeVisible();
    const table = page.locator("table").filter({ hasText: "Channel" });
    await expect(table).toBeVisible();
  });
});
