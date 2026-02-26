/**
 * POST /api/flywheel/simulate — One-click flywheel simulation.
 * Creates a realistic lead, runs it through all 6 flywheel stages,
 * and returns a summary of each stage's outcome.
 *
 * This is for operator demonstration purposes only.
 * All money-path gates are respected (mock artifacts when AI unavailable).
 */
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { jsonError, requireAuth, withRouteTiming } from "@/lib/api-utils";

const SCENARIOS = [
  {
    name: "Marie Tremblay",
    company: "Boulangerie MTL",
    email: "marie@boulangerie-mtl.ca",
    message: "We need online ordering — losing customers to delivery apps. Budget $8k, want it in 6 weeks.",
    referralName: "Jean Beauchamp",
    referralCompany: "Café Jean",
  },
  {
    name: "Sophie Lavoie",
    company: "Salon Élégance",
    email: "sophie@salon-elegance.ca",
    message: "We need a booking system that actually works. Clients double-book constantly. Budget $5k.",
    referralName: "Émilie Gagnon",
    referralCompany: "Studio Émilie",
  },
  {
    name: "Marc Dubois",
    company: "Plomberie Dubois",
    email: "marc@plomberie-dubois.ca",
    message: "Need a system to manage service calls, invoicing, and customer follow-ups. Around $12k budget.",
    referralName: "Pierre Tremblay",
    referralCompany: "Électrique Pro",
  },
];

export async function POST() {
  return withRouteTiming("POST /api/flywheel/simulate", async () => {
    const session = await requireAuth();
    if (!session) return jsonError("Unauthorized", 401);

    const scenario = SCENARIOS[Math.floor(Math.random() * SCENARIOS.length)];
    const uniqueEmail = `sim-${Date.now()}@${scenario.company.toLowerCase().replace(/\s+/g, "-")}.demo`;
    const stages: { stage: string; status: string; detail: string }[] = [];

    try {
      // ── Stage 1: PROSPECT — Create the lead ──
      const lead = await db.lead.create({
        data: {
          title: `${scenario.company} — Inbound inquiry`,
          source: "site_form",
          description: scenario.message,
          contactName: scenario.name,
          contactEmail: uniqueEmail,
          status: "NEW",
          salesStage: "PROSPECTING",
          tags: ["flywheel-sim"],
        },
      });
      stages.push({ stage: "Prospect", status: "ok", detail: `Lead created: ${lead.title} (${lead.id})` });

      // ── Stage 2: APPROACH — Enrich + Score (mock if no AI) ──
      let enrichOk = false;
      try {
        const enrichRes = await fetch(`${process.env.NEXTAUTH_URL ?? "http://localhost:3000"}/api/enrich/${lead.id}`, {
          method: "POST",
          headers: { Cookie: `next-auth.session-token=internal-sim` },
        });
        enrichOk = enrichRes.ok;
      } catch { /* AI unavailable */ }

      if (!enrichOk) {
        await db.leadArtifact.create({
          data: {
            leadId: lead.id,
            type: "notes",
            title: "AI Enrichment Report",
            content: `Simulated enrichment: ${scenario.company} is a local service business in Montreal. ${scenario.message}`,
          },
        });
        await db.lead.update({
          where: { id: lead.id },
          data: { status: "ENRICHED", score: 72, scoreReason: "Simulated: good fit, clear budget, reasonable timeline." },
        });
      }
      stages.push({ stage: "Approach", status: "ok", detail: enrichOk ? "AI enriched + scored" : "Mock enrichment + score (AI unavailable)" });

      // ── Stage 3: PRESENT — Create proposal artifact ──
      let proposeOk = false;
      try {
        const propRes = await fetch(`${process.env.NEXTAUTH_URL ?? "http://localhost:3000"}/api/propose/${lead.id}`, {
          method: "POST",
          headers: { Cookie: `next-auth.session-token=internal-sim` },
        });
        proposeOk = propRes.ok;
      } catch { /* AI unavailable */ }

      if (!proposeOk) {
        await db.leadArtifact.create({
          data: {
            leadId: lead.id,
            type: "proposal",
            title: "PROPOSAL",
            content: `Proposal for ${scenario.company}: Safe, reversible approach. Phase 1 scoped to core needs. Timeline and budget aligned with stated constraints. No long-term lock-in.`,
          },
        });
        await db.lead.update({
          where: { id: lead.id },
          data: { status: "SCORED" },
        });
      }
      stages.push({ stage: "Present", status: "ok", detail: proposeOk ? "AI-generated proposal" : "Mock proposal (AI unavailable)" });

      // ── Stage 4: FOLLOW-UP — Log touch + set dates ──
      await db.lead.update({
        where: { id: lead.id },
        data: {
          salesStage: "FOLLOW_UP",
          lastContactAt: new Date(),
          nextContactAt: new Date(Date.now() + 3 * 86400000),
          lastTouchType: "CALL",
          followUpStage: 1,
          touchCount: { increment: 1 },
        },
      });
      await db.leadTouch.create({
        data: {
          leadId: lead.id,
          type: "CALL",
          direction: "outbound",
          summary: `Called ${scenario.name}. Reviewed proposal together. Positive reception. Will follow up in 3 days.`,
          outcome: "positive",
          nextTouchAt: new Date(Date.now() + 3 * 86400000),
        },
      });
      stages.push({ stage: "Follow-up", status: "ok", detail: "Touch logged, next contact set +3d" });

      // ── Stage 5: REFERRAL — Win deal + ask for referral ──
      await db.lead.update({
        where: { id: lead.id },
        data: {
          dealOutcome: "won",
          salesStage: "REFERRAL",
          referralAskStatus: "asked",
          referralAskAt: new Date(),
          relationshipStatus: "active",
        },
      });
      const referral = await db.leadReferral.create({
        data: {
          leadId: lead.id,
          referredName: scenario.referralName,
          referredCompany: scenario.referralCompany,
          status: "received",
        },
      });
      stages.push({ stage: "Referral", status: "ok", detail: `Deal won. Referral received: ${referral.referredName}` });

      // ── Stage 6: RETENTION — Delivery project + check-in ──
      const project = await db.deliveryProject.create({
        data: {
          title: `${scenario.company} — Delivery`,
          pipelineLeadId: lead.id,
          clientName: scenario.name,
          company: scenario.company,
          summary: `Delivering on proposal for ${scenario.company}.`,
          status: "in_progress",
          startDate: new Date(),
          dueDate: new Date(Date.now() + 42 * 86400000),
        },
      });

      await db.lead.update({
        where: { id: lead.id },
        data: { salesStage: "RELATIONSHIP_MAINTENANCE" },
      });

      stages.push({
        stage: "Retention",
        status: "ok",
        detail: `Delivery project created: ${project.title} (${project.id}). Sales stage: RELATIONSHIP_MAINTENANCE`,
      });

      return NextResponse.json({
        success: true,
        leadId: lead.id,
        deliveryProjectId: project.id,
        stages,
      });
    } catch (err) {
      return NextResponse.json(
        {
          success: false,
          stages,
          error: err instanceof Error ? err.message : "Simulation failed",
        },
        { status: 500 }
      );
    }
  });
}
