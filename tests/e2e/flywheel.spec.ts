/**
 * Sales Flywheel E2E — simulates a full client lifecycle through the real system:
 *
 *   1. PROSPECT   — A "client" fills out the public website contact form
 *   2. APPROACH    — Operator logs in, verifies the lead exists, triggers pipeline (enrich/score/position/propose)
 *   3. PRESENT     — Operator verifies proposal was drafted
 *   4. FOLLOW-UP   — Operator logs a follow-up touch
 *   5. REFERRAL    — After winning the deal, operator asks for and records a referral
 *   6. RETENTION   — Operator creates a delivery project, schedules a retention check-in, logs a call
 *
 * Run:  npx playwright test tests/e2e/flywheel.spec.ts
 * Or:   USE_EXISTING_SERVER=1 npx playwright test tests/e2e/flywheel.spec.ts
 */

import { test, expect } from "@playwright/test";
import {
  baseURL,
  loginAndWaitForDashboard,
} from "./helpers/auth";

const SCENARIO = {
  name: "Marie Tremblay",
  email: `flywheel-${Date.now()}@boulangerie-mtl.ca`,
  company: "Boulangerie MTL",
  website: "https://boulangerie-mtl.ca",
  message:
    "We need online ordering — losing customers to competitors with delivery apps. Budget around $8k, want it in 6 weeks.",
};

function cookieHeader(cookies: { name: string; value: string }[]): string {
  return cookies.map((c) => `${c.name}=${c.value}`).join("; ");
}

