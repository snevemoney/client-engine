import { test, expect } from "@playwright/test";
import { loginAndWaitForDashboard } from "./helpers/auth";
import { baseURL } from "./helpers/auth";

test.describe("Builder deploy flow", () => {
  test("POST deploy without auth returns 401", async ({ request }) => {
    const res = await request.post("/api/delivery-projects/cuid-placeholder/builder/deploy", {
      data: {},
    });
    expect(res.status()).toBe(401);
  });

  test("POST deploy with auth, invalid project returns 404", async ({ page, request }) => {
    const ok = await loginAndWaitForDashboard(page);
    if (!ok) {
      test.skip(true, "Login failed - check E2E credentials");
      return;
    }
    const cookies = await page.context().cookies();
    const res = await request.post(
      `${baseURL}/api/delivery-projects/nonexistent-id-12345/builder/deploy`,
      {
        data: {},
        headers: {
          Cookie: cookies.map((c) => `${c.name}=${c.value}`).join("; "),
        },
      }
    );
    expect(res.status()).toBe(404);
  });

  test("POST deploy with auth, project without builderSiteId returns 400", async ({
    page,
    request,
  }) => {
    const ok = await loginAndWaitForDashboard(page);
    if (!ok) {
      test.skip(true, "Login failed - check E2E credentials");
      return;
    }
    // Create a delivery project via API (no builder site)
    const createRes = await request.post(`${baseURL}/api/delivery-projects`, {
      data: { title: "E2E Deploy Test" },
      headers: {
        Cookie: (await page.context().cookies())
          .map((c) => `${c.name}=${c.value}`)
          .join("; "),
      },
    });
    if (createRes.status() !== 200 && createRes.status() !== 201) {
      test.skip(true, "Could not create delivery project for test");
      return;
    }
    const { id } = await createRes.json();
    const deployRes = await request.post(
      `${baseURL}/api/delivery-projects/${id}/builder/deploy`,
      {
        data: {},
        headers: {
          Cookie: (await page.context().cookies())
            .map((c) => `${c.name}=${c.value}`)
            .join("; "),
        },
      }
    );
    expect(deployRes.status()).toBe(400);
    const body = await deployRes.json();
    expect(body.error).toContain("No builder site");
  });
});
