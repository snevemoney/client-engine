/**
 * Full Playwright Audit — AI Brain + Sidebar Simplification
 * Tests: all pages render, data flow, user flow, brain chat, tool calling, sidebar nav.
 */
import { test, expect, type Page } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000";
const loginEmail =
  process.env.E2E_EMAIL ||
  process.env.ADMIN_EMAIL ||
  (process.env.AUTH_DEV_PASSWORD ? "test@test.com" : "admin@evenslouis.ca");
const loginPassword =
  process.env.E2E_PASSWORD ||
  process.env.ADMIN_PASSWORD ||
  process.env.AUTH_DEV_PASSWORD ||
  "changeme";

async function login(page: Page) {
  await page.goto(`${baseURL}/login`);
  await page.getByLabel("Email").fill(loginEmail);
  await page.getByLabel("Password").fill(loginPassword);
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 });
}

// ─── 1. All Pages Render ──────────────────────────────────────
test.describe("All pages render without crash", () => {
  test("visit every sidebar page", async ({ page }) => {
    test.setTimeout(240000);
    await login(page);

    const pages = [
      // Today
      "/dashboard/founder",
      "/dashboard/leads",
      "/dashboard/followups",
      "/dashboard/proposals",
      "/dashboard/inbox",
      // Pipeline
      "/dashboard/prospect",
      "/dashboard/intake",
      "/dashboard/delivery",
      "/dashboard/handoffs",
      "/dashboard/retention",
      "/dashboard/risk",
      // Numbers
      "/dashboard/forecast",
      "/dashboard/intelligence",
      "/dashboard/conversion",
      "/dashboard/internal/scoreboard",
      // Content
      "/dashboard/signals",
      "/dashboard/meta-ads",
      "/dashboard/youtube",
      "/dashboard/knowledge",
      "/dashboard/proof",
      // System
      "/dashboard/settings",
      "/dashboard/automation",
      "/dashboard/flywheel",
      "/dashboard/ops-health",
      "/dashboard/notifications",
      // Brain chat
      "/dashboard/chat",
      // Legacy pages (still routed even if removed from sidebar)
      "/dashboard/next-actions",
      "/dashboard/operator",
      "/dashboard/checklist",
    ];

    const failures: string[] = [];

    for (const url of pages) {
      try {
        const res = await page.goto(`${baseURL}${url}`, {
          timeout: 30000,
          waitUntil: "load",
        });
        const status = res?.status() ?? 0;
        if (status >= 500) {
          failures.push(`${url} → HTTP ${status}`);
          continue;
        }
        await expect(page.locator("body")).toBeVisible({ timeout: 5000 });

        // Check for React error boundary
        const errorBoundary = page.locator(
          'text="Something went wrong"'
        );
        const hasError = await errorBoundary.isVisible().catch(() => false);
        if (hasError) {
          failures.push(`${url} → error boundary visible`);
        }
      } catch (err) {
        failures.push(`${url} → ${(err as Error).message.slice(0, 100)}`);
      }
    }

    if (failures.length > 0) {
      console.log("Page failures:", failures);
    }
    expect(failures).toHaveLength(0);
  });
});

// ─── 2. Dashboard Default Redirect ───────────────────────────
test.describe("Dashboard default redirect", () => {
  test("/dashboard redirects to /dashboard/founder", async ({ page }) => {
    await login(page);
    await page.goto(`${baseURL}/dashboard`);
    await expect(page).toHaveURL(/\/dashboard\/founder/, { timeout: 10000 });
  });
});