test.describe("Sales Flywheel: full client lifecycle", () => {
  test.setTimeout(120_000);

  let leadId: string;
  let deliveryProjectId: string;
  let cookies: { name: string; value: string }[];

  // ── Stage 1: PROSPECT ─────────────────────────────────────────────────
  test("1 → Prospect: client fills the public contact form", async ({
    request,
  }) => {
    const res = await request.post(`${baseURL}/api/site/leads`, {
      data: {
        name: SCENARIO.name,
        email: SCENARIO.email,
        company: SCENARIO.company,
        website: SCENARIO.website,
        message: SCENARIO.message,
      },
    });
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.leadId).toBeTruthy();
    leadId = body.leadId;
  });

  // ── Stage 2: APPROACH ─────────────────────────────────────────────────
  test("2 → Approach: operator sees the lead and triggers the pipeline", async ({
    page,
    request,
  }) => {
    test.skip(!leadId, "Stage 1 did not produce a leadId");

    const loggedIn = await loginAndWaitForDashboard(page);
    test.skip(!loggedIn, "Login failed — set E2E_EMAIL / E2E_PASSWORD");

    cookies = await page.context().cookies();
    const ch = cookieHeader(cookies);

    // Verify lead exists via API
    const leadRes = await request.get(`${baseURL}/api/leads/${leadId}`, {
      headers: { Cookie: ch },
    });
    expect(leadRes.ok()).toBe(true);
    const lead = await leadRes.json();
    expect(lead.title).toContain(SCENARIO.company);
    expect(lead.contactEmail).toBe(SCENARIO.email);

    // Trigger the pipeline manually (enrich → score → position → propose)
    const pipeRes = await request.post(
      `${baseURL}/api/pipeline/run?leadId=${leadId}`,
      { headers: { Cookie: ch } }
    );
    const pipeBody = await pipeRes.json();

    // Pipeline may skip if OpenAI key is missing — that's OK in CI/local
    if (pipeBody.run === false && pipeBody.reason === "openai_not_configured") {
      console.log(
        "Pipeline skipped (no OPENAI_API_KEY). Creating mock artifacts for remaining stages."
      );
      // Create mock enrichment artifact so later stages have something to verify
      await request.post(`${baseURL}/api/leads/${leadId}/artifacts`, {
        headers: { "Content-Type": "application/json", Cookie: ch },
        data: {
          type: "notes",
          title: "AI Enrichment Report",
          content:
            "Mock enrichment: Bakery in Montreal, needs online ordering, $8k budget.",
        },
      });
      // Create mock proposal artifact
      await request.post(`${baseURL}/api/leads/${leadId}/artifacts`, {
        headers: { "Content-Type": "application/json", Cookie: ch },
        data: {
          type: "proposal",
          title: "PROPOSAL",
          content: `Proposal for ${SCENARIO.company}: Online ordering system with delivery integration. Phase 1: Menu + cart ($4k). Phase 2: Delivery ($4k). Timeline: 6 weeks.`,
        },
      });
    } else {
      expect(pipeRes.ok()).toBe(true);
    }

    // Verify enrichment artifact exists
    const artifactsRes = await request.get(
      `${baseURL}/api/leads/${leadId}/artifacts`,
      { headers: { Cookie: ch } }
    );
    expect(artifactsRes.ok()).toBe(true);
    const artifacts: { type: string; title: string }[] =
      await artifactsRes.json();
    const hasEnrichment = artifacts.some(
      (a) => a.type === "notes" && a.title === "AI Enrichment Report"
    );
    expect(hasEnrichment).toBe(true);
  });

  // ── Stage 3: PRESENT ──────────────────────────────────────────────────
  test("3 → Present: operator verifies the proposal draft", async ({
    page,
  }) => {
    test.skip(!leadId, "Stage 1 did not produce a leadId");
    test.skip(!cookies, "Stage 2 did not authenticate");

    const loggedIn = await loginAndWaitForDashboard(page);
    test.skip(!loggedIn, "Login failed");

    await page.goto(`${baseURL}/dashboard/leads/${leadId}`);
    await expect(
      page.getByRole("heading", { name: new RegExp(SCENARIO.company, "i") })
    ).toBeVisible({ timeout: 10_000 });

    // Switch to Proposals tab and verify proposal section
    await page.getByRole("button", { name: /proposals/i }).click();
    await expect(
      page.getByRole("heading", { name: /proposal review/i })
    ).toBeVisible({ timeout: 8_000 });
  });

  // ── Stage 4: FOLLOW-UP ────────────────────────────────────────────────
  test("4 → Follow-up: operator logs a follow-up touch on the lead", async ({
    page,
    request,
  }) => {
    test.skip(!leadId, "Stage 1 did not produce a leadId");
    test.skip(!cookies, "Stage 2 did not authenticate");

    const loggedIn = await loginAndWaitForDashboard(page);
    test.skip(!loggedIn, "Login failed");
    const ch = cookieHeader(await page.context().cookies());

    // Update the lead with follow-up tracking info
    const patchRes = await request.patch(`${baseURL}/api/leads/${leadId}`, {
      headers: { "Content-Type": "application/json", Cookie: ch },
      data: {
        nextContactAt: new Date(
          Date.now() + 3 * 24 * 60 * 60 * 1000
        ).toISOString(),
        lastContactAt: new Date().toISOString(),
        followUpCount: 1,
        followUpStage: 1,
        lastTouchType: "CALL",
        permissionToFollowUp: true,
      },
    });
    expect(patchRes.ok()).toBe(true);

    // Log a follow-up note as an artifact
    const noteRes = await request.post(
      `${baseURL}/api/leads/${leadId}/artifacts`,
      {
        headers: { "Content-Type": "application/json", Cookie: ch },
        data: {
          type: "notes",
          title: "Follow-up call #1",
          content:
            "Called Marie. She is reviewing the proposal with her husband. Will call back Thursday. Interested in Phase 1 first.",
        },
      }
    );
    expect(noteRes.ok()).toBe(true);

    // Verify on the lead page (artifacts tab)
    await page.goto(`${baseURL}/dashboard/leads/${leadId}`);
    await page.getByRole("button", { name: /artifacts/i }).click();
    await expect(page.getByText("Follow-up call #1")).toBeVisible({
      timeout: 8_000,
    });
  });

  // ── Stage 5: REFERRAL ─────────────────────────────────────────────────
  test("5 → Referral: win the deal, ask for referral, record referral", async ({
    page,
    request,
  }) => {
    test.skip(!leadId, "Stage 1 did not produce a leadId");
    test.skip(!cookies, "Stage 2 did not authenticate");

    const loggedIn = await loginAndWaitForDashboard(page);
    test.skip(!loggedIn, "Login failed");
    const ch = cookieHeader(await page.context().cookies());

    // Mark the deal as WON
    const outcomeRes = await request.post(
      `${baseURL}/api/leads/${leadId}/deal-outcome`,
      {
        headers: { "Content-Type": "application/json", Cookie: ch },
        data: { outcome: "won" },
      }
    );
    expect(outcomeRes.ok()).toBe(true);
    const updated = await outcomeRes.json();
    expect(updated.dealOutcome).toBe("won");

    // Mark referral ask status
    const askRes = await request.patch(`${baseURL}/api/leads/${leadId}`, {
      headers: { "Content-Type": "application/json", Cookie: ch },
      data: {
        referralAskStatus: "asked",
        relationshipStatus: "active",
      },
    });
    expect(askRes.ok()).toBe(true);

    // Record a referral from this client
    const refRes = await request.post(
      `${baseURL}/api/leads/${leadId}/referrals`,
      {
        headers: { "Content-Type": "application/json", Cookie: ch },
        data: {
          referredName: "Jean Beauchamp",
          referredCompany: "Café Jean",
          referredContact: "jean@cafejean.ca",
          referralQuality: 4,
          notes:
            "Marie's neighbor, owns a café, also needs online ordering.",
        },
      }
    );
    expect(refRes.ok()).toBe(true);
    const referral = await refRes.json();
    expect(referral.referredName).toBe("Jean Beauchamp");

    // Verify referral shows on the lead
    const leadRes = await request.get(`${baseURL}/api/leads/${leadId}`, {
      headers: { Cookie: ch },
    });
    const lead = await leadRes.json();
    expect(lead.dealOutcome).toBe("won");
    expect(lead.referralAskStatus).toBe("asked");
    expect(lead.referralsReceived.length).toBeGreaterThanOrEqual(1);
  });

  // ── Stage 6: RETENTION ────────────────────────────────────────────────
  test("6 → Retention: create delivery project, schedule check-in, log call", async ({
    page,
    request,
  }) => {
    test.skip(!leadId, "Stage 1 did not produce a leadId");
    test.skip(!cookies, "Stage 2 did not authenticate");

    const loggedIn = await loginAndWaitForDashboard(page);
    test.skip(!loggedIn, "Login failed");
    const ch = cookieHeader(await page.context().cookies());

    // Create a delivery project linked to this lead
    const projRes = await request.post(`${baseURL}/api/delivery-projects`, {
      headers: { "Content-Type": "application/json", Cookie: ch },
      data: {
        title: `${SCENARIO.company} — Online Ordering`,
        pipelineLeadId: leadId,
        clientName: SCENARIO.name,
        company: SCENARIO.company,
        summary: "Phase 1: Menu + cart. Phase 2: Delivery integration.",
        startDate: new Date().toISOString(),
        dueDate: new Date(
          Date.now() + 42 * 24 * 60 * 60 * 1000
        ).toISOString(),
      },
    });
    expect(projRes.ok()).toBe(true);
    const project = await projRes.json();
    deliveryProjectId = project.id;
    expect(project.title).toContain(SCENARIO.company);

    // Schedule a 30-day retention check-in
    const schedRes = await request.post(
      `${baseURL}/api/delivery-projects/${deliveryProjectId}/retention/schedule`,
      {
        headers: { "Content-Type": "application/json", Cookie: ch },
        data: {
          nextFollowUpAt: new Date(
            Date.now() + 30 * 24 * 60 * 60 * 1000
          ).toISOString(),
          note: "30-day check-in: How is online ordering going?",
        },
      }
    );
    expect(schedRes.ok()).toBe(true);
    const sched = await schedRes.json();
    expect(sched.retentionNextFollowUpAt).toBeTruthy();

    // Log a retention call
    const callRes = await request.post(
      `${baseURL}/api/delivery-projects/${deliveryProjectId}/retention/log-call`,
      {
        headers: { "Content-Type": "application/json", Cookie: ch },
        data: {
          note: "Marie happy with Phase 1. Wants to start Phase 2 next month. Mentioned her cousin also needs a site.",
        },
      }
    );
    expect(callRes.ok()).toBe(true);
    const call = await callRes.json();
    expect(call.retentionFollowUpCount).toBe(1);

    // Request a referral on the delivery project
    const refReqRes = await request.post(
      `${baseURL}/api/delivery-projects/${deliveryProjectId}/referral/request`,
      {
        headers: { "Content-Type": "application/json", Cookie: ch },
      }
    );
    expect(refReqRes.ok()).toBe(true);
    const refReq = await refReqRes.json();
    expect(refReq.referralStatus).toBe("requested");

    // Verify the delivery project appears on the Delivery page
    await page.goto(`${baseURL}/dashboard/delivery`);
    await expect(
      page.getByText(SCENARIO.company).first()
    ).toBeVisible({ timeout: 10_000 });
  });
});
