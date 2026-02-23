/**
 * Learning ingest: video and channel.
 *
 * Local (dev server + AUTH_DEV_PASSWORD in .env):
 *   USE_EXISTING_SERVER=1 AUTH_DEV_PASSWORD=changeme npm run test:e2e tests/e2e/learning-ingest.spec.ts
 *
 * Prod (set credentials so login succeeds):
 *   USE_EXISTING_SERVER=1 PLAYWRIGHT_BASE_URL=https://evenslouis.ca E2E_EMAIL=you@example.com E2E_PASSWORD=yourpassword npm run test:e2e tests/e2e/learning-ingest.spec.ts
 *
 * Or test manually: Dashboard → Learning, paste video URL → Ingest; then paste channel URL, set Channel → Ingest.
 */
import { test, expect } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000";
const email = process.env.E2E_EMAIL || "test@test.com";
const password = process.env.E2E_PASSWORD || process.env.AUTH_DEV_PASSWORD || "changeme";

test.describe("Learning ingest", () => {
  test("ingest video then channel", async ({ page }) => {
    await page.goto(`${baseURL}/login`);
    await expect(page.getByLabel("Email")).toBeVisible({ timeout: 10000 });
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForURL(/\/(dashboard|login)/, { timeout: 20000 });
    if (page.url().includes("/login")) {
      test.skip(true, "Login failed. Local: set AUTH_DEV_PASSWORD in .env. Prod: set E2E_EMAIL and E2E_PASSWORD in .env.");
      return;
    }
    await expect(page).toHaveURL(/\/dashboard/);

    await page.goto(`${baseURL}/dashboard/learning`);
    await expect(page).toHaveURL(/\/dashboard\/learning/);

    const urlInput = page.getByTestId("learning-url-input").or(page.getByPlaceholder(/youtube\.com\/watch/));
    const ingestBtn = page.getByTestId("learning-ingest-button").or(page.getByRole("button", { name: /^Ingest$/ }));

    await urlInput.fill("https://www.youtube.com/watch?v=4htG6bk0aEc&t=466s");
    await ingestBtn.click();
    await expect(
      page.locator("p.text-amber-400, p.text-neutral-400").filter({ hasText: /Ingested|error|failed|unavailable|disabled/i })
    ).toBeVisible({ timeout: 120000 });

    const resultEl = page.locator("p.text-amber-400, p.text-neutral-400").filter({ hasText: /Ingested|error|failed|unavailable|disabled/i }).first();
    await expect(resultEl).toBeVisible({ timeout: 5000 });
    const videoResult = await resultEl.textContent();
    expect(videoResult).toBeTruthy();
    const videoOk = !/error|disabled|unavailable|failed/i.test(videoResult ?? "");
    expect(videoOk, `Video ingest should succeed or show clear message. Got: ${videoResult}`).toBe(true);

    await urlInput.fill("https://www.youtube.com/@VALUETAINMENT");
    await expect(ingestBtn).toBeEnabled({ timeout: 30000 });
    await page.locator("select").filter({ has: page.locator('option[value="channel"]') }).selectOption("channel");
    await ingestBtn.click();
    await expect(
      page.locator("p.text-amber-400, p.text-neutral-400").filter({ hasText: /Ingested|error|failed|channel|not configured/i })
    ).toBeVisible({ timeout: 180000 });

    const resultEl2 = page.locator("p.text-amber-400, p.text-neutral-400").filter({ hasText: /Ingested|error|failed|channel|not configured/i }).first();
    await expect(resultEl2).toBeVisible({ timeout: 5000 });
    const channelResult = await resultEl2.textContent();
    expect(channelResult).toBeTruthy();
    const channelOk = !/error|not configured|failed/i.test(channelResult ?? "");
    expect(channelOk, `Channel ingest should succeed or show clear message. Got: ${channelResult}`).toBe(true);
  });
});
