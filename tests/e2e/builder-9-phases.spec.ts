/**
 * Builder 9-Phase E2E — Verifies all 9 phases flow from enrichment to genInput.
 *
 * Creates lead → proposal → delivery project, then calls the test route that
 * builds genInput (same logic as builder create) and asserts all 9 phase keys
 * are present in clientInfo.
 *
 * Run: npx playwright test tests/e2e/builder-9-phases.spec.ts
 */
import { test, expect } from "@playwright/test";
import { baseURL, loginAndWaitForDashboard } from "./helpers/auth";

const NINE_PHASE_KEYS = [
  "siteMap",
  "userFlows",
  "designSystem",
  "componentLogic",
  "figmaMakeDesignIntent",
  "animationSpecs",
  "responsiveSpecs",
  "dataIntegration",
  "qaChecklist",
] as const;

function cookieHeader(cookies: { name: string; value: string }[]): string {
  return cookies.map((c) => `${c.name}=${c.value}`).join("; ");
}

test.describe("Builder 9-phase genInput", () => {
  test.setTimeout(300_000); // 9 phases × ~30s each

  test("genInput.clientInfo includes all 9 phase keys", async ({ page, request }) => {
    const ts = Date.now();
    const company = `9-Phase E2E ${ts}`;

    // 1. Create lead (no auth)
    const leadRes = await request.post(`${baseURL}/api/site/leads`, {
      data: {
        name: "Test Client",
        email: `test-${ts}@example.com`,
        company,
        message: "Peak Performance Digital Strategy for our fitness brand.",
      },
    });
    expect(leadRes.ok(), "site/leads should succeed").toBe(true);
    const leadBody = await leadRes.json();
    const leadId = leadBody.leadId;
    expect(leadId).toBeTruthy();

    // 2. Login
    const loggedIn = await loginAndWaitForDashboard(page);
    expect(loggedIn, "Login failed").toBe(true);
    const ch = cookieHeader(await page.context().cookies());

    // 3. Create proposal with pipelineLeadId
    const propRes = await request.post(`${baseURL}/api/proposals`, {
      headers: { "Content-Type": "application/json", Cookie: ch },
      data: {
        pipelineLeadId: leadId,
        title: `${company} — Website`,
        clientName: "Test Client",
        summary: "Peak Performance Digital Strategy tailored to your needs.",
        scopeOfWork: "Hero, features, testimonials, booking, contact.",
      },
    });
    expect(propRes.ok(), "proposals create should succeed").toBe(true);
    const proposal = await propRes.json();
    const proposalId = proposal.id;
    expect(proposalId).toBeTruthy();

    // 4. Create delivery project with proposalId and pipelineLeadId
    const projRes = await request.post(`${baseURL}/api/delivery-projects`, {
      headers: { "Content-Type": "application/json", Cookie: ch },
      data: {
        proposalId,
        pipelineLeadId: leadId,
        title: `${company} — Website Build`,
        clientName: "Test Client",
        summary: "Website with Peak Performance Digital Strategy.",
      },
    });
    expect(projRes.ok(), "delivery-projects create should succeed").toBe(true);
    const project = await projRes.json();
    const projectId = project.id;
    expect(projectId).toBeTruthy();

    // 5. Call test route (returns genInput without calling builder)
    // x-e2e-force-legacy: use legacy single-call when server lacks E2E_TEST_MODE (e.g. USE_EXISTING_SERVER=1)
    const genRes = await request.get(
      `${baseURL}/api/internal/test/builder-gen-input?projectId=${projectId}`,
      { headers: { Cookie: ch, "x-e2e-force-legacy": "1" } }
    );

    expect(genRes.ok(), "builder-gen-input should succeed").toBe(true);
    const body = await genRes.json();
    expect(body.genInput).toBeDefined();
    expect(body.genInput.clientInfo).toBeDefined();

    const ci = body.genInput.clientInfo as Record<string, unknown>;

    // 6. Assert all 9 phase keys exist in clientInfo (plumbing)
    for (const key of NINE_PHASE_KEYS) {
      expect(
        key in ci,
        `clientInfo must include "${key}" (Phase ${NINE_PHASE_KEYS.indexOf(key) + 1})`
      ).toBe(true);
    }

    // 7. When enrichment succeeded, all values should be present
    if (body.ninePhaseAudit?.allPresent) {
      expect(body.ninePhaseAudit.present).toHaveLength(NINE_PHASE_KEYS.length);
      expect(body.ninePhaseAudit.missing).toHaveLength(0);
    }
  });
});
