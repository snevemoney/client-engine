import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  ACTION_REGISTRY,
  isRegisteredAction,
  type ActionName,
} from "@/lib/ops/actions/registry";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { action?: string; payload?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON body with action required" }, { status: 400 });
  }

  const actionName = typeof body.action === "string" ? body.action.trim() : "";
  if (!actionName) return NextResponse.json({ error: "action required" }, { status: 400 });

  if (!isRegisteredAction(actionName)) {
    return NextResponse.json(
      { error: `Unknown action: ${actionName}. Only registered actions can be executed.` },
      { status: 400 }
    );
  }

  const entry = ACTION_REGISTRY[actionName as ActionName];
  const payload = body.payload ?? {};
  const parseResult = entry.payloadSchema.safeParse(payload);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: parseResult.error.flatten() },
      { status: 400 }
    );
  }

  const userId = session.user.id ?? session.user.email ?? "unknown";
  const run = await db.operatorActionRun.create({
    data: {
      actionName,
      input: payload as object,
      approvedBy: userId,
      status: "queued",
    },
  });

  try {
    await db.operatorActionRun.update({
      where: { id: run.id },
      data: { status: "running" },
    });

    const result = await entry.handler(parseResult.data);

    await db.operatorActionRun.update({
      where: { id: run.id },
      data: {
        status: result.ok ? "success" : "fail",
        resultSummary: result.resultSummary,
        error: result.error ?? null,
      },
    });

    return NextResponse.json({
      ok: result.ok,
      resultSummary: result.resultSummary,
      runId: run.id,
    });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    await db.operatorActionRun.update({
      where: { id: run.id },
      data: {
        status: "fail",
        resultSummary: "Execution threw.",
        error: errMsg,
      },
    });
    console.error("[ops/chat/execute]", err);
    return NextResponse.json(
      { error: errMsg, runId: run.id },
      { status: 500 }
    );
  }
}
