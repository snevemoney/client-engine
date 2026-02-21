import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { runWorkdayRun } from "@/lib/ops/workdayRun";

const CRON_SECRET = process.env.RESEARCH_CRON_SECRET;

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const bearer =
    CRON_SECRET && req.headers.get("authorization")?.startsWith("Bearer ")
      ? req.headers.get("authorization")!.slice(7)
      : null;
  if (!bearer || bearer !== CRON_SECRET) {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const summary = await runWorkdayRun();
    return NextResponse.json(summary);
  } catch (err) {
    console.error("[ops/workday-run]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Workday run failed" },
      { status: 500 }
    );
  }
}
