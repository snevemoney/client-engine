/**
 * GET: return full client success data for lead (result target, baseline, interventions, outcome scorecard, risks, feedback).
 * POST: upsert one of result_target | baseline | intervention | outcome_entry | risk | feedback.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  getClientSuccessData,
  upsertResultTarget,
  upsertBaselineSnapshot,
  appendIntervention,
  appendOutcomeEntry,
  addRisk,
  resolveRisk,
  appendClientFeedback,
} from "@/lib/client-success";
import type { InterventionEntry, OutcomeEntry, RiskItem, ClientFeedbackEntry } from "@/lib/client-success/types";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  try {
    const data = await getClientSuccessData(id);
    return NextResponse.json(data);
  } catch (e) {
    console.error("[client-success GET]", e);
    return NextResponse.json({ error: "Failed to load client success data" }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: leadId } = await params;
  let body: {
    type?:
      | "result_target"
      | "baseline"
      | "intervention"
      | "outcome_entry"
      | "risk"
      | "resolve_risk"
      | "feedback";
    payload?: Record<string, unknown>;
    riskId?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON body required" }, { status: 400 });
  }

  try {
    if (body.type === "result_target" && body.payload) {
      const p = body.payload as { currentState: string; targetState: string; metric: string; timeline: string };
      if (!p.currentState || !p.targetState || !p.metric || !p.timeline) {
        return NextResponse.json({ error: "currentState, targetState, metric, timeline required" }, { status: 400 });
      }
      await upsertResultTarget(leadId, p);
      const data = await getClientSuccessData(leadId);
      return NextResponse.json(data);
    }

    if (body.type === "baseline" && body.payload) {
      const p = body.payload as { metrics: { name: string; value: string; unit?: string }[]; notes?: string };
      if (!Array.isArray(p.metrics)) {
        return NextResponse.json({ error: "metrics array required" }, { status: 400 });
      }
      await upsertBaselineSnapshot(leadId, {
        metrics: p.metrics.map((m) => ({ name: String(m.name), value: String(m.value), unit: m.unit })),
        notes: p.notes,
      });
      const data = await getClientSuccessData(leadId);
      return NextResponse.json(data);
    }

    if (body.type === "intervention" && body.payload) {
      const p = body.payload as { category: InterventionEntry["category"]; description: string; impact?: string };
      if (!p.category || !p.description) {
        return NextResponse.json({ error: "category and description required" }, { status: 400 });
      }
      await appendIntervention(leadId, p);
      const data = await getClientSuccessData(leadId);
      return NextResponse.json(data);
    }

    if (body.type === "outcome_entry" && body.payload) {
      const p = body.payload as { weekStart: string; metrics: OutcomeEntry["metrics"]; notes?: string };
      if (!p.weekStart || !Array.isArray(p.metrics)) {
        return NextResponse.json({ error: "weekStart and metrics required" }, { status: 400 });
      }
      await appendOutcomeEntry(leadId, {
        weekStart: p.weekStart,
        metrics: p.metrics.map((m) => ({
          name: String(m.name),
          value: String(m.value),
          unit: m.unit,
          delta: m.delta,
        })),
        notes: p.notes,
      });
      const data = await getClientSuccessData(leadId);
      return NextResponse.json(data);
    }

    if (body.type === "risk" && body.payload) {
      const p = body.payload as { description: string; severity?: RiskItem["severity"] };
      if (!p.description) {
        return NextResponse.json({ error: "description required" }, { status: 400 });
      }
      await addRisk(leadId, { description: p.description, severity: p.severity });
      const data = await getClientSuccessData(leadId);
      return NextResponse.json(data);
    }

    if (body.type === "resolve_risk" && typeof body.riskId === "string") {
      await resolveRisk(leadId, body.riskId);
      const data = await getClientSuccessData(leadId);
      return NextResponse.json(data);
    }

    if (body.type === "feedback" && body.payload) {
      const p = body.payload as { question?: string; response: string; themes?: string[] };
      if (!p.response) {
        return NextResponse.json({ error: "response required" }, { status: 400 });
      }
      await appendClientFeedback(leadId, {
        question: p.question,
        response: p.response,
        themes: p.themes,
      });
      const data = await getClientSuccessData(leadId);
      return NextResponse.json(data);
    }

    return NextResponse.json({ error: "Unknown type or missing payload" }, { status: 400 });
  } catch (e) {
    console.error("[client-success POST]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to save" },
      { status: 500 }
    );
  }
}
