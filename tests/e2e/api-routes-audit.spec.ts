/**
 * API routes audit: hit every API endpoint to ensure no 500s.
 * Tests all 340+ route files × methods (~500–900 endpoint combinations).
 *
 * Run: USE_EXISTING_SERVER=1 PLAYWRIGHT_BASE_URL=https://evenslouis.ca npx playwright test tests/e2e/api-routes-audit.spec.ts
 * Or local: npm run dev && USE_EXISTING_SERVER=1 npx playwright test tests/e2e/api-routes-audit.spec.ts
 *
 * The "no auth" test is the primary one — fast, no credentials needed, proves endpoints don't crash.
 * The "with auth" test requires E2E_EMAIL/E2E_PASSWORD and may timeout on heavy routes (knowledge, copilot, etc).
 */
import { test, expect } from "@playwright/test";
import { readFileSync } from "fs";
import { join } from "path";

const baseURL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000";
const url = baseURL.replace(/\/$/, "");

// Routes that may return 503 when service not configured (e.g. Meta Ads cron)
const ALLOW_503_PATHS = ["/api/meta-ads/scheduler/run-cron", "/api/meta-ads/scheduler/run"];

// Placeholder IDs for dynamic segments (valid format, may 404)
const PLACEHOLDERS: Record<string, string> = {
  "[id]": "cmlvq7e5z0000v5nwmoijvi5z",
  "[leadId]": "cmlvq7e5z0000v5nwmoijvi5z",
  "[provider]": "resend",
  "[milestoneId]": "cmlvq7e5z0000v5nwmoijvi5z",
  "[requestId]": "req_placeholder_001",
  "[referralId]": "cmlvq7e5z0000v5nwmoijvi5z",
  "[artifactId]": "cmlvq7e5z0000v5nwmoijvi5z",
  "[slug]": "test",
};

