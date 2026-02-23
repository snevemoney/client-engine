/**
 * GET /api/meta-ads/mode — Returns current Meta Ads mode and mock scenario.
 * Used by UI to show Mock/Live badge.
 */
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { jsonError } from "@/lib/api-utils";
import { getMetaMode, getMetaMockScenario } from "@/lib/meta-ads/mode";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user) return jsonError("Unauthorized", 401);

  const mode = getMetaMode();
  const payload: { mode: "mock" | "live"; scenario?: string } = { mode };
  if (mode === "mock") {
    payload.scenario = getMetaMockScenario();
  }
  return NextResponse.json(payload);
}
