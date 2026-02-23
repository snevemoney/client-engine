import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

function median(nums: number[]): number | null {
  if (nums.length === 0) return null;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const leads = await db.lead.findMany({
    select: {
      createdAt: true,
      proposalSentAt: true,
      approvedAt: true,
      buildStartedAt: true,
      buildCompletedAt: true,
      dealOutcome: true,
    },
    orderBy: { createdAt: "desc" },
    take: 500,
  });

  const total = leads.length;
  const proposalSent = leads.filter((l) => !!l.proposalSentAt).length;
  const approved = leads.filter((l) => !!l.approvedAt).length;
  const buildStarted = leads.filter((l) => !!l.buildStartedAt).length;
  const buildCompleted = leads.filter((l) => !!l.buildCompletedAt).length;
  const won = leads.filter((l) => l.dealOutcome === "won").length;
  const lost = leads.filter((l) => l.dealOutcome === "lost").length;

  const deltas = {
    created_to_proposalSent: leads
      .filter((l) => l.proposalSentAt)
      .map((l) => +new Date(l.proposalSentAt!) - +new Date(l.createdAt)),
    proposalSent_to_approved: leads
      .filter((l) => l.proposalSentAt && l.approvedAt)
      .map((l) => +new Date(l.approvedAt!) - +new Date(l.proposalSentAt!)),
    approved_to_buildStarted: leads
      .filter((l) => l.approvedAt && l.buildStartedAt)
      .map((l) => +new Date(l.buildStartedAt!) - +new Date(l.approvedAt!)),
    buildStarted_to_buildCompleted: leads
      .filter((l) => l.buildStartedAt && l.buildCompletedAt)
      .map((l) => +new Date(l.buildCompletedAt!) - +new Date(l.buildStartedAt!)),
  };

  return NextResponse.json({
    counts: { total, proposalSent, approved, buildStarted, buildCompleted, won, lost },
    rates: {
      proposalSentRate: total ? proposalSent / total : 0,
      approvedRate: proposalSent ? approved / proposalSent : 0,
      buildStartRate: approved ? buildStarted / approved : 0,
      buildCompleteRate: buildStarted ? buildCompleted / buildStarted : 0,
      winRate: approved ? won / approved : 0,
    },
    medianMs: {
      created_to_proposalSent: median(deltas.created_to_proposalSent),
      proposalSent_to_approved: median(deltas.proposalSent_to_approved),
      approved_to_buildStarted: median(deltas.approved_to_buildStarted),
      buildStarted_to_buildCompleted: median(deltas.buildStarted_to_buildCompleted),
    },
  });
}