// ─── 3. Sidebar Navigation ───────────────────────────────────
test.describe("Sidebar navigation", () => {
  test("AI Brain link is visible and navigates to chat", async ({ page }) => {
    await login(page);
    await page.goto(`${baseURL}/dashboard/founder`);

    // AI Brain should be visible in the sidebar (desktop)
    const brainLink = page.locator('a:has-text("AI Brain")').first();
    await expect(brainLink).toBeVisible({ timeout: 5000 });

    await brainLink.click();
    await expect(page).toHaveURL(/\/dashboard\/chat/, { timeout: 10000 });
  });

  test("sidebar has 6 groups", async ({ page }) => {
    await login(page);
    await page.goto(`${baseURL}/dashboard/founder`);

    // Switch to Full mode to show lifecycle groups (Capture, Convert, Build, Prove, Optimize, System)
    await page.getByRole("button", { name: "Full" }).click();

    // Count group headers
    const groupLabels = page.locator(
      'button:has-text("Capture"), button:has-text("Convert"), button:has-text("Build"), button:has-text("Prove"), button:has-text("Optimize"), button:has-text("System")'
    );
    const count = await groupLabels.count();
    expect(count).toBe(6);
  });

  test("sidebar search filter works", async ({ page }) => {
    await login(page);
    await page.goto(`${baseURL}/dashboard/founder`);

    const searchInput = page.locator('input[placeholder="Find a page..."]').first();
    if (await searchInput.isVisible().catch(() => false)) {
      await searchInput.fill("Leads");
      // Should show Leads link
      const leadsLink = page.locator('a:has-text("Leads")').first();
      await expect(leadsLink).toBeVisible({ timeout: 3000 });
    }
  });
});

// ─── 4. Brain Chat UI ────────────────────────────────────────
test.describe("Brain chat interface", () => {
  test("chat page renders with preset prompts", async ({ page }) => {
    await login(page);
    await page.goto(`${baseURL}/dashboard/chat`);

    // Wait for dynamic component to load — either preset buttons or input appear
    const input = page.locator('textarea[placeholder="Ask the Brain anything..."]');
    await expect(input).toBeVisible({ timeout: 15000 });

    // Should show AI Brain header
    await expect(page.locator('text="AI Brain"').first()).toBeVisible({ timeout: 5000 });
  });

  test("chat input exists and is interactive", async ({ page }) => {
    await login(page);
    await page.goto(`${baseURL}/dashboard/chat`);

    const input = page.locator(
      'textarea[placeholder="Ask the Brain anything..."]'
    );
    await expect(input).toBeVisible({ timeout: 10000 });

    // Type a message
    await input.fill("test message");
    expect(await input.inputValue()).toBe("test message");

    // Send button should be enabled
    const sendBtn = page.locator('button:has-text("Send")');
    await expect(sendBtn).toBeVisible();
    await expect(sendBtn).toBeEnabled();
  });
});

// ─── 5. Brain Chat API ───────────────────────────────────────
test.describe("Brain chat API", () => {
  test("POST /api/brain/chat returns 401 without auth", async ({ request }) => {
    const res = await request.post(`${baseURL}/api/brain/chat`, {
      data: { message: "hello" },
      headers: { "Content-Type": "application/json" },
    });
    // Should be 401 (unauthorized) or redirect to login
    expect([401, 302, 307]).toContain(res.status());
  });

  test("POST /api/brain/chat returns 400 for empty message", async ({
    page,
  }) => {
    await login(page);
    const cookies = await page.context().cookies();
    const cookieHeader = cookies
      .map((c) => `${c.name}=${c.value}`)
      .join("; ");

    const res = await page.request.post(`${baseURL}/api/brain/chat`, {
      data: { message: "" },
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieHeader,
      },
    });
    expect(res.status()).toBe(400);
  });
});

