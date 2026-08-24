import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

/**
 * RULE 1.1: Auto-Lead Route
 * 
 * Automatically routes incoming leads through the sales pipeline:
 * Scout (discovery) → Ocelot (qualification) → Business (outreach)
 * 
 * Trigger: New lead created in CRM (via webhook)
 * Actions:
 *   1. Assign lead to Scout for lead quality scoring
 *   2. If score >= 70 (MQL), assign to Ocelot for BANT qualification
 *   3. If BANT pass, assign to Business for outreach email
 * 
 * Success metric: Leads move through pipeline within 15 minutes
 */

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { leadId, name, email, source } = body;

    if (!leadId || !email) {
      return NextResponse.json(
        { error: "Missing leadId or email" },
        { status: 400 }
      );
    }

    // Step 1: Assign to Scout for initial scoring
    const scoutAssignment = await assignToAgent({
      agentId: "scout",
      leadId,
      name,
      email,
      source,
      task: "Score lead quality (0-100). MQL threshold: 70+",
    });

    if (!scoutAssignment.success) {
      return NextResponse.json(
        { error: "Failed to assign to Scout", details: scoutAssignment },
        { status: 500 }
      );
    }

    // Step 2: If Scout score >= 70, assign to Ocelot for BANT qualification
    // (This would be async - returned in webhook response)
    const qualificationWorkflow = {
      trigger: "scout_score_received",
      condition: "score >= 70",
      nextAgent: "ocelot",
      task: "Run BANT qualification (Budget, Authority, Need, Timeline)",
    };

    // Step 3: If BANT pass, assign to Business for outreach
    const outreachWorkflow = {
      trigger: "bant_passed",
      nextAgent: "business",
      task: "Send personalized outreach email",
    };

    return NextResponse.json({
      success: true,
      message: "Lead routing initiated",
      leadId,
      workflow: [scoutAssignment, qualificationWorkflow, outreachWorkflow],
      eta_minutes: 15,
    });
  } catch (error) {
    console.error("[Rule 1.1] Error:", error);
    return NextResponse.json(
      { error: "Internal server error", details: String(error) },
      { status: 500 }
    );
  }
}

/**
 * Helper: Assign lead to agent
 */
async function assignToAgent({
  agentId,
  leadId,
  name,
  email,
  source,
  task,
}: {
  agentId: string;
  leadId: string;
  name: string;
  email: string;
  source: string;
  task: string;
}): Promise<{ success: boolean; agentId: string; leadId: string; assigned_at: string }> {
  // TODO: Implement agent assignment via sessions_send or webhook
  // For now, return mock success
  return {
    success: true,
    agentId,
    leadId,
    assigned_at: new Date().toISOString(),
  };
}