function substitutePath(path: string): string {
  let result = path;
  for (const [key, value] of Object.entries(PLACEHOLDERS)) {
    result = result.replace(new RegExp(key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"), value);
  }
  return result;
}

function parseApiRoutes(): { path: string; methods: string[] }[] {
  const mdPath = join(process.cwd(), "docs", "generated", "api-routes.md");
  const content = readFileSync(mdPath, "utf-8");
  const routes: { path: string; methods: string[] }[] = [];
  const lineRe = /^\|\s*`(\/api\/[^`]+)`\s*\|\s*([^|]*)\s*\|/;
  for (const line of content.split("\n")) {
    const m = line.match(lineRe);
    if (!m) continue;
    const path = m[1];
    const methodsStr = m[2].trim();
    if (path.includes("[...nextauth]")) continue; // Skip NextAuth
    const methods: string[] = [];
    if (/GET/i.test(methodsStr)) methods.push("GET");
    if (/POST/i.test(methodsStr)) methods.push("POST");
    if (/PATCH/i.test(methodsStr)) methods.push("PATCH");
    if (/PUT/i.test(methodsStr)) methods.push("PUT");
    if (/DELETE/i.test(methodsStr)) methods.push("DELETE");
    if (methods.length === 0) methods.push("GET"); // fallback
    routes.push({ path, methods });
  }
  return routes;
}

const routes = parseApiRoutes();

test.describe("API routes audit (no auth)", () => {
  test("all API endpoints return non-500 (401/200/400/404)", async ({ request }) => {
    test.setTimeout(300_000); // 5 min for 500+ requests
    const results: { path: string; method: string; status: number; ok: boolean }[] = [];
    const failures: string[] = [];

    for (const { path, methods } of routes) {
      const resolvedPath = substitutePath(path);
      const fullUrl = `${url}${resolvedPath}`;
      for (const method of methods) {
        try {
          const reqOpts = { timeout: 15_000, data: {} as object };
          let res: Awaited<ReturnType<typeof request.get>>;
          if (method === "GET") res = await request.get(fullUrl, { timeout: 15_000 });
          else if (method === "POST") res = await request.post(fullUrl, reqOpts);
          else if (method === "PATCH") res = await request.patch(fullUrl, reqOpts);
          else if (method === "PUT") res = await request.put(fullUrl, reqOpts);
          else if (method === "DELETE") res = await request.delete(fullUrl, { timeout: 15_000 });
          else res = await request.get(fullUrl, { timeout: 15_000 });
          const status = res.status();
          results.push({ path: resolvedPath, method, status, ok: status >= 200 && status < 300 });
          if (res.status() >= 500 && !(res.status() === 503 && ALLOW_503_PATHS.some((p) => resolvedPath.startsWith(p)))) {
            failures.push(`${method} ${resolvedPath} → ${res.status()}`);
          }
        } catch (e) {
          const err = e as Error;
          failures.push(`${method} ${resolvedPath} → error: ${err.message}`);
        }
      }
    }

    const total = results.length;
    const statusCounts = results.reduce(
      (acc, r) => {
        acc[r.status] = (acc[r.status] || 0) + 1;
        return acc;
      },
      {} as Record<number, number>
    );

    console.log(`\nAPI routes audit: ${total} requests`);
    console.log("Status distribution:", JSON.stringify(statusCounts, null, 2));
    if (failures.length > 0) {
      console.log("Failures (500 or error):", failures.slice(0, 30));
      if (failures.length > 30) console.log(`... and ${failures.length - 30} more`);
    }

    expect(failures, `Endpoints returning 500 or error: ${failures.join("; ")}`).toHaveLength(0);
  });
});

test.describe("API routes audit (with auth)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${baseURL}/login`, { waitUntil: "load", timeout: 15000 });
    const email = process.env.E2E_EMAIL || process.env.ADMIN_EMAIL || "admin@evenslouis.ca";
    const password = process.env.E2E_PASSWORD || process.env.ADMIN_PASSWORD || "changeme";
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForURL(/\/dashboard/, { timeout: 12000 });
  });

  test("all API endpoints return non-500 when authenticated", async ({ page }) => {
    test.setTimeout(300_000); // 5 min for 500+ requests
    if (page.url().includes("/login")) {
      test.skip(true, "Login failed — set E2E_EMAIL and E2E_PASSWORD for auth audit");
      return;
    }
    const results: { path: string; method: string; status: number }[] = [];
    const failures: string[] = [];

    for (const { path, methods } of routes) {
      const resolvedPath = substitutePath(path);
      const fullUrl = `${url}${resolvedPath}`;
      for (const method of methods) {
        try {
          const reqOpts = { timeout: 15_000, data: {} as object };
          let res: Awaited<ReturnType<typeof page.request.get>>;
          if (method === "GET") res = await page.request.get(fullUrl, { timeout: 15_000 });
          else if (method === "POST") res = await page.request.post(fullUrl, reqOpts);
          else if (method === "PATCH") res = await page.request.patch(fullUrl, reqOpts);
          else if (method === "PUT") res = await page.request.put(fullUrl, reqOpts);
          else if (method === "DELETE") res = await page.request.delete(fullUrl, { timeout: 15_000 });
          else res = await page.request.get(fullUrl, { timeout: 15_000 });
          results.push({ path: resolvedPath, method, status: res.status() });
          if (res.status() >= 500 && !(res.status() === 503 && ALLOW_503_PATHS.some((p) => resolvedPath.startsWith(p)))) {
            failures.push(`${method} ${resolvedPath} → ${res.status()}`);
          }
        } catch (e) {
          const err = e as Error;
          failures.push(`${method} ${resolvedPath} → error: ${err.message}`);
        }
      }
    }

    const total = results.length;
    const statusCounts = results.reduce(
      (acc, r) => {
        acc[r.status] = (acc[r.status] || 0) + 1;
        return acc;
      },
      {} as Record<number, number>
    );

    console.log(`\nAPI routes audit (auth): ${total} requests`);
    console.log("Status distribution:", JSON.stringify(statusCounts, null, 2));
    if (failures.length > 0) {
      console.log("Failures (500 or error):", failures.slice(0, 30));
      if (failures.length > 30) console.log(`... and ${failures.length - 30} more`);
    }

    expect(failures, `Endpoints returning 500 or error: ${failures.join("; ")}`).toHaveLength(0);
  });
});
