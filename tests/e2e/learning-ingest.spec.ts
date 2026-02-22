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
const email = (process.env.E2E_EMAIL || "test@test.com").trim().toLowerCase();
const password = (process.env.E2E_PASSWORD || process.env.AUTH_DEV_PASSWORD || "changeme").trim();

test.describe("Learning ingest", () => {
  test("ingest video then channel", async ({ page }) => {
    const base = baseURL.replace(/\/$/, "");
    await page.goto(`${base}/login`);
    await expect(page.getByLabel("Email")).toBeVisible({ timeout: 10000 });
    // Login via in-page fetch so session cookie is set in the same origin (page context)
    const loginResult = await page.evaluate(
      async ({
        baseUrl,
        email: e,
        password: p,
      }: {
        baseUrl: string;
        email: string;
        password: string;
      }) => {
        const csrfRes = await fetch(`${baseUrl}/api/auth/csrf`);
        const { csrfToken } = (await csrfRes.json()) as { csrfToken: string };
        const res = await fetch(`${baseUrl}/api/auth/callback/credentials`, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ csrfToken, email: e, password: p }),
          credentials: "include",
        });
        const text = await res.text();
        return { status: res.status, ok: res.ok, body: text.slice(0, 300), url: res.url };
      },
      { baseUrl: base, email, password }
    );
    if (loginResult.status !== 302 && !loginResult.ok) {
      test.skip(true, `Login fetch failed: ${loginResult.status} ${loginResult.body}`);
      return;
    }
    console.log("Login fetch result:", JSON.stringify(loginResult));
    await page.goto(`${base}/dashboard`);
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 });

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
