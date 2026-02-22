import { LeadStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

const STATUS_ORDER: LeadStatus[] = [
  "NEW",
  "ENRICHED",
  "SCORED",
  "APPROVED",
  "REJECTED",
  "BUILDING",
  "SHIPPED",
];

const ALLOWED_TRANSITIONS: Record<LeadStatus, LeadStatus[]> = {
  NEW: ["ENRICHED", "SCORED", "REJECTED"],
  ENRICHED: ["SCORED", "REJECTED"],
  SCORED: ["APPROVED", "REJECTED"],
  APPROVED: ["BUILDING", "REJECTED"],
  REJECTED: [],
  BUILDING: ["SHIPPED"],
  SHIPPED: [],
};

type StatusPayload = {
  status?: string;
};

function parseStatus(status: string | undefined): LeadStatus | null {
  if (!status) return null;
  return STATUS_ORDER.includes(status as LeadStatus) ? (status as LeadStatus) : null;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  let body: StatusPayload;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const nextStatus = parseStatus(body.status);
  if (!nextStatus) {
    return NextResponse.json(
      { error: "status must be one of NEW, ENRICHED, SCORED, APPROVED, REJECTED, BUILDING, SHIPPED" },
      { status: 400 }
    );
  }

  const lead = await db.lead.findUnique({
    where: { id },
    include: {
      artifacts: { where: { type: "proposal" }, select: { id: true }, take: 1 },
    },
  });
  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  if (lead.status === nextStatus) return NextResponse.json(lead);

  const allowed = ALLOWED_TRANSITIONS[lead.status as LeadStatus] ?? [];
  if (!allowed.includes(nextStatus)) {
    return NextResponse.json(
      {
        error: `Invalid status transition: ${lead.status} -> ${nextStatus}`,
        currentStatus: lead.status,
        allowedTransitions: allowed,
      },
      { status: 400 }
    );
  }

  if (nextStatus === "APPROVED" && lead.artifacts.length === 0) {
    return NextResponse.json(
      { error: "No proposal artifact. Generate a proposal before approving." },
      { status: 400 }
    );
  }

  const now = new Date();
  const data: {
    status: LeadStatus;
    approvedAt?: Date;
    buildStartedAt?: Date;
    buildCompletedAt?: Date | null;
  } = { status: nextStatus };

  if (nextStatus === "APPROVED") {
    data.approvedAt = now;
  }
  if (nextStatus === "BUILDING") {
    data.buildStartedAt = lead.buildStartedAt ?? now;
    data.buildCompletedAt = null;
  }
  if (nextStatus === "SHIPPED") {
    data.buildStartedAt = lead.buildStartedAt ?? now;
    data.buildCompletedAt = lead.buildCompletedAt ?? now;
  }

  const updated = await db.lead.update({
    where: { id },
    data,
  });

  return NextResponse.json(updated);
}
