import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";

/**
 * RULE 2.3: SLA Assignment
 * 
 * Assign response time SLAs based on lead tier and priority.
 * Auto-alert if SLA will be breached.
 * 
 * Trigger: After segmentation (Rule 2.2)
 * 
 * SLA Tiers:
 *   - SAL: 1-hour first response (P0)
 *   - SQL: 4-hour first response (P1)
 *   - MQL: 24-hour first response (P2)
 * 
 * Actions:
 *   1. Assign SLA tier + deadline
 *   2. Create reminder alert (fire at SLA - 15 minutes)
 *   3. Escalate if SLA breached
 * 
 * Success metric: SLA alerts sent 15 min before breach
 */

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { leadId, tier, createdAt } = body;

    if (!leadId || !tier) {
      return NextResponse.json(
        { error: "Missing leadId or tier" },
        { status: 400 }
      );
    }

    // Define SLA based on tier
    const slaMap = {
      SAL: { hours: 1, priority: "P0" },
      SQL: { hours: 4, priority: "P1" },
      MQL: { hours: 24, priority: "P2" },
    };

    const sla = slaMap[tier as keyof typeof slaMap];
    const createdTime = new Date(createdAt).getTime();
    const dueTime = createdTime + sla.hours * 60 * 60 * 1000;
    const alertTime = dueTime - 15 * 60 * 1000; // 15 min before

    // Create SLA record
    const slaRecord = await createSLA({
      leadId,
      tier,
      priority: sla.priority,
      dueAt: new Date(dueTime),
      alertAt: new Date(alertTime),
    });

    return NextResponse.json({
      success: true,
      leadId,
      tier,
      sla: sla.hours,
      priority: sla.priority,
      dueAt: new Date(dueTime).toISOString(),
      alertAt: new Date(alertTime).toISOString(),
      slaRecord,
    });
  } catch (error) {
    console.error("[Rule 2.3] Error:", error);
    return NextResponse.json(
      { error: "Internal server error", details: String(error) },
      { status: 500 }
    );
  }
}

/**
 * Helper: Create SLA record
 */
async function createSLA(sla: any): Promise<any> {
  // TODO: Create SLA record in database
  // TODO: Schedule alert reminder via cron
  return {
    success: true,
    leadId: sla.leadId,
    tier: sla.tier,
    priority: sla.priority,
    created_at: new Date().toISOString(),
  };
}
