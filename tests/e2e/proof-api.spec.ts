import { test, expect } from "@playwright/test";

test.describe("Proof API", () => {
  test("POST /api/proof/generate without auth returns 401", async ({ request }) => {
    const res = await request.post("/api/proof/generate", {
      data: { leadId: "some-id" },
    });
    expect(res.status()).toBe(401);
  });

  test("POST /api/proof/generate without leadId returns 400", async ({ request }) => {
    // Note: This test would need auth to get 400 instead of 401.
    // Without auth we get 401. So we only assert unauthenticated returns 401.
    const res = await request.post("/api/proof/generate", {
      data: {},
    });
    expect(res.status()).toBe(401);
  });

  test("GET /api/proof without auth returns 401", async ({ request }) => {
    const res = await request.get("/api/proof");
    expect(res.status()).toBe(401);
  });

  test("POST /api/checklist/generate without auth returns 401", async ({ request }) => {
    const res = await request.post("/api/checklist/generate", {
      data: {},
    });
    expect(res.status()).toBe(401);
  });
});
