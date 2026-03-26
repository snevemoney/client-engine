import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

/**
 * RULE 2.2: Lead Segmentation
 * 
 * Automatically segment leads into MQL/SQL/SAL tiers based on scoring.
 * Routes each tier to appropriate agent workflow.
 * 
 * Trigger: After Scout scores lead (Rule 1.1 → Scout scoring)
 * 
 * Segments:
 *   - MQL (0-69 score): Marketing Qualified Lead → nurture
 *   - SQL (70-89 score): Sales Qualified Lead → Ocelot BANT qualification
 *   - SAL (90-100 score): Sales Accepted Lead → Business outreach
 * 
 * Actions:
 *   1. Receive Scout score
 *   2. Assign segment tier
 *   3. Route to appropriate agent (Ocelot/Business)
 *   4. Set follow-up cadence
 * 
 * Success metric: Leads routed to correct tier within 2 minutes of scoring
 */

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { leadId, score } = body;

    if (!leadId || score === undefined) {
      return NextResponse.json(
        { error: "Missing leadId or score" },
        { status: 400 }
      );
    }

    // Determine tier
    let tier: "MQL" | "SQL" | "SAL";
    let nextAgent: string;
    let followUpDays: number;

    if (score < 70) {
      tier = "MQL";
      nextAgent = "undefined"; // Keep in nurture
      followUpDays = 14;
    } else if (score < 90) {
      tier = "SQL";
      nextAgent = "ocelot";
      followUpDays = 3;
    } else {
      tier = "SAL";
      nextAgent = "business";
      followUpDays = 1;
    }

    // Update lead segment in database
    const segmented = await updateLeadSegment({
      leadId,
      tier,
      score,
      nextAgent,
      followUpDate: new Date(Date.now() + followUpDays * 24 * 60 * 60 * 1000),
    });

    return NextResponse.json({
      success: true,
      leadId,
      segment: tier,
      score,
      nextAgent,
      followUpDays,
      segmented,
    });
  } catch (error) {
    console.error("[Rule 2.2] Error:", error);
    return NextResponse.json(
      { error: "Internal server error", details: String(error) },
      { status: 500 }
    );
  }
}

/**
 * Helper: Update lead segment in database
 */
async function updateLeadSegment(segment: any): Promise<any> {
  // TODO: Update leads table with segment tier
  return {
    success: true,
    leadId: segment.leadId,
    tier: segment.tier,
    updated_at: new Date().toISOString(),
  };
}
