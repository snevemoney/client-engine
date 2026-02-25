/**
 * E2E: Client-acquisition features — Command Center (Channel ROI, Channel role,
 * Owned audience, Networking events), owned-audience snapshot, networking event log,
 * and trust-to-close checklist on a lead with a proposal.
 *
 * Run: npm run test:e2e tests/e2e/client-acquisition.spec.ts
 * Or with existing server: USE_EXISTING_SERVER=1 npm run test:e2e tests/e2e/client-acquisition.spec.ts
 *
 * Requires login: set ADMIN_EMAIL/ADMIN_PASSWORD or E2E_EMAIL/E2E_PASSWORD in .env
 * (e.g. admin@evenslouis.ca / changeme if using reset-auth script).
 */

import { test, expect } from "@playwright/test";

const email = process.env.ADMIN_EMAIL || process.env.E2E_EMAIL || "admin@evenslouis.ca";
const password = process.env.ADMIN_PASSWORD || process.env.E2E_PASSWORD || "changeme";

test.describe("Client-acquisition E2E", () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(45000);
    await page.goto("/login");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForURL(/\/dashboard/, { timeout: 15000 });
    if (page.url().includes("/login")) {
      const err = await page.getByText(/invalid|required|error|exception/i).first().textContent().catch(() => "");
      test.skip(true, `Login failed: ${err || "still on login"}`);
    }
  });

  test("Command Center: Channel ROI, Channel role, Owned audience, Networking event cards visible", async ({
    page,
  }) => {
    await page.goto("/dashboard/command");
    await expect(page).toHaveURL(/\/dashboard\/command/);

    await expect(page.getByRole("heading", { name: /command center/i })).toBeVisible({ timeout: 8000 });

    await expect(page.getByText("Channel ROI", { exact: false })).toBeVisible();
    await expect(page.getByText("Channel role", { exact: false })).toBeVisible();
    await expect(page.getByText("Owned audience health", { exact: false })).toBeVisible();
    await expect(page.getByText("Networking event scoring", { exact: false })).toBeVisible();
  });

  test("Owned audience: Log snapshot and see summary", async ({ page }) => {
    await page.goto("/dashboard/command");
    await expect(page).toHaveURL(/\/dashboard\/command/);
    await expect(page.getByText("Owned audience health", { exact: false })).toBeVisible({ timeout: 8000 });

    await page.getByRole("button", { name: /log snapshot/i }).click();

    await page.getByTestId("owned-audience-subscribers").fill("150");
    await page.getByTestId("owned-audience-sends").fill("2");
    await page.getByTestId("owned-audience-replies").fill("5");
    await page.getByTestId("owned-audience-inquiries").fill("1");

    await page.getByRole("button", { name: /save snapshot/i }).click();

    await expect(page.getByText(/150 subs|sends|replies|inquiries influenced/i)).toBeVisible({ timeout: 5000 });
  });

  test("Networking event: Log event and see quality score", async ({ page }) => {
    await page.goto("/dashboard/command");
    await expect(page).toHaveURL(/\/dashboard\/command/);
    await expect(page.getByText("Networking event scoring", { exact: false })).toBeVisible({ timeout: 8000 });

    await page.getByRole("button", { name: /log event/i }).click();

    const eventName = "E2E Meetup " + Date.now();
    await page.getByTestId("networking-event-name").fill(eventName);
    await page.getByTestId("networking-event-relevance").fill("8");
    await page.getByTestId("networking-event-contacts").fill("3");
    await page.getByTestId("networking-event-followups").fill("2");
    await page.getByTestId("networking-event-opportunities").fill("1");

    await page.getByRole("button", { name: /save event/i }).click();

    await expect(page.getByText(eventName)).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/Score: \d+/)).toBeVisible();
  });

  test("Trust-to-close checklist: lead with proposal shows checklist and toggle saves", async ({
    page,
    request,
  }) => {
    await page.goto("/dashboard/leads/new");
    await expect(page.getByRole("heading", { name: /new lead/i })).toBeVisible({ timeout: 5000 });
    const leadTitle = "E2E Trust-to-close lead " + Date.now();
    await page.getByPlaceholder(/e-commerce|title/i).fill(leadTitle);
    await page.getByLabel("Source").fill("e2e");
    await page.getByRole("button", { name: /create lead/i }).click();

    await expect(page).toHaveURL(/\/dashboard\/leads\/[a-z0-9-]+/);
    const leadId = page.url().split("/leads/")[1]?.split("/")[0]?.split("?")[0];
    if (!leadId) throw new Error("No lead id in URL");

    const cookies = await page.context().cookies();
    const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join("; ");

    const artifactRes = await request.post(`http://localhost:3000/api/leads/${leadId}/artifacts`, {
      headers: { "Content-Type": "application/json", Cookie: cookieHeader },
      data: {
        type: "proposal",
        title: "PROPOSAL",
        content: "E2E test proposal body for trust-to-close checklist.",
      },
    });
    expect(artifactRes.ok()).toBe(true);

    await page.reload();
    await expect(page.getByText("Proposal review", { exact: false })).toBeVisible({ timeout: 8000 });
    await expect(page.getByText("Trust-to-close checklist", { exact: false })).toBeVisible();

    await page.getByText("Problem understood", { exact: true }).click();
    await page.waitForTimeout(600);

    await expect(page.getByText("1/5 complete")).toBeVisible({ timeout: 3000 });
  });

  test("Full flow: login → Command Center → owned-audience snapshot → networking event → lead with proposal → trust-to-close", async ({
    page,
    request,
  }) => {
    await page.goto("/dashboard/command");
    await expect(page).toHaveURL(/\/dashboard\/command/);
    await expect(page.getByText("Channel ROI", { exact: false })).toBeVisible({ timeout: 8000 });

    await page.getByRole("button", { name: /log snapshot/i }).click();
    await page.getByTestId("owned-audience-subscribers").fill("100");
    await page.getByTestId("owned-audience-sends").fill("1");
    await page.getByRole("button", { name: /save snapshot/i }).click();
    await expect(page.getByText(/100 subs|sends/i)).toBeVisible({ timeout: 5000 });

    await page.getByRole("button", { name: /log event/i }).click();
    const eventName = "E2E Full flow event " + Date.now();
    await page.getByTestId("networking-event-name").fill(eventName);
    await page.getByTestId("networking-event-relevance").fill("7");
    await page.getByTestId("networking-event-contacts").fill("2");
    await page.getByRole("button", { name: /save event/i }).click();
    await expect(page.getByText(eventName)).toBeVisible({ timeout: 5000 });

    await page.goto("/dashboard/leads/new");
    const leadTitle = "E2E Full flow lead " + Date.now();
    await page.getByPlaceholder(/e-commerce|title/i).fill(leadTitle);
    await page.getByLabel("Source").fill("e2e");
    await page.getByRole("button", { name: /create lead/i }).click();
    await expect(page).toHaveURL(/\/dashboard\/leads\/[a-z0-9-]+/);
    const leadId = page.url().split("/leads/")[1]?.split("/")[0]?.split("?")[0];
    if (!leadId) throw new Error("No lead id");

    const cookies = await page.context().cookies();
    const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join("; ");
    await request.post(`http://localhost:3000/api/leads/${leadId}/artifacts`, {
      headers: { "Content-Type": "application/json", Cookie: cookieHeader },
      data: { type: "proposal", title: "PROPOSAL", content: "Full flow proposal." },
    });

    await page.reload();
    await expect(page.getByText("Trust-to-close checklist", { exact: false })).toBeVisible({ timeout: 8000 });
    await page.getByText("Next step clear", { exact: true }).click();
    await page.waitForTimeout(500);
    await expect(page.getByText("1/5 complete")).toBeVisible({ timeout: 3000 });
  });
});