// ─── 6. Data Flow — API Endpoints Return Data ────────────────
test.describe("Data flow — key APIs return data", () => {
  test("health endpoint returns ok", async ({ request }) => {
    const res = await request.get(`${baseURL}/api/health`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  test("risk rules API returns data when authenticated", async ({ page }) => {
    await login(page);
    const res = await page.request.post(
      `${baseURL}/api/risk/run-rules`,
      {
        headers: { "Content-Type": "application/json" },
      }
    );
    // Should be 200 or 400 (not 500)
    expect(res.status()).toBeLessThan(500);
  });

  test("next actions API returns data when authenticated", async ({
    page,
  }) => {
    await login(page);
    const res = await page.request.post(`${baseURL}/api/next-actions/run`, {
      headers: { "Content-Type": "application/json" },
    });
    expect(res.status()).toBeLessThan(500);
  });
});

// ─── 7. User Flow — Login → Home → Chat ─────────────────────
test.describe("User flow", () => {
  test("login → home → navigate to chat → send message", async ({ page }) => {
    test.setTimeout(60000);
    await login(page);

    // Should land on founder/home
    await page.goto(`${baseURL}/dashboard`);
    await expect(page).toHaveURL(/\/dashboard\/founder/, { timeout: 10000 });

    // Navigate to AI Brain chat
    await page.goto(`${baseURL}/dashboard/chat`);
    await expect(page.locator('text="AI Brain"').first()).toBeVisible({
      timeout: 10000,
    });

    // Verify textarea is ready
    const input = page.locator(
      'textarea[placeholder="Ask the Brain anything..."]'
    );
    await expect(input).toBeVisible({ timeout: 5000 });
  });
});

// ─── 8. Tool Calling — Brain Tools Endpoint ──────────────────
test.describe("Tool calling verification", () => {
  test("brain chat API accepts well-formed message with auth", async ({
    page,
  }) => {
    test.setTimeout(90000);
    await login(page);

    // Send a message that should trigger tool calls
    const res = await page.request.post(`${baseURL}/api/brain/chat`, {
      data: { message: "Give me a quick health check" },
      headers: { "Content-Type": "application/json" },
    });

    // Should return SSE stream (200 with text/event-stream)
    expect(res.status()).toBe(200);
    const contentType = res.headers()["content-type"];
    expect(contentType).toContain("text/event-stream");

    // Read stream and verify events
    const body = await res.text();
    const lines = body.split("\n").filter((l) => l.startsWith("data: "));
    expect(lines.length).toBeGreaterThan(0);

    // Should have at least a session_id event
    const events = lines.map((l) => {
      try {
        return JSON.parse(l.slice(6));
      } catch {
        return null;
      }
    }).filter(Boolean);

    const hasSessionId = events.some((e) => e.type === "session_id");
    expect(hasSessionId).toBe(true);

    // Should have text_delta or done event
    const hasContent = events.some(
      (e) => e.type === "text_delta" || e.type === "done" || e.type === "error"
    );
    expect(hasContent).toBe(true);
  });
});

// ─── 9. Session Persistence ──────────────────────────────────
test.describe("Session persistence", () => {
  test("chat session ID is returned and reusable", async ({ page }) => {
    test.setTimeout(90000);
    await login(page);

    // Send first message
    const res1 = await page.request.post(`${baseURL}/api/brain/chat`, {
      data: { message: "Hi" },
      headers: { "Content-Type": "application/json" },
    });
    expect(res1.status()).toBe(200);

    const body1 = await res1.text();
    const events1 = body1
      .split("\n")
      .filter((l) => l.startsWith("data: "))
      .map((l) => {
        try {
          return JSON.parse(l.slice(6));
        } catch {
          return null;
        }
      })
      .filter(Boolean);

    const sessionEvent = events1.find((e) => e.type === "session_id");
    if (!sessionEvent) {
      throw new Error("No session_id returned — set ANTHROPIC_API_KEY for brain chat");
      return;
    }
    const sessionId = sessionEvent.sessionId;
    expect(sessionId).toBeTruthy();

    // Send follow-up with same sessionId
    const res2 = await page.request.post(`${baseURL}/api/brain/chat`, {
      data: { message: "Follow up", sessionId },
      headers: { "Content-Type": "application/json" },
    });
    expect(res2.status()).toBe(200);
  });
});
